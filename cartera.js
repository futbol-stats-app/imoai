/* ==================================================================
   IMMO IA · cartera.js — VARIOS EXPEDIENTES A LA VEZ
   ------------------------------------------------------------------
   El problema: la bandeja lleva UN expediente, guardado en
   "immoia.autonomia.v1". Una inmobiliaria lleva veinte. Esa es la
   diferencia entre una demostracion y una herramienta de trabajo.

   Como se resuelve SIN tocar el motor ni la bandeja: la cartera
   guarda N expedientes y, antes de que la bandeja arranque, deja el
   ACTIVO exactamente donde la bandeja lo busca. La bandeja no se
   entera de nada y sigue funcionando igual. Al cambiar de expediente
   se guarda el que estaba y se pone el otro en su sitio.

   Y si hay cuenta de oficina (oficina.js), la cartera entera sube y
   baja del servidor: se trabaja en el PC y se sigue en el movil.
   Cuando los dos han tocado cosas, se juntan por expediente — gana
   el que se toco mas tarde, expediente por expediente, no de golpe.
   ================================================================== */
(function () {
  "use strict";
  if (window.IMMOIA_CARTERA) return;

  var LLAVE_BANDEJA = "immoia.autonomia.v1";   /* donde mira la bandeja: NO se cambia */
  var LLAVE_CARTERA = "immoia.cartera.v1";
  /* DE QUIEN ES LO QUE HAY GUARDADO EN ESTE NAVEGADOR.
     Sin esto, la cartera de una oficina se quedaba en el ordenador al
     salir, y la siguiente que entrara la veia entera. Con una sola
     inmobiliaria no se nota; con dos, son los expedientes de una
     clienta a la vista de otra. Y era peor que mirar: al entrar la
     segunda, la cartera se subia al servidor DE LA SEGUNDA, asi que
     los expedientes de la primera acababan dentro de la cuenta ajena.
     La marca la lleva inmo.js desde el 13/09 para la mesa; esto es lo
     mismo para la cartera. */
  var DUENO_CARTERA = LLAVE_CARTERA + ".de";
  var ESPERA_SUBIDA = 4000;                    /* no se llama al servidor en cada tecla */
  var LATIDO = 1200;

  /* ---------- utiles ---------- */
  function hoyCorto() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function ahora() { return new Date().toISOString(); }
  function esc(s) { var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }
  function id() { return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* la forma exacta que espera la bandeja, para un expediente en blanco */
  function guardadoEnBlanco(nombre) {
    return { llaves: [], expediente: { nombre: nombre || "el expediente", hechos: [], avisados: [],
             en_marcha: [], rechazados: [], senales: [], datos: [], diario: [], avisos_hoy: 0,
             aviso_abierto: null, abiertos: [], dia: hoyCorto() },
             ficha: {}, gestiones: [] };
  }
  function sano(g) { return !!(g && g.expediente && typeof g.expediente === "object"); }

  /* El nombre lo pone ella, y no se lo cambia nadie: si le llama «el de
     Adeje» se queda «el de Adeje» aunque luego entre la direccion. Solo
     se rellena solo cuando todavia no tiene nombre de verdad. */
  var SIN_NOMBRE = { "el expediente": 1, "expediente nuevo": 1, "": 1 };
  function nombreDe(g, ahora) {
    if (ahora && !SIN_NOMBRE[ahora]) return String(ahora).slice(0, 60);
    var n = g && g.expediente && g.expediente.nombre;
    if (n && !SIN_NOMBRE[n]) return String(n).slice(0, 60);
    if (g && g.ficha && g.ficha.direccion) return String(g.ficha.direccion).slice(0, 60);
    return ahora || "el expediente";
  }

  /* ---------- lo que hay guardado ---------- */
  var C = null;

  function enBlancoCartera() { return { v: 0, activo: null, orden: [], exp: {}, tocada: ahora() }; }

  /* ---------- DE QUIEN ES ESTO ----------
     Quien esta dentro ahora mismo. Cadena vacia = nadie: se trabaja
     en este ordenador y punto, que es lo normal en una demostracion. */
  function cuentaDeAhora() {
    try {
      var o = window.IMMOIA_OFICINA;
      if (!o || !o.hay()) return "";
      return String(o.usuario() || "");
    } catch (e) { return ""; }
  }
  function marcaGuardada() {
    try { return String(localStorage.getItem(DUENO_CARTERA) || ""); } catch (e) { return ""; }
  }
  function marcar() {
    try { localStorage.setItem(DUENO_CARTERA, cuentaDeAhora()); } catch (e) {}
  }

  /* LAS TRES SITUACIONES, Y POR QUE NO SE TRATAN IGUAL.
       misma cuenta          -> es suyo, se abre
       sin marca y hay cuenta -> lo hizo ESTA persona en este ordenador
                                 antes de entrar. Se ADOPTA, no se tira:
                                 tirarlo seria borrarle su propio trabajo
                                 la primera vez que entra con cuenta.
       cualquier otra cosa   -> es de OTRA oficina. No se abre y se borra.
     El caso peligroso es el tercero, e incluye salir de una cuenta y
     quedarse sin ninguna: lo que queda en el ordenador sigue siendo de
     la que se fue. */
  function deQuienEs() {
    var marca = marcaGuardada(), ahoraQuien = cuentaDeAhora();
    if (marca === ahoraQuien) return "mia";
    if (marca === "" && ahoraQuien !== "") return "adoptable";
    return "de_otra";
  }

  /* No queda ni rastro: ni la cartera, ni la marca, ni el expediente
     que la bandeja tiene abierto en pantalla. */
  function borrarLoDeOtra() {
    try { localStorage.removeItem(LLAVE_CARTERA); } catch (e) {}
    try { localStorage.removeItem(LLAVE_BANDEJA); } catch (e) {}
    try { localStorage.removeItem(DUENO_CARTERA); } catch (e) {}
    ultimoVisto = null;
  }

  function leerCartera() {
    /* Se mira de quien es ANTES de leer nada. */
    var quien = deQuienEs();
    if (quien === "de_otra") { borrarLoDeOtra(); return null; }
    try {
      var c = JSON.parse(localStorage.getItem(LLAVE_CARTERA) || "null");
      if (c && c.exp && typeof c.exp === "object") {
        if (!c.orden) c.orden = Object.keys(c.exp);
        if (quien === "adoptable") marcar();
        return c;
      }
    } catch (e) {}
    return null;
  }
  function guardarCartera() {
    C.tocada = ahora();
    try { localStorage.setItem(LLAVE_CARTERA, JSON.stringify(C)); } catch (e) {}
    marcar();
  }

  /* Lo que hubiera de antes NO se pierde: el expediente que la
     directora tuviera abierto pasa a ser el primero de la cartera. */
  function arrancar() {
    C = leerCartera();
    if (!C) {
      C = enBlancoCartera();
      var viejo = null;
      /* Solo se hereda el expediente suelto si NO es de otra oficina.
         Si lo era, leerCartera ya lo ha borrado y aqui no hay nada. */
      try { viejo = JSON.parse(localStorage.getItem(LLAVE_BANDEJA) || "null"); } catch (e) {}
      if (sano(viejo)) {
        var i1 = id();
        var n1 = nombreDe(viejo, "");
        if (n1 === "el expediente") n1 = "el primero";
        C.exp[i1] = { id: i1, nombre: n1, creado: ahora(), tocado: ahora(), guardado: viejo };
        C.orden = [i1]; C.activo = i1;
      }
      guardarCartera();
    }
    if (!C.activo || !C.exp[C.activo]) C.activo = C.orden[0] || null;
    if (C.activo) ponerEnLaBandeja(C.exp[C.activo].guardado);
  }

  function ponerEnLaBandeja(g) {
    try { localStorage.setItem(LLAVE_BANDEJA, JSON.stringify(g)); } catch (e) {}
    ultimoVisto = null;
  }

  /* ---------- el puente con la bandeja ----------
     La bandeja escribe en su llave de siempre cada vez que calcula.
     Aqui se recoge y se mete en el expediente activo. */
  var ultimoVisto = null;

  function recoger() {
    if (!C.activo) return false;
    var crudo = null;
    try { crudo = localStorage.getItem(LLAVE_BANDEJA); } catch (e) { return false; }
    if (!crudo || crudo === ultimoVisto) return false;
    ultimoVisto = crudo;
    var g = null; try { g = JSON.parse(crudo); } catch (e) { return false; }
    if (!sano(g)) return false;
    var e = C.exp[C.activo];
    if (!e) return false;
    if (JSON.stringify(e.guardado) === crudo) return false;
    e.guardado = g;
    e.nombre = nombreDe(g, e.nombre);
    e.tocado = ahora();
    guardarCartera();
    pintar();
    pedirSubida();
    return true;
  }

  /* ---------- las acciones ---------- */
  function lista() {
    return C.orden.filter(function (k) { return !!C.exp[k]; }).map(function (k) {
      var e = C.exp[k];
      return { id: e.id, nombre: e.nombre, creado: e.creado, tocado: e.tocado, activo: k === C.activo };
    });
  }

  function nuevo(nombre, noAbrir) {
    recoger();
    var i1 = id();
    C.exp[i1] = { id: i1, nombre: (nombre || "").trim() || "expediente nuevo", creado: ahora(), tocado: ahora(),
                  guardado: guardadoEnBlanco((nombre || "").trim() || "el expediente") };
    C.orden.push(i1);
    guardarCartera();
    pedirSubida();
    if (!noAbrir) abrir(i1); else pintar();
    return i1;
  }

  function abrir(cual) {
    if (!C.exp[cual]) return false;
    recoger();
    C.activo = cual;
    guardarCartera();
    ponerEnLaBandeja(C.exp[cual].guardado);
    pedirSubida();
    /* La bandeja lee su llave UNA vez, al arrancar la pagina. Para que
       coja el expediente nuevo hay que volver a entrar en la pagina:
       es instantaneo y es mas honesto que dejarla pintando lo de antes. */
    if (document.getElementById("ban")) { location.reload(); return true; }
    pintar();
    return true;
  }

  function renombrar(cual, nombre) {
    if (!C.exp[cual]) return false;
    nombre = String(nombre || "").trim().slice(0, 60);
    if (!nombre) return false;
    C.exp[cual].nombre = nombre;
    C.exp[cual].guardado.expediente.nombre = nombre;
    C.exp[cual].tocado = ahora();
    if (cual === C.activo) ponerEnLaBandeja(C.exp[cual].guardado);
    guardarCartera(); pintar(); pedirSubida();
    return true;
  }

  function cerrar(cual) {
    if (!C.exp[cual]) return false;
    C.exp[cual].cerrado = ahora();
    C.exp[cual].tocado = ahora();
    if (cual === C.activo) {
      var otro = C.orden.filter(function (k) { return k !== cual && C.exp[k] && !C.exp[k].cerrado; })[0] || null;
      if (otro) { abrir(otro); return true; }
      C.activo = null;
    }
    guardarCartera(); pintar(); pedirSubida();
    return true;
  }
  function reabrir(cual) {
    if (!C.exp[cual]) return false;
    delete C.exp[cual].cerrado;
    C.exp[cual].tocado = ahora();
    guardarCartera(); pintar(); pedirSubida();
    return true;
  }

  /* ---------- el servidor: PC y movil ---------- */
  var relojSubida = null, subiendo = false, aviso = function () {};

  function hayCuenta() { try { return !!(window.IMMOIA_OFICINA && window.IMMOIA_OFICINA.hay()); } catch (e) { return false; } }

  function pedirSubida() {
    if (!hayCuenta()) return;
    if (relojSubida) clearTimeout(relojSubida);
    relojSubida = setTimeout(subir, ESPERA_SUBIDA);
  }

  function paraElServidor() {
    return { activo: C.activo, orden: C.orden, exp: C.exp, tocada: C.tocada };
  }

  function subir(luego) {
    luego = luego || function () {};
    if (!hayCuenta()) { luego({ error: "sin cuenta" }); return; }
    if (subiendo) { pedirSubida(); luego({ esperando: true }); return; }
    subiendo = true;
    aviso("Guardando en tu oficina…");
    window.IMMOIA_OFICINA.guardar(paraElServidor(), C.v, function (d) {
      subiendo = false;
      if (d && d.ok) {
        C.v = d.v; guardarCartera();
        aviso("Guardado. Lo ves igual desde el móvil.");
        luego(d); return;
      }
      if (d && d.conflicto) {
        /* alguien guardo desde otro sitio: se juntan y se vuelve a subir */
        juntar(d.datos);
        C.v = d.v; guardarCartera(); pintar();
        aviso("Había cambios desde otro sitio: los he juntado.");
        subir(luego); return;
      }
      aviso("Guardado solo en este ordenador (" + ((d && d.error) || "sin conexion") + ").");
      luego(d);
    });
  }

  /* Juntar dos carteras: expediente por expediente, gana el que se
     toco mas tarde. Asi el PC y el movil pueden haber trabajado en
     expedientes distintos y no se pierde ninguno de los dos. */
  function juntar(otra) {
    if (!otra || !otra.exp) return 0;
    var cambios = 0;
    Object.keys(otra.exp).forEach(function (k) {
      var alla = otra.exp[k], aqui = C.exp[k];
      if (!alla || !sano(alla.guardado)) return;
      if (!aqui) { C.exp[k] = alla; if (C.orden.indexOf(k) === -1) C.orden.push(k); cambios++; return; }
      if (String(alla.tocado || "") > String(aqui.tocado || "")) { C.exp[k] = alla; cambios++; }
    });
    (otra.orden || []).forEach(function (k) { if (C.exp[k] && C.orden.indexOf(k) === -1) C.orden.push(k); });
    if (!C.activo || !C.exp[C.activo]) C.activo = otra.activo && C.exp[otra.activo] ? otra.activo : (C.orden[0] || null);
    if (C.activo && C.exp[C.activo]) ponerEnLaBandeja(C.exp[C.activo].guardado);
    guardarCartera();
    return cambios;
  }

  function bajar(luego) {
    luego = luego || function () {};
    if (!hayCuenta()) { luego({ error: "sin cuenta" }); return; }
    aviso("Buscando lo de tu oficina…");
    window.IMMOIA_OFICINA.traer(function (d) {
      if (!d || d.error) { aviso("No he podido traerlo (" + ((d && d.error) || "sin conexion") + ")."); luego(d); return; }
      if (!d.hay || !d.datos) { aviso(""); C.v = d.v || 0; guardarCartera(); subir(); luego(d); return; }
      var cambios = juntar(d.datos);
      C.v = d.v || 0;
      guardarCartera(); pintar();
      try { if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("cartera:al-dia", { cambios: cambios }); } catch (e) {}
      aviso(cambios ? "Al día: " + cambios + " expediente(s) traídos de tu oficina." : "Al día.");
      /* si aqui habia algo que alla no, se sube */
      var faltaAlla = Object.keys(C.exp).some(function (k) { return !d.datos.exp || !d.datos.exp[k]; });
      if (faltaAlla) pedirSubida();
      if (cambios && document.getElementById("ban")) location.reload();
      luego(d);
    });
  }

  /* ---------- la barra de expedientes ---------- */
  var CSS = ".car{border:1px solid var(--linea,#D8D1BE);border-radius:12px;background:var(--tarjeta,#fff);padding:13px 15px;margin:0 0 18px}"
    + ".car h2{font-size:15px;color:var(--marca,#13342A);margin:0 0 2px}"
    + ".car>p{margin:0 0 10px;font-size:13px;color:var(--tinta-2,#635C4B)}"
    + ".car-lista{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 10px}"
    + ".car-e{display:flex;align-items:center;gap:6px;border:1px solid var(--linea,#D8D1BE);border-radius:999px;"
    + "padding:5px 6px 5px 12px;background:#FAF8F2;max-width:100%}"
    + ".car-e button.car-ir{border:0;background:none;font:inherit;font-size:14px;color:var(--tinta,#1B231F);cursor:pointer;padding:0;"
    + "max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".car-e.car-aqui{background:var(--marca,#13342A);border-color:var(--marca,#13342A)}"
    + ".car-e.car-aqui button.car-ir{color:#fff;font-weight:600;cursor:default}"
    + ".car-e small{font-size:11.5px;color:var(--tinta-2,#635C4B)}"
    + ".car-e.car-aqui small{color:#CFE0D6}"
    + ".car-e.car-cerrado{opacity:.55}"
    + ".car-x{border:0;background:none;color:inherit;opacity:.6;cursor:pointer;font:inherit;font-size:15px;line-height:1;padding:2px 6px}"
    + ".car-x:hover{opacity:1}"
    + ".car-pie{display:flex;gap:8px;align-items:center;flex-wrap:wrap}"
    + ".car-pie input{flex:1 1 200px;min-width:0;padding:8px 10px;font:inherit;font-size:14.5px;border:1px solid var(--linea,#D8D1BE);border-radius:8px;background:#fff;color:inherit}"
    + ".car-pie button{padding:8px 14px;font:inherit;font-weight:600;font-size:14px;border:0;border-radius:8px;cursor:pointer;background:var(--marca,#13342A);color:#fff}"
    + ".car-pie .car-2{background:#EEE9DE;color:#5B4646}"
    + ".car-aviso{font-size:13px;color:var(--tinta-2,#635C4B);margin-left:2px}"
    + ".car-link{float:right;font-size:13.5px;font-weight:400;color:var(--marca,#13342A)}"
    + "@media (max-width:520px){.car-e button.car-ir{max-width:160px}}";

  var sitio = null, cssPuesto = false;

  function pintar() {
    if (!sitio) return;
    if (!cssPuesto) { cssPuesto = true; var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }
    var ls = lista();
    var abiertos = ls.filter(function (e) { return !C.exp[e.id].cerrado; });
    var cerrados = ls.filter(function (e) { return !!C.exp[e.id].cerrado; });

    var enManana = /manana\.html/i.test(location.pathname || "");
    var h = '<h2>Tus expedientes'
      + (enManana ? '' : ' <a class="car-link" href="manana.html">ver tu mañana →</a>') + '</h2>'
      + '<p>' + (abiertos.length ? (abiertos.length === 1 ? '1 abierto' : abiertos.length + ' abiertos')
                                 + '. Pulsa uno para trabajar en él; lo que hagas en cada uno se queda ahí.'
                                 : 'Todavía no tienes ninguno. Ponle un nombre corto, como «el de Adeje».') + '</p>'
      + '<div class="car-lista">';
    abiertos.concat(cerrados).forEach(function (e) {
      var ce = !!C.exp[e.id].cerrado;
      h += '<span class="car-e' + (e.activo ? ' car-aqui' : '') + (ce ? ' car-cerrado' : '') + '">'
        + '<button type="button" class="car-ir" data-ir="' + esc(e.id) + '" title="' + esc(e.nombre) + '">' + esc(e.nombre) + '</button>'
        + (ce ? '<small>cerrado</small>' : '')
        + '<button type="button" class="car-x" data-' + (ce ? 'reabrir' : 'cerrar') + '="' + esc(e.id) + '" title="'
        + (ce ? 'volver a abrirlo' : 'darlo por cerrado') + '">' + (ce ? '↺' : '×') + '</button>'
        + '</span>';
    });
    h += '</div><div class="car-pie">'
      + '<input type="text" id="car-nombre" placeholder="el de Adeje" maxlength="60">'
      + '<button type="button" id="car-nuevo">Abrir expediente</button>'
      + (hayCuenta() ? '<button type="button" class="car-2" id="car-sinc">Traer lo de mi oficina</button>' : '')
      + '<span class="car-aviso" id="car-aviso"></span></div>';
    sitio.innerHTML = h;

    sitio.querySelectorAll("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () { abrir(b.getAttribute("data-ir")); });
    });
    sitio.querySelectorAll("[data-cerrar]").forEach(function (b) {
      b.addEventListener("click", function () { cerrar(b.getAttribute("data-cerrar")); });
    });
    sitio.querySelectorAll("[data-reabrir]").forEach(function (b) {
      b.addEventListener("click", function () { reabrir(b.getAttribute("data-reabrir")); });
    });
    var campo = sitio.querySelector("#car-nombre");
    var bn = sitio.querySelector("#car-nuevo");
    if (bn) bn.addEventListener("click", function () { nuevo(campo.value); });
    if (campo) campo.addEventListener("keydown", function (e) { if (e.key === "Enter") nuevo(campo.value); });
    var bs = sitio.querySelector("#car-sinc");
    if (bs) bs.addEventListener("click", function () { bajar(); });
  }

  aviso = function (t) {
    if (!sitio) return;
    var a = sitio.querySelector("#car-aviso");
    if (!a) return;
    a.textContent = t;
    if (t) setTimeout(function () { if (a.textContent === t) a.textContent = ""; }, 4000);
  };

  function montar() {
    sitio = document.getElementById("cartera");
    if (!sitio) {
      var ancla = document.getElementById("inmo-mesa");
      if (!ancla) return;
      sitio = document.createElement("div");
      sitio.id = "cartera"; sitio.className = "car";
      ancla.parentNode.insertBefore(sitio, ancla);
    } else { sitio.className = "car"; }
    pintar();
    if (hayCuenta()) bajar();
  }

  /* ---------- arranque ---------- */
  arrancar();

  /* La bandeja avisa por el nucleo cada vez que recalcula, y para
     entonces ya ha guardado: recogerlo ahi es inmediato. El latido de
     abajo se queda como red, por si alguna vez no llega el aviso. */
  try {
    if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.cuando("bandeja:calculada", function () { recoger(); });
  } catch (e) {}

  /* CUANDO SE ENTRA O SE SALE DE UNA CUENTA.
     oficina.js avisa por el nucleo en las dos direcciones. Sin esto,
     la limpieza solo ocurriria al recargar la pagina, y salir y entrar
     con otra cuenta sin recargar deja los expedientes a la vista. */
  try {
    if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.cuando("oficina:cambio", function () {
      var quien = deQuienEs();
      if (quien === "de_otra") {
        borrarLoDeOtra();
        C = enBlancoCartera();
        guardarCartera();
        pintar();
        /* La bandeja tiene su propia copia en memoria: borrar la llave
           no le quita de la pantalla el expediente de la otra oficina.
           empezarDeCero() ya existe en su API publica (bandeja.js:380):
           la deja en blanco y repinta. Asi no hay que tocar bandeja.js. */
        try {
          if (window.IMMOIA_BANDEJA && window.IMMOIA_BANDEJA.empezarDeCero) window.IMMOIA_BANDEJA.empezarDeCero();
        } catch (e) {}
        if (hayCuenta()) bajar();
        return;
      }
      if (quien === "adoptable") marcar();
      if (hayCuenta()) bajar();
    });
  } catch (e) {}
  setInterval(recoger, LATIDO);
  window.addEventListener("pagehide", function () { recoger(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { recoger(); if (relojSubida) { clearTimeout(relojSubida); subir(); } }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();

  window.IMMOIA_CARTERA = {
    version: "1.1",
    lista: lista,
    activo: function () { return C.activo; },
    expediente: function (cual) { return C.exp[cual || C.activo] || null; },
    guardado: function (cual) { var e = C.exp[cual || C.activo]; return e ? e.guardado : null; },
    nuevo: nuevo, abrir: abrir, renombrar: renombrar, cerrar: cerrar, reabrir: reabrir,
    recoger: recoger, subir: subir, bajar: bajar, juntar: juntar,
    version_servidor: function () { return C.v; },
    todo: function () { return C; },
    montar: montar
  };
  try { if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("cartera:montada", { cuantos: C.orden.length }); } catch (e) {}
})();
