/* ============================================================
   PIEZA 2 · trabajador_datos.js
   El trabajo pesado del cerebro analitico, en SEGUNDO PLANO.

   En el navegador lo arranca como un "Web Worker" y en node como un
   "worker_thread": en los dos casos es un hilo aparte. Asi, leer e
   indexar archivos no frena la voz ni la pantalla.

   Si no se puede arrancar el hilo, cerebro_datos.js usa este mismo
   motor en el hilo principal (plan B, mas lento).

   Lo que devuelve NO es el archivo entero: es un RESUMEN CORTO
   armado con frases copiadas del archivo. Donde el archivo no dice
   nada, pone "sin dato" y no lo rellena.

   Mensajes que entiende:
     {tipo:"cargar", base}                       lee datos/indice.json y sus archivos
     {tipo:"anadir", archivo, contenido, meta}   anade un archivo a mano
     {tipo:"ejecutar", id, herramienta, entrada, retrasoMs}
   Mensajes que devuelve:
     {tipo:"cargado", documentos, errores}
     {tipo:"anadido", archivo, trozos}
     {tipo:"resultado", id, resultado}
   ============================================================ */

import { crearIndice, normalizar, palabras } from "./buscador.js";
import { resultado, esDeArchivos, recortar } from "./herramientas.js";

const corto = (x, n) => String(x == null ? "" : x).slice(0, n);
const SIN_DATO = "sin dato";
const hay = (x) => (x === null || x === undefined || String(x).trim() === "" ? SIN_DATO : String(x).trim());

/* ---------- leer un archivo, con red o con disco ---------- */
/* El navegador lo pide por red (fetch). Node, cuando la carpeta es
   una carpeta del ordenador (file:), lo lee del disco. Es el mismo
   archivo y el mismo texto: no se toca nada por el camino. */
async function leerTexto(url) {
  if (/^file:/i.test(url)) {
    const fs = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    return fs.readFile(fileURLToPath(url), "utf8");
  }
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}

/* ---------- los expedientes de la oficina ---------- */
/* Cualquier archivo del indice que sea un JSON con una lista
   "expedientes" se guarda tambien aparte, para poder dar el estado
   de cada expediente en una linea. */

function estadoDeUnExpediente(x) {
  const docs = Array.isArray(x.documentos) ? x.documentos : [];
  const cuenta = {};
  for (const d of docs) {
    const e = hay(d && d.estado_documento);
    cuenta[e] = (cuenta[e] || 0) + 1;
  }
  const v = x.vivienda || {};
  const p = x.propietario || {};
  const m = x.ultimo_movimiento || {};
  return {
    expediente: hay(x.expediente_id),
    propietario: hay(p.nombre),
    direccion: hay(v.direccion_literal),
    municipio: hay(v.municipio),
    operacion: hay(x.tipo_operacion),
    papeles_que_faltan: hay(x.papeles_que_faltan_literal),
    plazo_que_se_acerca: hay(x.plazo_que_se_acerca),
    ultimo_movimiento: hay(m.fecha) + " · " + hay(m.que),
    documentos_por_estado: cuenta,
    es_ejemplo: x.es_test === true
  };
}

/* una linea por expediente, todo copiado del archivo */
function lineaDeEstado(e) {
  return e.expediente + " · " + e.propietario + " · " + e.direccion +
    " · faltan: " + e.papeles_que_faltan +
    " · plazo: " + e.plazo_que_se_acerca;
}

