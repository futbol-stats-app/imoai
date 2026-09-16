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

  var LLAVE = "immoia.oficina.cuenta.v1";
  var cuenta = null;          /* { usuario, clave } */

  function api() {
    try {
      var c = window.CONFIG;
      return c && c.api ? String(c.api).replace(/\/$/, "") : "";
    } catch (e) { return ""; }
  }
  function codigoWeb() {
    try { return (window.CONFIG && window.CONFIG.codigo) || "leire2026"; } catch (e) { return "leire2026"; }
  }

  function leerCuenta() {
    if (cuenta) return cuenta;
    try {
      var c = JSON.parse(localStorage.getItem(LLAVE) || "null");
      if (c && c.usuario && c.clave) cuenta = c;
    } catch (e) {}
    return cuenta;
  }
  function apuntarCuenta(c) {
    cuenta = c;
    try { if (c) localStorage.setItem(LLAVE, JSON.stringify(c)); else localStorage.removeItem(LLAVE); } catch (e) {}
    avisar();
  }
  function avisar() {
    try {
      if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("oficina:cambio", { hay: !!cuenta, usuario: cuenta ? cuenta.usuario : null });
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

  function conCuenta(accion, extra, luego) {
    var c = leerCuenta();
    if (!c) { luego({ error: "Esta página no tiene ninguna oficina abierta." }); return; }
    var cuerpo = { codigo: codigoWeb(), oficina_accion: accion, usuario: c.usuario, clave: c.clave };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) cuerpo[k] = extra[k];
    pedir(cuerpo, luego);
  }

  function crear(usuario, clave, luego) {
    pedir({ codigo: codigoWeb(), oficina_accion: "crear", usuario: usuario, clave: clave }, function (d) {
      if (d && d.ok) apuntarCuenta({ usuario: d.usuario || usuario, clave: clave });
      luego(d);
    });
  }
  function entrar(usuario, clave, luego) {
    pedir({ codigo: codigoWeb(), oficina_accion: "entrar", usuario: usuario, clave: clave }, function (d) {
      if (d && d.ok) apuntarCuenta({ usuario: d.usuario || usuario, clave: clave });
      luego(d);
    });
  }
  function salir() { apuntarCuenta(null); }

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

  function cuadro(sitio, alEntrar) {
    if (!sitio) return;
    ponerCss();
    var caja = document.createElement("div");
    caja.className = "ofi"; caja.id = "ofi";
    sitio.appendChild(caja);
    pintar();

    function pintar() {
      var c = leerCuenta();
      if (c) {
        caja.innerHTML = '<div class="ofi-dentro"><b>' + esc(c.usuario) + '</b>'
          + '<small>Tus expedientes se guardan en tu cuenta: los ves igual desde el movil.</small>'
          + '<button type="button" class="ofi-2" id="ofi-salir">Salir de esta cuenta</button></div>';
        var b = document.getElementById("ofi-salir");
        if (b) b.addEventListener("click", function () {
          salir(); pintar();
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();

  window.IMMOIA_OFICINA = {
    version: "1.0",
    hay: function () { return !!leerCuenta(); },
    usuario: function () { var c = leerCuenta(); return c ? c.usuario : null; },
    crear: crear, entrar: entrar, salir: salir,
    traer: traer, guardar: guardar,
    cuadro: cuadro, montar: montar
  };
  try { if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("oficina:montada", { hay: !!cuenta }); } catch (e) {}
})();
