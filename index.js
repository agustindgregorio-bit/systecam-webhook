const express = require("express");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "systecam_cesy_2026";
const META_TOKEN = process.env.META_WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = "1267250503134581";

// ============ API ENDPOINTS ============
var CALENDAR_API = "https://cesy.base44.app/api/apps/6a62196e2adcb0256123773e/functions/calendarManager";
var LOOKUP_API = "https://systecam-admin-flow.base44.app/api/apps/6a68d0fd479a5dbdc16652fb/functions/lookupClient";
var EMAIL_API = "https://cesy.base44.app/api/apps/6a62196e2adcb0256123773e/functions/sendBookingEmail";
var LOG_API = "https://cesy.base44.app/api/apps/6a62196e2adcb0256123773e/functions/logConversation";

// ============ STATE MACHINE ============
var userStates = new Map();

// ============ MENU TEXTS ============

var MAIN_MENU = "Hola! Como estas? Soy *Cesy*, la asistente virtual de *Systecam*. Selecciona que tipo de cliente sos:\n\na. 🏠 Cliente particular\n\nb. 🏢 Cliente corporativo";

var PARTICULAR_MENU = 'Perfecto, elegiste la opcion "a." *Cliente particular*. Cual es el motivo de tu mensaje?\n\na. 🛡️ Necesito presupuesto para instalar y configurar un equipo de seguridad\n\nb. 🔧 Necesito presupuesto por un servicio tecnico\n\nc. ⚽ Necesito informacion con respecto a *Systecam Sport*\n\nd. 👤 Necesito hablar con una persona\n\ne. ↩️ Volver al menu principal\n\nf. 👋 Finalizar conversacion';

var EQUIPMENT_MENU = 'Bien, elegiste la opcion "a." *Presupuesto para equipo de seguridad*. Que equipo necesitas instalar?\n\na. 📷 Camaras de seguridad\n\nb. 🔔 Central de alarma\n\nc. 🚪 Portero visor\n\nd. 🔑 Control de acceso\n\ne. 📋 Presupuesto por mas de una de las opciones\n\nf. ↩️ Volver al menu anterior\n\ng. 👋 Finalizar conversacion';

var CAMERAS_MENU = 'Genial! Elegiste *Camaras de seguridad* 📷. Cuantas camaras necesita instalar?\n\na. 📹 1 camara\n\nb. 📹 2 camaras\n\nc. 📹 3 camaras\n\nd. 📹 4 camaras\n\ne. 📹 5 camaras\n\nf. 📹 6 camaras\n\ng. 📹 7 camaras\n\nh. 📹 8 camaras\n\ni. 📹 Mas de 8 camaras\n\nj. ↩️ Volver al menu anterior\n\nk. 👋 Finalizar conversacion';

var PRICE_CLOSING = "\n\nc. ↩️ Volver al menu anterior\n\nd. 👋 Finalizar conversacion";

var INTERESTED_MSG = 'Eligio la opcion "a" *Me interesa*, seguir el cierre del presupuesto con una persona. Para el seguimiento con nuestro personal deberas esperar al horario de atencion, que es de *lunes a viernes de 09:00 a 13:00*. Ni bien lea su solicitud le daran una respuesta. Te puedo ayudar con otra consulta?\n\na. 🏠 Si, volver al menu principal\n\nb. 👋 No, gracias';

var NOT_INTERESTED_CLOSE = 'Entendido!! Cualquier cosa te podes volver a comunicar conmigo con un *"hola Cesy"* o con nuestro personal que estan de *lunes a sabado de 09:00 a 13:00*. Doy por finalizada la conversacion, que termine bien su dia! 👋';

var NO_THANKS_CLOSE = 'Entendido!! Cualquier cosa te podes volver a comunicar conmigo con un *"hola Cesy"* o con nuestro personal que estan de *lunes a sabado de 09:00 a 13:00*. Doy por finalizada la conversacion, que termine bien su dia! 👋';

var FINALIZAR_MSG = 'Entendido!! Cualquier cosa te podes volver a comunicar conmigo con un *"hola Cesy"* y con gusto te ayudo. Doy por finalizada la conversacion, que termines muy bien tu dia! 👋';

// ============ HELPER FUNCTIONS ============

