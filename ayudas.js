/* ============================================================
   ayudas.js — LAS AYUDAS DE TODA ESPAÑA, AL INSTANTE
   ------------------------------------------------------------
   Desde el 18/09/2026 las 293 fichas viven en UN solo sitio:
   ayudas_todas.js. Ni index.html ni asistente.html guardan copia.
   Este fichero sigue leyendo de ahí exactamente igual que antes.
   ------------------------------------------------------------
   La IA del cliente NO sale a internet. Lee de aquí.
   Cada comunidad tiene su fichero en ayudas/<codigo>.json y solo
   se descarga el de la comunidad del cliente (41 KB el mayor).

   Cómo se usa:
       await IMMOIA_AYUDAS.cargar("ga");     // Galicia
       IMMOIA_AYUDAS.para("ga")              // las que le sirven
       IMMOIA_AYUDAS.paraLaIA("ga")          // texto corto para el prompt

   Cada ayuda lleva caduca_en: "dias" | "semanas" | "anos".
   Las de "dias" NO se afirman nunca sin confirmarlas antes.
   ============================================================ */

(function (global) {
  "use strict";

  /* las claves cortas de datos.js -> el codigo INE de la comunidad */
  var INE = {
    an:"01", ar:"02", as:"03", ib:"04", cn:"05", ct:"06", cl:"07", cm:"08", ca:"09",
    vc:"10", ex:"11", ga:"12", ma:"13", mu:"14", na:"15", pv:"16", ri:"17",
    ce:"18", me:"19"   /* L-34: Ceuta y Melilla. Hoy no hay fichas suyas: solo les salen las estatales, y se dice */
  };

  var CARPETA = "ayudas/";
  var cache = {};          /* lo ya descargado, para no pedirlo dos veces */
  var enVuelo = {};

  function codigo(ccaa) {
    if (!ccaa) return null;
    var c = String(ccaa).toLowerCase();
    return INE[c] || (/^\d{2}$/.test(c) ? c : null);
  }

  /* Descarga el fichero de una comunidad (y el estatal, que vale para todos).
     Si esta cargado ayudas_todas.js (el archivo unico), tira de ahi y no pide nada:
     asi funciona aunque la carpeta ayudas/ no se haya llegado a subir. */
  function cargar(ccaa) {
    var cod = codigo(ccaa);
    var quiero = cod ? [cod, "ES"] : ["ES"];

    var TODAS = global.IMMOIA_AYUDAS_TODAS;
    if (TODAS) {
      quiero.forEach(function (k) {
        if (!cache[k] && TODAS[k]) cache[k] = { ayudas: TODAS[k], origen: "archivo unico" };
      });
      return Promise.resolve(para(ccaa));
    }

    return Promise.all(quiero.map(function (k) {
      if (cache[k]) return Promise.resolve(cache[k]);
      if (enVuelo[k]) return enVuelo[k];
      enVuelo[k] = fetch(CARPETA + k + ".json", { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error("no encontrado: " + k); return r.json(); })
        .then(function (j) { cache[k] = j; delete enVuelo[k]; return j; })
        .catch(function (e) { delete enVuelo[k]; cache[k] = { ayudas: [], error: String(e) }; return cache[k]; });
      return enVuelo[k];
    })).then(function () { return para(ccaa); });
  }

  /* Lo que hay cargado para esa comunidad, ordenado por lo que más importa. */
  function para(ccaa) {
    var cod = codigo(ccaa);
    var lista = [];
    if (cod && cache[cod]) lista = lista.concat(cache[cod].ayudas || []);
    if (cache.ES) lista = lista.concat(cache.ES.ayudas || []);
    return lista;
  }

  /* Solo las que puede pedir hoy o siempre. Las cerradas no se le ofrecen.
     Tampoco lo que la propia ficha dice que no es una ayuda que se pida
     (un plan no vigente, lo que piden los ayuntamientos o los promotores,
     un precio de vivienda protegida...): es la MISMA regla que usa la
     calculadora de la portada, y vive en ayudas_todas.js. */
  function noEsUnaAyuda(a) {
    var regla = global.IMMOIA_NO_ES_AYUDA;
    return typeof regla === "function" ? !!regla(a) : false;
  }
  function vivas(ccaa) {
    return para(ccaa).filter(function (a) {
      return (a.estado === "abierta" || a.estado === "permanente" || a.estado === "pendiente") &&
             !noEsUnaAyuda(a);
    });
  }

  /* D-43: caduca_en deja de ser solo una etiqueta. Con la fecha en que se
     comprobo ("comprobado") se calcula si la ficha ya esta vieja:
       dias -> 7 dias · semanas -> 42 dias · anos -> 365 dias.
     Si caduca_en es una fecha (AAAA-MM-DD), vale esa fecha tal cual.
     Una ficha vieja NO se borra: se ofrece solo diciendo que hay que confirmarla. */
  var VIDA = { dias: 7, semanas: 42, anos: 365 };
  function hoyISO() { return new Date().toISOString().slice(0, 10); }
  function sumaDias(iso, n) {
    var d = new Date(iso + "T00:00:00Z"); if (isNaN(d)) return null;
    d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
  }
  function limite(a) {
    var c = String(a.caduca_en || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return c;
    if (VIDA[c] && a.comprobado) return sumaDias(String(a.comprobado).slice(0, 10), VIDA[c]);
    return null;
  }
  function vieja(a, hoy) {
    var l = limite(a); return !!(l && (hoy || hoyISO()) > l);
  }
  function hayQueConfirmar(a, hoy) { return a.caduca_en === "dias" || vieja(a, hoy); }

  /* Las que hay que confirmar antes de prometer nada. */
  function porConfirmar(ccaa) {
    return para(ccaa).filter(function (a) { return hayQueConfirmar(a); });
  }

  /* Filtro por tema, para no meterle a la IA las 24 de golpe. */
  var TEMAS = {
    placas:    ["rehab", "impuestos", "irpf"],
    alquiler:  ["alquiler"],
    compra:    ["compra", "protegida"],
    reforma:   ["rehab"],
    apuros:    ["emergencia", "vulnerable"]
  };

  /* Palabras que delatan que una ayuda va de lo nuestro. Sirven para ordenar:
     de nada vale tener 24 ayudas si a la IA le pasamos las tres que no vienen a cuento. */
  var PISTAS = {
    placas:   [/fotovolt/i, /autoconsum/i, /energ[íi]a solar/i, /renovable/i,
               /rehabilitaci[óo]n energ/i, /eficiencia energ/i, /aerotermia|energ[íi]a ambiente/i,
               /\bIBI\b/i, /\bICIO\b/i, /placas/i],
    reforma:  [/rehabilitaci/i, /reforma/i, /accesibilidad/i, /conservaci/i],
    alquiler: [/alquiler/i, /arrendamiento/i, /bono/i],
    compra:   [/compra/i, /adquisici/i, /aval/i, /hipotec/i]
  };

  function puntuar(a, tema) {
    var pistas = PISTAS[tema] || [];
    var texto = (a.nombre || "") + " " + (a.cuanto_da || "") + " " + (a.quien_puede || "");
    var p = 0;
    for (var i = 0; i < pistas.length; i++) if (pistas[i].test(texto)) p += 10;
    if (a.estado === "abierta") p += 5;          /* lo que puede pedir hoy, primero */
    if (a.estado === "permanente") p += 3;
    if (a.ambito === "municipal") p += 2;        /* lo suyo de cerca vale más */
    return p;
  }

  function porTema(ccaa, tema) {
    var cats = TEMAS[tema];
    var lista = vivas(ccaa);
    if (cats) {
      var filtrada = lista.filter(function (a) { return cats.indexOf(a.categoria) >= 0; });
      if (filtrada.length) lista = filtrada;
    }
    return lista
      .map(function (a) { return { a: a, p: puntuar(a, tema) }; })
      .sort(function (x, y) { return y.p - x.p; })
      .filter(function (x) { return x.p > 0; })
      .map(function (x) { return x.a; });
  }

  /* El texto que se le pasa a la IA. Corto a propósito: si se le meten
     veinte fichas enteras, se pierde y contesta peor. */
  function paraLaIA(ccaa, tema, cuantas) {
    var lista = porTema(ccaa, tema || "placas").slice(0, cuantas || 6);
    if (!lista.length) return "";
    var txt = lista.map(function (a) {
      var l = "- " + a.nombre + " (" + a.estado + ")";
      if (a.cuanto_da) l += ": " + String(a.cuanto_da).slice(0, 180);
      if (a.quien_queda_fuera) l += " | NO la puede pedir: " + String(a.quien_queda_fuera).slice(0, 120);
      if (vieja(a)) l += " | ⚠ DATOS DE HACE TIEMPO (comprobada el " + a.comprobado + "): CONFIRMAR antes de prometerla";
      else if (a.caduca_en === "dias") l += " | ⚠ CONFIRMAR antes de prometerla";
      if (a.verificacion && String(a.verificacion).indexOf("a medias") === 0) l += " | ⚠ ficha verificada a medias: di que hay datos por confirmar";
      return l;
    }).join("\n");
    return "Ayudas de vivienda que le pueden servir (no te inventes ninguna que no esté aquí, " +
           "y las marcadas para confirmar se ofrecen diciendo que hay que comprobarlas):\n" + txt;
  }

  /* Cuántas hay, para poder decirlo sin cargar nada pesado. */
  function resumen(ccaa) {
    var l = para(ccaa);
    return {
      total: l.length,
      abiertas: l.filter(function (a) { return a.estado === "abierta"; }).length,
      permanentes: l.filter(function (a) { return a.estado === "permanente"; }).length,
      porConfirmar: l.filter(function (a) { return hayQueConfirmar(a); }).length
    };
  }

  /* La fecha de revisión NO se escribe a mano aquí: se lee del campo
     "comprobado" de las propias fichas. Una fecha escrita a mano se queda
     vieja el día que alguien actualiza una ficha y no se acuerda de tocarla,
     y entonces la página dice una fecha que no es la del dato. */
  function revisado() {
    if (global.IMMOIA_AYUDAS_COMPROBADO) return global.IMMOIA_AYUDAS_COMPROBADO;
    var l = global.IMMOIA_AYUDAS_LISTA || [];
    return l.map(function (a) { return a.comprobado || ""; })
            .filter(Boolean).sort().pop() || "";
  }

  global.IMMOIA_AYUDAS = {
    version: "1.1", get revisado() { return revisado(); },
    cargar: cargar, para: para, vivas: vivas, porTema: porTema,
    porConfirmar: porConfirmar, paraLaIA: paraLaIA, resumen: resumen,
    codigo: codigo, vieja: vieja, limite: limite, _cache: cache
  };

})(typeof window !== "undefined" ? window : globalThis);
