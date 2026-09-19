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

   ────────────────────────────────────────────────────────────
   LA CUENTA DE ELLA · 19/09/2026 · EL SALUDO ES PARA UNA OFICINA
   ────────────────────────────────────────────────────────────
   Aquí decía «Cuéntame qué necesitas de tu vivienda». Eso es para un
   particular que entra a mirar ayudas, no para la directora de una
   inmobiliaria: en su oficina no hay «tu vivienda», hay expedientes.
   Lo que la dirección dejó decidido, y es lo que hay abajo:

     1. LA PRIMERA FRASE DICE QUE ES UNA IA. Va delante de todo y no
        se toca: es obligación legal y además es lo primero que ella
        tiene que poder repetirle a un cliente. Se deja terminada con
        «no una persona.» porque mesa.js corta ahí para la versión
        corta del saludo.
     2. LA LLAMA POR SU NOMBRE si en este navegador hay un nombre
        escrito. No se inventa ninguno: sale de lo que ya está
        guardado en este mismo navegador, y si no hay nada, no se
        dice ningún nombre. De dónde sale, en ese orden:
          · "immoia.oficina.cuenta.v1" → el nombre de la oficina, que
            escribe oficina.js cuando entra con su cuenta;
          · "immoia.cuenta.v1"         → el nombre de pila que se
            escribe en la puerta de la web (index.html).
     3. EMPIEZA DÁNDOLE ALGO, NO PIDIÉNDOSELO. La segunda frase dice
        lo que ya lleva encima antes de que ella pregunte nada.
     4. DOS FRASES Y A PREGUNTAR. Con voz, un saludo largo hace
        colgar: se dice el aviso, se dice lo que lleva, y se pregunta.

   LO QUE EL SALUDO NO DICE, PORQUE HOY NO ES VERDAD:
     · No dice que tenga delante SUS expedientes. Esta página no los
       carga: los lleva la página de la inmobiliaria. Lo que esta
       página sabe buscar son los papeles de asistente/datos/.
     · No dice que se acuerde de lo de ayer. La memoria de un día
       para otro no existe todavía; lo dice la propia pantalla en su
       línea, y aquí no se promete.
   ============================================================ */

/* ---------- el nombre, si este navegador tiene uno escrito ----------
   Se lee UNA vez, al cargar la página, porque el saludo es un texto
   fijo (así no cuesta dinero y suena siempre igual). Todo envuelto: en
   navegación privada leer el almacén puede dar error, y entonces
   simplemente no hay nombre. */
function nombreDeQuienEntra() {
  let almacen = null;
  try { almacen = window.localStorage; almacen.getItem("x"); } catch (e) { return ""; }
  const sacar = (llave, campo) => {
    try {
      const d = JSON.parse(almacen.getItem(llave) || "null");
      const v = d && d[campo];
      return typeof v === "string" ? v.trim() : "";
    } catch (e) { return ""; }
  };
  /* primero la cuenta de la oficina: es la que dice de quién es este ordenador */
  const oficina = sacar("immoia.oficina.cuenta.v1", "usuario");
  if (oficina) return oficina.slice(0, 40);
  const persona = sacar("immoia.cuenta.v1", "nombre");
  if (persona) return persona.slice(0, 40);
  return "";
}

const SOY_UNA_IA = "Soy el asistente de IMMO IA y soy una inteligencia artificial, no una persona.";

function saludoDeOficina(nombre) {
  const loQueLlevo = "trabajo para tu oficina: llevo los papeles y los plazos de una compraventa "
    + "y de un alquiler, y las cifras que tengo comprobadas.";
  const segunda = nombre
    ? nombre + ", " + loQueLlevo
    : loQueLlevo.charAt(0).toUpperCase() + loQueLlevo.slice(1);
  return SOY_UNA_IA + " " + segunda + " ¿De qué expediente hablamos?";
}

export const CONFIGURACION = Object.freeze({

  /* ►►► EL INTERRUPTOR ◄◄◄   "worker" = servidor de verdad · "simulada" = prueba que no gasta */
  cerebro: "worker",

  /* La dirección del servidor de IMMO IA. Solo se toca si el servidor cambia de sitio. */
  urlCerebro: "https://immoia.ley1998ortizz.workers.dev",

  /* La llave con la que el servidor nos reconoce. Es la misma que ya usa la web. */
  codigo: "leire2026",

  /* EL ÚNICO AVISO DE QUE ES UNA IA, y el saludo entero. Está escrito
     aquí, no lo genera nadie: no cuesta dinero y siempre suena igual.
     Se dice una vez, al abrir el oído, y se queda escrito en la
     conversación. Lo único que cambia es el nombre, y solo si este
     navegador tiene uno escrito. */
  avisoDeIA: saludoDeOficina(nombreDeQuienEntra()),

  /* Si en la misma visita se vuelve a abrir el oído, no se repite el
     aviso entero: solo esto. */
  avisoDeIAcorto: "Te escucho.",

  /* Con voz al empezar. Se puede silenciar desde la propia página. */
  conVoz: true

});
