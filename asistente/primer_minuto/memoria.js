/* ============================================================
   primer_minuto/memoria.js  ·  QUE SE GUARDE Y VUELVA MAÑANA

   PRIMER MINUTO · 18/09/2026.
   La conversación se guarda en la cuenta de la oficina, en el
   servidor (no en este navegador), con cuatro peticiones:

     guardar  la conversación de ahora, entera. Se manda sola, un par
              de segundos después de cada cosa que se dice.
     resumir  al terminar (cuando ella se despide, o cuando se cierra
              la ventana): el servidor la resume en cinco líneas como
              mucho, guarda el resumen y borra la conversación entera.
     traer    al empezar: los últimos resúmenes, para poder decir
              «el jueves me dijiste que la notaría era el 15».
     borrar   el botón: borra la conversación y los resúmenes.

   Sin cuenta abierta, o si el servidor todavía no sabe hacer esto,
   NO SE GUARDA NADA y esta pieza se queda quieta: no hay plan B en el
   navegador, a propósito.

   Lo que se guarda es lo que dice ella y lo que contesta la
   secretaria. No se guardan las frases de relleno («un momento, que
   lo miro») ni el saludo del principio.
   ============================================================ */

export const MEMORIA = Object.freeze({
  RUTA: "/conversacion",        /* no acaba en /hablar: un servidor viejo contesta «no has escrito nada» y no llama a la IA */
  ESPERA_GUARDAR_MS: 2000,      /* el almacén no quiere más de una escritura por segundo en la misma llave */
  TOPE_LINEAS: 400
});

export function crearMemoria({ pedir = null, reloj = { poner: (f, ms) => setTimeout(f, ms), quitar: (id) => clearTimeout(id) }, ahora = () => new Date() } = {}) {
  let activa = false;           /* solo cuando el servidor ha dicho que sabe hacerlo */
  let lineas = [];
  let relojGuardar = null;
  let guardando = null;
  let cerrada = false;
  let dias = null;
  const pendientes = new Map();  /* turno -> trozos de la respuesta de la secretaria */

  async function traer() {
    if (!pedir) return { ok: false, sinCuenta: true, resumenes: [] };
    let d;
    try { d = await pedir(MEMORIA.RUTA, { conversacion: "traer" }); } catch (e) { d = { error: "sin conexión" }; }
    activa = !!(d && d.ok && Array.isArray(d.resumenes));
    if (activa) dias = d.dias_resumen || null;
    return activa ? { ok: true, resumenes: d.resumenes, guardados: d.guardados || 0, tarde: d.resumen_tarde || null, dias }
                  : { ok: false, error: (d && d.error) || "el servidor no guarda conversaciones", resumenes: [] };
  }

  function programar() {
    if (!activa) return;
    if (relojGuardar) reloj.quitar(relojGuardar);
    relojGuardar = reloj.poner(() => { relojGuardar = null; guardarYa(); }, MEMORIA.ESPERA_GUARDAR_MS);
  }

  async function guardarYa() {
    if (!activa || !lineas.length) return { ok: false, nada: true };
    if (relojGuardar) { reloj.quitar(relojGuardar); relojGuardar = null; }
    const copia = lineas.slice(-MEMORIA.TOPE_LINEAS);
    guardando = pedir(MEMORIA.RUTA, { conversacion: "guardar", lineas: copia }).catch(() => ({ error: "sin conexión" }));
    const d = await guardando;
    guardando = null;
    return d;
  }

  function apuntar(quien, texto) {
    const t = String(texto || "").trim();
    if (!t) return;
    if (cerrada) { cerrada = false; lineas = []; }   /* después de despedirse, lo nuevo es otra conversación */
    lineas.push({ quien: quien === "secretaria" ? "secretaria" : "ella", texto: t, cuando: ahora().toISOString() });
    if (lineas.length > MEMORIA.TOPE_LINEAS) lineas = lineas.slice(-MEMORIA.TOPE_LINEAS);
    programar();
  }

  /* Lo que va diciendo la secretaria llega a trozos; se junta por
     turno y se apunta entero cuando el turno acaba. */
  function trozoDeLaSecretaria(turno, texto, tipo) {
    if (tipo === "relleno") return;
    const l = pendientes.get(turno) || [];
    l.push(String(texto || ""));
    pendientes.set(turno, l);
  }
  function finDeTurno(turno, motivo) {
    const l = pendientes.get(turno);
    pendientes.delete(turno);
    if (!l || motivo === "saludo") return;
    apuntar("secretaria", l.join(" "));
  }
  function soltarPendientes() {
    for (const [turno] of pendientes) finDeTurno(turno, "cortado");
  }

  /* AL TERMINAR. alIrse = la ventana se está cerrando: se manda con
     keepalive para que llegue aunque la página ya no esté. */
  async function cerrar({ alIrse = false } = {}) {
    soltarPendientes();
    if (!activa || cerrada || !lineas.length) return { ok: false, nada: true };
    if (relojGuardar) { reloj.quitar(relojGuardar); relojGuardar = null; }
    cerrada = true;
    const copia = lineas.slice(-MEMORIA.TOPE_LINEAS);
    let d;
    try { d = await pedir(MEMORIA.RUTA, { conversacion: "resumir", lineas: copia }, { alIrse }); } catch (e) { d = { error: "sin conexión" }; }
    if (d && d.ok) lineas = [];
    return d;
  }

  async function borrar() {
    if (!pedir) return { ok: false, sinCuenta: true };
    if (relojGuardar) { reloj.quitar(relojGuardar); relojGuardar = null; }
    if (guardando) { try { await guardando; } catch (e) {} }   /* que no llegue un guardado DESPUÉS de borrar */
    lineas = [];
    pendientes.clear();
    let d;
    try { d = await pedir(MEMORIA.RUTA, { conversacion: "borrar" }); } catch (e) { d = { error: "sin conexión" }; }
    return d;
  }

  return {
    traer, apuntar, trozoDeLaSecretaria, finDeTurno, guardarYa, cerrar, borrar,
    activa: () => activa,
    dias: () => dias,
    lineas: () => lineas.slice()
  };
}
