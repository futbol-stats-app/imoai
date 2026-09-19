/* ============================================================
   PIEZA 4 - salida_audio.js  (LA VOZ)
   Recibe las frases del cerebro hablador segun van llegando y las
   dice en voz alta en ese mismo momento, sin esperar a que termine
   la respuesta entera.

   - Cada frase trae su numero de turno. Si llega una frase de un
     turno que ya se corto, se tira.
   - Un turno nuevo calla lo que quedara del anterior.
   - terminarTurno(turno): el cerebro avisa de que no llegan mas
     frases; cuando se han dicho todas sale "salida:fin".
   - callar(): corta ya (la persona interrumpe).
   - callarRelleno(): EL SILENCIO 19/09 (tanda 10). Corta SOLO las
     frases de relleno -las de la casa, que suenan mientras viene la
     respuesta- y deja intacto todo lo demas. callar() no vale para
     esto: callar() sube "cortadoHasta" al turno de ahora, y entonces
     la respuesta de verdad, que es de ESE MISMO turno, ya no podria
     entrar. Esto tira las de relleno que esperan en la cola y corta
     en seco la que este sonando, sin tocar el turno.
   - Sin voz en el aparato, o con la voz apagada: las frases se dan
     por dichas al momento, para que la conversacion siga por escrito.

   Eventos: salida:empieza, salida:frase_dicha, salida:fin,
            salida:callada, salida:error
   ============================================================ */

import { crearVozNavegador } from "./voz_navegador.js";

export const OPCIONES_SALIDA = Object.freeze({
  conVoz: true,
  idioma: "es-ES",
  velocidad: 1.04
});

export function crearSalidaAudio({ bus, opciones = {}, motor = null }) {
  const o = Object.assign({}, OPCIONES_SALIDA, opciones);
  const voz = motor || crearVozNavegador({ idioma: o.idioma, velocidad: o.velocidad });

  let turno = 0;               /* turno que se esta diciendo */
  let cortadoHasta = 0;        /* turnos <= a este, tirados */
  let cola = [];               /* frases pendientes del turno actual */
  let ocupada = false;         /* hay una frase sonando */
  let empezo = false;          /* ya se emitio salida:empieza en este turno */
  let cerrado = false;         /* el cerebro dijo que no llegan mas */
  let avisadoSinVoz = false;
  let tipoSonando = null;      /* tipo de la frase que esta sonando AHORA (tanda 10) */

  const sinVoz = () => !o.conVoz || !voz.disponible;

  function nuevoTurno(t) {
    if (ocupada || cola.length) {
      const viejo = turno;
      cola = [];
      voz.callar && voz.callar();
      ocupada = false;
      bus.emitir("salida:callada", { turno: viejo, motivo: "turno_nuevo" });
    }
    turno = t; empezo = false; cerrado = false;
  }

  async function siguiente() {
    if (ocupada) return;
    const f = cola.shift();
    if (!f) {
      if (cerrado && empezo) { const t = turno; empezo = false; bus.emitir("salida:fin", { turno: t }); }
      else if (cerrado && !empezo) { bus.emitir("salida:fin", { turno, vacio: true }); cerrado = false; }
      return;
    }
    ocupada = true;
    tipoSonando = f.tipo;
    const t = turno;
    if (!empezo) { empezo = true; bus.emitir("salida:empieza", { turno: t }); }

    let r = { cortado: false };
    if (sinVoz()) {
      if (o.conVoz && !voz.disponible && !avisadoSinVoz) {
        avisadoSinVoz = true;
        bus.emitir("salida:error", { mensaje: "Este aparato no tiene voz, as\u00ed que te contesto por escrito." });
      }
      await new Promise((ok) => setTimeout(ok, 0));
    } else {
      try { r = await voz.hablar(f.texto); } catch (e) { r = { cortado: false, fallo: "excepcion" }; }
      /* CAMBIADO PARA LA WEB: antes el aviso llevaba dentro el nombre
         del fallo, que no le dice nada a nadie. El detalle va al
         registro del navegador y la persona lee una frase entera. */
      if (r.fallo && r.fallo !== "sin_aviso_de_fin") {
        try { console.warn("[salida] la voz ha fallado:", r.fallo); } catch (e2) {}
        bus.emitir("salida:error", { mensaje: "Se me ha cortado la voz. Lo que te digo lo tienes escrito aqu\u00ed mismo." });
      }
    }
    if (t !== turno || t <= cortadoHasta) { tipoSonando = null; return; }   /* mientras hablaba, lo cortaron */
    ocupada = false;
    tipoSonando = null;
    if (!r.cortado) bus.emitir("salida:frase_dicha", { turno: t, n: f.n, tipo: f.tipo });
    siguiente();
  }

  function encolar({ turno: t, n = 0, texto = "", tipo = "respuesta" }) {
    if (!texto || !String(texto).trim()) return;
    if (t <= cortadoHasta) return;             /* de un turno ya cortado */
    if (t < turno) return;                      /* de un turno viejo */
    if (t > turno) nuevoTurno(t);
    cola.push({ n, texto: String(texto), tipo });
    siguiente();
  }

  function terminarTurno(t) {
    if (t !== turno || t <= cortadoHasta) return;
    cerrado = true;
    if (!ocupada) siguiente();
  }

  /* EL SILENCIO 19/09 (tanda 10). Callar SOLO el relleno.
     Se llama en dos momentos: cuando llega la respuesta de verdad y
     cuando la persona empieza a hablar. Si se solapan, es peor que el
     silencio. No toca "cortadoHasta" ni el turno: lo que viene detras
     -que es la respuesta del mismo turno- entra igual. */
  function callarRelleno(motivo = "llega_la_respuesta") {
    const enCola = cola.some((f) => f.tipo === "relleno");
    if (enCola) cola = cola.filter((f) => f.tipo !== "relleno");
    let cortada = false;
    if (ocupada && tipoSonando === "relleno") {
      if (voz.callar) voz.callar();   /* la que suena se corta en seco */
      cortada = true;
    }
    return { habia: enCola || cortada, sonaba: cortada, enCola, motivo };
  }

  function callar(motivo = "interrupcion") {
    const t = turno;
    const habia = ocupada || cola.length > 0;
    cortadoHasta = Math.max(cortadoHasta, t);
    cola = [];
    ocupada = false; empezo = false; cerrado = false; tipoSonando = null;
    if (voz.callar) voz.callar();
    if (habia) bus.emitir("salida:callada", { turno: t, motivo });
    return habia;
  }

  return {
    encolar,
    terminarTurno,
    callar,
    callarRelleno,
    hablando: () => ocupada || cola.length > 0,
    /* lo que suena AHORA MISMO es relleno de la casa (tanda 10) */
    sonandoRelleno: () => ocupada && tipoSonando === "relleno",
    turno: () => turno,
    tieneVoz: () => !!voz.disponible,
    /* ha sonado de verdad por el altavoz alguna vez (no es una suposicion) */
    haSonado: () => !!(voz.haSonado && voz.haSonado()),
    vozElegida: () => (voz.vozElegida ? voz.vozElegida() : "ninguna"),
    ponerVoz: (si) => { o.conVoz = !!si; if (!si) callar("voz_apagada"); },
    /* decir algo suelto fuera de la conversacion (avisos) */
    decirSuelto: (texto) => (sinVoz() ? Promise.resolve({ cortado: false }) : voz.hablar(texto))
  };
}
