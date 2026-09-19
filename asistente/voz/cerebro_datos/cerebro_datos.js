/* ============================================================
   PIEZA 2 - cerebro_datos.js  (EL CEREBRO ANALITICO)
   Busca en los archivos guardados y devuelve resumido lo que
   encuentra, sin frenar la voz: el trabajo pesado va en un hilo
   aparte (trabajador_datos.js).

   El cerebro hablador NUNCA busca archivos: le pide aqui las cosas
   con pedir(herramienta, entrada), y main.js hace de puente.

   Tiempos:
     avisoTardeMs  si tarda mas, avisa con "datos:tarde" (para rellenar)
     maxMs         si tarda mas, se rinde y devuelve "sin fuente disponible"

   Eventos: datos:listo, datos:pedido, datos:resultado, datos:tarde, datos:error
   ============================================================ */

import { crearMotorDatos } from "./trabajador_datos.js";
import {
  HERRAMIENTAS_ARCHIVOS,
  esDeArchivos, esDeImmoia, paraElModelo, resultado, ficha, sinDato
} from "./herramientas.js";

const EN_NODE = typeof process !== "undefined" && !!(process.versions && process.versions.node);

/* El hilo aparte, con la misma cara en las dos casas: el Web Worker
   del navegador y el worker_thread de node. Arriba nadie nota la
   diferencia. */
function envolverHiloNavegador(w) {
  return {
    donde: "navegador",
    postMessage: (m) => w.postMessage(m),
    terminate: () => w.terminate(),
    alMensaje: (fn) => { w.onmessage = (ev) => fn(ev && ev.data); },
    alError: (fn) => { w.onerror = (ev) => fn((ev && ev.message) || "error en el hilo"); }
  };
}
function envolverHiloNode(w) {
  return {
    donde: "node",
    postMessage: (m) => w.postMessage(m),
    terminate: () => { try { w.terminate(); } catch (e) {} },
    alMensaje: (fn) => w.on("message", fn),
    alError: (fn) => w.on("error", (e) => fn((e && e.message) || "error en el hilo"))
  };
}

export const OPCIONES_DATOS = Object.freeze({
  baseDatos: new URL("../../datos/", import.meta.url).href,
  enSegundoPlano: true,
  avisoTardeMs: 2500,
  maxMs: 8000,
  retrasoPruebaMs: 0      /* solo para probar respuestas lentas */
});

