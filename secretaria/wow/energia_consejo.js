/* ==================================================================
   IMMO IA · energia_consejo.js — EL CONSEJO DE ENERGÍA DE LA SECRETARIA
   ------------------------------------------------------------------
   Taller E1 · 24/09/2026. Fichero nuevo.

   Qué hace, y nada más:
     1. Trae la cuenta ÚNICA de placas de la web (../../datos.js y
        ../../energia_cuenta.js, al lado de la web, mismo dominio) si la
        página no la tiene ya. No hace otra cuenta: le pregunta a esa.
     2. cifra(): lo que da esa cuenta para el caso por defecto de la web
        (una vivienda en Tenerife, ocupada todo el año, sin factura: los
        paneles y el consumo los pone la propia cuenta). Si la cuenta no
        ha cargado, devuelve null y el consejo sale SIN cifra.
     3. pintar(): pinta los consejos (los hace repaso.js, en
        repaso.consejos) en su propio hueco, debajo de «Qué no cuadra».
        No son avisos ni fallos: van aparte y con su nombre.

   Reglas de la casa que cumple:
     · Ninguna cifra sale de aquí: todas de energia_cuenta.js/datos.js,
       dichas como estimación y con el enlace a la página de Energía.
     · No se promete ninguna ayuda.
     · Si algo no carga, no se rompe nada: se calla la cifra.
   ================================================================== */
