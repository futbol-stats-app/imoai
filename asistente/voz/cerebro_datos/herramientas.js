/* ============================================================
   PIEZA 2 \u00b7 herramientas.js
   El catalogo de lo que el cerebro hablador puede pedirle al
   cerebro de datos, y la "ficha" con la que se le devuelve.

   Dos familias:
     1. ARCHIVOS: buscar, leer y listar los archivos guardados en
        la carpeta datos/. Las ejecuta el trabajador en segundo plano.
     2. IMMO IA: las cuatro del cerebro que ya esta en Cloudflare
        (copiadas tal cual de su CATALOGO). Solo existen si la pagina
        tiene cargado herramientas.js de IMMO IA (window.IMMOIA_HERRAMIENTAS).

   Todas devuelven el mismo contrato, y SOLO datos, nunca ordenes:
     { ok, herramienta, estado, datos, fuente, revisado, nota, resumen }
   estado: "verificado" | "encontrado" | "sin_resultados" | "sin fuente disponible" | "error"

   REGLA DEL RESUMEN (OT-11, paso 4): el analitico NO le pasa al
   ejecutivo el archivo entero, le pasa un RESUMEN CORTO. El resumen
   se arma solo con frases copiadas del archivo: donde el archivo no
   dice nada, el resumen pone "sin dato" y nunca lo rellena.
   ============================================================ */

/* cuanto puede medir, como mucho, lo que se le pone delante al ejecutivo */
export const TOPE_RESUMEN = 900;
export const TOPE_DATOS = 1200;

export const HERRAMIENTAS_ARCHIVOS = Object.freeze({
  buscar_en_archivos: {
    description: "Busca en los archivos guardados de la oficina (notas, expedientes, documentos) y devuelve los trozos que mas se parecen a la consulta, copiados literalmente y con el nombre del archivo. Pidela cuando la persona pregunte por algo que puede estar en sus archivos y no lo tienes delante.",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "lo que hay que buscar, con las palabras importantes" },
        max: { type: "integer", description: "cuantos trozos como mucho (1 a 5)", minimum: 1, maximum: 5 }
      },
      required: ["consulta"]
    }
  },
  leer_archivo: {
    description: "Devuelve el contenido de UN archivo guardado, por su nombre. Si es largo, llega recortado y lo dice. Pidela solo cuando ya sabes que archivo es.",
    input_schema: {
      type: "object",
      properties: { nombre: { type: "string", description: "el nombre del archivo, tal como sale en la lista" } },
      required: ["nombre"]
    }
  },
  listar_archivos: {
    description: "Devuelve la lista de archivos guardados, con su titulo y su fecha. Pidela si la persona pregunta que hay guardado.",
    input_schema: { type: "object", properties: {} }
  },
  buscar_expedientes: {
    description: "Busca expedientes de la oficina por el nombre del propietario, por la direccion o por el municipio, y devuelve de cada uno su estado en una linea: los papeles que faltan, el plazo que se acerca y el ultimo movimiento, copiados tal cual del expediente. Pidela cuando la persona pregunte por un cliente, por un piso o por como va un expediente. Si un expediente no dice algo, sale 'sin dato': no se rellena.",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "el nombre, la calle o el municipio por el que preguntan" },
        max: { type: "integer", description: "cuantos expedientes como mucho (1 a 10)", minimum: 1, maximum: 10 }
      },
      required: ["consulta"]
    }
  }
});

