/* ============================================================
   PIEZA 1 - entrada_audio.js  (EL OIDO)
   Escucha, detecta cuando hablas y cuando te callas, y transcribe.

   Junta dos piezas internas:
     detector_voz.js   el volumen: cuando empiezas y cuando callas
     transcripcion.js  el texto (Chrome / Edge)

   Regla para dar una frase por terminada:
     1. El detector dice que te has callado (700 ms por defecto).
     2. Se espera como mucho "graciaMs" a que el texto sea definitivo.
     3. Si en ese rato vuelves a hablar, NO se corta: es la misma frase.
     4. Sale "entrada:frase" con el texto, o "entrada:ruido" si no hubo palabras.

   Redes de seguridad:
     - Sin transcripcion (Firefox, o transcribir:false): solo avisa
       de empieza / termino de hablar.
     - Alguien habla tan bajo que el detector no lo nota: si el texto
       lleva "textoQuietoMs" sin cambiar, se entrega igual.
     - Ruido que no para (una tele): a los "maxFraseMs" se corta y se
       vuelve a medir el ruido de fondo.
     - pausar() / reanudar(): para cuando habla la IA (no oirse a si misma).

   No importa ninguna otra pieza: solo habla por el bus que le pasan.
   ============================================================ */

import { crearDetectorVoz } from "./detector_voz.js";
import { crearTranscripcion } from "./transcripcion.js";

/* IDA Y VUELTA 18/09. Cuanto se espera antes de volver a abrir el microfono
   cuando se cae (se desenchufa, lo coge otro programa, se suspende la
   pestana). Despues del ultimo intento se RINDE Y LO DICE: nunca se queda
   callada como hasta hoy. */
export const ESPERAS_MICRO = Object.freeze([2000, 5000, 15000, 30000, 60000]);

export const OPCIONES_ENTRADA = Object.freeze({
  transcribir: true,
  idioma: "es-ES",
  graciaMs: 450,
  textoQuietoMs: 2200,
  maxFraseMs: 20000,
  /* SORDINA: cuantos decibelios MAS hace falta para cortar a la secretaria
     mientras esta hablando. Mas exigente que hablar normal, para que no la
     corte un portazo ni su propia voz por el altavoz. */
  margenSordinaDb: 9,
  detector: {}
});

