const express = require('express');
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "systecam_cesy_2026";
const META_TOKEN = process.env.META_WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = "1267250503134581";
const BASE44_AGENT_ID = "6a62196e2adcb0256123773e";
const BASE44_API_KEY = process.env.BASE44_API_KEY;
const BASE44_BASE_URL = "https://app.base44.com/api/agents/" + BASE44_AGENT_ID;

const conversationCache = {};

async function getCesyConversationId(phone) {
  if (conversationCache[phone]) return conversationCache[phone];
  const res = await fetch(BASE44_BASE_URL + "/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api_key": BASE44_API_KEY },
    body: JSON.stringify({ title: "WhatsApp - " + phone })
  });
  const data = await res.json();
  const convId = data && data.id;
  if (convId) conversationCache[phone] = convId;
  return convId;
}

async function askCesy(phone, text) {
  const convId = await getCesyConversationId(phone);
  if (!convId) throw new Error("No se pudo obtener conversationId");
  const res = await fetch(BASE44_BASE_URL + "/conversations/" + convId + "/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api_key": BASE44_API_KEY },
    body: JSON.stringify({ content: text })
  });
  const data = await res.json();
  console.log("Respuesta Cesy:", JSON.stringify(data));
  return (data && (data.content || data.message || data.response)) || "Hola! Soy Cesy de Systecam. En que puedo ayudarte?";
}

async function sendWhatsApp(to, text) {
  const res = await fetch("https://graph.facebook.com/v19.0/" + PHONE_NUMBER_ID + "/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + META_TOKEN },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to, type: "text", text: { body: text } })
  });
  const data = await res.json();
  console.log("WhatsApp send:", JSON.stringify(data));
}

app.get("/webhook", function(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Forbidden");
  }
});

app.post("/webhook", async function(req, res) {
  res.status(200).send("OK");
  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") return;
    const entry = body.entry && body.entry[0];
    const change = entry && entry.changes && entry.changes[0];
    const value = change && change.value;
    const messages = value && value.messages;
    if (!messages || messages.length === 0) return;
    const message = messages[0];
    const from = message.from;
    const msgType = message.type;
    let userText = "";
    if (msgType === "text") {
      userText = (message.text && message.text.body) || "";
    } else {
      return;
    }
    if (!userText) return;
    console.log("Mensaje de " + from + ": " + userText);
    const reply = await askCesy(from, userText);
    await sendWhatsApp(from, reply);
  } catch (err) {
    console.error("Error:", err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log("Systecam webhook corriendo en puerto " + PORT); });