(function (raiz) {
  "use strict";
  if (!raiz) return;
  if (raiz.IMMOIA_ENERGIA_CONSEJO) return;

  var VERSION = "1.0";
  var estado = { cuenta: "sin pedir", motivo: "" };

  /* la carpeta de este fichero, para traer lo de la web con ruta relativa */
  var yo = (typeof document !== "undefined" && document && document.currentScript && document.currentScript.src) || "";
  var CARPETA = yo ? yo.replace(/[?#].*$/, "").replace(/[^\/]*$/, "") : "wow/";

  function hayCuenta() {
    var D = raiz.DATOS_IMMOIA, C = raiz.IMMOIA_ENERGIA_CUENTA;
    return !!(D && D.numeros && C && typeof C.cuenta === "function");
  }

  function traer(src, listo) {
    try {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = function () { listo(true); };
      s.onerror = function () { listo(false); };
      (document.head || document.body || document.documentElement).appendChild(s);
    } catch (err) { listo(false); }
  }

  function cargar() {
    if (hayCuenta()) { estado.cuenta = "lista"; return; }
    if (typeof document === "undefined" || !document || typeof document.createElement !== "function") {
      estado.cuenta = "no carga"; estado.motivo = "no hay página donde cargarla";
      return;
    }
    estado.cuenta = "cargando";
    var pasos = [];
    if (!(raiz.DATOS_IMMOIA && raiz.DATOS_IMMOIA.numeros)) pasos.push(CARPETA + "../../datos.js");
    if (!raiz.IMMOIA_ENERGIA_CUENTA) pasos.push(CARPETA + "../../energia_cuenta.js");
    (function siguiente(i) {
      if (i >= pasos.length) {
        estado.cuenta = hayCuenta() ? "lista" : "no carga";
        if (!hayCuenta()) estado.motivo = "los ficheros de la web no traen la cuenta";
        return;
      }
      traer(pasos[i], function (bien) {
        if (!bien) { estado.cuenta = "no carga"; estado.motivo = "no se ha podido cargar " + pasos[i]; return; }
        siguiente(i + 1);
      });
    })(0);
  }

  /* Lo que da la cuenta de la web para el caso por defecto. Nada más. */
  function cifra() {
    if (!hayCuenta()) return null;
    var C = raiz.IMMOIA_ENERGIA_CUENTA, D = raiz.DATOS_IMMOIA;
    var r = C.cuenta({ uso: "vivienda", ccaa: "cn" });
    if (!r || !(r.ahorroAno > 0) || !(r.n > 0)) return null;
    return {
      ahorroAno: r.ahorroAno,
      eur: (C.fmt && C.fmt.eur) ? C.fmt.eur(r.ahorroAno) : Math.round(r.ahorroAno) + " €",
      paneles: r.n,
      consumo_supuesto_kwh: r.consumo,
      consumo_fuente: r.consumoFuente,
      revisado: D.revisado || null,
      de_donde: "energia_cuenta.js · cuenta({ uso: \"vivienda\", ccaa: \"cn\" })"
    };
  }

  /* ------------------------------------------------------------------
     PINTAR · en su propio hueco, debajo de «Qué no cuadra»
     ------------------------------------------------------------------ */
  var ID = "b_consejo_energia";
  function crear(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function despuesDe(ref, nodo) {
    var padre = ref.parentNode;
    if (!padre) return false;
    var sig = ref.nextSibling;
    if (sig === undefined && padre.childNodes) {
      var i = Array.prototype.indexOf.call(padre.childNodes, ref);
      sig = i >= 0 ? padre.childNodes[i + 1] || null : null;
    }
    if (sig) padre.insertBefore(nodo, sig); else padre.appendChild(nodo);
    return true;
  }
  function estilo() {
    if (document.getElementById("e1_consejo_estilo") && document.getElementById("e1_consejo_estilo").parentNode) return;
    try {
      var st = crear("style");
      st.id = "e1_consejo_estilo";
      st.textContent = ".aviso.c_consejo{border-left-color:#15803d}" +
                       ".consejo_enlace{display:inline-block;margin-top:6px;font-weight:600}";
      (document.head || document.body).appendChild(st);
    } catch (err) {}
  }

  function pintar(E) {
    if (typeof document === "undefined" || !document) return 0;
    E = E || raiz.__WOW || {};
    var consejos = (E.repaso && E.repaso.consejos) || [];
    var caja = document.getElementById(ID);
    if (!caja || !caja.parentNode) {
      var ref = document.getElementById("b_raro");
      if (!ref || !ref.parentNode) return 0;
      caja = crear("div", "bloque");
      caja.id = ID;
      if (!despuesDe(ref, caja)) return 0;
    }
    while (caja.firstChild) caja.removeChild(caja.firstChild);
    if (!consejos.length) { caja.style.display = "none"; return 0; }
    caja.style.display = "";
    estilo();
    caja.appendChild(crear("h3", null, consejos.length === 1 ? "Un consejo de energía" : "Consejos de energía"));
    caja.appendChild(crear("p", "flojo", "No es nada que falle ni que falte: es algo que puedes ofrecerle al propietario."));
    var porId = {};
    (E.ficheros || []).forEach(function (f) { porId[f.id] = f; });
    consejos.forEach(function (c) {
      var a = crear("div", "aviso c_consejo");
      a.appendChild(crear("div", "aviso_donde", c.donde));
      a.appendChild(crear("div", "aviso_titulo", c.titulo));
      a.appendChild(crear("div", "aviso_detalle", c.detalle));
      if (c.fuente) a.appendChild(crear("div", "aviso_fuente", "fuente: " + c.fuente));
      var f = c.fichero && porId[c.fichero];
      if (f || c.nombre_fichero) {
        a.appendChild(crear("div", "aviso_fuente", "el papel: " + (f ? f.ruta : c.nombre_fichero) +
                                                   (c.papel ? " — " + c.papel : "")));
      }
      if (c.enlace) {
        var l = crear("a", "consejo_enlace", c.enlace_texto || "Hacer la cuenta en Energía");
        l.setAttribute("href", c.enlace);
        l.setAttribute("target", "_blank");
        l.setAttribute("rel", "noopener");
        a.appendChild(l);
      }
      caja.appendChild(a);
    });
    return consejos.length;
  }

  function pintarLuego(E) {
    setTimeout(function () { try { pintar(E); } catch (err) {} }, 0);
  }

  raiz.IMMOIA_ENERGIA_CONSEJO = {
    version: VERSION,
    cifra: cifra,
    cargar: cargar,
    estado: function () { return { cuenta: estado.cuenta, motivo: estado.motivo, hay_cuenta: hayCuenta() }; },
    pintar: pintar,
    pintarLuego: pintarLuego,
    ID: ID
  };

  cargar();
})(typeof window !== "undefined" ? window : null);
