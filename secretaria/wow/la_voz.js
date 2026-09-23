/* ==================================================================
   IMMO IA · la_voz.js — LA VOZ QUE CUENTA LO QUE HA ENCONTRADO
   ------------------------------------------------------------------
   POR QUÉ EXISTE (23/09/2026)

   Cuando la directora suelta su carpeta, la pantalla se llena de
   cuentas. Esto lo dice EN ALTO, mientras ella mira.

   LO QUE ES, Y LO QUE NO ES:

   · NO conversa, NO pregunta y NO llama a ningún servidor. Este
     fichero no tiene ni una dirección de internet dentro, ni una
     petición, ni una clave. No gasta un céntimo.
   · NO se inventa nada: cada número sale de lo que ya ha calculado
     la aplicación (el lector, la deducción y el repaso). Aquí no se
     escribe ni un número a mano.
   · Habla con la voz que ya tiene el ordenador, y SOLO con una voz
     que esté instalada en la máquina (`localService`). Las voces que
     suenan por internet no se usan, aunque el navegador las ofrezca:
     esta aplicación no manda nada fuera, y la voz no va a ser la
     excepción.

   LAS TRES REGLAS DEL ENCARGO, Y DÓNDE ESTÁN:

   1 · Un botón para callarla, a la vista        -> callar()
   2 · No habla hasta que ella toque algo        -> permitir()
   3 · Si no hay voz en español, no se rompe:    -> contar() pinta el
       se lee el texto en pantalla y ya está        texto siempre
   ================================================================== */
