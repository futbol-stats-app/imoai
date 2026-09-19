/* ============================================================
   primer_minuto/cinta.js  ·  LA CONVERSACIÓN, RODANDO EN TEXTO

   PRIMER MINUTO · 18/09/2026. No es un chat: aquí no se escribe,
   se lee. Cada cosa que dice ella y cada cosa que contesta la
   secretaria se añade abajo, con su hora, y la pantalla baja sola.
   Sirve para tres cosas: si la voz falla el texto sigue, se puede
   releer lo de hace un minuto, y deja el rastro escrito.

   Solo usa createElement / appendChild / textContent: nada de
   innerHTML, así que lo que se dice no puede colar código.
   ============================================================ */

function hora(d) {
  const h = d.getHours(), m = d.getMinutes();
  return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
}

export function crearCinta({ documento, contenedor, bajar = () => {}, ahora = () => new Date() }) {
  const porTurno = new Map();
  const apuntadas = [];     /* lo mismo que se ve, para poder comprobarlo */

  function linea(quien, texto) {
    const p = documento.createElement("p");
    p.className = "linea " + (quien === "ella" ? "de-ella" : "de-secretaria");
    const q = documento.createElement("span");
    q.className = "quien";
    q.textContent = (quien === "ella" ? "Tú" : "Secretaria") + " · " + hora(ahora());
    const t = documento.createElement("span");
    t.className = "dicho";
    if (texto) t.textContent = texto;
    p.appendChild(q);
    p.appendChild(t);
    const parcial = documento.getElementById("parcial-yo");
    if (parcial && parcial.parentNode === contenedor) contenedor.insertBefore(p, parcial);
    else contenedor.appendChild(p);
    bajar();
    return { p, t };
  }

  /* lo que dice ella, ya entendido entero */
  function deElla(texto) {
    parcial("");
    const l = linea("ella", String(texto || ""));
    apuntadas.push({ quien: "ella", texto: String(texto || "") });
    return l.p;
  }

  /* lo que contesta la secretaria llega a trozos: van a la misma línea */
  function deLaSecretaria(turno, texto, tipo) {
    let l = porTurno.get(turno);
    if (!l) {
      l = linea("secretaria", "");
      l.i = apuntadas.push({ quien: "secretaria", texto: "" }) - 1;
      porTurno.set(turno, l);
    }
    const s = documento.createElement("span");
    s.className = "fr-" + (tipo || "respuesta");
    s.textContent = (l.t.childNodes.length ? " " : "") + texto;
    l.t.appendChild(s);
    apuntadas[l.i].texto = (apuntadas[l.i].texto ? apuntadas[l.i].texto + " " : "") + texto;
    bajar();
    return l.p;
  }

  /* lo que va entendiendo mientras ella habla, en gris, y se cambia */
  function parcial(texto) {
    let p = documento.getElementById("parcial-yo");
    if (!texto) { if (p && p.parentNode) p.parentNode.removeChild(p); return; }
    if (!p) {
      p = documento.createElement("p");
      p.className = "parcial";
      p.id = "parcial-yo";
      contenedor.appendChild(p);
    }
    p.textContent = texto;
    bajar();
  }

  /* LA IDA Y VUELTA 18/09. La han cortado a media frase: la línea se marca,
     para que se vea que la ha cortado ella y no que se ha perdido algo. */
  function marcarCortada(turno) {
    const l = porTurno.get(turno);
    if (!l || !l.p || l.p.classList.contains("cortada")) return false;
    l.p.classList.add("cortada");
    if (apuntadas[l.i]) apuntadas[l.i].cortada = true;
    return true;
  }

  return { deElla, deLaSecretaria, parcial, marcarCortada, apuntadas: () => apuntadas.map((x) => Object.assign({}, x)) };
}
