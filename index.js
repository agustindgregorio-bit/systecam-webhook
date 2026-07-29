const express = require("express");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "systecam_cesy_2026";
const META_TOKEN = process.env.META_WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = "1267250503134581";

// ============ STATE MACHINE ============
// Each user's current state is stored in memory, keyed by phone number
const userStates = new Map();

// ============ MENU TEXTS ============

// AZUL - Main menu
const MAIN_MENU = "Hola! Como estas? Soy Cesy, la asistente virtual de Systecam. Selecciona que tipo de cliente sos:\n\na. Cliente particular\nb. Cliente corporativo";

// CELESTE - Particular submenu
const PARTICULAR_MENU = 'Perfecto, elegiste la opcion "a." Cliente particular. Cual es el motivo de tu mensaje?\n\na. Necesito presupuesto para instalar y configurar un equipo de seguridad\nb. Necesito presupuesto por un servicio tecnico\nc. Necesito informacion con respecto a Systecam Sport\nd. Necesito hablar con una persona';

// VERDE CLARO - Equipment list
const EQUIPMENT_MENU = 'Bien, elegiste la opcion "a." Necesito presupuesto para instalar y configurar un equipo de seguridad. Que equipo necesitas instalar?\n\na. Camaras de seguridad\nb. Central de alarma\nc. Portero visor\nd. Control de acceso\ne. Necesito presupuesto por mas de unas de las opciones presentadas\nf. Volver al menu anterior';

// AMARILLO - Camera quantities
const CAMERAS_MENU = 'Genial, eligio la opcion "a." Camaras de seguridad. Cuantas camaras necesita instalar?\n\na. Quiero instalar 1 camara\nb. Quiero instalar 2 camaras\nc. Quiero instalar 3 camaras\nd. Quiero instalar 4 camaras\ne. Quiero instalar 5 camaras\nf. Quiero instalar 6 camaras\ng. Quiero instalar 7 camaras\nh. Quiero instalar 8 camaras\ni. Quiero instalar mas de 8 camaras\nj. Volver al menu anterior';

// NARANJA - Camera price closing options
const PRICE_CLOSING = "\n\na. Me interesa, seguir el cierre del presupuesto con una persona\nb. No me interesa\nc. Volver al menu anterior";

// BORDO - Interested closing
const INTERESTED_MSG = 'Eligio la opcion "a" Me interesa, seguir el cierre del presupuesto con una persona. Para el seguimiento con nuestro personal deberas esperar al horario de atencion, que es de lunes a viernes de 09:00 a 13:00. Ni bien lea su solicitud le daran una respuesta. Te puedo ayudar con otra consulta?\n\na. Si, volver al menu principal\nb. No, gracias';

// Close messages
const NOT_INTERESTED_CLOSE = 'Eligio la opcion "b" No me interesa. Entendido!! Cualquier cosa te podes volver a comunicar conmigo con un "hola Cesy" o con nuestro personal que estan de lunes a sabado de 09:00 a 13:00. Doy por finalizada la conversacion, que termine bien su dia!!';

const NO_THANKS_CLOSE = 'Eligio la opcion "b" No, gracias. Entendido!! Cualquier cosa te podes volver a comunicar conmigo con un "hola Cesy" o con nuestro personal que estan de lunes a sabado de 09:00 a 13:00. Doy por finalizada la conversacion, que termine bien su dia!!';

// ============ HELPER FUNCTIONS ============

function cameraPriceMsg(optionLetter, count, price) {
  var word = count === 1 ? "camara" : "camaras";
  return 'Perfecto, eligio la opcion "' + optionLetter + '" Quiero instalar ' + count + ' ' + word + '. Te comento, el valor aproximado por la instalacion de ' + count + ' ' + word + ' de seguridad esta $' + price + ',00 final IVA incluido. El mismo puede variar segun la complejidad del trabajo a realizar o la lejania de la zona, puede ser mas o menos. Por favor, elija alguna de las siguientes respuestas para avanzar:' + PRICE_CLOSING;
}

