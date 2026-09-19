/* ============================================================
   arranque_solo.js  ·  EL PORTERO DE LA PUERTA

   X3 · 18/09/2026. La dirección quitó el botón del micrófono y el
   de enviar: se entra y habla ella. Aquí está, separado de la
   pantalla, lo único que hay que decidir al abrir:

     ¿arranco sola?  ¿pido permiso una vez?  ¿sigo por escrito?

   Está en su propio archivo a propósito: así se puede comprobar
   sin navegador (laboratorio/prueba_sin_botones.mjs) que sale UNA
   sola frase y que no se repite nunca.

   Lo que manda el navegador y no se puede cambiar: ninguna página
   abre el micrófono ni habla sola hasta que la persona ha tocado
   algo alguna vez. Por eso la aplicación se instala en el
   ordenador de la oficina: el permiso se da el día de la
   instalación y a partir de ahí ya está dado.
   ============================================================ */

/* Las frases de la casa. Escritas aquí, no las genera nadie. */
export const FRASES = Object.freeze({
  pedirPermiso:
    "Para poder escucharte necesito el micrófono. Toca una vez en cualquier parte de la pantalla y el navegador te lo preguntará: dile que sí. Solo hace falta la primera vez.",
  permisoNegado:
    "No tengo permiso para usar el micrófono, así que ahora mismo no puedo escucharte. Escríbeme aquí abajo y te contesto igual.",
  sinMicrofono:
    "No encuentro ningún micrófono en este aparato. Escríbeme aquí abajo y te contesto igual.",
  tocaParaOirme:
    "Toca una vez la pantalla y me oyes. Este navegador no me deja sonar hasta que lo haces."
});

/* Lo que puede contestar el navegador cuando se le pregunta por el
   permiso del micrófono. "desconocido" es cuando no sabe contestar
   (Firefox y Safari no siempre contestan): entonces se pide igual. */
export const PERMISOS = Object.freeze(["concedido", "pendiente", "negado", "desconocido"]);

/* Pregunta al navegador si ya hay permiso, sin abrir el micrófono.
   Nunca lanza un error: si no sabe, dice "desconocido". */
export async function mirarPermiso(nav) {
  try {
    if (!nav || !nav.permissions || !nav.permissions.query) return "desconocido";
    const r = await nav.permissions.query({ name: "microphone" });
    if (!r || !r.state) return "desconocido";
    if (r.state === "granted") return "concedido";
    if (r.state === "denied") return "negado";
    return "pendiente";
  } catch (e) {
    return "desconocido";
  }
}

/* ¿Hay micrófono en este aparato? Sin permiso el navegador no dice
   el nombre del aparato, pero sí dice cuántos hay. Si no sabe
   contestar, se da por bueno que lo hay y ya se verá al abrirlo. */
export async function mirarMicrofono(nav) {
  try {
    if (!nav || !nav.mediaDevices || !nav.mediaDevices.getUserMedia) return false;
    if (!nav.mediaDevices.enumerateDevices) return true;
    const lista = await nav.mediaDevices.enumerateDevices();
    if (!Array.isArray(lista) || !lista.length) return true;
    return lista.some((d) => d && d.kind === "audioinput");
  } catch (e) {
    return true;
  }
}

/* LA DECISIÓN. Una sola, y siempre la misma para la misma situación.
   Devuelve: { accion, frase }
     accion "arrancar"      -> abre el oído sola, sin decir nada de esto
     accion "pedir_permiso" -> una frase, una vez, y el primer toque lo abre
     accion "por_escrito"   -> una frase, una vez, y aparece dónde escribir */
export function decidirArranque({ permiso = "desconocido", hayMicrofono = true } = {}) {
  if (!hayMicrofono) return { accion: "por_escrito", frase: FRASES.sinMicrofono };
  if (permiso === "concedido") return { accion: "arrancar", frase: null };
  if (permiso === "negado") return { accion: "por_escrito", frase: FRASES.permisoNegado };
  return { accion: "pedir_permiso", frase: FRASES.pedirPermiso };
}

/* EL PORTERO: se encarga de que una frase no se diga dos veces.
   Cada aviso tiene su nombre; el segundo intento devuelve null. */
export function crearPortero() {
  const dichas = new Set();
  return {
    unaVez(nombre, frase) {
      if (!frase || dichas.has(nombre)) return null;
      dichas.add(nombre);
      return frase;
    },
    yaDicha: (nombre) => dichas.has(nombre),
    cuantas: () => dichas.size
  };
}
