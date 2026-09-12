/* ============================================================
   firma.js — FIRMAR CON EL CERTIFICADO DE LA EMPRESA

   Debajo de cada papel que prepara la secretaria sale tambien
   el boton "Firmar". Al pulsarlo:

     1. Se hace el PDF del papel (lo hace papeles.js).
     2. Se le pasa a AutoFirma, el programa oficial del Gobierno
        que ya tiene ella instalado con su certificado.
     3. Ella elige su certificado y pone su clave EN AUTOFIRMA,
        nunca aqui. Esta pagina no ve ni guarda ninguna clave.
     4. Vuelve el PDF firmado y se baja al ordenador, listo para
        presentar.

   Si AutoFirma no esta o no responde, NO se queda colgado: baja
   el PDF sin firmar y le explica en dos lineas que tiene que
   hacer. Nunca se queda sin el papel.

   Ademas, abajo del todo hay "Firmar un papel que ya tengas",
   para firmar cualquier PDF del ordenador, venga de donde venga.

   El programa oficial se baja de aqui:
   https://firmaelectronica.gob.es/Home/Descargas.html
   ============================================================ */
(function () {
  "use strict";

  var SCRIPT_OFICIAL = "autoscript.js";   /* el fichero del Gobierno, en nuestra web */
  var ALGORITMO = "SHA512withRSA";
  var FORMATO = "PAdES";                  /* el formato de firma de los PDF */
  var ESPERA = 45000;                     /* 45 s y damos el aviso */

  /* ---------------- pinta ---------------- */

  var CSS =
    ".fir-aviso{margin:8px 0 2px;padding:10px 12px;border:1px solid #D8CFAE;background:#FBF7E8;" +
    "border-radius:9px;font-size:13px;line-height:1.45;color:#3C3520}" +
    ".fir-aviso b{color:#13342A}" +
    ".fir-aviso a{color:#13342A}" +
    ".fir-caja{margin:14px 0 0;padding:12px 13px;border:1px solid #CBD9D0;border-radius:10px;background:#F7F9F8}" +
    ".fir-caja h4{margin:0 0 4px;font-size:13.5px;color:#13342A}" +
    ".fir-caja p{margin:0 0 9px;font-size:12.5px;color:#4A5550;line-height:1.45}" +
    ".fir-caja input[type=file]{font:inherit;font-size:12.5px;max-width:100%}" +
    ".fir-estado{margin-top:8px;font-size:12.5px;color:#13342A;font-weight:600}";

  (function () {
    var e = document.createElement("style");
    e.textContent = CSS;
    document.head.appendChild(e);
  })();

  /* ---------------- cargar el programa oficial, solo cuando hace falta ---------------- */

  var cargando = null;

  function traerAutoScript() {
    if (window.AutoScript) return Promise.resolve(window.AutoScript);
    if (cargando) return cargando;
    cargando = new Promise(function (bien, mal) {
      var s = document.createElement("script");
      s.src = SCRIPT_OFICIAL;
      s.onload = function () {
        if (window.AutoScript) bien(window.AutoScript);
        else mal(new Error("cargado pero sin AutoScript"));
      };
      s.onerror = function () { mal(new Error("no se pudo cargar " + SCRIPT_OFICIAL)); };
      document.head.appendChild(s);
    });
    return cargando;
  }

  function preparar(AS) {
    try { AS.setMinimumClientVersion("1.8"); } catch (e) {}
    try { AS.setStickySignatory(true); } catch (e) {}   /* que no pregunte el certificado cada vez */
    try { AS.cargarAppAfirma(); } catch (e) {}
    return AS;
  }

  /* ---------------- pasar bytes a base64 y al reves ---------------- */

  function aBase64(bytes) {
    var trozo = 0x8000, partes = [];
    for (var i = 0; i < bytes.length; i += trozo) {
      partes.push(String.fromCharCode.apply(null, bytes.subarray(i, i + trozo)));
    }
    return btoa(partes.join(""));
  }

  /* AutoFirma devuelve el base64 "para URL": hay que enderezarlo */
  function deBase64(t) {
    var s = String(t || "").replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
    while (s.length % 4) s += "=";
    var bruto = atob(s);
    var b = new Uint8Array(bruto.length);
    for (var i = 0; i < bruto.length; i++) b[i] = bruto.charCodeAt(i);
    return b;
  }

  /* ---------------- el nucleo: firmar unos bytes ---------------- */

  function firmarBytes(bytes, cuandoSalga, cuandoFalle) {
    traerAutoScript().then(function (AS) {
      preparar(AS);

      var yaEsta = false;
      var reloj = setTimeout(function () {
        if (yaEsta) return;
        yaEsta = true;
        cuandoFalle("TimeoutException", "AutoFirma no ha contestado.");
      }, ESPERA);

      function acabo(f) {
        return function (a, b, c) {
          if (yaEsta) return;
          yaEsta = true;
          clearTimeout(reloj);
          f(a, b, c);
        };
      }

      try {
        AS.sign(
          aBase64(bytes),
          ALGORITMO,
          FORMATO,
          "",                       /* sin firma visible: vale igual para presentar */
          acabo(function (firma, certificado) { cuandoSalga(deBase64(firma), certificado); }),
          acabo(function (tipo, mensaje) { cuandoFalle(String(tipo || ""), String(mensaje || "")); })
        );
      } catch (e) {
        if (!yaEsta) { yaEsta = true; clearTimeout(reloj); cuandoFalle("Excepcion", String(e)); }
      }
    }, function (e) {
      cuandoFalle("SinScript", String(e && e.message || e));
    });
  }

  /* ---------------- que le decimos a ella cuando algo falla ---------------- */

  function enCristiano(tipo, mensaje) {
    var t = String(tipo || "");

    if (/Cancel/i.test(t) || /AS500001/.test(t) || /AS500001/.test(mensaje)) {
      return null;                                  /* lo ha cancelado ella: no es un fallo */
    }
    if (/ApplicationNotFound/i.test(t) || /SinScript/.test(t)) {
      return "<b>No encuentro AutoFirma en este ordenador.</b> Te he bajado el papel en PDF igualmente. " +
             "Instala AutoFirma una sola vez desde " +
             "<a href='https://firmaelectronica.gob.es/Home/Descargas.html' target='_blank' rel='noopener'>la pagina del Gobierno</a>" +
             ", y a partir de ahi el boton Firmar te lo hace todo solo.";
    }
    if (/Timeout/i.test(t)) {
      return "<b>AutoFirma no ha contestado.</b> Suele pasar la primera vez: mira si se ha abierto detras " +
             "una ventana de AutoFirma pidiendote permiso, o si el navegador te ha preguntado si dejas abrir " +
             "el programa. Te he bajado el PDF sin firmar para que no pierdas el papel; dale otra vez a Firmar " +
             "cuando la ventana este delante.";
    }
    return "<b>La firma no ha salido.</b> Te he bajado el PDF sin firmar: puedes abrirlo con AutoFirma y " +
           "firmarlo ahi a mano, que vale exactamente igual. " +
           (mensaje ? "<br><span style='color:#8A7F5F'>(" + escapar(mensaje).slice(0, 160) + ")</span>" : "");
  }

  function escapar(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function decir(donde, html) {
    if (!html) return;
    var a = document.createElement("div");
    a.className = "fir-aviso";
    a.innerHTML = html;
    if (donde && donde.parentNode) donde.parentNode.insertBefore(a, donde.nextSibling);
    else document.body.appendChild(a);
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 32000);
  }

  function bajar(bytes, nombre, tipo) {
    var url = URL.createObjectURL(new Blob([bytes], { type: tipo || "application/pdf" }));
    var a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }

  /* ---------------- el boton Firmar debajo de cada papel ---------------- */

  function papeles() { return window.IMMOIA_PAPELES; }

  function ponerFirmar(fila) {
    if (!fila || fila.getAttribute("data-fir")) return;
    var P = papeles();
    if (!P || !P.pdfBytes) return;                  /* sin papeles.js no hay PDF que firmar */
    fila.setAttribute("data-fir", "si");

    /* la burbuja de la que cuelga esta fila */
    var burbuja = fila.previousElementSibling;
    if (!burbuja) return;

    var b = document.createElement("button");
    b.type = "button";
    b.textContent = "Firmar";
    b.addEventListener("click", function () {
      var texto = burbuja.textContent || "";
      var titulo = P.titulo(texto);
      var base = titulo.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "documento";
      var pdf;
      try { pdf = P.pdfBytes(texto, titulo); }
      catch (e) { decir(fila, "<b>No he podido montar el PDF.</b> Usa Guardar en Word."); return; }

      var antes = b.textContent;
      b.textContent = "Abriendo AutoFirma...";
      b.disabled = true;
      function suelta() { b.textContent = antes; b.disabled = false; }

      firmarBytes(pdf,
        function (firmado) {
          suelta();
          bajar(firmado, base + "_FIRMADO.pdf");
          b.textContent = "Firmado";
          setTimeout(function () { b.textContent = antes; }, 2600);
        },
        function (tipo, mensaje) {
          suelta();
          var aviso = enCristiano(tipo, mensaje);
          if (aviso) { bajar(pdf, base + ".pdf"); decir(fila, aviso); }
        });
    });

    fila.appendChild(b);
  }

  function repasar() {
    var filas = document.querySelectorAll(".pap");
    for (var i = 0; i < filas.length; i++) ponerFirmar(filas[i]);
  }

  /* ---------------- firmar un papel que ya tenga en el ordenador ---------------- */

  function cajaSuelta() {
    var ancla = document.getElementById("inmo-mesa") || document.querySelector(".cha");
    if (!ancla || document.getElementById("fir-caja")) return;

    var c = document.createElement("div");
    c.className = "fir-caja";
    c.id = "fir-caja";
    c.innerHTML =
      "<h4>Firmar un papel que ya tengas</h4>" +
      "<p>Coge un PDF de tu ordenador y te lo devuelvo firmado con tu certificado. " +
      "La clave la pones en AutoFirma, aqui no se escribe ni se guarda nada.</p>";

    var f = document.createElement("input");
    f.type = "file";
    f.accept = ".pdf,application/pdf";
    var estado = document.createElement("div");
    estado.className = "fir-estado";

    f.addEventListener("change", function () {
      var fich = f.files && f.files[0];
      if (!fich) return;
      if (!/\.pdf$/i.test(fich.name)) {
        estado.textContent = "De momento solo PDF. Guarda el papel en PDF y vuelve a probar.";
        return;
      }
      estado.textContent = "Abriendo AutoFirma...";
      var lec = new FileReader();
      lec.onload = function () {
        var bytes = new Uint8Array(lec.result);
        var base = fich.name.replace(/\.pdf$/i, "");
        firmarBytes(bytes,
          function (firmado) {
            estado.textContent = "Firmado. Te lo he bajado.";
            bajar(firmado, base + "_FIRMADO.pdf");
            f.value = "";
          },
          function (tipo, mensaje) {
            var aviso = enCristiano(tipo, mensaje);
            estado.textContent = aviso ? "" : "Lo has cancelado tu. No pasa nada.";
            if (aviso) decir(estado, aviso);
            f.value = "";
          });
      };
      lec.onerror = function () { estado.textContent = "No he podido leer ese archivo."; };
      lec.readAsArrayBuffer(fich);
    });

    c.appendChild(f);
    c.appendChild(estado);
    ancla.parentNode.insertBefore(c, ancla.nextSibling);
  }

  /* ---------------- arranque ---------------- */

  function arranca() {
    cajaSuelta();
    repasar();
    var hilo = document.getElementById("cha-hilo");
    if (hilo) {
      new MutationObserver(function () { setTimeout(repasar, 180); })
        .observe(hilo, { childList: true, subtree: true });
    } else {
      setTimeout(arranca, 800);
      return;
    }
    setInterval(repasar, 2500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arranca);
  else arranca();

  window.IMMOIA_FIRMA = {
    version: "1.0",
    firmarBytes: firmarBytes,
    repasar: repasar,
    /* para probar a mano desde la consola */
    hayAutoFirma: function (luego) {
      firmarBytes(new Uint8Array([37, 80, 68, 70]),
        function () { luego(true, "responde"); },
        function (t, m) { luego(!/ApplicationNotFound|SinScript/i.test(t), t + " " + m); });
    }
  };
})();