(function (raiz) {
  "use strict";

  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  /* Hasta que la persona no toca algo, el navegador no deja hablar.
     No es una manía nuestra: es una norma del navegador. */
  var permitido = false;
  var callada = false;

  function permitir() { permitido = true; }

  function nCosas(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }

  function esFecha(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }

  function enCristiano(iso) {
    if (!esFecha(iso)) return "";
    var d = +iso.slice(8, 10), m = +iso.slice(5, 7), a = iso.slice(0, 4);
    var hoy = new Date();
    var esteAnio = String(hoy.getFullYear()) === a;
    return "el " + d + " de " + MESES[m - 1] + (esteAnio ? "" : " de " + a);
  }

  /* ------------------------------------------------------------------
     LAS SEIS FRASES · se sacan del estado de la pantalla, sin tocar nada
     ------------------------------------------------------------------
     Se puede llamar sin navegador (la prueba lo hace), porque aquí no
     se mira el documento: solo se leen números que ya existen.
     ------------------------------------------------------------------ */
  function frases(E) {
    E = E || {};
    var f = [];
    var cuenta = E.cuenta || {};
    var ficheros = E.ficheros || [];
    var expedientes = E.expedientes || [];
    var sueltos = E.sueltos || [];
    var duplicados = E.duplicados || [];
    var repaso = E.repaso || {};

    /* 1 · cuántos papeles y en cuántas carpetas */
    var carpetas = {};
    ficheros.forEach(function (x) { carpetas[x.carpeta] = 1; });
    var nCarp = Object.keys(carpetas).length;
    var total = (typeof cuenta.total === "number") ? cuenta.total : ficheros.length;
    f.push("He encontrado " + nCosas(total, "papel", "papeles") +
           (total === 1 ? " repartido en " : " repartidos en ") +
           nCosas(nCarp, "carpeta", "carpetas") + ".");

    /* 2 · cuántos expedientes ha sacado */
    f.push(expedientes.length === 0
      ? "No he sacado ningún expediente: los papeles no dicen de qué finca son."
      : "Los he agrupado en " + nCosas(expedientes.length, "expediente", "expedientes") + ".");

    /* 3 · lo que vence antes, y lo que ya se pasó */
    var avisos = E.hallazgos_utiles || repaso.hallazgos || [];
    var vencidos = avisos.filter(function (h) { return h && h.clase === "vencido"; });
    var porVencer = avisos.filter(function (h) { return h && h.clase === "vence" && esFecha(h.vence); })
                          .sort(function (a, b) { return a.vence < b.vence ? -1 : 1; });
    if (porVencer.length) {
      var p = porVencer[0];
      f.push("Lo primero que vence es " + enCristiano(p.vence) + ", en " + p.donde + ": " +
             p.titulo.charAt(0).toLowerCase() + p.titulo.slice(1) + ".");
    } else {
      f.push("No hay ningún plazo a la vista en los próximos días.");
    }
    f.push(vencidos.length
      ? "Y " + nCosas(vencidos.length, "plazo", "plazos") + " ya " +
        (vencidos.length === 1 ? "se pasó" : "se pasaron") + "."
      : "No hay ningún plazo pasado.");

    /* 4 · las copias repetidas, apartadas y no borradas */
    var sobran = duplicados.reduce(function (n, g) { return n + ((g && g.sobran) ? g.sobran.length : 0); }, 0);
    f.push(sobran
      ? "He apartado " + nCosas(sobran, "papel repetido", "papeles repetidos") +
        ". No he borrado ninguno."
      : "No hay papeles repetidos.");

    /* 5 · de cuántos no sabe de quién son */
    f.push(sueltos.length
      ? "De " + nCosas(sueltos.length, "papel", "papeles") + " no sé de quién " +
        (sueltos.length === 1 ? "es" : "son") + ". No me " +
        (sueltos.length === 1 ? "lo" : "los") + " invento."
      : "Sé de quién es cada papel.");

    /* 6 · cuántos expedientes no tienen fecha
       ------------------------------------------------------------------
       ARREGLO DEL 23/09/2026, y conviene saber por qué: antes esto miraba
       `_sin_fecha_ninguna`, que NO es «este expediente no tiene fecha»:
       es CUÁNTOS PAPELES de ese expediente no traen fecha. Con un DNI
       escaneado dentro, que nunca trae fecha, la voz decía «1 expediente
       no tiene ninguna fecha» de un expediente que sí la tenía.
       Un expediente no tiene fecha cuando no hay NI UN papel fechado, y
       eso es justo lo que dice `ultimo_movimiento`: si no hay ninguno,
       viene vacío. */
    var sinFecha = expedientes.filter(function (e) {
      return e && !(e.ultimo_movimiento && e.ultimo_movimiento.fecha);
    }).length;
    f.push(sinFecha
      ? nCosas(sinFecha, "expediente no tiene", "expedientes no tienen") +
        " ninguna fecha, así que no puedo decirte si " +
        (sinFecha === 1 ? "está parado" : "están parados") + "."
      : "Todos los expedientes traen alguna fecha.");

    return f;
  }

  /* ------------------------------------------------------------------
     LA VOZ DEL PROPIO ORDENADOR
     ------------------------------------------------------------------
     Solo vale una voz que esté INSTALADA en esta máquina y que hable
     español. Si no hay ninguna, no pasa nada: el texto ya está escrito
     en la pantalla.
     ------------------------------------------------------------------ */
  function motor() {
    return (typeof raiz !== "undefined" && raiz && raiz.speechSynthesis) ? raiz.speechSynthesis : null;
  }

  function vozDeLaCasa() {
    var m = motor();
    if (!m || typeof m.getVoices !== "function") return null;
    var todas = m.getVoices() || [];
    var esp = todas.filter(function (v) {
      return v && v.localService === true && /^es/i.test(v.lang || "");
    });
    return esp.length ? esp[0] : null;
  }

  function hayVoz() { return !!vozDeLaCasa(); }

  function callar() {
    callada = true;
    var m = motor();
    if (m && typeof m.cancel === "function") { try { m.cancel(); } catch (e) {} }
  }

  function hablar(lista) {
    var m = motor();
    var v = vozDeLaCasa();
    if (!m || !v || !permitido || callada) return false;
    try { m.cancel(); } catch (e) {}
    var dicho = 0;
    lista.forEach(function (t) {
      if (typeof raiz.SpeechSynthesisUtterance !== "function") return;
      var u = new raiz.SpeechSynthesisUtterance(t);
      u.voice = v; u.lang = v.lang; u.rate = 1; u.pitch = 1;
      try { m.speak(u); dicho++; } catch (e) {}
    });
    return dicho > 0;
  }

  /* ------------------------------------------------------------------
     CONTAR · pinta las frases y, si se puede, las dice
     ------------------------------------------------------------------ */
  function contar(E, donde) {
    var lista = frases(E);
    var caja = donde || (typeof document !== "undefined" ? document.getElementById("voz_texto") : null);
    if (caja) {
      while (caja.firstChild) caja.removeChild(caja.firstChild);
      lista.forEach(function (t) {
        var p = document.createElement("p");
        p.className = "voz_frase";
        p.textContent = t;
        caja.appendChild(p);
      });
    }
    var sonando = hablar(lista);
    var aviso = (typeof document !== "undefined") ? document.getElementById("voz_estado") : null;
    if (aviso) {
      aviso.textContent = sonando
        ? "Te lo estoy contando en alto con la voz de este ordenador. Nada de esto sale de aquí."
        : (hayVoz()
            ? "La voz está callada. Lo tienes escrito aquí debajo."
            : "Este ordenador no tiene una voz en español instalada, así que te lo dejo escrito.");
    }
    return { frases: lista, sonando: sonando };
  }

  var API = { frases: frases, contar: contar, hablar: hablar, callar: callar,
              permitir: permitir, hayVoz: hayVoz,
              estaCallada: function () { return callada; },
              volverAHablar: function () { callada = false; } };

  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_VOZ = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