function equipmentPriceMsg(optionLetter, name, price) {
  return 'Genial, eligio la opcion "' + optionLetter + '" ' + name + '. Te comento, el valor aproximado por la instalacion y configuracion de ' + name + ' basica esta $' + price + ',00 final IVA incluido. El mismo puede variar segun la complejidad del trabajo a realizar o la lejania de la zona, puede ser mas o menos. Por favor, elija alguna de las siguientes respuestas para avanzar:' + PRICE_CLOSING;
}

// ============ STATE DEFINITIONS ============

const STATES = {
  // AZUL - Main menu
  START: {
    msg: MAIN_MENU,
    next: { a: "PARTICULAR", b: "CORPORATIVO" }
  },

  // CELESTE - Particular
  PARTICULAR: {
    msg: PARTICULAR_MENU,
    next: { a: "EQUIPMENT", b: "SERVICE_TECH", c: "SPORT", d: "TALK_PERSON" }
  },

  // CORPORATIVO (TODO - not yet defined)
  CORPORATIVO: {
    msg: 'Perfecto, elegiste la opcion "b." Cliente corporativo. Para atender clientes corporativos, nuestro equipo esta disponible de lunes a viernes de 09:00 a 13:00. Por favor, comunicate en ese horario o dejanos tu consulta y te responderan a la brevedad.\n\na. Volver al menu principal',
    next: { a: "START" }
  },

  // VERDE CLARO - Equipment list
  EQUIPMENT: {
    msg: EQUIPMENT_MENU,
    next: { a: "CAMERAS", b: "ALARMA", c: "PORTERO", d: "CONTROL", e: "MULTI", f: "PARTICULAR" }
  },

  // AMARILLO - Camera quantities
  CAMERAS: {
    msg: CAMERAS_MENU,
    next: { a: "CAM1", b: "CAM2", c: "CAM3", d: "CAM4", e: "CAM5", f: "CAM6", g: "CAM7", h: "CAM8", i: "CAM_MORE", j: "EQUIPMENT" }
  },

  // NARANJA - Camera prices (1-8)
  CAM1: { msg: cameraPriceMsg("a", 1, "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" } },
  CAM2: { msg: cameraPriceMsg("b", 2, "230.296"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" } },
  CAM3: { msg: cameraPriceMsg("c", 3, "290.173"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" } },
  CAM4: { msg: cameraPriceMsg("d", 4, "359.814"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" } },
  CAM5: { msg: cameraPriceMsg("e", 5, "420.982"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" } },
  CAM6: { msg: cameraPriceMsg("f", 6, "479.919"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" } },
  CAM7: { msg: cameraPriceMsg("g", 7, "652.690"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" } },
  CAM8: { msg: cameraPriceMsg("h", 8, "822.389"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" } },
  
  // NARANJA - More than 8 cameras (special)
  CAM_MORE: {
    msg: 'Perfecto, eligio la opcion "i" Quiero instalar mas de 8 camaras. El valor estimativo puede ser de 1 millon en adelante. La cantidad de camaras exceden a nuestra lista, tu consulta sera derivada a nuestro tecnico para poder dar un mejor asesoramiento.\n\na. Me interesa, seguir la consulta con el tecnico\nb. No me interesa\nc. Volver al menu anterior',
    next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" }
  },

  // AMARILLO - Equipment prices (alarma, portero, control, multi)
  ALARMA: { msg: equipmentPriceMsg("b", "una central de alarma", "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT" } },
  PORTERO: { msg: equipmentPriceMsg("c", "un portero visor", "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT" } },
  CONTROL: { msg: equipmentPriceMsg("d", "un control de acceso", "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT" } },
  
  MULTI: {
    msg: 'Genial, eligio la opcion "e." Necesito presupuesto por mas de unas de las opciones presentadas. En ese caso voy a tener que derivar tu consulta a nuestro personal. Te comento los horarios de atencion: lunes a sabado de 09:00 a 13:00. Por favor, elija alguna de las siguientes respuestas para avanzar:' + PRICE_CLOSING,
    next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT" }
  },

  // VERDE CLARO - Service tech
  SERVICE_TECH: {
    msg: 'Bien, elegiste la opcion "b." Necesito presupuesto por un servicio tecnico. Te comento, nuestro servicio tecnico basico tiene un valor de $169.400,00. El mismo puede variar segun la complejidad del trabajo a realizar, puede ser mas o menos. Por favor, elija alguna de las siguientes respuestas para avanzar:\n\na. Me interesa, seguir el cierre del presupuesto con una persona\nb. No me interesa\nc. Volver al menu anterior',
    next: { a: "INTERESTED_TECH", b: "NOT_INTERESTED_TECH", c: "PARTICULAR" }
  },

  // VERDE CLARO - Systecam Sport
  SPORT: {
    msg: 'Bien, elegiste la opcion "c." Necesito informacion con respecto a Systecam Sport. Te cuento, con Systecam Sport tu club puede ofrecer a los jugadores la posibilidad de ver, descargar y compartir sus partidos desde una app exclusiva, brindando una experiencia unica. Nosotros instalamos todo el sistema, aportamos el equipamiento en comodato y nos ocupamos del soporte y mantenimiento. Es una excelente forma de diferenciarte de la competencia, fidelizar a tus clientes y sumar un nuevo valor a tus canchas. Te gustaria que te envie la propuesta completa?\n\na. Si, enviamela completa\nb. No, gracias\nc. Volver al menu anterior',
    next: { a: "SPORT_PROPOSAL", b: "SPORT_NO_THANKS", c: "PARTICULAR" }
  },

  // AMARILLO - Sport proposal (sends PDF)
  SPORT_PROPOSAL: {
    msg: 'Genial, eligio la opcion "a." Si, enviamela completa. Te envio ahora mismo la propuesta completa de Systecam Sport! Cualquier consulta adicional, nuestro equipo esta disponible de lunes a sabado de 09:00 a 13:00. Te puedo ayudar con algo mas?\n\na. Si, volver al menu principal\nb. No, gracias',
    sendPDF: true,
    pdfUrl: 'https://base44.app/api/apps/6a62196e2adcb0256123773e/files/mp/public/6a62196e2adcb0256123773e/85232d902_61f6a1511_SystecamSport-Propuestacomercial.pdf',
    pdfName: 'Systecam-Sport-Propuesta-Comercial.pdf',
    pdfCaption: 'Propuesta Comercial - SYSTECAM Sport',
    next: { a: "START", b: "END_NO_THANKS" }
  },

  // AMARILLO - Sport no thanks
  SPORT_NO_THANKS: {
    msg: NO_THANKS_CLOSE,
    next: {},
    isEnd: true
  },

  // VERDE CLARO - Talk to person
  TALK_PERSON: {
    msg: 'Bien, elegiste la opcion "d." Necesito hablar con una persona. Para poder comunicarte con nuestro personal deberas esperar al horario de atencion, que es de lunes a sabados de 09:00 a 13:00. Ni bien lea su consulta le daran una respuesta. Te puedo ayudar con otra consulta?\n\na. Si, volver al menu principal\nb. No, gracias',
    next: { a: "START", b: "END_NO_THANKS" }
  },

  // BORDO - Interested (from camera/equipment prices)
  INTERESTED: {
    msg: INTERESTED_MSG,
    next: { a: "CONFIRM_MAIN", b: "END_NO_THANKS" }
  },

  // BORDO - Interested (from service tech)
  INTERESTED_TECH: {
    msg: 'Eligio la opcion "a" Me interesa, seguir el cierre del presupuesto con una persona. Para el seguimiento con nuestro personal deberas esperar al horario de atencion, que es de lunes a viernes de 09:00 a 13:00. Ni bien lea su solicitud le daran una respuesta. Te puedo ayudar con otra consulta?\n\na. Si, volver al menu principal\nb. No, gracias',
    next: { a: "CONFIRM_MAIN", b: "END_NO_THANKS" }
  },

  // BORDO - Not interested (from camera/equipment prices)
  NOT_INTERESTED: {
    msg: NOT_INTERESTED_CLOSE,
    next: {},
    isEnd: true
  },

  // BORDO - Not interested (from service tech)
  NOT_INTERESTED_TECH: {
    msg: NOT_INTERESTED_CLOSE,
    next: {},
    isEnd: true
  },

  // VERDE OSCURO - Confirm return to main menu
  CONFIRM_MAIN: {
    msg: 'Eligio la opcion "a" Si, volver al menu principal.\n\n' + MAIN_MENU,
    next: { a: "PARTICULAR", b: "CORPORATIVO" }
  },

  // END - No thanks
  END_NO_THANKS: {
    msg: NO_THANKS_CLOSE,
    next: {},
    isEnd: true
  }
};

// ============ WHATSAPP SENDING ============

async function sendWhatsApp(to, text) {
  var url = "https://graph.facebook.com/v19.0/" + PHONE_NUMBER_ID + "/messages";
  try {
    var res = await fetch(url, {
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
    });
    var data = await res.json();
    console.log("WhatsApp send:", JSON.stringify(data));
  } catch (err) {
    console.error("Error sending WhatsApp:", err.message);
  }
}

// ============ SEND PDF DOCUMENT ============

async function sendWhatsAppDocument(to, url, filename, caption) {
  var docUrl = "https://graph.facebook.com/v19.0/" + PHONE_NUMBER_ID + "/messages";
  try {
    var res = await fetch(docUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + META_TOKEN
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "document",
        document: {
          link: url,
          filename: filename,
          caption: caption
        }
      })
    });
    var data = await res.json();
    console.log("WhatsApp PDF send:", JSON.stringify(data));
  } catch (err) {
    console.error("Error sending PDF:", err.message);
  }
}

// ============ MESSAGE PROCESSING ============

function processMessage(from, userText) {
  var text = userText.toLowerCase().trim();
  var currentState = userStates.get(from) || "START";

  // If in an END state, only respond to greetings
  if (STATES[currentState] && STATES[currentState].isEnd) {
    if (text.match(/^(hola|buenas|buen[ao]s|hi|hello|saludos|buenas tardes|buenas noches|buenos dias|buen dia|hola cesy)/)) {
      userStates.set(from, "START");
      return { msg: STATES.START.msg };
    }
    return { msg: 'Gracias por tu mensaje! Si necesitas ayuda, escribi "hola Cesy" para comenzar de nuevo. 😊' };
  }

  // If no state (first message) or user sends a greeting
  if (currentState === "START" && text.match(/^(hola|buenas|buen[ao]s|hi|hello|saludos|buenas tardes|buenas noches|buenos dias|buen dia|hola cesy)/)) {
    userStates.set(from, "START");
    return { msg: STATES.START.msg };
  }

  var state = STATES[currentState];
  if (!state) {
    userStates.set(from, "START");
    return STATES.START.msg;
  }

  // Extract the option letter (a, b, c, d, e, f, g, h, i, j)
  var option = text.match(/^([a-j])/);
  if (option) {
    var letter = option[1];
    var nextState = state.next[letter];
    if (nextState) {
      userStates.set(from, nextState);
      var next = STATES[nextState];
      if (next) {
        return { msg: next.msg, sendPDF: next.sendPDF || false, pdfUrl: next.pdfUrl, pdfName: next.pdfName, pdfCaption: next.pdfCaption };
      }
    }
  }

  // If input not recognized, show current state message again with a hint
  return { msg: 'Por favor, elegi una opcion valida (a, b, c, etc.). 😊\n\n' + state.msg };
}

// ============ WEBHOOK ENDPOINTS ============

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

app.post("/webhook", async function(req, res) {
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
    var result = processMessage(from, userText);
    await sendWhatsApp(from, result.msg);
    if (result.sendPDF) {
      await sendWhatsAppDocument(from, result.pdfUrl, result.pdfName, result.pdfCaption);
    }
    console.log("Respuesta enviada a " + from);
  } catch (err) {
    console.error("Error: " + err.message);
  }
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log("Systecam webhook corriendo en puerto " + PORT);
});