function cameraPriceMsg(optionLetter, count, price) {
  var word = count === 1 ? "camara" : "camaras";
  return 'Perfecto! Elegiste *' + count + ' ' + word + '* 📹. Te comento, el valor aproximado por la instalacion de ' + count + ' ' + word + ' de seguridad esta *$' + price + ',00* final IVA incluido. El mismo puede variar segun la complejidad del trabajo a realizar o la lejania de la zona, puede ser mas o menos. Por favor, elija alguna de las siguientes respuestas para avanzar:\n\na. ✅ Me interesa, seguir el cierre del presupuesto con una persona\n\nb. ❌ No me interesa' + PRICE_CLOSING;
}

function equipmentPriceMsg(optionLetter, name, price) {
  return 'Genial! Elegiste *' + name + '*. Te comento, el valor aproximado por la instalacion y configuracion de ' + name + ' basica esta *$' + price + ',00* final IVA incluido. El mismo puede variar segun la complejidad del trabajo a realizar o la lejania de la zona, puede ser mas o menos. Por favor, elija alguna de las siguientes respuestas para avanzar:\n\na. ✅ Me interesa, seguir el cierre del presupuesto con una persona\n\nb. ❌ No me interesa' + PRICE_CLOSING;
}

// Builds the "motivo de tu mensaje" menu shown to corporate clients once identified
function buildCorpIdentifiedMsg(companyName) {
  return 'Genial, gracias!! Te has identificado como *"' + companyName + '"*. Cual es el motivo de tu mensaje?\n\na. 📅 Necesito agendar una fecha para un trabajo\n\nb. 📋 Necesito agendar una fecha para realizar un relevamiento\n\nc. 👤 Necesito comunicarme con el tecnico para hablar sobre un proyecto\n\nd. 🛰️ Necesito informacion con respecto al servicio de *Monitoreo de estado*\n\ne. ↩️ Volver al menu anterior\n\nf. 👋 Finalizar conversacion';
}

// ============ API CALLS ============

async function getAvailability(eventType, startDateISO) {
  try {
    var body = { action: "getAvailability", eventType: eventType };
    if (startDateISO) body.startDate = startDateISO;
    var res = await fetch(CALENDAR_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (err) {
    console.error("Error getAvailability:", err.message);
    return { available: [], count: 0, error: err.message };
  }
}

async function createCalendarEvent(startISO, endISO, title, description) {
  try {
    var res = await fetch(CALENDAR_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "createEvent", startISO: startISO, endISO: endISO, title: title, description: description })
    });
    return await res.json();
  } catch (err) {
    console.error("Error createEvent:", err.message);
    return { success: false, error: err.message };
  }
}

async function sendBookingEmail(clientEmail, companyName, serviceType, bookedDates) {
  try {
    var res = await fetch(EMAIL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientEmail: clientEmail, companyName: companyName, serviceType: serviceType, bookedDates: bookedDates })
    });
    return await res.json();
  } catch (err) {
    console.error("Error sendBookingEmail:", err.message);
    return { success: false, error: err.message };
  }
}

async function logConversation(phone, userText, botResponse, state, clientName) {
  try {
    var resp = await fetch(LOG_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telefono: phone,
        mensaje_cliente: userText,
        respuesta_bot: botResponse || "",
        estado: state || "",
        cliente_identificado: clientName || ""
      })
    });
    var data = await resp.json();
    console.log("Conversation logged:", data.success);
  } catch (err) {
    console.error("Error logConversation:", err.message);
  }
}
async function lookupClient(phone) {
  try {
    var res = await fetch(LOOKUP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone })
    });
    return await res.json();
  } catch (err) {
    console.error("Error lookupClient:", err.message);
    return { found: false, error: err.message };
  }
}

// ============ BUILD AVAILABILITY MESSAGE ============

