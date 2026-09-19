/* ============================================================
   PIEZA 3 · conexion_worker.js
   Conecta con EL SERVIDOR DE VERDAD de IMMO IA (/hablar). Alli
   vive toda la logica: las reglas, el repaso de cifras, el tope
   de gasto y las herramientas. Esta conexion no la cambia: la usa
   tal como esta hoy.

   ESTA ES LA CONEXION QUE ESTA ENCENDIDA EN LA WEB. La de prueba
   (conexion_simulada.js) sigue aqui al lado, entera, apagada. El
   interruptor esta en ../../configuracion.js.

   Hoy el servidor contesta la respuesta ENTERA de una vez (no hace
   streaming). Esta conexion la parte en palabras para que el resto
   del montaje funcione igual; la voz empezara en cuanto llegue la
   respuesta. Cuando el servidor tenga streaming, se usa
   conexion_stream.js y nada mas cambia.

   Protocolo de hoy:
     envia   {codigo, mensajes:[{papel,texto,ficha?}], herramientas:[nombres], ronda}
     recibe  {respuesta} | {error} | {herramienta:{nombre, parametros, porque}, ronda, quedan}
   OJO:
     - el servidor solo acepta SUS herramientas (expediente_detalle,
       cartera_lista, fiscalidad_lugar, orden_revisar). Las de archivos
       no las conoce todavia: se filtran aqui.
     - el servidor solo contesta a los dominios que tiene permitidos.
     - CADA LLAMADA GASTA.

   CAMBIADO PARA LA WEB (V1): lo unico que se ha tocado aqui es COMO SE
   CUENTAN LOS FALLOS. Antes salian tal cual venian del servidor, en
   media lengua de programador. Ahora cada situacion se cuenta con una
   frase de la casa y quien la lee sabe que hacer. La forma de llamar,
   el cuerpo del mensaje y el orden de las cosas no han cambiado.
   ============================================================ */

const DEL_WORKER = new Set(["expediente_detalle", "cartera_lista", "fiscalidad_lugar", "orden_revisar"]);

/* ---------- las frases de la casa para cuando algo sale mal ---------- */
const NO_LLEGO      = "Ahora mismo no consigo llegar a la oficina. Mira si tienes conexión y vuelve a preguntarme en un momento.";
const SIN_PERMISO   = "Todavía no tengo permiso para hablar desde esta página. Avísale al equipo y lo abren enseguida.";
const SIN_LLAVE     = "No me han dado la llave para entrar hoy. Avísale al equipo y lo arreglan enseguida.";
const TOPE_DEL_DIA  = "Hoy ya he atendido todas las consultas que tenía previstas. Mañana vuelvo a estar disponible.";
const MUCHA_GENTE   = "Hay mucha gente preguntando a la vez. Espera un momento y vuelve a intentarlo.";
const DEMASIADO     = "Me has contado demasiado de una vez. Resúmelo en menos palabras y te contesto.";
const TARDA_MUCHO   = "Esto está tardando más de lo normal. Vuelve a preguntarme, por favor.";
const RARO          = "Me ha llegado una respuesta que no entiendo. Vuelve a preguntarme, por favor.";
const SIN_RESPUESTA = "Se me ha quedado la respuesta a medias. Vuelve a preguntarme, por favor.";

/* Traduce lo que dice el servidor a una frase de la casa. Se mira antes
   el codigo de la respuesta, que es lo unico seguro, y despues el texto,
   que puede cambiar el dia que cambie el servidor. */
function frasePara(estado, textoDelServidor) {
  const t = String(textoDelServidor || "").toLowerCase();
  if (estado === 403 || t.indexOf("no puede llamar") >= 0) return SIN_PERMISO;
  if (estado === 401 || t.indexOf("clave") >= 0 || t.indexOf("codigo") >= 0 || t.indexOf("código") >= 0) return SIN_LLAVE;
  if (t.indexOf("tope del dia") >= 0 || t.indexOf("tope del día") >= 0) return TOPE_DEL_DIA;
  if (estado === 429) return MUCHA_GENTE;
  if (estado === 413) return DEMASIADO;
  return NO_LLEGO;
}

export function crearConexionWorker({ url = "https://immoia.ley1998ortizz.workers.dev", codigo = "", msPorPalabra = 0, maxMs = 30000 } = {}) {
  const base = String(url).replace(/\/+$/, "");

  async function* hablar({ mensajes = [], herramientas = [], ronda = 0, senal = null } = {}) {
    const propias = herramientas.filter((n) => DEL_WORKER.has(n));
    const cuerpo = {
      codigo,
      mensajes: mensajes.map((m) => (m.ficha ? { papel: m.papel, texto: m.texto, ficha: true } : { papel: m.papel, texto: m.texto })),
      ronda
    };
    if (propias.length) cuerpo.herramientas = propias;

    /* tiempo maximo propio, ademas del corte de fuera */
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), maxMs);
    const alCortar = () => control.abort();
    if (senal) { if (senal.aborted) control.abort(); else senal.addEventListener("abort", alCortar, { once: true }); }

    let r, d;
    try {
      r = await fetch(base + "/hablar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal: control.signal
      });
      d = await r.json().catch(() => null);
    } catch (e) {
      if (senal && senal.aborted) throw e;
      if (control.signal.aborted) throw new Error(TARDA_MUCHO);
      /* aqui cae tambien el caso de que el navegador no deje salir la
         llamada porque el servidor no tiene abierto este dominio */
      throw new Error(NO_LLEGO);
    } finally {
      clearTimeout(reloj);
      if (senal) senal.removeEventListener("abort", alCortar);
    }

    const estado = r ? r.status : 0;
    if (!d) throw new Error(estado >= 400 ? frasePara(estado, "") : RARO);
    if (d.error) throw new Error(frasePara(estado, d.error));
    if (estado >= 400) throw new Error(frasePara(estado, ""));

    if (d.herramienta && d.herramienta.nombre) {
      yield {
        tipo: "herramienta",
        nombre: String(d.herramienta.nombre),
        entrada: d.herramienta.parametros && typeof d.herramienta.parametros === "object" ? d.herramienta.parametros : {},
        porque: String(d.herramienta.porque || "")
      };
      yield { tipo: "fin", motivo: "herramienta", uso: { llamadas: d.llamadas || 1 } };
      return;
    }

    const texto = typeof d.respuesta === "string" ? d.respuesta : "";
    if (!texto.trim()) throw new Error(SIN_RESPUESTA);
    const palabras = texto.match(/\S+\s*/g) || [];
    for (const p of palabras) {
      if (senal && senal.aborted) throw new DOMException("cortado", "AbortError");
      if (msPorPalabra) await new Promise((ok) => setTimeout(ok, msPorPalabra));
      yield { tipo: "texto", delta: p };
    }
    yield { tipo: "fin", motivo: "ok", uso: { estado: d.estado || null } };
  }

  return { nombre: "worker", gasta: true, hablar };
}