export function crearEntradaAudio({ bus, opciones = {}, Reconocedor = null }) {
  const o = Object.assign({}, OPCIONES_ENTRADA, opciones);

  let encendida = false, pausada = false;
  let enSordina = false, corto = false;
  let turno = 0;
  let vozDesde = 0;
  let relojCierre = null, relojQuieto = null, relojMax = null;
  let relojVolver = null, intentosVolver = 0, rendida = false;

  const detector = crearDetectorVoz({ avisar: alDetector, opciones: o.detector });
  const margenNormal = detector.opciones().margenDb;
  const oido = o.transcribir
    ? crearTranscripcion({ avisar: alOido, idioma: o.idioma, Reconocedor })
    : { disponible: false, nombre: "ninguno" };
  const transcribe = () => !!(oido.disponible && oido.activa && oido.activa());

  function limpiar() {
    clearTimeout(relojCierre); relojCierre = null;
    clearTimeout(relojQuieto); relojQuieto = null;
    clearTimeout(relojMax); relojMax = null;
  }

  function cerrarFrase(fuente, finT, duracionMs) {
    limpiar();
    const t = ++turno;
    if (!transcribe()) return;   /* sin texto no hay frase que entregar */
    const r = oido.cerrarTurno();
    const latenciaMs = finT ? Math.round(performance.now() - finT) : null;
    if (r.texto) {
      bus.emitir("entrada:frase", {
        turno: t, texto: r.texto,
        fuente: fuente + (r.todoDefinitivo ? "" : "+provisional"),
        latenciaMs, duracionMs: duracionMs || null
      });
    } else {
      bus.emitir("entrada:ruido", { turno: t, duracionMs: duracionMs || null });
    }
  }

  function esperarTextoYcerrar(finT, duracionMs) {
    clearTimeout(relojCierre);
    if (!transcribe()) { cerrarFrase("silencio", finT, duracionMs); return; }
    const hasta = performance.now() + o.graciaMs;
    const mirar = () => {
      const p = oido.pendiente();
      if ((p.texto && p.todoDefinitivo) || performance.now() >= hasta) { cerrarFrase("silencio", finT, duracionMs); return; }
      relojCierre = setTimeout(mirar, 40);
    };
    relojCierre = setTimeout(mirar, 40);
  }

  /* ---------- lo que cuenta el detector ---------- */
  function alDetector(tipo, d) {
    if (tipo === "nivel") { bus.emitir("entrada:nivel", d); return; }
    if (tipo === "lista") { bus.emitir("entrada:lista", Object.assign({ transcribe: transcribe() }, d)); return; }
    /* EL MOVIL · 19/09/2026: el sistema nos ha quitado el microfono sin
       cerrarlo (pantalla apagada, llamada, otra app). No se cierra nada: se
       dice, y se espera a que vuelva. Si no vuelve, lo caza revisar(). */
    if (tipo === "mudo") {
      bus.emitir("entrada:dormida", { codigo: "mudo", porque: d.mensaje });
      return;
    }
    if (tipo === "vuelve_el_sonido") {
      bus.emitir("entrada:despierta", { porque: "el aparato me ha devuelto el micrófono" });
      return;
    }
    if (tipo === "desconectado") {
      /* IDA Y VUELTA 18/09. AQUI SE QUEDABA MUERTA: avisaba y llamaba a
         parar(), y no lo volvia a intentar nunca. Ahora vuelve sola. */
      bus.emitir("entrada:error", { codigo: "microfono_desconectado", mensaje: d.mensaje, seRecupera: true });
      volverAAbrir("se ha desconectado el micrófono");
      return;
    }
    if (pausada) return;

    /* SORDINA · LA INTERRUPCION.
       Si ella empieza a hablar MIENTRAS habla la secretaria, aqui se avisa
       y main.js la manda callar en el acto. A partir de este instante lo
       que diga se guarda; lo de antes era el eco y ya se ha tirado. */
    if (tipo === "empieza" && enSordina) {
      corto = true;
      quitarSordina();
      bus.emitir("entrada:interrumpe", d);
    }
    /* en sordina no se cierra ninguna frase: hasta que ella no corta, lo
       que suena es la secretaria */
    if (enSordina) return;

    if (tipo === "empieza") {
      clearTimeout(relojCierre); relojCierre = null;   /* ha vuelto a hablar: misma frase */
      if (!vozDesde) vozDesde = performance.now();
      bus.emitir("entrada:empieza_a_hablar", d);
      clearTimeout(relojMax);
      relojMax = setTimeout(() => {
        const ahora = performance.now();
        const dur = Math.round(ahora - vozDesde);
        vozDesde = 0;
        detector.recalibrar();
        bus.emitir("entrada:termino_de_hablar", { duracionMs: dur, finT: Math.round(ahora), tope: true });
        cerrarFrase("tope", ahora, dur);
      }, o.maxFraseMs);
      return;
    }
    if (tipo === "termina") {
      clearTimeout(relojMax); relojMax = null;
      const duracionMs = vozDesde ? Math.round(d.finT - vozDesde) : d.duracionMs;
      vozDesde = 0;
      bus.emitir("entrada:termino_de_hablar", { duracionMs, finT: d.finT });
      esperarTextoYcerrar(d.finT, duracionMs);
    }
  }

  /* ---------- lo que cuenta el oido ---------- */
  function alOido(tipo, d) {
    if (tipo === "error") {
      bus.emitir("entrada:error", { codigo: d.codigo, mensaje: d.mensaje, rendida: !!d.rendida });
      if (d.rendida) bus.emitir("entrada:rendida", { intentos: d.intento || 0, mensaje: d.mensaje });
      return;
    }
    /* el reconocedor se ha cortado y descansa: se dice, no se calla */
    if (tipo === "descanso") {
      bus.emitir("entrada:reintentando", { intento: d.intento, dentroMs: d.dentroMs, porque: "el reconocedor se corta solo" });
      return;
    }
    if (tipo === "vuelta") { bus.emitir("entrada:recuperada", { intentos: d.intento }); return; }
    if (tipo !== "cambio" || pausada) return;

    /* SORDINA: mientras habla la secretaria y ella NO la ha cortado todavia,
       lo que entra por el microfono solo puede ser la propia voz volviendo
       por el altavoz. Se tira, y asi no se contesta a si misma. */
    if (enSordina) {
      const tirado = oido.tirar ? oido.tirar() : "";
      if (tirado) bus.emitir("entrada:tirado", { porque: "eco de la propia voz", texto: tirado });
      return;
    }
    if (d.texto) bus.emitir("entrada:texto_parcial", { turno: turno + 1, texto: d.texto, definitivo: d.todoDefinitivo });
    clearTimeout(relojQuieto); relojQuieto = null;
    if (!d.texto) return;
    relojQuieto = setTimeout(function comprobar() {
      if (relojCierre) return;                                           /* ya se esta cerrando */
      if (detector.hablando()) { relojQuieto = setTimeout(comprobar, 300); return; }
      cerrarFrase("texto_quieto", d.ultimoCambio, null);
    }, o.textoQuietoMs);
  }

  /* ---------- la cara de la pieza ---------- */
  async function empezar() {
    if (encendida) return true;
    clearTimeout(relojVolver); relojVolver = null;
    const r = await detector.empezar();
    if (!r.ok) { bus.emitir("entrada:error", { codigo: r.codigo, mensaje: r.mensaje }); return false; }
    encendida = true; pausada = false; enSordina = false; corto = false; vozDesde = 0;
    detector.ajustar({ margenDb: margenNormal });
    if (o.transcribir && !oido.disponible) {
      bus.emitir("entrada:error", { codigo: "sin_transcripcion", mensaje: "Este navegador no me pasa tu voz a texto. Con Chrome s\u00ed; mientras, escr\u00edbeme aqu\u00ed abajo y te contesto igual." });
    }
    if (oido.disponible) oido.empezar();
    return true;
  }

  async function parar() {
    if (!encendida) return;
    encendida = false;
    limpiar();
    clearTimeout(relojVolver); relojVolver = null;
    if (oido.disponible) oido.parar();
    await detector.parar();
    pausada = false; enSordina = false; corto = false; vozDesde = 0;
    bus.emitir("entrada:parada", {});
  }

  /* ---------- SORDINA: escuchar mientras ella habla ----------
     Antes, cuando hablaba la secretaria, esto llamaba a pausar() y el oido
     se apagaba entero: lo que se le dijera encima se perdia sin decir nada.
     Ahora el microfono y el reconocedor SIGUEN ABIERTOS. Lo que cambia es:
       - hace falta hablar mas alto para cortarla (margenSordinaDb)
       - lo que transcribe mientras tanto se tira, porque es su propio eco
     Y en cuanto ella arranca a hablar, sale "entrada:interrumpe". */
  function ponerSordina() {
    if (!encendida || pausada || enSordina) return false;
    enSordina = true; corto = false;
    limpiar(); vozDesde = 0;
    /* NO se recalibra al entrar: el ruido de fondo se aprenderia con el eco
       dentro y despues costaria mas cortarla. Solo se sube el liston. */
    detector.ajustar({ margenDb: margenNormal + o.margenSordinaDb });
    if (oido.disponible && oido.tirar) oido.tirar();
    bus.emitir("entrada:sordina", { puesta: true, margenDb: margenNormal + o.margenSordinaDb });
    return true;
  }

  function quitarSordina() {
    if (!enSordina) return false;
    enSordina = false;
    detector.ajustar({ margenDb: margenNormal });
    /* si NADIE la ha cortado, lo que haya entrado es eco y se tira; y se
       vuelve a medir el ruido de fondo, que el eco lo habra subido */
    if (!corto) {
      if (oido.disponible && oido.tirar) {
        const tirado = oido.tirar();
        if (tirado) bus.emitir("entrada:tirado", { porque: "eco de la propia voz", texto: tirado });
      }
      detector.recalibrar();
    }
    bus.emitir("entrada:sordina", { puesta: false, corto });
    return true;
  }

  /* la pausa de verdad sigue existiendo (apagar, despedirse) */
  function pausar() {
    if (!encendida || pausada) return;
    pausada = true; enSordina = false; limpiar(); vozDesde = 0;
    detector.ajustar({ margenDb: margenNormal });
    detector.pausar();
    if (oido.disponible) oido.pausar();
    bus.emitir("entrada:pausada", {});
  }

  function reanudar() {
    if (!encendida) return;
    if (enSordina) quitarSordina();
    if (!pausada) return;
    pausada = false;
    detector.reanudar();
    if (oido.disponible) oido.reanudar();
    bus.emitir("entrada:reanudada", {});
  }

  /* ---------- SI SE CAE, VUELVE SOLA ----------
     Se prueba a los 2 s, 5 s, 15 s, 30 s y 60 s. Cada intento se dice por el
     bus para que la pantalla lo ensene. Si despues del ultimo sigue sin
     abrirse, sale "entrada:rendida" con una frase: nunca se queda callada. */
  function volverAAbrir(porque) {
    limpiar();
    if (oido.disponible) oido.parar();
    detector.parar();
    encendida = false; pausada = false; enSordina = false;
    if (rendida) return;
    const espera = ESPERAS_MICRO[Math.min(intentosVolver, ESPERAS_MICRO.length - 1)];
    intentosVolver++;
    if (intentosVolver > ESPERAS_MICRO.length) {
      rendida = true;
      bus.emitir("entrada:rendida", {
        intentos: intentosVolver - 1,
        mensaje: "He intentado abrir el micrófono varias veces y no lo consigo. Revísalo y recarga la página, o escríbeme aquí abajo."
      });
      return;
    }
    bus.emitir("entrada:reintentando", { intento: intentosVolver, dentroMs: espera, porque });
    clearTimeout(relojVolver);
    relojVolver = setTimeout(async () => {
      relojVolver = null;
      const ok = await empezar();
      if (ok) { const n = intentosVolver; intentosVolver = 0; bus.emitir("entrada:recuperada", { intentos: n }); }
      else volverAAbrir(porque);
    }, espera);
  }

  /* ---------- LA REVISION: ¿sigo oyendo de verdad? ----------
     EL MOVIL · 19/09/2026. Se llama cuando la pagina vuelve de estar
     escondida o congelada, y tambien cada latido. Hace tres cosas, de la mas
     barata a la mas cara:
       1. le pregunta al detector si esta vivo DE VERDAD (no la bandera)
       2. si no lo esta, prueba a despertar el sonido, que suele bastar
       3. y si sigue sin estarlo, vuelve a abrir el microfono entero
     Devuelve que ha hecho, para poder escribirlo en la pantalla. */
  async function revisar(porque = "revision", { vuelveDeFuera = false } = {}) {
    if (!encendida) return { ok: false, hecho: "nada", porque: "el oído no está abierto" };

    /* EL MOVIL 19/09. Si la pagina viene de estar apartada, el reconocedor se
       habra cortado muchas veces seguidas y estara durmiendo un descanso
       largo. No se le espera: se le despierta. */
    if (vuelveDeFuera && oido.disponible && oido.despertarYa && oido.descansando && oido.descansando()) {
      oido.despertarYa();
      bus.emitir("entrada:despierta", { porque: "he despertado el reconocedor, que estaba descansando" });
    }

    let s = detector.salud();
    if (s.ok) {
      /* el microfono va bien; miro que el reconocedor no se haya quedado
         parado sin estar descansando */
      if (oido.disponible && oido.activa && !oido.activa() && !(oido.descansando && oido.descansando())) {
        oido.empezar();
        bus.emitir("entrada:despierta", { porque: "he vuelto a arrancar el reconocedor" });
        return { ok: true, hecho: "reconocedor" };
      }
      return { ok: true, hecho: "nada" };
    }

    bus.emitir("entrada:dormida", { codigo: s.codigo, porque: s.porque, revision: porque });

    if (s.codigo === "suspendido" || s.codigo === "sin_sonido") {
      const despierto = await detector.despertar();
      if (despierto) {
        await new Promise((r) => setTimeout(r, 250));   /* que le de tiempo a medir */
        s = detector.salud();
        if (s.ok) {
          if (oido.disponible && oido.activa && !oido.activa() && !(oido.descansando && oido.descansando())) oido.empezar();
          bus.emitir("entrada:despierta", { porque: "he despertado el sonido" });
          return { ok: true, hecho: "despertado" };
        }
      }
    }

    /* no ha bastado: se abre entero. Y se le devuelven los intentos, porque
       esto es una situacion nueva, no la continuacion de la de antes. */
    rendida = false;
    intentosVolver = 0;
    volverAAbrir(s.porque);
    return { ok: false, hecho: "reabriendo", porque: s.porque };
  }

  return {
    empezar, parar, pausar, reanudar,
    /* lo que llama main.js cuando la secretaria empieza y termina de hablar */
    ponerSordina, quitarSordina,
    volverAAbrir,
    revisar,
    salud: () => detector.salud(),
    encendida: () => encendida,
    pausada: () => pausada,
    enSordina: () => enSordina,
    rendida: () => rendida,
    volviendo: () => !!relojVolver,
    hablando: () => detector.hablando(),
    transcribe,
    /* cambiar silencioMs o margenDb del detector sin parar */
    ajustarDetector: (x) => detector.ajustar(x),
    ajustar: (x) => Object.assign(o, x),
    recalibrar: () => detector.recalibrar()
  };
}
