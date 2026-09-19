/* ============================================================
   PIEZA 2 \u00b7 buscador.js
   Busca en los archivos guardados y devuelve trozos cortos.

   Solo funciones puras (sin pantalla, sin red): las usa el
   trabajador en segundo plano, y tambien se pueden probar solas.

   REGLA DE ORO: no reescribe nada. Los trozos que devuelve son
   copias literales del archivo, con su nombre y su posicion, para
   que ninguna cifra cambie por el camino.
   ============================================================ */

const VACIAS = new Set((
  "a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque cada como con contra cual cuales " +
  "cuando de del desde donde dos el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba " +
  "estan estar estas este esto estos fue fueron ha han hasta hay la las le les lo los mas me mi mis mucho muy " +
  "nada ni no nos nosotros o otra otras otro otros para pero poco por porque que quien se sea ser si sin sobre " +
  "son su sus tambien tan tanto te tengo tiene tienen todo todos tu tus un una unas uno unos usted ustedes y ya yo " +
  "dime dame quiero saber puedes podrias cual cuanto cuanta cuantos cuantas"
).split(" "));

export function normalizar(t) {
  return String(t == null ? "" : t)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u00f1]+/g, " ")
    .trim();
}

/* raiz muy sencilla: quita plurales y alguna terminacion comun */
export function raiz(p) {
  if (p.length > 5 && p.endsWith("es")) return p.slice(0, -2);
  if (p.length > 4 && p.endsWith("s")) return p.slice(0, -1);
  return p;
}

export function palabras(t) {
  return normalizar(t).split(" ").filter((p) => p && !VACIAS.has(p)).map(raiz);
}

/* ---------- convertir un archivo en trozos ---------- */

function aplanarJSON(v, prefijo, lineas) {
  if (v === null || v === undefined) return;
  if (Array.isArray(v)) {
    v.forEach((x, i) => aplanarJSON(x, prefijo + "[" + (i + 1) + "]", lineas));
  } else if (typeof v === "object") {
    for (const k of Object.keys(v)) aplanarJSON(v[k], prefijo ? prefijo + "." + k : k, lineas);
  } else {
    lineas.push((prefijo ? prefijo + ": " : "") + String(v));
  }
}

/* un JSON se parte por "cosas": los datos sueltos juntos, y cada
   elemento de una lista (un plazo, un documento...) en su trozo.
   Asi al buscar "firma notaria" sale ESE plazo, con su fecha. */
