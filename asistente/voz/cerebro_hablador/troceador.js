/* ============================================================
   PIEZA 3 \u00b7 troceador.js
   Convierte el texto que llega palabra a palabra (streaming) en
   frases completas, y entrega cada frase en cuanto se cierra.
   Asi la voz empieza a hablar con la primera frase, sin esperar
   a la respuesta entera.

   - Cierra en . ! ? \u2026 : seguidos de espacio, o en salto de linea.
   - No cierra tras "Sr.", "D.N.I.", "etc." ni dentro de "1.500".
   - Junta frases muy cortas con la siguiente (suena mejor), salvo
     la primera, que sale cuanto antes.
   - Si una frase se hace larguisima sin punto, se corta por la
     ultima coma o espacio.
   ============================================================ */

const CORTAS = new Set(["sr", "sra", "srta", "dr", "dra", "d\u00f1a", "dna", "ud", "uds", "n\u00fam", "num",
  "art", "p\u00e1g", "pag", "etc", "ej", "av", "avda", "ref", "apdo", "tel", "aprox", "m\u00e1x", "max",
  "m\u00edn", "min", "dcha", "izq", "c", "s"]);

function terminaEnAbreviatura(texto) {
  const m = /([A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00dc\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1.]+)\.$/.exec(texto);
  if (!m) return false;
  const p = m[1];
  if (p.length === 1) return true;
  if (/^(?:[A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]\.)+[A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]$/.test(p)) return true;
  return CORTAS.has(p.toLowerCase());
}

export function crearTroceador({ alFrase, primeraMin = 2, minLetras = 20, maxLetras = 240 } = {}) {
  let buffer = "";
  let pendiente = "";      /* frase corta esperando a juntarse con la siguiente */
  let dadas = 0;

  function dar(frase) {
    const f = frase.replace(/\s+/g, " ").trim();
    if (!f) return;
    const minimo = dadas === 0 ? primeraMin : minLetras;
    const junta = pendiente ? pendiente + " " + f : f;
    if (junta.length < minimo) { pendiente = junta; return; }
    pendiente = "";
    dadas++;
    alFrase(junta);
  }

  function buscarCortes() {
    let i = 0;
    while (i < buffer.length) {
      const c = buffer[i];
      const sig = buffer[i + 1];
      if (c === "\n") {
        const f = buffer.slice(0, i);
        buffer = buffer.slice(i + 1);
        i = 0;
        if (f.trim()) dar(f);
        continue;
      }
      if (".!?\u2026:".includes(c)) {
        if (sig === undefined) break;                 /* aun no se sabe que viene detras */
        if (sig === " " || sig === "\n" || sig === "\t") {
          const f = buffer.slice(0, i + 1);
          if (!(c === "." && terminaEnAbreviatura(f.trim()))) {
            buffer = buffer.slice(i + 1);
            i = 0;
            dar(f);
            continue;
          }
        }
      }
      i++;
    }
    /* frase larguisima sin punto: se corta por la ultima coma o espacio */
    while (buffer.length > maxLetras) {
      let corte = buffer.lastIndexOf(", ", maxLetras);
      if (corte < maxLetras / 2) corte = buffer.lastIndexOf(" ", maxLetras);
      if (corte <= 0) corte = maxLetras;
      const f = buffer.slice(0, corte + 1);
      buffer = buffer.slice(corte + 1);
      dar(f);
    }
  }

  return {
    anadir(delta) {
      if (!delta) return;
      buffer += String(delta);
      buscarCortes();
    },
    /* se acabo el texto: lo que quede sale ya */
    cerrar() {
      const resto = (pendiente ? pendiente + " " : "") + buffer;
      pendiente = ""; buffer = "";
      const f = resto.replace(/\s+/g, " ").trim();
      if (f) { dadas++; alFrase(f); }
    },
    dadas: () => dadas
  };
}
