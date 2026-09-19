/* ============================================================
   PIEZA 3 \u00b7 conexion_stream.js
   Conexion con STREAMING de verdad: el cerebro va mandando el
   texto segun lo escribe, y la voz empieza con la primera frase.

   Necesita que el worker tenga la ruta nueva /hablar_stream
   (todavia NO existe en el worker vivo). El protocolo acordado,
   en formato "eventos del servidor" (text/event-stream):

     event: texto        data: {"delta": "Hola, "}
     event: frase        data: {"texto": "Hola, te cuento."}      (tambien vale)
     event: herramienta  data: {"nombre": "...", "parametros": {...}, "porque": "..."}
     event: fin          data: {"motivo": "ok", "uso": {...}}
     event: error        data: {"mensaje": "..."}

   Envia lo mismo que conexion_worker.js, mas "catalogo" (las
   herramientas completas, con su descripcion), porque el worker
   nuevo podra aceptar tambien las de archivos.
   ============================================================ */

export function crearConexionStream({ url = "https://immoia.ley1998ortizz.workers.dev", ruta = "/hablar_stream", codigo = "", maxMs = 45000, sinDatosMs = 15000 } = {}) {
  const base = String(url).replace(/\/+$/, "");

  async function* hablar({ mensajes = [], herramientas = [], catalogo = [], ronda = 0, senal = null } = {}) {
    const control = new AbortController();
    let motivoCorte = null;
    const cortar = (m) => { if (!control.signal.aborted) { motivoCorte = m; control.abort(); } };
    const relojTotal = setTimeout(() => cortar("tiempo"), maxMs);
    let relojQuieto = setTimeout(() => cortar("quieto"), sinDatosMs);
    const alCortar = () => cortar("fuera");
    if (senal) { if (senal.aborted) cortar("fuera"); else senal.addEventListener("abort", alCortar, { once: true }); }

    const limpiar = () => {
      clearTimeout(relojTotal); clearTimeout(relojQuieto);
      if (senal) senal.removeEventListener("abort", alCortar);
    };
    const explicar = (e) => {
      if (motivoCorte === "fuera") return e;
      if (motivoCorte === "tiempo") return new Error("El cerebro ha tardado demasiado en contestar.");
      if (motivoCorte === "quieto") return new Error("El cerebro se ha quedado callado a mitad de respuesta.");
      return e;
    };

    let r;
    try {
      r = await fetch(base + ruta, {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "text/event-stream" },
        body: JSON.stringify({
          codigo,
          mensajes: mensajes.map((m) => (m.ficha ? { papel: m.papel, texto: m.texto, ficha: true } : { papel: m.papel, texto: m.texto })),
          herramientas,
          catalogo,
          ronda
        }),
        signal: control.signal
      });
    } catch (e) {
      limpiar();
      if (motivoCorte) throw explicar(e);
      throw new Error("No he podido hablar con el cerebro (\u00bfsin conexi\u00f3n, o no deja entrar desde esta p\u00e1gina?).");
    }

    if (!r.ok || !r.body) {
      limpiar();
      let msg = "El cerebro ha dicho que no (c\u00f3digo " + r.status + ").";
      try { const j = await r.json(); if (j && j.error) msg = String(j.error); } catch (e) {}
      throw new Error(msg);
    }

    const lector = r.body.getReader();
    const deco = new TextDecoder();
    let resto = "";
    let evento = "message", datos = [];
    let terminado = false;

    const procesar = function* () {
      const nombre = evento; const crudo = datos.join("\n");
      evento = "message"; datos = [];
      if (!crudo) return;
      let d;
      try { d = JSON.parse(crudo); } catch (e) { d = { delta: crudo }; }
      if (nombre === "texto" || nombre === "message") { if (d.delta) yield { tipo: "texto", delta: String(d.delta) }; }
      else if (nombre === "frase") { if (d.texto) yield { tipo: "texto", delta: String(d.texto) + " " }; }
      else if (nombre === "herramienta") {
        yield { tipo: "herramienta", nombre: String(d.nombre || ""), entrada: d.parametros && typeof d.parametros === "object" ? d.parametros : {}, porque: String(d.porque || "") };
      } else if (nombre === "fin") { terminado = true; yield { tipo: "fin", motivo: d.motivo || "ok", uso: d.uso || null }; }
      else if (nombre === "error") { throw new Error(String(d.mensaje || "El cerebro ha dado un error.")); }
    };

    try {
      while (true) {
        let trozo;
        try { trozo = await lector.read(); }
        catch (e) { throw explicar(e); }
        if (trozo.done) break;
        clearTimeout(relojQuieto);
        relojQuieto = setTimeout(() => cortar("quieto"), sinDatosMs);
        resto += deco.decode(trozo.value, { stream: true });
        let i;
        while ((i = resto.search(/\r?\n/)) >= 0) {
          const linea = resto.slice(0, i);
          resto = resto.slice(resto[i] === "\r" ? i + 2 : i + 1);
          if (linea === "") { yield* procesar(); if (terminado) return; continue; }
          if (linea.startsWith(":")) continue;                     /* comentario / latido */
          const dp = linea.indexOf(":");
          const campo = dp < 0 ? linea : linea.slice(0, dp);
          let valor = dp < 0 ? "" : linea.slice(dp + 1);
          if (valor.startsWith(" ")) valor = valor.slice(1);
          if (campo === "event") evento = valor;
          else if (campo === "data") datos.push(valor);
        }
      }
      resto += deco.decode();
      if (resto.trim()) { for (const l of resto.split(/\r?\n/)) { if (l.startsWith("data:")) datos.push(l.slice(5).trimStart()); else if (l.startsWith("event:")) evento = l.slice(6).trim(); } }
      yield* procesar();
      if (!terminado) yield { tipo: "fin", motivo: "corte_sin_fin", uso: null };
    } finally {
      limpiar();
      try { lector.releaseLock(); } catch (e) {}
      try { control.abort(); } catch (e) {}   /* libera la conexion siempre */
    }
  }

  return { nombre: "stream", gasta: true, hablar };
}
