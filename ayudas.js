/* ============================================================
   ayudas.js — LAS AYUDAS DE TODA ESPAÑA, AL INSTANTE
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
    vc:"10", ex:"11", ga:"12", ma:"13", mu:"14", na:"15", pv:"16", ri:"17"
  };

  var CARPETA = "ayudas/";
  var cache = {};          /* lo ya descargado, para no pedirlo dos veces */
  var enVuelo = {};

  function codigo(ccaa) {
    if (!ccaa) return null;
    var c = String(ccaa).toLowerCase();
    return INE[c] || (/^\d{2}$/.test(c) ? c : null);
  }

  /* Descarga el fichero de una comunidad (y el estatal, que vale para todos). */
  function cargar(ccaa) {
    var cod = codigo(ccaa);
    var quiero = cod ? [cod, "ES"] : ["ES"];
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

  /* Solo las que puede pedir hoy o siempre. Las cerradas no se le ofrecen. */
  function vivas(ccaa) {
    return para(ccaa).filter(function (a) {
      return a.estado === "abierta" || a.estado === "permanente" || a.estado === "pendiente";
    });
  }

  /* Las que hay que confirmar antes de prometer nada. */
  function porConfirmar(ccaa) {
    return para(ccaa).filter(function (a) { return a.caduca_en === "dias"; });
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
      if (a.caduca_en === "dias") l += " | ⚠ CONFIRMAR antes de prometerla";
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
      porConfirmar: l.filter(function (a) { return a.caduca_en === "dias"; }).length
    };
  }

  global.IMMOIA_AYUDAS = {
    version: "1.0", revisado: "2026-09-11",
    cargar: cargar, para: para, vivas: vivas, porTema: porTema,
    porConfirmar: porConfirmar, paraLaIA: paraLaIA, resumen: resumen,
    codigo: codigo, _cache: cache
  };

})(typeof window !== "undefined" ? window : globalThis);