export function crearCerebroDatos({ bus, opciones = {} }) {
  const o = Object.assign({}, OPCIONES_DATOS, opciones);

  let hilo = null;              /* el hilo aparte, ya envuelto */
  let motor = null;             /* plan B: el mismo motor en el hilo principal */
  let listo = false;
  let cargando = null;
  let siguienteId = 1;
  const esperando = new Map();  /* id -> {ok, relojes} */
  let documentos = 0;
  let expedientes = 0;

  /* ---------- arrancar ---------- */
  function iniciar() {
    if (cargando) return cargando;
    cargando = new Promise((ok) => {
      const terminar = (docs, errores, enHilo) => {
        documentos = docs;
        listo = true;
        (errores || []).forEach((m) => bus.emitir("datos:error", { id: null, mensaje: m }));
        bus.emitir("datos:listo", { documentos: docs, herramientas: herramientas(), enSegundoPlano: enHilo });
        ok({ documentos: docs, errores: errores || [], enSegundoPlano: enHilo });
      };

      const planB = async (motivo) => {
        if (motivo) bus.emitir("datos:error", { id: null, mensaje: "Sin hilo aparte (" + motivo + "): busco en el hilo principal." });
        try { if (hilo) hilo.terminate(); } catch (e) {}
        hilo = null;
        motor = crearMotorDatos();
        const r = await motor.cargar(o.baseDatos);
        expedientes = motor.cuantosExpedientes ? motor.cuantosExpedientes() : 0;
        terminar(r.documentos, r.errores, false);
      };

      /* se le da la orden de cargar y se espera su "cargado" */
      const conectar = (h) => {
        hilo = h;
        let arrancado = false;
        const seguro = setTimeout(() => { if (!arrancado) { arrancado = true; planB("no contesta"); } }, 5000);
        h.alError((mensaje) => { if (!arrancado) { arrancado = true; clearTimeout(seguro); planB(mensaje); } });
        h.alMensaje((m0) => {
          const m = m0 || {};
          if (m.tipo === "cargado") {
            if (arrancado) return;
            arrancado = true; clearTimeout(seguro);
            expedientes = m.expedientes || 0;
            terminar(m.documentos, m.errores, true);
          } else if (m.tipo === "resultado") {
            entregar(m.id, m.resultado);
          }
        });
        h.postMessage({ tipo: "cargar", base: o.baseDatos });
      };

      const url = new URL("./trabajador_datos.js", import.meta.url);

      if (!o.enSegundoPlano) { planB(null); return; }

      if (typeof Worker !== "undefined") {
        let w;
        try { w = new Worker(url, { type: "module" }); } catch (e) { planB(e && e.message || "no arranca"); return; }
        conectar(envolverHiloNavegador(w));
        return;
      }
      if (EN_NODE) {
        import("node:worker_threads").then(({ Worker: HiloDeNode }) => {
          let w;
          try { w = new HiloDeNode(url); } catch (e) { planB(e && e.message || "no arranca"); return; }
          conectar(envolverHiloNode(w));
        }).catch((e) => planB(e && e.message || "no hay hilos aparte"));
        return;
      }
      planB("aqui no hay hilos aparte");
    });
    return cargando;
  }

  /* ---------- que herramientas hay ---------- */
  function herramientas() {
    const l = Object.keys(HERRAMIENTAS_ARCHIVOS);
    const H = typeof window !== "undefined" ? window.IMMOIA_HERRAMIENTAS : null;
    if (H && typeof H.disponibles === "function") {
      try { for (const n of H.disponibles()) if (esDeImmoia(n) && !l.includes(n)) l.push(n); } catch (e) {}
    }
    return l;
  }

  /* ---------- pedir algo ---------- */
  function entregar(id, r) {
    const p = esperando.get(id);
    if (!p) return;   /* ya se rindio por tiempo */
    esperando.delete(id);
    p.relojes.forEach(clearTimeout);
    const ms = Math.round(performance.now() - p.t0);
    bus.emitir("datos:resultado", { id, herramienta: p.herramienta, estado: r && r.estado, ms });
    p.ok(Object.assign({}, r, { ms }));
  }

  async function pedir(herramienta, entrada = {}) {
    if (!listo) await iniciar();
    const id = siguienteId++;
    const t0 = performance.now();
    bus.emitir("datos:pedido", { id, herramienta, entrada });

    return new Promise((ok) => {
      const relojes = [];
      esperando.set(id, { ok, relojes, t0, herramienta });

      relojes.push(setTimeout(() => {
        if (esperando.has(id)) bus.emitir("datos:tarde", { id, herramienta, ms: Math.round(performance.now() - t0) });
      }, o.avisoTardeMs));
      relojes.push(setTimeout(() => {
        if (!esperando.has(id)) return;
        bus.emitir("datos:error", { id, mensaje: herramienta + " ha tardado demasiado" });
        entregar(id, resultado(herramienta, "sin fuente disponible", null, null, "ha tardado mas de " + Math.round(o.maxMs / 1000) + " s; no hay dato"));
      }, o.maxMs));

      /* 1. herramientas de IMMO IA: las ejecuta la propia pagina */
      if (esDeImmoia(herramienta)) {
        const H = typeof window !== "undefined" ? window.IMMOIA_HERRAMIENTAS : null;
        setTimeout(() => {
          let r;
          if (!H || typeof H.ejecutar !== "function") r = resultado(herramienta, "sin fuente disponible", null, null, "en esta pagina no esta IMMO IA");
          else {
            try { r = H.ejecutar(herramienta, entrada); } catch (e) { r = resultado(herramienta, "error", null, null, "ha fallado al buscarlo"); }
          }
          entregar(id, r);
        }, 0);
        return;
      }

      /* 2. herramientas de archivos: el hilo aparte (o el plan B) */
      if (!esDeArchivos(herramienta)) {
        setTimeout(() => entregar(id, resultado(herramienta, "error", null, null, "esa herramienta no existe")), 0);
        return;
      }
      if (hilo) {
        hilo.postMessage({ tipo: "ejecutar", id, herramienta, entrada, retrasoMs: o.retrasoPruebaMs });
      } else {
        setTimeout(() => {
          let r;
          try { r = motor.ejecutar(herramienta, entrada); } catch (e) { r = resultado(herramienta, "error", null, null, "ha fallado al buscarlo"); }
          entregar(id, r);
        }, o.retrasoPruebaMs || 0);
      }
    });
  }

  function detener() {
    for (const [id] of esperando) entregar(id, resultado("?", "error", null, null, "se ha parado el cerebro de datos"));
    try { if (hilo) hilo.terminate(); } catch (e) {}
    hilo = null; motor = null; listo = false; cargando = null;
  }

  return {
    iniciar,
    pedir,
    detener,
    herramientas,
    /* el formato que necesita el modelo, por si la conexion lo pide */
    catalogo: () => paraElModelo(herramientas()),
    ficha,
    sinDato,
    listo: () => listo,
    documentos: () => documentos,
    expedientes: () => expedientes,
    enSegundoPlano: () => !!hilo,
    donde: () => (hilo ? hilo.donde : "hilo principal"),
    ajustar: (x) => Object.assign(o, x)
  };
}
