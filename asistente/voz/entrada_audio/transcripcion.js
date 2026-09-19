/* ============================================================
   PIEZA 1 \u00b7 transcripcion.js
   Pasa la voz a texto con el reconocimiento de Chrome o Edge.
   OJO: en Chrome el audio lo transcribe Google; en Edge, Microsoft.
   Firefox no lo tiene.

   Escucha de forma continua y va acumulando texto (provisional y
   definitivo). NO decide cuando termina la frase: eso lo decide
   entrada_audio.js con el detector de silencio.

   Pieza interna: avisa con "avisar(tipo, datos)", no usa el bus.
     avisar("cambio", {texto, todoDefinitivo, ultimoCambio})
     avisar("error",  {codigo, mensaje, grave})

   Cualquier otro "oido" (uno en la nube, mas adelante) tiene que
   tener esta misma cara:
     disponible, nombre, empezar(), parar(), pausar(), reanudar(),
     pendiente(), cerrarTurno()
   ============================================================ */

/* CAMBIADO PARA LA WEB: mismas situaciones, contadas como las contaria
   una persona de la casa, y siempre con la salida que si funciona. */
const MENSAJES = {
  "not-allowed": "No me has dado permiso para el micr\u00f3fono. Puedes d\u00e1rmelo en el candado que hay arriba, al lado de la direcci\u00f3n, o escribirme aqu\u00ed abajo.",
  "service-not-allowed": "Este navegador no me deja pasar tu voz a texto en esta p\u00e1gina. Escr\u00edbeme aqu\u00ed abajo y te contesto igual.",
  "audio-capture": "No encuentro ning\u00fan micr\u00f3fono en este aparato. Escr\u00edbeme aqu\u00ed abajo y te contesto igual.",
  "network": "Te oigo, pero ahora mismo no consigo pasar tu voz a texto. Comprueba la conexi\u00f3n o escr\u00edbeme aqu\u00ed abajo.",
  "language-not-supported": "Este navegador no entiende el espa\u00f1ol hablado. Escr\u00edbeme aqu\u00ed abajo y te contesto igual."
};
const GRAVES = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);

/* IDA Y VUELTA 18/09. Cuantos reenganches seguidos se aguantan antes de
   descansar, y cuanto se descansa cada vez. Despues del ultimo descanso, y
   solo entonces, se rinde y LO DICE. */
export const TOPE_REENGANCHES = 8;
export const ESPERAS = Object.freeze([5000, 15000, 30000, 60000]);