export function crearMotorDatos() {
  const indice = crearIndice();
  const expedientes = [];     /* {archivo, titulo, estado, busca} */
  let base = "";

  function guardarExpedientes(nombre, contenido, meta) {
    let datos = null;
    try { datos = typeof contenido === "string" ? JSON.parse(contenido) : contenido; } catch (e) { return 0; }
    const lista = datos && Array.isArray(datos.expedientes) ? datos.expedientes : null;
    if (!lista) return 0;
    for (let i = expedientes.length - 1; i >= 0; i--) if (expedientes[i].archivo === nombre) expedientes.splice(i, 1);
    for (const x of lista) {
      if (!x || typeof x !== "object") continue;
      const estado = estadoDeUnExpediente(x);
      expedientes.push({
        archivo: nombre,
        titulo: (meta && meta.titulo) || nombre,
        estado,
        /* por lo que se puede buscar: nombre, direccion, municipio, numero */
        busca: palabras([estado.expediente, estado.propietario, estado.direccion, estado.municipio, estado.operacion].join(" "))
      });
    }
    return lista.length;
  }

  function anadir(archivo, contenido, meta) {
    const n = indice.anadir(archivo, contenido, meta || {});
    if (/\.json$/i.test(archivo)) guardarExpedientes(archivo, contenido, meta || {});
    return n;
  }

  async function cargar(baseDatos) {
    base = String(baseDatos || "");
    const errores = [];
    let lista = [];
    try {
      const j = JSON.parse(await leerTexto(base + "indice.json"));
      lista = Array.isArray(j) ? j : (Array.isArray(j.archivos) ? j.archivos : []);
    } catch (e) {
      errores.push("No he podido leer datos/indice.json (" + (e && e.message || e) + ")");
      return { documentos: 0, errores };
    }
    for (const item of lista) {
      const nombre = typeof item === "string" ? item : item && item.archivo;
      if (!nombre || /(^|\/)\.\.(\/|$)/.test(nombre) || /^[a-z]+:/i.test(nombre)) {
        errores.push("Nombre de archivo no valido en el indice: " + corto(nombre, 80));
        continue;
      }
      try {
        const contenido = await leerTexto(base + encodeURI(nombre));
        anadir(nombre, contenido, typeof item === "object" ? item : {});
      } catch (e) {
        errores.push("No he podido leer " + nombre + " (" + (e && e.message || e) + ")");
      }
    }
    return { documentos: indice.cuantos(), errores };
  }

  /* ---------- buscar expedientes por nombre, calle o municipio ---------- */
  function buscarExpedientes(consulta, max) {
    const q = [...new Set(palabras(consulta))];
    if (!q.length) return [];
    const puntos = [];
    for (const x of expedientes) {
      let aciertos = 0;
      for (const p of q) if (x.busca.includes(p)) aciertos++;
      if (aciertos) puntos.push({ x, aciertos });
    }
    puntos.sort((a, b) => b.aciertos - a.aciertos ||
      String(a.x.estado.expediente).localeCompare(String(b.x.estado.expediente)));
    return puntos.slice(0, max).map((p) => p.x);
  }

  function ejecutar(herramienta, entrada) {
    const e = entrada && typeof entrada === "object" ? entrada : {};
    if (!esDeArchivos(herramienta)) {
      return resultado(herramienta, "error", null, null, "esa herramienta no la tiene el cerebro de datos");
    }
    const fuente = "archivos guardados (" + indice.cuantos() + ")";

    if (herramienta === "buscar_en_archivos") {
      const consulta = corto(e.consulta, 300).trim();
      if (!consulta) return resultado(herramienta, "error", null, fuente, "falta decir que buscar");
      const max = Math.max(1, Math.min(5, parseInt(e.max, 10) || 3));
      const trozos = indice.buscar(consulta, { max }).map((t) => Object.assign({}, t, { texto: recortar(t.texto, 260) }));
      if (!trozos.length) {
        return resultado(herramienta, "sin_resultados", { consulta, trozos: [] }, fuente,
          "no aparece en los archivos guardados; no hay que suponerlo",
          "No aparece nada de «" + consulta + "» en los archivos guardados.");
      }
      const resumen = trozos.length + " trozo(s), copiados tal cual:\n" +
        trozos.map((t, i) => (i + 1) + ". " + t.archivo + ": " + String(t.texto).replace(/\s+/g, " ")).join("\n");
      return resultado(herramienta, "encontrado", { consulta, trozos }, fuente,
        "trozos copiados literalmente; cita el archivo si das un dato", resumen);
    }

    if (herramienta === "buscar_expedientes") {
      const consulta = corto(e.consulta, 200).trim();
      if (!consulta) return resultado(herramienta, "error", null, fuente, "falta decir por quien o por que piso preguntan");
      const fuenteExp = "expedientes guardados (" + expedientes.length + ")";
      if (!expedientes.length) {
        return resultado(herramienta, "sin fuente disponible", null, fuenteExp,
          "en esta oficina no hay ningun archivo de expedientes cargado",
          "No tengo ningun expediente cargado.");
      }
      const max = Math.max(1, Math.min(10, parseInt(e.max, 10) || 10));
      const encontrados = buscarExpedientes(consulta, max);
      if (!encontrados.length) {
        return resultado(herramienta, "sin_resultados", { consulta, expedientes: [] }, fuenteExp,
          "no hay ningun expediente que cuadre; no hay que suponerlo",
          "No tengo ningun expediente de «" + consulta + "».");
      }
      const estados = encontrados.map((x) => x.estado);
      const resumen = estados.length + " expediente(s) de «" + consulta + "»:\n" +
        estados.map(lineaDeEstado).join("\n");
      return resultado(herramienta, "encontrado",
        { consulta, cuantos: estados.length, expedientes: estados }, fuenteExp,
        "todo copiado del expediente; donde pone «sin dato» el expediente no lo dice", resumen);
    }

    if (herramienta === "leer_archivo") {
      const nombre = corto(e.nombre, 160).trim();
      /* corto a proposito: al ejecutivo no se le pasa el archivo entero */
      const a = nombre ? indice.leer(nombre, { max: 900 }) : null;
      if (!a) {
        return resultado(herramienta, "sin_resultados",
          { pedido: nombre, disponibles: indice.lista().map((x) => x.archivo) }, fuente,
          "no hay ningun archivo con ese nombre",
          "No tengo ningun archivo que se llame «" + nombre + "».");
      }
      const resumen = a.archivo + " (" + hay(a.titulo) + ", " + hay(a.fecha) + ", " +
        a.caracteresTotales + " letras). Empieza asi: " + String(a.texto).replace(/\s+/g, " ").slice(0, 400);
      return resultado(herramienta, "encontrado", a, "archivo " + a.archivo,
        a.recortado ? "recortado a proposito: el archivo tiene " + a.caracteresTotales +
          " letras y se entregan las primeras " + a.texto.length + "; pide otro trozo si hace falta" : null,
        resumen);
    }

    if (herramienta === "listar_archivos") {
      const l = indice.lista();
      const resumen = l.length
        ? l.length + " archivo(s): " + l.map((x) => x.archivo).join(", ") +
          (expedientes.length ? " · y dentro, " + expedientes.length + " expediente(s)" : "")
        : "No hay ningun archivo guardado.";
      return resultado(herramienta, l.length ? "encontrado" : "sin_resultados",
        { cuantos: l.length, archivos: l, expedientes: expedientes.length }, fuente, null, resumen);
    }
    return resultado(herramienta, "error", null, fuente, "herramienta sin programar");
  }

  return {
    cargar,
    anadir,
    ejecutar,
    lista: () => indice.lista(),
    cuantosExpedientes: () => expedientes.length,
    base: () => base
  };
}

