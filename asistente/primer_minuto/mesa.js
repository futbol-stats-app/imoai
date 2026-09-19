/* ============================================================
   primer_minuto/mesa.js  ·  LO SUYO, TRAÍDO DE SU CUENTA

   PRIMER MINUTO · 18/09/2026. Lo que hace:
     1. Saber de qué oficina es este ordenador, sin pedir nada: la
        llave de paso está donde la deja oficina.js
        («immoia.oficina.cuenta.v1»), o llega en el enlace que abre el
        botón «2_ABRIR_SU_MESA_EL_LUNES» (detrás de «#», que el
        navegador no manda a ningún servidor) y se guarda ahí.
     2. Traer de SU cuenta del servidor sus expedientes (la cartera)
        y «Lo que llevas esta semana» (la mesa).
     3. Pasarle los expedientes a repaso.js, el de verdad, y preparar
        el saludo y las dos fichas que se le ponen delante a la
        secretaria: el repaso y lo que hablasteis la última vez.

   Aquí NO hay ningún formulario, y es a propósito: si este
   ordenador no tiene la cuenta abierta, se dice en una frase y ya.
   ============================================================ */

export const LLAVE_CUENTA = "immoia.oficina.cuenta.v1";   /* la misma que oficina.js */
export const MARCA_REPASO = "[EL REPASO DE LA CARTERA";
export const MARCA_ULTIMA_VEZ = "[LO QUE HABLAMOS LA ULTIMA VEZ";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function hoyLocal(d = new Date()) {
  const m = d.getMonth() + 1, x = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (x < 10 ? "0" : "") + x;
}

/* «el jueves 17 de septiembre», para decir cuándo se habló */
export function diaEnPalabras(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso || ""))) return "";
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
  return "el " + DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()];
}

/* ---------- 1. de quién es este ordenador ---------- */
function sano(c) {
  return !!(c && typeof c === "object" && c.usuario && c.sesion &&
            (!c.sesion_vence || Date.parse(c.sesion_vence) > Date.now()));
}

export function leerCuenta(almacen) {
  try {
    const c = JSON.parse(almacen.getItem(LLAVE_CUENTA) || "null");
    return sano(c) ? { usuario: String(c.usuario), id: c.id || null, sesion: String(c.sesion), sesion_vence: c.sesion_vence || null } : null;
  } catch (e) { return null; }
}

function deBase64url(s) {
  const b = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const relleno = b + "===".slice((b.length + 3) % 4);
  const bin = atob(relleno);
  const bytes = new Uint8Array([...bin].map((ch) => ch.charCodeAt(0)));
  return new TextDecoder().decode(bytes);
}

/* La llave que trae el enlace del botón del lunes. Se guarda en el
   mismo sitio que oficina.js y se quita de la barra de direcciones.
   Si este ordenador ya tiene abierta OTRA oficina, no se cambia: se
   dice, y se sigue con la que había. */
export function tomarLlaveDelEnlace({ location, history, almacen }) {
  const h = String((location && location.hash) || "");
  if (h.indexOf("#llave=") !== 0) return { hay: false };
  let c = null;
  try { c = JSON.parse(deBase64url(h.slice(7))); } catch (e) { c = null; }
  try { history.replaceState(null, "", String(location.href).split("#")[0]); } catch (e) {}
  if (!sano(c)) return { hay: true, valida: false };
  const ya = leerCuenta(almacen);
  if (ya && ya.usuario !== c.usuario) return { hay: true, valida: true, ignorada: true, porque: "este ordenador ya tiene abierta otra oficina" };
  const guardar = { usuario: String(c.usuario), id: c.id || null, sesion: String(c.sesion), sesion_vence: c.sesion_vence || null };
  try { almacen.setItem(LLAVE_CUENTA, JSON.stringify(guardar)); } catch (e) {}
  return { hay: true, valida: true, cuenta: guardar };
}

/* ---------- 2. hablar con su cuenta ---------- */
export function pedidor({ api, codigo, cuenta, fetchFn }) {
  return async function pedir(ruta, cuerpo, { alIrse = false } = {}) {
    const todo = Object.assign({ codigo, usuario: cuenta.usuario, sesion: cuenta.sesion }, cuerpo);
    const r = await fetchFn(String(api).replace(/\/$/, "") + ruta, {
      method: "POST",
      /* texto plano: así el navegador no hace la pregunta previa y
         vale también al cerrar la ventana (keepalive). El servidor lee
         el cuerpo como texto y lo convierte él. */
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(todo),
      keepalive: !!alIrse
    });
    let d = {};
    try { d = await r.json(); } catch (e) { d = { error: "El servidor ha contestado algo raro." }; }
    d = d || {};
    d.__estado = r.status;
    return d;
  };
}

export async function traerLoSuyo(pedir) {
  const [c, m] = await Promise.all([
    pedir("/hablar", { oficina_accion: "leer" }).catch(() => ({ error: "sin conexión" })),
    pedir("/hablar", { memoria: "leer" }).catch(() => ({ error: "sin conexión" }))
  ]);
  return {
    ok: !!(c && c.ok),
    caducada: !!(c && c.__estado === 401 && c.entrada === "no"),
    error: c && !c.ok ? (c.error || "no he podido traerlo") : null,
    cartera: c && c.ok && c.hay ? c.datos : null,
    mesa: m && typeof m.texto === "string" ? m.texto : ""
  };
}

