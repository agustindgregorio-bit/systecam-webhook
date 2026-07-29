const express = require('express');
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "systecam_cesy_2026";
const META_TOKEN = [process.env.ME](https://process.env.ME)TA_WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = "1267250503134581";
const BASE44_AGENT_ID = "6a62196e2adcb0256123773e";
const BASE44_API_KEY = process.env.BASE44_API_KEY;
const BASE44_BASE_URL = `https://app.base44.com/api/agents/${BASE44_AGENT_ID}`;

const conversationCache = {};

async function getCesyConversationId(phone) {
  if (conversationCache[phone]) return conversationCache[phone];
  const res = await fetch(`${BASE44_BASE_URL}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api_key': BASE44_API_KEY },
    body: JSON.stringify({ title: `WhatsApp - ${phone}` })
  });
  const data = await res.json();
  const convId = data?.id;
  if (convId) conversationCache[phone] = convId;
  return convId;
}

async function askCesy(phone, text) {
  const convId = await getCesyConversationId(phone);
  if (!convId) throw new Error('No se pudo obtener conversationId');
  const res = await fetch(`${BASE44_BASE_URL}/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api_key': BASE44_API_KEY },
    body: JSON.stringify({ content: text })
  });
  const data = await res.json();
  console.log('Respuesta Cesy raw:', JSON.stringify(data));
  return data?.content || data?.message || data?.response ||
