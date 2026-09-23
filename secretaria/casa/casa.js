/* ==================================================================
   casa.js · LA PUERTA DE LA SECRETARIA

   Por dónde entra, qué ve, y cómo vuelve. Nada más.

   LO PRIMERO QUE VE ES SU MESA. Cambiado por el CARRIL 2 el
   19/09/2026: antes se entraba por las carpetas. Está en una sola
   constante, ENTRA_POR, cuatro líneas más abajo. Poniendo
   "carpetas" vuelve a ser como era, sin tocar nada más.

   ESTA PIEZA YA NO PINTA LA MESA. La mesa entera la pinta
   mesa\la_mesa.js (carril 2), que además es quien llama al repaso.
   Aquí sólo queda el cambio de sitio y la voz.

   NO HAY NI UNA PETICIÓN DE RED AQUÍ. Ni fetch, ni XHR, ni
   WebSocket, ni una dirección de internet. Lo de la mesa viene de
   los_expedientes.js, que está al lado. Lo de la voz es una página
   de esta misma carpeta, y sólo se carga cuando ella la pide.
   ================================================================== */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function crear(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  var LUGARES = ["carpetas", "mesa", "voz"];

  /* POR DÓNDE ENTRA. Una línea, y se da la vuelta entera. */
  var ENTRA_POR = "mesa";

  var dondeEstoy = ENTRA_POR;

  /* ==================================================================
     1 · DÓNDE ESTÁ Y CÓMO VUELVE
     ================================================================== */
  function ir(lugar) {
    if (LUGARES.indexOf(lugar) < 0) lugar = ENTRA_POR;
    dondeEstoy = lugar;
    $("lugar_carpetas").style.display = (lugar === "carpetas") ? "" : "none";
    $("lugar_mesa").style.display     = (lugar === "mesa")     ? "" : "none";
    $("lugar_voz").style.display      = (lugar === "voz")      ? "" : "none";
    var botones = document.querySelectorAll("#barra_casa .sitio");
    for (var i = 0; i < botones.length; i++) {
      var suyo = botones[i].getAttribute("data-lugar") === lugar;
      botones[i].classList.toggle("activo", suyo);
      botones[i].setAttribute("aria-current", suyo ? "page" : "false");
    }
    if (lugar === "mesa") pintarLaMesa();
    if (lugar === "voz") abrirLaVoz();
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  window.LA_SECRETARIA = { ir: ir, donde: function () { return dondeEstoy; } };

  /* ==================================================================
     2 · SU MESA
     ------------------------------------------------------------------
     CAMBIADO POR EL CARRIL 2 (19/09/2026). Antes la mesa se pintaba
     aquí: una lista y poco más. Ahora la pinta entera
     mesa\la_mesa.js, que es quien llama al repaso de wow\repaso.js.

     Aquí sólo queda la llamada, y qué decir si esa pieza no está.
     Se pinta UNA sola vez: al volver de las carpetas o de la voz, la
     mesa se queda tal y como se dejó (incluso con un expediente
     abierto), que es justo lo que pide el encargo.
     ================================================================== */
  function pintarLaMesa() {
    if (window.LA_MESA && typeof window.LA_MESA.pintar === "function") {
      try { window.LA_MESA.pintar(); return; }
      catch (e) {
        var pie0 = $("mesa_pie");
        if (pie0) pie0.textContent = "Tu mesa se ha roto al pintarse: " + (e && e.message ? e.message : e);
        return;
      }
    }
    var pie = $("mesa_pie");
    if (pie) {
      pie.textContent = "No está cargada la pieza de la mesa (mesa\\la_mesa.js). " +
                        "No te enseño una mesa a medias: te digo que falta.";
    }
  }

  /* ==================================================================
     3 · LA VOZ, DENTRO DE ESTA MISMA APLICACIÓN
     ------------------------------------------------------------------
     La voz es la de SUBIR\LA_IDA_Y_VUELTA, entera y sin tocar, y vive
     en voz\ de esta misma carpeta. Se carga en un marco dentro de esta
     página: es la misma aplicación, no otra dirección.

     LO QUE NO SE PUEDE DISIMULAR: la voz está escrita en módulos de
     JavaScript, y ningún navegador deja cargar un módulo cuando la
     página se ha abierto con doble clic (file://). Ahí NO se carga el
     marco: se dice por qué y se dice cómo se abre. Poner el marco
     igual sería dejar una pantalla que pone «Un momento, que ya te
     hablo» y no habla nunca.
     ================================================================== */
  var vozPuesta = false;

  function abrirLaVoz() {
    if (vozPuesta) return;
    vozPuesta = true;

    var deDobleClic = (window.location.protocol === "file:");

    if (deDobleClic) {
      $("voz_pie").textContent =
        "Aquí no puede arrancar, y esto es lo que pasa de verdad:";
      var a = $("voz_aviso");
      a.style.display = "";
      a.appendChild(document.createTextNode(
        "Has abierto la aplicación con doble clic. Así funciona todo lo de tus carpetas, " +
        "y funciona sin internet. Pero la voz está hecha de módulos de JavaScript, y ningún " +
        "navegador los deja cargar desde un fichero suelto: los bloquea siempre. " +
        "Para hablar con ella hay que abrir la aplicación con "));
      a.appendChild(crear("code", null, "ABRIR_CON_LA_VOZ.bat"));
      a.appendChild(document.createTextNode(
        ", que la levanta en este mismo ordenador y la abre en el navegador. " +
        "Es el mismo programa y la misma carpeta."));
      return;
    }

    $("voz_pie").textContent =
      "Un toque y a hablar. Se la puede cortar a media frase. Es la misma aplicación: " +
      "esta parte vive en la carpeta voz\\, aquí al lado.";

    var marco = document.createElement("iframe");
    marco.id = "voz_iframe";
    marco.title = "Hablar con la secretaria";
    marco.setAttribute("allow", "microphone");
    marco.src = "voz/index.html";
    $("voz_marco").appendChild(marco);
  }

  /* ==================================================================
     4 · ARRANQUE
     ================================================================== */
  document.addEventListener("DOMContentLoaded", function () {
    var botones = document.querySelectorAll("#barra_casa .sitio");
    for (var i = 0; i < botones.length; i++) {
      botones[i].addEventListener("click", function (ev) {
        ir(ev.currentTarget.getAttribute("data-lugar"));
      });
    }

    /* Los dos atajos de la mesa: desde su mesa a las carpetas y a la
       voz en un clic, sin bajar a la barra. */
    var aCarpetas = $("ir_a_carpetas"), aVoz = $("ir_a_voz");
    if (aCarpetas) aCarpetas.addEventListener("click", function () { ir("carpetas"); });
    if (aVoz) aVoz.addEventListener("click", function () { ir("voz"); });

    /* ==================================================================
       EL BOTÓN DEL WOW TIENE QUE ACEPTAR QUE LE SUELTEN LA CARPETA
       ------------------------------------------------------------------
       Pone «Arrastra aquí tus carpetas», así que aquí se tiene que
       poder soltar. Si solo llevara a la otra pantalla, la frase sería
       mentira: ella arrastraría encima y no pasaría nada. Y eso es
       justo el gesto de la demostración del lunes.

       Lo que se hace: se recoge lo que suelta y se le pasa TAL CUAL a
       la zona de siempre, la del wow, que es la que sabe abrir
       carpetas. Aquí no se abre ni un fichero: solo se reenvía.

       Y hay que hacerlo EN EL ACTO, sin esperar a nada: el navegador
       vacía lo que se ha soltado en cuanto se suelta el hilo.
       ================================================================== */
    var wow = $("mesa_wow");
    if (wow) {
      ["dragenter", "dragover"].forEach(function (ev) {
        wow.addEventListener(ev, function (e) {
          e.preventDefault(); e.stopPropagation();
          wow.classList.add("encima");
        });
      });
      ["dragleave", "dragend"].forEach(function (ev) {
        wow.addEventListener(ev, function () { wow.classList.remove("encima"); });
      });
      wow.addEventListener("drop", function (e) {
        e.preventDefault(); e.stopPropagation();
        wow.classList.remove("encima");
        ir("carpetas");
        var zona = $("zona");
        if (!zona) return;
        try {
          zona.dispatchEvent(new DragEvent("drop", {
            dataTransfer: e.dataTransfer, bubbles: true, cancelable: true
          }));
        } catch (err) {
          /* si este navegador no deja reenviarlo, ella ya está en la
             pantalla de las carpetas y puede volver a soltarlo ahí.
             No se queda mirando una pantalla que no hace nada. */
        }
      });
    }

    ir(ENTRA_POR);
  });
})();
