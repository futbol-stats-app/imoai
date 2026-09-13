/* IMMO IA · LA BANDEJA — donde la autonomia se ve y se usa.
   ------------------------------------------------------------------
   Usa el motor (motor.js) sin cambiarlo. Ensena tres cosas y nada mas:

     1. Lo que ha hecho ella sola.
     2. Lo que necesita tu visto bueno: una linea y un boton.
     3. Lo que solo puedes hacer tu, y por que.

   Y debajo, los permisos: cada uno dice cuantas tareas desbloquea
   HOY. Al autorizar uno, todo se recalcula solo — que es la regla
   del motor, aqui hecha visible.

   Lo que se autoriza se guarda en este navegador
   (immoia.autonomia.v1). Cuando la memoria del servidor este
   desplegada, se guardara ahi y la seguira de un ordenador a otro;
   el resto no cambia.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  if (window.IMMOIA_BANDEJA) return;

  var LLAVE_GUARDADO = "immoia.autonomia.v1";
  var M = null;

  var CSS = ".ban{border:1px solid var(--linea,#D8D1BE);border-radius:12px;background:var(--tarjeta,#fff);padding:16px 17px;margin:0 0 22px}"
  + ".ban h2{font-size:16px;color:var(--marca,#13342A);margin:0 0 3px}"
  + ".ban .sub{margin:0 0 13px;font-size:13.5px;color:var(--tinta-2,#635C4B)}"
  + ".ban-barra{display:flex;gap:7px;margin:0 0 14px;font-size:13px;flex-wrap:wrap}"
  + ".ban-barra span{padding:3px 9px;border-radius:999px;border:1px solid var(--linea,#D8D1BE)}"
  + ".ban-v{background:#EDF1EE;color:#1B4332}.ban-a{background:#FBEDE4;color:#7A3B12}.ban-r{background:#F3EFEF;color:#5B4646}"
  + ".ban-bloque{margin:0 0 14px}"
  + ".ban-bloque h3{font-size:14px;margin:0 0 6px;color:var(--marca,#13342A)}"
  + ".ban-bloque ul{margin:0;padding-left:18px;font-size:14px;color:var(--tinta-2,#635C4B)}"
  + ".ban-bloque li{margin:2px 0}"
  + ".ban-pide{background:#FBEDE4;border:1px solid #E3BFA0;border-radius:10px;padding:11px 13px;margin:0 0 14px}"
  + ".ban-pide p{margin:0 0 9px;font-size:14.5px;color:#7A3B12}"
  + ".ban-pide button{padding:8px 15px;font:inherit;font-weight:600;font-size:14px;border:0;border-radius:8px;cursor:pointer;margin-right:7px}"
  + ".ban-si{background:var(--marca,#13342A);color:#fff}.ban-no{background:#EEE9DE;color:#5B4646}"
  + ".ban-llaves{border-top:1px solid var(--linea,#D8D1BE);padding-top:13px}"
  + ".ban-l{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #F0ECE1}"
  + ".ban-l:last-child{border-bottom:0}"
  + ".ban-l div{flex:1}.ban-l b{display:block;font-size:14.5px;color:var(--marca,#13342A);font-weight:600}"
  + ".ban-l small{display:block;font-size:12.5px;color:var(--tinta-2,#635C4B);margin-top:1px}"
  + ".ban-l button{flex:0 0 auto;padding:7px 13px;font:inherit;font-size:13.5px;font-weight:600;border:0;border-radius:8px;background:var(--marca,#13342A);color:#fff;cursor:pointer}"
  + ".ban-l button[disabled]{background:#EEE9DE;color:#8C8373;cursor:default}"
  + ".ban-ya{flex:0 0 auto;font-size:13px;color:#1B4332;font-weight:600;padding:7px 0}";

  /* ---------- lo que se guarda ---------- */
  function enBlanco() {
    return { llaves: [], expediente: { nombre: "el expediente", hechos: [], avisados: [],
             rechazados: [], senales: [], datos: [], diario: [], avisos_hoy: 0 } };
  }
  function leer() {
    try { var g = JSON.parse(localStorage.getItem(LLAVE_GUARDADO)); if (g && g.expediente) return g; }
    catch (e) {}
    return enBlanco();
  }
  function guardar(g) { try { localStorage.setItem(LLAVE_GUARDADO, JSON.stringify(g)); } catch (e) {} }

  var G = enBlanco();

  function aExpediente() {
    var e = new M.Expediente(G.expediente.nombre);
    e.hechos = new Set(G.expediente.hechos);
    e.avisados = new Set(G.expediente.avisados);
    e.rechazados = new Set(G.expediente.rechazados);
    e.senales = new Set(G.expediente.senales);
    e.datos = new Set(G.expediente.datos);
    e.diario = G.expediente.diario.slice();
    e.avisos_hoy = G.expediente.avisos_hoy || 0;
    return e;
  }
  function deExpediente(e) {
    G.expediente = { nombre: e.nombre, hechos: Array.from(e.hechos), avisados: Array.from(e.avisados),
      rechazados: Array.from(e.rechazados), senales: Array.from(e.senales), datos: Array.from(e.datos),
      diario: e.diario.slice(), avisos_hoy: e.avisos_hoy };
  }
  /* ---------- el calculo ---------- */
  var ultimo = null;

  function calcular() {
    var tengo = new Set(G.llaves);
    var datos = new Set(G.expediente.datos);
    var exp = aExpediente();
    var r = M.adelantarse(exp, tengo);
    deExpediente(exp);
    guardar(G);

    var res = M.resumen(tengo, datos);
    var total = res.VERDE + res.AMBAR + res.ROJO;
    var rojas = [];
    M.TAREAS.forEach(function (t) {
      var e = M.estado(t, tengo, datos);
      if (e[0] === "ROJO") rojas.push({ tarea: t[0], porque: e[1].tipo === "imposible"
        ? "la ley exige que lo haga una persona" : "hace falta un poder notarial expreso" });
    });

    ultimo = {
      resumen: res,
      autonomia: total ? Math.round(res.VERDE * 100 / total) : 0,
      hecho_ahora: r.hecho, aviso: r.aviso, callado: r.callado,
      diario: G.expediente.diario.slice(),
      rojas: rojas,
      siguiente: M.siguiente_paso(tengo, datos),
      llaves: Object.keys(M.LLAVES).map(function (k) {
        return { llave: k, que: M.LLAVES[k].que, como: M.LLAVES[k].como,
                 tengo: tengo.has(k), desbloquea: M.cuanto_desbloquea(k, tengo, datos),
                 bloqueada_por: M.bloqueado_por(k, tengo) };
      })
    };
    if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("bandeja:calculada", ultimo);
    return ultimo;
  }

  /* ---------- acciones ---------- */
  function autorizar(llave) {
    if (G.llaves.indexOf(llave) === -1) G.llaves.push(llave);
    /* al aparecer un permiso, lo que estaba esperando por el vuelve a
       poder preguntarse: se limpian los avisos ya dados */
    G.expediente.avisados = [];
    G.expediente.avisos_hoy = 0;
    guardar(G);
    calcular(); pintar();
  }
  function retirar(llave) {
    G.llaves = G.llaves.filter(function (k) { return k !== llave; });
    guardar(G); calcular(); pintar();
  }
  function decirQueSi() {
    /* lo aprobado pasa a estar en marcha: no se vuelve a preguntar */
    G.expediente.avisos_hoy = 0;
    guardar(G); calcular(); pintar();
  }
  function decirQueNo() {
    G.expediente.rechazados = G.expediente.rechazados.concat(
      G.expediente.avisados.filter(function (p) { return G.expediente.rechazados.indexOf(p) === -1; }));
    G.expediente.avisos_hoy = 0;
    guardar(G); calcular(); pintar();
  }
  function ponerDatos(lista) {
    G.expediente.datos = lista.slice();
    G.expediente.avisados = []; G.expediente.avisos_hoy = 0;
    guardar(G); calcular(); pintar();
  }
  function empezarDeCero() { G = enBlanco(); guardar(G); calcular(); pintar(); }
  /* ---------- la pantalla ---------- */
  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function pintar() {
    var caja = document.getElementById("ban");
    if (!caja) return;
    var d = ultimo || calcular();
    var h = '<h2>Lo que llevo yo</h2>'
      + '<p class="sub">Hago sola todo lo que puedo. Te pregunto solo lo imprescindible.</p>'
      + '<div class="ban-barra">'
      + '<span class="ban-v">' + d.resumen.VERDE + ' las hago yo</span>'
      + '<span class="ban-a">' + d.resumen.AMBAR + ' esperan permiso o un dato</span>'
      + '<span class="ban-r">' + d.resumen.ROJO + ' solo puedes tu</span>'
      + '<span>' + d.autonomia + ' % de autonomia</span></div>';

    if (d.diario.length) {
      h += '<div class="ban-bloque"><h3>Hecho, sin preguntarte</h3><ul>'
        + d.diario.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
    }

    if (d.aviso) {
      h += '<div class="ban-pide"><p>' + esc(d.aviso) + '</p>'
        + '<button class="ban-si" id="ban-si">Si, hazlo</button>'
        + '<button class="ban-no" id="ban-no">Ahora no</button></div>';
    } else if (d.callado) {
      h += '<p class="sub">Hay ' + d.callado + ' cosa(s) esperando. No te las saco ahora para no dar la lata: van en el parte del dia.</p>';
    }

    if (d.rojas.length) {
      h += '<div class="ban-bloque"><h3>Esto no lo puedo hacer yo</h3><ul>'
        + d.rojas.slice(0, 4).map(function (r) { return '<li>' + esc(r.tarea) + ' — ' + esc(r.porque) + '</li>'; }).join("")
        + (d.rojas.length > 4 ? '<li>y ' + (d.rojas.length - 4) + ' mas</li>' : '') + '</ul></div>';
    }

    h += '<div class="ban-llaves"><h3>Permisos</h3>'
      + '<p class="sub">Cada uno dice cuantas tareas mias desbloquea hoy. Los que no desbloquean nada todavia no te los pido.</p>';
    d.llaves.forEach(function (l) {
      var porque = l.bloqueada_por
        ? "antes hace falta " + l.bloqueada_por.map(function (k) { return M.LLAVES[k].que.toLowerCase(); }).join(" y ")
        : (l.desbloquea > 0 ? "desbloquea " + l.desbloquea + " tarea(s) ahora mismo" : "hoy no desbloquea nada");
      h += '<div class="ban-l"><div><b>' + esc(l.que) + '</b><small>' + esc(l.como) + '</small>'
        + '<small>' + esc(porque) + '</small></div>'
        + (l.tengo
            ? '<span class="ban-ya">autorizado</span><button data-quitar="' + l.llave + '">Quitar</button>'
            : '<button data-dar="' + l.llave + '"' + (l.desbloquea > 0 && !l.bloqueada_por ? '' : ' disabled') + '>Autorizar</button>')
        + '</div>';
    });
    h += '</div>';

    if (d.siguiente) {
      h += '<p class="sub" style="margin-top:12px">Lo que mas me ayudaria ahora: <b>' + esc(d.siguiente.que)
        + '</b> — ' + d.siguiente.desbloquea + ' tarea(s) mas. ' + esc(d.siguiente.como) + '</p>';
    }

    caja.innerHTML = h;
    var si = document.getElementById("ban-si"); if (si) si.addEventListener("click", decirQueSi);
    var no = document.getElementById("ban-no"); if (no) no.addEventListener("click", decirQueNo);
    caja.querySelectorAll("[data-dar]").forEach(function (b) {
      b.addEventListener("click", function () { autorizar(b.getAttribute("data-dar")); });
    });
    caja.querySelectorAll("[data-quitar]").forEach(function (b) {
      b.addEventListener("click", function () { retirar(b.getAttribute("data-quitar")); });
    });
  }
  function montar() {
    if (document.getElementById("ban")) return;
    var ancla = document.querySelector(".asis") || document.getElementById("inmo-mesa");
    if (!ancla) return;
    var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s);
    var caja = document.createElement("div"); caja.className = "ban"; caja.id = "ban";
    ancla.parentNode.insertBefore(caja, ancla);
    G = leer();
    calcular();
    pintar();
    if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("bandeja:montada", { version: "1.0" });
  }

  window.IMMOIA_BANDEJA = {
    version: "1.0",
    estado: function () { return ultimo || calcular(); },
    autorizar: autorizar, retirar: retirar,
    ponerDatos: ponerDatos, decirQueSi: decirQueSi, decirQueNo: decirQueNo,
    empezarDeCero: empezarDeCero,
    guardado: function () { return G; }
  };

  /* Espera al motor sin bloquear la pagina. Si no llega, no monta
     nada y el nucleo lo dira: nunca a medias y en silencio. */
  var intentos = 0;
  var reloj = setInterval(function () {
    if (window.IMMOIA_MOTOR) {
      M = window.IMMOIA_MOTOR;
      clearInterval(reloj);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
      else montar();
    } else if (++intentos > 40) { clearInterval(reloj); }
  }, 250);
})();
