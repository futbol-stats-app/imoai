/* ==================================================================
   IMMO IA · oficina.js — LA CUENTA DE CADA INMOBILIARIA
   ------------------------------------------------------------------
   Por que existe: hasta hoy todas las oficinas entraban con el mismo
   codigo y la mesa se guardaba por el NOMBRE de la oficina, que viaja
   en el enlace. Con escribir el nombre de otra agencia se veian sus
   cosas. Con una sola clienta daba igual. Con dos, no.

   Que hace: cada oficina tiene su usuario y su clave. La llave del
   almacen del servidor se calcula a partir de la clave, asi que sin
   la clave no se sabe ni donde estan los datos de esa oficina.

   Que NO hace: no toca la conversacion, ni el motor, ni la bandeja.
   Solo guarda y trae. Si no hay cuenta, todo sigue funcionando en
   este ordenador como hasta ahora.
   ================================================================== */
(function () {
  "use strict";
  if (window.IMMOIA_OFICINA) return;

  /* LA CLAVE DE LA OFICINA YA NO SE GUARDA EN ESTE NAVEGADOR.
     Hasta hoy se guardaba tal cual, en claro, en el almacen del
     navegador: quien se sentara delante de ese ordenador -o cualquier
     cosa capaz de leer ese almacen- tenia la contrasena de la oficina
     escrita, no un rastro de ella. Y como mucha gente repite contrasena,
     eso no abria solo la puerta de esta cuenta.
     Lo que se guarda ahora es SOLO lo que hace falta para mantener la
     sesion abierta: el nombre de la oficina y la LLAVE DE PASO que
     devuelve el servidor, que caduca sola a las doce horas y se puede
     anular desde la cuenta. La clave se usa una vez, para entrar, y se
     olvida en cuanto el servidor contesta.
     QUE CAMBIA PARA LA PERSONA: cuando la llave caduca hay que volver a
     escribir la clave. Antes no hacia falta porque estaba guardada; eso
     era exactamente el problema. */
  var LLAVE = "immoia.oficina.cuenta.v1";
  var cuenta = null;          /* { usuario, sesion, sesion_vence } */

  function api() {
    try {
      var c = window.CONFIG;
      return c && c.api ? String(c.api).replace(/\/$/, "") : "";
    } catch (e) { return ""; }
  }
  function codigoWeb() {
    try { return (window.CONFIG && window.CONFIG.codigo) || "leire2026"; } catch (e) { return "leire2026"; }
  }

  /* LO QUE SE QUEDA ESCRITO EN EL NAVEGADOR, Y NADA MAS.
     Todo lo que se guarda pasa por aqui, asi que aqui es donde se
     garantiza que la clave no llega al almacen. Aunque alguien mande
     una clave por descuido, esta funcion no la copia. */
  function soloLoQueHaceFalta(c) {
    if (!c || !c.usuario) return null;
    return {
      usuario: String(c.usuario),
      id: c.id ? String(c.id) : null,   /* L-56: el identificador de la cuenta, que es con lo que se marca la mesa */
      sesion: c.sesion || null,
      sesion_vence: c.sesion_vence || null
    };
  }

  function leerCuenta() {
    if (cuenta) return cuenta;
    try {
      var c = JSON.parse(localStorage.getItem(LLAVE) || "null");
      /* SI LO GUARDADO TRAE UNA CLAVE, ES DE ANTES DE ESTE CAMBIO: se
         borra del almacen ahora mismo, sin esperar a nada. Es la unica
         manera de que las claves que ya estan escritas en los
         navegadores de las oficinas desaparezcan de verdad. */
      if (c && c.clave) {
        cuenta = soloLoQueHaceFalta(c);
        try {
          if (cuenta && cuenta.sesion) localStorage.setItem(LLAVE, JSON.stringify(cuenta));
          else { localStorage.removeItem(LLAVE); cuenta = null; }
        } catch (e) {}
        return cuenta;
      }
      /* sin llave de paso no hay sesion que mantener */
      if (c && c.usuario && c.sesion) cuenta = soloLoQueHaceFalta(c);
    } catch (e) {}
    return cuenta;
  }
  /* AQUI SE DICE POR QUE SE HA CERRADO LA CUENTA, Y NO SE DEJA ADIVINAR.
     (L-01..L-04 del auditor y el fallo 1 de E1 piden lo mismo; se juntan
     aqui con las palabras de E1/Z, que son las que lee cartera.js:)
        motivo "entrada"  -> acaba de entrar una oficina
        motivo "salida"   -> la persona pulso «Salir de esta cuenta»: lo
                             pendiente ya se ha subido y se limpia
        motivo "caducada" -> la llave de paso dejo de valer: lo del
                             ordenador NO se borra, se queda guardado
                             hasta que la MISMA oficina vuelva a entrar
     Antes cartera.js lo adivinaba mirando si alguien habia pulsado un
     boton con el id «ofi-salir»: si se salia desde el codigo o desde otro
     sitio, se tomaba por una caducidad y no se limpiaba nada. Quien lo
     sabe de verdad es este fichero, asi que lo dice.
     Si no se dice el motivo, se pone el que toca segun haya cuenta o no,
     para que ninguna llamada antigua se quede sin decirlo. */
  /* JUNTADO 18/09 · LA CADUCIDAD SE DEJA ESCRITA, NO SOLO AVISADA.
     El aviso por el nucleo solo lo oye quien ya este cargado, y aqui la
     llave se comprueba con setTimeout(0): en inmobiliaria.html eso cae
     ENTRE oficina.js y cartera.js, asi que la cartera no se enteraba, veia
     la llave ya borrada y daba la caducidad por «esto es de otra oficina»
     -borrandole a la directora la cartera entera al abrir la pagina-. Es
     el fallo L-57 del auditor.
     Se deja escrita la nota que la cartera ya usa para eso, para que el
     orden de carga deje de decidir nada. Es el apaño que el informe E1
     dejaba apuntado: «si algun dia se quiere hacer mas directo, ese es el
     sitio: oficina.js». La nota la borra la cartera al volver a entrar. */
  var NOTA_CADUCADA = "immoia.cartera.v1.caducada";
  function apuntarCuenta(c, motivo) {
    var antes = cuenta ? cuenta.usuario : null;
    if (motivo === "caducada" && antes) {
      try { localStorage.setItem(NOTA_CADUCADA, String(antes)); } catch (e) {}
    }
    cuenta = soloLoQueHaceFalta(c);
    try { if (cuenta) localStorage.setItem(LLAVE, JSON.stringify(cuenta)); else localStorage.removeItem(LLAVE); } catch (e) {}
    avisar(motivo || "", antes);
  }
  function avisar(motivo, antes) {
    try {
      if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("oficina:cambio", {
        hay: !!cuenta,
        usuario: cuenta ? cuenta.usuario : null,
        motivo: motivo || (cuenta ? "entrada" : "salida"),
        antes: antes || null
      });
    } catch (e) {}
  }

  /* ---------- hablar con el servidor ---------- */
  function pedir(cuerpo, luego) {
    var a = api();
    if (!a) { luego({ error: "Esta página no sabe a qué servidor llamar." }); return; }
    fetch(a + "/hablar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      return r.json().then(function (d) { d = d || {}; d.__estado = r.status; return d; })
        .catch(function () { return { error: "El servidor ha contestado algo raro.", __estado: r.status }; });
    }).then(function (d) { luego(d); })
      .catch(function () { luego({ error: "Sin conexión con el servidor." }); });
  }

  /* EL DIA A DIA VA CON LA LLAVE DE PASO, NUNCA CON LA CLAVE.
     Antes esto mandaba la clave de la oficina en CADA lectura y en cada
     guardado. Ahora va la llave, que es lo unico que se guarda. El
     servidor rechaza la peticion que trae las dos, y hace bien, porque
     no se sabria cual manda: por eso aqui va una sola. */
  function conCuenta(accion, extra, luego) {
    var c = leerCuenta();
    if (!c) { luego({ error: "Esta página no tiene ninguna oficina abierta." }); return; }
    if (!c.sesion) { luego({ error: "Hay que volver a entrar en la cuenta de la oficina.", entrada: "no" }); return; }
    var cuerpo = { codigo: codigoWeb(), oficina_accion: accion, usuario: c.usuario, sesion: c.sesion };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) cuerpo[k] = extra[k];
    pedir(cuerpo, function (d) {
      /* si la llave ya no vale, se dice y se pide entrar otra vez */
      if (d && d.__estado === 401 && d.entrada === "no") caduco();
      luego(d);
    });
  }

  /* Dar de alta pide la clave y la pide el servidor: no se guarda aqui.
     Nada mas crearla se entra, que es lo que devuelve la llave de paso. */
  function crear(usuario, clave, luego) {
    pedir({ codigo: codigoWeb(), oficina_accion: "crear", usuario: usuario, clave: clave }, function (d) {
      if (d && d.ok) { entrar(usuario, clave, function () { luego(d); }); return; }
      luego(d);
    });
  }
  /* ENTRAR ES EL UNICO SITIO DONDE SE USA LA CLAVE.
     "entrar" devuelve una llave de paso -d.sesion- que vale para
     trabajar sin volver a mandar la clave. Se guarda la llave; la clave
     se queda en la variable de esta llamada y desaparece con ella. No se
     escribe en el almacen del navegador, ni aqui ni en ningun otro sitio.
     Si el servidor no devuelve llave, no hay sesion que mantener: se
     dice, en vez de guardar la clave para apanarlo. */
  function entrar(usuario, clave, luego) {
    pedir({ codigo: codigoWeb(), oficina_accion: "entrar", usuario: usuario, clave: clave }, function (d) {
      if (d && d.ok && d.sesion) {
        apuntarCuenta({
          usuario: d.usuario || usuario, id: d.id || null,
          sesion: d.sesion, sesion_vence: d.sesion_vence || null
        }, "entrada");
      } else if (d && d.ok && !d.sesion) {
        /* no ha llegado a entrar: no es una caducidad, se deja limpio */
        apuntarCuenta(null, "salida");
        d = { error: "He entrado, pero este servidor no me ha dado con qué mantener la sesión abierta." };
      }
      luego(d);
    });
  }

  /* LA LLAVE HA CADUCADO. Lo dice inmo.js -y ahora tambien conCuenta()-
     cuando el servidor contesta 401 con entrada:"no".
     Antes aqui se volvia a entrar solo, por lo bajo, usando la clave
     guardada. Ya no hay clave guardada, asi que no se puede y TAMPOCO SE
     FINGE: se cierra la cuenta y se vuelve a pintar el cuadro de entrar,
     para que la persona sepa por que le pide la clave y no se quede
     guardando solo en su ordenador creyendo que sube. */
  function caduco() {
    if (!leerCuenta()) return;
    apuntarCuenta(null, "caducada");
    try { if (typeof repintar === "function") repintar(); } catch (e) {}
  }

  /* L-57: la fecha de caducidad de la llave SI se mira. Si ya paso, se dice
     al abrir la pagina (y cada minuto), en vez de seguir pintando «se guarda
     en tu cuenta» hasta el primer fallo. Lo del ordenador no se borra (L-01). */
  function mirarCaducidad() {
    var c = leerCuenta();
    if (c && c.sesion_vence && Date.parse(c.sesion_vence) <= Date.now()) caduco();
  }
  try { setTimeout(mirarCaducidad, 0); setInterval(mirarCaducidad, 60 * 1000); } catch (e) {}

  /* Al abrir la pagina no hay nada que pedir por lo bajo: o hay llave de
     paso y vale, o hace falta que la persona entre. Se queda por si algun
     dia el servidor sabe renovar una llave con otra llave (ver el informe:
     eso es lo que habria que anadirle a worker.js). */
  /* 18/09 · RENOVAR LA LLAVE CON LA LLAVE. El servidor nuevo cambia una
     llave que todavia vale por otra (paquete del servidor del 18/09): asi
     no se pide la clave cada 12 horas mientras se trabaja. Si el servidor
     todavia no sabe hacerlo, contesta que no y AQUI NO SE HACE NADA: la
     llave sigue valiendo hasta que caduque, como hasta ahora. */
  var renovando = false;
  function asegurarLlave() {
    var c = leerCuenta();
    if (!c || !c.sesion || !c.sesion_vence || renovando) return;
    var queda = Date.parse(c.sesion_vence) - Date.now();
    if (!(queda > 0 && queda < 6 * 3600 * 1000)) return;
    /* Una sola vez por llave: si el servidor dice que no (el de antes no
       sabe renovar), no se insiste, para no contar como intentos fallidos. */
    try { if (localStorage.getItem("immoia.renovar.probado") === c.sesion) return; localStorage.setItem("immoia.renovar.probado", c.sesion); } catch (e) { return; }
    renovando = true;
    pedir({ codigo: codigoWeb(), oficina_accion: "entrar", usuario: c.usuario, sesion: c.sesion }, function (d) {
      renovando = false;
      if (d && d.ok && d.sesion && cuenta && cuenta.usuario === c.usuario) {
        cuenta = soloLoQueHaceFalta({ usuario: c.usuario, id: d.id || c.id || null, sesion: d.sesion, sesion_vence: d.sesion_vence || null });
        try { localStorage.setItem(LLAVE, JSON.stringify(cuenta)); } catch (e) {}
      }
    });
  }
  try { setTimeout(asegurarLlave, 3000); setInterval(asegurarLlave, 20 * 60 * 1000); } catch (e) {}

  /* SALIR SIN PERDER NADA: primero se sube lo que falte (cartera y
     mesa), y solo cuando el servidor lo ha recibido se cierra y se
     limpia. Si no se puede subir, se cierra igual pero se avisa y lo
     del ordenador se queda guardado (escondido) para la proxima vez. */
  function salir(luego) {
    luego = typeof luego === "function" ? luego : function () {};
    var pendientes = 0, fallos = 0, hecho = false;
    var cuentaQueSale = leerCuenta();
    function fin() {
      if (hecho) return; hecho = true;
      /* L-55: salir tambien cierra la llave en el servidor, para que no siga
         valiendo 12 horas en un ordenador compartido. No se espera: si falla,
         la llave caduca sola igual. */
      try {
        var cs = cuentaQueSale;
        if (cs && cs.sesion && cs.usuario) {
          pedir({ codigo: codigoWeb(), oficina_accion: "cerrar_sesion", usuario: cs.usuario,
                  sesion: cs.sesion, cual: String(cs.sesion).split(".")[0] }, function () {});
        }
      } catch (e) {}
      /* JUNTADO 18/09: la palabra es "salida" (la que lee cartera.js desde
         E1/Z). Si NO se ha podido subir lo pendiente se dice "caducada" a
         proposito, que es lo del auditor (L-01): limpiar en ese momento
         seria borrar trabajo que el servidor todavia no tiene. Se le dice
         por pantalla, en el aviso de aqui abajo. */
      apuntarCuenta(null, fallos ? "caducada" : "salida");
      luego(fallos ? { aviso: "No he podido subir los últimos cambios. Se quedan guardados en este ordenador y se subirán cuando vuelvas a entrar." } : { ok: true });
    }
    function uno(fn) {
      pendientes++;
      try {
        fn(function (d) { if (!d || d.error) fallos++; if (--pendientes === 0) fin(); });
      } catch (e) { fallos++; if (--pendientes === 0) fin(); }
    }
    if (!leerCuenta()) { fin(); return; }
    if (window.IMMOIA_CARTERA && window.IMMOIA_CARTERA.subir) uno(function (cb) { window.IMMOIA_CARTERA.subir(function (d) { cb(d && d.error === "sin cuenta" ? {} : d); }); });
    if (window.IMMOIA_MESA && window.IMMOIA_MESA.subirYa) uno(function (cb) { window.IMMOIA_MESA.subirYa(cb); });
    if (!pendientes) { fin(); return; }
    setTimeout(function () { if (!hecho) { fallos++; fin(); } }, 8000);
  }

  function traer(luego) { conCuenta("leer", null, luego); }
  function guardar(datos, si_version, luego) {
    conCuenta("guardar", { datos: datos, si_version: si_version }, luego || function () {});
  }

  /* ---------- el cuadro de entrar ----------
     Sencillo a proposito: nombre, clave, y dos botones. Nada mas. */

  var CSS = ".ofi{border:1px solid var(--linea,#D8D1BE);border-radius:12px;background:var(--tarjeta,#fff);padding:14px 16px;margin:0 0 18px}"
    + ".ofi h2{font-size:15px;color:var(--marca,#13342A);margin:0 0 3px}"
    + ".ofi p{margin:0 0 11px;font-size:13.5px;color:var(--tinta-2,#635C4B)}"
    + ".ofi-campos{display:flex;gap:9px;flex-wrap:wrap;margin:0 0 10px}"
    + ".ofi-campos label{flex:1 1 190px;font-size:12.5px;color:var(--tinta-2,#635C4B)}"
    + ".ofi-campos input{display:block;width:100%;box-sizing:border-box;margin-top:3px;padding:8px 10px;font:inherit;font-size:15px;"
    + "border:1px solid var(--linea,#D8D1BE);border-radius:8px;background:#fff;color:inherit}"
    + ".ofi-pie{display:flex;gap:8px;align-items:center;flex-wrap:wrap}"
    + ".ofi-pie button{padding:9px 16px;font:inherit;font-weight:600;font-size:14.5px;border:0;border-radius:9px;cursor:pointer}"
    + ".ofi-1{background:var(--marca,#13342A);color:#fff}.ofi-2{background:#EEE9DE;color:#5B4646}"
    + ".ofi-aviso{font-size:13.5px;color:var(--tinta-2,#635C4B)}"
    + ".ofi-mal{color:#8A3B12}"
    + ".ofi-dentro{display:flex;align-items:center;gap:10px;flex-wrap:wrap}"
    + ".ofi-dentro b{color:var(--marca,#13342A);font-size:15px}"
    + ".ofi-dentro small{color:var(--tinta-2,#635C4B);font-size:12.5px}";

  var cssPuesto = false;
  function ponerCss() {
    if (cssPuesto) return; cssPuesto = true;
    var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }

  /* el cuadro que esta puesto ahora mismo, para poder volver a pintarlo
     cuando la llave de paso caduca y hay que pedir la clave otra vez */
  var repintar = null;

  function cuadro(sitio, alEntrar) {
    if (!sitio) return;
    ponerCss();
    var caja = document.createElement("div");
    caja.className = "ofi"; caja.id = "ofi";
    sitio.appendChild(caja);
    repintar = pintar;
    pintar();

    function pintar() {
      var c = leerCuenta();
      if (c) {
        caja.innerHTML = '<div class="ofi-dentro"><b>' + esc(c.usuario) + '</b>'
          + '<small>Tus expedientes se guardan en tu cuenta: los ves igual desde el móvil. '
          + 'Tu clave no se queda guardada en este navegador, así que de vez en cuando te la pedimos otra vez.</small>'
          + '<button type="button" class="ofi-2" id="ofi-salir">Salir de esta cuenta</button></div>';
        var b = document.getElementById("ofi-salir");
        if (b) b.addEventListener("click", function () {
          b.disabled = true; b.textContent = "Guardando antes de salir…";
          salir(function (r) {
            pintar();
            if (r && r.aviso) { var p = document.createElement("p"); p.className = "ofi-aviso"; p.setAttribute("role", "status"); p.textContent = r.aviso; caja.appendChild(p); }
          });
        });
        return;
      }
      caja.innerHTML =
        '<h2>La cuenta de tu oficina</h2>'
        + '<p>Con una cuenta, tus expedientes se guardan en tu oficina y solo los ve tu oficina. '
        + 'Entra con la misma en el móvil y verás lo mismo. Sin cuenta, todo se queda en este ordenador.</p>'
        + '<div class="ofi-campos">'
        + '<label>Nombre de la oficina<input type="text" id="ofi-u" autocomplete="username" placeholder="inmo-adeje" spellcheck="false"></label>'
        + '<label>Clave<input type="password" id="ofi-c" autocomplete="current-password" placeholder="al menos 12 letras"></label>'
        + '</div>'
        + '<div class="ofi-pie"><button type="button" class="ofi-1" id="ofi-entrar">Entrar</button>'
        + '<button type="button" class="ofi-2" id="ofi-nueva">No tengo cuenta</button>'
        + '<span class="ofi-aviso" id="ofi-aviso"></span></div>';

      var u = document.getElementById("ofi-u"), k = document.getElementById("ofi-c"), av = document.getElementById("ofi-aviso");
      function decir(t, mal) { av.textContent = t; av.className = "ofi-aviso" + (mal ? " ofi-mal" : ""); }
      function hecho(d) {
        if (d && d.ok) { decir(""); pintar(); if (alEntrar) alEntrar(leerCuenta()); return; }
        decir((d && d.error) || "No he podido.", true);
      }
      document.getElementById("ofi-entrar").addEventListener("click", function () {
        if (!u.value.trim() || !k.value) { decir("Pon el nombre y la clave.", true); return; }
        decir("Entrando…"); entrar(u.value.trim(), k.value, hecho);
      });
      /* EL BOTON QUE ANTES DABA ERROR, Y POR QUE YA NO EXISTE.
         Aqui habia un boton "Es la primera vez" que llamaba a crear().
         No podia funcionar NUNCA: el servidor exige un codigo de alta
         para dar de alta una oficina -y lo exige a proposito, para que
         nadie pueda ir probando nombres hasta averiguar quien es
         clienta vuestra-, y esta pagina no lo lleva ni lo puede
         llevar, porque cualquiera puede leer el codigo de una pagina.
         Asi que el boton contestaba siempre "Aqui no se pueden dar de
         alta oficinas". Eso es lo que habria salido en pantalla si
         alguien lo pulsa en una demostracion.
         Las cuentas las crea IMMO IA y se entregan hechas, como hace
         cualquier programa de gestion. crear() se queda en el API de
         abajo porque las herramientas internas si lo usan, con el
         codigo de alta en la mano. Lo que se va es el boton. */
      document.getElementById("ofi-nueva").addEventListener("click", function () {
        decir("Las cuentas las damos nosotros: escribenos a immoai.contacto@gmail.com y te la creamos en el momento.");
      });
      k.addEventListener("keydown", function (e) {
        if (e.key === "Enter") document.getElementById("ofi-entrar").click();
      });
    }
    return { pintar: pintar };
  }

  /* Se pone sola donde haga falta: si la pagina trae su sitio, ahi; y
     si no, justo encima de la mesa de la inmobiliaria. Asi no hay que
     tocar el cuerpo de ninguna pagina para que aparezca. */
  function montar() {
    if (document.getElementById("ofi")) return;
    var donde = document.getElementById("cuenta-oficina");
    if (!donde) {
      var ancla = document.getElementById("cartera") || document.getElementById("inmo-mesa");
      if (!ancla) return;
      donde = document.createElement("div");
      ancla.parentNode.insertBefore(donde, ancla);
    }
    cuadro(donde, function () {
      try { if (window.IMMOIA_CARTERA) window.IMMOIA_CARTERA.bajar(); } catch (e) {}
    });
  }

  leerCuenta();
  asegurarLlave();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();

  window.IMMOIA_OFICINA = {
    version: "1.1",
    hay: function () { return !!leerCuenta(); },
    usuario: function () { var c = leerCuenta(); return c ? c.usuario : null; },
    /* la llave de paso, para que el chat pueda decir de quien es la
       conversacion sin mandar la clave en cada mensaje */
    sesion: function () { var c = leerCuenta(); return (c && c.sesion) || null; },
    caduco: caduco,
    crear: crear, entrar: entrar, salir: salir,
    traer: traer, guardar: guardar,
    cuadro: cuadro, montar: montar
  };
  try { if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("oficina:montada", { hay: !!cuenta }); } catch (e) {}
})();
