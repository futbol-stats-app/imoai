/* frescura.js — cuándo deja de valer un dato, sin inventarse nada.
   ------------------------------------------------------------------
   Esto NO decide que una ayuda esté cerrada. Eso solo lo dice su
   boletín. Lo único que hace es aritmética con lo que ya llevan las
   fichas de ayudas_todas.js:

     comprobado   la fecha en que miramos la ficha (hoy, las 293 llevan
                  2026-09-11)
     caduca_en    lo que la propia ficha dice sobre cuánto aguanta el
                  dato: "dias", "semanas" o "anos"
     fecha_fin    la fecha en que la convocatoria deja de estar viva,
                  cuando la ficha la publica. Hoy solo la tiene una,
                  la deducción estatal por autoconsumo, porque es la
                  única de las 293 que publica una fecha dura.

   Con eso se puede decir dos cosas ciertas:
     1. cuántos días lleva el dato sin comprobar, y qué dice su propia
        ficha sobre lo deprisa que cambia;
     2. qué ayudas han pasado ya de su fecha_fin.

   Lo que NO se puede hacer todavía, y por eso no se hace, es detectar
   sola una convocatoria que cierra sin fecha_fin publicada.
*/
(function (global) {
  "use strict";

  var DIA = 86400000;

  /* "2026-09-11" -> Date a mediodía UTC, para que no bailen los husos */
  function fecha(txt) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(txt || "").trim());
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
  }

  function hoyUTC(hoy) {
    var d = hoy ? new Date(hoy) : new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
  }

  /* Días enteros desde que se comprobó la ficha. null si no lleva fecha. */
  function diasSinComprobar(a, hoy) {
    var c = fecha(a && a.comprobado);
    if (!c) return null;
    return Math.floor((hoyUTC(hoy) - c) / DIA);
  }

  /* Lo que la propia ficha dice sobre cuánto aguanta el dato. */
  var PRISA = { dias: 3, semanas: 2, anos: 1 };
  var EN_PALABRAS = {
    dias: "esta puede cambiar de un día para otro",
    semanas: "esta puede cambiar en semanas",
    anos: "esta suele aguantar de un año para otro"
  };

  /* ¿Se le ha pasado el plazo a la ayuda? Solo se responde cuando la
     ficha publica fecha_fin. Sin fecha_fin la respuesta es null, que
     quiere decir "no lo sé", no "sigue abierta". */
  function caducada(a, hoy) {
    var f = fecha(a && a.fecha_fin);
    if (!f) return null;
    return hoyUTC(hoy) > f;
  }

  function diasQueQuedan(a, hoy) {
    var f = fecha(a && a.fecha_fin);
    if (!f) return null;
    return Math.ceil((f - hoyUTC(hoy)) / DIA);
  }

  /* El parte completo de una lista de ayudas. */
  function revisar(lista, hoy) {
    lista = lista || [];
    var caducadas = [], seAcaban = [], sinFechaFin = 0;
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      var c = caducada(a, hoy);
      if (c === null) { sinFechaFin++; continue; }
      if (c) caducadas.push(a); else seAcaban.push(a);
    }
    /* Las que más corren, primero: lo dice su caduca_en, no nosotros. */
    var porPrisa = lista.slice().sort(function (x, y) {
      var p = (PRISA[y.caduca_en] || 0) - (PRISA[x.caduca_en] || 0);
      if (p) return p;
      return (diasSinComprobar(y, hoy) || 0) - (diasSinComprobar(x, hoy) || 0);
    });
    return {
      total: lista.length,
      caducadas: caducadas,
      seAcaban: seAcaban,
      sinFechaFin: sinFechaFin,
      porPrisa: porPrisa,
      comprobado: lista.map(function (a) { return a.comprobado || ""; })
        .filter(Boolean).sort().pop() || "",
      diasDesdeLaRevision: diasSinComprobar(
        { comprobado: lista.map(function (a) { return a.comprobado || ""; })
          .filter(Boolean).sort().pop() }, hoy)
    };
  }

  /* La frase que se le enseña a una persona sobre una ficha concreta.
     Se construye con lo que hay; si no hay nada, no se dice nada. */
  function fraseDeFrescura(a, hoy) {
    var d = diasSinComprobar(a, hoy);
    if (d === null) return "";
    var cuando = d === 0 ? "hoy mismo"
      : d === 1 ? "ayer"
      : "hace " + d + " días";
    var prisa = EN_PALABRAS[a.caduca_en];
    return "Este dato lo comprobamos " + cuando +
      (prisa ? ", y " + prisa : "") + ".";
  }

  global.IMMOIA_FRESCURA = {
    diasSinComprobar: diasSinComprobar,
    caducada: caducada,
    diasQueQuedan: diasQueQuedan,
    revisar: revisar,
    fraseDeFrescura: fraseDeFrescura
  };

})(typeof window !== "undefined" ? window : globalThis);
