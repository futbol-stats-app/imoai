/* ============================================================
   PIEZA 1 \u00b7 detector_voz.js
   Abre el microfono y detecta cuando hablas y cuando te callas,
   solo por el volumen. No transcribe ni envia el audio a nadie.

   - Al empezar, aprende el ruido de fondo (medio segundo).
   - Si el volumen sube claramente por encima -> empieza a hablar.
   - Si baja y se queda abajo "silencioMs" -> termino de hablar.

   Es una pieza interna de entrada_audio.js: no usa el bus, avisa
   con la funcion "avisar(tipo, datos)" que le pasan.
   ============================================================ */

export const OPCIONES_DETECTOR = Object.freeze({
  silencioMs: 700,     /* silencio necesario para dar por terminado */
  minVozMs: 120,       /* un sonido mas corto no cuenta (un golpe, un clic) */
  margenDb: 12,        /* cuanto por encima del ruido de fondo cuenta como voz */
  histeresisDb: 4,     /* para dejar de contar como voz tiene que bajar un poco mas */
  calibrarMs: 500,     /* tiempo para aprender el ruido de fondo */
  marcoMs: 20,         /* cada cuanto se mide */
  fondoMinDb: -85,
  fondoMaxDb: -30,
  /* EL MOVIL · 19/09/2026.
     COMO SE SABE SI SIGUE ENTRANDO SONIDO. La primera version miraba si
     llegaban ceros exactos, y ESTABA MAL: con la supresion de ruido puesta
     -que la pedimos nosotros- un microfono en una habitacion callada puede
     dar ceros exactos perfectamente, y entonces se reabria el microfono en
     bucle sin que pasara nada. Lo caza la prueba del silencio largo.
     Lo que si es una medida de verdad: EL RELOJ DEL SONIDO. currentTime del
     AudioContext avanza siempre que el audio esta vivo, haya ruido o no, y
     se para en seco cuando el sistema corta. No depende de lo callada que
     este la sala. */
  relojParadoMs: 3000
});

/* CAMBIADO PARA LA WEB: antes un mensaje mandaba abrir la pagina con un
   archivo .bat del ordenador. En la web eso no existe y no lo entiende
   nadie, asi que ahora todos ofrecen la salida que si hay: escribir. */
const MENSAJES = {
  NotAllowedError: "No me has dado permiso para el micr\u00f3fono. Puedes d\u00e1rmelo en el candado que hay arriba, al lado de la direcci\u00f3n, o escribirme aqu\u00ed abajo.",
  NotFoundError: "No encuentro ning\u00fan micr\u00f3fono en este aparato. Escr\u00edbeme aqu\u00ed abajo y te contesto igual.",
  NotReadableError: "El micr\u00f3fono lo est\u00e1 usando otro programa. Ci\u00e9rralo y vuelve a pulsar, o escr\u00edbeme aqu\u00ed abajo.",
  SecurityError: "El navegador no me deja usar el micr\u00f3fono en esta p\u00e1gina. Escr\u00edbeme aqu\u00ed abajo y te contesto igual.",
  sin_soporte: "Este navegador no me deja usar el micr\u00f3fono. Con Chrome s\u00ed; mientras, escr\u00edbeme aqu\u00ed abajo."
};

