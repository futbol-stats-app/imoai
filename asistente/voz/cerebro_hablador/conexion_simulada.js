/* ============================================================
   PIEZA 3 \u00b7 conexion_simulada.js
   Un cerebro FALSO para probar todo el montaje sin gastar nada
   y sin internet. No usa ninguna inteligencia artificial.

   Se comporta como la conexion de verdad:
     - devuelve el texto palabra a palabra, con pausas
     - si le preguntas por tus archivos, primero dice una frase
       ("Voy a mirarlo en tus archivos.") y pide la herramienta
       buscar_en_archivos; cuando recibe la ficha, contesta con lo
       que pone en el archivo, copiado tal cual
   Asi se prueba el ida y vuelta con el cerebro de datos.

   Cara comun de todas las conexiones:
     nombre, gasta (true/false),
     hablar({mensajes, herramientas, catalogo, ronda, senal})
       -> iterador asincrono de:
          {tipo:"texto", delta}
          {tipo:"herramienta", nombre, entrada, porque}
          {tipo:"fin", motivo, uso}
   ============================================================ */

const PIDE_ARCHIVOS = /archiv|expedient|guardad|busca|mira en|plazo|firma|nota|document|cliente|adeje/i;

function esperar(ms, senal) {
  return new Promise((ok, mal) => {
    if (senal && senal.aborted) { mal(new DOMException("cortado", "AbortError")); return; }
    const t = setTimeout(ok, ms);
    if (senal) senal.addEventListener("abort", () => { clearTimeout(t); mal(new DOMException("cortado", "AbortError")); }, { once: true });
  });
}

function leerFicha(texto) {
  const i = texto.indexOf("\ndatos:\n");
  const estado = (/\nestado: ([^\n]+)/.exec(texto) || [])[1] || "";
  let datos = null;
  if (i >= 0) { try { datos = JSON.parse(texto.slice(i + 8).replace(/\n\(recortado: habia mas\)$/, "")); } catch (e) { datos = null; } }
  return { estado, datos };
}

export function crearConexionSimulada({ primeraMs = 350, msPorPalabra = 30, lentitudMs = 0 } = {}) {
  async function* soltar(texto, senal) {
    const trozos = texto.match(/\S+\s*/g) || [];
    for (const t of trozos) {
      await esperar(msPorPalabra, senal);
      yield { tipo: "texto", delta: t };
    }
  }

  async function* hablar({ mensajes = [], herramientas = [], ronda = 0, senal = null } = {}) {
    await esperar(primeraMs + lentitudMs, senal);

    /* lo ultimo que ha dicho la persona, y si ya hay ficha despues */
    let ultimaPersona = null, fichaDespues = null;
    for (let i = mensajes.length - 1; i >= 0; i--) {
      const m = mensajes[i];
      if (m.papel === "yo" && m.ficha && !fichaDespues && !ultimaPersona) fichaDespues = m;
      if (m.papel === "yo" && !m.ficha) { ultimaPersona = m; break; }
    }
    const dicho = ultimaPersona ? ultimaPersona.texto : "";

    if (fichaDespues) {
      const { estado, datos } = leerFicha(fichaDespues.texto);
      const trozo = datos && Array.isArray(datos.trozos) && datos.trozos[0];
      let respuesta;
      if (estado === "encontrado" && trozo) {
        const literal = String(trozo.texto).replace(/\s+/g, " ").slice(0, 200);
        respuesta = "Lo he encontrado en " + trozo.archivo + ". Pone esto: \u00ab" + literal + "\u00bb. \u00bfQuieres que busque algo m\u00e1s?";
      } else if (estado === "sin_resultados") {
        respuesta = "No lo encuentro en tus archivos guardados, as\u00ed que no te lo puedo confirmar. \u00bfLo buscamos con otras palabras?";
      } else {
        respuesta = "No he podido consultar tus archivos ahora mismo. Prueba otra vez en un momento.";
      }
      yield* soltar(respuesta, senal);
      yield { tipo: "fin", motivo: "ok", uso: { simulado: true } };
      return;
    }

    if (PIDE_ARCHIVOS.test(dicho) && herramientas.includes("buscar_en_archivos")) {
      yield* soltar("Voy a mirarlo en tus archivos. ", senal);
      yield { tipo: "herramienta", nombre: "buscar_en_archivos", entrada: { consulta: dicho, max: 3 }, porque: "Voy a mirarlo en tus archivos." };
      yield { tipo: "fin", motivo: "herramienta", uso: { simulado: true } };
      return;
    }

    let respuesta;
    if (!dicho || /^(hola|buenas|buenos d)/i.test(dicho.trim())) {
      respuesta = "Hola. Estoy en modo de prueba: no uso ninguna inteligencia artificial de verdad. Preg\u00fantame por tus archivos guardados y te digo lo que pone.";
    } else {
      respuesta = "Me has dicho: " + dicho.slice(0, 160) + ". En modo de prueba solo s\u00e9 buscar en tus archivos, as\u00ed que preg\u00fantame por ellos. Por ejemplo, cu\u00e1ndo es la firma del expediente de ejemplo.";
    }
    yield* soltar(respuesta, senal);
    yield { tipo: "fin", motivo: "ok", uso: { simulado: true } };
  }

  return { nombre: "simulada", gasta: false, hablar };
}
