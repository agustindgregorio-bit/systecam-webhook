const express = require("express");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "systecam_cesy_2026";
const META_TOKEN = process.env.META_WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = "1267250503134581";

// ============ CALENDAR API ============
var CALENDAR_API = "https://cesy.base44.app/api/apps/6a62196e2adcb0256123773e/functions/calendarManager";

// ============ STATE MACHINE ============
// userStates: phone -> { state: "STATE_NAME", data: {} }
var userStates = new Map();

// ============ MENU TEXTS ============

var MAIN_MENU = "Hola! Como estas? Soy *Cesy*, la asistente virtual de *Systecam*. Selecciona que tipo de cliente sos:\n\na. 🏠 Cliente particular\n\nb. 🏢 Cliente corporativo";

var PARTICULAR_MENU = 'Perfecto, elegiste la opcion "a." *Cliente particular*. Cual es el motivo de tu mensaje?\n\na. 🛡️ Necesito presupuesto para instalar y configurar un equipo de seguridad\n\nb. 🔧 Necesito presupuesto por un servicio tecnico\n\nc. ⚽ Necesito informacion con respecto a *Systecam Sport*\n\nd. 👤 Necesito hablar con una persona';

var EQUIPMENT_MENU = 'Bien, elegiste la opcion "a." *Presupuesto para equipo de seguridad*. Que equipo necesitas instalar?\n\na. 📷 Camaras de seguridad\n\nb. 🔔 Central de alarma\n\nc. 🚪 Portero visor\n\nd. 🔑 Control de acceso\n\ne. 📋 Presupuesto por mas de una de las opciones\n\nf. ↩️ Volver al menu anterior';

var CAMERAS_MENU = 'Genial! Elegiste *Camaras de seguridad* 📷. Cuantas camaras necesita instalar?\n\na. 📹 1 camara\n\nb. 📹 2 camaras\n\nc. 📹 3 camaras\n\nd. 📹 4 camaras\n\ne. 📹 5 camaras\n\nf. 📹 6 camaras\n\ng. 📹 7 camaras\n\nh. 📹 8 camaras\n\ni. 📹 Mas de 8 camaras\n\nj. ↩️ Volver al menu anterior';

var PRICE_CLOSING = "\n\na. ✅ Me interesa, seguir el cierre del presupuesto con una persona\n\nb. ❌ No me interesa\n\nc. ↩️ Volver al menu anterior";

var INTERESTED_MSG = 'Eligio la opcion "a" *Me interesa*, seguir el cierre del presupuesto con una persona. Para el seguimiento con nuestro personal deberas esperar al horario de atencion, que es de *lunes a viernes de 09:00 a 13:00*. Ni bien lea su solicitud le daran una respuesta. Te puedo ayudar con otra consulta?\n\na. 🏠 Si, volver al menu principal\n\nb. 👋 No, gracias';

var NOT_INTERESTED_CLOSE = 'Entendido!! Cualquier cosa te podes volver a comunicar conmigo con un *"hola Cesy"* o con nuestro personal que estan de *lunes a sabado de 09:00 a 13:00*. Doy por finalizada la conversacion, que termine bien su dia! 👋';

var NO_THANKS_CLOSE = 'Entendido!! Cualquier cosa te podes volver a comunicar conmigo con un *"hola Cesy"* o con nuestro personal que estan de *lunes a sabado de 09:00 a 13:00*. Doy por finalizada la conversacion, que termine bien su dia! 👋';

// ============ HELPER FUNCTIONS ============

function cameraPriceMsg(optionLetter, count, price) {
  var word = count === 1 ? "camara" : "camaras";
  return 'Perfecto! Elegiste *' + count + ' ' + word + '* 📹. Te comento, el valor aproximado por la instalacion de ' + count + ' ' + word + ' de seguridad esta *$' + price + ',00* final IVA incluido. El mismo puede variar segun la complejidad del trabajo a realizar o la lejania de la zona, puede ser mas o menos. Por favor, elija alguna de las siguientes respuestas para avanzar:' + PRICE_CLOSING;
}

function equipmentPriceMsg(optionLetter, name, price) {
  return 'Genial! Elegiste *' + name + '*. Te comento, el valor aproximado por la instalacion y configuracion de ' + name + ' basica esta *$' + price + ',00* final IVA incluido. El mismo puede variar segun la complejidad del trabajo a realizar o la lejania de la zona, puede ser mas o menos. Por favor, elija alguna de las siguientes respuestas para avanzar:' + PRICE_CLOSING;
}

// ============ CALENDAR API CALLS ============

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

// ============ BUILD AVAILABILITY MESSAGE ============

