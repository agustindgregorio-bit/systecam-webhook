// /opt/systecam-worker/worker.js
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// ====== CONFIG ======
const APP_ID        = process.env.BASE44_APP_ID;        // ej: 6a4c5e2b2fb710671a25cde0
const API_BASE      = process.env.BASE44_API_BASE;      // ej: https://eu.base44.com
const WORKER_TOKEN   = process.env.FFMPEG_SERVICE_TOKEN; // mismo secret que en Base44
const POLL_INTERVAL  = 15 * 1000;
const TMP_DIR        = '/opt/systecam-worker/tmp';
fs.mkdirSync(TMP_DIR, { recursive: true });

if (!APP_ID || !API_BASE || !WORKER_TOKEN) {
  console.error('Faltan variables de entorno BASE44_APP_ID / BASE44_API_BASE / FFMPEG_SERVICE_TOKEN');
  process.exit(1);
}

const POLL_URL = `${API_BASE}/api/apps/${APP_ID}/functions/pollTranscodeJobs`;

// ====== Helpers ======
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

function parseAuthHeader(h) {
  const out = {};
  const m = h.match(/realm="([^"]+)"/); if (m) out.realm = m[1];
  const n = h.match(/nonce="([^"]+)"/); if (n) out.nonce = n[1];
  const q = h.match(/qop="([^"]+)"/); if (q) out.qop = q[1];
  const o = h.match(/opaque="([^"]+)"/); if (o) out.opaque = o[1];
  return out;
}

function buildDigest(challenge, method, uri, user, pass) {
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const ha1 = md5(`${user}:${challenge.realm}:${pass}`);
  const ha2 = md5(`${method}:${uri}`);
  const resp = challenge.qop
    ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`);
  let val = `Digest username="${user}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${resp}"`;
  if (challenge.qop) val += `, qop=${challenge.qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (challenge.opaque) val += `, opaque="${challenge.opaque}"`;
  return val;
}

// Digest-authed HTTP. Replays the request with Authorization after a 401.
async function digestFetch(url, { method = 'GET', body, headers = {}, user, pass } = {}) {
  const first = await fetch(url, { method, body, headers, redirect: 'manual' });
  if (first.status !== 401) return first;
  const ch = parseAuthHeader(first.headers.get('www-authenticate') || '');
  if (!ch.nonce) return first;
  const u = new URL(url);
  const auth = buildDigest(ch, method, u.pathname + u.search, user, pass);
  return fetch(url, { method, body, headers: { ...headers, Authorization: auth }, redirect: 'manual' });
}

// ====== NVR time helpers (NVR clock = BA local, Z ignored) ======
const BA_OFFSET_MS = 3 * 60 * 60 * 1000;
const pad2 = (n) => String(n).padStart(2, '0');
const parseTime = (t) => {
  const clean = t.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  return new Date(clean + 'Z').getTime() + BA_OFFSET_MS;
};
const toNvrTime = (t) => `${t}Z`;
const toHikTime = (t) => toNvrTime(t).replace(/[-:]/g, '');

// ====== NVR search + download ======
async function findPlaybackUri(nvrUrl, user, pass, channel, startTime, endTime) {
  const base = new URL(nvrUrl.startsWith('http') ? nvrUrl : `http://${nvrUrl}`).origin;
  const mainTrack = String(parseInt(channel) * 100 + 1);
  const subTrack  = String(parseInt(channel) * 100 + 2);
  const datePart = startTime.split('T')[0];
  const searchStart = toNvrTime(`${datePart}T00:00:00`);
  const searchEnd   = toNvrTime(`${datePart}T23:59:59`);
  const reqStart = parseTime(startTime);

  const searchXml = (trackId) => `<?xml version="1.0" encoding="UTF-8"?>
<CMSearchDescription version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<searchID>${crypto.randomUUID().toUpperCase()}</searchID>
<trackList><trackID>${trackId}</trackID></trackList>
<timeSpanList><timeSpan><startTime>${searchStart}</startTime><endTime>${searchEnd}</endTime></timeSpan></timeSpanList>
<maxResults>40</maxResults><searchResultPostion>0</searchResultPostion>
<metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor>
</CMSearchDescription>`;

  const searchPath = '/ISAPI/ContentMgmt/search';
  const runSearch = async (trackId) => {
    const r = await digestFetch(base + searchPath, {
      method: 'POST', body: searchXml(trackId), user, pass,
      headers: { 'Content-Type': 'application/xml' },
    });
    const text = await r.text();
    const results = [];
    const re = /<searchMatchItem>([\s\S]*?)<\/searchMatchItem>/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const item = m[1];
      const pb = item.match(/<playbackURI>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/playbackURI>/s)?.[1]?.trim()?.replace(/&amp;/g, '&')?.replace(/&lt;/g, '<')?.replace(/&gt;/g, '>');
      const s = item.match(/<startTime>(.*?)<\/startTime>/)?.[1]?.trim();
      const e = item.match(/<endTime>(.*?)<\/endTime>/)?.[1]?.trim();
      if (pb) results.push({ playbackURI: pb, startTime: s, endTime: e });
    }
    return results;
  };

  let results = await runSearch(subTrack);
  if (results.length === 0) results = await runSearch(mainTrack);
  if (results.length === 0) throw new Error('No se encontraron grabaciones');

  // best: contains reqStart, else closest within 30 min
  let best = null, bestDiff = Infinity, containing = false;
  for (const r of results) {
    const ss = parseTime(r.startTime), se = parseTime(r.endTime);
    if (ss <= reqStart && reqStart <= se) {
      containing = true;
      const d = Math.abs(ss - reqStart);
      if (d < bestDiff) { bestDiff = d; best = r; }
    }
  }
  if (!containing) {
    for (const r of results) {
      const d = Math.abs(parseTime(r.startTime) - reqStart);
      if (d < bestDiff) { bestDiff = d; best = r; }
    }
    if (!best || bestDiff > 30 * 60 * 1000) throw new Error('No se encontraron grabaciones cercanas');
  }

  const startHik = toHikTime(startTime);
  const endHik   = toHikTime(endTime);
  const uri = best.playbackURI
    .replace(/tracks\/\d+/, `tracks/${subTrack}`)
    .replace(/starttime=[^&]*/i, `starttime=${startHik}`)
    .replace(/endtime=[^&]*/i, `endtime=${endHik}`)
    .replace(/&size=[^&]*/i, '');

  return { downloadUrl: base, body: `<downloadRequest><playbackURI>${uri.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</playbackURI></downloadRequest>` };
}

