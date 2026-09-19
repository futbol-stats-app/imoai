/* ============================================================
   PIEZA 4 \u00b7 voz_navegador.js
   El "motor" de voz: la voz que trae el propio aparato
   (speechSynthesis). No sale nada a internet desde aqui.

   Pieza interna de salida_audio.js. Cualquier otro motor
   (una voz en la nube, mas adelante) tiene que tener esta cara:
     disponible, nombre, hablar(texto) -> Promise<{cortado, fallo}>,
     callar(), hablando(), vozElegida()

   Trucos que ya usaba secretaria.js:
     - elige la mejor voz espanola del aparato, no la primera
     - habla por trozos (Chrome corta los textos largos)
     - un "toque" cada 8 s para que Chrome no se calle a medias
   Y uno nuevo:
     - si un trozo no avisa de que ha terminado (fallo conocido de
       Chrome), se da por dicho pasado un tiempo razonable.
   ============================================================ */

import { paraDecir, trocear } from "./lectura.js";

const PREFERIDAS = [
  /Sabina|Elvira|M\u00f3nica|Monica|Paulina|Helena|Laura|Luc\u00eda|Lucia/i,
  /Google.*espa/i, /Microsoft.*(Spanish|Espa)/i, /es-ES/i, /es[-_]/i
];

export function crearVozNavegador({ idioma = "es-ES", velocidad = 1.04, tono = 1, SS = null, Enunciado = null } = {}) {
  const sintesis = SS || (typeof window !== "undefined" ? window.speechSynthesis : null);
  const Utt = Enunciado || (typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null);
  if (!sintesis || !Utt) return { disponible: false, nombre: "navegador" };

  let voz = null;
  let turno = 0;
  let hablando = false;
  let latido = null;
  /* IDA Y VUELTA 18/09: el aparato ha sonado DE VERDAD alguna vez.
     Antes la pantalla lo adivinaba mirando el reloj una sola vez a los
     1500 ms y sacaba «toca una vez y me oyes» aunque hubiera sonado
     perfectamente. Esto es el dato, no una suposicion. */
  let haSonado = false;

  function elegirVoz() {
    let todas = [];
    try { todas = sintesis.getVoices() || []; } catch (e) { return; }
    if (!todas.length) return;
    const esp = todas.filter((v) => /^es\b|^es[-_]/i.test(v.lang || ""));
    const grupo = esp.length ? esp : todas;
    voz = null;
    for (const patron of PREFERIDAS) {
      voz = grupo.find((v) => patron.test((v.name || "") + " " + (v.lang || ""))) || null;
      if (voz) break;
    }
    if (!voz) voz = grupo[0] || null;
  }
  elegirVoz();
  try {
    if (sintesis.addEventListener) sintesis.addEventListener("voiceschanged", elegirVoz);
    else sintesis.onvoiceschanged = elegirVoz;
  } catch (e) {}

  function latir(encender) {
    if (encender && !latido) {
      latido = setInterval(() => { try { if (sintesis.speaking) sintesis.resume(); } catch (e) {} }, 8000);
    } else if (!encender && latido) { clearInterval(latido); latido = null; }
  }

  function decirTrozo(texto, mio) {
    return new Promise((ok) => {
      if (mio !== turno) { ok({ cortado: true }); return; }
      const u = new Utt(texto);
      u.__nuestra = true;   /* si en la pagina esta secretaria.js, que no se la quede */
      u.lang = idioma;
      if (voz) u.voice = voz;
      u.rate = velocidad;
      u.pitch = tono;
      u.volume = 1;
      let hecho = false;
      /* por si Chrome no avisa nunca del final */
      const maxMs = Math.max(4000, texto.length * 120);
      const seguro = setTimeout(() => terminar({ cortado: mio !== turno, fallo: "sin_aviso_de_fin" }), maxMs);
      function terminar(r) { if (hecho) return; hecho = true; clearTimeout(seguro); ok(r); }
      u.onstart = () => { haSonado = true; };
      u.onend = () => { haSonado = true; terminar({ cortado: mio !== turno }); };
      u.onerror = (ev) => {
        const e = (ev && ev.error) || "";
        if (e === "interrupted" || e === "canceled" || mio !== turno) terminar({ cortado: true });
        else terminar({ cortado: false, fallo: e || "error" });
      };
      try { sintesis.speak(u); } catch (e) { terminar({ cortado: false, fallo: "no_habla" }); }
    });
  }

  async function hablar(texto) {
    const limpio = paraDecir(texto);
    if (!limpio) return { cortado: false };
    const trozos = trocear(limpio).filter((t) => t && t.trim());
    if (!trozos.length) return { cortado: false };
    const mio = turno;
    hablando = true;
    latir(true);
    let fallo = null;
    try {
      for (const t of trozos) {
        const r = await decirTrozo(t, mio);
        if (r.fallo) fallo = r.fallo;
        if (r.cortado || mio !== turno) return { cortado: true, fallo };
      }
      return { cortado: false, fallo };
    } finally {
      if (mio === turno) { hablando = false; latir(false); }
    }
  }

  function callar() {
    turno++;
    hablando = false;
    latir(false);
    try { sintesis.cancel(); } catch (e) {}
  }

  return {
    disponible: true,
    nombre: "navegador",
    hablar,
    callar,
    hablando: () => hablando,
    haSonado: () => haSonado,
    vozElegida: () => (voz ? voz.name + " (" + voz.lang + ")" : "la de serie"),
    voces: () => { try { return (sintesis.getVoices() || []).map((v) => v.name + " \u00b7 " + v.lang); } catch (e) { return []; } }
  };
}