/* ---------- 3. de la cartera a lo que lee repaso.js ---------- */
export function carteraAExpedientes(C) {
  if (!C || !C.exp) return [];
  const orden = (Array.isArray(C.orden) ? C.orden : Object.keys(C.exp)).filter((k) => C.exp[k]);
  return orden.map((k) => {
    const x = C.exp[k];
    if (!x || x.cerrado) return null;
    const g = x.guardado || {}, f = g.ficha || {};
    return {
      expediente_id: f.expediente_id || k,
      nombre: x.nombre || null,
      es_test: f.es_ejemplo === true,
      vivienda: { via: f.via || f.direccion || null, piso: f.piso || null, municipio: f.municipio || null },
      propietario: { nombre: f.propietario || null },
      tipo_operacion: f.operacion || f.tipo_operacion || null,
      documentos: Array.isArray(f.documentos) ? f.documentos : (Array.isArray(g.documentos) ? g.documentos : []),
      ultimo_movimiento: { fecha: f.ultimo_movimiento || null, que: f.ultimo_movimiento_que || null }
    };
  }).filter(Boolean);
}

export function repasar(REPASO, expedientes, hoy) {
  return REPASO.repasar(expedientes, hoy);
}

/* El título sale del propio parte: «He mirado tus 4 expedientes» es la
   primera frase que escribe repaso.js. Aquí solo se separa. */
export function partirElParte(r) {
  const lineas = (r && r.parte) ? r.parte.slice() : [];
  const m = /^He mirado tus (\d+) expedientes\.\s*/.exec(lineas[0] || "");
  let cuantos = r ? r.cuantos : 0;
  if (m) { cuantos = Number(m[1]); lineas[0] = lineas[0].slice(m[0].length); if (!lineas[0]) lineas.shift(); }
  const pregunta = lineas.length && /\?$/.test(lineas[lineas.length - 1]) ? lineas.pop() : "";
  return { cuantos, lineas: lineas.map((l) => l.charAt(0).toUpperCase() + l.slice(1)), pregunta };
}

/* Lo que más corre, sin repetir lo que ya dice el parte de arriba. */
export function loQueMasCorre(r, cuantos = 3) {
  const parte = ((r && r.parte) || []).join(" ").toLowerCase();
  const yaDicho = (h) => parte.includes(String(h.donde).toLowerCase()) && parte.includes(String(h.titulo).toLowerCase().slice(0, 25));
  return ((r && r.hallazgos) || []).filter((h) => h.urgencia >= 70 && !yaDicho(h)).slice(0, cuantos)
    .map((h) => ({ donde: h.donde, titulo: h.titulo, detalle: h.detalle, fuente: h.fuente }));
}

/* ---------- 4. las fichas para la secretaria ---------- */
export function fichaDelRepaso(r, expedientes, mesa, hoy) {
  if (!r || !r.cuantos) return null;
  const l = [MARCA_REPASO + " · lo ha hecho la pagina sin IA, con las fechas de sus expedientes · hoy es " + hoy + "]"];
  l.push("PARTE: " + r.parte.join(" "));
  l.push("LO QUE MAS CORRE:");
  /* corta a propósito: va delante en CADA pregunta y cada letra se paga */
  r.hallazgos.slice(0, 5).forEach((h) => l.push("- " + h.donde + ": " + h.titulo + ". " + String(h.detalle).slice(0, 170) + " (" + h.fuente + ")"));
  l.push("SUS EXPEDIENTES: " + expedientes.map((e) => (e.nombre || (e.vivienda && e.vivienda.via) || e.expediente_id) +
    " (" + (e.tipo_operacion || "sin tipo") + ")").join("; "));
  if (expedientes.some((e) => e.es_test)) l.push("OJO: estos expedientes son de EJEMPLO, inventados para la demostracion.");
  if (mesa && mesa.trim()) l.push("LO QUE ELLA TIENE APUNTADO ESTA SEMANA:\n" + mesa.trim().slice(0, 800));
  return l.join("\n");
}

export function fichaDeLaUltimaVez(resumenes) {
  if (!Array.isArray(resumenes) || !resumenes.length) return null;
  const l = [MARCA_ULTIMA_VEZ + " · resumenes guardados en la cuenta de esta oficina]"];
  resumenes.forEach((r) => l.push("Hablado " + diaEnPalabras(r.cuando || r.dia) + ":\n" + r.texto));
  return l.join("\n");
}

/* ---------- 5. el saludo, que se dice en voz ----------
   El aviso de IA es el de configuracion.js, entero hasta «no una
   persona.»; lo demás sale del repaso y del último resumen. */
export function saludo(avisoDeIA, r, resumenes) {
  const primera = (String(avisoDeIA).match(/^[\s\S]*?no una persona\./) || [String(avisoDeIA)])[0].trim();
  if (!r || !r.cuantos) return avisoDeIA;
  const p = partirElParte(r);
  let t = primera + " He mirado tus " + p.cuantos + " expedientes y te lo he dejado escrito en la pantalla.";
  if (p.lineas[0]) t += " " + p.lineas[0];
  const ultimo = Array.isArray(resumenes) && resumenes.length ? resumenes[resumenes.length - 1] : null;
  if (ultimo) {
    const frase = String(ultimo.texto).split("\n")[0].replace(/^[-·•\s]+/, "").trim();
    if (frase) t += " Y de lo que hablamos " + diaEnPalabras(ultimo.cuando || ultimo.dia) + " tengo apuntado: " + frase.replace(/\.?$/, ".");
  }
  return t + " " + (p.pregunta || "¿Por dónde empezamos?");
}
