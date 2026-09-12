/* ============================================================
   papeles.js — QUE LO QUE ESCRIBE LA SECRETARIA SALGA DEL CHAT

   Hasta ahora te lo escribía y ahí se quedaba. Ahora, debajo de
   cada cosa que te escribe, salen tres botones:

     Guardar en Word   ->  te lo baja como documento, listo para
                           rellenar, firmar o imprimir
     Mandar por correo ->  te abre tu correo con el mensaje ya
                           escrito dentro
     Copiar            ->  al portapapeles, para pegarlo donde sea

   No toca nada de lo que ya hay. Si molesta, se borra este
   archivo y todo sigue igual.
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- 1. pinta ---------------- */

  var CSS =
    ".pap{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0 2px;padding-left:2px}" +
    ".pap button{font:inherit;font-size:12.5px;font-weight:600;padding:6px 11px;border:1px solid #CBD9D0;" +
    "border-radius:8px;background:#EDF1EE;color:#13342A;cursor:pointer;line-height:1.2}" +
    ".pap button:hover{background:#DFE8E2}" +
    ".pap .pap-ok{background:#13342A;color:#fff;border-color:#13342A}" +
    ".pap-dicho{font-size:12.5px;color:#635C4B;align-self:center}";

  (function () {
    var e = document.createElement("style");
    e.textContent = CSS;
    document.head.appendChild(e);
  })();

  /* ---------------- 2. limpiar el texto ---------------- */

  function limpio(t) {
    return String(t || "")
      .replace(/\[CASA\s*:\s*[^\]]+\]/gi, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/[*_#`]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /* Papeles que salen todo el rato en una inmobiliaria. Si el texto
     habla de uno, ese es el nombre del archivo y no una frase cortada. */
  var PAPELES = [
    "contrato de arras", "hoja de visita", "nota simple", "encargo de venta",
    "contrato de alquiler", "contrato de arrendamiento", "certificado energetico",
    "certificado de eficiencia energetica", "cedula de habitabilidad",
    "certificado de deuda cero", "hoja de encargo", "carta al propietario",
    "lista de documentos", "plan del dia", "acta de entrega de llaves",
    "modelo 600", "plusvalia municipal", "escritura de compraventa"
  ];

  function sinTildes(s) {
    return String(s).toLowerCase()
      .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
      .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u");
  }

  /* De lo que ha escrito la IA, saca un titulo corto para el archivo. */
  function comoSeLlama(t) {
    /* primero en lo que ha escrito ella; si ahi no sale el nombre del papel,
       en lo ultimo que le hemos pedido nosotros */
    var donde = [sinTildes(limpio(t))];
    var mios = document.querySelectorAll(".cha-yo");
    for (var z = mios.length - 1; z >= 0 && donde.length < 4; z--) {
      donde.push(sinTildes(mios[z].textContent || ""));
    }
    for (var w = 0; w < donde.length; w++) {
      for (var k = 0; k < PAPELES.length; k++) {
        if (donde[w].indexOf(PAPELES[k]) !== -1) {
          return PAPELES[k].charAt(0).toUpperCase() + PAPELES[k].slice(1);
        }
      }
    }
    var m = limpio(t).split("\n").filter(function (l) { return l.trim(); })[0] || "documento";
    m = m.replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g, " ").replace(/\s+/g, " ").trim();
    var pal = m.split(" ").slice(0, 6).join(" ");
    return (pal || "documento").slice(0, 60);
  }

  /* ---------------- 3. guardar como documento de Word ---------------- */

  function aWord(texto, titulo) {
    var cuerpo = limpio(texto)
      .split("\n")
      .map(function (l) {
        if (!l.trim()) return "<p style='margin:0 0 10pt'>&nbsp;</p>";
        return "<p style='margin:0 0 10pt'>" + l
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</p>";
      })
      .join("\n");

    var hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

    var html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      "<head><meta charset='utf-8'><title>" + titulo + "</title>" +
      "<style>@page{size:A4;margin:2.5cm} body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#1B231F}" +
      "h1{font-size:15pt;color:#13342A;margin:0 0 4pt} .pie{font-size:8.5pt;color:#777;margin-top:26pt;border-top:1px solid #ccc;padding-top:8pt}</style>" +
      "</head><body>" +
      "<h1>" + titulo + "</h1>" +
      "<p style='font-size:9.5pt;color:#777;margin:0 0 18pt'>" + hoy + "</p>" +
      cuerpo +
      "<p class='pie'>Preparado con IMMO IA. Revísalo antes de firmarlo o enviarlo.</p>" +
      "</body></html>";

    bajar(new Blob(["﻿" + html], { type: "application/msword" }),
          nombreArchivo(titulo) + ".doc");
  }

  function nombreArchivo(t) {
    return String(t).toLowerCase()
      .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
      .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "documento";
  }

  function bajar(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }


  /* ============================================================
     4 bis. GUARDAR EN PDF

     Lo hacemos aqui a mano, sin bajar nada de fuera, para que
     funcione siempre aunque se caiga internet. Sale un A4 de
     verdad, con sus tildes y sus enes, que es lo que hace falta
     para poder firmarlo luego con el certificado.
     ============================================================ */

  var ANCHO = 595.28, ALTO = 841.89;        /* A4 en puntos */
  var MARGEN = 62;                           /* ~2,2 cm */

  /* Lo que ocupa cada letra en Helvetica (de la 32 a la 126) */
  var W_N = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
    1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
    667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
    333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
    556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var W_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
    975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,
    667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
    333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
    611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

  /* Las letras con tilde miden lo mismo que la letra de debajo */
  var PARECIDA = {
    "á":"a","à":"a","ä":"a","â":"a",
    "é":"e","è":"e","ë":"e","ê":"e",
    "í":"i","ì":"i","ï":"i","î":"i",
    "ó":"o","ò":"o","ö":"o","ô":"o",
    "ú":"u","ù":"u","ü":"u","û":"u",
    "ñ":"n","ç":"c",
    "Á":"A","À":"A","Ä":"A","É":"E","È":"E",
    "Í":"I","Ó":"O","Ú":"U","Ü":"U","Ñ":"N","Ç":"C",
    "¿":"?","¡":"!","º":"o","ª":"a","€":"E",
    "«":"\"","»":"\"","·":".",
    "–":"-","—":"-","‘":"'","’":"'",
    "“":"\"","”":"\"","…":"."
  };

  function anchoLetra(c, negrita) {
    var d = PARECIDA[c] || c;
    var n = d.charCodeAt(0);
    if (n < 32 || n > 126) return 556;
    return (negrita ? W_B : W_N)[n - 32];
  }

  function anchoTexto(t, tam, negrita) {
    var s = 0;
    for (var i = 0; i < t.length; i++) s += anchoLetra(t.charAt(i), negrita);
    return s * tam / 1000;
  }

  /* Parte una linea larga en varias que quepan a lo ancho */
  function partir(linea, tam, negrita, ancho) {
    var palabras = linea.split(" ");
    var fuera = [], actual = "";
    for (var i = 0; i < palabras.length; i++) {
      var prueba = actual ? actual + " " + palabras[i] : palabras[i];
      if (anchoTexto(prueba, tam, negrita) > ancho && actual) {
        fuera.push(actual);
        actual = palabras[i];
      } else {
        actual = prueba;
      }
    }
    if (actual) fuera.push(actual);
    return fuera.length ? fuera : [""];
  }

  /* Pasa el texto a los bytes que entiende el PDF (WinAnsi) */
  var RAROS = {};
  RAROS["€"] = 0x80; RAROS["‘"] = 0x91; RAROS["’"] = 0x92;
  RAROS["“"] = 0x93; RAROS["”"] = 0x94; RAROS["–"] = 0x96;
  RAROS["—"] = 0x97; RAROS["…"] = 0x85; RAROS["•"] = 0x95;

  function aBytesPdf(t) {
    var b = [];
    for (var i = 0; i < t.length; i++) {
      var c = t.charAt(i), n = t.charCodeAt(i);
      if (RAROS[c] !== undefined) { n = RAROS[c]; }
      else if (n > 255) { var p = PARECIDA[c]; n = p ? p.charCodeAt(0) : 63; }
      if (n === 40 || n === 41 || n === 92) b.push(92);   /* ( ) \ */
      b.push(n);
    }
    return b;
  }

  /* Devuelve los bytes del PDF. firma.js usa esto tal cual. */
  function hacerPDF(texto, titulo) {
    var anchoUtil = ANCHO - MARGEN * 2;
    var hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

    /* 1. la lista de renglones */
    var renglones = [];
    var tit = partir(String(titulo), 15, true, anchoUtil);
    for (var a = 0; a < tit.length; a++) renglones.push({ t: tit[a], tam: 15, neg: true, salto: 21 });
    renglones.push({ t: hoy, tam: 9.5, neg: false, salto: 28, gris: true });

    var parrafos = limpio(texto).split("\n");
    for (var i = 0; i < parrafos.length; i++) {
      var p = parrafos[i];
      if (!p.trim()) { renglones.push({ t: "", tam: 11, neg: false, salto: 8 }); continue; }
      var trozos = partir(p.trim(), 11, false, anchoUtil);
      for (var j = 0; j < trozos.length; j++) {
        renglones.push({ t: trozos[j], tam: 11, neg: false, salto: 16.5 });
      }
      renglones.push({ t: "", tam: 11, neg: false, salto: 6 });
    }
    renglones.push({ t: "", tam: 9, neg: false, salto: 16 });
    renglones.push({ t: "Preparado con IMMO IA. Revisalo antes de firmarlo o enviarlo.",
                     tam: 8.5, neg: false, salto: 12, gris: true });

    /* 2. repartidos en paginas */
    var paginas = [], actual = [], y = ALTO - MARGEN;
    for (var k = 0; k < renglones.length; k++) {
      var r = renglones[k];
      if (y - r.salto < MARGEN) { paginas.push(actual); actual = []; y = ALTO - MARGEN; }
      if (r.t) actual.push({ r: r, y: y });
      y -= r.salto;
    }
    if (actual.length) paginas.push(actual);
    if (!paginas.length) paginas = [[]];

    /* 3. el fichero, byte a byte */
    var bytes = [];
    function crudo(s) { for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xFF); }

    var objetos = [], posiciones = [];
    var nPag = paginas.length;
    var idPagina = function (i) { return 5 + i * 2; };
    var idFlujo  = function (i) { return 6 + i * 2; };

    var hijos = [];
    for (var i = 0; i < nPag; i++) hijos.push(idPagina(i) + " 0 R");

    objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objetos[2] = "<< /Type /Pages /Kids [" + hijos.join(" ") + "] /Count " + nPag + " >>";
    objetos[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objetos[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    for (var i = 0; i < nPag; i++) {
      objetos[idPagina(i)] =
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + ANCHO.toFixed(2) + " " + ALTO.toFixed(2) + "] " +
        "/Resources << /Font << /FN 3 0 R /FB 4 0 R >> >> /Contents " + idFlujo(i) + " 0 R >>";
    }

    crudo("%PDF-1.4\n");
    bytes.push(37, 226, 227, 207, 211, 10);   /* la linea de bytes altos */

    var total = 4 + nPag * 2;
    for (var n = 1; n <= total; n++) {
      posiciones[n] = bytes.length;
      if (objetos[n] !== undefined) {
        crudo(n + " 0 obj\n" + objetos[n] + "\nendobj\n");
        continue;
      }
      var pag = paginas[(n - 6) / 2];
      var dentro = [];
      function meter(s) { for (var i = 0; i < s.length; i++) dentro.push(s.charCodeAt(i) & 0xFF); }
      for (var i = 0; i < pag.length; i++) {
        var r = pag[i].r;
        meter("BT\n/" + (r.neg ? "FB" : "FN") + " " + r.tam + " Tf\n");
        meter(r.gris ? "0.46 0.44 0.42 rg\n" : (r.neg ? "0.07 0.20 0.16 rg\n" : "0.10 0.14 0.12 rg\n"));
        meter("1 0 0 1 " + MARGEN + " " + pag[i].y.toFixed(2) + " Tm\n(");
        var bb = aBytesPdf(r.t);
        for (var q = 0; q < bb.length; q++) dentro.push(bb[q]);
        meter(") Tj\nET\n");
      }
      crudo(n + " 0 obj\n<< /Length " + dentro.length + " >>\nstream\n");
      for (var q = 0; q < dentro.length; q++) bytes.push(dentro[q]);
      crudo("\nendstream\nendobj\n");
    }

    var xref = bytes.length;
    crudo("xref\n0 " + (total + 1) + "\n0000000000 65535 f \n");
    for (var n = 1; n <= total; n++) {
      var s = String(posiciones[n]);
      while (s.length < 10) s = "0" + s;
      crudo(s + " 00000 n \n");
    }
    crudo("trailer\n<< /Size " + (total + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");

    return new Uint8Array(bytes);
  }

  function aPdf(texto, titulo) {
    bajar(new Blob([hacerPDF(texto, titulo)], { type: "application/pdf" }),
          nombreArchivo(titulo) + ".pdf");
  }

  /* ---------------- 4. abrir el correo con el mensaje escrito ---------------- */

  function alCorreo(texto, titulo) {
    var cuerpo = limpio(texto);
    /* mailto tiene un limite: si es larguisimo, lo cortamos y avisamos */
    var recorte = "";
    if (cuerpo.length > 1800) {
      recorte = "\n\n(El resto lo tienes en el chat: era muy largo para el correo.)";
      cuerpo = cuerpo.slice(0, 1800);
    }
    var enlace = "mailto:?subject=" + encodeURIComponent(titulo) +
                 "&body=" + encodeURIComponent(cuerpo + recorte);
    window.location.href = enlace;
  }

  /* ---------------- 5. copiar ---------------- */

  function copiar(texto, luego) {
    var t = limpio(texto);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { luego(true); }, function () { viejo(t, luego); });
    } else { viejo(t, luego); }
  }

  function viejo(t, luego) {
    try {
      var a = document.createElement("textarea");
      a.value = t;
      a.style.position = "fixed"; a.style.opacity = "0";
      document.body.appendChild(a);
      a.select();
      var bien = document.execCommand("copy");
      document.body.removeChild(a);
      luego(bien);
    } catch (e) { luego(false); }
  }

  /* ---------------- 6. poner los botones ---------------- */

  function vale(t) {
    var l = limpio(t);
    /* nada de botones en respuestas de dos palabras ni en "Pensando" */
    return l.length >= 120 && l !== "Pensando";
  }

  function ponerBotones(burbuja) {
    if (!burbuja || burbuja.getAttribute("data-pap")) return;
    var texto = burbuja.textContent || "";
    if (!vale(texto)) return;
    burbuja.setAttribute("data-pap", "si");

    var titulo = comoSeLlama(texto);
    var fila = document.createElement("div");
    fila.className = "pap";

    function boton(t, hace) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = t;
      b.addEventListener("click", function (ev) { ev.preventDefault(); hace(b); });
      fila.appendChild(b);
      return b;
    }

    boton("Guardar en PDF", function (b) {
      aPdf(burbuja.textContent, titulo);
      avisar(b, "Guardado");
    });

    boton("Guardar en Word", function (b) {
      aWord(burbuja.textContent, titulo);
      avisar(b, "Guardado");
    });

    boton("Mandar por correo", function () {
      alCorreo(burbuja.textContent, titulo);
    });

    boton("Copiar", function (b) {
      copiar(burbuja.textContent, function (bien) { avisar(b, bien ? "Copiado" : "No he podido"); });
    });

    burbuja.parentNode.insertBefore(fila, burbuja.nextSibling);
  }

  function avisar(b, t) {
    var antes = b.textContent;
    b.textContent = t;
    b.classList.add("pap-ok");
    setTimeout(function () { b.textContent = antes; b.classList.remove("pap-ok"); }, 2200);
  }

  /* ---------------- 7. vigilar el chat ---------------- */

  function repasar() {
    var hilo = document.getElementById("cha-hilo");
    if (!hilo) return;
    var todas = hilo.querySelectorAll(".cha-ella");
    for (var i = 0; i < todas.length; i++) ponerBotones(todas[i]);
  }

  function vigilar() {
    var hilo = document.getElementById("cha-hilo");
    if (!hilo) { setTimeout(vigilar, 700); return; }
    repasar();
    new MutationObserver(function () { setTimeout(repasar, 120); })
      .observe(hilo, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", vigilar);
  else vigilar();

  window.IMMOIA_PAPELES = {
    version: "1.1",
    aWord: aWord,
    aPdf: aPdf,
    pdfBytes: hacerPDF,
    limpio: limpio,
    alCorreo: alCorreo,
    titulo: comoSeLlama,
    repasar: repasar
  };
})();
