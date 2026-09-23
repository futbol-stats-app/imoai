/* ==================================================================
   IMMO IA · lector_carpeta.js — LA PUERTA: QUE SUELTE LA CARPETA
   ------------------------------------------------------------------
   Coge una carpeta entera (arrastrada o elegida con el botón) y
   devuelve la lista plana de ficheros que hay dentro, a la profundidad
   que haga falta.

   NADA SALE DE ESTE ORDENADOR. Aquí no hay ni un fetch, ni un XHR, ni
   un WebSocket, ni una imagen remota. Los ficheros se leen con
   FileReader / File.arrayBuffer(), que trabajan contra el disco de
   ella y nunca contra la red.

   Lo que lee de cada fichero:
     · SIEMPRE: nombre, extensión, tamaño, fecha de modificación, ruta.
     · POR DENTRO, si se puede: PDF con texto (pdf.js empotrado), .txt
       .md .csv .json (texto plano) y .docx (zip + deflate del propio
       navegador).
     · POR DENTRO, NO SE PUEDE: PDF escaneado (sin capa de texto),
       fotos (jpg, png, heic...), y cualquier formato que no sea de los
       de arriba. Eso se cuenta aparte y se dice en pantalla con el
       número exacto. Nunca se redondea hacia arriba.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.0";

  /* Umbral de honradez: por debajo de esto NO decimos que lo hemos
     leído. Un PDF escaneado suele devolver 0 caracteres; alguno
     devuelve cuatro basuras del sello de la impresora. */
  var MINIMO_PARA_DECIR_QUE_LO_HE_LEIDO = 40;

  /* Tope de páginas que miramos por PDF. Con las dos primeras hay de
     sobra para saber qué papel es y de qué finca; leer 80 páginas de
     una escritura solo sirve para colgar la pantalla. */
  var PAGINAS_QUE_MIRO = 3;

  /* ------------------------------------------------------------------
     EL TOPE DE TAMAÑO · ARREGLO DEL 20/09/2026
     ------------------------------------------------------------------
     Medido con un navegador de verdad: un fichero de 60 MB se abre y
     todo termina en menos de 15 segundos. Uno de 150 MB MATA LA
     PESTAÑA — no es que tarde: el proceso de la página se muere y sale
     la pantalla de Chrome «Vaya… algo ha ido mal». Con 300 MB, igual.

     Un expediente escaneado entero a color en el escáner de una oficina
     pasa de 150 MB sin esfuerzo, y basta UNO en toda la carpeta para
     tirarlo todo en mitad de la demostración.

     Así que a partir de aquí NO SE ABRE: se cuenta, se dice en pantalla
     cuál era y por qué, y se sigue con los demás. Nunca se cae en
     silencio y nunca se pierde lo que sí se ha podido mirar.

     El tope es 60 MB porque es el último tamaño medido que aguanta.
     Subirlo sin volver a medirlo es apostar.
     ------------------------------------------------------------------ */
  var TOPE_DE_BYTES = 60 * 1024 * 1024;

  function enMegas(b) {
    if (b == null) return "un tamaño que no sé";
    return (b / 1048576).toFixed(0) + " MB";
  }

  var EXT_TEXTO = ["txt", "md", "csv", "json", "xml", "htm", "html", "eml"];
  var EXT_FOTO = ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "heic", "heif", "webp", "avif"];

  function extensionDe(nombre) {
    var n = String(nombre || "");
    var p = n.lastIndexOf(".");
    if (p <= 0) return "";
    return n.slice(p + 1).toLowerCase();
  }

  function esOculto(nombre) {
    var n = String(nombre || "");
    return n.charAt(0) === "." || n.toLowerCase() === "thumbs.db" ||
           n.toLowerCase() === "desktop.ini" || n.charAt(0) === "~";
  }

  /* ------------------------------------------------------------------
     1. RECOGER LOS FICHEROS
     ------------------------------------------------------------------ */

  function ficheroDe(file, ruta, handle) {
    var r = String(ruta || file.name).replace(/\\/g, "/").replace(/^\/+/, "");
    var trozos = r.split("/");
    return {
      id: null,                       /* se pone al final, es el número de orden */
      nombre: file.name,
      ruta: r,
      carpeta: trozos.length > 1 ? trozos.slice(0, -1).join("/") : "",
      carpeta_hoja: trozos.length > 1 ? trozos[trozos.length - 2] : "",
      ext: extensionDe(file.name),
      bytes: file.size,
      modificado: file.lastModified || null,
      file: file,
      handle: handle || null,
      /* se rellena en leerPorDentro() */
      texto: "",
      lectura: "sin intentar",       /* leido | sin_texto | no_se_puede | vacio | error */
      motivo_no_leido: ""
    };
  }

  /* Arrastrar y soltar. Hay que tocar dataTransfer.items EN EL ACTO,
     dentro del propio manejador del drop: si se espera a un await, el
     navegador ya lo ha vaciado. Por eso aquí primero se sacan los
     "entry" de golpe y luego se recorre con calma. */
  function desdeSoltar(dataTransfer) {
    var items = dataTransfer && dataTransfer.items ? Array.prototype.slice.call(dataTransfer.items) : [];
    var entradas = [], sueltos = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind !== "file") continue;
      var e = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
      if (e) entradas.push(e);
      else {
        var f = items[i].getAsFile && items[i].getAsFile();
        if (f) sueltos.push(f);
      }
    }
    if (!entradas.length && !sueltos.length && dataTransfer && dataTransfer.files) {
      sueltos = Array.prototype.slice.call(dataTransfer.files);
    }
    return recorrerEntradas(entradas).then(function (lista) {
      var vacias = lista.vacias || [];
      sueltos.forEach(function (f) { lista.push(ficheroDe(f, f.name, null)); });
      return numerar(lista, vacias);
    });
  }

  function recorrerEntradas(entradas) {
    var salida = [];
    var vacias = [];
    function unaEntrada(entry, prefijo) {
      if (!entry) return Promise.resolve();
      var ruta = prefijo ? prefijo + "/" + entry.name : entry.name;
      if (entry.isFile) {
        if (esOculto(entry.name)) return Promise.resolve();
        return new Promise(function (ok) {
          entry.file(function (f) { salida.push(ficheroDe(f, ruta, null)); ok(); },
                     function () { ok(); });
        });
      }
      if (entry.isDirectory) {
        var lector = entry.createReader();
        var hijos = [];
        function tanda() {
          return new Promise(function (ok) {
            lector.readEntries(function (r) { ok(r); }, function () { ok([]); });
          }).then(function (r) {
            if (!r.length) return hijos;
            hijos = hijos.concat(Array.prototype.slice.call(r));
            return tanda();              /* readEntries devuelve de 100 en 100 */
          });
        }
        return tanda().then(function (h) {
          var antes = salida.length;
          return h.reduce(function (cad, x) {
            return cad.then(function () { return unaEntrada(x, ruta); });
          }, Promise.resolve()).then(function () {
            /* carpeta vacía: ni un fichero debajo, ni en ella ni en sus hijas */
            if (salida.length === antes) vacias.push(ruta);
          });
        });
      }
      return Promise.resolve();
    }
    return entradas.reduce(function (cad, e) {
      return cad.then(function () { return unaEntrada(e, ""); });
    }, Promise.resolve()).then(function () { salida.vacias = vacias; return salida; });
  }

  /* El botón de toda la vida: <input type="file" webkitdirectory>.
     Funciona en Chrome, Edge, Firefox y Safari, pero solo deja LEER. */
  function desdeInput(fileList) {
    var lista = [];
    Array.prototype.slice.call(fileList || []).forEach(function (f) {
      if (esOculto(f.name)) return;
      lista.push(ficheroDe(f, f.webkitRelativePath || f.name, null));
    });
    /* Por el botón de <input webkitdirectory> el navegador NO enseña las
       carpetas vacías: no existen para él. Solo se ven arrastrando o con
       el botón de «Elegir carpeta» de Chrome/Edge. */
    return Promise.resolve(numerar(lista, null));
  }

  /* El botón bueno: showDirectoryPicker(). Solo Chrome y Edge. Además
     de leer, deja escribir, y por eso es el único camino que permite
     ordenar de verdad en su disco. */
  function hayCarpetaDeVerdad() {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  }

  function desdeCarpetaDeVerdad(dirHandle) {
    var salida = [];
    var vacias = [];
    function bajar(h, prefijo) {
      var hijos = [];
      var it = h.entries();
      function siguiente() {
        return it.next().then(function (p) {
          if (p.done) return hijos;
          hijos.push(p.value);
          return siguiente();
        });
      }
      return siguiente().then(function (lista) {
        var antes = salida.length;
        return lista.reduce(function (cad, par) {
          var nombre = par[0], hijo = par[1];
          var ruta = prefijo ? prefijo + "/" + nombre : nombre;
          return cad.then(function () {
            if (esOculto(nombre)) return;
            if (hijo.kind === "file") {
              return hijo.getFile().then(function (f) {
                salida.push(ficheroDe(f, ruta, hijo));
              }, function () { });
            }
            return bajar(hijo, ruta);
          });
        }, Promise.resolve()).then(function () {
          if (prefijo && salida.length === antes) vacias.push(prefijo);
        });
      });
    }
    return bajar(dirHandle, dirHandle.name).then(function () { return numerar(salida, vacias); });
  }

  function numerar(lista, vacias) {
    lista.sort(function (a, b) { return a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0; });
    lista.forEach(function (f, i) { f.id = "F" + (i + 1); });
    lista.vacias = vacias || [];
    return lista;
  }

  /* ------------------------------------------------------------------
     2. LEER POR DENTRO
     ------------------------------------------------------------------ */

  function leerPdf(fichero) {
    if (!raiz || !raiz.pdfjsLib) {
      fichero.lectura = "no_se_puede";
      fichero.motivo_no_leido = "el lector de PDF no está cargado en esta página";
      return Promise.resolve();
    }
    return fichero.file.arrayBuffer().then(function (buf) {
      var tarea = raiz.pdfjsLib.getDocument({
        data: new Uint8Array(buf),
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: false,
        /* sin red: si el PDF necesitara tablas de caracteres o tipografías
           de fuera, NO se van a buscar. Se queda con lo que traiga dentro. */
        cMapUrl: null, standardFontDataUrl: null, wasmUrl: null,
        verbosity: 0
      });
      return tarea.promise;
    }).then(function (doc) {
      var n = Math.min(doc.numPages, PAGINAS_QUE_MIRO);
      var trozos = [];
      var cad = Promise.resolve();
      for (var i = 1; i <= n; i++) {
        (function (p) {
          cad = cad.then(function () {
            return doc.getPage(p).then(function (pg) { return pg.getTextContent(); })
              .then(function (c) {
                trozos.push(c.items.map(function (x) { return x.str; }).join(" "));
              }, function () { });
          });
        })(i);
      }
      return cad.then(function () {
        fichero.paginas = doc.numPages;
        try { doc.destroy(); } catch (e) { }
        var t = trozos.join("\n").replace(/\s+/g, " ").trim();
        if (t.length >= MINIMO_PARA_DECIR_QUE_LO_HE_LEIDO) {
          fichero.texto = t;
          fichero.lectura = "leido";
        } else {
          fichero.texto = "";
          fichero.lectura = "sin_texto";
          fichero.motivo_no_leido = t.length === 0
            ? "es un PDF sin texto dentro: está escaneado o es una foto metida en un PDF"
            : "el PDF solo devuelve " + t.length + " caracteres, que no es texto de verdad: está escaneado";
        }
      });
    }).catch(function (e) {
      fichero.lectura = "error";
      fichero.motivo_no_leido = "el PDF no se deja abrir (" + (e && e.message ? e.message : "error") + ")";
    });
  }

  function leerTextoPlano(fichero) {
    return fichero.file.text().then(function (t) {
      t = String(t || "").replace(/\s+/g, " ").trim();
      if (t.length >= MINIMO_PARA_DECIR_QUE_LO_HE_LEIDO) {
        fichero.texto = t.slice(0, 40000);
        fichero.lectura = "leido";
      } else if (t.length === 0) {
        fichero.lectura = "vacio";
        fichero.motivo_no_leido = "el fichero está vacío: no tiene ni una letra dentro";
      } else {
        /* ARREGLO DE REDACCIÓN (20/09/2026): un fichero con 17 letras
           dentro se contaba y se decía «vacío». No está vacío: tiene
           letras, lo que pasa es que son muy pocas para sacar nada. La
           frase decía una cosa y el número que ella misma enseñaba decía
           la contraria. Se separa lo vacío de lo cortísimo. */
        fichero.lectura = "casi_vacio";
        fichero.texto_corto = t;
        fichero.motivo_no_leido = "solo tiene " + t.length +
          (t.length === 1 ? " letra dentro" : " letras dentro") +
          ": las he leído, pero son muy pocas para sacar nada de ahí";
      }
    }).catch(function () {
      fichero.lectura = "error";
      fichero.motivo_no_leido = "no se deja leer";
    });
  }

  /* .docx es un zip. El navegador ya sabe descomprimir (DecompressionStream),
     así que no hace falta ninguna librería ni ninguna descarga. */
  function leerDocx(fichero) {
    if (typeof DecompressionStream === "undefined") {
      fichero.lectura = "no_se_puede";
      fichero.motivo_no_leido = "este navegador no sabe abrir .docx sin ayuda de fuera";
      return Promise.resolve();
    }
    return fichero.file.arrayBuffer().then(function (buf) {
      return sacarDelZip(new Uint8Array(buf), "word/document.xml");
    }).then(function (xml) {
      if (!xml) {
        fichero.lectura = "no_se_puede";
        fichero.motivo_no_leido = "no parece un .docx de Word por dentro";
        return;
      }
      var t = xml
        .replace(/<w:p[ >][\s\S]*?(?=<)/g, function (m) { return m; })
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:tab\/>/g, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/\s+/g, " ").trim();
      if (t.length >= MINIMO_PARA_DECIR_QUE_LO_HE_LEIDO) {
        fichero.texto = t.slice(0, 40000);
        fichero.lectura = "leido";
      } else if (t.length === 0) {
        fichero.lectura = "vacio";
        fichero.motivo_no_leido = "el documento de Word no tiene ni una letra dentro";
      } else {
        /* mismo arreglo que en leerTextoPlano: con letras dentro no se
           dice «no tiene texto», se dice cuántas hay */
        fichero.lectura = "casi_vacio";
        fichero.texto_corto = t;
        fichero.motivo_no_leido = "el documento de Word solo tiene " + t.length +
          (t.length === 1 ? " letra dentro" : " letras dentro") +
          ": las he leído, pero son muy pocas para sacar nada de ahí";
      }
    }).catch(function (e) {
      fichero.lectura = "error";
      fichero.motivo_no_leido = "el .docx no se deja abrir (" + (e && e.message ? e.message : "error") + ")";
    });
  }

  /* Lector de zip mínimo: busca el directorio central, localiza la
     entrada que se le pide y la descomprime con el propio navegador. */
  function sacarDelZip(u8, queEntrada) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var fin = -1;
    for (var i = u8.length - 22; i >= 0 && i > u8.length - 66000; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    }
    if (fin < 0) return Promise.resolve(null);
    var cuantas = dv.getUint16(fin + 10, true);
    var donde = dv.getUint32(fin + 16, true);
    var p = donde, encontrada = null;
    for (var k = 0; k < cuantas && p + 46 <= u8.length; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var metodo = dv.getUint16(p + 10, true);
      var comprimido = dv.getUint32(p + 20, true);
      var nLen = dv.getUint16(p + 28, true);
      var eLen = dv.getUint16(p + 30, true);
      var cLen = dv.getUint16(p + 32, true);
      var offset = dv.getUint32(p + 42, true);
      var nombre = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nLen));
      if (nombre === queEntrada) { encontrada = { metodo: metodo, comprimido: comprimido, offset: offset }; break; }
      p += 46 + nLen + eLen + cLen;
    }
    if (!encontrada) return Promise.resolve(null);
    var lo = encontrada.offset;
    if (dv.getUint32(lo, true) !== 0x04034b50) return Promise.resolve(null);
    var nL = dv.getUint16(lo + 26, true), eL = dv.getUint16(lo + 28, true);
    var datos = u8.subarray(lo + 30 + nL + eL, lo + 30 + nL + eL + encontrada.comprimido);
    if (encontrada.metodo === 0) return Promise.resolve(new TextDecoder().decode(datos));
    if (encontrada.metodo !== 8) return Promise.resolve(null);
    var ds = new DecompressionStream("deflate-raw");
    var w = ds.writable.getWriter();
    w.write(datos); w.close();
    return new Response(ds.readable).text();
  }

  /* Recorre todos los ficheros. Va de tanda en tanda y suelta el hilo
     entre tanda y tanda, para que la pantalla no se quede congelada y
     la barra de progreso se mueva de verdad. */
  function leerPorDentro(ficheros, avisar) {
    var hechos = 0;
    function uno(f) {
      var ext = f.ext;
      var p;
      /* EL TOPE, LO PRIMERO DE TODO. Antes de decidir cómo se abre hay
         que decidir SI se abre. Si pesa más de la cuenta no se toca: ni
         arrayBuffer, ni pdf.js, ni nada. Ahí es donde moría la pestaña. */
      if (f.bytes != null && f.bytes > TOPE_DE_BYTES) {
        f.lectura = "demasiado_grande";
        f.demasiado_grande = true;
        f.motivo_no_leido = "pesa " + enMegas(f.bytes) + " y no lo he abierto: por encima de " +
                            enMegas(TOPE_DE_BYTES) + " el navegador se cae y te quedarías sin nada. " +
                            "Veo su nombre, su tamaño y su fecha; lo de dentro, no.";
        return Promise.resolve().then(function () {
          hechos++;
          if (avisar) avisar(hechos, ficheros.length, f);
        });
      }
      if (ext === "pdf") p = leerPdf(f);
      else if (EXT_TEXTO.indexOf(ext) >= 0) p = leerTextoPlano(f);
      else if (ext === "docx") p = leerDocx(f);
      else {
        f.lectura = "no_se_puede";
        f.motivo_no_leido = EXT_FOTO.indexOf(ext) >= 0
          ? "es una foto: por dentro no hay texto que leer, solo píxeles"
          : (ext ? "es un ." + ext + ", y esto no sabe abrirlo por dentro"
                 : "no tiene extensión, así que no sé qué es");
        p = Promise.resolve();
      }
      return p.then(function () {
        hechos++;
        if (avisar) avisar(hechos, ficheros.length, f);
      });
    }
    var cad = Promise.resolve();
    ficheros.forEach(function (f, i) {
      cad = cad.then(function () { return uno(f); });
      if (i % 5 === 4) cad = cad.then(function () { return new Promise(function (r) { setTimeout(r, 0); }); });
    });
    return cad.then(function () { return cuentaDeLectura(ficheros); });
  }

  /* ------------------------------------------------------------------
     3. LA HUELLA DEL CONTENIDO
     ------------------------------------------------------------------
     Dos ficheros son el mismo papel cuando tienen el mismo CONTENIDO, no
     cuando tienen el mismo nombre y el mismo tamaño. Comparar por nombre
     y tamaño hacía dos cosas mal a la vez: se le escapaban las copias con
     nombre distinto («descarga (11).pdf» y «Documento nuevo (7).pdf» son
     el mismo papel) y juntaba como copias cuatro notas simples de cuatro
     expedientes distintos solo porque pesaban lo mismo.

     Con las FOTOS hay un detalle: dos copias de la misma foto pueden
     tener bytes distintos porque el móvil o Windows le cambian los
     metadatos (la fecha, la orientación, el GPS). Por eso de una foto no
     se calcula la huella del fichero entero: se calcula solo de los datos
     de la imagen, saltándose las cabeceras de metadatos.
     ------------------------------------------------------------------ */

  function soloLoQueEsLaImagen(u8) {
    /* JPEG: se saltan los bloques APPn (EXIF, JFIF, XMP...) y los comentarios */
    if (u8.length > 3 && u8[0] === 0xFF && u8[1] === 0xD8) {
      var trozos = [], i = 2;
      while (i < u8.length - 1) {
        if (u8[i] !== 0xFF) { i++; continue; }
        var marca = u8[i + 1];
        if (marca === 0xD8 || marca === 0x01 || (marca >= 0xD0 && marca <= 0xD7)) { i += 2; continue; }
        if (marca === 0xDA) { trozos.push(u8.subarray(i)); break; }   /* datos de la imagen: hasta el final */
        if (i + 3 >= u8.length) break;
        var largo = (u8[i + 2] << 8) | u8[i + 3];
        if (largo < 2) break;
        var esMetadato = (marca >= 0xE0 && marca <= 0xEF) || marca === 0xFE;
        if (!esMetadato) trozos.push(u8.subarray(i, i + 2 + largo));
        i += 2 + largo;
      }
      if (trozos.length) return juntar(trozos);
    }
    /* PNG: solo los bloques IDAT, que son los píxeles */
    if (u8.length > 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
      var out = [], p = 8, dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      while (p + 8 <= u8.length) {
        var len = dv.getUint32(p);
        var tipo = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
        if (tipo === "IDAT") out.push(u8.subarray(p + 8, p + 8 + len));
        if (tipo === "IEND") break;
        p += 12 + len;
        if (len < 0 || p > u8.length) break;
      }
      if (out.length) return juntar(out);
    }
    return u8;
  }
  function juntar(trozos) {
    var n = 0, i;
    for (i = 0; i < trozos.length; i++) n += trozos[i].length;
    var r = new Uint8Array(n), o = 0;
    for (i = 0; i < trozos.length; i++) { r.set(trozos[i], o); o += trozos[i].length; }
    return r;
  }

  function enHexadecimal(buf) {
    var u = new Uint8Array(buf), s = "";
    for (var i = 0; i < u.length; i++) s += (u[i] < 16 ? "0" : "") + u[i].toString(16);
    return s;
  }

  function huellasDeContenido(ficheros, avisar) {
    var hayCripto = typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest;
    var hechos = 0;
    function una(f) {
      /* EL MISMO TOPE QUE ARRIBA, Y AQUÍ IMPORTA IGUAL O MÁS: para sacar
         la huella hay que traerse el fichero ENTERO a la memoria. Con
         150 MB eso es lo que mata la pestaña aunque no se abra el PDF.
         Sin huella no se puede decir si está repetido, y eso se dice. */
      if (f.bytes != null && f.bytes > TOPE_DE_BYTES) {
        f.huella = null;
        f.sin_huella_porque = "pesa " + enMegas(f.bytes) + " y no lo he traído entero a la memoria: " +
                              "por encima de " + enMegas(TOPE_DE_BYTES) + " el navegador se cae";
        hechos++;
        if (avisar) avisar(hechos, ficheros.length);
        return Promise.resolve();
      }
      return f.file.arrayBuffer().then(function (buf) {
        var u8 = new Uint8Array(buf);
        var datos = EXT_FOTO.indexOf(f.ext) >= 0 ? soloLoQueEsLaImagen(u8) : u8;
        f.bytes_comparados = datos.length;
        if (!hayCripto) {
          /* sin crypto.subtle no se puede comparar por contenido: se dice,
             y se deja sin huella en vez de fingir que se ha comparado */
          f.huella = null;
          f.sin_huella_porque = "este navegador no deja calcular la huella del contenido";
          return;
        }
        return crypto.subtle.digest("SHA-256", datos).then(function (h) {
          f.huella = enHexadecimal(h);
        });
      }).catch(function (e) {
        f.huella = null;
        f.sin_huella_porque = "no se ha podido leer el fichero entero (" + ((e && e.message) || "error") + ")";
      }).then(function () {
        hechos++;
        if (avisar) avisar(hechos, ficheros.length);
      });
    }
    var cad = Promise.resolve();
    ficheros.forEach(function (f, i) {
      cad = cad.then(function () { return una(f); });
      if (i % 20 === 19) cad = cad.then(function () { return new Promise(function (r) { setTimeout(r, 0); }); });
    });
    return cad;
  }

  /* La cuenta exacta. Esto es lo que sale en pantalla, y no se toca. */
  function cuentaDeLectura(ficheros) {
    var c = { total: ficheros.length, leidos: 0, no_leidos: 0,
              pdf_total: 0, pdf_leidos: 0, pdf_escaneados: 0,
              fotos: 0, otros: 0, vacios: 0, casi_vacios: 0, errores: 0,
              demasiado_grandes: 0, los_demasiado_grandes: [], por_extension: {} };
    ficheros.forEach(function (f) {
      c.por_extension[f.ext || "(sin extensión)"] = (c.por_extension[f.ext || "(sin extensión)"] || 0) + 1;
      if (f.ext === "pdf") c.pdf_total++;
      if (f.lectura === "leido") {
        c.leidos++;
        if (f.ext === "pdf") c.pdf_leidos++;
      } else {
        c.no_leidos++;
        if (f.lectura === "demasiado_grande") {
          c.demasiado_grandes++;
          c.los_demasiado_grandes.push({ ruta: f.ruta, bytes: f.bytes, cuanto: enMegas(f.bytes) });
        }
        else if (f.lectura === "sin_texto") c.pdf_escaneados++;
        else if (f.lectura === "vacio") c.vacios++;
        else if (f.lectura === "casi_vacio") c.casi_vacios++;
        else if (f.lectura === "error") c.errores++;
        else if (EXT_FOTO.indexOf(f.ext) >= 0) c.fotos++;
        else c.otros++;
      }
    });
    return c;
  }

  /* La frase, con los números de verdad. Ni uno redondeado. */
  function frameDeHonradez(c) {
    if (!c.total) return "No he encontrado ningún fichero en lo que me has soltado.";
    var l = c.total === 1
      ? "He podido leer por dentro " + (c.leidos ? "el único fichero que me has dado." : "cero de tus ficheros: el único que me has dado no se deja abrir.")
      : "He podido leer por dentro " + c.leidos + " de tus " + c.total + " ficheros.";
    if (c.no_leidos === 0) return l + " De todos ellos he leído el texto entero que traían.";
    var partes = [];
    if (c.demasiado_grandes) partes.push(c.demasiado_grandes + (c.demasiado_grandes === 1
      ? " fichero demasiado grande para abrirlo" : " ficheros demasiado grandes para abrirlos"));
    if (c.pdf_escaneados) partes.push(c.pdf_escaneados + (c.pdf_escaneados === 1 ? " PDF escaneado" : " PDF escaneados"));
    if (c.fotos) partes.push(c.fotos + (c.fotos === 1 ? " foto" : " fotos"));
    if (c.otros) partes.push(c.otros + (c.otros === 1 ? " fichero de un formato que no sé abrir" : " ficheros de formatos que no sé abrir"));
    if (c.vacios) partes.push(c.vacios + (c.vacios === 1 ? " fichero vacío" : " ficheros vacíos"));
    /* lo cortísimo NO es lo vacío: si tiene letras dentro, no se dice que
       esté vacío, porque el propio número de al lado lo desmiente */
    if (c.casi_vacios) partes.push(c.casi_vacios + (c.casi_vacios === 1
      ? " fichero con muy pocas letras dentro" : " ficheros con muy pocas letras dentro"));
    if (c.errores) partes.push(c.errores + (c.errores === 1 ? " fichero roto" : " ficheros rotos"));
    /* «De los otros 1 veo el nombre… pero no puedo abrirlos» es una
       frase de programa. Con uno solo se dice en singular. */
    if (c.no_leidos === 1) {
      return l + " Del otro veo el nombre, el tamaño y la fecha, pero no puedo abrirlo: " +
             partes.join(", ") + ".";
    }
    return l + " De los otros " + c.no_leidos + " veo el nombre, el tamaño y la fecha, pero no puedo abrirlos: " +
           partes.join(", ") + ".";
  }

  var API = {
    version: VERSION,
    MINIMO_PARA_DECIR_QUE_LO_HE_LEIDO: MINIMO_PARA_DECIR_QUE_LO_HE_LEIDO,
    TOPE_DE_BYTES: TOPE_DE_BYTES,
    desdeSoltar: desdeSoltar,
    desdeInput: desdeInput,
    desdeCarpetaDeVerdad: desdeCarpetaDeVerdad,
    hayCarpetaDeVerdad: hayCarpetaDeVerdad,
    leerPorDentro: leerPorDentro,
    huellasDeContenido: huellasDeContenido,
    soloLoQueEsLaImagen: soloLoQueEsLaImagen,
    cuentaDeLectura: cuentaDeLectura,
    frameDeHonradez: frameDeHonradez,
    extensionDe: extensionDe,
    EXT_FOTO: EXT_FOTO, EXT_TEXTO: EXT_TEXTO
  };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_LECTOR = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
