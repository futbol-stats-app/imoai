/* territorio.js — DÓNDE vive la persona, para que a cada uno le salgan
   las ayudas de SU sitio y no las de otro.
   ------------------------------------------------------------------
   26/09/2026. Por qué existe: del código postal la portada solo sacaba
   la PROVINCIA. En Tenerife eso daba dos fallos de verdad:
     1. a un vecino de Adeje le salían las ayudas del Ayuntamiento de
        Santa Cruz o de La Laguna, algunas sin decir de qué ayuntamiento
        eran («IBI: familia numerosa»);
     2. las del Cabildo de Tenerife (código «38», la provincia) le salían
        también a quien vive en La Palma, La Gomera o El Hierro, que son
        de la misma provincia pero no de la misma isla.
   Esto NO es una ficha de ayuda ni toca ninguna: es el mapa.

   FUENTES
   · Los 31 municipios de Tenerife y su código INE: Idescat, «Códigos
     territoriales. Illes. 384 Tenerife» (idescat.cat/codis, que reproduce
     el código INE), consultado el 26/09/2026.
   · Los códigos postales de cada municipio: distritopostal.es, una página
     por municipio, consultadas el 26/09/2026. NO es Correos: es un tercero.
     Hay códigos que comparten dos municipios (38108, 38294 y 38320: Santa
     Cruz y La Laguna; 38109 y 38510: El Rosario con Santa Cruz y con
     Candelaria; 38509: Arafo y Candelaria; 38615 y 38629: Vilaflor con
     Adeje y con San Miguel; 38632: Arona y San Miguel; 38435 y 38460:
     El Tanque, Los Silos y Garachico). Con esos no se elige uno: se
     enseñan los de los dos y se dice que mire cuál es el suyo.
   · Las islas de la provincia 38 por las tres primeras cifras del código
     postal: 380-386 Tenerife (el más alto de la lista de arriba es 38690),
     387 La Palma, 388 La Gomera, 389 El Hierro.
   Un código postal de Tenerife que no esté en la lista no se adivina:
   se dice que no sabemos el municipio.
*/
(function (global) {
  "use strict";

  var TENERIFE = {
    "38001": ["Adeje", "38615 38660 38670 38677 38678 38679"],
    "38004": ["Arafo", "38509 38550"],
    "38005": ["Arico", "38580 38588 38589 38592 38593"],
    "38006": ["Arona", "38626 38627 38630 38631 38632 38640 38649 38650 38652"],
    "38010": ["Buenavista del Norte", "38480 38489"],
    "38011": ["Candelaria", "38509 38510 38520 38530 38540"],
    "38012": ["Fasnia", "38570 38579"],
    "38015": ["Garachico", "38450 38458 38459 38460"],
    "38017": ["Granadilla de Abona", "38594 38595 38600 38610 38611 38612 38616 38617 38618"],
    "38018": ["La Guancha", "38437 38440 38441 38449"],
    "38019": ["Guía de Isora", "38680 38685 38686 38687 38688 38689"],
    "38020": ["Güímar", "38500 38508 38560 38590 38591"],
    "38022": ["Icod de los Vinos", "38430 38434 38438 38439"],
    "38023": ["San Cristóbal de La Laguna", "38108 38200 38201 38202 38203 38204 38205 38206 38207 38208 38234 38240 38250 38260 38270 38291 38293 38294 38295 38296 38297 38320 38329 38330"],
    "38025": ["La Matanza de Acentejo", "38370 38379"],
    "38026": ["La Orotava", "38300 38310 38311 38312 38313 38314 38315"],
    "38028": ["Puerto de la Cruz", "38400"],
    "38031": ["Los Realejos", "38410 38412 38413 38414 38415 38416 38417 38418 38419"],
    "38032": ["El Rosario", "38109 38190 38290 38510"],
    "38034": ["San Juan de la Rambla", "38420 38428 38429"],
    "38035": ["San Miguel de Abona", "38620 38628 38629 38632 38639"],
    "38038": ["Santa Cruz de Tenerife", "38001 38002 38003 38004 38005 38006 38007 38008 38009 38010 38107 38108 38109 38110 38111 38120 38129 38130 38139 38140 38150 38160 38170 38180 38294 38320"],
    "38039": ["Santa Úrsula", "38390 38398 38399"],
    "38040": ["Santiago del Teide", "38436 38683 38684 38690"],
    "38041": ["El Sauzal", "38359 38360"],
    "38042": ["Los Silos", "38435 38460 38470 38479"],
    "38043": ["Tacoronte", "38340 38350 38355 38356 38357 38358"],
    "38044": ["El Tanque", "38435"],
    "38046": ["Tegueste", "38280 38292"],
    "38051": ["La Victoria de Acentejo", "38380 38389"],
    "38052": ["Vilaflor de Chasna", "38613 38614 38615 38629"]
  };

  /* código postal -> [códigos INE], construido una vez */
  var POR_CP = {};
  Object.keys(TENERIFE).forEach(function (ine) {
    TENERIFE[ine][1].split(" ").forEach(function (cp) {
      (POR_CP[cp] = POR_CP[cp] || []).push(ine);
    });
  });

  var ISLAS = { tenerife: "Tenerife", la_palma: "La Palma", la_gomera: "La Gomera", el_hierro: "El Hierro",
    gran_canaria: "Gran Canaria", lanzarote: "Lanzarote", fuerteventura: "Fuerteventura" };

  function limpio(cp) { return String(cp == null ? "" : cp).trim(); }

  /* La isla del código postal. Solo la provincia 38; en el resto, null
     (= no lo sabemos, y entonces no se filtra por isla). */
  function islaDeCP(cp) {
    cp = limpio(cp);
    if (!/^38\d{3}$/.test(cp)) return null;
    var t = +cp.charAt(2);
    if (t <= 6) return "tenerife";
    return t === 7 ? "la_palma" : t === 8 ? "la_gomera" : "el_hierro";
  }

  /* Los municipios de Tenerife de ese código postal: uno, dos (si lo
     comparten) o ninguno (si no está en la lista: no se adivina). */
  function municipiosDeCP(cp) {
    return (POR_CP[limpio(cp)] || []).slice();
  }

  function nombreMunicipio(ine) {
    var m = TENERIFE[String(ine || "").trim()];
    return m ? m[0] : "";
  }

  /* La isla de una FICHA. Se lee de la propia ficha: las del Cabildo
     llevan en la fuente «Cabildo Insular de Tenerife». Las municipales de
     Tenerife, por su código INE. Si no se sabe, null. */
  var RE_CABILDO = /Cabildo(?: Insular)? de (Tenerife|La Palma|La Gomera|El Hierro)/i;
  function islaDeFicha(a) {
    if (!a) return null;
    var ine = String(a.codigo_ine != null ? a.codigo_ine : (a.ine || "")).trim();
    if (TENERIFE[ine]) return "tenerife";
    if (ine === "38") {
      var txt = [a.fuente, a.f, a.quien_puede, a.nombre, a.n].join(" ");
      var m = RE_CABILDO.exec(txt);
      if (m) return m[1].toLowerCase().replace(/\s+/g, "_");
    }
    return null;
  }

  /* ¿Le llega esta ficha a quien vive en ese código postal, mirando
     isla y municipio? (La comunidad y la provincia se miran aparte, como
     siempre.) Devuelve:
       true   · le llega;
       false  · es de otra isla o de otro municipio;
       "duda" · es municipal y de su provincia, pero de su código postal
                no sabemos el municipio: se enseña diciendo que mire. */
  function llega(a, cp) {
    return llegaDonde(a, { isla: islaDeCP(cp), municipios: municipiosDeCP(cp) });
  }

  /* Lo mismo, cuando lo que se sabe no es el código postal sino lo que la
     persona ha dicho en la conversación: {isla, municipios}. */
  function llegaDonde(a, donde) {
    donde = donde || {};
    var islaF = islaDeFicha(a), islaP = donde.isla || null;
    if (islaF && islaP && islaF !== islaP) return false;
    var ine = String(a.codigo_ine != null ? a.codigo_ine : (a.ine || "")).trim();
    if (ine.length !== 5) return true;
    var suyos = donde.municipios || [];
    if (!suyos.length) return "duda";
    return suyos.indexOf(ine) >= 0;
  }

  /* De qué sitio se habla en un texto: la isla y, si se nombra, el municipio
     de Tenerife. Sin adivinar: si no se nombra nada, {isla:null, municipios:[]}.
     «Santa Cruz de La Palma» se mira antes que «Santa Cruz». */
  function sinTildes(s) {
    return String(s || "").toLowerCase().replace(/[áàä]/g, "a").replace(/[éèë]/g, "e")
      .replace(/[íìï]/g, "i").replace(/[óòö]/g, "o").replace(/[úùü]/g, "u");
  }
  var OTRAS_ISLAS = [["santa cruz de la palma", "la_palma"], ["la palma", "la_palma"], ["la gomera", "la_gomera"],
    ["el hierro", "el_hierro"], ["gran canaria", "gran_canaria"], ["lanzarote", "lanzarote"],
    ["fuerteventura", "fuerteventura"], ["las palmas", "gran_canaria"]];
  var NOMBRES_CORTOS = null;
  function nombresCortos() {
    if (NOMBRES_CORTOS) return NOMBRES_CORTOS;
    NOMBRES_CORTOS = [];
    Object.keys(TENERIFE).forEach(function (ine) {
      var n = sinTildes(TENERIFE[ine][0]);
      var formas = [n,
        n.replace(/ de abona$| de los vinos$| de chasna$| del norte$| de acentejo$| de tenerife$/, ""),
        n.replace(/^san cristobal de /, "")];
      formas.forEach(function (f) { if (f.length >= 5) NOMBRES_CORTOS.push([f, ine]); });
    });
    NOMBRES_CORTOS.sort(function (x, y) { return y[0].length - x[0].length; });
    return NOMBRES_CORTOS;
  }
  function dondeEnTexto(texto) {
    var t = " " + sinTildes(texto).replace(/[^a-zñ0-9]+/g, " ") + " ";
    for (var i = 0; i < OTRAS_ISLAS.length; i++) {
      if (t.indexOf(" " + OTRAS_ISLAS[i][0] + " ") >= 0) return { isla: OTRAS_ISLAS[i][1], municipios: [] };
    }
    var cp = /\b(38[0-6]\d{2})\b/.exec(t);
    if (cp && municipiosDeCP(cp[1]).length) return { isla: "tenerife", municipios: municipiosDeCP(cp[1]) };
    var L = nombresCortos(), vistos = [];
    for (var j = 0; j < L.length; j++) {
      if (t.indexOf(" " + L[j][0] + " ") >= 0 && vistos.indexOf(L[j][1]) < 0) {
        vistos.push(L[j][1]);
        t = t.split(" " + L[j][0] + " ").join(" ");   /* «santa cruz» no vuelve a contar */
      }
    }
    if (vistos.length === 1) return { isla: "tenerife", municipios: vistos };
    if (vistos.length > 1) return { isla: "tenerife", municipios: [] };   /* nombra varios: no se elige */
    if (t.indexOf(" tenerife ") >= 0) return { isla: "tenerife", municipios: [] };
    return { isla: null, municipios: [] };
  }

  global.IMMOIA_TERRITORIO = {
    TENERIFE: TENERIFE, ISLAS: ISLAS,
    islaDeCP: islaDeCP, municipiosDeCP: municipiosDeCP,
    nombreMunicipio: nombreMunicipio, islaDeFicha: islaDeFicha, llega: llega,
    llegaDonde: llegaDonde, dondeEnTexto: dondeEnTexto
  };
})(typeof window !== "undefined" ? window : globalThis);