function buildAvailabilityMsg(slots, eventType) {
  var typeWord = eventType === "trabajo" ? "un trabajo" : "un relevamiento";
  var typeEmoji = eventType === "trabajo" ? "🔧" : "📋";
  
  if (!slots || slots.length === 0) {
    return 'No tengo fechas disponibles en este momento. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00* y te ayudaran a coordinar. 📞\n\na. 🏠 Volver al menu principal';
  }
  
  var letters = "abcdefgh";
  var msg = 'Genial! Elegiste *agendar una fecha para ' + typeWord + '* ' + typeEmoji + '. Estas son las fechas disponibles:\n\n';
  
  for (var i = 0; i < slots.length && i < 8; i++) {
    var s = slots[i];
    var capLabel = s.weekday.charAt(0).toUpperCase() + s.weekday.slice(1);
    msg += letters[i] + '. 📅 ' + capLabel + ' ' + s.dayNum + '/' + s.monthName + ' a las ' + s.hour + '\n\n';
  }
  
  // Add "ver siguientes" and "sabado/domingo" options
  var nextLetter = slots.length < 8 ? letters[slots.length] : 'i';
  msg += nextLetter + '. ➡️ Ver siguientes fechas\n\n';
  var lastLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
  msg += lastLetter + '. 📋 Necesito fecha para un sabado/domingo';
  
  return msg;
}

// ============ STATE DEFINITIONS ============