export function crearTranscripcion({ avisar, idioma = "es-ES", Reconocedor = null }) {
  const Rec = Reconocedor || window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) return { disponible: false, nombre: "navegador" };

  let rec = null;
  let activa = false, pausada = false;
  let base = 0;                 /* resultados por debajo de este indice ya se entregaron */
  let trozos = new Map();       /* indice -> {texto, definitivo} */
  let ultimoCambio = 0;
  let reinicios = [];
  /* IDA Y VUELTA 18/09: cuando se corta una y otra vez ya no se apaga para
     siempre. Descansa y vuelve a intentarlo, y solo se rinde al cabo de
     varios descansos; entonces lo dice en pantalla en vez de callarse. */
  let relojDescanso = null;
  let descansos = 0;

  function pendiente() {
    const idx = [...trozos.keys()].filter((i) => i >= base).sort((a, b) => a - b);
    const partes = idx.map((i) => trozos.get(i));
    return {
      texto: partes.map((p) => p.texto.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
      todoDefinitivo: partes.every((p) => p.definitivo),
      ultimoCambio
    };
  }

  function nuevo() {
    const r = new Rec();
    r.lang = idioma;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    /* los avisos de un reconocedor viejo se ignoran: nunca dos a la vez */
    r.onstart = () => {
      if (r !== rec) return;
      base = 0; trozos = new Map();   /* cada arranque cuenta desde 0 */
    };
    r.onresult = (ev) => {
      if (r !== rec || pausada) return;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (i < base) continue;
        const res = ev.results[i];
        trozos.set(i, { texto: String((res[0] && res[0].transcript) || ""), definitivo: !!res.isFinal });
      }
      ultimoCambio = performance.now();
      avisar("cambio", pendiente());
    };
    r.onerror = (ev) => {
      if (r !== rec) return;
      const e = (ev && ev.error) || "desconocido";
      if (e === "no-speech" || e === "aborted") return;   /* normales */
      const grave = GRAVES.has(e);
      if (grave) activa = false;
      avisar("error", { codigo: "transcripcion_" + e, mensaje: MENSAJES[e] || ("Fallo al pasar la voz a texto: " + e), grave });
    };
    r.onend = () => {
      if (r !== rec || !activa || pausada) return;
      /* Chrome corta solo de vez en cuando: se vuelve a poner en marcha */
      const ahora = performance.now();
      reinicios = reinicios.filter((t) => ahora - t < 10000);
      reinicios.push(ahora);
      if (reinicios.length > TOPE_REENGANCHES) {
        descansar();
        return;
      }
      setTimeout(() => { if (activa && !pausada) arrancar(); }, 120);
    };
    return r;
  }

  function arrancar() {
    try { rec = nuevo(); rec.start(); }
    catch (e) { avisar("error", { codigo: "transcripcion_arranque", mensaje: "No he conseguido abrir el o\u00eddo. Espera un momento y vuelvo a intentarlo, o escr\u00edbeme aqu\u00ed abajo.", grave: false }); }
  }

  /* SE CORTA UNA Y OTRA VEZ: descansa y vuelve. No se apaga para siempre.
     Antes aqui se ponia "activa = false" y se acababa la voz de toda la
     visita. Ahora se descansa ESPERAS[n] milisegundos y se reengancha; solo
     despues de todos los descansos se rinde, y se dice. */
  function descansar() {
    const espera = ESPERAS[Math.min(descansos, ESPERAS.length - 1)];
    descansos++;
    const r = rec; rec = null;
    try { r && r.abort(); } catch (e) {}
    reinicios = [];
    if (descansos > ESPERAS.length) {
      activa = false;
      avisar("error", {
        codigo: "transcripcion_rendida",
        mensaje: "El o\u00eddo se me corta una y otra vez y ya no consigo levantarlo. Recarga la p\u00e1gina, o escr\u00edbeme aqu\u00ed abajo y seguimos.",
        grave: true, rendida: true
      });
      return;
    }
    avisar("descanso", {
      codigo: "transcripcion_descanso", intento: descansos, dentroMs: espera,
      mensaje: "Se me ha ido el o\u00eddo un momento. Ya vuelvo, no hace falta que toques nada."
    });
    clearTimeout(relojDescanso);
    relojDescanso = setTimeout(() => {
      relojDescanso = null;
      if (!activa || pausada) return;
      avisar("vuelta", { codigo: "transcripcion_vuelta", intento: descansos });
      arrancar();
    }, espera);
  }

  return {
    disponible: true,
    nombre: "navegador",
    empezar() { if (activa) return; activa = true; pausada = false; reinicios = []; descansos = 0; arrancar(); },
    parar() { activa = false; clearTimeout(relojDescanso); relojDescanso = null; const r = rec; rec = null; try { r && r.abort(); } catch (e) {} trozos = new Map(); },
    /* SORDINA (no pausa): el reconocedor SIGUE VIVO mientras habla la
       secretaria, para que lo que ella diga encima no se pierda. Lo unico
       que se hace es tirar lo que va llegando, porque hasta que ella no
       corta eso solo puede ser el eco de la propia voz. */
    pausar() { pausada = true; clearTimeout(relojDescanso); relojDescanso = null; const r = rec; rec = null; try { r && r.abort(); } catch (e) {} trozos = new Map(); },
    reanudar() { if (!activa || !pausada) return; pausada = false; reinicios = []; arrancar(); },
    /* tira lo acumulado hasta ahora y sigue escuchando desde cero */
    tirar() {
      const a = pendiente();
      base = Math.max(-1, ...trozos.keys()) + 1;
      for (const i of [...trozos.keys()]) if (i < base) trozos.delete(i);
      return a.texto;
    },
    activa: () => activa,
    descansando: () => !!relojDescanso,
    pendiente,
    /* entrega lo acumulado y empieza de cero para la siguiente frase */
    cerrarTurno() {
      const a = pendiente();
      base = Math.max(-1, ...trozos.keys()) + 1;
      for (const i of [...trozos.keys()]) if (i < base) trozos.delete(i);
      return { texto: a.texto, todoDefinitivo: a.todoDefinitivo };
    }
  };
}
