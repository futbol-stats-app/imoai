/* ==================================================================
   la_mesa.js · LA MESA DE LA SECRETARIA  (CARRIL 2)

   Lo que ella abre cada mañana: sus expedientes, lo que le frena hoy
   y lo que le vence esta semana. Y desde cada expediente, la ficha
   con sus papeles uno a uno.

   DE DÓNDE SALE CADA COSA — que es lo único que importa aquí:

     · LOS EXPEDIENTES salen de window.LA_SECRETARIA_MESA, que lo pone
       casa\los_expedientes.js. Son los mismos cuatro de
       SUBIR\LA_CUENTA_DE_ELLA\cuenta\expedientes_de_la_directora.json,
       copiados también en mesa\. TODOS INVENTADOS.

     · LO QUE LE FRENA lo calcula wow\repaso.js, que ya existe y ya
       está examinado. AQUÍ NO SE REPASA NADA: se llama a
       window.IMMOIA_REPASO.repasar() y se pinta lo que devuelve.
       Ni un número se toca, ni una frase se reescribe.

     · LOS PLAZOS de la ficha de cada expediente salen de
       IMMOIA_REPASO.mirarUno(), que es la misma pieza mirando un
       expediente solo. Las vigencias y sus fuentes son las suyas.

   LO QUE ESTE FICHERO NO HACE, A PROPÓSITO:
     · no inventa ni un papel ni una fecha: si el expediente no lo
       dice y la tabla de OT-25 no lo pide, aquí no sale;
     · no estima nada: donde no hay dato pone «no lo sé»;
     · no sale a internet: ni fetch, ni XHR, ni WebSocket, ni una sola
       dirección de internet escrita dentro. Se abre con doble clic y
       funciona con el cable desenchufado.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.1";

  /* REDACTAR (V1 · taller RD · 24/09/2026). Dónde está wow\redactar.js,
     que se carga la primera vez que se pulsa «Redactar» y no antes. Se
     saca de dónde se ha cargado ESTE fichero (mesa/la_mesa.js), para
     que sirva igual con doble clic que desde el servidor de la voz. */
  var RUTA_REDACTAR = (function () {
    try {
      var yo = document.currentScript && document.currentScript.getAttribute("src");
      if (yo && /mesa\/la_mesa\.js(\?.*)?$/.test(yo)) return yo.replace(/mesa\/la_mesa\.js(\?.*)?$/, "wow/redactar.js");
    } catch (e) {}
    return "wow/redactar.js";
  })();

  /* ------------------------------------------------------------------
     0 · UTILIDADES CORTAS
     ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }
  function crear(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function vaciar(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  /* SINGULAR Y PLURAL · ARREGLO DEL 20/09/2026.
     «1 expedientes», «dentro de 1 días», «1 de 1 papeles»: son las
     frases que delatan que esto lo ha escrito un programa, y salen en
     la primera pantalla. Se dicen con esta función y no a mano. */
  function nCosas(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function nDias(n) { return nCosas(n, "día", "días"); }
  function sinTildes(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
      .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n");
  }
  function esFecha(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s == null ? "" : s)); }

  /* Una fecha sólo se acepta si además EXISTE en el calendario.
     «2026-02-30» tiene la forma correcta y no existe: aquí se rechaza
     y en pantalla se dice que no cuadra, en vez de pintar una fecha
     falsa o de reventar. */
  function fechaDeVerdad(s) {
    if (!esFecha(s)) return null;
    var p = String(s).split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    if (d.getUTCFullYear() !== +p[0] || (d.getUTCMonth() + 1) !== +p[1] || d.getUTCDate() !== +p[2]) return null;
    return d;
  }
  function diasEntre(fin, desde) {
    var a = fechaDeVerdad(fin), b = fechaDeVerdad(desde);
    if (!a || !b) return null;
    return Math.round((a - b) / 86400000);
  }
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function enCristiano(iso) {
    var d = fechaDeVerdad(iso);
    if (!d) return String(iso == null ? "" : iso);
    return d.getUTCDate() + " de " + MESES[d.getUTCMonth()] + " de " + d.getUTCFullYear();
  }
  function hoyDelSistema() {
    var d = new Date();
    function dd(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + dd(d.getMonth() + 1) + "-" + dd(d.getDate());
  }

  /* ------------------------------------------------------------------
     1 · EL ESTADO DE LA MESA (lo justo para que al volver no se pierda)
     ------------------------------------------------------------------ */
  var E = {
    version: VERSION,
    pintada: false,
    hoy: null,
    de_donde_es_hoy: null,
    datos: null,
    repaso: null,          /* lo que devuelve IMMOIA_REPASO.repasar() */
    problema: null,        /* si no se pudo montar la mesa, aquí pone por qué */
    abierto: null,         /* id del expediente abierto, o null */
    avisos_semana: []
  };

  /* «confirmado» ENTRÓ EL 21/09/2026.
     Es el estado que pone la propia aplicación cuando el papel lleva
     una fecha que TODAVÍA NO HA LLEGADO (una cita de notaría del año
     que viene, por ejemplo). Ojo al «esta: false»: un papel confirmado
     NO está en la carpeta, porque todavía no ha pasado. Decir que sí
     sería dar por celebrado un trámite futuro, que es justo el fallo
     que esto viene a tapar. */
  var COMO_ESTA = {
    falta:      { texto: "falta",      clase: "est_falta",      esta: false },
    pedido:     { texto: "pedido",     clase: "est_pedido",     esta: false },
    confirmado: { texto: "confirmado para esa fecha", clase: "est_pedido", esta: false },
    recibido:   { texto: "recibido",   clase: "est_recibido",   esta: true  },
    verificado: { texto: "verificado", clase: "est_verificado", esta: true  }
  };
  function comoEsta(d) {
    var k = sinTildes(d && d.estado_documento);
    return COMO_ESTA[k] || { texto: (d && d.estado_documento) || "sin decir", clase: "est_raro", esta: false };
  }

  /* ------------------------------------------------------------------
     2 · LEER LOS DATOS  (y decir claro cuándo no se pueden leer)
     ------------------------------------------------------------------ */
  function leerLosDatos() {
    var m = raiz ? raiz.LA_SECRETARIA_MESA : null;
    if (!m || typeof m !== "object") {
      return { fallo: "No encuentro el fichero de expedientes (casa\\los_expedientes.js). " +
                      "Sin él no tengo nada que enseñarte, y no me lo voy a inventar." };
    }
    if (Object.prototype.toString.call(m.expedientes) !== "[object Array]") {
      return { fallo: "El fichero de expedientes está ahí pero no tiene una lista de expedientes dentro. " +
                      "Está roto o es de otra cosa. No toco nada y te lo digo." };
    }
    var buenos = [], malos = 0;
    m.expedientes.forEach(function (e) {
      if (e && typeof e === "object") buenos.push(e); else malos++;
    });
    return { datos: m, expedientes: buenos, descartados: malos };
  }

  /* ------------------------------------------------------------------
     3 · LA FASE  —  SOLO LO QUE DICEN SUS PROPIOS PAPELES
     ------------------------------------------------------------------
     No hay ningún campo «fase» en el expediente, así que aquí NO se
     inventa uno: se dice en qué punto está SEGÚN EL PAPEL QUE LO
     DEMUESTRA, y se enseña ese papel debajo. Si los papeles no lo
     dicen, pone «no lo sé».
     ------------------------------------------------------------------ */
  function buscaDoc(docs, trozos) {
    for (var i = 0; i < docs.length; i++) {
      var n = sinTildes(docs[i] && docs[i].cual);
      for (var j = 0; j < trozos.length; j++) if (n.indexOf(trozos[j]) >= 0) return docs[i];
    }
    return null;
  }
  function esta(d) { return !!d && comoEsta(d).esta; }
  function pedido(d) { return !!d && sinTildes(d.estado_documento) === "pedido"; }
  /* CONFIRMADO (21/09/2026): el papel tiene día puesto, pero ese día
     todavía no ha llegado. No está en la carpeta, y aun así la fase SÍ
     tiene que decir el día: «camino de notaría · firma el 3 de octubre
     de 2027». Si no se mirase, la mesa diría «pendiente de poner fecha
     de notaría» teniendo la fecha delante, que es otra contradicción. */
  function confirmado(d) { return !!d && sinTildes(d.estado_documento) === "confirmado"; }

  /* ------------------------------------------------------------------
     ARREGLO DEL 20/09/2026 · LA FASE MIRA SI LA FECHA YA PASÓ
     ------------------------------------------------------------------
     Antes, para una venta, lo primero que se miraba era si había cita de
     notaría con fecha. NO se miraba si esa fecha ya había pasado, ni si
     la escritura ya estaba firmada, y no existía ninguna fase «vendido».

     Resultado: una venta escriturada hace ocho meses salía como «camino
     de notaría · firma el 20 de enero de 2026», en futuro, y se colaba
     entre lo urgente de hoy. Debajo, en la misma tarjeta, ponía «hace
     246 días». Una cosa desmentía a la otra.

     La regla nueva, en una línea: SI LA FECHA YA PASÓ, NO ES URGENTE,
     ES HISTORIA. Y si además consta la escritura pública, está vendido
     y se dice así.
     ------------------------------------------------------------------ */
  function faseDe(e, hoy) {
    var op = sinTildes(e && e.tipo_operacion);
    var docs = ((e && e.documentos) || []).filter(function (d) { return d && d.cual; });
    var HOY = fechaDeVerdad(hoy) ? hoy : (E.hoy && fechaDeVerdad(E.hoy) ? E.hoy : hoyDelSistema());
    function yaPaso(iso) {
      var q = diasEntre(iso, HOY);
      return q !== null && q < 0;
    }

    if (op.indexOf("venta") >= 0 || op.indexOf("compraventa") >= 0) {
      var not = buscaDoc(docs, ["notaria"]);
      var arr = buscaDoc(docs, ["arras"]);
      var esc = buscaDoc(docs, ["escritura publica", "escritura de compraventa", "escritura"]);

      /* 1 · la escritura ya está: esto está vendido, y no hay más que hablar */
      if (esta(esc)) {
        return { fase: "vendido y escriturado",
                 detalle: fechaDeVerdad(esc.fecha)
                   ? "se firmó el " + enCristiano(esc.fecha) + ", ya no corre nada"
                   : "ya no corre nada",
                 porque: esc.literal_en_OT25 || esc.cual };
      }
      /* 1 bis · la escritura tiene día puesto, pero ese día no ha
         llegado (21/09/2026). NO es «vendido»: es una fecha que viene. */
      if (confirmado(esc) && fechaDeVerdad(esc.fecha)) {
        return { fase: "camino de notaría",
                 detalle: "la escritura está prevista para el " + enCristiano(esc.fecha) + ", todavía no está firmada",
                 porque: esc.literal_en_OT25 || esc.cual };
      }
      /* 2 · la cita de notaría ya pasó: es historia, no un plazo */
      if (esta(not) && fechaDeVerdad(not.fecha) && yaPaso(not.fecha)) {
        return { fase: "la notaría ya pasó",
                 detalle: "la cita era el " + enCristiano(not.fecha) + " y ya pasó. " +
                          "No consta la escritura firmada: dime si se firmó o si hay que dar otra fecha",
                 porque: not.literal_en_OT25 || not.cual };
      }
      /* 3 · hay cita con día: se dice el día. Da igual que el papel esté
         «recibido» (la cita ya se celebró y nadie ha apuntado nada más)
         o «confirmado» (todavía no ha llegado): lo que ella necesita ver
         es el día, y sale en letra. */
      if ((esta(not) || confirmado(not)) && fechaDeVerdad(not.fecha)) {
        return { fase: "camino de notaría", detalle: "firma el " + enCristiano(not.fecha),
                 porque: not.literal_en_OT25 || not.cual };
      }
      if (pedido(not)) {
        return { fase: "camino de notaría", detalle: "cita pedida, todavía sin fecha",
                 porque: not.literal_en_OT25 || not.cual };
      }
      if (esta(arr)) {
        return { fase: "con arras firmadas", detalle: "pendiente de poner fecha de notaría",
                 porque: arr.literal_en_OT25 || arr.cual };
      }
      if (docs.some(esta)) {
        return { fase: "reuniendo papeles", detalle: null, porque: "todavía no consta ni arras ni notaría" };
      }
      return { fase: "recién abierto", detalle: null, porque: "no consta ningún papel recibido" };
    }

    if (op.indexOf("alquiler") >= 0 || op.indexOf("arrendamiento") >= 0) {
      var con = buscaDoc(docs, ["arrendamiento", "contrato de alquiler", "contrato"]);
      var fia = buscaDoc(docs, ["fianza"]);
      if (esta(con) && esta(fia)) {
        return { fase: "firmado y con la fianza depositada", detalle: null,
                 porque: (con.literal_en_OT25 || con.cual) + " · " + (fia.literal_en_OT25 || fia.cual) };
      }
      if (esta(con)) {
        return { fase: "firmado", detalle: "no consta el depósito de la fianza",
                 porque: con.literal_en_OT25 || con.cual };
      }
      return { fase: "preparando el contrato", detalle: null, porque: "el contrato todavía no consta firmado" };
    }

    return { fase: "no lo sé", detalle: "el expediente no dice si es venta, alquiler o vacacional",
             porque: null };
  }

  /* ------------------------------------------------------------------
     4 · EL REPASO  —  SE LLAMA, NO SE COPIA
     ------------------------------------------------------------------ */
  function hacerElRepaso(datos) {
    var R = raiz ? raiz.IMMOIA_REPASO : null;
    if (!R || typeof R.repasar !== "function") {
      return { fallo: "No está cargado el repaso (wow\\repaso.js). Sin él no te digo qué te frena: " +
                      "prefiero no decirte nada a decirte algo que no he calculado." };
    }
    /* ------------------------------------------------------------------
       EL DÍA ES EL DEL RELOJ DE SU ORDENADOR. SIEMPRE.
       ARREGLO DEL 20/09/2026.

       Antes esto decía: «si el fichero trae su propio hoy, manda ése».
       Y el fichero traía "hoy": "2026-09-21", así que la mesa contaba
       los plazos desde ese día pasara lo que pasara. El lunes 21
       cuadraba. El martes 22 ya no, y dentro de un mes le habría dicho
       a una directora que algo vence «el jueves 24» con el jueves 24
       un mes atrás. Una demostración que solo es verdad un día no es
       una demostración: es una foto.

       Aquí ya no se mira ningún «hoy» de ningún fichero. Los
       expedientes de ejemplo colocan sus fechas en relación al día en
       que se abren (casa\\los_expedientes.js lo explica entero), así
       que la mesa enseña lo mismo el lunes, el martes o dentro de un
       mes: unas cosas ya pasadas, una que vence dentro de tres días y
       otras lejos.
       ------------------------------------------------------------------ */
    var hoy = hoyDelSistema();
    var deDonde = "la fecha es la de hoy de este ordenador";
    var r;
    try { r = R.repasar(datos, hoy); }
    catch (err) { return { fallo: "El repaso se ha roto al mirarlos: " + (err && err.message ? err.message : err) }; }
    return { repaso: r, hoy: hoy, de_donde: deDonde };
  }

  /* Lo que vence: se saca de los propios hallazgos del repaso, sin
     recalcular fechas. «Esta semana» son los siete días desde hoy. */
  function loQueVence(r, hoy) {
    var out = [];
    (r.hallazgos || []).forEach(function (h) {
      if (h.clase !== "vence" && h.clase !== "vencido") return;
      var q = h.vence ? diasEntre(h.vence, hoy) : null;
      out.push({ h: h, dias: q });
    });
    out.sort(function (a, b) {
      if (a.dias == null && b.dias == null) return b.h.urgencia - a.h.urgencia;
      if (a.dias == null) return 1;
      if (b.dias == null) return -1;
      return a.dias - b.dias;
    });
    return out;
  }

  /* ------------------------------------------------------------------
     4 bis · REDACTAR  (V1 · taller RD · 24/09/2026)
     ------------------------------------------------------------------
     Un botón «Redactar» en cada expediente. Las plantillas están en
     wow\redactar.js, que se trae de la misma carpeta de la aplicación
     (un <script> de al lado, no de internet) la primera vez que se
     pulsa. Aquí solo se pone el botón y el hueco donde sale.
     NADA SE ENVÍA: redactar.js deja el texto para que lo mande ella.
     ------------------------------------------------------------------ */
  var REDACTAR_ESPERANDO = null;
  function conRedactar(luego) {
    if (raiz && raiz.IMMOIA_REDACTAR) { luego(raiz.IMMOIA_REDACTAR); return; }
    if (REDACTAR_ESPERANDO) { REDACTAR_ESPERANDO.push(luego); return; }
    REDACTAR_ESPERANDO = [luego];
    function acabar() {
      var cola = REDACTAR_ESPERANDO || []; REDACTAR_ESPERANDO = null;
      cola.forEach(function (f) { f(raiz ? raiz.IMMOIA_REDACTAR || null : null); });
    }
    try {
      var s = document.createElement("script");
      s.setAttribute("src", RUTA_REDACTAR);
      s.onload = acabar;
      s.onerror = acabar;
      (document.head || document.body).appendChild(s);
    } catch (e) { acabar(); }
  }
  function botonRedactar(e, hueco) {
    var id = String((e && (e.expediente_id || e.id)) || "sin número");
    var b = crear("button", "mesa_redactar", "Redactar");
    b.setAttribute("type", "button");
    b.setAttribute("data-redactar", id);
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function () {
      if (hueco.firstChild) {                 /* segunda vez: se cierra */
        vaciar(hueco); b.setAttribute("aria-expanded", "false"); return;
      }
      hueco.appendChild(crear("div", "mesa_nota", "Preparando los textos…"));
      conRedactar(function (RD) {
        vaciar(hueco);
        if (!RD || typeof RD.montar !== "function") {
          hueco.appendChild(crear("div", "mesa_roto",
            "No encuentro la pieza de redactar (wow\\redactar.js) al lado de la aplicación. " +
            "Sin ella no te escribo nada: prefiero no darte un texto a medias."));
          return;
        }
        try { RD.montar(hueco, e, { hoy: E.hoy || hoyDelSistema() }); b.setAttribute("aria-expanded", "true"); }
        catch (err) {
          vaciar(hueco);
          hueco.appendChild(crear("div", "mesa_roto", "No he podido preparar los textos: " + (err && err.message ? err.message : err)));
        }
      });
    });
    return b;
  }

  /* ------------------------------------------------------------------
     5 · PINTAR LA MESA
     ------------------------------------------------------------------ */
  function nota(caja, texto, clase) {
    var n = crear("div", clase || "mesa_nota", texto);
    caja.appendChild(n);
    return n;
  }

  function pintar() {
    if (E.pintada) return E;          /* al volver, la mesa se queda como estaba */
    E.pintada = true;

    var pie = $("mesa_pie");
    var cFrena = $("mesa_frena"), cAvisos = $("mesa_avisos");
    var cSem = $("mesa_semana"), cExp = $("mesa_expedientes");
    if (!cExp) return E;

    var l = leerLosDatos();
    if (l.fallo) {
      E.problema = l.fallo;
      if (pie) pie.textContent = l.fallo;
      nota(cExp, l.fallo, "mesa_roto");
      return E;
    }
    E.datos = l.datos;

    if (pie) {
      pie.textContent =
        (l.expedientes.length === 1
          ? "Este expediente es de ejemplo y está inventado: calle inventada, "
          : "Estos " + l.expedientes.length + " expedientes son de ejemplo y están inventados: calles inventadas, ") +
        "personas inventadas y documentos rotulados EJEMPLO. Tu oficina de verdad todavía no está enchufada aquí, " +
        "así que esto no se trae de ningún servidor y no se guarda en ninguno." +
        /* ARREGLO DE REDACCIÓN (20/09/2026): con una sola línea mala se
           leía «1 líneas del fichero no se entienden». */
        (l.descartados
          ? (l.descartados === 1
              ? " (1 línea del fichero no se entiende y se ha dejado fuera.)"
              : " (" + l.descartados + " líneas del fichero no se entienden y se han dejado fuera.)")
          : "");
    }

    if (!l.expedientes.length) {
      nota(cExp, "Tu mesa está vacía: no hay ni un expediente en el fichero. " +
                 "No es un error, es que no hay nada.", "mesa_vacio");
      if (cFrena) nota(cFrena, "Sin expedientes no hay nada que repasar.", "mesa_vacio");
      if (cAvisos) nota(cAvisos, "Sin expedientes no vence nada.", "mesa_vacio");
      return E;
    }

    /* ---------- el repaso ---------- */
    var rr = hacerElRepaso(l.datos);
    if (rr.fallo) {
      E.problema = rr.fallo;
      if (cFrena) nota(cFrena, rr.fallo, "mesa_roto");
      if (cAvisos) nota(cAvisos, "Tampoco te puedo decir qué vence: sale del mismo repaso.", "mesa_roto");
    } else {
      E.repaso = rr.repaso; E.hoy = rr.hoy; E.de_donde_es_hoy = rr.de_donde;
      pintarLoQueFrena(cFrena, rr.repaso, rr.hoy, rr.de_donde);
      E.avisos_semana = loQueVence(rr.repaso, rr.hoy);
      pintarLosAvisos(cAvisos, E.avisos_semana, rr.hoy);
    }

    /* ---------- lo que lleva esta semana, tal cual lo escribió ella ---------- */
    if (cSem && l.datos.semana) {
      var s = crear("details", "semana_caja");
      var t = crear("summary", null, "Tus notas de la semana, tal cual las escribiste");
      s.appendChild(t);
      s.appendChild(crear("div", "semana_casa", String(l.datos.semana).trim()));
      cSem.appendChild(s);
    }

    /* ---------- los expedientes ---------- */
    pintarLosExpedientes(cExp, l.expedientes, E.repaso);
    return E;
  }

  function pintarLoQueFrena(caja, r, hoy, deDonde) {
    if (!caja) return;
    /* AQUÍ NO SE PONE NINGÚN NOMBRE DE FICHERO. Antes esta línea decía
       «lo calcula wow\repaso.js»: eso es una ruta de Windows en la
       primera pantalla que ve una directora de inmobiliaria. Lo que
       ella necesita saber es de dónde salen los números, y eso se dice
       con palabras. El nombre del fichero sigue en el código, que es
       donde lo busca quien lo tenga que buscar. */
    var cab = crear("p", "mesa_fecha",
      "Repasado a día " + enCristiano(hoy) + " · " + deDonde + " · " +
      "las cuentas salen de las fechas de tus propios papeles, aquí no se toca ningún número.");
    caja.appendChild(cab);

    /* el parte, con las frases del repaso, sin retocar */
    var p = crear("div", "parte_mesa");
    (r.parte || []).forEach(function (linea) {
      p.appendChild(crear("p", "parte_linea_mesa", linea));
    });
    caja.appendChild(p);

    var lista = (r.hallazgos || []);
    if (!lista.length) {
      nota(caja, "Hoy no te frena nada. No es que no haya mirado: " +
                 (r.cuantos === 1 ? "lo he mirado" : "he mirado los " + r.cuantos) +
                 " y no sale nada.", "mesa_vacio");
      return;
    }
    var n = crear("p", "flojo", "Por orden de lo que más corre. " +
      nCosas(lista.length, "cosa", "cosas") + " en " +
      nCosas(r.cuantos, "expediente", "expedientes") + ". Pulsa una y te abro su expediente.");
    caja.appendChild(n);

    lista.forEach(function (h) {
      caja.appendChild(unAviso(h, hoy, true));
    });
  }

  function pintarLosAvisos(caja, avisos, hoy) {
    if (!caja) return;
    var deLaSemana = avisos.filter(function (a) { return a.dias != null && a.dias >= 0 && a.dias <= 7; });
    var pasados = avisos.filter(function (a) { return a.dias != null && a.dias < 0; });
    var luego = avisos.filter(function (a) { return a.dias == null || a.dias > 7; });

    caja.appendChild(crear("p", "flojo",
      "Los siete días que vienen desde el " + enCristiano(hoy) + ". Las fechas son las del repaso, no las pongo yo."));

    if (pasados.length) {
      caja.appendChild(crear("h4", "mesa_sub", "Ya se pasó (" + pasados.length + ")"));
      pasados.forEach(function (a) { caja.appendChild(unAviso(a.h, hoy, true)); });
    }
    if (deLaSemana.length) {
      caja.appendChild(crear("h4", "mesa_sub", "Esta semana (" + deLaSemana.length + ")"));
      deLaSemana.forEach(function (a) { caja.appendChild(unAviso(a.h, hoy, true)); });
    } else {
      nota(caja, "Esta semana no vence nada.", "mesa_vacio");
    }
    if (luego.length) {
      var d = crear("details", "mesa_luego");
      d.appendChild(crear("summary", null, "Más adelante (" + luego.length + ")"));
      luego.forEach(function (a) { d.appendChild(unAviso(a.h, hoy, true)); });
      caja.appendChild(d);
    }
  }

  function unAviso(h, hoy, conEnlace) {
    var a = crear("div", "aviso_mesa c_" + (h.clase || "dato"));
    var arr = crear("div", "aviso_donde_mesa", h.donde || "");
    a.appendChild(arr);
    a.appendChild(crear("div", "aviso_titulo_mesa", h.titulo || ""));
    if (h.detalle) a.appendChild(crear("div", "aviso_detalle_mesa", h.detalle));
    if (h.vence) {
      var q = diasEntre(h.vence, hoy);
      a.appendChild(crear("div", "aviso_fecha_mesa",
        "Fecha: " + enCristiano(h.vence) +
        (q == null ? " (esa fecha no cuadra en el calendario)"
                   : q < 0 ? " · hace " + (-q) + " día" + (-q === 1 ? "" : "s")
                   : q === 0 ? " · es hoy"
                   : " · dentro de " + q + " día" + (q === 1 ? "" : "s"))));
    }
    if (h.fuente) a.appendChild(crear("div", "aviso_fuente_mesa", h.fuente));
    if (conEnlace && h.exp) {
      var b = crear("button", "mesa_enlace", "Abrir este expediente");
      b.setAttribute("type", "button");
      b.setAttribute("data-exp", h.exp);
      b.addEventListener("click", function () { abrirExpediente(h.exp); });
      a.appendChild(b);
    }
    return a;
  }

  function pintarLosExpedientes(caja, expedientes, r) {
    var porId = {};
    if (r && r.expedientes) r.expedientes.forEach(function (u) { porId[u.id] = u; });

    expedientes.forEach(function (e) {
      var id = String((e && (e.expediente_id || e.id)) || "sin número");
      var u = porId[id] || null;
      var f = faseDe(e, E.hoy);
      var docs = (e.documentos || []).filter(function (d) { return d && d.cual; });
      var hay = docs.filter(function (d) { return comoEsta(d).esta; }).length;

      var c = crear("div", "exp_mesa");
      c.setAttribute("data-exp", id);

      c.appendChild(crear("div", "exp_que_mesa",
        (e.tipo_operacion ? String(e.tipo_operacion) : "no dice si es venta o alquiler")));
      c.appendChild(crear("div", "exp_donde_mesa",
        (e.vivienda && e.vivienda.direccion_literal) || e.nombre || "(sin dirección en el expediente)"));

      var fa = crear("div", "exp_fase_mesa");
      fa.appendChild(crear("span", "fase_etiqueta", f.fase));
      if (f.detalle) fa.appendChild(document.createTextNode(" · " + f.detalle));
      c.appendChild(fa);
      if (f.porque) c.appendChild(crear("div", "exp_porque_mesa", "Lo dice: " + f.porque));

      c.appendChild(crear("div", "exp_cuenta_mesa",
        hay + " de " + nCosas(docs.length, "papel", "papeles") + " en la carpeta"));

      /* qué le falta: lo del repaso, no una lista mía */
      var falta = crear("div", "exp_falta_mesa");
      if (!u) {
        falta.appendChild(crear("div", "exp_nolose",
          "De éste no tengo repaso, así que no te digo qué le falta."));
      } else if (!(u.faltan || []).length) {
        falta.appendChild(crear("div", "exp_nada_falta", "No le falta ningún papel de los que pide la tabla."));
      } else {
        falta.appendChild(crear("div", "exp_falta_tit",
          "Le falta" + (u.faltan.length === 1 ? "" : "n") + " " + u.faltan.length + ":"));
        var ul = crear("ul");
        u.faltan.forEach(function (x) { ul.appendChild(crear("li", null, x.cual)); });
        falta.appendChild(ul);
      }
      c.appendChild(falta);

      if (u && (u.plazos || []).length) {
        var pr = u.plazos.slice().sort(function (a, b) { return (a.dias) - (b.dias); })[0];
        c.appendChild(crear("div", "exp_plazo_mesa",
          "Lo que antes corre: " + pr.que + " · " + enCristiano(pr.fecha) +
          (pr.dias < 0 ? " (ya pasado)" : pr.dias === 0 ? " (hoy)" : " (dentro de " + nDias(pr.dias) + ")")));
      }

      if (e.ultimo_movimiento && e.ultimo_movimiento.fecha) {
        c.appendChild(crear("div", "exp_ultimo_mesa",
          "Lo último que consta es del " + enCristiano(e.ultimo_movimiento.fecha) +
          (e.ultimo_movimiento.que ? ": " + e.ultimo_movimiento.que : "") + "."));
      }

      var b = crear("button", "mesa_abrir", "Entrar en el expediente");
      b.setAttribute("type", "button");
      b.setAttribute("data-abrir", id);
      b.addEventListener("click", function () { abrirExpediente(id); });
      c.appendChild(b);

      /* REDACTAR (taller RD): el botón y, debajo, el hueco donde salen los textos */
      var hr = crear("div", "mesa_redactar_hueco");
      c.appendChild(botonRedactar(e, hr));
      c.appendChild(hr);

      caja.appendChild(c);
    });
  }

  /* ------------------------------------------------------------------
     6 · LA FICHA DE UN EXPEDIENTE  (el punto B del encargo)
     ------------------------------------------------------------------ */
  function expedientePorId(id) {
    var l = leerLosDatos();
    if (l.fallo) return null;
    var out = null;
    l.expedientes.forEach(function (e) {
      var k = String((e && (e.expediente_id || e.id)) || "");
      if (k === String(id)) out = e;
    });
    return out;
  }

  /* El plazo de un papel: se busca entre los plazos que ya calculó el
     repaso. Aquí no se calcula ninguno nuevo. */
  function plazoDelPapel(u, d) {
    if (!u || !u.plazos) return null;
    var n = sinTildes(d.cual);
    var mejor = null;
    u.plazos.forEach(function (p) {
      var q = sinTildes(p.que);
      /* «que» viene como «el certificado energético»: se compara por la
         parte con letras, sin el artículo. */
      var limpio = q.replace(/^(el|la|los|las)\s+/, "");
      if (n.indexOf(limpio) >= 0 || limpio.indexOf(n) >= 0 ||
          (/notaria/.test(n) && /notaria/.test(q))) {
        if (!mejor || p.dias < mejor.dias) mejor = p;
      }
    });
    return mejor;
  }

  function abrirExpediente(id) {
    var ficha = $("mesa_ficha"), lista = $("mesa_lista");
    if (!ficha) return false;
    var e = expedientePorId(id);

    vaciar(ficha);
    ficha.style.display = "";
    if (lista) lista.style.display = "none";
    E.abierto = e ? String(id) : null;

    var volver = crear("button", "mesa_volver", "Volver a tu mesa");
    volver.setAttribute("type", "button");
    volver.setAttribute("id", "mesa_boton_volver");
    volver.addEventListener("click", volverALaMesa);
    ficha.appendChild(volver);

    if (!e) {
      /* EXPEDIENTE QUE NO EXISTE: se dice y se puede volver. No se
         deja la pantalla en blanco ni se pinta una ficha vacía como si
         fuera un expediente de verdad. */
      var m = crear("div", "mesa_roto");
      m.setAttribute("id", "mesa_ficha_error");
      m.textContent = "No tengo ningún expediente con el número «" + String(id) +
        "». No te enseño una ficha vacía: te digo que no está.";
      ficha.appendChild(m);
      try { raiz.scrollTo(0, 0); } catch (err) {}
      return false;
    }

    var R = raiz ? raiz.IMMOIA_REPASO : null;
    var u = null;
    if (R && typeof R.mirarUno === "function") {
      try { u = R.mirarUno(e, E.hoy || hoyDelSistema()); } catch (err) { u = null; }
    }

    var f = faseDe(e, E.hoy);
    ficha.appendChild(crear("div", "ficha_que", e.tipo_operacion || "no dice si es venta o alquiler"));
    var h = crear("h2", "ficha_donde",
      (e.vivienda && e.vivienda.direccion_literal) || e.nombre || "(sin dirección en el expediente)");
    ficha.appendChild(h);
    ficha.appendChild(crear("div", "ficha_id", "Expediente " + String(e.expediente_id || e.id || "sin número")));

    if (e.propietario && e.propietario.nombre) {
      ficha.appendChild(crear("div", "ficha_quien",
        e.propietario.nombre + (e.propietario.documento ? " · " + e.propietario.documento : "")));
    } else {
      ficha.appendChild(crear("div", "ficha_nolose", "El expediente no dice de quién es."));
    }

    var fa = crear("div", "ficha_fase");
    fa.appendChild(crear("span", "fase_etiqueta", f.fase));
    if (f.detalle) fa.appendChild(document.createTextNode(" · " + f.detalle));
    ficha.appendChild(fa);
    if (f.porque) ficha.appendChild(crear("div", "exp_porque_mesa", "Lo dice: " + f.porque));

    /* ---------- los papeles, uno a uno ---------- */
    ficha.appendChild(crear("h3", null, "Sus papeles"));
    var docs = (e.documentos || []).filter(function (d) { return d && d.cual; });
    if (!docs.length) {
      var v = crear("div", "mesa_vacio");
      v.setAttribute("id", "ficha_sin_papeles");
      v.textContent = "Este expediente no tiene ni un papel apuntado. No es que estén todos bien: " +
                      "es que no hay ninguno.";
      ficha.appendChild(v);
    } else {
      var tabla = crear("div", "papeles");
      tabla.setAttribute("id", "ficha_papeles");
      docs.forEach(function (d) {
        var ce = comoEsta(d);
        var fila = crear("div", "papel " + (ce.esta ? "papel_esta" : "papel_no"));
        fila.setAttribute("data-estado", ce.texto);

        var cab = crear("div", "papel_cab");
        /* «TODAVÍA NO» en vez de «NO ESTÁ» cuando el papel tiene día
           puesto y ese día no ha llegado (21/09/2026). Poner «NO ESTÁ»
           en rojo a una cita de notaría que ella acaba de confirmar
           asusta sin motivo y se contradice con el renglón de al lado,
           que dice «confirmada para el 3 de octubre de 2027». */
        cab.appendChild(crear("span", "papel_marca " + ce.clase,
          ce.esta ? "ESTÁ" : confirmado(d) ? "TODAVÍA NO" : "NO ESTÁ"));
        cab.appendChild(crear("span", "papel_estado " + ce.clase, ce.texto));
        fila.appendChild(cab);

        fila.appendChild(crear("div", "papel_cual", d.cual));
        if (d.literal_en_OT25) fila.appendChild(crear("div", "papel_literal", d.literal_en_OT25));

        /* la fecha del papel */
        if (d.fecha == null || d.fecha === "") {
          fila.appendChild(crear("div", "papel_fecha_no", "Sin fecha en el expediente."));
        } else if (!fechaDeVerdad(d.fecha)) {
          fila.appendChild(crear("div", "papel_fecha_mala",
            "La fecha que pone («" + String(d.fecha) + "») no existe en el calendario. " +
            "No la corrijo yo: hay que mirarla."));
        } else {
          fila.appendChild(crear("div", "papel_fecha", "Fecha del papel: " + enCristiano(d.fecha)));
        }

        /* el plazo, si el repaso calculó uno para este papel */
        var p = plazoDelPapel(u, d);
        if (p) {
          fila.appendChild(crear("div", "papel_plazo " + (p.dias < 0 ? "plazo_pasado" : p.dias <= 7 ? "plazo_cerca" : ""),
            "Plazo: " + enCristiano(p.fecha) +
            (p.dias < 0 ? " · ya se pasó, hace " + (-p.dias) + " día" + (-p.dias === 1 ? "" : "s")
                        : p.dias === 0 ? " · es hoy"
                        : " · dentro de " + p.dias + " día" + (p.dias === 1 ? "" : "s"))));
        } else {
          fila.appendChild(crear("div", "papel_plazo_no",
            "Sin plazo: de este papel no hay ninguna vigencia comprobada en la tabla, " +
            "y una fecha que no puedo defender no te la pongo."));
        }
        tabla.appendChild(fila);
      });
      ficha.appendChild(tabla);
    }

    /* ---------- lo que la tabla pide y aquí no aparece ---------- */
    ficha.appendChild(crear("h3", null, "Lo que no está"));
    if (!u) {
      ficha.appendChild(crear("div", "mesa_roto",
        "No he podido repasar este expediente, así que no te digo qué le falta."));
    } else if (!(u.faltan || []).length) {
      ficha.appendChild(crear("div", "mesa_vacio",
        "No le falta ninguno de los papeles que la tabla pide para esta operación."));
    } else {
      var ul = crear("ul", "ficha_faltan");
      ul.setAttribute("id", "ficha_faltan");
      u.faltan.forEach(function (x) {
        ul.appendChild(crear("li", null, x.cual + (x.duro ? " (lo dice tu propio expediente)" : " (lo pide la tabla de OT-25)")));
      });
      ficha.appendChild(ul);
    }

    /* ---------- lo que le corre a este expediente ---------- */
    ficha.appendChild(crear("h3", null, "Lo que le corre"));
    var suyos = (u && u.hallazgos) ? u.hallazgos.slice().sort(function (a, b) { return b.urgencia - a.urgencia; }) : [];
    if (!suyos.length) {
      ficha.appendChild(crear("div", "mesa_vacio", "A este expediente no le corre nada hoy."));
    } else {
      suyos.forEach(function (x) { ficha.appendChild(unAviso(x, E.hoy || hoyDelSistema(), false)); });
    }

    /* ---------- redactar (taller RD) ---------- */
    ficha.appendChild(crear("h3", null, "Redactar"));
    var hrf = crear("div", "mesa_redactar_hueco");
    hrf.setAttribute("id", "ficha_redactar");
    ficha.appendChild(botonRedactar(e, hrf));
    ficha.appendChild(hrf);

    var volver2 = crear("button", "mesa_volver", "Volver a tu mesa");
    volver2.setAttribute("type", "button");
    volver2.addEventListener("click", volverALaMesa);
    ficha.appendChild(volver2);

    try { raiz.scrollTo(0, 0); } catch (err) {}
    return true;
  }

  function volverALaMesa() {
    var ficha = $("mesa_ficha"), lista = $("mesa_lista");
    if (ficha) { ficha.style.display = "none"; vaciar(ficha); }
    if (lista) lista.style.display = "";
    E.abierto = null;
    try { raiz.scrollTo(0, 0); } catch (err) {}
    return true;
  }

  /* ------------------------------------------------------------------
     7 · LA PUERTA DE ENTRADA
     ------------------------------------------------------------------ */
  var API = {
    version: VERSION,
    pintar: pintar,
    abrirExpediente: abrirExpediente,
    volverALaMesa: volverALaMesa,
    estado: function () {
      return { pintada: E.pintada, hoy: E.hoy, abierto: E.abierto,
               problema: E.problema,
               cuantos: E.repaso ? E.repaso.cuantos : 0,
               hallazgos: E.repaso ? E.repaso.hallazgos.length : 0,
               parte: E.repaso ? E.repaso.parte.slice() : [],
               esta_semana: E.avisos_semana.filter(function (a) { return a.dias != null && a.dias >= 0 && a.dias <= 7; }).length };
    },
    /* para poder comprobar desde fuera que el repaso de la mesa es
       EXACTAMENTE el mismo que el del wow, con los mismos datos */
    elRepaso: function () { return E.repaso; },
    faseDe: faseDe,

    /* SÓLO PARA LA PRUEBA. Borra la mesa y la deja como si no se
       hubiera pintado nunca, para poder volver a pintarla con datos
       rotos a propósito y ver que aguanta. No lo llama nadie de la
       aplicación: si esto se borrara, la aplicación funcionaría igual. */
    _olvidar: function () {
      E.pintada = false; E.repaso = null; E.problema = null;
      E.abierto = null; E.avisos_semana = [];
      ["mesa_frena", "mesa_avisos", "mesa_semana", "mesa_expedientes", "mesa_ficha"].forEach(function (id) {
        vaciar($(id));
      });
      var f = $("mesa_ficha"), l = $("mesa_lista");
      if (f) f.style.display = "none";
      if (l) l.style.display = "";
      var p = $("mesa_pie"); if (p) p.textContent = "";
    }
  };

  if (raiz) raiz.LA_MESA = API;
  if (typeof module === "object" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : null);