async function downloadToTemp(downloadUrl, body, user, pass, outPath) {
  const r = await digestFetch(downloadUrl + '/ISAPI/ContentMgmt/download', {
    method: 'POST', body, user, pass,
    headers: { 'Content-Type': 'application/xml' },
  });
  if (!r.ok || !r.body) throw new Error(`Descarga NVR falló: ${r.status}`);

  // Stream to temp file, stripping the 40-byte Hikvision IMKH header if present.
  const reader = r.body.getReader();
  const out = fs.createWriteStream(outPath);
  let firstChunk = true;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    let chunk = value;
    if (firstChunk) {
      firstChunk = false;
      if (chunk.length >= 4 && chunk[0] === 0x49 && chunk[1] === 0x4D && chunk[2] === 0x4B && chunk[3] === 0x48) {
        chunk = chunk.slice(40);
      }
    }
    out.write(chunk);
  }
  await new Promise((res, rej) => out.end((e) => e ? rej(e) : res()));
}

// ====== ffmpeg remux to MP4 + faststart ======
function transcode(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // copy video (H.264), encode audio to aac if present, faststart for web playback
    const ff = spawn('ffmpeg', [
      '-y', '-i', inputPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputPath,
    ]);
    let err = '';
    ff.stderr.on('data', (d) => { err += d.toString(); });
    ff.on('close', (code) => code === 0 ? resolve() : reject(new Error('ffmpeg falló: ' + err.slice(-800))));
  });
}

// ====== Upload MP4 to R2 via presigned PUT ======
async function uploadToR2(filePath, uploadUrl) {
  const buf = fs.readFileSync(filePath);
  const r = await fetch(uploadUrl, { method: 'PUT', body: buf, headers: { 'Content-Type': 'video/mp4' } });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Upload R2 falló ${r.status}: ${t.slice(0, 300)}`);
  }
}

// ====== Callback to finalizeTranscode ======
async function notify(callbackUrl, payload) {
  await fetch(callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${WORKER_TOKEN}` },
    body: JSON.stringify(payload),
  });
}

// ====== Process one job ======
async function processJob(job) {
  console.log(`[${new Date().toISOString()}] Procesando ${job.cache_key} canal ${job.channel}`);
  const tmpPs  = path.join(TMP_DIR, `${job.cache_key}.ps`);
  const tmpMp4 = path.join(TMP_DIR, `${job.cache_key}.mp4`);
  try {
    const { downloadUrl, body } = await findPlaybackUri(job.nvr_url, job.nvr_username, job.nvr_password, job.channel, job.start_time, job.end_time);
    await downloadToTemp(downloadUrl, body, job.nvr_username, job.nvr_password, tmpPs);
    if (fs.statSync(tmpPs).size < 1000) throw new Error('Descarga vacía (sin frames)');
    await transcode(tmpPs, tmpMp4);
    await uploadToR2(tmpMp4, job.upload_url);
    await notify(job.callback_url, { cache_key: job.cache_key, status: 'ready', object_key: job.object_key });
    console.log(`[${job.cache_key}] OK`);
  } catch (e) {
    console.error(`[${job.cache_key}] ERROR:`, e.message);
    try { await notify(job.callback_url, { cache_key: job.cache_key, status: 'error', error_message: e.message.slice(0, 500) }); } catch {}
  } finally {
    try { fs.unlinkSync(tmpPs); } catch {}
    try { fs.unlinkSync(tmpMp4); } catch {}
  }
}

// ====== Main loop ======
async function main() {
  console.log('Worker SYSTECAM iniciado. Poll cada 15s.');
  for (;;) {
    try {
      const r = await fetch(POLL_URL, { headers: { 'Authorization': `Bearer ${WORKER_TOKEN}` } });
      const job = await r.json();
      if (job.empty) { await sleep(POLL_INTERVAL); continue; }
      if (job.error) { console.error('poll error:', job.error); await sleep(POLL_INTERVAL); continue; }
      await processJob(job);
    } catch (e) {
      console.error('loop error:', e.message);
      await sleep(POLL_INTERVAL);
    }
  }
}

main();