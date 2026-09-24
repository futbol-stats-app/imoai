/* ==================================================================
   IMMO IA · wow/ocr/ocr_local.js — LEER LO ESCANEADO, SIN SALIR DE AQUÍ
   ------------------------------------------------------------------
   Lee letra a letra las fotos y los PDF escaneados de la carpeta que
   ella suelta, DENTRO DEL NAVEGADOR. El motor es tesseract.js (licencia
   Apache 2.0), y todas sus piezas se sirven desde esta misma carpeta
   (wow/ocr/): el propio motor, su trabajador, el núcleo wasm y el
   idioma. Nada viene de un CDN y nada sale del ordenador.

   Este fichero NO se carga con la página. Lo pide lector_carpeta.js
   la primera vez que aparece una foto o un PDF sin texto. Si en la
   carpeta no hay nada de eso, ni se descarga.

   LAS PIEZAS QUE TIENEN QUE ESTAR AL LADO (las pone el montaje; ver
   LICENCIAS.txt y PONER_EL_MOTOR.mjs del taller S3):
     wow/ocr/tesseract.min.js           el motor (define window.Tesseract)
     wow/ocr/worker.min.js              su trabajador (hilo aparte)
     wow/ocr/nucleo/tesseract-core-*lstm.wasm.js   el núcleo
     wow/ocr/idiomas/spa.traineddata.gz el español

   Si falta cualquiera, esto NO se inventa nada: dice que no ha podido
   arrancar el lector de imágenes y La Secretaria sigue como antes,
   contando esos papeles como no leídos.

   AQUÍ NO HAY NI UN fetch NI UN XHR. Lo único que se pide son las
   piezas de arriba, a la misma dirección de la que ha venido la web.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.0";

  /* De dónde ha venido este fichero. Todas las piezas se piden a esa
     misma dirección: si la web está en inmoiaallhouse.com, se piden a
     inmoiaallhouse.com. Nunca a otro sitio. */
  var AQUI = (function () {
    try {
      var s = raiz && raiz.document && raiz.document.currentScript;
      if (s && s.src) return s.src.replace(/[^\/]*$/, "");
    } catch (e) { }
    return "";
  })();

  var IDIOMAS = "spa";              /* «spa+eng» si el montaje pone también el inglés */
  var LADO_MAXIMO = 2600;           /* píxeles del lado largo de la hoja que se lee */
  var LADO_MINIMO = 1400;           /* por debajo, se agranda (hasta el doble) */
  var TIEMPO_MAXIMO_POR_HOJA = 120000;   /* 2 minutos por hoja y se abandona */
  var TIEMPO_MAXIMO_PARA_ARRANCAR = 90000;
  /* Una palabra que el motor lee con menos de esta seguridad NO entra en
     el texto: se cambia por «…». Así una fecha mal leída no se convierte
     en un plazo inventado. */
  var SEGURIDAD_MINIMA_POR_PALABRA = 55;

  var motor = null;           /* promesa del trabajador de tesseract, uno solo */
  var motorRoto = null;       /* por qué no arranca, si no arranca: no se reintenta en cada papel */
  var cola = Promise.resolve();
  var quienEscucha = null;    /* a quién se le cuenta el progreso del papel de ahora */

  /* ------------------------------------------------------------------
     1. ¿SE PUEDE?
     ------------------------------------------------------------------ */
  function porQueNoPuedo() {
    if (!raiz || !raiz.document) return "aquí no hay navegador";
    try {
      if (raiz.location && raiz.location.protocol === "file:") {
        return "la página está abierta con doble clic desde el disco, y así el navegador no deja " +
               "arrancar el lector de imágenes; para leerlas hay que abrirla desde la web";
      }
    } catch (e) { }
    if (typeof raiz.Worker !== "function") return "este navegador no deja trabajar en segundo plano";
    if (typeof raiz.WebAssembly !== "object") return "este navegador no tiene WebAssembly";
    if (!AQUI) return "no sé desde dónde se ha cargado el lector de imágenes";
    if (motorRoto) return motorRoto;
    return null;
  }

  function cargarScript(url, tiempo) {
    return new Promise(function (ok, mal) {
      var d = raiz.document;
      var s = d.createElement("script");
      var reloj = setTimeout(function () { mal(new Error("tarda demasiado en llegar")); }, tiempo || 30000);
      s.src = url;
      s.async = true;
      s.onload = function () { clearTimeout(reloj); ok(); };
      s.onerror = function () { clearTimeout(reloj); mal(new Error("no está en su sitio (" + url.replace(AQUI, "wow/ocr/") + ")")); };
      (d.head || d.documentElement).appendChild(s);
    });
  }

  function conTiempo(promesa, ms, alPasarse) {
    return new Promise(function (ok, mal) {
      var reloj = setTimeout(function () {
        try { if (alPasarse) alPasarse(); } catch (e) { }
        mal(new Error("se ha pasado de " + Math.round(ms / 1000) + " segundos"));
      }, ms);
      promesa.then(function (r) { clearTimeout(reloj); ok(r); },
                   function (e) { clearTimeout(reloj); mal(e); });
    });
  }

  /* ------------------------------------------------------------------
     2. EL MOTOR: UNO SOLO, EN SU HILO, Y SOLO CUANDO HACE FALTA
     ------------------------------------------------------------------ */
  function arrancar() {
    if (motor) return motor;
    var no = porQueNoPuedo();
    if (no) return Promise.reject(new Error(no));
    var p = (raiz.Tesseract ? Promise.resolve() : cargarScript(AQUI + "tesseract.min.js", 30000))
      .then(function () {
        var T = raiz.Tesseract;
        if (!T || typeof T.createWorker !== "function") throw new Error("el motor de lectura no está en su sitio");
        return conTiempo(Promise.resolve(T.createWorker(IDIOMAS, 1, {
          workerPath: AQUI + "worker.min.js",
          corePath: AQUI + "nucleo/",
          langPath: AQUI + "idiomas/",
          gzip: true,
          cacheMethod: "none",          /* ni guarda el idioma en su disco ni lo busca fuera */
          workerBlobURL: false,         /* el trabajador se pide tal cual, a esta misma web */
          logger: function (m) {
            if (quienEscucha && m && typeof m.progress === "number") {
              try { quienEscucha(m.status || "", m.progress); } catch (e) { }
            }
          }
        })), TIEMPO_MAXIMO_PARA_ARRANCAR);
      });
    motor = p;
    p.catch(function (e) {
      motor = null;
      motorRoto = (e && e.message) || "error";
    });
    return p;
  }

  function parar() {
    var m = motor;
    motor = null;
    if (!m) return Promise.resolve();
    return m.then(function (w) { try { return w.terminate(); } catch (e) { } }, function () { });
  }

  /* Las palabras con su seguridad, venga el resultado como venga
     (tesseract.js 5 las da en data.words; el 6, dentro de data.blocks). */
  function palabrasDe(data) {
    if (data && Array.isArray(data.words) && data.words.length) return [data.words];
    var lineas = [];
    (data && data.blocks || []).forEach(function (b) {
      (b.paragraphs || []).forEach(function (p) {
        (p.lines || []).forEach(function (l) { if (l.words && l.words.length) lineas.push(l.words); });
      });
    });
    return lineas;
  }

  function limpiar(data) {
    var lineas = palabrasDe(data);
    var total = 0, buenas = 0, quitadas = 0, suma = 0;
    var texto;
    if (lineas.length) {
      texto = lineas.map(function (ws) {
        return ws.map(function (w) {
          var t = String(w.text || "").trim();
          if (!t) return "";
          total++;
          var c = typeof w.confidence === "number" ? w.confidence : 0;
          suma += c;
          if (c < SEGURIDAD_MINIMA_POR_PALABRA) { quitadas++; return "…"; }
          if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}|\d{2,}/.test(t)) buenas++;
          return t;
        }).join(" ");
      }).join("\n");
    } else {
      /* sin palabras sueltas no hay forma de quitar las dudosas: solo se
         acepta el texto entero si el motor está muy seguro de todo él */
      texto = (data && typeof data.confidence === "number" && data.confidence >= 80) ? String(data.text || "") : "";
      suma = data && data.confidence || 0; total = texto ? 1 : 0;
      buenas = (texto.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/g) || []).length;
    }
    texto = texto.replace(/(?:…\s*){2,}/g, "… ").replace(/[ \t]+/g, " ").trim();
    var media = typeof (data && data.confidence) === "number" ? data.confidence
                : (total ? suma / total : 0);
    return { texto: texto, confianza: Math.round(media), palabras: total,
             palabras_buenas: buenas, palabras_quitadas: quitadas };
  }

  /* Leer UNA hoja (una imagen ya preparada, en Blob). Todo pasa por la
     cola: un papel detrás de otro, nunca dos a la vez. */
  function leerHoja(blob, alAvanzar) {
    var trabajo = cola.then(function () { return arrancar(); }).then(function (w) {
      quienEscucha = alAvanzar || null;
      return conTiempo(w.recognize(blob, {}, { text: true, blocks: true }), TIEMPO_MAXIMO_POR_HOJA,
                       function () { parar(); });
    }).then(function (r) {
      quienEscucha = null;
      return limpiar(r && r.data);
    }, function (e) { quienEscucha = null; throw e; });
    cola = trabajo.catch(function () { });
    return trabajo;
  }

  /* ------------------------------------------------------------------
     3. PREPARAR LA HOJA: FOTO O PÁGINA DE PDF → IMAGEN DE TAMAÑO SENSATO
     ------------------------------------------------------------------ */
  function lienzo(w, h) {
    var c = raiz.document.createElement("canvas");
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    var x = c.getContext("2d");
    x.fillStyle = "#ffffff";                 /* lo transparente, en blanco: el negro no se lee */
    x.fillRect(0, 0, c.width, c.height);
    return { c: c, x: x };
  }
  function aBlob(c) {
    return new Promise(function (ok, mal) {
      c.toBlob(function (b) {
        c.width = 1; c.height = 1;           /* se suelta la memoria del lienzo ya */
        if (b) ok(b); else mal(new Error("no he podido preparar la imagen"));
      }, "image/png");
    });
  }
  function escala(w, h) {
    var lado = Math.max(w, h);
    if (lado > LADO_MAXIMO) return LADO_MAXIMO / lado;
    if (lado < LADO_MINIMO) return Math.min(2, LADO_MINIMO / lado);
    return 1;
  }

  function decodificar(file) {
    if (typeof raiz.createImageBitmap === "function") {
      return raiz.createImageBitmap(file, { imageOrientation: "from-image" })
        .catch(function () { return raiz.createImageBitmap(file); });
    }
    return Promise.reject(new Error("este navegador no sabe abrir imágenes para leerlas"));
  }

  function hojaDeFoto(file) {
    return decodificar(file).then(function (bmp) {
      var k = escala(bmp.width, bmp.height);
      var l = lienzo(bmp.width * k, bmp.height * k);
      l.x.drawImage(bmp, 0, 0, l.c.width, l.c.height);
      try { bmp.close(); } catch (e) { }
      return aBlob(l.c);
    });
  }

  /* ------------------------------------------------------------------
     4. LO QUE SE LE PIDE DESDE FUERA
     ------------------------------------------------------------------ */

  /* Una foto entera. */
  function leerFoto(file, alAvanzar) {
    var no = porQueNoPuedo();
    if (no) return Promise.reject(new Error(no));
    return hojaDeFoto(file).then(function (b) {
      return leerHoja(b, function (que, p) { if (alAvanzar) alAvanzar(1, 1, p); });
    }, function () {
      var e = new Error("no_se_abre");
      e.no_se_abre = true;
      throw e;
    }).then(function (r) { r.paginas_leidas = 1; r.paginas_total = 1; return r; });
  }

  /* EL PDF.JS DE LA WEB (5.7) PINTA LAS PÁGINAS CON Map.getOrInsertComputed,
     una función de JavaScript tan nueva que el Chromium de las pruebas
     (141) todavía no la trae: sin ella, pintar una página revienta con
     «getOrInsertComputed is not a function». Leer el texto no la usa,
     por eso hasta hoy no se había visto. Se pone aquí, SOLO si falta,
     exactamente como la define la norma (propuesta «upsert» de TC39), y
     solo antes de pintar. No cambia nada de lo que ya funcionaba. */
  function ponerLoQueFaltaParaPintar() {
    [raiz.Map, raiz.WeakMap].forEach(function (C) {
      if (!C || !C.prototype) return;
      var P = C.prototype;
      if (typeof P.getOrInsert !== "function") {
        Object.defineProperty(P, "getOrInsert", { configurable: true, writable: true, value: function (k, v) {
          if (this.has(k)) return this.get(k);
          this.set(k, v); return v;
        } });
      }
      if (typeof P.getOrInsertComputed !== "function") {
        Object.defineProperty(P, "getOrInsertComputed", { configurable: true, writable: true, value: function (k, f) {
          if (this.has(k)) return this.get(k);
          var v = f(k); this.set(k, v); return v;
        } });
      }
    });
  }

  /* Un PDF sin capa de texto: se pintan sus primeras páginas con el
     pdf.js que ya tiene la web y se leen como fotos. */
  function leerPdfEscaneado(file, cuantas, alAvanzar) {
    var no = porQueNoPuedo();
    if (no) return Promise.reject(new Error(no));
    if (!raiz.pdfjsLib) return Promise.reject(new Error("el lector de PDF no está cargado en esta página"));
    ponerLoQueFaltaParaPintar();
    var doc = null, trozos = [], sumaConf = 0, n = 0, palabras = 0, buenas = 0, quitadas = 0;
    return file.arrayBuffer().then(function (buf) {
      return raiz.pdfjsLib.getDocument({
        data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true,
        useSystemFonts: false, cMapUrl: null, standardFontDataUrl: null, wasmUrl: null, verbosity: 0
      }).promise;
    }).then(function (d) {
      doc = d;
      n = Math.min(d.numPages, cuantas);
      var cad = Promise.resolve();
      for (var i = 1; i <= n; i++) {
        (function (p) {
          cad = cad.then(function () { return d.getPage(p); }).then(function (pg) {
            var v1 = pg.getViewport({ scale: 1 });
            var k = Math.min(3, Math.max(1, 2200 / Math.max(v1.width, v1.height)));
            var v = pg.getViewport({ scale: k });
            var l = lienzo(v.width, v.height);
            return pg.render({ canvasContext: l.x, viewport: v }).promise.then(function () {
              try { pg.cleanup(); } catch (e) { }
              return aBlob(l.c);
            });
          }).then(function (b) {
            return leerHoja(b, function (que, pr) { if (alAvanzar) alAvanzar(p, n, pr); });
          }).then(function (r) {
            if (r.texto) trozos.push(r.texto);
            sumaConf += r.confianza * Math.max(1, r.palabras);
            palabras += r.palabras; buenas += r.palabras_buenas; quitadas += r.palabras_quitadas;
          });
        })(i);
      }
      return cad;
    }).then(function () {
      var total = doc ? doc.numPages : 0;
      try { if (doc) doc.destroy(); } catch (e) { }
      return { texto: trozos.join("\n").trim(),
               confianza: Math.round(palabras ? sumaConf / palabras : 0),
               palabras: palabras, palabras_buenas: buenas, palabras_quitadas: quitadas,
               paginas_leidas: n, paginas_total: total };
    }, function (e) {
      try { if (doc) doc.destroy(); } catch (x) { }
      throw e;
    });
  }

  var API = {
    version: VERSION,
    idiomas: IDIOMAS,
    SEGURIDAD_MINIMA_POR_PALABRA: SEGURIDAD_MINIMA_POR_PALABRA,
    porQueNoPuedo: porQueNoPuedo,
    leerFoto: leerFoto,
    leerPdfEscaneado: leerPdfEscaneado,
    terminar: parar,
    _limpiar: limpiar,
    _dondeEstoy: function () { return AQUI; }
  };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_OCR = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