var STATES = {
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

  // CORPORATIVO - First step: existing or new?
  CORPORATIVO: {
    msg: 'Perfecto, elegiste la opcion "b." *Cliente corporativo*. Ya es un cliente de *Systecam* o es la primera vez que se contacta?\n\na. ✅ Si, ya soy cliente\n\nb. 🆕 No, soy nuevo',
    next: { a: "CORP_EXISTING", b: "CORP_NEW" }
  },

  // CORP_EXISTING - Ask for company name or CUIT (FREE TEXT)
  CORP_EXISTING: {
    msg: 'Entendido, elegiste la opcion "a." *Si, ya soy cliente*. Por favor identifiquese con el *nombre de la empresa* o su *CUIT*',
    freeText: true,
    next: "CORP_IDENTIFIED"
  },

  // CORP_NEW - Ask for company name (FREE TEXT)
  CORP_NEW: {
    msg: 'Entendido, elegiste la opcion "b." *No, soy nuevo*. Por favor me puede brindar el *nombre de la empresa* a la que representa para poder agendarlos?',
    freeText: true,
    next: "CORP_IDENTIFIED"
  },

  // CORP_IDENTIFIED - Show 3 options (company name inserted dynamically)
  CORP_IDENTIFIED: {
    msg: "DYNAMIC", // will be built dynamically with company name
    next: { a: "CORP_SCHEDULE_TRABAJO", b: "CORP_SCHEDULE_RELEVAMIENTO", c: "CORP_TECNICO" }
  },

  // CORP_SCHEDULE_TRABAJO - Get availability for trabajo
  CORP_SCHEDULE_TRABAJO: {
    isDynamic: true,
    eventType: "trabajo"
  },

  // CORP_SCHEDULE_RELEVAMIENTO - Get availability for relevamiento
  CORP_SCHEDULE_RELEVAMIENTO: {
    isDynamic: true,
    eventType: "relevamiento"
  },

  // CORP_TECNICO - Talk to technician
  CORP_TECNICO: {
    msg: 'Bien, elegiste la opcion "c." *Comunicarme con el tecnico para hablar sobre un proyecto*. Perfecto!! Te dejo el contacto de nuestro tecnico *Gregorio Agustin* (1167684802). Igualmente le voy a dejar un recordatorio a las 18:00 para que se comunique con usted.\n\na. 🏠 Volver al menu principal\n\nb. 👋 No, gracias',
    next: { a: "CONFIRM_MAIN", b: "END_NO_THANKS" }
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
  
  CAM_MORE: {
    msg: 'Perfecto! Elegiste *Mas de 8 camaras* 📹. El valor estimativo puede ser de *$1.000.000 en adelante*. La cantidad de camaras exceden a nuestra lista, tu consulta sera derivada a nuestro tecnico para poder dar un mejor asesoramiento.' + PRICE_CLOSING,
    next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "CAMERAS" }
  },

  // AMARILLO - Equipment prices
  ALARMA: { msg: equipmentPriceMsg("b", "una central de alarma", "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT" } },
  PORTERO: { msg: equipmentPriceMsg("c", "un portero visor", "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT" } },
  CONTROL: { msg: equipmentPriceMsg("d", "un control de acceso", "169.400"), next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT" } },
  
  MULTI: {
    msg: 'Genial, elegiste la opcion "e." *Presupuesto por mas de una opcion*. En ese caso voy a tener que derivar tu consulta a nuestro personal. Te comento los horarios de atencion: *lunes a sabado de 09:00 a 13:00*.' + PRICE_CLOSING,
    next: { a: "INTERESTED", b: "NOT_INTERESTED", c: "EQUIPMENT" }
  },

  // VERDE CLARO - Service tech
  SERVICE_TECH: {
    msg: 'Bien, elegiste la opcion "b." *Servicio tecnico* 🔧. Te comento, nuestro servicio tecnico basico tiene un valor de *$169.400,00*. El mismo puede variar segun la complejidad del trabajo a realizar, puede ser mas o menos. Por favor, elija alguna de las siguientes respuestas para avanzar:\n\na. ✅ Me interesa, seguir el cierre del presupuesto con una persona\n\nb. ❌ No me interesa\n\nc. ↩️ Volver al menu anterior',
    next: { a: "INTERESTED_TECH", b: "NOT_INTERESTED_TECH", c: "PARTICULAR" }
  },

  // VERDE CLARO - Systecam Sport
  SPORT: {
    msg: 'Bien, elegiste la opcion "c." *Systecam Sport* ⚽. Te cuento, con *Systecam Sport* tu club puede ofrecer a los jugadores la posibilidad de ver, descargar y compartir sus partidos desde una *app exclusiva*, brindando una experiencia unica. Nosotros instalamos todo el sistema, aportamos el equipamiento en comodato y nos ocupamos del soporte y mantenimiento. Es una excelente forma de *diferenciarte de la competencia*, fidelizar a tus clientes y sumar un nuevo valor a tus canchas. Te gustaria que te envie la propuesta completa?\n\na. 📄 Si, enviamela completa\n\nb. 👋 No, gracias\n\nc. ↩️ Volver al menu anterior',
    next: { a: "SPORT_PROPOSAL", b: "SPORT_NO_THANKS", c: "PARTICULAR" }
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

  // BORDO - Interested
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

  // CORP_WEEKEND - No weekend booking
  CORP_WEEKEND: {
    msg: 'Entendido!! En ese caso dejo asentado tu solicitud y la confirmacion para esos dias te la dara nuestro personal que atiende de *09:00 a 13:00 de lunes a sabados* 📞. Te puedo ayudar con otra consulta?\n\na. 🏠 Volver al menu principal\n\nb. 👋 No, gracias',
    next: { a: "CONFIRM_MAIN", b: "END_NO_THANKS" }
  },

  // CORP_BOOKED - Confirmation after booking
  CORP_BOOKED: {
    msg: "DYNAMIC", // built dynamically after createEvent
    next: { a: "CONFIRM_MAIN", b: "END_NO_THANKS" }
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

  // If in an END state, only respond to greetings
  if (state && state.isEnd) {
    if (text.match(/^(hola|buenas|buen[ao]s|hi|hello|saludos|buenas tardes|buenas noches|buenos dias|buen dia|hola cesy)/)) {
      userStates.set(from, { state: "START", data: {} });
      return { msg: STATES.START.msg };
    }
    return { msg: 'Gracias por tu mensaje! Si necesitas ayuda, escribi *"hola Cesy"* para comenzar de nuevo. 😊' };
  }

  // If no state (first message) or user sends a greeting
  if (currentState === "START" && text.match(/^(hola|buenas|buen[ao]s|hi|hello|saludos|buenas tardes|buenas noches|buenos dias|buen dia|hola cesy)/)) {
    userStates.set(from, { state: "START", data: {} });
    return { msg: STATES.START.msg };
  }

  if (!state) {
    userStates.set(from, { state: "START", data: {} });
    return { msg: STATES.START.msg };
  }

  // Handle FREE TEXT states (company name capture)
  if (state.freeText) {
    var companyName = userText.trim();
    if (companyName.length < 2) {
      return { msg: "Por favor, escriba el nombre de la empresa o CUIT para continuar. 😊" };
    }
    data.companyName = companyName;
    var nextStateName = state.next;
    userStates.set(from, { state: nextStateName, data: data });
    var nextDef = STATES[nextStateName];
    // Build identified message with company name
    var idMsg = 'Genial, gracias!! Te has identificado como *"' + companyName + '"*. Cual es el motivo de tu mensaje?\n\na. 📅 Necesito agendar una fecha para un trabajo\n\nb. 📋 Necesito agendar una fecha para realizar un relevamiento\n\nc. 👤 Necesito comunicarme con el tecnico para hablar sobre un proyecto';
    return { msg: idMsg };
  }

  // Handle DYNAMIC states (availability - needs API call)
  if (state.isDynamic) {
    var eventType = state.eventType;
    
    // Check if user is selecting from already-shown slots
    if (data.slots && data.slots.length > 0) {
      var letters = "abcdefghijklmnopqrstuvwxyz";
      var option = text.match(/^([a-z])/);
      if (option) {
        var letter = option[1];
        var idx = letters.indexOf(letter);
        
        // Check if it's a slot selection
        if (idx >= 0 && idx < data.slots.length) {
          var slot = data.slots[idx];
          var typeWord = eventType === "trabajo" ? "Trabajo" : "Relevamiento";
          var title = typeWord + " - " + (data.companyName || "Cliente corporativo");
          var desc = typeWord + " solicitado por " + (data.companyName || "cliente corporativo") + " desde WhatsApp. Telefono: " + from;
          
          var result = await createCalendarEvent(slot.startISO, slot.endISO, title, desc);
          
          if (result.success) {
            userStates.set(from, { state: "CORP_BOOKED", data: {} });
            var bookedMsg = 'Listo!! Quedo agendado para el *' + result.confirmationDate + '* a las *' + result.confirmationTime + ' hs*. Le enviamos la invitacion al calendario. Si necesita modificar algo, nuestro personal lo atendera de *lunes a sabado de 09:00 a 13:00*. 📅\n\nTe puedo ayudar con otra consulta?\n\na. 🏠 Volver al menu principal\n\nb. 👋 No, gracias';
            return { msg: bookedMsg };
          } else {
            return { msg: "Hubo un problema al agendar. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00*. 📞\n\na. 🏠 Volver al menu principal" };
          }
        }
        
        // Check for "ver siguientes fechas" option
        var nextLetterIdx = data.slots.length < 8 ? data.slots.length : 8;
        var verSiguientesLetter = letters[nextLetterIdx];
        var weekendLetter = letters[nextLetterIdx + 1];
        
        if (letter === verSiguientesLetter) {
          // Fetch more slots starting from after the last shown slot
          var lastSlot = data.slots[data.slots.length - 1];
          var newStartDate = new Date(lastSlot.startISO);
          newStartDate.setDate(newStartDate.getDate() + 1);
          
          var moreSlots = await getAvailability(eventType, newStartDate.toISOString());
          if (moreSlots.available && moreSlots.available.length > 0) {
            data.slots = moreSlots.available;
            userStates.set(from, { state: currentState, data: data });
            var moreMsg = buildAvailabilityMsg(data.slots, eventType);
            return { msg: moreMsg };
          } else {
            return { msg: "No hay mas fechas disponibles en las proximas dos semanas. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00*. 📞\n\na. 🏠 Volver al menu principal" };
          }
        }
        
        // Check for weekend option
        if (letter === weekendLetter) {
          userStates.set(from, { state: "CORP_WEEKEND", data: {} });
          return { msg: STATES.CORP_WEEKEND.msg };
        }
      }
      
      // Invalid option - show slots again
      var retryMsg = "Por favor, elegi una opcion valida. 😊\n\n" + buildAvailabilityMsg(data.slots, eventType);
      return { msg: retryMsg };
    }
    
    // No slots loaded yet - fetch from API
    var availResult = await getAvailability(eventType, null);
    data.slots = availResult.available || [];
    data.eventType = eventType;
    userStates.set(from, { state: currentState, data: data });
    
    if (data.slots.length === 0) {
      return { msg: "No tengo fechas disponibles en este momento. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00* y te ayudaran a coordinar. 📞\n\na. 🏠 Volver al menu principal" };
    }
    
    var availMsg = buildAvailabilityMsg(data.slots, eventType);
    return { msg: availMsg };
  }

  // Normal option handling (A/B/C/D etc.)
  var option = text.match(/^([a-j])/);
  if (option) {
    var letter = option[1];
    var nextState = state.next[letter];
    if (nextState) {
      userStates.set(from, { state: nextState, data: data });
      var next = STATES[nextState];
      if (next) {
        var resultObj = { msg: next.msg, sendPDF: next.sendPDF || false, pdfUrl: next.pdfUrl, pdfName: next.pdfName, pdfCaption: next.pdfCaption };
        
        // If entering a dynamic state, we need to fetch availability
        if (next.isDynamic) {
          var eventType2 = next.eventType;
          var availResult2 = await getAvailability(eventType2, null);
          data.slots = availResult2.available || [];
          data.eventType = eventType2;
          userStates.set(from, { state: nextState, data: data });
          
          if (data.slots.length === 0) {
            return { msg: "No tengo fechas disponibles en este momento. Por favor comunicate con nuestro personal de *lunes a sabado de 09:00 a 13:00* y te ayudaran a coordinar. 📞\n\na. 🏠 Volver al menu principal" };
          }
          
          var availMsg2 = buildAvailabilityMsg(data.slots, eventType2);
          return { msg: availMsg2 };
        }
        
        return resultObj;
      }
    }
  }

  // If input not recognized, show current state message again with a hint
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
    console.log("Respuesta enviada a " + from);
  } catch (err) {
    console.error("Error: " + err.message);
  }
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log("Systecam webhook corriendo en puerto " + PORT);
});
