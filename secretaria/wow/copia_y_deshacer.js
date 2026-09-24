/* ==================================================================
   IMMO IA · copia_y_deshacer.js — ENSEÑAR ANTES DE TOCAR, Y DESHACER
   ------------------------------------------------------------------
   TRES COSAS QUE NO SE NEGOCIAN:

   1. SUS CARPETAS ORIGINALES NO SE TOCAN. Aquí solo se COPIA. No se
      mueve, no se renombra, no se borra nada de lo suyo. Si mañana
      apaga el ordenador y tira esto a la basura, su carpeta de siempre
      está exactamente igual que estaba. De los originales SOLO SE LEE
      (para copiarlos y para sacarles la huella).

   2. TODO LO QUE SE ESCRIBE QUEDA APUNTADO, fichero a fichero, en
      IMMO_IA_REGISTRO_DE_MOVIMIENTOS.json, dentro de la carpeta nueva.
      Ese registro es lo que hace posible deshacer. Y SE ESCRIBE AL
      EMPEZAR, antes del primer papel, con la lista entera de lo que se
      va a escribir y la huella de cada cosa; al terminar se completa.
      Así una copia cortada a medias (portátil cerrado, batería) se
      puede deshacer igual.

   3. DESHACER BORRA SOLO LO QUE PUSO ESTE PROGRAMA, Y SOLO SI SIGUE
      SIENDO EXACTAMENTE LO QUE PUSO. Antes de borrar cada fichero le
      saca la HUELLA (SHA-256 de su contenido) y la compara con la que
      apuntó al copiarlo. Si alguien lo ha abierto y guardado —aunque
      pese lo mismo— la huella no coincide, NO lo borra y lo dice.

   CAMBIADO EL 24/09/2026 (V1 · taller S1), fallos 3, 4, 5 y 6 de
   «0 - LO QUE SABEMOS QUE FALLA HOY.md»:
     · 3 · se compara la huella, no el tamaño;
     · 4 · lo que se puede deshacer sobrevive a recargar la página: se
           recuerda DÓNDE se copió (el permiso de la carpeta, en
           IndexedDB) y lo demás se vuelve a leer del registro que hay
           en el disco. Y aunque se pierda eso, «buscar en una carpeta»
           reconstruye la lista leyendo solo los registros del disco;
     · 5 · el registro se escribe al empezar; el fichero que se quedó a
           medio escribir (0 bytes) se detecta y se ofrece quitar;
     · 6 · la carpeta nueva lleva hasta los segundos y, si aun así ya
           existe, un sufijo (_2, _3…): dos pasadas no comparten nunca
           carpeta. Y el aviso de lo que queda no culpa a nadie.

   Y como siempre: NADA SALE DE ESTE ORDENADOR. Escribir en el disco
   se hace con la API de ficheros del navegador, que va contra el
   disco de ella. No hay ni una petición de red en todo el fichero.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "2.0";
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
     LA HUELLA DE UN FICHERO · SHA-256 de su contenido
     ------------------------------------------------------------------
     Se usa la del navegador (crypto.subtle). Si este navegador no la
     tiene a mano (hay casos: páginas que no cuentan como «seguras»),
     se usa esta de aquí abajo, escrita a mano, que da EXACTAMENTE el
     mismo resultado (la prueba lo compara con la de node). Sin
     librerías y sin red.
     ------------------------------------------------------------------ */
  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];

  function sha256aMano(u8) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var n = u8.length;
    var total = ((n + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(total);
    m.set(u8);
    m[n] = 0x80;
    var bits = n * 8;
    var alto = Math.floor(bits / 0x100000000), bajo = bits >>> 0;
    m[total - 8] = (alto >>> 24) & 255; m[total - 7] = (alto >>> 16) & 255;
    m[total - 6] = (alto >>> 8) & 255;  m[total - 5] = alto & 255;
    m[total - 4] = (bajo >>> 24) & 255; m[total - 3] = (bajo >>> 16) & 255;
    m[total - 2] = (bajo >>> 8) & 255;  m[total - 1] = bajo & 255;
    var w = new Uint32Array(64);
    function rotr(x, k) { return (x >>> k) | (x << (32 - k)); }
    for (var off = 0; off < total; off += 64) {
      for (var i = 0; i < 16; i++) {
        var j = off + i * 4;
        w[i] = ((m[j] << 24) | (m[j + 1] << 16) | (m[j + 2] << 8) | m[j + 3]) >>> 0;
      }
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    var out = "";
    for (i = 0; i < 8; i++) out += ("00000000" + H[i].toString(16)).slice(-8);
    return out;
  }

  function aHex(buf) {
    var u = new Uint8Array(buf), s = "";
    for (var i = 0; i < u.length; i++) s += (u[i] < 16 ? "0" : "") + u[i].toString(16);
    return s;
  }

  function subtle() {
    try {
      var c = (raiz && raiz.crypto) || (typeof crypto !== "undefined" ? crypto : null);
      return c && c.subtle && typeof c.subtle.digest === "function" ? c.subtle : null;
    } catch (e) { return null; }
  }

  /* huella de unos bytes (ArrayBuffer o Uint8Array) → texto hex de 64 */
  function huellaDe(bytes) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var s = subtle();
    if (!s) return Promise.resolve(sha256aMano(u8));
    return Promise.resolve().then(function () { return s.digest("SHA-256", u8); })
      .then(aHex, function () { return sha256aMano(u8); });
  }

  /* huella de un File / Blob (el original al copiar, o la copia al deshacer) */
  function huellaDeFichero(f) {
    return f.arrayBuffer().then(function (buf) {
      return huellaDe(buf).then(function (h) { return { huella: h, bytes: buf.byteLength }; });
    });
  }

  /* ------------------------------------------------------------------
     DÓNDE SE COPIÓ · lo que sobrevive a recargar la página (fallo 4)
     ------------------------------------------------------------------
     EL CAMINO ELEGIDO, Y POR QUÉ. Para deshacer hacen falta dos cosas:
     el registro (qué se escribió y con qué huella) y el permiso de la
     carpeta donde se escribió. El registro YA está en el disco, dentro
     de la carpeta nueva: no se duplica en ningún otro sitio, se vuelve
     a leer de ahí cada vez (el disco es la verdad). El permiso de la
     carpeta no es texto y no cabe en localStorage: el único sitio donde
     un navegador deja guardarlo es IndexedDB. Así que en IndexedDB se
     guarda SOLO esto: la carpeta de destino (su permiso) y el nombre de
     la carpeta creada. Nada de los papeles.

     Tras recargar, el navegador puede pedir otra vez permiso para esa
     carpeta; eso exige un clic de la persona, y el clic es justo el de
     «Deshacer». Si IndexedDB no está o se ha borrado, queda el otro
     camino: «Buscar en una carpeta», que lee los registros del disco y
     reconstruye la lista sin haber guardado nada en el navegador.
     ------------------------------------------------------------------ */
  var BD_PASADAS = "immoia.secretaria.deshacer";
  var ALMACEN_PASADAS = "pasadas";
  var MEMORIA = null;          /* las pruebas pueden poner otra; si no, IndexedDB */

  function memoriaIndexedDB() {
    function abrir() {
      return new Promise(function (listo, falla) {
        var I = null;
        try { I = raiz && raiz.indexedDB; } catch (e) { I = null; }
        if (!I) return falla(new Error("este navegador no tiene IndexedDB"));
        var p = I.open(BD_PASADAS, 1);
        p.onupgradeneeded = function () {
          try { p.result.createObjectStore(ALMACEN_PASADAS); } catch (e) {}
        };
        p.onsuccess = function () { listo(p.result); };
        p.onerror = function () { falla(p.error || new Error("no se puede abrir IndexedDB")); };
      });
    }
    function con(modo, hacer) {
      return abrir().then(function (db) {
        return new Promise(function (listo, falla) {
          var t = db.transaction(ALMACEN_PASADAS, modo);
          var r = hacer(t.objectStore(ALMACEN_PASADAS));
          t.oncomplete = function () { listo(r && "result" in r ? r.result : true); };
          t.onerror = function () { falla(t.error || new Error("IndexedDB no ha podido")); };
          t.onabort = function () { falla(t.error || new Error("IndexedDB ha cancelado")); };
        });
      });
    }
    return {
      poner: function (clave, valor) { return con("readwrite", function (s) { return s.put(valor, clave); }); },
      quitar: function (clave) { return con("readwrite", function (s) { return s["delete"](clave); }); },
      todas: function () { return con("readonly", function (s) { return s.getAll(); }); }
    };
  }
  function memoria() { return MEMORIA || memoriaIndexedDB(); }

  var OYENTES = [];
  function avisarCambio() {
    OYENTES.slice().forEach(function (f) { try { f(); } catch (e) {} });
  }

  function claveDe(registro) {
    return String(registro.carpeta_creada) + "|" + String(registro.empezada || registro.cuando || "");
  }
  function recordarPasada(destinoHandle, registro) {
    var v = { clave: claveDe(registro), carpeta: registro.carpeta_creada,
              destino: destinoHandle, cuando: registro.empezada || registro.cuando,
              titulo: registro.titulo_del_sistema || "", estado: registro.estado || "terminada",
              cuantos: (registro.previstas || registro.copias || []).length };
    return memoria().poner(v.clave, v).then(function () { return true; }, function () { return false; });
  }
  function olvidarPasada(registro) {
    return memoria().quitar(claveDe(registro)).then(function () { return true; }, function () { return false; });
  }

  /* Las pasadas que se pueden deshacer, las más nuevas primero. No
     toca el disco (para eso hace falta permiso, y el permiso lo da un
     clic). */
  function pendientes() {
    return memoria().todas().then(function (l) {
      return (l || []).filter(function (x) { return x && x.carpeta && x.destino; })
        .sort(function (a, b) { return String(b.cuando).localeCompare(String(a.cuando)); });
    }, function () { return []; });
  }

  /* El permiso de la carpeta, sin inventar nada: si ya está, se usa; si
     hace falta pedirlo, se pide (esto solo funciona dentro de un clic). */
  function conPermiso(h) {
    if (!h) return Promise.reject(new Error("no sé en qué carpeta se copió"));
    if (typeof h.queryPermission !== "function") return Promise.resolve(h);
    return h.queryPermission({ mode: "readwrite" }).then(function (e) {
      if (e === "granted") return h;
      if (typeof h.requestPermission !== "function") throw new Error("el navegador no me deja volver a entrar en esa carpeta");
      return h.requestPermission({ mode: "readwrite" }).then(function (e2) {
        if (e2 !== "granted") throw new Error("no me has dado permiso para entrar en esa carpeta, así que no toco nada");
        return h;
      });
    });
  }

  /* ------------------------------------------------------------------
     COPIAR
     ------------------------------------------------------------------ */
  function dd(n) { return (n < 10 ? "0" : "") + n; }

  /* HASTA LOS SEGUNDOS (fallo 6). Antes llegaba al minuto y dos pasadas
     en el mismo minuto escribían en la misma carpeta, y la segunda
     pisaba el registro de la primera. */
  function nombreDeLaCarpetaNueva(plan, fecha) {
    var d = fecha || new Date();
    return "IMMO_IA_ORDENADO_" + plan.clave.toUpperCase() + "_" +
           d.getFullYear() + dd(d.getMonth() + 1) + dd(d.getDate()) + "_" +
           dd(d.getHours()) + dd(d.getMinutes()) + dd(d.getSeconds());
  }

  /* Y SI AUN ASÍ YA EXISTE (dos pasadas en el mismo segundo, o una
     carpeta de otro día con ese nombre), se le pone _2, _3… No se
     escribe NUNCA dentro de una carpeta que ya estaba. Las que se están
     creando en esta misma página se apartan también, por si dos
     pasadas van a la vez. */
  var RESERVADAS = {};
  function carpetaLibre(destinoHandle, base) {
    function probar(n) {
      if (n > 99) return Promise.reject(new Error("hay demasiadas carpetas con el nombre «" + base + "»"));
      var nombre = n === 1 ? base : base + "_" + n;
      if (RESERVADAS[nombre]) return probar(n + 1);
      return destinoHandle.getDirectoryHandle(nombre, { create: false }).then(
        function () { return probar(n + 1); },            /* ya existe: la siguiente */
        function (e) {
          if (e && e.name && e.name !== "NotFoundError") return probar(n + 1);  /* hay un fichero con ese nombre */
          RESERVADAS[nombre] = true;
          return nombre;
        });
    }
    return probar(1);
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

  function todasLasCarpetasDe(lista) {
    var r = [];
    lista.forEach(function (d) {
      var trozos = String(d.carpeta || "").split("/").filter(Boolean), acc = [];
      trozos.forEach(function (t) {
        acc.push(t);
        var k = acc.join("/");
        if (r.indexOf(k) < 0) r.push(k);
      });
    });
    return r.sort();
  }

  function escribirRegistro(raizNueva, registro) {
    return raizNueva.getFileHandle(REGISTRO, { create: true })
      .then(function (fh) { return fh.createWritable(); })
      .then(function (w) {
        return w.write(new Blob([JSON.stringify(registro, null, 2)], { type: "application/json" }))
          .then(function () { return w.close(); });
      });
  }

  function copiar(plan, destinoHandle, avisar) {
    var empezada = new Date();
    var lista = repartirSinPisarse(plan);
    var creadas = [], copias = [], fallos = [], previstas = [];
    var raizNueva = null, carpetaNueva = null, registro = null;

    /* 1 · LAS HUELLAS, ANTES DE ESCRIBIR NADA. Se leen los originales
       (solo leer) y se apunta qué se va a escribir y con qué huella. */
    var cad = Promise.resolve();
    lista.forEach(function (d) {
      cad = cad.then(function () {
        var a = (d.carpeta ? d.carpeta + "/" : "") + d.nombre;
        return huellaDeFichero(d.fichero.file).then(function (x) {
          previstas.push({ de: d.fichero.ruta, a: a, bytes: x.bytes, huella: x.huella,
                           renombrado_desde: d.renombrado || null, id_fichero: d.fichero.id });
        }, function () {
          previstas.push({ de: d.fichero.ruta, a: a, bytes: d.fichero.bytes, huella: null,
                           renombrado_desde: d.renombrado || null, id_fichero: d.fichero.id });
        });
      });
    });

    return cad.then(function () {
      return carpetaLibre(destinoHandle, nombreDeLaCarpetaNueva(plan, empezada));
    }).then(function (nombre) {
      carpetaNueva = nombre;
      return destinoHandle.getDirectoryHandle(carpetaNueva, { create: true });
    }).then(function (h) {
      raizNueva = h;
      /* 2 · EL REGISTRO, AL EMPEZAR (fallo 5). Antes del primer papel. */
      registro = {
        programa: "IMMO IA · EL WOW DEL LUNES",
        version: VERSION,
        estado: "empezada",
        empezada: empezada.toISOString(),
        cuando: empezada.toISOString(),
        sistema_de_orden: plan.clave,
        titulo_del_sistema: plan.titulo,
        carpeta_creada: carpetaNueva,
        origen_no_se_ha_tocado: true,
        huella: "SHA-256 del contenido de cada fichero",
        aviso: "Este fichero es lo que permite deshacer. Se escribe al empezar y se completa al " +
               "terminar. Si lo borras, el botón de deshacer ya no sabrá qué quitar y habrá que " +
               "borrar la carpeta a mano.",
        carpetas_previstas: todasLasCarpetasDe(lista),
        carpetas_creadas: todasLasCarpetasDe(lista),
        previstas: previstas,
        copias: [],
        fallos: []
      };
      /* 3 · SE RECUERDA DÓNDE, para poder deshacer tras recargar
         (fallo 4). Va ANTES de escribir el registro: si se corta justo
         escribiéndolo, la carpeta ya está apuntada y se puede quitar.
         Si no se puede recordar, se sigue: el registro del disco basta
         para «buscar en una carpeta». */
      return recordarPasada(destinoHandle, registro).then(function () { avisarCambio(); });
    }).then(function () {
      return escribirRegistro(raizNueva, registro);
    }).then(function () {
      var hechos = 0;
      var porHuella = {};
      previstas.forEach(function (p) { porHuella[p.a] = p; });
      return lista.reduce(function (cad2, d) {
        return cad2.then(function () {
          var a = (d.carpeta ? d.carpeta + "/" : "") + d.nombre;
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
              var p = porHuella[a] || {};
              copias.push({
                de: d.fichero.ruta,
                a: a,
                bytes: typeof p.bytes === "number" ? p.bytes : d.fichero.bytes,
                huella: p.huella || null,
                renombrado_desde: d.renombrado || null,
                id_fichero: d.fichero.id
              });
            })
            .catch(function (e) {
              fallos.push({ de: d.fichero.ruta, a: a, por_que: (e && e.message) || "error al escribir" });
            })
            .then(function () {
              hechos++;
              if (avisar) avisar(hechos, lista.length, d);
            });
        });
      }, Promise.resolve());
    }).then(function () {
      /* 4 · EL REGISTRO, COMPLETADO */
      registro.estado = "terminada";
      registro.terminada = new Date().toISOString();
      registro.cuando = registro.terminada;
      registro.carpetas_creadas = creadas.slice().sort();
      registro.copias = copias;
      registro.fallos = fallos;
      return escribirRegistro(raizNueva, registro);
    }).then(function () {
      return recordarPasada(destinoHandle, registro);
    }).then(function () {
      delete RESERVADAS[carpetaNueva];
      avisarCambio();
      return { registro: registro, handle: raizNueva, carpeta: carpetaNueva,
               copiados: copias.length, fallos: fallos };
    });
  }

  /* ------------------------------------------------------------------
     LEER UN REGISTRO DEL DISCO
     ------------------------------------------------------------------ */
  function leerRegistroDe(destinoHandle, carpeta) {
    var h = null;
    return destinoHandle.getDirectoryHandle(carpeta, { create: false }).then(function (x) {
      h = x;
      return h.getFileHandle(REGISTRO, { create: false });
    }, function () {
      throw { sinCarpeta: true };
    }).then(function (fh) { return fh.getFile(); })
      .then(function (f) { return f.text().then(function (t) { return { t: t, size: f.size }; }); })
      .then(function (x) {
        var r = null;
        try { r = JSON.parse(x.t); } catch (e) { r = null; }
        if (r && r.carpeta_creada) return { ok: true, registro: r, carpeta: h };
        return { ok: false, carpeta: h, registro_roto: true, vacio: x.size === 0,
                 porque: x.size === 0
                   ? "el registro se quedó vacío: la copia se cortó justo al empezar"
                   : "el registro no se puede leer entero" };
      }, function (e) {
        if (e && e.sinCarpeta) return { ok: false, sin_carpeta: true, porque: "esa carpeta ya no está" };
        return { ok: false, carpeta: h, sin_registro: true, porque: "dentro no está el registro " + REGISTRO };
      });
  }

  /* Reconstruir la lista SOLO desde el disco: todas las carpetas
     IMMO_IA_ORDENADO_… de un destino, con su registro. */
  function buscarPasadasEn(destinoHandle) {
    var fuera = [];
    function listar(h) {
      var it = h.entries(), l = [];
      function sig() {
        return it.next().then(function (p) { if (p.done) return l; l.push(p.value); return sig(); });
      }
      return sig();
    }
    return listar(destinoHandle).then(function (l) {
      var dirs = l.filter(function (p) { return p[1].kind === "directory" && /^IMMO_IA_ORDENADO_/.test(p[0]); })
                  .map(function (p) { return p[0]; }).sort().reverse();
      return dirs.reduce(function (cad, n) {
        return cad.then(function () {
          return leerRegistroDe(destinoHandle, n).then(function (r) {
            fuera.push({ carpeta: n, destino: destinoHandle, ok: r.ok, registro: r.registro || null,
                         porque: r.porque || null, vacio: !!r.vacio,
                         clave: r.registro ? claveDe(r.registro) : n + "|" });
          });
        });
      }, Promise.resolve());
    }).then(function () { return fuera; });
  }

  /* ------------------------------------------------------------------
     DESHACER
     ------------------------------------------------------------------
     opciones.quitar_a_medias === true → quita también los ficheros que
     se quedaron a medio escribir (0 bytes). Sin eso, se enseñan y se
     ofrece quitarlos, pero no se quitan.
     ------------------------------------------------------------------ */
  function deshacer(destinoHandle, registro, avisar, opciones) {
    if (!registro || !registro.carpeta_creada) {
      return Promise.reject(new Error("no hay registro de lo que se copió: sin él no borro nada"));
    }
    opciones = opciones || {};
    var quitarAMedias = opciones.quitar_a_medias === true;
    var borrados = [], respetados = [], aMedias = [], noEstaban = [], raizNueva = null;
    var nuestros = {};                  /* lo que figura en el registro */

    /* LO QUE HAY QUE MIRAR: lo previsto (desde el 24/09 va entero en el
       registro desde el principio) y lo copiado. De un registro viejo,
       solo lo copiado. */
    var escritas = {};
    (registro.copias || []).forEach(function (c) { escritas[c.a] = c; });
    var items = [];
    if (registro.previstas && registro.previstas.length) {
      registro.previstas.forEach(function (p) {
        var c = escritas[p.a];
        items.push({ a: p.a, bytes: c ? c.bytes : p.bytes, huella: (c && c.huella) || p.huella || null,
                     escrita: !!c });
      });
      (registro.copias || []).forEach(function (c) {
        if (!items.some(function (x) { return x.a === c.a; })) items.push({ a: c.a, bytes: c.bytes, huella: c.huella || null, escrita: true });
      });
    } else {
      (registro.copias || []).forEach(function (c) {
        items.push({ a: c.a, bytes: c.bytes, huella: c.huella || null, escrita: true });
      });
    }
    items.forEach(function (x) { nuestros[x.a] = true; nuestros[x.a + ".crswap"] = true; });
    nuestros[REGISTRO] = true;

    var marca = Date.parse(registro.terminada || registro.cuando || "");

    function quitar(carp, nombre, a) {
      return carp.removeEntry(nombre).then(function () { borrados.push(a); });
    }
    function quitarSwap(carp, nombre, a) {
      /* Chrome escribe en «nombre.crswap» y lo cambia de nombre al
         cerrar; si se cortó, puede quedar ese también. Es nuestro. */
      return carp.getFileHandle(nombre + ".crswap", { create: false })
        .then(function () { return quitar(carp, nombre + ".crswap", a + ".crswap"); }, function () {});
    }

    return destinoHandle.getDirectoryHandle(registro.carpeta_creada, { create: false })
      .then(function (h) {
        raizNueva = h;
        var hechos = 0;
        return items.reduce(function (cad, c) {
          return cad.then(function () {
            var trozos = c.a.split("/");
            var nombre = trozos.pop();
            return bajarHasta(raizNueva, trozos)
              .then(function (carp) {
                if (!carp) {
                  if (c.escrita) noEstaban.push({ a: c.a, por_que: "ya no está esa carpeta" });
                  return;
                }
                return carp.getFileHandle(nombre, { create: false }).then(function (fh) {
                  return fh.getFile().then(function (f) {
                    /* A · A MEDIO ESCRIBIR: está vacío y tenía que llevar
                       bytes, y la copia no llegó a darlo por escrito. */
                    if (!c.escrita && f.size === 0 && c.bytes > 0) {
                      if (quitarAMedias) {
                        return quitar(carp, nombre, c.a).then(function () { return quitarSwap(carp, nombre, c.a); });
                      }
                      var x = { a: c.a, a_medias: true,
                                por_que: "se quedó a medio escribir (0 bytes) cuando se cortó la copia. " +
                                         "Es mío y está vacío: te ofrezco quitarlo" };
                      aMedias.push(x); respetados.push(x);
                      return;
                    }
                    /* B · CON HUELLA: tiene que ser EXACTAMENTE lo que se escribió */
                    if (c.huella) {
                      if (f.size !== c.bytes) {
                        respetados.push({ a: c.a, por_que: "ha cambiado desde que lo copié (" + f.size +
                                          " bytes ahora, " + c.bytes + " cuando lo escribí). No lo borro" });
                        return;
                      }
                      return huellaDeFichero(f).then(function (x) {
                        if (x.huella !== c.huella) {
                          respetados.push({ a: c.a, por_que: "ha cambiado por dentro desde que lo copié: pesa lo mismo (" +
                                            f.size + " bytes) pero su huella ya no coincide, así que alguien lo ha " +
                                            "abierto y guardado. No lo borro" });
                          return;
                        }
                        return quitar(carp, nombre, c.a);
                      });
                    }
                    /* C · REGISTRO VIEJO, SIN HUELLA: tamaño Y fecha. Si
                       se guardó después de la copia, no se toca. */
                    if (f.size !== c.bytes) {
                      respetados.push({ a: c.a, por_que: "ha cambiado de tamaño desde que lo copié (" +
                                        f.size + " bytes ahora, " + c.bytes + " cuando lo escribí)" });
                      return;
                    }
                    if (!isNaN(marca) && typeof f.lastModified === "number" && f.lastModified > marca + 2000) {
                      respetados.push({ a: c.a, por_que: "se ha guardado después de la copia y este registro es " +
                                        "antiguo (sin huella): no puedo asegurar que sea el mismo, así que no lo borro" });
                      return;
                    }
                    return quitar(carp, nombre, c.a);
                  });
                }, function () {
                  if (c.escrita) noEstaban.push({ a: c.a, por_que: "ya no estaba: lo habrá quitado alguien antes" });
                });
              })
              .catch(function (e) {
                respetados.push({ a: c.a, por_que: (e && e.message) || "no he podido mirarlo" });
              })
              .then(function () {
                hechos++;
                if (avisar) avisar(hechos, items.length);
              });
          });
        }, Promise.resolve());
      })
      .then(function () {
        /* EL REGISTRO SE QUEDA si queda algo nuestro sin quitar: sin él
           no se podría volver a intentar (ni quitar lo de a medias). */
        if (respetados.length) return;
        return raizNueva.removeEntry(REGISTRO).then(function () { borrados.push(REGISTRO); }, function () { });
      })
      .then(function () {
        /* las carpetas, de la más honda a la menos honda, y solo si están vacías */
        var todas = (registro.carpetas_creadas || []).concat(registro.carpetas_previstas || []);
        var carpetas = todas.filter(function (r, i) { return todas.indexOf(r) === i; })
          .sort(function (a, b) { return b.split("/").length - a.split("/").length; });
        return carpetas.reduce(function (cad, r) {
          return cad.then(function () {
            var trozos = r.split("/");
            var nombre = trozos.pop();
            return bajarHasta(raizNueva, trozos).then(function (carp) {
              if (!carp) return;
              return carp.removeEntry(nombre, { recursive: false }).catch(function () { });
            });
          });
        }, Promise.resolve());
      })
      .then(function () {
        /* La carpeta de arriba solo se quita si está vacía del todo. Si
           queda algo, se dice QUÉ queda y POR QUÉ, sin echarle la culpa a
           nadie: o son cosas mías que no he borrado (y arriba está el
           motivo), o son cosas que no figuran en el registro de esta
           pasada y de las que no sé el origen. */
        return destinoHandle.removeEntry(registro.carpeta_creada, { recursive: false })
          .then(function () {
            return olvidarPasada(registro).then(function () {
              avisarCambio();
              return { borrados: borrados, respetados: respetados, a_medias: aMedias,
                       no_estaban: noEstaban, carpeta_borrada: true };
            });
          }, function () {
            return quedaDentro(raizNueva).then(function (sobra) {
              var ajenas = sobra.filter(function (s) { return !nuestros[s]; });
              var porque;
              if (ajenas.length) {
                porque = "no he quitado la carpeta porque dentro hay cosas que no figuran en el registro de esta copia: " +
                         ajenas.slice(0, 6).join(", ") + (ajenas.length > 6 ? " y " + (ajenas.length - 6) + " más" : "") +
                         ". No sé de dónde vienen, así que no las toco";
              } else if (sobra.length) {
                porque = "no he quitado la carpeta porque dentro siguen los ficheros de esta copia que no he borrado " +
                         "(el motivo de cada uno va al lado) y el registro, para poder volver a intentarlo";
              } else {
                porque = "el navegador no me ha dejado quitar la carpeta";
              }
              respetados.push({ a: registro.carpeta_creada + "/", por_que: porque });
              avisarCambio();
              return { borrados: borrados, respetados: respetados, a_medias: aMedias,
                       no_estaban: noEstaban, carpeta_borrada: false };
            });
          });
      });
  }

  /* DESHACER UNA PASADA DE LA LISTA (la que sobrevive a recargar):
     se pide el permiso, se lee el registro DEL DISCO y se deshace. */
  function deshacerPasada(pasada, avisar, opciones) {
    var destino = pasada && pasada.destino;
    return conPermiso(destino).then(function () {
      return leerRegistroDe(destino, pasada.carpeta);
    }).then(function (r) {
      if (r.ok) return deshacer(destino, r.registro, avisar, opciones);
      if (r.sin_carpeta) {
        /* ya no está: se olvida y se dice */
        return memoria().quitar(pasada.clave).then(function () {}, function () {}).then(function () {
          avisarCambio();
          return { borrados: [], respetados: [], a_medias: [], no_estaban: [], carpeta_borrada: false,
                   ya_no_estaba: true };
        });
      }
      /* sin registro legible: SOLO si dentro no hay nada más que un
         registro vacío (la copia se cortó al empezar) se quita; si hay
         cualquier otra cosa, no se borra nada a ciegas */
      return quedaDentro(r.carpeta).then(function (sobra) {
        var soloElRegistro = sobra.length > 0 && sobra.every(function (n) {
          return n === REGISTRO || n === REGISTRO + ".crswap";
        });
        if (r.vacio && soloElRegistro) {
          return r.carpeta.removeEntry(REGISTRO)
            .then(function () {
              return r.carpeta.removeEntry(REGISTRO + ".crswap").then(function () {}, function () {});
            })
            .then(function () { return destino.removeEntry(pasada.carpeta, { recursive: false }); })
            .then(function () { return memoria().quitar(pasada.clave).then(function () {}, function () {}); })
            .then(function () {
              avisarCambio();
              return { borrados: [REGISTRO], respetados: [], a_medias: [], no_estaban: [], carpeta_borrada: true };
            });
        }
        if (sobra.length === 0 && r.carpeta) {
          /* la carpeta está vacía del todo (se cortó antes de escribir
             nada): quitar una carpeta vacía no puede perder nada */
          return destino.removeEntry(pasada.carpeta, { recursive: false })
            .then(function () { return memoria().quitar(pasada.clave).then(function () {}, function () {}); })
            .then(function () {
              avisarCambio();
              return { borrados: [], respetados: [], a_medias: [], no_estaban: [], carpeta_borrada: true };
            });
        }
        throw new Error(r.porque + ": sin él no borro nada");
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

  /* ------------------------------------------------------------------
     LA LISTA DE LO QUE SE PUEDE DESHACER, EN PANTALLA
     ------------------------------------------------------------------
     La pinta casa\casa.js en la mesa (es lo primero que se ve al
     abrir), para que después de recargar siga estando a mano. Todo
     como TEXTO, nunca como HTML.
     ------------------------------------------------------------------ */
  function cuenta(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function horaDe(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "en un momento que no sé leer";
    var hoy = new Date();
    var mismoDia = d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
    return (mismoDia ? "hoy" : "el " + d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear()) +
           " a las " + dd(d.getHours()) + ":" + dd(d.getMinutes());
  }
  function frase(r) {
    if (r.ya_no_estaba) return "Esa carpeta ya no está en el disco: no había nada que deshacer.";
    var t = "Deshecho: he quitado " + cuenta(r.borrados.length, "fichero", "ficheros") +
            (r.carpeta_borrada ? " y la carpeta que había creado. En tu disco no queda nada mío." : ".");
    var otros = r.respetados.filter(function (x) { return !x.a_medias; });
    if (otros.length) {
      t += " No he borrado " + cuenta(otros.length, "cosa", "cosas") + ": " +
           otros.slice(0, 4).map(function (x) { return x.a + " (" + x.por_que + ")"; }).join("; ") + ".";
    }
    if (r.a_medias && r.a_medias.length) {
      t += " Hay " + cuenta(r.a_medias.length, "fichero", "ficheros") + " a medio escribir, de 0 bytes, " +
           "que se quedaron así al cortarse la copia: " + r.a_medias.slice(0, 4).map(function (x) { return x.a; }).join(", ") + ".";
    }
    return t;
  }

  function pintarLasDeshacibles(sitio) {
    var doc = raiz && raiz.document;
    if (!doc || !sitio) return false;
    function caja(t, aviso) {
      var p = doc.createElement("p");
      p.style.cssText = "margin:0 0 8px;padding:8px 11px;border-radius:9px;font-size:13.5px;line-height:1.5;" +
        (aviso ? "border:1px solid #E0BD98;background:#FBEFE3;color:#7A4318"
               : "border:1px solid #C9D8C9;background:#F1F7F1;color:#2F5133");
      p.setAttribute("role", "status");
      p.appendChild(doc.createTextNode(t));
      return p;
    }
    function boton(t, f) {
      var b = doc.createElement("button");
      b.type = "button";
      b.textContent = t;
      b.style.cssText = "font:inherit;font-size:13.5px;font-weight:700;padding:5px 11px;margin:0 6px 6px 0;" +
        "border:1px solid #2F5133;border-radius:8px;background:#fff;color:#2F5133;cursor:pointer";
      b.addEventListener("click", f);
      return b;
    }
    var ultimo = null;           /* el último resultado, para enseñarlo tras repintar */

    function unaFila(p, conBuscar) {
      var fila = doc.createElement("div");
      var cortada = p.estado === "empezada";
      fila.appendChild(caja("«" + p.carpeta + "», " + horaDe(p.cuando) +
        (p.titulo ? " (" + p.titulo + ")" : "") +
        (cortada ? ". Esta copia NO llegó a terminar (se cortó a medias); se puede deshacer igual." : "."),
        cortada));
      fila.appendChild(boton("Deshacer esta copia", function () {
        deshacerPasada(p, null, {}).then(function (r) {
          ultimo = { p: p, r: r };
          repintar(conBuscar);
        }, function (e) {
          ultimo = { p: p, error: "No he podido deshacer: " + ((e && e.message) || e) + ". No he tocado nada." };
          repintar(conBuscar);
        });
      }));
      return fila;
    }

    function pintarUltimo(conBuscar) {
      if (!ultimo) return;
      if (ultimo.error) { sitio.appendChild(caja(ultimo.error, true)); return; }
      var r = ultimo.r, p = ultimo.p;
      sitio.appendChild(caja(frase(r), !r.carpeta_borrada));
      if (r.a_medias && r.a_medias.length) {
        sitio.appendChild(boton("Quitar también " + (r.a_medias.length === 1 ? "el fichero" : "los " + r.a_medias.length + " ficheros") +
                                " a medio escribir", function () {
          deshacerPasada(p, null, { quitar_a_medias: true }).then(function (r2) {
            ultimo = { p: p, r: r2 };
            repintar(conBuscar);
          }, function (e) {
            ultimo = { p: p, error: "No he podido: " + ((e && e.message) || e) + ". No he tocado nada." };
            repintar(conBuscar);
          });
        }));
      }
    }

    var encontradas = null;      /* lo que salió de «buscar en una carpeta» */

    function repintar() {
      return pendientes().then(function (l) {
        while (sitio.firstChild) sitio.removeChild(sitio.firstChild);
        var lista = l.slice();
        (encontradas || []).forEach(function (x) {
          if (!lista.some(function (y) { return y.carpeta === x.carpeta; })) lista.push(x);
        });
        var hay = lista.length > 0 || !!ultimo;
        sitio.style.display = hay || puedeBuscar() ? "" : "none";
        if (lista.length) {
          var h = doc.createElement("h4");
          h.textContent = "Copias ordenadas que puedes deshacer";
          h.style.cssText = "margin:10px 0 6px";
          sitio.appendChild(h);
          lista.forEach(function (p) { sitio.appendChild(unaFila(p)); });
        }
        pintarUltimo();
        if (puedeBuscar()) {
          sitio.appendChild(boton("Buscar copias ordenadas en una carpeta", function () {
            raiz.showDirectoryPicker({ mode: "readwrite" }).then(function (dest) {
              return buscarPasadasEn(dest);
            }).then(function (x) {
              encontradas = x.map(function (y) {
                return { clave: y.clave, carpeta: y.carpeta, destino: y.destino,
                         cuando: y.registro ? (y.registro.empezada || y.registro.cuando) : "",
                         titulo: y.registro ? y.registro.titulo_del_sistema : "",
                         estado: y.registro ? (y.registro.estado || "terminada") : "empezada" };
              });
              if (!encontradas.length) ultimo = { error: "En esa carpeta no hay ninguna copia ordenada de IMMO IA." };
              repintar();
            }, function (e) {
              if (e && e.name === "AbortError") return;
              ultimo = { error: "No he podido mirar esa carpeta: " + ((e && e.message) || e) };
              repintar();
            });
          }));
        }
      });
    }
    function puedeBuscar() { return !!(raiz && typeof raiz.showDirectoryPicker === "function"); }

    OYENTES.push(function () { try { repintar(); } catch (e) {} });
    repintar();
    return true;
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
    crc32: crc32,

    /* desde el 24/09 */
    huellaDe: huellaDe,
    huellaDeFichero: huellaDeFichero,
    nombreDeLaCarpetaNueva: nombreDeLaCarpetaNueva,
    leerRegistroDe: leerRegistroDe,
    buscarPasadasEn: buscarPasadasEn,
    pendientes: pendientes,
    deshacerPasada: deshacerPasada,
    pintarLasDeshacibles: pintarLasDeshacibles,
    alCambiar: function (f) { OYENTES.push(f); },

    /* para las pruebas: otra memoria en vez de IndexedDB, y la huella a mano */
    _usarMemoria: function (m) { MEMORIA = m || null; },
    _sha256aMano: sha256aMano
  };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_COPIA = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
