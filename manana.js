/* ==================================================================
   IMMO IA · manana.js — LA PANTALLA DE LA MAÑANA
   ------------------------------------------------------------------
   Lo que ve la directora al encender: que tiene HOY en toda la
   cartera. No es un resumen escrito por el modelo: el orden lo calcula
   el motor con los plazos y los datos que hay, y siempre sale igual.
   La IA se usa despues, y solo para explicarlo con palabras.

   No construye nada nuevo: lee la cartera (cartera.js) y le pregunta
   al motor que ya existe (motor.js). No escribe en ningun expediente.
   ================================================================== */
(function () {
  "use strict";
  if (window.IMMOIA_MANANA) return;

  var M = null, C = null;

  /* ---------- fechas ---------- */
  var MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  var DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  /* QUE DIA ES HOY. Aqui se calculaba en hora universal (la de Greenwich),
     y la bandeja y la cartera lo calculaban en hora local: pasada la
     medianoche en Espana esta pantalla y la bandeja no coincidian en que
     dia es hoy (L-25 del auditor y el fallo 2 de E1 son el mismo fallo).
     Ahora es UNA SOLA CUENTA, en la hora de aqui, y NO depende de que otro
     fichero haya cargado antes: con "||", el primero que llegue la deja
     puesta y los demas usan la que ya hay. Su sitio es nucleo.js; esta
     misma linea esta ahi, en cartera.js y en bandeja.js, para que esta
     pantalla sepa que dia es aunque se abra sola. */
  window.IMMOIA_HOY = window.IMMOIA_HOY || function () {
    var d = new Date(), m = d.getMonth() + 1, x = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (x < 10 ? "0" + x : x);
  };
  function hoyISO() { return window.IMMOIA_HOY(); }
  function diasHasta(iso) {
    if (!iso) return null;
    var a = new Date(iso + "T12:00:00"), b = new Date(hoyISO() + "T12:00:00");
    return Math.round((a - b) / 86400000);
  }
  function enCristiano(iso) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return iso || "";
    return Number(p[2]) + " de " + MESES[Number(p[1]) - 1];
  }
  function cuando(iso) {
    var d = diasHasta(iso);
    if (d === null) return "";
    if (d < -1) return "se pasó hace " + (-d) + " días";
    if (d === -1) return "se pasó ayer";
    if (d === 0) return "vence hoy";
    if (d === 1) return "vence mañana";
    return "vence el " + enCristiano(iso) + " (" + d + " días)";
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }
  /* «de el certificado» no lo dice nadie: aqui se escribe «del certificado» */
  function conDe(t) {
    t = String(t || "");
    if (/^el /i.test(t)) return "del " + t.slice(3);
    if (/^los /i.test(t)) return "de los " + t.slice(4);
    return "de " + t;
  }
  function conA(t) {
    t = String(t || "");
    if (/^el /i.test(t)) return "al " + t.slice(3);
    if (/^los /i.test(t)) return "a los " + t.slice(4);
    return "a " + t;
  }
  function plural(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function minu(t) { t = String(t || ""); return t.charAt(0).toLowerCase() + t.slice(1); }
  function enumerar(l) {
    if (!l.length) return "";
    if (l.length === 1) return l[0];
    return l.slice(0, -1).join(", ") + " y " + l[l.length - 1];
  }

  /* ---------- mirar un expediente sin tocarlo ---------- */
  function copiaExp(g) {
    var e = new M.Expediente((g.expediente && g.expediente.nombre) || "el expediente");
    e.hechos = new Set(g.expediente.hechos || []);
    e.en_marcha = new Set(g.expediente.en_marcha || []);
    e.avisados = new Set(g.expediente.avisados || []);
    e.rechazados = new Set(g.expediente.rechazados || []);
    e.senales = new Set(g.expediente.senales || []);
    e.datos = new Set(g.expediente.datos || []);
    e.diario = (g.expediente.diario || []).slice();
    return e;
  }

  function enPalabras(info) {
    if (!info) return "";
    if (info.tipo === "dato") return (info.falta || []).map(function (d) { return (M.DATOS[d] || d).toLowerCase(); }).join(" y ");
    if (info.tipo === "permiso") return (info.falta || []).filter(function (k) { return !!M.LLAVES[k]; })
      .map(function (k) { return M.LLAVES[k].que.toLowerCase(); }).join(" y ");
    if (info.tipo === "notario") return "un poder notarial del cliente";
    if (info.tipo === "imposible") return "que lo haga una persona: la ley no deja otra cosa";
    return "";
  }

  function proxima(g) {
    var exp = copiaExp(g), tengo = new Set(g.llaves || []);
    for (var i = 0; i < M.GUION.length; i++) {
      var p = M.GUION[i];
      if (!M.toca(p, exp)) continue;
      var t = M.buscar_tarea(p.tarea);
      if (!t) continue;
      var e = M.estado(t, tengo, exp.datos);
      return { tarea: p.tarea, porque: p.porque, color: e[0], falta: enPalabras(e[1]), tipo: e[1].tipo };
    }
    return null;
  }

  /* Todo lo que este expediente tiene hoy, ya ordenado. */
  function mirar(e) {
    var g = e.guardado;
    var tengo = new Set(g.llaves || []);
    var datos = new Set((g.expediente && g.expediente.datos) || []);
    var res = M.resumen(tengo, datos);
    var total = res.VERDE + res.AMBAR + res.ROJO;
    var cosas = [];

    /* 1. las gestiones que estan fuera esperando */
    (g.gestiones || []).forEach(function (x) {
      if (!x || x.estado === "cerrada") return;
      var quien = (x.organismo || "quien tiene que contestar");
      var motivo = (x.motivo || "un papel");
      if (x.estado === "preparada") {
        cosas.push({ urgencia: 70, grupo: "tuyo", que: "Está escrito y sin mandar: " + motivo,
                     detalle: "Va para " + quien + ". Hasta que no salga, el plazo no empieza a contar.", paso: x.paso });
        return;
      }
      var d = diasHasta(x.vence);
      var u = d === null ? 45 : (d < 0 ? 100 : d === 0 ? 95 : d <= 2 ? 85 : 45);
      cosas.push({ urgencia: u, grupo: d !== null && d <= 0 ? "plazo" : "esperando",
                   que: (d !== null && d < 0 ? "Se ha pasado el plazo " + conDe(motivo)
                        : d === 0 ? "Hoy se acaba el plazo " + conDe(motivo)
                        : "Esperas " + motivo),
                   detalle: "Se lo pediste " + conA(quien) + (x.desde ? " el " + enCristiano(x.desde) : "") + ". " +
                            (x.vence ? cuando(x.vence).charAt(0).toUpperCase() + cuando(x.vence).slice(1) + "." : "") +
                            (x.estado === "reclamada" ? " Ya reclamado." : ""),
                   paso: x.paso });
    });

    /* 2. lo que la maquina no puede seguir sin ti */
    var ab = g.expediente && g.expediente.aviso_abierto;
    if (ab) cosas.push({ urgencia: 80, grupo: "tuyo", que: "Te ha preguntado algo y sigue esperando",
                         detalle: String(ab) });

    /* 3. los datos de la ficha que faltan */
    var faltan = Object.keys(M.DATOS).filter(function (d) { return !datos.has(d); });
    if (faltan.length) {
      var sig = proxima(g);
      cosas.push({ urgencia: sig && sig.color === "AMBAR" && sig.tipo === "dato" ? 75 : 60, grupo: "tuyo",
                   que: "Le " + (faltan.length === 1 ? "falta un dato" : "faltan " + faltan.length + " datos") + " de la ficha",
                   detalle: "Te pide " + enumerar(faltan.map(function (d) { return minu(M.DATOS[d]); }))
                            + ". Cada uno que pongas le quita una pregunta y sube lo que puede hacer sola." });
    }

    var sigue = proxima(g);
    if (sigue && !cosas.length) {
      cosas.push({ urgencia: 30, grupo: "esperando", que: "Lo siguiente: " + minu(sigue.tarea),
                   detalle: sigue.porque + "." });
    }

    cosas.sort(function (a, b) { return b.urgencia - a.urgencia; });

    return {
      id: e.id, nombre: e.nombre, cerrado: !!e.cerrado,
      autonomia: total ? Math.round(res.VERDE * 100 / total) : 0,
      resumen: res,
      cosas: cosas,
      urgencia: cosas.length ? cosas[0].urgencia : 0,
      siguiente: sigue,
      hechoHoy: ((g.expediente && g.expediente.diario) || []).slice(-6),
      permiso: M.siguiente_paso(tengo, datos)
    };
  }

  function todo() {
    var ls = (C.lista() || []).filter(function (e) { return !C.expediente(e.id).cerrado; });
    return ls.map(function (e) { return mirar(C.expediente(e.id)); })
             .sort(function (a, b) { return b.urgencia - a.urgencia; });
  }

  /* ---------- la pantalla ---------- */
  function bloque(titulo, sub, filas) {
    if (!filas.length) return "";
    var h = '<section class="ma-b"><h2>' + esc(titulo) + '</h2>';
    if (sub) h += '<p class="ma-sub">' + esc(sub) + '</p>';
    h += '<ul class="ma-l">';
    filas.forEach(function (f) {
      h += '<li><b>' + esc(f.que) + '</b>'
        + '<span class="ma-donde">' + esc(f.nombre) + '</span>'
        + (f.detalle ? '<small>' + esc(f.detalle) + '</small>' : '')
        + '<button type="button" class="ma-ir" data-ir="' + esc(f.id) + '">Abrirlo</button>'
        + '</li>';
    });
    return h + '</ul></section>';
  }

  function saca(lista, grupo, tope) {
    var f = [];
    lista.forEach(function (x) {
      x.cosas.forEach(function (c) {
        if (c.grupo === grupo) f.push({ que: c.que, detalle: c.detalle, nombre: x.nombre, id: x.id, urgencia: c.urgencia });
      });
    });
    f.sort(function (a, b) { return b.urgencia - a.urgencia; });
    return tope ? f.slice(0, tope) : f;
  }

  function pintar() {
    var caja = document.getElementById("manana");
    if (!caja) return;
    var lista = todo();
    var d = new Date();
    var quien = (window.IMMOIA_OFICINA && window.IMMOIA_OFICINA.usuario()) || "";

    if (!lista.length) {
      caja.innerHTML = '<section class="ma-b"><h2>Todavía no hay nada encima de la mesa</h2>'
        + '<p class="ma-sub">Abre tu primer expediente ahí abajo y ponle un nombre corto, como «el de Adeje». '
        + 'En cuanto tenga la dirección empieza a trabajar sola.</p></section>';
      return;
    }

    var plazo = saca(lista, "plazo");
    var tuyo = saca(lista, "tuyo");
    var esperando = saca(lista, "esperando");
    var primero = plazo[0] || tuyo[0] || esperando[0] || null;
    /* lo que va arriba del todo no se repite abajo */
    function sinElPrimero(f) { return primero ? f.filter(function (x) { return x !== primero; }) : f; }

    var h = '<header class="ma-cab">'
      + '<p class="ma-dia">' + esc(DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()]) + (quien ? " · " + esc(quien) : "") + '</p>'
      + '<h1>Tu mañana</h1>'
      + '<p class="ma-cuenta">' + plural(lista.length, "expediente abierto", "expedientes abiertos")
      + (plazo.length ? ' · <b class="ma-rojo">' + plural(plazo.length, "con el plazo encima", "con el plazo encima") + '</b>' : '')
      + (tuyo.length ? ' · ' + plural(tuyo.length, "cosa te espera a ti", "cosas te esperan a ti") : '')
      + (esperando.length ? ' · ' + plural(esperando.length, "esperando a otros", "esperando a otros") : '')
      + '</p></header>';

    if (primero) {
      h += '<section class="ma-primero"><p class="ma-et">Lo primero de hoy</p>'
        + '<b>' + esc(primero.que) + '</b>'
        + '<span class="ma-donde">' + esc(primero.nombre) + '</span>'
        + (primero.detalle ? '<small>' + esc(primero.detalle) + '</small>' : '')
        + '<button type="button" class="ma-ir ma-ir1" data-ir="' + esc(primero.id) + '">Abrir ese expediente</button>'
        + '</section>';
    }

    h += bloque("El plazo se acaba", "Esto es lo que la ley o el calendario ya no espera.", sinElPrimero(plazo));
    h += bloque("Te esperan a ti", "Nada de esto puede seguir hasta que tú hagas algo. Es lo que más destranca.", sinElPrimero(tuyo));
    h += bloque("Esperando a otros", "Está pedido y dentro de plazo. No hay que hacer nada todavía.", sinElPrimero(esperando));

    h += '<section class="ma-b"><h2>Cada expediente</h2><div class="ma-tar">';
    lista.forEach(function (x) {
      h += '<div class="ma-t"><b>' + esc(x.nombre) + '</b>'
        + '<span class="ma-aut">Puede hacer sola el ' + x.autonomia + ' % de las tareas</span>'
        + (x.siguiente ? '<small>Lo siguiente: ' + esc(minu(x.siguiente.tarea))
            + (x.siguiente.color !== "VERDE" && x.siguiente.falta ? ' — le falta ' + esc(x.siguiente.falta) : '') + '</small>' : '')
        + (x.hechoHoy.length ? '<small class="ma-hecho">Ha hecho sola: ' + esc(x.hechoHoy.join("; ")) + '</small>' : '')
        + '<button type="button" class="ma-ir" data-ir="' + esc(x.id) + '">Abrirlo</button></div>';
    });
    h += '</div></section>';

    h += '<section class="ma-b ma-ia"><h2>¿Te lo ordeno con palabras?</h2>'
      + '<p class="ma-sub">El orden de arriba lo calculo yo con los plazos, y sale siempre igual. '
      + 'Si quieres, la secretaria te lo cuenta y te dice por dónde empezar.</p>'
      + '<button type="button" id="ma-pedir">Que me lo cuente</button>'
      + '<div id="ma-dice"></div></section>';

    caja.innerHTML = h;
    /* L-48: el repintado de cada 15 s ya no borra lo que ha contado la IA */
    var ds = document.getElementById("ma-dice");
    if (ds && DICHO) ds.textContent = DICHO;
    var bp = document.getElementById("ma-pedir");
    if (bp && PIDIENDO) bp.disabled = true;

    caja.querySelectorAll("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cual = b.getAttribute("data-ir");
        try { C.abrir(cual); } catch (e) {}
        /* L-49: antes de irse, se sube el cambio de expediente activo (como mucho 3 s) */
        var ir = function () { location.href = "inmobiliaria.html"; };
        try {
          if (typeof C.subir === "function") {
            var hecho = false, fuera = function () { if (!hecho) { hecho = true; ir(); } };
            setTimeout(fuera, 3000);
            C.subir(fuera);
            return;
          }
        } catch (e) {}
        ir();
      });
    });
    var p = document.getElementById("ma-pedir");
    if (p) p.addEventListener("click", pedirleALaIA);
  }

  /* ---------- que lo cuente la secretaria ----------
     Se le manda lo que hay, sin datos personales, y se le pide que
     ordene. Los numeros ya los ha puesto el motor: ella solo explica. */
  function parteParaLaIA() {
    var lista = todo(), l = [];
    l.push("Esto es lo que hay abierto en la oficina hoy. Son datos reales de la pantalla, no te inventes ninguno mas:");
    lista.forEach(function (x) {
      var trozos = x.cosas.slice(0, 3).map(function (c) { return c.que + " (" + c.detalle + ")"; });
      l.push("- " + x.nombre + ": " + (trozos.length ? trozos.join("; ") : "sin nada pendiente") + ".");
    });
    l.push("Dime por cuál empiezo y por qué, en cuatro frases como mucho, sin listas ni títulos. "
      + "No des importes, plazos legales ni porcentajes que no estén escritos aquí arriba. "
      + "Si dos cosas van igual de apretadas, di cuál destranca más trabajo.");
    return l.join("\n");
  }

  var DICHO = "", PIDIENDO = false;
  function poner(t) {
    DICHO = t;
    var s = document.getElementById("ma-dice"); if (s) s.textContent = t;
    var b = document.getElementById("ma-pedir"); if (b) b.disabled = PIDIENDO;
  }
  function pedirleALaIA() {
    var sitio = document.getElementById("ma-dice");
    if (!sitio || PIDIENDO) return;
    var a = "";
    try { a = (window.CONFIG && window.CONFIG.api) ? String(window.CONFIG.api).replace(/\/$/, "") : ""; } catch (e) {}
    if (!a) { poner("Esta página no sabe a qué servidor llamar."); return; }
    PIDIENDO = true; poner("Mirándolo…");
    fetch(a + "/hablar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ codigo: (window.CONFIG && window.CONFIG.codigo) || "leire2026",
                             mensajes: [{ papel: "yo", texto: parteParaLaIA() }] })
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        PIDIENDO = false; poner((d && d.respuesta) || (d && d.error) || "No he podido.");
      })
      .catch(function () { PIDIENDO = false; poner("Sin conexión con el servidor."); });
  }

  /* ---------- arranque: espera al motor y a la cartera ---------- */
  var intentos = 0;
  var reloj = setInterval(function () {
    if (window.IMMOIA_MOTOR && window.IMMOIA_CARTERA) {
      M = window.IMMOIA_MOTOR; C = window.IMMOIA_CARTERA;
      clearInterval(reloj);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
      else arrancar();
    } else if (++intentos > 40) { clearInterval(reloj); }
  }, 250);

  function arrancar() {
    pintar();
    /* si la cartera baja algo del servidor, se vuelve a pintar */
    try {
      if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.cuando("cartera:al-dia", pintar);
      if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("manana:montada", { version: "1.0" });
    } catch (e) {}
    setInterval(pintar, 15000);
  }

  window.IMMOIA_MANANA = {
    version: "1.0",
    mirar: function () { return todo(); },
    pintar: pintar,
    parte: parteParaLaIA
  };
})();