/* copiadas del CATALOGO del worker de IMMO IA (huella del worker vivo 57e55025) */
export const HERRAMIENTAS_IMMOIA = Object.freeze({
  "expediente_detalle": {
    "description": "Devuelve el detalle de UN expediente que ya esta abierto en esta oficina: tareas pendientes, llaves, plazos con fecha, documentos que faltan y estado. Pidela SOLO si te preguntan por algo de un expediente que no esta en el resumen que ya tienes delante.",
    "input_schema": {
      "type": "object",
      "properties": {
        "nombre": {
          "type": "string",
          "description": "el nombre corto con el que la persona llama al expediente, por ejemplo: el de Adeje"
        }
      },
      "required": [
        "nombre"
      ]
    }
  },
  "cartera_lista": {
    "description": "Devuelve la lista de expedientes abiertos de esta oficina con su estado y su siguiente plazo. Pidela SOLO si te preguntan por varios expedientes a la vez o por cual toca antes, y no lo tienes delante.",
    "input_schema": {
      "type": "object",
      "properties": {}
    }
  },
  "fiscalidad_lugar": {
    "description": "Devuelve el tipo, el plazo, la fecha de revision, la fuente y si esta verificado de un impuesto de vivienda en un lugar de Espana. Pidela SOLO si te preguntan por un numero fiscal que NO tienes delante en las fichas. No la pidas para confirmar un numero que ya tienes.",
    "input_schema": {
      "type": "object",
      "properties": {
        "lugar": {
          "type": "string",
          "description": "comunidad, provincia, isla o municipio"
        },
        "impuesto": {
          "type": "string",
          "description": "itp, ajd, fianza o cedula"
        }
      },
      "required": [
        "lugar"
      ]
    }
  },
  "orden_revisar": {
    "description": "Revisa el ORDEN de los tramites de una reforma o una instalacion y devuelve lo que bloquea una deduccion, lo que caduca pronto y lo que hay que decidir antes, cada cosa con su fuente legal. Pidela cuando alguien cuente que va a hacer una obra, poner placas o pedir una deduccion, y necesites saber si el orden le va a costar dinero.",
    "input_schema": {
      "type": "object",
      "properties": {
        "situacion": {
          "type": "string",
          "description": "lo que la persona ha contado, con sus palabras"
        }
      },
      "required": [
        "situacion"
      ]
    }
  }
});

export function esDeArchivos(nombre) {
  return Object.prototype.hasOwnProperty.call(HERRAMIENTAS_ARCHIVOS, nombre);
}
export function esDeImmoia(nombre) {
  return Object.prototype.hasOwnProperty.call(HERRAMIENTAS_IMMOIA, nombre);
}

/* formato para el modelo: [{name, description, input_schema}] */
export function paraElModelo(nombres) {
  return nombres.map((n) => {
    const h = HERRAMIENTAS_ARCHIVOS[n] || HERRAMIENTAS_IMMOIA[n];
    return h ? { name: n, description: h.description, input_schema: h.input_schema } : null;
  }).filter(Boolean);
}

export function hoyISO() { return new Date().toISOString().slice(0, 10); }

export function resultado(herramienta, estado, datos, fuente, nota, resumen) {
  return {
    ok: estado !== "error" && estado !== "sin fuente disponible",
    herramienta, estado,
    datos: datos === undefined ? null : datos,
    fuente: fuente || null,
    revisado: hoyISO(),
    nota: nota || null,
    resumen: recortar(resumen, TOPE_RESUMEN)
  };
}

/* corta por el final sin cambiar ni una letra de lo que deja */
export function recortar(t, max) {
  if (t == null) return null;
  const s = String(t);
  return s.length > max ? s.slice(0, max) + "… (recortado)" : s;
}

/* Los estados en los que NO hay dato. Con cualquiera de estos, el
   ejecutivo tiene que decir "no lo tengo" y no rellenar nada. */
export function sinDato(r) {
  const e = r && r.estado;
  return e === "sin_resultados" || e === "sin fuente disponible" || e === "error" || !r;
}

/* La ficha que se le pone delante al cerebro hablador.
   Mismo formato que la de IMMO IA, para que su worker la reconozca:
   empieza por "[DATO DE HERRAMIENTA" y solo lleva campos. */
export function ficha(r, maxDatos = TOPE_DATOS) {
  const l = [];
  l.push("[DATO DE HERRAMIENTA \u00b7 lo ha buscado la oficina, esto SI lo tienes delante]");
  l.push("herramienta: " + r.herramienta);
  l.push("estado: " + (r.estado || "?"));
  if (r.fuente) l.push("fuente: " + r.fuente);
  if (r.revisado) l.push("revisado: " + r.revisado);
  if (r.nota) l.push("nota: " + r.nota);
  if (r.resumen) l.push("resumen: " + r.resumen);
  if (sinDato(r)) l.push("aviso: no hay dato. Di que no lo tienes. No completes nada con lo que parezca probable.");
  l.push("datos:");
  let txt;
  try { txt = JSON.stringify(r.datos, null, 1); } catch (e) { txt = "(no se han podido leer los datos)"; }
  if (txt && txt.length > maxDatos) txt = txt.slice(0, maxDatos) + "\n(recortado: habia mas)";
  l.push(txt);
  return l.join("\n");
}
