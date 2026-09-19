/* ==================================================================
   IMMO IA · lo_de_ella.js — LO SUYO, YA PUESTO, SIN FORMULARIO
   ------------------------------------------------------------------
   LA CUENTA DE ELLA · 19/09/2026.

   EL PROBLEMA QUE ARREGLA. La página de la inmobiliaria se abría en
   blanco: «Todavía no tienes ninguno», «Tengo 0 de 6» y las casillas
   de la cuenta vacías. Para ver algo había que rellenar formularios
   delante de la directora, que es exactamente lo que no se puede
   hacer en los primeros treinta segundos de una demostración.

   QUÉ HACE. Si este navegador NO tiene todavía ningún expediente,
   deja puestos CUATRO de ejemplo -dos en Adeje y dos en Arona- y la
   caja «Lo que llevas esta semana» escrita. Nada más. Se carga antes
   que cartera.js y que inmo.js, que es quien los lee.

   QUÉ NO HACE, Y ES A PROPÓSITO:
     · NO pisa nada. Si ya hay un expediente en este navegador, o si
       hay una cuenta de oficina abierta (oficina.js), se va sin
       tocar una tecla. El trabajo de verdad manda siempre.
     · NO llama a ningún servidor. Ni uno. Todo esto se queda en este
       ordenador, igual que lo que escribe ella.
     · NO vuelve a ponerlos si ella los quita: queda una marca.
     · NO dice en pantalla que son suyos. Dice que son de ejemplo,
       porque lo son: calles inventadas, personas inventadas y
       documentos con ceros. Ni un dato de una persona real.

   LOS DATOS DE VERDAD DE SU OFICINA no están aquí ni pueden estar:
   hacen falta su nombre de oficina, su clave y el código de alta del
   servidor, y eso solo lo tiene la dirección. Está escrito en
   LO_QUE_FALTA_PREGUNTARLE.md.
   ================================================================== */
