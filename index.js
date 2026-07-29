const express = require("express");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "systecam_cesy_2026";
const META_TOKEN = process.env.META_WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = "1267250503134581";

function sendWhatsApp(to, text) {
  return fetch("https://graph.facebook.com/v19.0/" + PHONE_NUMBER_ID + "/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + META_TOKEN
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text }
    })
  }).then(function(r) { return r.json(); }).then(function(d) {
    console.log("WA enviado a " + to + ": " + JSON.stringify(d));
    return d;
  });
}

function responderCesy(userText) {
  var t = userText.toLowerCase().trim();

  if (t.match(/^(hola|buenas|buen[ao]s|hi|hello|saludos|buenas tardes|buenas noches|buenos dias|buen dia)/)) {
    return "Hola! Soy *Cesy*, la asistente virtual de *Systecam Soluciones Integrales*.\n\nEn que puedo ayudarte hoy?\n\n*1* - Presupuesto de camaras de seguridad\n*2* - Servicio tecnico\n*3* - Soy cliente corporativo\n*4* - Hablar con una persona\n\nResponde con el numero de la opcion que necesitas";
  }
  if (t === "1" || t.match(/camara|presupuesto|seguridad/)) {
    return "Genial! Te ayudo con el presupuesto de camaras.\n\nCuantas camaras necesitas?\n\n*1* - 1 a 4 camaras\n*2* - 5 a 8 camaras\n*3* - 9 o mas camaras";
  }
  if (t === "2" || t.match(/tecnico|servicio|reparacion|no funciona|falla|problema/)) {
    return "Servicio Tecnico Systecam\n\nNuestro equipo tecnico esta disponible de *lunes a viernes de 9:00 a 13:00 hs*.\n\nCuentame brevemente cual es el problema y te coordino una visita.";
  }
  if (t === "3" || t.match(/corporativo|empresa|negocio|comercio/)) {
    return "Clientes Corporativos\n\nPara coordinar una visita tecnica o presupuesto para tu empresa, necesito algunos datos:\n\nCual es el nombre de tu empresa?";
  }
  if (t === "4" || t.match(/persona|humano|agente|hablar con|asesor/)) {
    return "Entendido! Nuestro equipo de atencion al cliente esta disponible:\n\n*Lunes a Viernes de 9:00 a 13:00 hs*\n\nEn ese horario podes escribirnos y un asesor te va a atender personalmente. Hasta luego!";
  }
  return "Hola! Soy *Cesy* de *Systecam*.\n\nPara ayudarte mejor, elegi una opcion:\n\n*1* - Presupuesto de camaras\n*2* - Servicio tecnico\n*3* - Cliente corporativo\n*4* - Hablar con una persona";
}

app.get("/webhook", function(req, res) {
  var mode = req.query["hub.mode"];
  var token = req.query["hub.verify_token"];
  var challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado OK");
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Forbidden");
  }
});

app.post("/webhook", function(req, res) {
  res.status(200).send("OK");
  try {
    var body = req.body;
    if (body.object !== "whatsapp_business_account") return;
    var entry = body.entry && body.entry[0];
    var change = entry && entry.changes && entry.changes[0];
    var value = change && change.value;
    var messages = value && value.messages;
    if (!messages || messages.length === 0) return;
    var message = messages[0];
    var from = message.from;
    var msgType = message.type;
    var userText = "";
    if (msgType === "text") {
      userText = (message.text && message.text.body) || "";
    } else {
      console.log("Tipo ignorado: " + msgType);
      return;
    }
    if (!userText) return;
    console.log("Mensaje de " + from + ": " + userText);
    var reply = responderCesy(userText);
    sendWhatsApp(from, reply).catch(function(e) {
      console.error("Error enviando WA: " + e.message);
    });
  } catch (err) {
    console.error("Error webhook: " + err.message);
  }
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log("Systecam Cesy corriendo en puerto " + PORT);
});
