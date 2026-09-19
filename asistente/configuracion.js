/* ============================================================
   configuracion.js  ·  EL ÚNICO INTERRUPTOR

   Aquí se decide con quién habla el asistente. No hay que tocar
   nada más en ninguna otra carpeta.

   ┌──────────────────────────────────────────────────────────┐
   │  EL INTERRUPTOR ESTÁ EN LA LÍNEA QUE DICE  cerebro:      │
   │                                                          │
   │    cerebro: "worker"    → el servidor de verdad de       │
   │                           IMMO IA. Contesta de verdad.   │
   │                           CADA RESPUESTA CUESTA DINERO.  │
   │                           ES LO QUE ESTÁ PUESTO AHORA.   │
   │                                                          │
   │    cerebro: "simulada"  → el modo de prueba. No sale de  │
   │                           esta página, no gasta nada y   │
   │                           no usa ninguna IA de verdad.   │
   │                           Sirve para probar la pantalla, │
   │                           el micrófono y la voz.         │
   │                                                          │
   │  Para cambiar: borra una palabra y escribe la otra.      │
   │  Nada más. El modo de prueba sigue aquí, entero, solo    │
   │  está apagado.                                           │
   └──────────────────────────────────────────────────────────┘

   X3 · 18/09/2026 · SE ENTRA Y HABLA ELLA
   Ya no hay botón de micrófono ni botón de enviar. Por eso aquí
   había dos saludos casi iguales (uno al abrir la página y otro al
   abrir el micrófono) que sonaban seguidos y decían lo mismo dos
   veces. Ahora hay UNO SOLO: "avisoDeIA". Se dice en voz alta la
   primera vez que abre el oído, y queda escrito en la pantalla.
   ============================================================ */

export const CONFIGURACION = Object.freeze({

  /* ►►► EL INTERRUPTOR ◄◄◄   "worker" = servidor de verdad · "simulada" = prueba que no gasta */
  cerebro: "worker",

  /* La dirección del servidor de IMMO IA. Solo se toca si el servidor cambia de sitio. */
  urlCerebro: "https://immoia.ley1998ortizz.workers.dev",

  /* La llave con la que el servidor nos reconoce. Es la misma que ya usa la web. */
  codigo: "leire2026",

  /* EL ÚNICO AVISO DE QUE ES UNA IA. Está escrito aquí, no lo genera
     nadie: no cuesta dinero y siempre suena igual. Se dice una vez,
     al abrir el oído, y se queda escrito en la conversación. */
  avisoDeIA: "Hola. Soy el asistente de IMMO IA y soy una inteligencia artificial, no una persona. " +
             "Cuéntame qué necesitas de tu vivienda.",

  /* Si en la misma visita se vuelve a abrir el oído, no se repite el
     aviso entero: solo esto. */
  avisoDeIAcorto: "Te escucho.",

  /* Con voz al empezar. Se puede silenciar desde la propia página. */
  conVoz: true

});
