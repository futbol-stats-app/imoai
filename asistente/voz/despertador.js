/* ============================================================
   despertador.js  ·  QUE NO SE APAGUE LA PANTALLA MIENTRAS HABLAMOS

   EL MOVIL · 19/09/2026. La dirección lo probó en un móvil de verdad
   y dijo: «se corta mucho, se queda callado, se apaga el teléfono y
   se corta». Esto es lo primero de las tres cosas: pedirle al
   navegador que NO apague la pantalla mientras se está hablando.

   LO QUE MANDA EL NAVEGADOR, con fuente y fecha (mirado el 19/09/2026):

     · La forma estándar se llama Screen Wake Lock API:
       navigator.wakeLock.request("screen").
     · Safari de iPhone la tiene DESDE iOS 16.4. Antes de esa versión
       NO EXISTE, y no hay ninguna otra forma de pedirlo.
       (caniuse.com/wake-lock, consultado el 19/09/2026)
     · Chrome de Android la tiene desde hace tiempo, y Samsung
       Internet desde la 14. (misma fuente)
     · SOLO funciona con https. Desde un archivo del ordenador, no.
     · Y LO MÁS IMPORTANTE, que es lo que casi todo el mundo se salta:
       EL PERMISO SE SUELTA SOLO EN CUANTO LA PÁGINA SE ESCONDE, y hay
       que volver a pedirlo cuando vuelve. Lo dice la documentación de
       Mozilla con esas palabras: «previously acquired locks are
       automatically released when document becomes inactive».
       (developer.mozilla.org, Screen Wake Lock API, 19/09/2026)
       Por eso aquí se vuelve a pedir en cada «vuelve la página».
     · Se puede rechazar aunque exista: con poca batería, en modo de
       ahorro de energía, o si el aparato dice que no. Cuando pasa eso
       NO SE DISIMULA: sale avisar("no_se_puede", ...) y la pantalla lo
       escribe, que es mejor que quedarse callada.

   Esta pieza no usa el bus ni toca la pantalla: avisa con
   avisar(tipo, datos), como el detector de voz. Así se puede
   comprobar sin navegador.
     avisar("puesto")                 la pantalla ya no se apaga
     avisar("soltado", {porque})      se ha soltado (normal al esconderse)
     avisar("no_se_puede", {porque, codigo})
   ============================================================ */

export const PORQUES = Object.freeze({
  sin_soporte: "Este navegador no sabe impedir que se apague la pantalla. " +
               "En el iPhone hace falta iOS 16.4 o más nuevo.",
  sin_https: "Esto solo se puede pedir en una página segura (https).",
  rechazado: "El aparato no me deja mantener la pantalla encendida. " +
             "Suele ser por el ahorro de batería."
});

export function crearDespertador({ nav = null, doc = null, avisar = () => {} } = {}) {
  const N = nav || (typeof navigator !== "undefined" ? navigator : null);
  const D = doc || (typeof document !== "undefined" ? document : null);

  let permiso = null;        /* el "sentinel" que devuelve el navegador */
  let queremos = false;      /* si lo queremos puesto ahora mismo */
  let yaAvisado = false;     /* el aviso de que no se puede, una sola vez */

  /* ¿existe siquiera en este navegador? */
  function hayApoyo() {
    try { return !!(N && N.wakeLock && typeof N.wakeLock.request === "function"); }
    catch (e) { return false; }
  }

  /* tiene que ser una pagina segura (https) */
  function sitioSeguro() {
    try {
      if (typeof isSecureContext !== "undefined") return !!isSecureContext;
      if (N && typeof N.__seguro === "boolean") return N.__seguro;
      return true;
    } catch (e) { return true; }
  }

  function porQueNo() {
    if (!hayApoyo()) return { codigo: "sin_soporte", porque: PORQUES.sin_soporte };
    if (!sitioSeguro()) return { codigo: "sin_https", porque: PORQUES.sin_https };
    return null;
  }

  async function pedir() {
    if (!queremos) return false;
    if (permiso && !permiso.released) return true;
    const no = porQueNo();
    if (no) {
      if (!yaAvisado) { yaAvisado = true; avisar("no_se_puede", no); }
      return false;
    }
    /* Si la página está escondida, el navegador lo rechaza siempre. No se
       pide: se pedirá solo cuando vuelva, que es lo que hace vigilar(). */
    if (D && D.visibilityState && D.visibilityState !== "visible") return false;
    try {
      permiso = await N.wakeLock.request("screen");
      try {
        permiso.addEventListener("release", () => {
          avisar("soltado", { porque: "el navegador lo ha soltado" });
          permiso = null;
        });
      } catch (e) {}
      avisar("puesto", {});
      return true;
    } catch (e) {
      permiso = null;
      const detalle = (e && (e.name || e.message)) || "no ha podido ser";
      if (!yaAvisado) { yaAvisado = true; avisar("no_se_puede", { codigo: "rechazado", porque: PORQUES.rechazado, detalle }); }
      return false;
    }
  }

  async function encender() { queremos = true; return pedir(); }

  async function apagar() {
    queremos = false;
    const p = permiso;
    permiso = null;
    if (!p) return false;
    try { await p.release(); } catch (e) {}
    return true;
  }

  /* SE LLAMA CADA VEZ QUE LA PÁGINA VUELVE A ESTAR VISIBLE.
     Es lo que arregla el caso de verdad: el navegador lo soltó al
     esconderse la página y nadie lo volvía a pedir. */
  async function alVolver() {
    if (!queremos) return false;
    return pedir();
  }

  return {
    encender, apagar, alVolver,
    hayApoyo,
    porQueNo,
    puesto: () => !!(permiso && !permiso.released),
    loQueremos: () => queremos
  };
}