function buildAvailabilityMsg(slots, eventType) {
  var typeWord = eventType === "trabajo" ? "un trabajo" : "un relevamiento";
  var typeEmoji = eventType === "trabajo" ? "🔧" : "📋";
  
  if (!slots || slots.length === 0) {
    return 'No tengo fechas disponibles en este momento. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00* y te ayudaran a coordinar. 📞\n\na. ↩️ Volver al menu anterior\n\nb. 👋 Finalizar conversacion';
  }
  
  var letters = "abcdefghijklmnopqrstuvwxyz";
  var msg = 'Genial! Elegiste *agendar una fecha para ' + typeWord + '* ' + typeEmoji + '. Estas son las fechas disponibles:\n\n';
  
  for (var i = 0; i < slots.length && i < 8; i++) {
    var s = slots[i];
    var capLabel = s.weekday.charAt(0).toUpperCase() + s.weekday.slice(1);
    msg += letters[i] + '. 📅 ' + capLabel + ' ' + s.dayNum + '/' + s.monthName + '\n\n';
  }
  
  var nextIdx = slots.length < 8 ? slots.length : 8;
  msg += letters[nextIdx] + '. ➡️ Ver siguientes fechas\n\n';
  nextIdx++;
  msg += letters[nextIdx] + '. 📋 Necesito fecha para un sabado/domingo\n\n';
  nextIdx++;
  msg += letters[nextIdx] + '. ↩️ Volver al menu anterior\n\n';
  nextIdx++;
  msg += letters[nextIdx] + '. 👋 Finalizar conversacion\n\n';
  msg += '_Podes elegir uno o mas dias separados por coma. Ej: a,b,c_';
  
  return msg;
}

// ============ PARSE MULTI-DAY SELECTION ============

function parseSelection(text, maxSlots) {
  var letters = "abcdefghijklmnopqrstuvwxyz";
  var cleaned = text.toLowerCase().trim().replace(/\s/g, "");
  var parts = cleaned.split(",");
  var indices = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (p.length === 1) {
      var idx = letters.indexOf(p);
      if (idx >= 0 && idx < maxSlots && indices.indexOf(idx) === -1) {
        indices.push(idx);
      }
    }
  }
  return indices;
}

// ============ STATE DEFINITIONS ============

