/* ==================================================================
   IMMO IA · copia_y_deshacer.js — ENSEÑAR ANTES DE TOCAR, Y DESHACER
   ------------------------------------------------------------------
   TRES COSAS QUE NO SE NEGOCIAN:

   1. SUS CARPETAS ORIGINALES NO SE TOCAN. Aquí solo se COPIA. No se
      mueve, no se renombra, no se borra nada de lo suyo. Si mañana
      apaga el ordenador y tira esto a la basura, su carpeta de siempre
      está exactamente igual que estaba.

   2. TODO LO QUE SE ESCRIBE QUEDA APUNTADO, fichero a fichero, en
      IMMO_IA_REGISTRO_DE_MOVIMIENTOS.json, dentro de la carpeta nueva.
      Ese registro es lo que hace posible deshacer.

   3. DESHACER BORRA SOLO LO QUE PUSO ESTE PROGRAMA. Antes de borrar
      cada fichero comprueba que es el que él mismo escribió (mismo
      nombre y mismo tamaño). Si no coincide, NO lo borra y lo dice.

   Y como siempre: NADA SALE DE ESTE ORDENADOR. Escribir en el disco
   se hace con la API de ficheros del navegador, que va contra el
   disco de ella. No hay ni una petición de red en todo el fichero.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.0";
  var REGISTRO = "IMMO_IA_REGISTRO_DE_MOVIMIENTOS.json";

  /* ------------------------------------------------------------------
     ¿HASTA DÓNDE LLEGA ESTE NAVEGADOR?
     ------------------------------------------------------------------ */
  function queSabeHacerEsteNavegador() {
    var hay = typeof window !== "undefined";
    var escribir = hay && typeof window.showDirectoryPicker === "function";
    var soltar = hay && typeof window.DataTransferItem !== "undefined" &&
                 typeof DataTransferItem.prototype.webkitGetAsEntry === "function";
    var boton = hay && "webkitdirectory" in document.createElement("input");
    var descomprimir = typeof DecompressionStream !== "undefined";
    return {
      escribir_en_disco: escribir,
      arrastrar_carpeta: soltar,
      boton_carpeta: boton,
      abrir_docx: descomprimir,
      contexto_seguro: hay ? !!window.isSecureContext : false,
      /* frase para pantalla, sin adornar */
      frase: escribir
        ? "Este navegador sí puede escribir la carpeta ordenada en tu disco."
        : "Este navegador NO puede escribir carpetas en tu disco (eso hoy solo lo hacen Chrome y Edge). " +
          "Te enseño el plan entero y te lo descargo en un ZIP ya ordenado."
    };
  }

  function pedirDestino() {
    if (typeof window.showDirectoryPicker !== "function") {
      return Promise.reject(new Error("este navegador no sabe abrir una carpeta para escribir"));
    }
    return window.showDirectoryPicker({ mode: "readwrite", startIn: "documents" });
  }

  /* ------------------------------------------------------------------
     COPIAR
     ------------------------------------------------------------------ */
  function nombreDeLaCarpetaNueva(plan) {
    var d = new Date();
    function dd(n) { return (n < 10 ? "0" : "") + n; }
    return "IMMO_IA_ORDENADO_" + plan.clave.toUpperCase() + "_" +
           d.getFullYear() + dd(d.getMonth() + 1) + dd(d.getDate()) + "_" +
           dd(d.getHours()) + dd(d.getMinutes());
  }

  /* Dos ficheros distintos que caerían con el mismo nombre en la misma
     carpeta: el segundo se queda como «nombre (2).pdf». No se pisa
     ninguno y queda apuntado en el registro. */
  function repartirSinPisarse(plan) {
    var vistos = {}, salida = [];
    plan.destinos.forEach(function (d) {
      var base = d.nombre, p = base.lastIndexOf(".");
      var tronco = p > 0 ? base.slice(0, p) : base;
      var ext = p > 0 ? base.slice(p) : "";
      var clave = (d.carpeta + "/" + base).toLowerCase();
      var n = 1, nombre = base;
      while (vistos[clave]) {
        n++;
        nombre = tronco + " (" + n + ")" + ext;
        clave = (d.carpeta + "/" + nombre).toLowerCase();
      }
      vistos[clave] = true;
      salida.push({ carpeta: d.carpeta, nombre: nombre, fichero: d.fichero,
                    renombrado: nombre !== base ? base : null });
    });
    return salida;
  }

  function carpetaDentro(handle, ruta, creadas) {
    if (!ruta) return Promise.resolve(handle);
    var trozos = ruta.split("/").filter(Boolean);
    var acumulado = [];
    return trozos.reduce(function (cad, t) {
      return cad.then(function (h) {
        acumulado.push(t);
        return h.getDirectoryHandle(t, { create: true }).then(function (nuevo) {
          var r = acumulado.join("/");
          if (creadas.indexOf(r) < 0) creadas.push(r);
          return nuevo;
        });
      });
    }, Promise.resolve(handle));
  }

  function copiar(plan, destinoHandle, avisar) {
    var carpetaNueva = nombreDeLaCarpetaNueva(plan);
    var lista = repartirSinPisarse(plan);
    var creadas = [], copias = [], fallos = [];
    var raizNueva = null;

    return destinoHandle.getDirectoryHandle(carpetaNueva, { create: true }).then(function (h) {
      raizNueva = h;
      var hechos = 0;
      return lista.reduce(function (cad, d) {
        return cad.then(function () {
          return carpetaDentro(raizNueva, d.carpeta, creadas)
            .then(function (carp) {
              return carp.getFileHandle(d.nombre, { create: true });
            })
            .then(function (fh) {
              return fh.createWritable().then(function (w) {
                return w.write(d.fichero.file).then(function () { return w.close(); });
              });
            })
            .then(function () {
              copias.push({
                de: d.fichero.ruta,
                a: (d.carpeta ? d.carpeta + "/" : "") + d.nombre,
                bytes: d.fichero.bytes,
                renombrado_desde: d.renombrado || null,
                id_fichero: d.fichero.id
              });
            })
            .catch(function (e) {
              fallos.push({ de: d.fichero.ruta, a: (d.carpeta ? d.carpeta + "/" : "") + d.nombre,
                            por_que: (e && e.message) || "error al escribir" });
            })
            .then(function () {
              hechos++;
              if (avisar) avisar(hechos, lista.length, d);
            });
        });
      }, Promise.resolve());
    }).then(function () {
      var registro = {
        programa: "IMMO IA · EL WOW DEL LUNES",
        version: VERSION,
        cuando: new Date().toISOString(),
        sistema_de_orden: plan.clave,
        titulo_del_sistema: plan.titulo,
        carpeta_creada: carpetaNueva,
        origen_no_se_ha_tocado: true,
        aviso: "Este fichero es lo que permite deshacer. Si lo borras, el botón de deshacer " +
               "ya no sabrá qué quitar y habrá que borrar la carpeta a mano.",
        carpetas_creadas: creadas.slice().sort(),
        copias: copias,
        fallos: fallos
      };
      return raizNueva.getFileHandle(REGISTRO, { create: true })
        .then(function (fh) { return fh.createWritable(); })
        .then(function (w) {
          return w.write(new Blob([JSON.stringify(registro, null, 2)], { type: "application/json" }))
            .then(function () { return w.close(); });
        })
        .then(function () {
          return { registro: registro, handle: raizNueva, carpeta: carpetaNueva,
                   copiados: copias.length, fallos: fallos };
        });
    });
  }

  /* ------------------------------------------------------------------
     DESHACER
     ------------------------------------------------------------------ */
  function deshacer(destinoHandle, registro, avisar) {
    if (!registro || !registro.carpeta_creada) {
      return Promise.reject(new Error("no hay registro de lo que se copió: sin él no borro nada"));
    }
    var borrados = [], respetados = [], raizNueva = null;
    return destinoHandle.getDirectoryHandle(registro.carpeta_creada, { create: false })
      .then(function (h) {
        raizNueva = h;
        var hechos = 0;
        return (registro.copias || []).reduce(function (cad, c) {
          return cad.then(function () {
            var trozos = c.a.split("/");
            var nombre = trozos.pop();
            return bajarHasta(raizNueva, trozos)
              .then(function (carp) {
                if (!carp) throw new Error("ya no está esa carpeta");
                return carp.getFileHandle(nombre, { create: false }).then(function (fh) {
                  /* comprobación antes de borrar: tiene que ser el mismo
                     fichero que escribimos. Si alguien lo ha cambiado, se
                     queda donde está. */
                  return fh.getFile().then(function (f) {
                    if (f.size !== c.bytes) {
                      respetados.push({ a: c.a, por_que: "ha cambiado de tamaño desde que lo copié (" +
                                        f.size + " bytes ahora, " + c.bytes + " cuando lo escribí)" });
                      return;
                    }
                    return carp.removeEntry(nombre).then(function () { borrados.push(c.a); });
                  });
                });
              })
              .catch(function (e) {
                respetados.push({ a: c.a, por_que: (e && e.message) || "no se ha encontrado" });
              })
              .then(function () {
                hechos++;
                if (avisar) avisar(hechos, (registro.copias || []).length);
              });
          });
        }, Promise.resolve());
      })
      .then(function () {
        /* el propio registro */
        return raizNueva.removeEntry(REGISTRO).then(function () { borrados.push(REGISTRO); },
                                                    function () { });
      })
      .then(function () {
        /* las carpetas, de la más honda a la menos honda, y solo si están vacías */
        var carpetas = (registro.carpetas_creadas || []).slice()
          .sort(function (a, b) { return b.split("/").length - a.split("/").length; });
        return carpetas.reduce(function (cad, r) {
          return cad.then(function () {
            var trozos = r.split("/");
            var nombre = trozos.pop();
            return bajarHasta(raizNueva, trozos).then(function (carp) {
              if (!carp) return;
              return carp.removeEntry(nombre, { recursive: false })
                .catch(function () { respetados.push({ a: r + "/", por_que: "la carpeta no estaba vacía: hay algo que yo no puse" }); });
            });
          });
        }, Promise.resolve());
      })
      .then(function () {
        /* La carpeta de arriba solo se quita si está vacía del todo. Si
           queda algo dentro, es de ella, y se dice — que quede la carpeta
           sin explicación sería mentir por omisión. */
        return destinoHandle.removeEntry(registro.carpeta_creada, { recursive: false })
          .then(function () {
            return { borrados: borrados, respetados: respetados, carpeta_borrada: true };
          }, function () {
            return quedaDentro(raizNueva).then(function (sobra) {
              respetados.push({
                a: registro.carpeta_creada + "/",
                por_que: sobra.length
                  ? "no he borrado la carpeta porque dentro sigue habiendo cosas que yo no puse: " +
                    sobra.slice(0, 6).join(", ") + (sobra.length > 6 ? " y " + (sobra.length - 6) + " más" : "")
                  : "el navegador no me ha dejado borrar la carpeta"
              });
              return { borrados: borrados, respetados: respetados, carpeta_borrada: false };
            });
          });
      });
  }

  /* Qué ha quedado dentro de una carpeta, para poder decirlo con nombres */
  function quedaDentro(h) {
    var out = [];
    function bajar(x, pre) {
      var it = x.entries(), lista = [];
      function siguiente() {
        return it.next().then(function (p) {
          if (p.done) return lista;
          lista.push(p.value);
          return siguiente();
        });
      }
      return siguiente().then(function (l) {
        return l.reduce(function (cad, par) {
          return cad.then(function () {
            if (par[1].kind === "file") { out.push(pre + par[0]); return; }
            return bajar(par[1], pre + par[0] + "/");
          });
        }, Promise.resolve());
      });
    }
    return bajar(h, "").then(function () { return out; }, function () { return out; });
  }

  function bajarHasta(h, trozos) {
    return trozos.reduce(function (cad, t) {
      return cad.then(function (x) {
        if (!x) return null;
        return x.getDirectoryHandle(t, { create: false }).catch(function () { return null; });
      });
    }, Promise.resolve(h));
  }

  /* ------------------------------------------------------------------
     SI EL NAVEGADOR NO DEJA ESCRIBIR: EL ZIP YA ORDENADO
     ------------------------------------------------------------------
     Un ZIP «guardado» (sin comprimir), hecho a mano aquí mismo. Sin
     librerías y sin descargar nada. Las carpetas del ZIP son las del
     plan, así que al descomprimirlo le queda el árbol tal cual.
     ------------------------------------------------------------------ */
  var TABLA_CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = TABLA_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function horaZip(ms) {
    var d = new Date(ms || Date.now());
    var hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { hora: hora & 0xFFFF, fecha: fecha & 0xFFFF };
  }

  function hacerZip(plan, avisar) {
    var lista = repartirSinPisarse(plan);
    var trozos = [], central = [], desplazamiento = 0, hechos = 0;
    var cod = new TextEncoder();

    function unaEntrada(d) {
      var ruta = (d.carpeta ? d.carpeta + "/" : "") + d.nombre;
      var nombreBytes = cod.encode(ruta);
      return d.fichero.file.arrayBuffer().then(function (buf) {
        var datos = new Uint8Array(buf);
        var crc = crc32(datos);
        var t = horaZip(d.fichero.modificado);
        var cab = new Uint8Array(30 + nombreBytes.length);
        var dv = new DataView(cab.buffer);
        dv.setUint32(0, 0x04034b50, true);
        dv.setUint16(4, 20, true);            /* versión necesaria */
        dv.setUint16(6, 0x0800, true);        /* nombres en UTF-8 */
        dv.setUint16(8, 0, true);             /* método: guardado, sin comprimir */
        dv.setUint16(10, t.hora, true); dv.setUint16(12, t.fecha, true);
        dv.setUint32(14, crc, true);
        dv.setUint32(18, datos.length, true);
        dv.setUint32(22, datos.length, true);
        dv.setUint16(26, nombreBytes.length, true);
        dv.setUint16(28, 0, true);
        cab.set(nombreBytes, 30);
        trozos.push(cab, datos);

        var c = new Uint8Array(46 + nombreBytes.length);
        var dc = new DataView(c.buffer);
        dc.setUint32(0, 0x02014b50, true);
        dc.setUint16(4, 20, true); dc.setUint16(6, 20, true);
        dc.setUint16(8, 0x0800, true); dc.setUint16(10, 0, true);
        dc.setUint16(12, t.hora, true); dc.setUint16(14, t.fecha, true);
        dc.setUint32(16, crc, true);
        dc.setUint32(20, datos.length, true);
        dc.setUint32(24, datos.length, true);
        dc.setUint16(28, nombreBytes.length, true);
        dc.setUint32(42, desplazamiento, true);
        c.set(nombreBytes, 46);
        central.push(c);
        desplazamiento += cab.length + datos.length;
        hechos++;
        if (avisar) avisar(hechos, lista.length);
      });
    }

    var cad = Promise.resolve();
    lista.forEach(function (d, i) {
      cad = cad.then(function () { return unaEntrada(d); });
      if (i % 10 === 9) cad = cad.then(function () { return new Promise(function (r) { setTimeout(r, 0); }); });
    });
    return cad.then(function () {
      var inicioCentral = desplazamiento, tamCentral = 0;
      central.forEach(function (c) { trozos.push(c); tamCentral += c.length; });
      var fin = new Uint8Array(22);
      var df = new DataView(fin.buffer);
      df.setUint32(0, 0x06054b50, true);
      df.setUint16(8, central.length, true);
      df.setUint16(10, central.length, true);
      df.setUint32(12, tamCentral, true);
      df.setUint32(16, inicioCentral, true);
      trozos.push(fin);
      return { blob: new Blob(trozos, { type: "application/zip" }), cuantos: lista.length };
    });
  }

  /* Descargar cualquier cosa sin salir del ordenador: blob + <a download>.
     Un blob: NO es una petición de red, es memoria de esta misma pestaña. */
  function descargar(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    return nombre;
  }

  function planEnTexto(plan) {
    var l = ["IMMO IA — PLAN: " + plan.titulo, plan.subtitulo, ""];
    if (plan.ventaja) l.push(plan.ventaja, "");
    plan.notas.forEach(function (n) { l.push("· " + n); });
    l.push("", "ASI TE QUEDARIA (" + plan.destinos.length + " ficheros, " + (plan.carpetas || 0) + " carpetas):", "");
    var previa = null;
    repartirSinPisarse(plan).forEach(function (d) {
      if (d.carpeta !== previa) { l.push(d.carpeta + "/"); previa = d.carpeta; }
      l.push("    " + d.nombre + (d.renombrado ? "      (se llamaba «" + d.renombrado + "», había dos iguales)" : ""));
    });
    l.push("", "Tus carpetas originales NO se tocan. Esto es solo el plan.");
    return l.join("\n");
  }

  var API = {
    version: VERSION,
    REGISTRO: REGISTRO,
    queSabeHacerEsteNavegador: queSabeHacerEsteNavegador,
    pedirDestino: pedirDestino,
    copiar: copiar,
    deshacer: deshacer,
    hacerZip: hacerZip,
    descargar: descargar,
    planEnTexto: planEnTexto,
    repartirSinPisarse: repartirSinPisarse,
    crc32: crc32
  };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_COPIA = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
