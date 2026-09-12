/* ============================================================
   secretaria.js — que InmoIA hable como una persona, no como un robot.

   NO toca charla.js. Se carga DESPUÉS y mejora lo que ya hay:
     1. Lee bien: dice «euros», no «€»; «metros cuadrados», no «m²».
     2. Elige la mejor voz española del aparato en vez de la primera.
     3. Parte la respuesta en frases: Chrome corta los textos largos
        a la mitad, y así no se corta nunca.
     4. Mientras piensa, dice algo corto — como haría una persona —
        en vez de dejar un silencio.
     5. Modo conversación: cuando acaba de hablar, vuelve a escuchar
        sola. Sin tocar ningún botón.

   Si algo de esto falla, la página sigue funcionando igual que antes.
   ============================================================ */
(function () {
  "use strict";

  if (!window.speechSynthesis) return;
  var SS = window.speechSynthesis;

  /* ---------------- 1. cómo se lee lo que está escrito ---------------- */

  var MESES = ["enero","febrero","marzo","abril","mayo","junio","julio",
               "agosto","septiembre","octubre","noviembre","diciembre"];

  function paraDecir(t) {
    t = String(t == null ? "" : t);

    t = t.replace(/\[CASA\s*:\s*[^\]]+\]/gi, " ");        /* la marca del vídeo no se lee */
    t = t.replace(/https?:\/\/\S+/g, " el enlace que te dejo ");
    t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ");  /* emojis fuera */

    /* fechas: 31/07/2027 -> 31 de julio de 2027 */
    t = t.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, function (_, d, m, a) {
      var i = parseInt(m, 10) - 1;
      return MESES[i] ? d + " de " + MESES[i] + " de " + a : d + " " + m + " " + a;
    });

    /* números con punto de miles: 5.500 -> 5500 para que no diga «cinco punto quinientos» */
    t = t.replace(/\b(\d{1,3})(?:\.(\d{3}))+\b/g, function (m) { return m.replace(/\./g, ""); });
    /* decimales con coma: 4,91 -> 4 con 91 */
    t = t.replace(/\b(\d+),(\d+)\b/g, "$1 con $2");

    t = t.replace(/(\d)\s*€/g, "$1 euros").replace(/€/g, " euros ");
    t = t.replace(/(\d)\s*%/g, "$1 por ciento").replace(/%/g, " por ciento ");
    t = t.replace(/m²|m2\b/gi, "metros cuadrados");
    t = t.replace(/\bkWp?\b/gi, "kilovatios");
    t = t.replace(/\bIBI\b/g, "I.B.I.").replace(/\bICIO\b/g, "I.C.I.O.");
    t = t.replace(/\bIRPF\b/g, "I.R.P.F.").replace(/\bDNI\b/g, "D.N.I.");
    t = t.replace(/\bIA\b/g, "I.A.");
    t = t.replace(/\bnº|\bn\.º/gi, "número ");
    t = t.replace(/\bhab\b\.?/gi, "habitaciones");
    t = t.replace(/\baprox\b\.?/gi, "aproximadamente");

    t = t.replace(/(\d)\s*€?\s*\/\s*mes\b/gi, "$1 al mes");
    t = t.replace(/\/\s*(mes|a[ñn]o|kWh|m2)\b/gi, " al $1");
    t = t.replace(/[*_#`>|·•]/g, " ");                     /* restos de formato */
    t = t.replace(/\s*[-–—]\s+/g, ", ");                   /* guiones de lista -> pausa */
    t = t.replace(/\.{3,}/g, "…");

    /* limpieza de puntuación: quitar formato deja cosas como «a la vez :, El CUPS» */
    t = t.replace(/\s+([,.;:!?])/g, "$1");                 /* sin espacio antes del signo */
    t = t.replace(/([:;])\s*[,;]+/g, "$1");                /* «:,» -> «:» */
    t = t.replace(/,\s*([.:;!?])/g, "$1");                 /* «,.» -> «.» */
    /* «.,» -> «.», pero sin tocar «I.B.I.,» ni «D.N.I.,» */
    t = t.replace(/([a-záéíóúüñ0-9]{2,}[)\]"»']?[.!?])\s*,/g, "$1");
    t = t.replace(/,{2,}/g, ",");
    t = t.replace(/([,:;])(?=\S)/g, "$1 ");                /* siempre un espacio detrás */

    t = t.replace(/\s{2,}/g, " ").trim();
    t = t.replace(/^[,;:.\s]+/, "");                       /* que no empiece por un signo */
    return t;
  }

  /* ---------------- 2. la mejor voz que tenga el aparato ---------------- */

  /* De mejor a peor, por lo natural que suenan en español. */
  var PREFERIDAS = [
    /Sabina|Elvira|Mónica|Monica|Paulina|Helena|Laura|Lucía|Lucia/i,  /* voces femeninas de sistema */
    /Google.*espa/i, /Microsoft.*(Spanish|Espa)/i, /es-ES/i, /es[-_]/i
  ];
  var voz = null, vocesListas = false;

  function elegirVoz() {
    var todas = [];
    try { todas = SS.getVoices() || []; } catch (e) { return; }
    if (!todas.length) return;
    var esp = todas.filter(function (v) { return /^es\b|^es[-_]/i.test(v.lang || ""); });
    var pool = esp.length ? esp : todas;
    for (var i = 0; i < PREFERIDAS.length && !voz; i++) {
      for (var j = 0; j < pool.length; j++) {
        if (PREFERIDAS[i].test(pool[j].name + " " + pool[j].lang)) { voz = pool[j]; break; }
      }
    }
    if (!voz) voz = pool[0] || null;
    vocesListas = true;
  }
  elegirVoz();
  if (SS.addEventListener) SS.addEventListener("voiceschanged", elegirVoz);
  else SS.onvoiceschanged = elegirVoz;

  /* ---------------- 3. hablar por frases, que no se corte ---------------- */

  var hablando = false;
  var alAcabar = null;          /* qué hacer cuando termine de hablar del todo */
  var speakOriginal = SS.speak.bind(SS);
  var cancelOriginal = SS.cancel.bind(SS);

  /* Parte por final de frase SIN usar lookbehind: hay iPhones que no lo
     entienden y el archivo entero se caería. Así funciona en todos. */
  /* palabras que llevan punto pero NO terminan la frase */
  var CORTAS = ["sr","sra","srta","dr","dra","dña","dna","ud","uds","núm","num",
                "art","pág","pag","etc","ej","av","avda","ref","apdo","tel",
                "h","min","seg","km","kg","aprox","máx","max","mín","min","pta","dcha","izq"];

  function esAbreviatura(act) {
    var m = /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.]+)\.$/.exec(act);
    if (!m) return false;
    var pal = m[1];
    if (pal.length === 1) return true;                       /* «D.», «y.» */
    if (/^(?:[A-Za-zÁÉÍÓÚÑáéíóúñ]\.)+[A-Za-zÁÉÍÓÚÑáéíóúñ]$/.test(pal)) return true;  /* «D.N.I.» */
    return CORTAS.indexOf(pal.toLowerCase()) >= 0;
  }

  function frases(t) {
    t = String(t);
    var out = [], act = "";
    for (var i = 0; i < t.length; i++) {
      act += t[i];
      if (".!?…:".indexOf(t[i]) >= 0) {
        var sig = t[i + 1];
        /* solo corta si detrás viene un espacio: así no parte 1.500 */
        if (sig === undefined || sig === " " || sig === "\n" || sig === "\t") {
          /* y nunca detrás de «Sr.» o «D.N.I.»: eso no es final de frase */
          if (t[i] === "." && esAbreviatura(act)) continue;
          if (act.trim()) out.push(act.trim());
          act = "";
        }
      }
    }
    if (act.trim()) out.push(act.trim());
    return out;
  }

  function trocear(t) {
    var trozos = [];
    /* corta por final de frase, y si una frase es larguísima, por comas */
    frases(t).forEach(function (f) {
      f = f.trim(); if (!f) return;
      if (f.length <= 220) { trozos.push(f); return; }
      var acumulado = "";
      f.split(/,\s*/).forEach(function (p) {
        /* la coma se queda en el trozo: si no, se pierde la pausa al juntarlos */
        if ((acumulado + ", " + p).length > 220 && acumulado) { trozos.push(acumulado + ","); acumulado = p; }
        else { acumulado = acumulado ? acumulado + ", " + p : p; }
      });
      if (acumulado) trozos.push(acumulado);
    });
    trozos = pegarCortos(trozos);
    return trozos.length ? trozos : [String(t)];
  }

  /* «El Sr.» no se dice solo y luego «Pérez»: eso suena a tartamudeo.
     Pegamos los trozos muy cortos y los que acaban en abreviatura. */
  var ABREV = /(?:^|\s)(?:sr|sra|srta|dr|dra|dña|dna|ud|uds|núm|num|art|p[áa]g|etc|ej|av|avda|ref|apdo|tel)\.$|(?:^|\s)(?:[A-ZÁÉÍÓÚÑ]\.){2,}$/i;

  function pegarCortos(lista) {
    var out = [];
    lista.forEach(function (t) {
      var prev = out.length ? out[out.length - 1] : null;
      if (prev && (prev.length < 45 || ABREV.test(prev)) && (prev + " " + t).length <= 220) {
        out[out.length - 1] = prev + " " + t;
      } else out.push(t);
    });
    return out;
  }

  /* Chrome deja de hablar solo a los ~15 segundos si nadie le toca.
     Un toquecito cada 8 segundos y no se calla a medias. */
  var latido = null;
  function latir(encender) {
    if (encender && !latido) {
      latido = setInterval(function () {
        try { if (SS.speaking) SS.resume(); } catch (e) {}
      }, 8000);
    } else if (!encender && latido) { clearInterval(latido); latido = null; }
  }

  var turno = 0;   /* si llega algo nuevo, lo viejo se abandona */

  function hablar(texto, cuandoAcabe) {
    var limpio = paraDecir(texto);
    if (!limpio) { if (cuandoAcabe) cuandoAcabe(); return; }
    if (!vocesListas) elegirVoz();

    try { cancelOriginal(); } catch (e) {}
    var trozos = trocear(limpio), i = 0;
    var mio = ++turno;
    hablando = true;
    latir(true);

    function fin() { if (mio === turno) { hablando = false; latir(false); } if (cuandoAcabe) cuandoAcabe(); }

    function siguiente() {
      if (mio !== turno) return;                 /* nos han mandado callar */
      if (i >= trozos.length) { fin(); return; }
      var u = new SpeechSynthesisUtterance(trozos[i++]);
      u.__nuestra = true;          /* para que el interceptor no se lo trague otra vez */
      u.lang = "es-ES";
      if (voz) u.voice = voz;
      u.rate = 1.04;     /* un pelín más rápido que el robot de serie */
      u.pitch = 1.0;
      u.volume = 1;
      u.onend = siguiente;
      u.onerror = function () { fin(); };
      /* speakOriginal, NO SS.speak: si no, se llamaría a sí mismo sin parar */
      try { speakOriginal(u); } catch (e) { fin(); }
    }
    siguiente();
  }

  /* Interceptamos el speak() de charla.js: él sigue llamando igual,
     pero la voz la ponemos nosotros. */
  SS.speak = function (u) {
    if (!u || typeof u.text !== "string" || u.__nuestra) return speakOriginal(u);
    hablar(u.text, function () { if (alAcabar) { var f = alAcabar; alAcabar = null; f(); } });
  };

  /* Si charla.js (o el botón de callar) manda parar, paramos de verdad:
     si no, el trozo siguiente arrancaría solo un segundo después. */
  SS.cancel = function () {
    turno++; hablando = false; alAcabar = null; latir(false);
    if (relojRelleno) { clearTimeout(relojRelleno); relojRelleno = null; }
    return cancelOriginal();
  };

  /* ---------------- 4. mientras piensa, no se queda muda ---------------- */

  var RELLENOS = [
    "Dame un segundo que lo miro.",
    "Voy a ver eso.",
    "Un momento, lo compruebo.",
    "Déjame mirarlo.",
    "Ahora mismo lo veo."
  ];
  var ultimoRelleno = -1;
  function relleno() {
    var i; do { i = Math.floor(Math.random() * RELLENOS.length); } while (i === ultimoRelleno && RELLENOS.length > 1);
    ultimoRelleno = i; return RELLENOS[i];
  }

  function vozEncendida() {
    try { return localStorage.getItem("immoia.voz.v1") !== "no"; } catch (e) { return true; }
  }

  /* ---------------- 5. modo conversación (manos libres) ---------------- */

  var LLAVE_MANOS = "immoia.manoslibres.v1";
  function manosLibres() {
    try { return localStorage.getItem(LLAVE_MANOS) === "si"; } catch (e) { return false; }
  }
  function ponerManosLibres(v) {
    try { localStorage.setItem(LLAVE_MANOS, v ? "si" : "no"); } catch (e) {}
  }

  function volverAEscuchar() {
    if (!manosLibres()) return;
    setTimeout(function () {
      if (hablando) return;
      try { if (window.__chaEscuchar) window.__chaEscuchar(); } catch (e) {}
    }, 500);   /* medio segundo de cortesía, como una persona */
  }

  /* ---------------- 6. vigilar la conversación ---------------- */

  var relojRelleno = null;

  function vigilar() {
    var hilo = document.getElementById("cha-hilo");
    if (!hilo) return setTimeout(vigilar, 500);

    ponerBoton();

    new MutationObserver(function () {
      var ultimo = hilo.lastElementChild;
      if (!ultimo) return;
      var texto = (ultimo.textContent || "").trim();

      /* está pensando: si tarda, decimos algo para no dejar silencio */
      if (texto === "Pensando") {
        if (!relojRelleno && vozEncendida()) {
          relojRelleno = setTimeout(function () {
            relojRelleno = null;
            var sigue = document.getElementById("cha-hilo");
            var u = sigue && sigue.lastElementChild;
            if (u && (u.textContent || "").trim() === "Pensando") hablar(relleno());
          }, 1200);
        }
        return;
      }

      if (relojRelleno) { clearTimeout(relojRelleno); relojRelleno = null; }

      /* ha contestado: cuando termine de hablar, vuelve a escuchar */
      if (ultimo.classList && ultimo.classList.contains("cha-ella")) {
        alAcabar = volverAEscuchar;
        if (!vozEncendida()) volverAEscuchar();
      }
    }).observe(hilo, { childList: true, subtree: true, characterData: true });
  }

  /* ---------------- 7. el botón de manos libres ---------------- */

  var intentosBoton = 0;

  function ponerBoton() {
    if (document.getElementById("cha-manos")) return;
    var ancla = document.getElementById("cha-voz");
    /* si charla.js aun no ha pintado su boton de voz, lo reintentamos */
    if (!ancla || !ancla.parentNode) {
      if (intentosBoton++ < 20) setTimeout(ponerBoton, 500);
      return;
    }

    var b = document.createElement("button");
    b.type = "button";
    b.id = "cha-manos";
    b.className = "cha-voz";
    b.style.marginTop = "2px";

    function pintar() {
      b.textContent = manosLibres()
        ? "Modo conversación encendido — te escucha sola al terminar"
        : "Modo conversación apagado — tocar para hablar sin manos";
    }
    b.addEventListener("click", function () {
      var nuevo = !manosLibres();
      ponerManosLibres(nuevo);
      pintar();
      if (nuevo) hablar("Modo conversación encendido. Cuando termine de hablar, te escucho.");
    });
    pintar();
    ancla.parentNode.insertBefore(b, ancla.nextSibling);
  }

  /* ---------------- arranque ---------------- */

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", vigilar);
  else vigilar();

  /* para poder probarlo desde la consola */
  window.IMMOIA_VOZ = {
    version: "1.0",
    decir: hablar,
    comoSeLee: paraDecir,
    vozElegida: function () { return voz ? (voz.name + " (" + voz.lang + ")") : "ninguna"; },
    vocesDisponibles: function () {
      try { return (SS.getVoices() || []).map(function (v) { return v.name + " · " + v.lang; }); }
      catch (e) { return []; }
    },
    manosLibres: manosLibres,
    callar: function () { try { SS.cancel(); } catch (e) {} },
    hablando: function () { return hablando; }
  };
})();