export function crearDetectorVoz({ avisar, opciones = {} }) {
  const o = Object.assign({}, OPCIONES_DETECTOR, opciones);

  let micro = null, ctx = null, fuente = null, analizador = null, buf = null, reloj = null;
  let encendido = false, pausado = false;
  let fondo = null, muestras = [], inicioCalibrar = 0;
  let hablando = false, arribaDesde = 0, abajoDesde = 0, vozDesde = 0;
  /* EL MOVIL · 19/09/2026: el reloj del sonido y cuando se movio por ultima
     vez, si el sistema nos ha quitado el microfono sin cerrarlo, y cuando se
     midio por ultima vez (si la pagina estuvo congelada, ni eso corrio). */
  let relojCtx = -1, relojCambioT = 0, ultimoPaso = 0;
  let silenciadoPorElSistema = false;

  function reiniciar() {
    fondo = null; muestras = []; inicioCalibrar = performance.now();
    hablando = false; arribaDesde = 0; abajoDesde = 0; vozDesde = 0;
  }

  function medirDb() {
    analizador.getFloatTimeDomainData(buf);
    let suma = 0;
    for (let i = 0; i < buf.length; i++) suma += buf[i] * buf[i];
    return 20 * Math.log10(Math.sqrt(suma / buf.length) + 1e-10);
  }
  const acotar = (x) => Math.min(o.fondoMaxDb, Math.max(o.fondoMinDb, x));

  function paso() {
    const ahora = performance.now();
    const db = medirDb();

    /* ¿SIGUE VIVO EL SONIDO? Se mira si el reloj del audio avanza. No se
       corta nada aqui: solo se apunta, y salud() lo lee. */
    ultimoPaso = ahora;
    if (ctx) {
      const ahoraCtx = ctx.currentTime;
      if (ahoraCtx !== relojCtx) { relojCtx = ahoraCtx; relojCambioT = ahora; }
      else if (!relojCambioT) relojCambioT = ahora;
    }

    if (fondo === null) {
      muestras.push(db);
      if (ahora - inicioCalibrar >= o.calibrarMs) {
        const orden = muestras.slice().sort((a, b) => a - b);
        fondo = acotar(orden[Math.floor(orden.length / 2)]);
        muestras = [];
        avisar("lista", { fondoDb: Math.round(fondo) });
      }
      avisar("nivel", { db: Math.round(db), fondoDb: null, umbralDb: null, hablando: false });
      return;
    }

    const umbralSube = fondo + o.margenDb;
    const umbralBaja = fondo + o.margenDb - o.histeresisDb;

    if (!hablando) {
      if (db < umbralSube) {
        fondo = acotar(fondo * 0.97 + db * 0.03);   /* lo que no es voz ajusta el fondo, despacio */
        arribaDesde = 0;
      } else if (!pausado) {
        if (!arribaDesde) arribaDesde = ahora;
        if (ahora - arribaDesde >= o.minVozMs) {
          hablando = true; vozDesde = arribaDesde; abajoDesde = 0;
          avisar("empieza", { db: Math.round(db), fondoDb: Math.round(fondo) });
        }
      }
    } else if (db < umbralBaja) {
      if (!abajoDesde) abajoDesde = ahora;
      if (ahora - abajoDesde >= o.silencioMs) {
        hablando = false; arribaDesde = 0;
        avisar("termina", { duracionMs: Math.round(abajoDesde - vozDesde), finT: Math.round(abajoDesde) });
      }
    } else {
      abajoDesde = 0;   /* ha vuelto a hablar antes de tiempo: sigue la misma frase */
    }
    avisar("nivel", { db: Math.round(db), fondoDb: Math.round(fondo), umbralDb: Math.round(umbralSube), hablando });
  }

  async function empezar() {
    if (encendido) return { ok: true };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { ok: false, codigo: "sin_soporte", mensaje: MENSAJES.sin_soporte };
    }
    try {
      micro = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
    } catch (e) {
      const nombre = (e && e.name) || "desconocido";
      return { ok: false, codigo: nombre, mensaje: MENSAJES[nombre] || ("No he podido abrir el micr\u00f3fono (" + nombre + ").") };
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    if (ctx.state === "suspended") { try { await ctx.resume(); } catch (e) {} }
    fuente = ctx.createMediaStreamSource(micro);
    analizador = ctx.createAnalyser();
    analizador.fftSize = 1024;
    analizador.smoothingTimeConstant = 0;
    fuente.connect(analizador);
    buf = new Float32Array(analizador.fftSize);

    micro.getAudioTracks().forEach((pista) => {
      pista.addEventListener("ended", () => {
        if (encendido) avisar("desconectado", { mensaje: "Se ha desconectado el micr\u00f3fono." });
      });
      /* EL MOVIL \u00b7 19/09/2026. Cuando el sistema se queda el microfono -se
         apaga la pantalla, entra una llamada, otra aplicacion lo coge- el
         navegador NO cierra la pista: la deja viva y MUDA, y avisa con estos
         dos eventos. Antes no los escuchaba nadie, asi que la pagina se
         quedaba con la luz encendida y sorda, sin decir ni una palabra. */
      pista.addEventListener("mute", () => {
        silenciadoPorElSistema = true;
        if (encendido) avisar("mudo", { mensaje: "El aparato me ha quitado el micr\u00f3fono." });
      });
      pista.addEventListener("unmute", () => {
        silenciadoPorElSistema = false;
        relojCambioT = 0;
        if (encendido) avisar("vuelve_el_sonido", {});
      });
    });

    reiniciar();
    pausado = false;
    relojCtx = -1; relojCambioT = 0; ultimoPaso = 0;
    silenciadoPorElSistema = false;
    reloj = setInterval(paso, o.marcoMs);
    encendido = true;
    return { ok: true };
  }

  async function parar() {
    if (!encendido) return;
    encendido = false;
    clearInterval(reloj); reloj = null;
    try { fuente.disconnect(); } catch (e) {}
    try { micro.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { await ctx.close(); } catch (e) {}
    micro = ctx = fuente = analizador = buf = null;
    hablando = false;
  }

  /* ---------- ¿ESTA VIVO DE VERDAD, O SOLO ENCENDIDO? ----------
     EL MOVIL · 19/09/2026. AQUI ESTABA EL FALLO DE «SE QUEDA CALLADO».
     Hasta hoy lo unico que se podia preguntar era encendido(), que es una
     BANDERA: se pone a true al abrir el microfono y ahi se queda. Cuando el
     movil apaga la pantalla, el microfono no se cierra -asi que la bandera
     sigue diciendo que si- pero deja de llegar sonido. La pagina se quedaba
     con la luz roja puesta, sorda, y sin decir nada.
     Esto no es una bandera: es una MEDIDA. Mira las cuatro formas que hay de
     quedarse sordo sin que nadie cierre nada. */
  function salud() {
    if (!encendido) return { ok: false, codigo: "cerrado", porque: "el oído está cerrado" };
    const pista = micro && micro.getAudioTracks ? micro.getAudioTracks()[0] : null;
    if (!pista) return { ok: false, codigo: "sin_pista", porque: "no hay micrófono abierto" };
    if (pista.readyState !== "live") return { ok: false, codigo: "pista_muerta", porque: "el micrófono se ha cerrado" };
    if (silenciadoPorElSistema || pista.muted) return { ok: false, codigo: "mudo", porque: "el aparato me ha quitado el micrófono" };
    if (ctx && ctx.state !== "running") return { ok: false, codigo: "suspendido", porque: "el sonido está en pausa (" + ctx.state + ")" };
    /* EL RELOJ DEL SONIDO. Solo se juzga si el propio medidor ha corrido hace
       poco: si la página estuvo congelada no corrió ni él, y entonces que el
       reloj no se haya movido no dice nada de si el micrófono está bien. */
    const ahora = performance.now();
    if (ultimoPaso && (ahora - ultimoPaso) < 2000 && relojCambioT && (ahora - relojCambioT) > o.relojParadoMs) {
      return { ok: false, codigo: "sin_sonido",
               porque: "el sonido lleva " + Math.round((ahora - relojCambioT) / 1000) + " s parado" };
    }
    return { ok: true };
  }

  /* Intento barato antes de volver a abrirlo todo: muchas veces al volver de
     segundo plano basta con despertar el sonido. */
  async function despertar() {
    if (!ctx) return false;
    if (ctx.state === "running") return true;
    try { await ctx.resume(); } catch (e) { return false; }
    if (ctx.state === "running") { relojCambioT = 0; relojCtx = -1; return true; }
    return false;
  }

  return {
    empezar,
    parar,
    /* en pausa sigue midiendo el fondo, pero no avisa de voz */
    pausar() { pausado = true; hablando = false; arribaDesde = 0; abajoDesde = 0; },
    reanudar() { pausado = false; arribaDesde = 0; },
    recalibrar: reiniciar,
    salud,
    despertar,
    encendido: () => encendido,
    hablando: () => hablando,
    ajustar: (nuevas) => Object.assign(o, nuevas),
    opciones: () => Object.assign({}, o)
  };
}