(function () {
  "use strict";
  if (window.IMMOIA_LO_DE_ELLA) return;

  var LLAVE_CARTERA  = "immoia.cartera.v1";
  var LLAVE_BANDEJA  = "immoia.autonomia.v1";   /* donde la bandeja busca el activo */
  var LLAVE_MESA     = "immoia.mesa.v1";
  var LLAVE_OFICINA  = "immoia.oficina.cuenta.v1";
  var MARCA          = "immoia.lodeella.v1";    /* "puesto" | "quitado" */

  /* ---------- el almacén, envuelto: en navegación privada puede fallar ---------- */
  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function poner(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function quitarLlave(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function hoyCorto() {
    if (typeof window.IMMOIA_HOY === "function") return window.IMMOIA_HOY();
    var d = new Date(), m = d.getMonth() + 1, x = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (x < 10 ? "0" + x : x);
  }
  function ahora() { return new Date().toISOString(); }

  /* ==================================================================
     LOS CUATRO EXPEDIENTES · TODO INVENTADO
     Calles inventadas de Adeje y Arona, personas inventadas, y los
     documentos de identidad con ceros y rotulados EJEMPLO. Los correos
     van a example.com, que es el dominio reservado para ejemplos y no
     llega a nadie.
     Mismos nombres de campo que asistente/primer_minuto/mesa.js espera
     (via, piso, municipio, propietario, operacion, documentos,
     ultimo_movimiento, es_ejemplo), para que el día que la cuenta del
     servidor exista esto se lea igual desde el asistente.
     ================================================================== */
  var CUATRO = [
    {
      nombre: "Tabaiba Dulce 14",
      ficha: {
        expediente_id: "EXP-DIR-01",
        es_ejemplo: true,
        direccion: "calle Tabaiba Dulce 14, 2ºC, Adeje",
        via: "calle Tabaiba Dulce 14", piso: "2ºC", municipio: "Adeje",
        precio: "268.000 €",
        ccaa: "Canarias",
        correo_admin: "administracion.tabaiba@example.com",
        fecha_firma: "15/10/2026",
        correo_cliente: "nieves.garabato@example.com",
        propietario: "Nieves Garabato Luz",
        documento: "DNI 00000011-A (EJEMPLO)",
        operacion: "venta",
        documentos: [
          { cual: "nota simple informativa", estado_documento: "recibido", fecha: "2026-08-28" },
          { cual: "certificado de eficiencia energética (letra E)", estado_documento: "recibido", fecha: "2019-03-10" },
          { cual: "últimos recibos del IBI", estado_documento: "recibido" },
          { cual: "DNI de la propietaria", estado_documento: "verificado", fecha: "2026-08-28" },
          { cual: "contrato de arras", estado_documento: "recibido", fecha: "2026-09-02" },
          { cual: "certificado de estar al día en la comunidad de propietarios", estado_documento: "pedido", fecha: "2026-09-16" },
          { cual: "cita de notaría", estado_documento: "pedido" }
        ],
        ultimo_movimiento: "2026-09-16",
        ultimo_movimiento_que: "pedido el certificado de la comunidad al administrador"
      }
    },
    {
      nombre: "Mar de Nubes 5",
      ficha: {
        expediente_id: "EXP-DIR-02",
        es_ejemplo: true,
        direccion: "avenida Mar de Nubes 5, bajo A, Costa Adeje",
        via: "avenida Mar de Nubes 5", piso: "bajo A", municipio: "Costa Adeje, Adeje",
        precio: "395.000 €",
        ccaa: "Canarias",
        correo_admin: "fincas.mardenubes@example.com",
        fecha_firma: "sin fecha todavía",
        correo_cliente: "hans.beispiel@example.com",
        propietario: "Hans Beispiel",
        documento: "NIE X0000012-B (EJEMPLO)",
        operacion: "venta",
        documentos: [
          { cual: "nota simple informativa", estado_documento: "recibido", fecha: "2026-08-20" },
          { cual: "certificado de eficiencia energética", estado_documento: "falta" },
          { cual: "últimos recibos del IBI", estado_documento: "recibido" },
          { cual: "NIE del propietario", estado_documento: "verificado", fecha: "2026-08-20" }
        ],
        ultimo_movimiento: "2026-08-25",
        ultimo_movimiento_que: "visita con una pareja interesada"
      }
    },
    {
      nombre: "Cardón Alto 22",
      ficha: {
        expediente_id: "EXP-DIR-03",
        es_ejemplo: true,
        direccion: "calle Cardón Alto 22, 1ºB, Los Cristianos",
        via: "calle Cardón Alto 22", piso: "1ºB", municipio: "Los Cristianos, Arona",
        precio: "1.150 € al mes",
        ccaa: "Canarias",
        correo_admin: "administracion.cardon@example.com",
        fecha_firma: "01/09/2026",
        correo_cliente: "tomas.brezo@example.com",
        propietario: "Tomás Brezo Almácigo",
        documento: "DNI 00000013-C (EJEMPLO)",
        operacion: "alquiler",
        documentos: [
          { cual: "contrato de arrendamiento", estado_documento: "recibido", fecha: "2026-09-01" },
          { cual: "certificado de eficiencia energética (letra F)", estado_documento: "recibido", fecha: "2016-09-24" },
          { cual: "fianza depositada en el Instituto Canario de la Vivienda", estado_documento: "recibido", fecha: "2026-09-08" },
          { cual: "inventario y fotos del piso", estado_documento: "recibido", fecha: "2026-09-01" },
          { cual: "DNI de las dos partes", estado_documento: "verificado", fecha: "2026-09-01" }
        ],
        ultimo_movimiento: "2026-09-08",
        ultimo_movimiento_que: "depositada la fianza"
      }
    },
    {
      nombre: "Risco del Guirre 7",
      ficha: {
        expediente_id: "EXP-DIR-04",
        es_ejemplo: true,
        direccion: "calle Risco del Guirre 7, Valle San Lorenzo",
        via: "calle Risco del Guirre 7", piso: "", municipio: "Valle San Lorenzo, Arona",
        precio: "312.000 €",
        ccaa: "Canarias",
        correo_admin: "administracion.guirre@example.com",
        fecha_firma: "25/09/2026",
        correo_cliente: "eleanor.sample@example.com",
        propietario: "Eleanor Sample",
        documento: "pasaporte 000000014 (EJEMPLO)",
        operacion: "venta",
        documentos: [
          { cual: "nota simple informativa", estado_documento: "recibido", fecha: "2026-09-05" },
          { cual: "certificado de eficiencia energética (letra D)", estado_documento: "recibido", fecha: "2022-05-12" },
          { cual: "últimos recibos del IBI", estado_documento: "recibido" },
          { cual: "pasaporte de la propietaria", estado_documento: "verificado", fecha: "2026-09-05" },
          { cual: "contrato de arras", estado_documento: "recibido", fecha: "2026-09-07" },
          { cual: "certificado de estar al día en la comunidad de propietarios", estado_documento: "pedido", fecha: "2026-09-09" },
          { cual: "cita de notaría", estado_documento: "recibido", fecha: "2026-09-25" }
        ],
        ultimo_movimiento: "2026-09-10",
        ultimo_movimiento_que: "confirmada la cita de notaría"
      }
    }
  ];

  /* «Lo que llevas esta semana», escrito como lo escribiría ella: a
     medias, con el nombre corto del piso y el nombre de pila delante,
     y lo que hay que hacer sin adornos. Es texto de ejemplo, sobre
     estos mismos cuatro expedientes. */
  var LA_SEMANA = [
    "Tabaiba Dulce 14 (Nieves) — arras firmadas el 2. Pedido el de la comunidad el 16, el administrador va lento. Notaría sin fecha todavía; en las arras pone como tarde el 15/10.",
    "",
    "Mar de Nubes 5 (Hans) — parado desde la visita del 25/8. Llamarle esta semana. Sigue sin certificado energético, el técnico no ha ido.",
    "",
    "Cardón Alto 22 (alquiler, Tomás) — firmado el 1, fianza depositada el 8. Nada pendiente.",
    "",
    "Risco del Guirre 7 (Eleanor) — notaría el viernes 25. El administrador no contesta lo de la comunidad desde el 9: reclamar por escrito."
  ].join("\n");

  /* LOS SEIS DATOS QUE DECLARA EL MOTOR (motor.js, var DATOS). Van en dos
     sitios y hacen falta los dos, que es donde estaba el fallo:
       · en "ficha"              -> es lo que se ve escrito en las casillas
       · en "expediente.datos"   -> es lo que el motor mira para no volver a
                                    preguntarlo
     Si solo se pone la ficha, la pantalla dice «Lo tengo todo» y dos dedos
     más abajo la secretaria pide «me falta la direccion de la casa». Eso es
     una pantalla que se contradice sola, y no puede salir el lunes. */
  var LOS_SEIS = ["direccion", "precio", "ccaa", "correo_admin", "fecha_firma", "correo_cliente"];

  /* ---------- la forma exacta que espera la bandeja ---------- */
  function guardadoDe(uno) {
    var puestos = LOS_SEIS.filter(function (k) { return !!uno.ficha[k]; });
    return {
      llaves: [],                                  /* ningún permiso dado: no se inventa ninguno */
      expediente: {
        nombre: uno.nombre, hechos: [], avisados: [], en_marcha: [], rechazados: [],
        senales: [], datos: puestos, diario: [], avisos_hoy: 0, aviso_abierto: null,
        abiertos: [], dia: hoyCorto()
      },
      ficha: uno.ficha,
      gestiones: []
    };
  }

  /* ---------- ¿hay que poner algo, o no se toca nada? ---------- */
  function yaHayExpedientes() {
    try {
      var c = JSON.parse(leer(LLAVE_CARTERA) || "null");
      if (c && c.exp && Object.keys(c.exp).length) return true;
    } catch (e) {}
    try {
      var b = JSON.parse(leer(LLAVE_BANDEJA) || "null");
      if (b && b.expediente) return true;
    } catch (e) {}
    return false;
  }
  function hayCuentaDeOficina() {
    try {
      var o = JSON.parse(leer(LLAVE_OFICINA) || "null");
      return !!(o && o.usuario);
    } catch (e) { return false; }
  }
  function mesaVacia() { return !String(leer(LLAVE_MESA) || "").trim(); }

  var puesto = false;

  function ponerlos() {
    var C = { v: 0, activo: null, orden: [], exp: {}, tocada: ahora() };
    CUATRO.forEach(function (uno, i) {
      var k = "ej" + (i + 1);
      C.exp[k] = { id: k, nombre: uno.nombre, creado: ahora(), tocado: ahora(), guardado: guardadoDe(uno) };
      C.orden.push(k);
    });
    C.activo = C.orden[0];
    if (!poner(LLAVE_CARTERA, JSON.stringify(C))) return false;
    /* el activo, donde la bandeja lo busca. cartera.js lo hace también al
       arrancar; se pone aquí para no depender del orden de carga. */
    poner(LLAVE_BANDEJA, JSON.stringify(C.exp[C.activo].guardado));
    if (mesaVacia()) poner(LLAVE_MESA, LA_SEMANA);
    poner(MARCA, "puesto");
    return true;
  }

  function quitarlos() {
    quitarLlave(LLAVE_CARTERA);
    quitarLlave(LLAVE_CARTERA + ".de");
    quitarLlave(LLAVE_CARTERA + ".caducada");
    quitarLlave(LLAVE_BANDEJA);
    quitarLlave(LLAVE_MESA);
    quitarLlave(LLAVE_MESA + ".sello");
    quitarLlave(LLAVE_MESA + ".de");
    poner(MARCA, "quitado");
  }

  /* ---------- EL MOMENTO: antes que cartera.js y que inmo.js ---------- */
  var marca = String(leer(MARCA) || "");
  if (marca === "") {
    if (!hayCuentaDeOficina() && !yaHayExpedientes()) puesto = ponerlos();
  } else if (marca === "puesto") {
    puesto = yaHayExpedientes();
  }

  /* ---------- LA LÍNEA QUE LO DICE ----------
     Si lo que se está viendo son los cuatro de ejemplo, se dice en
     pantalla. Callarlo sería dejar creer que son expedientes suyos.
     Y con un botón se van, para que pueda empezar los de verdad. */
  function ponerAviso() {
    var sitio = document.getElementById("lo-de-ella-aviso");
    if (!sitio || !puesto) return;
    sitio.innerHTML = "";
    var p = document.createElement("p");
    p.style.cssText = "margin:0 0 14px;padding:9px 12px;border:1px solid #E0BD98;"
      + "background:#FBEFE3;color:#7A4318;border-radius:9px;font-size:13.5px;line-height:1.5";
    p.setAttribute("role", "status");
    p.appendChild(document.createTextNode(
      "Los cuatro expedientes y las notas de esta semana son DE EJEMPLO: calles y personas "
      + "inventadas, para ver la pantalla llena. Se quedan en este ordenador y no salen de aquí. "));
    var b = document.createElement("button");
    b.type = "button";
    b.id = "lo-de-ella-quitar";
    b.textContent = "Quitar los de ejemplo y empezar de cero";
    b.style.cssText = "font:inherit;font-size:13.5px;font-weight:700;padding:5px 11px;margin-top:6px;"
      + "display:block;border:1px solid #7A4318;border-radius:8px;background:#fff;color:#7A4318;cursor:pointer";
    b.addEventListener("click", function () {
      quitarlos();
      location.reload();
    });
    p.appendChild(b);
    sitio.appendChild(p);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ponerAviso);
  else ponerAviso();

  window.IMMOIA_LO_DE_ELLA = {
    version: "1.0",
    /* true = lo que hay en pantalla son los cuatro de ejemplo */
    deEjemplo: function () { return !!puesto; },
    cuantos: function () { return CUATRO.length; },
    nombres: function () { return CUATRO.map(function (u) { return u.nombre; }); },
    quitar: quitarlos
  };
})();