var STATES = {
  START: {
    msg: MAIN_MENU,
    next: { a: "PARTICULAR", b: "CORPORATIVO" }
  },

  PARTICULAR: {
    msg: PARTICULAR_MENU,
    next: { a: "EQUIPMENT", b: "SERVICE_TECH", c: "SPORT", d: "TALK_PERSON", e: "START", f: "END_FINALIZAR" }
  },

  CORPORATIVO: {
    msg: 'Perfecto, elegiste la opcion "b." *Cliente corporativo*. Ya es un cliente de *Systecam* o es la primera vez que se contacta?\n\na. ✅ Si, ya soy cliente\n\nb. 🆕 No, soy nuevo\n\nc. ↩️ Volver al menu principal\n\nd. 👋 Finalizar conversacion',
    next: { a: "CORP_EXISTING", b: "CORP_NEW", c: "START", d: "END_FINALIZAR" }
  },

  // NEW: Dynamic lookup state - calls lookupClient API with the phone number
  CORP_EXISTING: {
    isLookup: true
  },

  // NEW: Client found - ask for confirmation
  CORP_FOUND_CONFIRM: {
    msg: "DYNAMIC",
    next: { a: "CORP_IDENTIFIED", b: "CORP_EXISTING_FALLBACK", c: "START", d: "END_FINALIZAR" }
  },

  // NEW: Client not found or said "no, no lo soy" - fall back to manual identification
  CORP_EXISTING_FALLBACK: {
    msg: 'Entendido. Por favor identifiquese con el *nombre de la empresa* o su *CUIT*',
    freeText: true,
    next: "CORP_IDENTIFIED"
  },

  CORP_NEW: {
    msg: 'Entendido, elegiste la opcion "b." *No, soy nuevo*. Por favor me puede brindar el *nombre de la empresa* a la que representa para poder agendarlos?',
    freeText: true,
    next: "CORP_IDENTIFIED"
  },

  CORP_IDENTIFIED: {
    msg: "DYNAMIC",
    next: { a: "CORP_SCHEDULE_TRABAJO", b: "CORP_SCHEDULE_RELEVAMIENTO", c: "CORP_TECNICO", d: "CORP_MONITOREO", e: "CORPORATIVO", f: "END_FINALIZAR" }
  },

  CORP_SCHEDULE_TRABAJO: {
    isDynamic: true,
    eventType: "trabajo"
  },

  CORP_SCHEDULE_RELEVAMIENTO: {
    isDynamic: true,
    eventType: "relevamiento"
  },

  CORP_TECNICO: {
    msg: 'Bien, elegiste la opcion "c." *Comunicarme con el tecnico para hablar sobre un proyecto*. Perfecto!! Te dejo el contacto de nuestro tecnico *Gregorio Agustin* (1167684802). Igualmente le voy a dejar un recordatorio a las 18:00 para que se comunique con usted.\n\na. ↩️ Volver al menu anterior\n\nb. 👋 Finalizar conversacion',
    next: { a: "CORP_IDENTIFIED", b: "END_FINALIZAR" }
  },

  CORP_MONITOREO: {
    msg: 'Bien, elegiste la opcion "d." *Necesito informacion con respecto al servicio de monitoreo de estado*. Te cuento, nuestro servicio de *Monitoreo de Estado* supervisa las 24 horas que tus camaras, DVR/NVR y demas dispositivos funcionen correctamente. Si detectamos una falla (como perdida de video, error de disco o problemas de red), te avisamos de inmediato para que puedas solucionarla antes de que afecte la seguridad. Asi tenes la tranquilidad de que, cuando necesites una grabacion, tu sistema estara funcionando como corresponde. Te gustaria que te envie la propuesta completa?\n\na. 📄 Si, enviame la propuesta completa\n\nb. 👋 No, gracias\n\nc. ↩️ Volver al menu anterior',
    next: { a: "CORP_MONITOREO_PROPOSAL", b: "CORP_MONITOREO_NO_THANKS", c: "CORP_IDENTIFIED" }
  },

  CORP_MONITOREO_PROPOSAL: {
    msg: 'Genial! Te envio ahora mismo la *propuesta completa del servicio de Monitoreo de Estado* 📄. Cualquier consulta adicional, nuestro equipo esta disponible de *lunes a sabado de 09:00 a 13:00*. Te puedo ayudar con algo mas?\n\na. 🏠 Si, volver al menu principal\n\nb. 👋 No, gracias',
    sendPDF: true,
    pdfUrl: "https://media.base44.com/files/public/6a62196e2adcb0256123773e/da696fa76_Monitoreodeestado.pdf",
    pdfName: "Systecam-Monitoreo-de-Estado.pdf",
    pdfCaption: "Propuesta - Monitoreo de Estado SYSTECAM",
    next: { a: "START", b: "END_FINALIZAR" }
  },

  CORP_MONITOREO_NO_THANKS: {
    msg: NO_THANKS_CLOSE,
    next: {},
    isEnd: true
  },

  EQUIPMENT: {
    msg: EQUIPMENT_MENU,
    next: { a: "CAMERAS", b: "ALARMA", c: "PORTERO", d: "CONTROL", e: "MULTI", f: "PARTICULAR", g: "END_FINALIZAR" }
  },

  CAMERAS: {
    msg: CAMERAS_MENU,
    next: { a: "CAM1", b: "CAM2", c: "CAM3", d: "CAM4", e: "CAM5", f: "CAM6", g: "CAM7", h: "CAM8", i: "CAM_MORE", j: "EQUIPMENT", k: "END_FINALIZAR" }
  },

  CAM1: { msg: cameraPriceMsg("a", 1, "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS", d: "END_FINALIZAR" } },
  CAM2: { msg: cameraPriceMsg("b", 2, "230.296"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS", d: "END_FINALIZAR" } },
  CAM3: { msg: cameraPriceMsg("c", 3, "290.173"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS", d: "END_FINALIZAR" } },
  CAM4: { msg: cameraPriceMsg("d", 4, "359.814"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS", d: "END_FINALIZAR" } },
  CAM5: { msg: cameraPriceMsg("e", 5, "420.982"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS", d: "END_FINALIZAR" } },
  CAM6: { msg: cameraPriceMsg("f", 6, "479.919"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS", d: "END_FINALIZAR" } },
  CAM7: { msg: cameraPriceMsg("g", 7, "652.690"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS", d: "END_FINALIZAR" } },
  CAM8: { msg: cameraPriceMsg("h", 8, "822.389"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS", d: "END_FINALIZAR" } },
  
  CAM_MORE: {
    msg: 'Perfecto! Elegiste *Mas de 8 camaras* 📹. El valor estimativo puede ser de *$1.000.000 en adelante*. La cantidad de camaras exceden a nuestra lista, tu consulta sera derivada a nuestro tecnico para poder dar un mejor asesoramiento.\n\na. ✅ Me interesa, seguir el cierre del presupuesto con una persona\n\nb. ❌ No me interesa' + PRICE_CLOSING,
    next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS", d: "END_FINALIZAR" }
  },

  ALARMA: { msg: equipmentPriceMsg("b", "una central de alarma", "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT", d: "END_FINALIZAR" } },
  PORTERO: { msg: equipmentPriceMsg("c", "un portero visor", "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT", d: "END_FINALIZAR" } },
  CONTROL: { msg: equipmentPriceMsg("d", "un control de acceso", "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT", d: "END_FINALIZAR" } },
  
  MULTI: {
    msg: 'Genial, elegiste la opcion "e." *Presupuesto por mas de una opcion*. En ese caso voy a tener que derivar tu consulta a nuestro personal. Te comento los horarios de atencion: *lunes a sabado de 09:00 a 13:00*.\n\na. ✅ Me interesa, seguir el cierre del presupuesto con una persona\n\nb. ❌ No me interesa' + PRICE_CLOSING,
    next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT", d: "END_FINALIZAR" }
  },

  SERVICE_TECH: {
    msg: 'Bien, elegiste la opcion "b." *Servicio tecnico* 🔧. Te comento, nuestro servicio tecnico basico tiene un valor de *$169.400,00*. El mismo puede variar segun la complejidad del trabajo a realizar, puede ser mas o menos. Por favor, elija alguna de las siguientes respuestas para avanzar:\n\na. ✅ Me interesa, seguir el cierre del presupuesto con una persona\n\nb. ❌ No me interesa\n\nc. ↩️ Volver al menu anterior\n\nd. 👋 Finalizar conversacion',
    next: { a: "INTERESTED_TECH", b: "NOT_INTERESTED_TECH", c: "PARTICULAR", d: "END_FINALIZAR" }
  },

  SPORT: {
    msg: 'Bien, elegiste la opcion "c." *Systecam Sport* ⚽. Te cuento, con *Systecam Sport* tu club puede ofrecer a los jugadores la posibilidad de ver, descargar y compartir sus partidos desde una *app exclusiva*, brindando una experiencia unica. Nosotros instalamos todo el sistema, aportamos el equipamiento en comodato y nos ocupamos del soporte y mantenimiento. Es una excelente forma de *diferenciarte de la competencia*, fidelizar a tus clientes y sumar un nuevo valor a tus canchas. Te gustaria que te envie la propuesta completa?\n\na. 📄 Si, enviamela completa\n\nb. 👋 No, gracias\n\nc. ↩️ Volver al menu anterior\n\nd. 👋 Finalizar conversacion',
    next: { a: "SPORT_PROPOSAL", b: "SPORT_NO_THANKS", c: "PARTICULAR", d: "END_FINALIZAR" }
  },

  SPORT_PROPOSAL: {
    msg: 'Genial! Te envio ahora mismo la *propuesta completa de Systecam Sport* 📄. Cualquier consulta adicional, nuestro equipo esta disponible de *lunes a sabado de 09:00 a 13:00*. Te puedo ayudar con algo mas?\n\na. 🏠 Si, volver al menu principal\n\nb. 👋 No, gracias',
    sendPDF: true,
    pdfUrl: "https://base44.app/api/apps/6a62196e2adcb0256123773e/files/mp/public/6a62196e2adcb0256123773e/85232d902_61f6a1511_SystecamSport-Propuestacomercial.pdf",
    pdfName: "Systecam-Sport-Propuesta-Comercial.pdf",
    pdfCaption: "Propuesta Comercial - SYSTECAM Sport",
    next: { a: "START", b: "END_NO_THANKS" }
  },

  SPORT_NO_THANKS: {
    msg: NO_THANKS_CLOSE,
    next: {},
    isEnd: true
  },

  TALK_PERSON: {
    msg: 'Bien, elegiste la opcion "d." *Hablar con una persona* 👤. Para poder comunicarte con nuestro personal deberas esperar al horario de atencion, que es de *lunes a sabados de 09:00 a 13:00*. Ni bien lea su consulta le daran una respuesta. Te puedo ayudar con otra consulta?\n\na. 🏠 Si, volver al menu principal\n\nb. 👋 No, gracias',
    next: { a: "START", b: "END_NO_THANKS" }
  },

  INTERESTED: {
    msg: INTERESTED_MSG,
    next: { a: "CONFIRM_MAIN", b: "END_NO_THANKS" }
  },
  INTERESTED_TECH: {
    msg: 'Eligio la opcion "a" *Me interesa*, seguir el cierre del presupuesto con una persona. Para el seguimiento con nuestro personal deberas esperar al horario de atencion, que es de *lunes a viernes de 09:00 a 13:00*. Ni bien lea su solicitud le daran una respuesta. Te puedo ayudar con otra consulta?\n\na. 🏠 Si, volver al menu principal\n\nb. 👋 No, gracias',
    next: { a: "CONFIRM_MAIN", b: "END_NO_THANKS" }
  },
  NOT_INTERESTED: {
    msg: NOT_INTERESTED_CLOSE,
    next: {},
    isEnd: true
  },
  NOT_INTERESTED_TECH: {
    msg: NOT_INTERESTED_CLOSE,
    next: {},
    isEnd: true
  },

  CONFIRM_MAIN: {
    msg: 'Eligio la opcion "a" *Si, volver al menu principal* 🏠\n\n' + MAIN_MENU,
    next: { a: "PARTICULAR", b: "CORPORATIVO" }
  },

  END_NO_THANKS: {
    msg: NO_THANKS_CLOSE,
    next: {},
    isEnd: true
  },

  END_FINALIZAR: {
    msg: FINALIZAR_MSG,
    next: {},
    isEnd: true
  },

  CORP_WEEKEND: {
    msg: 'Entendido!! En ese caso dejo asentado tu solicitud y la confirmacion para esos dias te la dara nuestro personal que atiende de *09:00 a 13:00 de lunes a sabados* 📞. Te puedo ayudar con otra consulta?\n\na. ↩️ Volver al menu anterior\n\nb. 👋 Finalizar conversacion',
    next: { a: "CORP_IDENTIFIED", b: "END_FINALIZAR" }
  },

  CORP_BOOKED: {
    msg: "DYNAMIC",
    next: { a: "CONFIRM_MAIN", b: "END_FINALIZAR" }
  }
};

// ============ SEND WHATSAPP TEXT ============

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

async function processMessage(from, userText) {
  var text = userText.toLowerCase().trim();
  var stateObj = userStates.get(from) || { state: "START", data: {} };
  var currentState = stateObj.state;
  var data = stateObj.data || {};
  var state = STATES[currentState];

  // END state - only respond to greetings
  if (state && state.isEnd) {
    if (text.match(/^(hola|buenas|buen[ao]s|hi|hello|saludos|buenas tardes|buenas noches|buenos dias|buen dia|hola cesy)/)) {
      userStates.set(from, { state: "START", data: {} });
      return { msg: STATES.START.msg };
    }
    return { msg: 'Gracias por tu mensaje! Si necesitas ayuda, escribi *"hola Cesy"* para comenzar de nuevo. 😊' };
  }

  // Greeting at START
  if (currentState === "START" && text.match(/^(hola|buenas|buen[ao]s|hi|hello|saludos|buenas tardes|buenas noches|buenos dias|buen dia|hola cesy)/)) {
    userStates.set(from, { state: "START", data: {} });
    return { msg: STATES.START.msg };
  }

  if (!state) {
    userStates.set(from, { state: "START", data: {} });
    return { msg: STATES.START.msg };
  }

  // FREE TEXT states (company name capture)
  if (state.freeText) {
    var companyName = userText.trim();
    if (companyName.length < 2) {
      return { msg: "Por favor, escriba el nombre de la empresa o CUIT para continuar. 😊" };
    }
    data.companyName = companyName;
    var nextStateName = state.next;
    userStates.set(from, { state: nextStateName, data: data });
    return { msg: buildCorpIdentifiedMsg(companyName) };
  }

  // LOOKUP state - calls lookupClient API with the phone number
  if (state.isLookup) {
    var lookupResult = await lookupClient(from);
    if (lookupResult.found) {
      // Client found - store data and go to confirmation
      data.companyName = lookupResult.short_name;
      data.legalName = lookupResult.legal_name;
      data.contact = lookupResult.contact;
      data.clientEmail = lookupResult.email;
      userStates.set(from, { state: "CORP_FOUND_CONFIRM", data: data });
      var confirmMsg = 'Entendido, elegiste la opcion "a." *Si, ya soy cliente*. Te identificamos como *' + lookupResult.contact + '* de la empresa *' + lookupResult.legal_name + '*. Estos datos son correctos?\n\na. ✅ Si, soy yo\n\nb. ❌ No, no lo soy\n\nc. ↩️ Volver al menu principal\n\nd. 👋 Finalizar conversacion';
      return { msg: confirmMsg };
    } else {
      // Client not found - fall back to manual identification
      userStates.set(from, { state: "CORP_EXISTING_FALLBACK", data: data });
      return { msg: 'Entendido, elegiste la opcion "a." *Si, ya soy cliente*. No encontramos tu numero en nuestra base de datos. Por favor identifiquese con el *nombre de la empresa* o su *CUIT*' };
    }
  }

  // DYNAMIC states (availability - needs API call)
  if (state.isDynamic) {
    var eventType = state.eventType;
    
    if (data.slots && data.slots.length > 0) {
      var letters = "abcdefghijklmnopqrstuvwxyz";
      var numSlots = data.slots.length;
      var baseIdx = numSlots < 8 ? numSlots : 8;
      var verSiguientesLetter = letters[baseIdx];
      var weekendLetter = letters[baseIdx + 1];
      var volverLetter = letters[baseIdx + 2];
      var finalizarLetter = letters[baseIdx + 3];
      
      if (text === verSiguientesLetter) {
        var lastSlot = data.slots[data.slots.length - 1];
        var newStartDate = new Date(lastSlot.startISO);
        newStartDate.setDate(newStartDate.getDate() + 1);
        
        var moreSlots = await getAvailability(eventType, newStartDate.toISOString().split("T")[0]);
        if (moreSlots.available && moreSlots.available.length > 0) {
          data.slots = moreSlots.available;
          userStates.set(from, { state: currentState, data: data });
          return { msg: buildAvailabilityMsg(data.slots, eventType) };
        } else {
          return { msg: "No hay mas fechas disponibles en las proximas dos semanas. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00*. 📞\n\na. ↩️ Volver al menu anterior\n\nb. 👋 Finalizar conversacion" };
        }
      }
      
      if (text === weekendLetter) {
        userStates.set(from, { state: "CORP_WEEKEND", data: { companyName: data.companyName } });
        return { msg: STATES.CORP_WEEKEND.msg };
      }
      
      if (text === volverLetter) {
        userStates.set(from, { state: "CORP_IDENTIFIED", data: { companyName: data.companyName } });
        return { msg: buildCorpIdentifiedMsg(data.companyName) };
      }
      
      if (text === finalizarLetter) {
        userStates.set(from, { state: "END_FINALIZAR", data: {} });
        return { msg: FINALIZAR_MSG };
      }
      
      var selectedIndices = parseSelection(text, numSlots);
      
      if (selectedIndices.length > 0) {
        var typeWord = eventType === "trabajo" ? "Trabajo" : "Relevamiento";
        var title = typeWord + " - " + (data.companyName || "Cliente corporativo");
        var desc = typeWord + " solicitado por " + (data.companyName || "cliente corporativo") + " desde WhatsApp. Telefono: " + from;
        
        var bookedDates = [];
        var errors = [];
        
        for (var d = 0; d < selectedIndices.length; d++) {
          var slot = data.slots[selectedIndices[d]];
          var result = await createCalendarEvent(slot.startISO, slot.endISO, title, desc);
          if (result.success) {
            bookedDates.push(result.confirmationDate);
          } else {
            errors.push(slot.label);
          }
        }
        
        if (bookedDates.length > 0) {
          userStates.set(from, { state: "CORP_BOOKED", data: {} });
          // Send confirmation email
          var typeWord2 = eventType === "trabajo" ? "Trabajo" : "Relevamiento";
          var emailDates = bookedDates.join(", ");
          var emailTo = data.clientEmail || "agustin.d.gregorio@gmail.com";
          try {
            await sendBookingEmail(emailTo, data.companyName || "Cliente corporativo", typeWord2, emailDates);
          } catch (e) { console.error("Email send failed:", e.message); }
          var dayWord = bookedDates.length === 1 ? "el" : "los";
          var dateList = bookedDates.join(", ");
          var extraInfo = bookedDates.length === 1 ? "" : " (" + bookedDates.length + " dias)";
          var bookedMsg = 'Listo!! Quedo agendado para ' + dayWord + ' *' + dateList + '*' + extraInfo + '. Te enviamos la invitacion al calendario y un email de confirmacion. Si necesitas modificar algo, nuestro personal lo atendera de *lunes a sabado de 09:00 a 13:00*. 📅\n\nTe puedo ayudar con otra consulta?\n\na. 🏠 Volver al menu principal\n\nb. 👋 Finalizar conversacion';
          return { msg: bookedMsg };
        } else {
          return { msg: "Hubo un problema al agendar. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00*. 📞\n\na. ↩️ Volver al menu anterior\n\nb. 👋 Finalizar conversacion" };
        }
      }
      
      return { msg: "Por favor, elegi una opcion valida. Podes elegir uno o mas dias separados por coma. 😊\n\n" + buildAvailabilityMsg(data.slots, eventType) };
    }
    
    var availResult = await getAvailability(eventType, new Date().toISOString().split("T")[0]);
    data.slots = availResult.available || [];
    data.eventType = eventType;
    userStates.set(from, { state: currentState, data: data });
    
    if (data.slots.length === 0) {
      return { msg: "No tengo fechas disponibles en este momento. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00* y te ayudaran a coordinar. 📞\n\na. ↩️ Volver al menu anterior\n\nb. 👋 Finalizar conversacion" };
    }
    
    return { msg: buildAvailabilityMsg(data.slots, eventType) };
  }

  // Normal option handling (A-Z)
  var option = text.match(/^([a-z])/);
  if (option) {
    var letter = option[1];
    var nextState = state.next[letter];
    if (nextState) {
      userStates.set(from, { state: nextState, data: data });

      if (nextState === "CORP_IDENTIFIED") {
        return { msg: buildCorpIdentifiedMsg(data.companyName) };
      }

      if (nextState === "CORP_EXISTING") {
        var lookupResult2 = await lookupClient(from);
        if (lookupResult2.found) {
          data.companyName = lookupResult2.short_name;
          data.legalName = lookupResult2.legal_name;
          data.contact = lookupResult2.contact;
          data.clientEmail = lookupResult2.email;
          userStates.set(from, { state: "CORP_FOUND_CONFIRM", data: data });
          var confirmMsg2 = 'Entendido, elegiste la opcion "a." *Si, ya soy cliente*. Te identificamos como *' + lookupResult2.contact + '* de la empresa *' + lookupResult2.legal_name + '*. Estos datos son correctos?\n\na. ✅ Si, soy yo\n\nb. ❌ No, no lo soy\n\nc. ↩️ Volver al menu principal\n\nd. 👋 Finalizar conversacion';
          return { msg: confirmMsg2 };
        } else {
          userStates.set(from, { state: "CORP_EXISTING_FALLBACK", data: data });
          return { msg: 'Entendido, elegiste la opcion "a." *Si, ya soy cliente*. No encontramos tu numero en nuestra base de datos. Por favor identifiquese con el *nombre de la empresa* o su *CUIT*' };
        }
      }
      var next = STATES[nextState];
      if (next) {
        var resultObj = { msg: next.msg, sendPDF: next.sendPDF || false, pdfUrl: next.pdfUrl, pdfName: next.pdfName, pdfCaption: next.pdfCaption };
        
        if (next.isDynamic) {
          var eventType2 = next.eventType;
          var availResult2 = await getAvailability(eventType2, new Date().toISOString().split("T")[0]);
          data.slots = availResult2.available || [];
          data.eventType = eventType2;
          userStates.set(from, { state: nextState, data: data });
          
          if (data.slots.length === 0) {
            return { msg: "No tengo fechas disponibles en este momento. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00* y te ayudaran a coordinar. 📞\n\na. ↩️ Volver al menu anterior\n\nb. 👋 Finalizar conversacion" };
          }
          
          return { msg: buildAvailabilityMsg(data.slots, eventType2) };
        }
        
        return resultObj;
      }
    }
  }

  var hintMsg = "Por favor, elegi una opcion valida (a, b, c, etc.) 😊\n\n" + state.msg;
  return { msg: hintMsg };
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
    var result = await processMessage(from, userText);
    if (result && result.msg) {
      await sendWhatsApp(from, result.msg);
    }
    if (result && result.sendPDF) {
      await sendWhatsAppDocument(from, result.pdfUrl, result.pdfName, result.pdfCaption);
    }
    // Log the conversation for Karen notifications
    var currentState = userStates.get(from);
    var stateName = currentState ? currentState.state : '';
    var clientName = currentState && currentState.data ? (currentState.data.companyName || currentState.data.contact || '') : '';
    await logConversation(from, userText, result.msg || '', stateName, clientName);
    console.log("Respuesta enviada a " + from);
  } catch (err) {
    console.error("Error: " + err.message);
  }
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log("Systecam webhook corriendo en puerto " + PORT);
});