function gruposJSON(datos) {
  const lineas = [];
  aplanarJSON(datos, "", lineas);
  const grupos = [];
  let clave = null;
  for (const l of lineas) {
    const ruta = l.slice(0, Math.max(0, l.indexOf(": ")));
    const m = /^([^.\[]+)(\[\d+\])?(\.)?/.exec(ruta) || [];
    const k = m[2] && m[3] ? m[1] + m[2] : (m[2] ? m[1] : "__sueltos__");
    if (k !== clave || !grupos.length) { grupos.push([]); clave = k; }
    grupos[grupos.length - 1].push(l);
  }
  return grupos.map((g) => g.join("\n"));
}

export function trocear(nombre, contenido, { maxTrozo = 600 } = {}) {
  let bloques = [];
  let unir = true;
  if (/\.json$/i.test(nombre)) {
    let datos = null;
    try { datos = typeof contenido === "string" ? JSON.parse(contenido) : contenido; } catch (e) { datos = null; }
    if (datos !== null) { bloques = gruposJSON(datos); unir = false; }
    else bloques = String(contenido).split(/\n/);
  } else {
    /* texto o markdown: por parrafos, respetando los titulos */
    bloques = String(contenido).replace(/\r\n/g, "\n").split(/\n\s*\n/);
  }

  const trozos = [];
  let actual = "", titulo = "";
  const soltar = () => {
    const t = actual.trim();
    if (t) trozos.push({ archivo: nombre, n: trozos.length + 1, titulo, texto: t });
    actual = "";
  };
  for (const b0 of bloques) {
    const b = String(b0).trim();
    if (!b) continue;
    if (unir) {
      const cab = /^#{1,6}\s+(.+)$/m.exec(b);
      if (cab && b.startsWith("#")) { soltar(); titulo = cab[1].trim(); }
    } else {
      soltar();
    }
    if ((actual + "\n" + b).length > maxTrozo && actual) soltar();
    if (b.length > maxTrozo) {
      /* un bloque enorme se parte por frases (o por lineas si es un JSON) */
      for (const f of (unir ? partirFrases(b) : b.split("\n"))) {
        if ((actual + " " + f).length > maxTrozo && actual) soltar();
        actual = actual ? actual + (unir ? " " : "\n") + f : f;
      }
    } else {
      actual = actual ? actual + "\n" + b : b;
    }
  }
  soltar();
  return trozos;
}

/* ---------- el indice (BM25) ---------- */

export function crearIndice() {
  const trozos = [];
  const archivos = new Map();   /* nombre -> {titulo, tipo, fecha, caracteres, trozos} */
  let df = new Map();
  let largoMedio = 0;

  function recalcular() {
    df = new Map();
    let suma = 0;
    for (const t of trozos) {
      suma += t.largo;
      for (const p of new Set(t.palabras)) df.set(p, (df.get(p) || 0) + 1);
    }
    largoMedio = trozos.length ? suma / trozos.length : 0;
  }

  function anadir(nombre, contenido, meta = {}) {
    quitar(nombre);
    const nuevos = trocear(nombre, contenido);
    for (const t of nuevos) {
      /* el titulo del archivo cuenta en todos sus trozos ("Adeje" en un plazo de Adeje) */
      t.palabras = palabras((meta.titulo || "") + " " + t.titulo + " " + t.texto);
      t.largo = t.palabras.length || 1;
      trozos.push(t);
    }
    archivos.set(nombre, {
      nombre,
      titulo: meta.titulo || nombre,
      tipo: meta.tipo || (/\.json$/i.test(nombre) ? "datos" : "texto"),
      fecha: meta.fecha || null,
      caracteres: String(typeof contenido === "string" ? contenido : JSON.stringify(contenido)).length,
      trozos: nuevos.length,
      contenido: typeof contenido === "string" ? contenido : JSON.stringify(contenido, null, 1)
    });
    recalcular();
    return nuevos.length;
  }

  function quitar(nombre) {
    if (!archivos.has(nombre)) return;
    for (let i = trozos.length - 1; i >= 0; i--) if (trozos[i].archivo === nombre) trozos.splice(i, 1);
    archivos.delete(nombre);
    recalcular();
  }

  function buscar(consulta, { max = 3, k1 = 1.2, b = 0.75 } = {}) {
    const q = [...new Set(palabras(consulta))];
    if (!q.length || !trozos.length) return [];
    const N = trozos.length;
    const puntos = [];
    for (const t of trozos) {
      let s = 0;
      const tf = new Map();
      for (const p of t.palabras) tf.set(p, (tf.get(p) || 0) + 1);
      for (const p of q) {
        const f = tf.get(p);
        if (!f) continue;
        const n = df.get(p) || 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * t.largo / (largoMedio || 1)));
      }
      if (s > 0) puntos.push({ t, s, acierta: q.filter((p) => tf.has(p)).length });
    }
    puntos.sort((x, y) => y.s - x.s);
    return puntos.slice(0, max).map(({ t, s, acierta }) => ({
      archivo: t.archivo,
      titulo: t.titulo || (archivos.get(t.archivo) || {}).titulo || t.archivo,
      trozo: t.n,
      texto: recortarAlrededor(t.texto, q, 420),
      puntuacion: Math.round(s * 100) / 100,
      palabrasEncontradas: acierta,
      palabrasBuscadas: q.length
    }));
  }

  function leer(nombre, { max = 3000 } = {}) {
    const a = archivos.get(nombre) || [...archivos.values()].find((x) => normalizar(x.nombre) === normalizar(nombre) || normalizar(x.titulo) === normalizar(nombre));
    if (!a) return null;
    const recortado = a.contenido.length > max;
    return {
      archivo: a.nombre, titulo: a.titulo, fecha: a.fecha,
      texto: recortado ? a.contenido.slice(0, max) : a.contenido,
      recortado,
      caracteresTotales: a.contenido.length
    };
  }

  function lista() {
    return [...archivos.values()].map((a) => ({ archivo: a.nombre, titulo: a.titulo, tipo: a.tipo, fecha: a.fecha, trozos: a.trozos, caracteres: a.caracteres }));
  }

  return { anadir, quitar, buscar, leer, lista, cuantos: () => archivos.size, trozos: () => trozos.length };
}

/* parte por final de frase sin "lookbehind" (hay iPhones que no lo entienden) */
export function partirFrases(t) {
  const out = [];
  let act = "";
  for (let i = 0; i < t.length; i++) {
    act += t[i];
    if (".!?".includes(t[i]) && /\s/.test(t[i + 1] || "")) { out.push(act.trim()); act = ""; }
  }
  if (act.trim()) out.push(act.trim());
  return out;
}

/* Deja el trozo corto, centrado donde aparecen las palabras buscadas.
   Solo corta: nunca cambia letras ni numeros. */
export function recortarAlrededor(texto, q, max) {
  if (texto.length <= max) return texto;
  /* misma longitud que el original: cada letra se pasa a minuscula sin tilde */
  const plano = texto.split("").map((c) => c.toLowerCase().normalize("NFD").charAt(0)).join("");
  let pos = -1;
  for (const p of q) {
    const i = plano.indexOf(p);
    if (i >= 0 && (pos < 0 || i < pos)) pos = i;
  }
  if (pos < 0) return texto.slice(0, max) + "\u2026";
  const inicio = Math.max(0, Math.min(texto.length - max, pos - Math.floor(max / 3)));
  let trozo = texto.slice(inicio, inicio + max);
  if (inicio > 0) trozo = "\u2026" + trozo.replace(/^\S*\s/, "");
  if (inicio + max < texto.length) trozo = trozo.replace(/\s\S*$/, "") + "\u2026";
  return trozo;
}