/* ---------- el hilo aparte: escuchar mensajes ---------- */
/* Un solo trabajo, dos casas: el Web Worker del navegador y el
   worker_thread de node. El motor es el mismo. */

function atender(motor, recibir, responder) {
  recibir(async (m0) => {
    const m = m0 || {};
    try {
      if (m.tipo === "cargar") {
        const r = await motor.cargar(m.base);
        responder({ tipo: "cargado", documentos: r.documentos, errores: r.errores, lista: motor.lista(), expedientes: motor.cuantosExpedientes() });
      } else if (m.tipo === "anadir") {
        const n = motor.anadir(m.archivo, m.contenido, m.meta);
        responder({ tipo: "anadido", archivo: m.archivo, trozos: n });
      } else if (m.tipo === "ejecutar") {
        if (m.retrasoMs) await new Promise((ok) => setTimeout(ok, m.retrasoMs));
        responder({ tipo: "resultado", id: m.id, resultado: motor.ejecutar(m.herramienta, m.entrada) });
      }
    } catch (e) {
      responder({ tipo: "resultado", id: m.id, resultado: resultado(m.herramienta || "?", "error", null, null, "ha fallado al buscarlo: " + (e && e.message || e)) });
    }
  });
}

const enHiloNavegador = typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope;
const enNode = typeof process !== "undefined" && !!(process.versions && process.versions.node);

if (enHiloNavegador) {
  const motor = crearMotorDatos();
  atender(motor, (fn) => { self.onmessage = (ev) => fn(ev.data); }, (m) => self.postMessage(m));
} else if (enNode) {
  /* en node hay que preguntar si estamos dentro del hilo; si no lo
     estamos, aqui no pasa nada */
  (async () => {
    try {
      const { parentPort } = await import("node:worker_threads");
      if (!parentPort) return;
      const motor = crearMotorDatos();
      atender(motor, (fn) => parentPort.on("message", fn), (m) => parentPort.postMessage(m));
    } catch (e) { /* no estamos en un hilo de node */ }
  })();
}
