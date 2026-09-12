/* IMMO IA · NUCLEO — el eje que vigila a los demas.
   ------------------------------------------------------------------
   Por que existe: hasta hoy cada motor (la voz, los papeles, la firma,
   el lector, las ayudas...) se enganchaba por su cuenta al cuadro de
   conversacion. Si uno no llegaba, se apagaba EN SILENCIO y nadie se
   enteraba. El 12 de septiembre se perdio asi el aviso del microfono.

   Que hace: NO toca ningun motor y no cambia como funcionan. Solo
   mira quien ha llegado, quien falta, y lo dice — en la pantalla si
   afecta a la persona, y en el parte si se le pregunta.

   Como se le pregunta, desde la consola del navegador:
       IMMOIA_NUCLEO.texto()   -> una linea en castellano
       IMMOIA_NUCLEO.parte()   -> el detalle, motor por motor
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  if (window.IMMOIA_NUCLEO) return;

  var ESPERA_MS = 9000;   /* cuanto esperamos a que lleguen todos */
  var PASO_MS   = 400;

  /* El catalogo. "esencial" = si falta, la persona lo nota. */
  var PIEZAS = [
    { id: "charla",     global: "__chaEscuchar",           nombre: "el cuadro de conversacion", donde: "ambas",         esencial: true,  sin: "no se puede hablar con la IA" },
    { id: "microfono",  prueba: function(){ return window.IMMOIA_CHARLA && window.IMMOIA_CHARLA.microfono === "avisa"; },
      nombre: "el aviso del microfono", donde: "ambas", esencial: true, sin: "el microfono se quedara mudo cuando falle, como el 12 de septiembre" },
    { id: "voz",        global: "IMMOIA_VOZ",              nombre: "la voz",                    donde: "ambas",         esencial: true,  sin: "no te contestara en voz alta" },
    { id: "papeles",    global: "IMMOIA_PAPELES",          nombre: "los papeles",               donde: "ambas",         esencial: true,  sin: "no saldran los botones de PDF y Word" },
    { id: "firma",      global: "IMMOIA_FIRMA",            nombre: "la firma",                  donde: "ambas",         esencial: false, sin: "no saldra el boton de firmar" },
    { id: "saber",      global: "IMMOIA_SABER",            nombre: "el saber de la zona",       donde: "ambas",         esencial: false, sin: "no traera las ayudas del sitio del que se hable" },
    { id: "ayudas",     global: "IMMOIA_AYUDAS",           nombre: "el motor de ayudas",        donde: "ambas",         esencial: false, sin: "no se pueden consultar las ayudas" },
    { id: "ayudastodas",global: "IMMOIA_AYUDAS_TODAS",     nombre: "las ayudas de las comunidades", donde: "ambas",     esencial: true,  sin: "las ayudas por comunidad no funcionan" },
    { id: "municipios", global: "IMMOIA_MUNICIPIOS_TODOS", nombre: "los municipios",            donde: "ambas",         esencial: false, sin: "no se localizara el municipio" },
    { id: "inmo",       global: "IMMOIA_INMO",             nombre: "la secretaria",             donde: "inmobiliaria",  esencial: true,  sin: "la pagina de la inmobiliaria no sabe su oficio" },
    { id: "fiscal",     global: "IMMOIA_FISCAL",           nombre: "los impuestos",             donde: "inmobiliaria",  esencial: true,  sin: "no sabra el ITP ni el AJD de ninguna comunidad" },
    { id: "leer",       global: "IMMOIA_LEER",             nombre: "el lector de expedientes",  donde: "inmobiliaria",  esencial: false, sin: "no podra leer un PDF que le sueltes" }
  ];
  /* En que pagina estamos. Sin inventar: por lo que hay en el documento. */
  function pagina() {
    var p = (location.pathname || "").toLowerCase();
    if (p.indexOf("inmobiliaria") !== -1) return "inmobiliaria";
    if (document.getElementById("inmo-mesa") || document.getElementById("inmo")) return "inmobiliaria";
    return "portada";
  }
  var PAG = pagina();

  function toca(p) { return p.donde === "ambas" || p.donde === PAG; }
  function hay(p)  { if (p.prueba) { try { return !!p.prueba(); } catch (e) { return false; } }
                     return typeof window[p.global] !== "undefined" && window[p.global] !== null; }

  var llegada = {};   /* id -> milisegundos que tardo en aparecer */
  var arranque = Date.now();
  var avisado = false;

  function mirar() {
    for (var i = 0; i < PIEZAS.length; i++) {
      var p = PIEZAS[i];
      if (!llegada[p.id] && hay(p)) llegada[p.id] = Date.now() - arranque;
    }
  }

  function faltan() {
    var f = [];
    for (var i = 0; i < PIEZAS.length; i++) {
      var p = PIEZAS[i];
      if (toca(p) && !llegada[p.id] && !hay(p)) f.push(p);
    }
    return f;
  }

  /* El parte: todo lo que sabe el nucleo, para mirarlo o para mandarlo. */
  function parte() {
    mirar();
    var lista = [];
    for (var i = 0; i < PIEZAS.length; i++) {
      var p = PIEZAS[i];
      if (!toca(p)) continue;
      lista.push({
        motor: p.nombre, id: p.id,
        esta: !!(llegada[p.id] || hay(p)),
        tardo_ms: llegada[p.id] || null,
        esencial: p.esencial,
        si_falta: p.sin
      });
    }
    var f = faltan();
    return {
      pagina: PAG,
      cuando: new Date().toISOString(),
      eje: !!document.getElementById("cha-hilo"),
      motores: lista,
      faltan: f.map(function (p) { return p.nombre; }),
      faltan_esenciales: f.filter(function (p) { return p.esencial; }).map(function (p) { return p.nombre; }),
      completo: f.length === 0
    };
  }

  function texto() {
    var d = parte();
    if (d.completo) return "IMMO IA: los " + d.motores.length + " motores de esta pagina han arrancado bien.";
    return "IMMO IA: falta " + d.faltan.join(", ") + ". " +
           (d.faltan_esenciales.length ? "Afecta a lo que se ve." : "No afecta a lo principal.");
  }
  /* Si falta algo que la persona va a notar, se DICE. Una linea, dentro
     del propio cuadro de conversacion si existe, y nunca dos veces. */
  function decirlo(f) {
    if (avisado) return;
    var esenciales = f.filter(function (p) { return p.esencial; });
    if (!esenciales.length) return;
    avisado = true;
    var frase = esenciales.length === 1
      ? "Aviso: no ha cargado " + esenciales[0].nombre + ", asi que " + esenciales[0].sin + ". Lo demas sigue funcionando."
      : "Aviso: no han cargado " + esenciales.map(function (p) { return p.nombre; }).join(", ") +
        ". Lo demas sigue funcionando.";
    var hilo = document.getElementById("cha-hilo");
    if (hilo) {
      var d = document.createElement("div");
      d.className = "cha-m cha-mal";
      d.setAttribute("data-nucleo", "aviso");
      d.textContent = frase;
      hilo.appendChild(d);
    } else {
      var a = document.createElement("p");
      a.id = "nucleo-aviso";
      a.setAttribute("role", "status");
      a.style.cssText = "margin:10px 16px;padding:9px 12px;border:1px solid #E3BFA0;background:#FBEDE4;color:#7A3B12;border-radius:9px;font-size:13.5px";
      a.textContent = frase;
      (document.body || document.documentElement).appendChild(a);
    }
    try { console.warn("[IMMO IA nucleo] " + frase); } catch (e) {}
  }

  /* Un canal propio, para que los motores dejen de depender solo del DOM.
     Quien llegue tarde tambien recibe lo que ya paso. */
  var oyentes = {}, pasado = {};
  function cuando(evento, fn) {
    (oyentes[evento] = oyentes[evento] || []).push(fn);
    if (pasado[evento]) { try { fn(pasado[evento]); } catch (e) {} }
  }
  function avisar(evento, datos) {
    pasado[evento] = datos || {};
    (oyentes[evento] || []).forEach(function (fn) { try { fn(pasado[evento]); } catch (e) {} });
  }

  window.IMMOIA_NUCLEO = {
    version: "1.0",
    parte: parte,
    texto: texto,
    faltan: function () { return faltan().map(function (p) { return p.nombre; }); },
    completo: function () { return faltan().length === 0; },
    cuando: cuando,
    avisar: avisar
  };

  /* Vigilancia: se mira cada poco hasta que estan todos o se acaba el
     tiempo. No llama a ningun servidor: no cuesta ni una peticion. */
  var reloj = setInterval(function () {
    mirar();
    var f = faltan();
    if (!f.length) { clearInterval(reloj); avisar("nucleo:completo", parte()); return; }
    if (Date.now() - arranque > ESPERA_MS) {
      clearInterval(reloj);
      decirlo(f);
      avisar("nucleo:faltan", parte());
    }
  }, PASO_MS);
})();
