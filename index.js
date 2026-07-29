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
  const res = await fetch(`${BASE44_BASE_URL}/conversations/default`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api_key': BASE44_API_KEY },
    body: JSON.stringify({ external_id: `wa_${phone}` })
  });
  const data = await res.json();
  const convId = data?.id || data?.conversation_id;
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
  return data?.content || data?.message || data?.response || 'Hola! Soy Cesy de Systecam. ¿En qué puedo ayudarte? 😊';
}

async function sendWhatsApp(to, text) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${META_TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
  });
  const data = await res.json();
  console.log('WhatsApp send result:', JSON.stringify(data));
  return data;
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado!');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

app.post('/webhook', async (req, res) => {
  res.status(200).send('OK');
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages || messages.length === 0) return;
    const message = messages[0];
    const from = message.from;
    const msgType = message.type;
    let userText = '';
    if (msgType === 'text') {
      userText = message.text?.body || '';
    } else if (msgType === 'interactive') {
      userText = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
    } else {
      return;
    }
    if (!userText) return;
    console.log(`Mensaje de ${from}: ${userText}`);
    const reply = await askCesy(from, userText);
    await sendWhatsApp(from, reply);
    console.log(`Respuesta enviada a ${from}`);
  } catch (err) {
    console.error('Error:', err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Systecam webhook corriendo en puerto ${PORT}`));

