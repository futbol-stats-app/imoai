/* ==================================================================
   la_copia.js · LA COPIA DE SEGURIDAD DE LA AGENCIA  (23/09/2026)

   EL PROBLEMA. Hoy todo el trabajo de la agencia vive SOLO en el
   navegador de ese ordenador. Si se limpian los datos del navegador,
   se cambia de navegador o se borra el perfil, se pierde y no hay de
   dónde sacarlo. Hay exportación a mano (casa\el_almacen.js, función
   comoFichero, hacia la línea 643), pero nadie se acuerda de exportar.

   LO QUE HACE ESTE FICHERO. Guarda solo, sin que nadie se acuerde de
   nada, una copia de TODO lo que esta aplicación tiene en este
   navegador, en un sitio que aguanta que el navegador limpie sus
   datos: una carpeta del ordenador, o la carpeta de Descargas.

   NI UNA PETICIÓN A INTERNET. Aquí no hay un fetch, ni un XHR, ni un
   WebSocket, ni un sendBeacon, ni una dirección escrita. La copia no
   sale de este ordenador.

   ------------------------------------------------------------------
   QUÉ SE GUARDA: TODAS LAS LLAVES «immoia.», NO SOLO LA DE LA MESA
   ------------------------------------------------------------------
   Esto es lo que más fácil se hace mal. El trabajo de la agencia no
   está en una llave, está repartido en varias, y cada parte de la
   aplicación usa la suya:

     · immoia.secretaria.mis_expedientes.v1   las casas que mete ella
       (+ .copia_anterior)                    casa\el_almacen.js:38-39
     · immoia.cartera.v1                      los expedientes de la
       (+ .de, + .caducada)                   directora   lo_de_ella.js:37
     · immoia.autonomia.v1                    el expediente activo de
                                              la bandeja  lo_de_ella.js:38
     · immoia.mesa.v1                         «lo que llevas esta
       (+ .sello, + .de)                      semana»     lo_de_ella.js:39
     · immoia.oficina.cuenta.v1               la cuenta   lo_de_ella.js:40
     · immoia.lodeella.v1                     la marca    lo_de_ella.js:41

   Si la copia guardase solo la llave de la mesa, al recuperar se
   perdería la semana de la directora y su cartera entera. Así que
   NO se elige a mano ninguna llave: se barre el almacén y se guarda
   TODO lo que empiece por «immoia.». Lo único que se deja fuera es la
   contabilidad de este mismo fichero (immoia.copia.*), que no es
   trabajo de la agencia y que al recuperar solo estorbaría.

   ------------------------------------------------------------------
   DÓNDE SE GUARDA: LOS DOS CAMINOS, Y SE DICE CUÁL SE ESTÁ USANDO
   ------------------------------------------------------------------
   Pedirle a la persona que elija una carpeta SOLO funciona si la
   página está servida por http o https. Abierta con doble clic desde
   el disco (file://) ese camino se queda mudo: el navegador no deja
   ni preguntar. Eso ya nos mordió una vez.

     CAMINO 1 · LA CARPETA.  Página servida por http/https y navegador
       con showDirectoryPicker. Se le pide la carpeta UNA SOLA VEZ y
       se recuerda (el permiso se guarda en IndexedDB, que es el único
       sitio donde un navegador deja guardar el permiso de una
       carpeta). Desde ahí se puede además LEER las copias de vuelta,
       así que «recuperar» funciona solo, sin pedirle nada a nadie.

     CAMINO 2 · LA DESCARGA.  Todo lo demás (doble clic, file://,
       navegador sin esa función, o la persona dice que no a la
       carpeta). La copia se descarga como un fichero a la carpeta de
       Descargas. Desde ahí NO se puede leer de vuelta: para recuperar
       hay que darle el fichero a mano con «Traer una copia».

   NUNCA SE DEJA A LA AGENCIA SIN COPIA: si el camino 1 no está, se
   usa el 2. Y en pantalla se dice siempre cuál de los dos se está
   usando, con estas palabras, para que nadie se lo tenga que imaginar.

   ------------------------------------------------------------------
   CUÁNDO SE GUARDA
   ------------------------------------------------------------------
     · Al abrir, si la última copia es de hace más de una hora.
     · Como mucho una vez por hora mientras se usa.
     · Al cerrar. Con un matiz honesto, porque aquí hay una trampa de
       los navegadores: escribir en una carpeta es una operación que
       tarda, y el navegador NO espera a que termine cuando la pestaña
       se está cerrando; y una descarga lanzada en ese momento se
       bloquea. Así que «al cerrar» se hace en dos tiempos:
         - en cuanto la pestaña se esconde (visibilitychange), que
           ocurre ANTES de cerrarse y todavía da tiempo, se intenta la
           copia de verdad;
         - y en el último instante (pagehide) se deja apuntada una
           señal en el propio navegador, que es lo único que da tiempo
           a escribir ahí. La próxima vez que se abra la aplicación,
           esa señal hace que lo primero que pase sea guardar la copia
           que quedó pendiente.
       Está escrito así a propósito y está dicho en el informe.

   ------------------------------------------------------------------
   LAS TRES ÚLTIMAS, Y NINGUNA PISA A LA ANTERIOR
   ------------------------------------------------------------------
   Cada copia es un fichero nuevo con su fecha y su hora en el nombre.
   Nunca se escribe encima de una copia que ya existe y nunca se borra
   ninguna: se van quedando. Para recuperar se ofrecen las TRES más
   recientes, que es lo que pidió la dirección; las de más atrás siguen
   en la carpeta por si hicieran falta.

   ------------------------------------------------------------------
   UNA COPIA A MEDIAS NO SE TRAGA
   ------------------------------------------------------------------
   Un fichero se puede quedar a medias (se cierra el portátil mientras
   se escribe) o estropearse. Si eso se recupera a ciegas, se machaca
   el trabajo bueno con basura, que es peor que no tener copia. Así que
   cada copia lleva tres cierres, y se miran LOS TRES antes de tocar
   nada:
     1. tiene que ser un JSON entero que se pueda leer;
     2. tiene que terminar con la marca de final; si el fichero se
        cortó, la marca no está;
     3. tiene que cuadrar la cuenta de llaves y la suma de control; si
        alguien cambió un byte por dentro y el JSON sigue leyéndose,
        la suma no da.
   Si falla cualquiera de los tres, se AVISA y no se recupera nada.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.0";
  var FORMATO = "immoia.copia_de_seguridad";
  var MARCA_FIN = "IMMOIA_COPIA_COMPLETA";

  var PREFIJO = "immoia.";
  var PREFIJO_MIO = "immoia.copia.";          /* lo mío no entra en la copia */
  var LLAVE_INDICE = "immoia.copia.indice.v1";
  var LLAVE_PENDIENTE = "immoia.copia.pendiente.v1";

  var CADA_MS = 60 * 60 * 1000;               /* como mucho, una por hora */
  var CUANTAS_OFRECE = 3;                     /* las tres últimas */

  /* ------------------------------------------------------------------
     0 · UTILIDADES (ni una llamada a fuera)
     ------------------------------------------------------------------ */
  function dd(n) { return (n < 10 ? "0" : "") + n; }
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function ahoraISO() { return new Date().toISOString(); }
  function diaDe(d) { return d.getFullYear() + "-" + dd(d.getMonth() + 1) + "-" + dd(d.getDate()); }
  function hoyISO() { return diaDe(new Date()); }

  /* «hoy a las 12:40», «ayer a las 19:10», «el 21 de septiembre a las
     19:10». Se escribe como lo diría una persona, y el mes en letra:
     en esta casa una fecha no se escribe 03/10 porque ese renglón no
     dice si es el 3 de octubre o el 10 de marzo. */
  function cuando(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "en un momento que no se puede leer";
    var hora = dd(d.getHours()) + ":" + dd(d.getMinutes());
    var hoy = new Date();
    var ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
    if (diaDe(d) === diaDe(hoy)) return "hoy a las " + hora;
    if (diaDe(d) === diaDe(ayer)) return "ayer a las " + hora;
    return "el " + d.getDate() + " de " + MESES[d.getMonth()] + " a las " + hora;
  }

  /* La suma de control. No es criptografía y no pretende serlo: es
     para cazar un fichero cambiado o estropeado, no a un ladrón. */
  function sumaDe(llaves) {
    var ks = Object.keys(llaves).sort();
    var h = 5381;
    for (var i = 0; i < ks.length; i++) {
      var s = ks[i] + "\u0000" + String(llaves[ks[i]]) + "\u0001";
      for (var j = 0; j < s.length; j++) h = (((h * 33) ^ s.charCodeAt(j)) >>> 0);
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  /* ------------------------------------------------------------------
     1 · LOS AVISOS (quien pinte, que se suscriba; igual que el almacén)
     ------------------------------------------------------------------ */
  var AVISOS = [];
  function avisar(tipo, texto) {
    AVISOS.slice().forEach(function (f) { try { f(tipo, texto); } catch (e) {} });
  }

  var ESTADO = {
    camino: "ninguno",        /* "carpeta" | "descarga" | "ninguno" */
    destino: null,
    ultimo_error: null,
    ultimo_aviso: null
  };

  /* ------------------------------------------------------------------
     2 · LEER EL ALMACÉN DEL NAVEGADOR
     ------------------------------------------------------------------ */
  function almacen() {
    try { return raiz.localStorage || null; } catch (e) { return null; }
  }

  function leerLlave(k) {
    try { var s = almacen(); return s ? s.getItem(k) : null; } catch (e) { return null; }
  }
  function ponerLlave(k, v) {
    try { var s = almacen(); if (!s) return false; s.setItem(k, v); return true; } catch (e) { return false; }
  }

  /* TODAS las llaves «immoia.» menos las mías. Se barre el almacén
     entero: no se escribe a mano ninguna lista de llaves, porque el día
     que alguien añada una llave nueva nadie se acordaría de tocar esta
     lista y esa parte del trabajo se quedaría fuera de la copia sin que
     se note. */
  function llavesDeLaAgencia() {
    var s = almacen();
    var fuera = {};
    if (!s) return fuera;
    var n = 0;
    try { n = s.length; } catch (e) { return fuera; }
    for (var i = 0; i < n; i++) {
      var k = null;
      try { k = s.key(i); } catch (e) { continue; }
      if (k == null) continue;
      if (String(k).indexOf(PREFIJO) !== 0) continue;
      if (String(k).indexOf(PREFIJO_MIO) === 0) continue;
      if (/\.prueba$/.test(String(k))) continue;      /* el sondeo del almacén */
      var v = null;
      try { v = s.getItem(k); } catch (e) { continue; }
      if (v != null) fuera[k] = v;
    }
    return fuera;
  }

  /* Cuántas casas hay ahí dentro. Se cuentan las dos carteras que
     existen hoy: la mesa de ella (el_almacen.js) y la de la directora
     (lo_de_ella.js). Si mañana hay otra, esta cuenta se queda corta;
     la copia en cambio NO, porque la copia no mira esta función. */
  function contarCasas(llaves) {
    var n = 0;
    try {
      var a = JSON.parse(llaves["immoia.secretaria.mis_expedientes.v1"] || "null");
      if (a && Object.prototype.toString.call(a.expedientes) === "[object Array]") n += a.expedientes.length;
      if (a && Object.prototype.toString.call(a.archivados) === "[object Array]") n += a.archivados.length;
    } catch (e) {}
    try {
      var c = JSON.parse(llaves["immoia.cartera.v1"] || "null");
      if (c && c.exp && typeof c.exp === "object") n += Object.keys(c.exp).length;
    } catch (e) {}
    return n;
  }
  function casasAhora() { return contarCasas(llavesDeLaAgencia()); }

  /* ------------------------------------------------------------------
     3 · HACER UNA COPIA (el objeto, todavía sin escribirlo)
     ------------------------------------------------------------------ */
  function armar() {
    var llaves = llavesDeLaAgencia();
    var copia = {
      formato: FORMATO,
      version: 1,
      hecha: ahoraISO(),
      de: "IMMO IA · la mesa de esta agencia, en este ordenador",
      llaves: llaves,
      cuantas_llaves: Object.keys(llaves).length,
      cuantas_casas: contarCasas(llaves),
      suma: sumaDe(llaves),
      fin: MARCA_FIN
    };
    return copia;
  }

  /* EL NOMBRE LLEVA HASTA LAS MILÉSIMAS, Y NO ES UN CAPRICHO. Al
     escribir en una carpeta, el navegador VACÍA el fichero si ya
     existe uno con ese nombre. O sea: dos copias con el mismo nombre
     no son dos copias, son una copia perdida. Con la fecha, la hora,
     los segundos y las milésimas, dos copias no pueden llamarse igual,
     y así ninguna pisa a la anterior. */
  function nombreDe(copia) {
    var d = new Date(copia.hecha);
    if (isNaN(d.getTime())) d = new Date();
    var ms = ("00" + d.getMilliseconds()).slice(-3);
    return "immoia-copia-" + d.getFullYear() + dd(d.getMonth() + 1) + dd(d.getDate()) +
           "-" + dd(d.getHours()) + dd(d.getMinutes()) + dd(d.getSeconds()) + "-" + ms + ".json";
  }

  /* ------------------------------------------------------------------
     4 · MIRAR UNA COPIA ANTES DE CREÉRSELA
     ------------------------------------------------------------------
     Devuelve {ok:true, copia} o {ok:false, porque}. Nunca lanza.
     ------------------------------------------------------------------ */
  function revisar(texto) {
    var crudo = String(texto == null ? "" : texto);
    if (!crudo.trim()) {
      return { ok: false, porque: "Ese fichero está vacío. No es una copia de IMMO IA y no toco nada." };
    }
    var x;
    try { x = JSON.parse(crudo); }
    catch (e) {
      return { ok: false, porque: "Esa copia está a medias o estropeada: no se puede leer entera " +
               "(seguramente se cortó mientras se guardaba). NO he tocado nada de lo que tienes ahora. " +
               "Prueba con otra de las copias." };
    }
    if (!x || typeof x !== "object" || x.formato !== FORMATO) {
      return { ok: false, porque: "Ese fichero no es una copia de seguridad de IMMO IA. No toco nada." };
    }
    if (x.fin !== MARCA_FIN) {
      return { ok: false, porque: "Esa copia está a medias: le falta la marca del final, así que se cortó " +
               "mientras se guardaba. NO la traigo, porque traería un trabajo incompleto encima del bueno. " +
               "Prueba con otra de las copias." };
    }
    if (!x.llaves || typeof x.llaves !== "object") {
      return { ok: false, porque: "Esa copia no trae nada dentro. No toco nada." };
    }
    var cuantas = Object.keys(x.llaves).length;
    if (typeof x.cuantas_llaves === "number" && x.cuantas_llaves !== cuantas) {
      return { ok: false, porque: "Esa copia está incompleta: decía traer " + x.cuantas_llaves +
               " partes y trae " + cuantas + ". NO la traigo. Prueba con otra de las copias." };
    }
    if (typeof x.suma === "string" && x.suma !== sumaDe(x.llaves)) {
      return { ok: false, porque: "Esa copia está estropeada: la suma de control no cuadra, o sea que " +
               "algo ha cambiado dentro del fichero desde que se guardó. NO la traigo, porque no me fío " +
               "de lo que hay dentro. Prueba con otra de las copias." };
    }
    return { ok: true, copia: x };
  }

  /* ------------------------------------------------------------------
     5 · LOS DOS CAMINOS
     ------------------------------------------------------------------
     Un destino es: { como, comoSeLlama, puedeLeer, escribir, listar, leer }
     escribir/listar/leer devuelven promesas. Así los dos caminos (y el
     de las pruebas) se usan exactamente igual desde arriba.
     ------------------------------------------------------------------ */

  /* --- CAMINO 2 · LA DESCARGA (siempre disponible en un navegador) --- */
  function destinoDescarga() {
    return {
      como: "descarga",
      comoSeLlama: "la carpeta de Descargas de este ordenador",
      puedeLeer: false,
      escribir: function (nombre, texto) {
        return new Promise(function (listo, falla) {
          try {
            var B = raiz.Blob, U = raiz.URL || raiz.webkitURL, doc = raiz.document;
            if (!B || !U || !doc) return falla(new Error("este navegador no sabe descargar ficheros"));
            var trozo = new B([texto], { type: "application/json" });
            var url = U.createObjectURL(trozo);
            var a = doc.createElement("a");
            a.href = url; a.download = nombre;
            a.style.display = "none";
            doc.body.appendChild(a);
            a.click();
            doc.body.removeChild(a);
            raiz.setTimeout(function () { try { U.revokeObjectURL(url); } catch (e) {} }, 30000);
            listo(nombre);
          } catch (e) { falla(e); }
        });
      },
      /* de Descargas no se puede leer de vuelta: lo prohíbe el
         navegador, y con razón. Para recuperar hay que darle el
         fichero a mano. Se dice, no se disimula. */
      listar: function () { return Promise.resolve([]); },
      leer: function () { return Promise.reject(new Error("de la carpeta de Descargas no puedo leer solo")); }
    };
  }

  /* --- CAMINO 1 · LA CARPETA ELEGIDA --- */
  /* El permiso de una carpeta no cabe en localStorage (no es texto):
     el único sitio donde un navegador lo deja guardar es IndexedDB. */
  var BD = "immoia.copia", ALMACENCILLO = "carpetas", QUE = "la_carpeta";
  function abrirBD() {
    return new Promise(function (listo, falla) {
      var I = raiz.indexedDB;
      if (!I) return falla(new Error("sin indexedDB"));
      var p = I.open(BD, 1);
      p.onupgradeneeded = function () {
        try { p.result.createObjectStore(ALMACENCILLO); } catch (e) {}
      };
      p.onsuccess = function () { listo(p.result); };
      p.onerror = function () { falla(p.error || new Error("no se puede abrir indexedDB")); };
    });
  }
  function guardarCarpeta(h) {
    return abrirBD().then(function (db) {
      return new Promise(function (listo, falla) {
        var t = db.transaction(ALMACENCILLO, "readwrite");
        t.objectStore(ALMACENCILLO).put(h, QUE);
        t.oncomplete = function () { listo(true); };
        t.onerror = function () { falla(t.error); };
      });
    });
  }
  function traerCarpeta() {
    return abrirBD().then(function (db) {
      return new Promise(function (listo) {
        var t = db.transaction(ALMACENCILLO, "readonly");
        var r = t.objectStore(ALMACENCILLO).get(QUE);
        r.onsuccess = function () { listo(r.result || null); };
        r.onerror = function () { listo(null); };
      });
    }).catch(function () { return null; });
  }

  function destinoCarpeta(h) {
    return {
      como: "carpeta",
      comoSeLlama: "la carpeta que elegiste" + (h && h.name ? " («" + h.name + "»)" : ""),
      puedeLeer: true,
      escribir: function (nombre, texto) {
        /* create:true crea el fichero; como el nombre lleva la hora y
           los segundos, nunca coincide con uno que ya esté: no se
           escribe encima de ninguna copia anterior. */
        return h.getFileHandle(nombre, { create: true }).then(function (f) {
          return f.createWritable().then(function (w) {
            return w.write(texto).then(function () { return w.close(); });
          });
        }).then(function () { return nombre; });
      },
      listar: function () {
        var fuera = [];
        return (function vuelta(it) {
          return it.next().then(function (paso) {
            if (paso.done) return fuera;
            var nombre = paso.value[0];
            if (/^immoia-copia-.*\.json$/.test(nombre)) fuera.push(nombre);
            return vuelta(it);
          });
        })(h.entries()).then(function (l) { return l.sort().reverse(); });
      },
      leer: function (nombre) {
        return h.getFileHandle(nombre).then(function (f) { return f.getFile(); })
                .then(function (fi) { return fi.text(); });
      }
    };
  }

  /* ¿Se puede siquiera preguntar por una carpeta? Solo con la página
     servida por http/https. Con doble clic (file://) no, y preguntarlo
     ahí no da error: se queda mudo, que es peor. */
  function laCarpetaEsPosible() {
    try {
      if (typeof raiz.showDirectoryPicker !== "function") return false;
      var p = raiz.location && raiz.location.protocol;
      return p === "http:" || p === "https:";
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------
     6 · ELEGIR EL CAMINO Y DECIRLO
     ------------------------------------------------------------------ */
  function ponerDestino(d) {
    ESTADO.destino = d;
    ESTADO.camino = d ? d.como : "ninguno";
    return d;
  }

  /* Al arrancar: si ya había carpeta elegida de otro día, se usa sin
     preguntar nada. Si no, se usa la descarga, que no pide permiso a
     nadie. La agencia nunca se queda sin copia. */
  function arrancarDestino() {
    /* si ya hay destino puesto a mano (el laboratorio lo hace), se
       respeta: arrancar no le quita a nadie el destino que ya eligió */
    if (ESTADO.destino) return Promise.resolve(ESTADO.destino);
    if (!laCarpetaEsPosible()) return Promise.resolve(ponerDestino(destinoDescarga()));
    return traerCarpeta().then(function (h) {
      if (!h) return ponerDestino(destinoDescarga());
      /* ¿sigue valiendo el permiso? si hay que volver a pedirlo hace
         falta que la persona haga clic, así que hoy se tira de descarga
         y se le ofrece re-elegir la carpeta. */
      if (typeof h.queryPermission !== "function") return ponerDestino(destinoCarpeta(h));
      return h.queryPermission({ mode: "readwrite" }).then(function (e) {
        return ponerDestino(e === "granted" ? destinoCarpeta(h) : destinoDescarga());
      }).catch(function () { return ponerDestino(destinoDescarga()); });
    }).catch(function () { return ponerDestino(destinoDescarga()); });
  }

  /* SE LE PIDE UNA SOLA VEZ. Esto necesita un clic de la persona: los
     navegadores no dejan abrir el elegir-carpeta sin que se haya
     pulsado algo. */
  function elegirCarpeta() {
    if (!laCarpetaEsPosible()) {
      var t = "Esta página está abierta con doble clic desde el disco, y así el navegador no deja " +
              "elegir una carpeta. Mientras tanto, la copia se descarga a la carpeta de Descargas: " +
              "no te quedas sin copia. Cuando la aplicación esté publicada en una dirección de " +
              "internet, este botón funcionará.";
      ESTADO.ultimo_aviso = t;
      avisar("aviso", t);
      return Promise.resolve({ ok: false, porque: t });
    }
    return raiz.showDirectoryPicker({ mode: "readwrite", id: "immoia-copias" }).then(function (h) {
      return guardarCarpeta(h).then(function () {
        ponerDestino(destinoCarpeta(h));
        var t = "Hecho: a partir de ahora la copia se guarda sola en " + ESTADO.destino.comoSeLlama +
                ". No hace falta volver a elegirla.";
        ESTADO.ultimo_aviso = t;
        avisar("hecho", t);
        return { ok: true };
      });
    }).catch(function (e) {
      var t = "No se ha elegido carpeta" + (e && e.name === "AbortError" ? "" : " (" + (e && e.message ? e.message : e) + ")") +
              ". La copia se sigue descargando a la carpeta de Descargas: no te quedas sin copia.";
      ESTADO.ultimo_aviso = t;
      avisar("aviso", t);
      return { ok: false, porque: t };
    });
  }

  /* La frase de pantalla que dice POR DÓNDE va la copia. */
  function elCamino() {
    if (ESTADO.camino === "carpeta") {
      return { camino: "carpeta", aviso: false,
               texto: "Las copias se guardan solas en " + ESTADO.destino.comoSeLlama + ", en este ordenador." };
    }
    if (ESTADO.camino === "descarga") {
      return { camino: "descarga", aviso: true,
               texto: laCarpetaEsPosible()
                 ? "Las copias se descargan a la carpeta de Descargas. Si eliges una carpeta, se guardan solas ahí y además se pueden recuperar sin buscar el fichero."
                 : "Esta página está abierta desde el disco, así que las copias se descargan a la carpeta de Descargas. Para recuperar hay que darle el fichero a mano." };
    }
    return { camino: "ninguno", aviso: true,
             texto: "TODAVÍA NO HAY DÓNDE GUARDAR LA COPIA. Avisa: así el trabajo de la agencia no está a salvo." };
  }

  /* ------------------------------------------------------------------
     7 · EL ÍNDICE (para la línea de pantalla y para el reloj)
     Vive en el navegador y por tanto se pierde si se limpian los datos.
     Es a propósito: es solo para saber cuándo tocó la última, no para
     guardar nada. Lo que de verdad aguanta son los ficheros.
     ------------------------------------------------------------------ */
  function indice() {
    try {
      var x = JSON.parse(leerLlave(LLAVE_INDICE) || "null");
      if (x && typeof x === "object" && Object.prototype.toString.call(x.copias) === "[object Array]") return x;
    } catch (e) {}
    return { copias: [] };
  }
  function apuntarEnIndice(copia, nombre, donde) {
    var x = indice();
    x.copias.push({ nombre: nombre, hecha: copia.hecha, casas: copia.cuantas_casas,
                    llaves: copia.cuantas_llaves, donde: donde });
    /* el índice se queda con las últimas 20 anotaciones; esto NO borra
       ninguna copia, solo recorta la libreta */
    if (x.copias.length > 20) x.copias = x.copias.slice(-20);
    ponerLlave(LLAVE_INDICE, JSON.stringify(x));
    return x;
  }
  function laUltima() {
    var c = indice().copias;
    return c.length ? c[c.length - 1] : null;
  }

  /* LA LÍNEA DE PANTALLA. En color de aviso si no hay copia de hoy. */
  function laLinea() {
    var u = laUltima();
    if (!u) {
      return { aviso: true, texto: "Todavía no hay ninguna copia guardada de este trabajo." };
    }
    var deHoy = String(u.hecha).slice(0, 10) === hoyISO();
    return {
      aviso: !deHoy,
      texto: "Última copia guardada: " + cuando(u.hecha) +
             " (" + u.casas + (u.casas === 1 ? " casa" : " casas") + ")" +
             (deHoy ? "." : ". NO hay copia de hoy.")
    };
  }

  /* ------------------------------------------------------------------
     8 · GUARDAR UNA COPIA
     ------------------------------------------------------------------ */
  var guardando = false;

  function guardar(porque) {
    if (guardando) return Promise.resolve({ ok: false, porque: "ya se está guardando una copia" });
    if (!ESTADO.destino) {
      var t0 = "No hay dónde guardar la copia.";
      ESTADO.ultimo_error = t0; avisar("error", t0);
      return Promise.resolve({ ok: false, porque: t0 });
    }
    var copia = armar();
    if (copia.cuantas_llaves === 0) {
      /* no hay nada que copiar: no se escribe un fichero vacío que
         mañana alguien podría recuperar encima de trabajo bueno */
      return Promise.resolve({ ok: false, porque: "Todavía no hay nada que copiar." });
    }
    var texto = JSON.stringify(copia);
    var nombre = nombreDe(copia);
    guardando = true;
    return ESTADO.destino.escribir(nombre, texto).then(function () {
      guardando = false;
      apuntarEnIndice(copia, nombre, ESTADO.camino);
      try { almacen().removeItem(LLAVE_PENDIENTE); } catch (e) {}
      ESTADO.ultimo_error = null;
      avisar("copia", "Copia guardada en " + ESTADO.destino.comoSeLlama + " (" + copia.cuantas_casas + " casas).");
      return { ok: true, nombre: nombre, casas: copia.cuantas_casas, llaves: copia.cuantas_llaves,
               donde: ESTADO.camino, porque: porque || "a mano" };
    }).catch(function (e) {
      guardando = false;
      var t = "NO SE HA PODIDO GUARDAR LA COPIA: " + (e && e.message ? e.message : e) +
              ". Tu trabajo sigue donde estaba y no se ha perdido nada, pero AHORA MISMO NO HAY COPIA " +
              "NUEVA. Prueba a elegir otra carpeta o a guardar una copia a mano.";
      ESTADO.ultimo_error = t;
      avisar("error", t);
      return { ok: false, porque: t };
    });
  }

  /* ¿toca? Como mucho una por hora de uso. */
  function tocaCopia() {
    var u = laUltima();
    if (!u) return true;
    var t = new Date(u.hecha).getTime();
    if (isNaN(t)) return true;
    return (Date.now() - t) >= CADA_MS;
  }
  function quizaGuardar(porque) {
    if (!tocaCopia()) return Promise.resolve({ ok: false, porque: "todavía no toca: hace menos de una hora de la última" });
    return guardar(porque);
  }

  /* ------------------------------------------------------------------
     9 · LAS TRES ÚLTIMAS, PARA ELEGIR
     ------------------------------------------------------------------ */
  function lasQueHay() {
    if (!ESTADO.destino) return Promise.resolve([]);
    if (!ESTADO.destino.puedeLeer) {
      /* de Descargas no se puede listar: se dice, y se tira de la
         libreta solo para enseñar QUÉ copias se hicieron */
      return Promise.resolve(indice().copias.slice(-CUANTAS_OFRECE).reverse().map(function (c) {
        return { nombre: c.nombre, hecha: c.hecha, casas: c.casas, cuando: cuando(c.hecha), a_mano: true };
      }));
    }
    return ESTADO.destino.listar().then(function (nombres) {
      return nombres.slice(0, CUANTAS_OFRECE).map(function (n) {
        var a = indice().copias.filter(function (c) { return c.nombre === n; })[0];
        return { nombre: n, hecha: a ? a.hecha : null, casas: a ? a.casas : null,
                 cuando: a ? cuando(a.hecha) : "de antes", a_mano: false };
      });
    }).catch(function () { return []; });
  }

  /* ------------------------------------------------------------------
     10 · RECUPERAR · PRIMERO SE DICE QUÉ VA A PASAR
     ------------------------------------------------------------------
     La dirección lo pidió con estas palabras: «que ANTES de recuperar
     diga exactamente qué va a pasar». Así que esto va en dos pasos y el
     primero no toca nada.
     ------------------------------------------------------------------ */

  /* Paso 1: mirar la copia y decir la frase. NO toca nada. */
  function queVaAPasar(texto) {
    var r = revisar(texto);
    if (!r.ok) return { ok: false, porque: r.porque };
    var copia = r.copia;
    var ahora = casasAhora();
    var luego = typeof copia.cuantas_casas === "number" ? copia.cuantas_casas : contarCasas(copia.llaves);
    var frase = "Vas a sustituir " + ahora + (ahora === 1 ? " casa" : " casas") +
                " por " + (luego === 1 ? "la " : "las ") + luego +
                " de " + cuando(copia.hecha) + ".";
    if (ahora > luego) {
      frase += " OJO: ahora tienes MÁS casas que esa copia. Si sigues, " +
               "lo que hayas hecho después de " + cuando(copia.hecha) + " deja de estar en pantalla.";
    }
    frase += " Antes de tocar nada guardo una copia de lo que tienes ahora mismo, " +
             "así que esto se puede deshacer.";
    return { ok: true, copia: copia, casas_ahora: ahora, casas_luego: luego, frase: frase };
  }

  /* Paso 2: hacerlo. Hace falta la palabra «confirmado», igual que para
     borrar en el almacén: así ningún clic suelto sustituye el trabajo
     de la agencia. */
  function recuperar(texto, confirmado) {
    if (confirmado !== "confirmado") {
      return Promise.resolve({ ok: false, porque: "Para recuperar hay que confirmarlo. Antes te digo qué va a pasar." });
    }
    var v = queVaAPasar(texto);
    if (!v.ok) {
      ESTADO.ultimo_error = v.porque;
      avisar("error", v.porque);
      return Promise.resolve(v);
    }
    var copia = v.copia;

    /* LA RED DE SEGURIDAD: una copia de lo de AHORA antes de tocar. Si
       no se puede guardar, se sigue igual (recuperar es lo que ha
       pedido la persona) pero SE DICE. */
    return guardar("antes de recuperar").catch(function () { return { ok: false }; }).then(function (previa) {
      var s = almacen();
      if (!s) {
        var t = "No puedo escribir en este navegador, así que no he recuperado nada.";
        ESTADO.ultimo_error = t; avisar("error", t);
        return { ok: false, porque: t };
      }
      var puestas = 0, fallaron = [];
      Object.keys(copia.llaves).forEach(function (k) {
        try { s.setItem(k, copia.llaves[k]); puestas++; }
        catch (e) { fallaron.push(k); }
      });
      if (fallaron.length) {
        var t2 = "RECUPERADO A MEDIAS: han entrado " + puestas + " partes de " +
                 Object.keys(copia.llaves).length + ", y " + fallaron.length +
                 " no han cabido (el navegador dice que no hay espacio). Mira la pantalla antes de seguir.";
        ESTADO.ultimo_error = t2; avisar("error", t2);
        return { ok: false, porque: t2, puestas: puestas, fallaron: fallaron };
      }
      /* Si el almacén de la mesa está cargado en esta misma ventana, se
         le dice que vuelva a leer: el aviso de «otra ventana ha
         guardado» NO salta en la ventana que escribe, así que sin esto
         la pantalla se quedaría enseñando lo viejo después de
         recuperar, que es justo la clase de mentira que esta casa no
         permite. Va envuelto: si el almacén no está, no pasa nada. */
      var releido = false;
      try {
        var AL = raiz.IMMOIA_ALMACEN;
        if (AL && typeof AL.releer === "function") releido = !!AL.releer();
      } catch (e) {}

      var casas = contarCasas(copia.llaves);
      var t3 = "Recuperado: " + casas + (casas === 1 ? " casa" : " casas") +
               " de la copia de " + cuando(copia.hecha) + "." +
               (previa && previa.ok ? " Lo que tenías antes ha quedado guardado en otra copia." :
                " (No he podido guardar antes una copia de lo que tenías: si te hace falta, dilo.)") +
               " Cierra y vuelve a abrir la aplicación para verlo todo al día.";
      ESTADO.ultimo_error = null;
      avisar("recuperado", t3);
      return { ok: true, casas: casas, llaves: puestas, texto: t3, releido: releido,
               copia_previa: previa && previa.ok ? previa.nombre : null };
    });
  }

  /* Recuperar una de las que están en la carpeta, por su nombre. */
  function queVaAPasarCon(nombre) {
    if (!ESTADO.destino || !ESTADO.destino.puedeLeer) {
      return Promise.resolve({ ok: false, porque: "Desde la carpeta de Descargas no puedo leer las copias solo: " +
                               "dale al botón «Traer una copia» y elige el fichero a mano." });
    }
    return ESTADO.destino.leer(nombre).then(function (t) { return queVaAPasar(t); })
      .catch(function (e) { return { ok: false, porque: "No he podido abrir esa copia: " + (e && e.message ? e.message : e) }; });
  }
  function recuperarDe(nombre, confirmado) {
    if (!ESTADO.destino || !ESTADO.destino.puedeLeer) {
      return Promise.resolve({ ok: false, porque: "Desde la carpeta de Descargas no puedo leer las copias solo: " +
                               "dale al botón «Traer una copia» y elige el fichero a mano." });
    }
    return ESTADO.destino.leer(nombre).then(function (t) { return recuperar(t, confirmado); })
      .catch(function (e) { return { ok: false, porque: "No he podido abrir esa copia: " + (e && e.message ? e.message : e) }; });
  }

  /* ------------------------------------------------------------------
     11 · CUÁNDO SE DISPARA SOLA
     ------------------------------------------------------------------ */
  function pendienteApuntada() { return leerLlave(LLAVE_PENDIENTE) != null; }

  function engancharse() {
    try {
      /* Al esconderse la pestaña. Esto pasa ANTES de cerrarse y aquí
         todavía da tiempo a escribir de verdad. */
      raiz.document.addEventListener("visibilitychange", function () {
        if (raiz.document.visibilityState === "hidden") { quizaGuardar("al esconderse la pestaña"); }
      });
    } catch (e) {}
    try {
      /* El último instante. Aquí ya NO da tiempo a escribir en la
         carpeta ni a lanzar una descarga: lo único que cabe es dejar
         una señal, y guardarla al abrir. */
      raiz.addEventListener("pagehide", function () {
        try { ponerLlave(LLAVE_PENDIENTE, ahoraISO()); } catch (e) {}
      });
    } catch (e) {}
    try {
      raiz.setInterval(function () { quizaGuardar("la hora de uso"); }, 5 * 60 * 1000);
    } catch (e) {}
  }

  /* ------------------------------------------------------------------
     12 · ARRANCAR
     ------------------------------------------------------------------ */
  function arrancar() {
    return arrancarDestino().then(function () {
      var habia = pendienteApuntada();
      engancharse();
      /* si quedó una copia pendiente de la última vez que se cerró, o
         si hace más de una hora de la última, se hace ahora */
      if (habia) return guardar("quedó pendiente al cerrar");
      return quizaGuardar("al abrir");
    });
  }

  /* ------------------------------------------------------------------
     13 · PINTARLO EN PANTALLA
     ------------------------------------------------------------------
     Se le da el id de un hueco del HTML y pinta ahí la línea de la
     última copia, la línea del camino que se está usando y los botones.
     Todo como TEXTO, nunca como HTML.
     ------------------------------------------------------------------ */
  function pintarEn(id) {
    var doc = raiz.document;
    if (!doc) return false;
    var sitio = doc.getElementById(id);
    if (!sitio) return false;

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

    function repintar() {
      sitio.innerHTML = "";
      var l = laLinea(), c = elCamino();
      sitio.appendChild(caja(l.texto, l.aviso));
      sitio.appendChild(caja(c.texto, c.aviso));
      if (ESTADO.ultimo_error) sitio.appendChild(caja(ESTADO.ultimo_error, true));

      sitio.appendChild(boton("Guardar una copia ahora", function () {
        guardar("a mano").then(repintar);
      }));
      if (laCarpetaEsPosible() && ESTADO.camino !== "carpeta") {
        sitio.appendChild(boton("Elegir la carpeta (una sola vez)", function () {
          elegirCarpeta().then(repintar);
        }));
      }
      sitio.appendChild(boton("Recuperar una copia", function () {
        lasQueHay().then(function (l) {
          if (!l.length) {
            sitio.appendChild(caja("Todavía no hay ninguna copia que recuperar.", true));
            return;
          }
          if (l[0].a_mano) {
            traerAMano(repintar);
            return;
          }
          /* se pregunta ANTES, con la frase exacta de qué va a pasar */
          queVaAPasarCon(l[0].nombre).then(function (v) {
            if (!v.ok) { sitio.appendChild(caja(v.porque, true)); return; }
            if (raiz.confirm(v.frase + "\n\n¿Sigo?")) {
              recuperarDe(l[0].nombre, "confirmado").then(function (r) {
                sitio.appendChild(caja(r.ok ? r.texto : r.porque, !r.ok));
              });
            }
          });
        });
      }));
      sitio.appendChild(boton("Traer una copia de un fichero", function () { traerAMano(repintar); }));
    }

    function traerAMano(luego) {
      var inp = doc.createElement("input");
      inp.type = "file"; inp.accept = ".json,application/json";
      inp.style.display = "none";
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        f.text().then(function (t) {
          var v = queVaAPasar(t);
          if (!v.ok) { sitio.appendChild(caja(v.porque, true)); return; }
          if (raiz.confirm(v.frase + "\n\n¿Sigo?")) {
            recuperar(t, "confirmado").then(function (r) {
              sitio.appendChild(caja(r.ok ? r.texto : r.porque, !r.ok));
              if (luego) luego();
            });
          }
        });
      });
      doc.body.appendChild(inp);
      inp.click();
      raiz.setTimeout(function () { try { doc.body.removeChild(inp); } catch (e) {} }, 60000);
    }

    repintar();
    AVISOS.push(function () { try { repintar(); } catch (e) {} });
    return true;
  }

  /* ------------------------------------------------------------------
     14 · LA PUERTA
     ------------------------------------------------------------------ */
  var API = {
    version: VERSION,
    FORMATO: FORMATO,
    CADA_MS: CADA_MS,
    CUANTAS_OFRECE: CUANTAS_OFRECE,

    arrancar: arrancar,
    guardar: guardar,
    quizaGuardar: quizaGuardar,
    tocaCopia: tocaCopia,

    armar: armar,
    revisar: revisar,
    queVaAPasar: queVaAPasar,
    queVaAPasarCon: queVaAPasarCon,
    recuperar: recuperar,
    recuperarDe: recuperarDe,

    lasQueHay: lasQueHay,
    laLinea: laLinea,
    elCamino: elCamino,
    elegirCarpeta: elegirCarpeta,
    laCarpetaEsPosible: laCarpetaEsPosible,

    llavesDeLaAgencia: llavesDeLaAgencia,
    casasAhora: casasAhora,
    pintarEn: pintarEn,
    alAvisar: function (f) { AVISOS.push(f); },
    ultimoError: function () { return ESTADO.ultimo_error; },

    /* para el laboratorio: poner un destino de mentira y mirar dentro */
    _usarDestino: function (d) { return ponerDestino(d); },
    _destinoDescarga: destinoDescarga,
    _indice: indice,
    _sumaDe: sumaDe,
    _cuando: cuando
  };

  raiz.IMMOIA_LA_COPIA = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  /* ------------------------------------------------------------------
     15 · ENCHUFARSE SOLA A LA PANTALLA
     ------------------------------------------------------------------
     Si en el HTML hay un hueco con id «la_copia», esta pieza arranca y
     se pinta ahí ella sola.

     POR QUÉ ASÍ, Y NO LLAMÁNDOLA DESDE casa\casa.js O DESDE
     wow\pantalla.js, QUE SERÍA LO NORMAL: hoy, 23/09/2026, otra
     pestaña está tocando LA_SECRETARIA.html, wow\pantalla.js y
     wow\la_voz.js. Cuantos menos ficheros toquemos los dos, menos
     posibilidades de pisarnos. Haciéndolo así, el HTML solo necesita
     DOS renglones sueltos —el hueco y el <script>— y NO hay que tocar
     ni un fichero de JavaScript de la casa.

     Si el hueco no está, esto no hace nada: se queda quieta y quien la
     use la arranca a mano con arrancar() y pintarEn(). Eso es lo que
     pasa en el laboratorio, donde no hay pantalla.
     ------------------------------------------------------------------ */
  var HUECO = "la_copia";
  function enchufarSolo() {
    try {
      if (!raiz.document || typeof raiz.document.getElementById !== "function") return false;
      if (!raiz.document.getElementById(HUECO)) return false;
      arrancar().then(function () { try { pintarEn(HUECO); } catch (e) {} },
                      function () { try { pintarEn(HUECO); } catch (e) {} });
      return true;
    } catch (e) { return false; }
  }
  API.enchufarSolo = enchufarSolo;
  API.HUECO = HUECO;

  try {
    if (raiz.document && raiz.document.readyState === "loading") {
      raiz.document.addEventListener("DOMContentLoaded", enchufarSolo);
    } else {
      enchufarSolo();
    }
  } catch (e) {}
})(typeof window !== "undefined" ? window : this);
