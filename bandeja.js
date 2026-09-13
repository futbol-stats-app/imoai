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

   13/9/2026 - v1.1. ARREGLO DEL AVISO QUE SE PERDIA. Antes, si la
   directora recargaba la pagina sin contestar, la peticion
   desaparecia hasta que cambiara un permiso o un dato: el paso ya
   constaba como "avisado" y el tope de dos avisos no se reiniciaba
   nunca. Ahora:
     - la peticion sin contestar se guarda abierta y se vuelve a
       pintar igual al recargar, sin contar como aviso nuevo;
     - "Si, hazlo" pasa esos pasos a EN MARCHA, y no se vuelven a
       preguntar ningun dia;
     - "Ahora no" los rechaza, como antes;
     - el tope de dos avisos al dia se reinicia al cambiar el dia.
   No se ha tocado motor.js: sus 640 combinaciones y la equivalencia
   con el Python siguen valiendo.

   13/9/2026 - v1.2. SE CONECTA LO QUE YA HABIA Y NO LLEGABA A USARSE.
   Nada nuevo: tres piezas que ya existian en el motor y que ninguna
   pagina llamaba, asi que estaban muertas.
     1. LA FICHA DEL EXPEDIENTE. motor.DATOS declara los seis datos
        que hacen falta (direccion, precio, comunidad, correo del
        administrador, fecha de firma, correo del cliente) y
        ponerDatos() ya sabia recibirlos, pero no habia donde
        escribirlos: el expediente estaba SIEMPRE vacio y por eso la
        autonomia se quedaba clavada en el 27 % para siempre.
     2. LAS GESTIONES A LA ESPERA. El motor ya tiene el paso
        "Reclamar cuando pasan los 7 dias" esperando la senal
        "comunidad_vencida", y nadie la encendia nunca. Ahora, cuando
        se aprueba una peticion que sale fuera, queda anotado a quien,
        por que, cuando y en que estado; el dia que vence el plazo la
        senal se enciende sola y el motor propone reclamar. Mientras
        tanto no da la lata: lo ensena en su sitio, sin avisos.
     3. EL PARTE DEL DIA. motor.parte_del_dia() existia y no se
        pintaba en ningun sitio, aunque la propia bandeja lo
        prometia ("van en el parte del dia").
   El correo se prepara entero y lo unico que hace la persona es
   pulsar Enviar: el envio automatico necesita un permiso de Google
   que todavia no esta dado.
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
  + ".ban-ya{flex:0 0 auto;font-size:13px;color:#1B4332;font-weight:600;padding:7px 0}"
  + ".ban-ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:9px;margin:0 0 6px}"
  + ".ban-ficha label{display:block;font-size:12.5px;color:var(--tinta-2,#635C4B);margin:0 0 3px}"
  + ".ban-ficha input{width:100%;box-sizing:border-box;padding:7px 9px;font:inherit;font-size:14px;"
  + "border:1px solid var(--linea,#D8D1BE);border-radius:8px;background:#fff;color:inherit}"
  + ".ban-ficha input:focus{outline:2px solid var(--marca,#13342A);outline-offset:-1px}"
  + ".ban-esp{border:1px solid #D8D1BE;border-radius:10px;padding:10px 12px;margin:0 0 10px;background:#FAF8F2}"
  + ".ban-esp b{display:block;font-size:14.5px;color:var(--marca,#13342A)}"
  + ".ban-esp small{display:block;font-size:12.5px;color:var(--tinta-2,#635C4B);margin-top:2px}"
  + ".ban-esp .ban-acc{margin-top:7px}"
  + ".ban-esp button{padding:6px 12px;font:inherit;font-size:13px;font-weight:600;border:0;border-radius:7px;"
  + "cursor:pointer;margin-right:6px;background:#EEE9DE;color:#5B4646}"
  + ".ban-esp button.ban-si{background:var(--marca,#13342A);color:#fff}"
  + ".ban-tarde{border-color:#E3BFA0;background:#FBEDE4}"
  + ".ban-parte{border-top:1px solid #F0ECE1;margin-top:12px;padding-top:10px;font-size:13.5px;color:var(--tinta-2,#635C4B)}";

  /* ---------- lo que se guarda ---------- */
  function hoy() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function enBlanco() {
    return { llaves: [], expediente: { nombre: "el expediente", hechos: [], avisados: [],
             en_marcha: [], rechazados: [], senales: [], datos: [], diario: [], avisos_hoy: 0,
             aviso_abierto: null, abiertos: [], dia: hoy() },
             ficha: {}, gestiones: [] };
  }
  function leer() {
    try {
      var g = JSON.parse(localStorage.getItem(LLAVE_GUARDADO));
      if (g && g.expediente) {
        var e = g.expediente;
        /* los ficheros guardados antes del 13/9 no traen estos campos */
        if (!e.en_marcha) e.en_marcha = [];
        if (!e.abiertos) e.abiertos = [];
        if (!g.ficha) g.ficha = {};
        if (!g.gestiones) g.gestiones = [];
        if (typeof e.aviso_abierto === "undefined") e.aviso_abierto = null;
        /* dia nuevo: el tope de avisos se reinicia y lo avisado ayer
           puede volver a preguntarse. Lo aprobado (en_marcha) y lo
           rechazado NO se tocan. */
        if (e.dia !== hoy()) { e.dia = hoy(); e.avisados = []; e.avisos_hoy = 0; }
        return g;
      }
    }
    catch (e) {}
    return enBlanco();
  }
  function guardar(g) { try { localStorage.setItem(LLAVE_GUARDADO, JSON.stringify(g)); } catch (e) {} }

  var G = enBlanco();

  function aExpediente() {
    var e = new M.Expediente(G.expediente.nombre);
    e.hechos = new Set(G.expediente.hechos);
    e.avisados = new Set(G.expediente.avisados);
    e.en_marcha = new Set(G.expediente.en_marcha || []);
    e.rechazados = new Set(G.expediente.rechazados);
    e.senales = new Set(G.expediente.senales);
    e.datos = new Set(G.expediente.datos);
    e.diario = G.expediente.diario.slice();
    e.avisos_hoy = G.expediente.avisos_hoy || 0;
    return e;
  }
  function deExpediente(e) {
    var antes = G.expediente;
    G.expediente = { nombre: e.nombre, hechos: Array.from(e.hechos), avisados: Array.from(e.avisados),
      en_marcha: Array.from(e.en_marcha), rechazados: Array.from(e.rechazados),
      senales: Array.from(e.senales), datos: Array.from(e.datos),
      diario: e.diario.slice(), avisos_hoy: e.avisos_hoy,
      aviso_abierto: antes.aviso_abierto || null, abiertos: (antes.abiertos || []).slice(),
      dia: antes.dia || hoy() };
  }
  /* ---------- LAS GESTIONES QUE SALEN FUERA ----------
     Un paso del guion del motor que no se queda en casa: se le pide
     algo a alguien y hay que esperar. Cada uno trae a quien se le
     pide, por que, el plazo que da la ley y la senal que el motor ya
     esperaba para proponer la reclamacion. */
  var SALIDAS = {
    pedir_comunidad: {
      organismo: "el administrador de fincas",
      motivo: "el certificado de estar al corriente con la comunidad",
      dato_correo: "correo_admin",
      dias: 7,
      plazo_porque: "La Ley de Propiedad Horizontal (art. 9.1.e) le da 7 dias.",
      senal: "comunidad_vencida",
      asunto: "Certificado de deudas con la comunidad",
      cuerpo: "Buenos dias:\n\nLe escribo en nombre de la propiedad para pedirle el "
            + "certificado de estar al corriente en el pago de los gastos de la comunidad, "
            + "que hace falta para la venta de la vivienda.\n\nSegun el articulo 9.1.e de la "
            + "Ley de Propiedad Horizontal, el certificado debe emitirse en un plazo de siete "
            + "dias desde esta peticion.\n\nSi necesita algun dato mas, digamelo y se lo "
            + "mando en el momento.\n\nMuchas gracias.\n"
    },
    energetico: {
      organismo: "el tecnico certificador",
      motivo: "el certificado de eficiencia energetica",
      dato_correo: null,
      dias: 10,
      plazo_porque: "No hay plazo legal: 10 dias es lo que se tarda de normal.",
      senal: null,
      asunto: "Certificado de eficiencia energetica de una vivienda",
      cuerpo: "Buenos dias:\n\nNecesitamos el certificado de eficiencia energetica de una "
            + "vivienda que sale a la venta. Le paso los datos y, si nos dice disponibilidad y "
            + "precio, cerramos la visita.\n\nMuchas gracias.\n"
    },
    docu_notario: {
      organismo: "la notaria",
      motivo: "la documentacion para la firma",
      dato_correo: null,
      dias: 3,
      plazo_porque: "La notaria pide la documentacion con dias de antelacion.",
      senal: null,
      asunto: "Documentacion para la firma",
      cuerpo: "Buenos dias:\n\nLes mando la documentacion de la operacion para la firma "
            + "prevista. Quedamos atentos a lo que falte.\n\nMuchas gracias.\n"
    }
  };

  function hoyISO() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function masDias(iso, n) {
    var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function enCristiano(iso) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return iso || "";
    var meses = ["enero","febrero","marzo","abril","mayo","junio","julio",
                 "agosto","septiembre","octubre","noviembre","diciembre"];
    return Number(p[2]) + " de " + meses[Number(p[1]) - 1];
  }
  function diasHasta(iso) {
    var a = new Date(hoyISO() + "T12:00:00"), b = new Date(iso + "T12:00:00");
    return Math.round((b - a) / 86400000);
  }

  /* La gestion nace PREPARADA, no "esperando": el correo esta escrito
     entero, pero mientras no exista la conexion con el buzon de la
     agencia quien lo manda es una persona, y el plazo de la ley no
     empieza a correr hasta que sale. Decir "hecho" antes de eso seria
     mentir, y al dia siguiente nadie sabria si se mando o no. */
  function abrirGestion(paso) {
    var s = SALIDAS[paso]; if (!s) return;
    if (G.gestiones.some(function (x) { return x.paso === paso && x.estado !== "cerrada"; })) return;
    G.gestiones.push({
      paso: paso, organismo: s.organismo, motivo: s.motivo,
      preparada: hoyISO(), desde: null, vence: null,
      plazo_porque: s.plazo_porque, estado: "preparada", reclamada: null,
      correo: (s.dato_correo && G.ficha[s.dato_correo]) || ""
    });
  }

  /* Toda salida que el motor haya dado por hecha tiene su gestion: da
     igual que la hiciera sola o que se aprobara a mano. */
  function abrirLasQueTocan() {
    Object.keys(SALIDAS).forEach(function (paso) {
      if (G.expediente.hechos.indexOf(paso) !== -1) abrirGestion(paso);
      if (G.expediente.en_marcha.indexOf(paso) !== -1) abrirGestion(paso);
    });
  }

  /* El dia que vence el plazo se enciende la senal QUE EL MOTOR YA
     ESPERABA, y es el motor -no la pantalla- quien decide proponer la
     reclamacion. Aqui no se decide nada. */
  function revisarGestiones() {
    var cambio = false;
    G.gestiones.forEach(function (g) {
      if (g.estado !== "esperando" || !g.vence) return;
      if (diasHasta(g.vence) > 0) return;
      g.estado = "vencida";
      var s = SALIDAS[g.paso];
      if (s && s.senal && G.expediente.senales.indexOf(s.senal) === -1) {
        G.expediente.senales.push(s.senal);
        /* lo vencido vuelve a poder preguntarse: ya no es el mismo caso */
        G.expediente.avisados = G.expediente.avisados.filter(function (x) { return x !== g.paso; });
      }
      cambio = true;
    });
    return cambio;
  }

  function correoDe(paso) {
    var s = SALIDAS[paso]; if (!s) return null;
    var g = G.gestiones.filter(function (x) { return x.paso === paso; }).pop();
    var para = (g && g.correo) || (s.dato_correo ? (G.ficha[s.dato_correo] || "") : "");
    var cuerpo = s.cuerpo;
    if (G.ficha.direccion) cuerpo = cuerpo.replace("\n\nMuchas gracias.",
      "\n\nLa vivienda es: " + G.ficha.direccion + ".\n\nMuchas gracias.");
    return { para: para, asunto: s.asunto, cuerpo: cuerpo,
             url: "mailto:" + encodeURIComponent(para) + "?subject=" + encodeURIComponent(s.asunto)
                  + "&body=" + encodeURIComponent(cuerpo) };
  }

  /* ---------- el calculo ---------- */
  var ultimo = null;

  function calcular() {
    revisarGestiones();
    var tengo = new Set(G.llaves);
    var datos = new Set(G.expediente.datos);
    var exp = aExpediente();
    var antes_de_avisar = Array.from(exp.avisados);
    var r = M.adelantarse(exp, tengo);
    deExpediente(exp);
    abrirLasQueTocan();

    /* EL ARREGLO: una peticion sin contestar no se pierde al recargar.
       Si el motor ha sacado un aviso nuevo, se guarda abierto junto con
       los pasos que lo motivaron. Si no ha sacado ninguno pero quedaba
       uno abierto, se vuelve a pintar el mismo — sin gastar otro aviso
       del tope del dia. */
    if (r.aviso) {
      G.expediente.aviso_abierto = r.aviso;
      G.expediente.abiertos = G.expediente.avisados.filter(function (p) {
        return antes_de_avisar.indexOf(p) === -1;
      });
    } else if (G.expediente.aviso_abierto) {
      r.aviso = G.expediente.aviso_abierto;
      r.callado = 0;
    }
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
      parte: M.parte_del_dia(exp),
      gestiones: G.gestiones.slice(),
      ficha: JSON.parse(JSON.stringify(G.ficha)),
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
    G.expediente.aviso_abierto = null;
    G.expediente.abiertos = [];
    guardar(G);
    calcular(); pintar();
  }
  function retirar(llave) {
    G.llaves = G.llaves.filter(function (k) { return k !== llave; });
    guardar(G); calcular(); pintar();
  }
  function decirQueSi() {
    /* lo aprobado pasa a EN MARCHA: no se vuelve a preguntar ningun dia,
       ni aunque se recargue o cambie la fecha */
    var abiertos = G.expediente.abiertos && G.expediente.abiertos.length
      ? G.expediente.abiertos : G.expediente.avisados;
    abiertos.forEach(function (p) {
      if (G.expediente.en_marcha.indexOf(p) === -1) G.expediente.en_marcha.push(p);
      abrirGestion(p);
    });
    G.expediente.avisos_hoy = 0;
    G.expediente.aviso_abierto = null;
    G.expediente.abiertos = [];
    guardar(G); calcular(); pintar();
  }
  function decirQueNo() {
    var abiertos = G.expediente.abiertos && G.expediente.abiertos.length
      ? G.expediente.abiertos : G.expediente.avisados;
    G.expediente.rechazados = G.expediente.rechazados.concat(
      abiertos.filter(function (p) { return G.expediente.rechazados.indexOf(p) === -1; }));
    G.expediente.avisos_hoy = 0;
    G.expediente.aviso_abierto = null;
    G.expediente.abiertos = [];
    guardar(G); calcular(); pintar();
  }
  function ponerDatos(lista) {
    G.expediente.datos = lista.slice();
    G.expediente.avisados = []; G.expediente.avisos_hoy = 0;
    G.expediente.aviso_abierto = null; G.expediente.abiertos = [];
    guardar(G); calcular(); pintar();
  }
  function empezarDeCero() { G = enBlanco(); guardar(G); calcular(); pintar(); }

  /* La ficha: se escribe una vez y no se vuelve a preguntar. Cada dato
     que entra apaga una pregunta del motor. */
  function ponerDato(cual, valor) {
    valor = String(valor == null ? "" : valor).trim();
    if (valor) G.ficha[cual] = valor; else delete G.ficha[cual];
    var lista = Object.keys(M.DATOS).filter(function (k) { return !!G.ficha[k]; });
    G.expediente.datos = lista;
    G.expediente.avisados = []; G.expediente.avisos_hoy = 0;
    G.expediente.aviso_abierto = null; G.expediente.abiertos = [];
    G.gestiones.forEach(function (g) {
      var s = SALIDAS[g.paso];
      if (s && s.dato_correo && G.ficha[s.dato_correo]) g.correo = G.ficha[s.dato_correo];
    });
    guardar(G); calcular();
  }
  /* El unico gesto que no puede hacer la maquina hoy: decir que ha
     salido. Desde aqui empieza a contar el plazo de la ley. */
  function gestionMandada(paso) {
    G.gestiones.forEach(function (g) {
      if (g.paso === paso && g.estado === "preparada") {
        var s = SALIDAS[paso];
        g.estado = "esperando"; g.desde = hoyISO();
        g.vence = masDias(hoyISO(), s ? s.dias : 7);
      }
    });
    guardar(G); calcular(); pintar();
  }
  function gestionLlegada(paso) {
    G.gestiones.forEach(function (g) {
      if (g.paso === paso && g.estado !== "cerrada") { g.estado = "cerrada"; g.cerrada = hoyISO(); }
    });
    if (G.expediente.hechos.indexOf(paso) === -1) G.expediente.hechos.push(paso);
    guardar(G); calcular(); pintar();
  }
  function gestionReclamada(paso) {
    G.gestiones.forEach(function (g) {
      if (g.paso === paso && g.estado !== "cerrada") {
        g.estado = "reclamada"; g.reclamada = hoyISO();
        var s = SALIDAS[paso];
        g.vence = masDias(hoyISO(), s ? s.dias : 7);
      }
    });
    guardar(G); calcular(); pintar();
  }
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

    /* LA FICHA. Seis datos, los que el motor declara. Se escriben una
       vez; cada uno que entra apaga una pregunta. No se vuelve a pedir
       lo que ya esta escrito. */
    var puestos = Object.keys(M.DATOS).filter(function (k) { return !!d.ficha[k]; }).length;
    var todos = Object.keys(M.DATOS).length;
    h += '<div class="ban-bloque"><h3>El expediente</h3>'
      + '<p class="sub">' + (puestos === todos
          ? 'Lo tengo todo. No te lo vuelvo a preguntar.'
          : 'Tengo ' + puestos + ' de ' + todos + '. Lo que escribas aqui no te lo vuelvo a preguntar.')
      + '</p><div class="ban-ficha">';
    Object.keys(M.DATOS).forEach(function (k) {
      h += '<div><label for="ban-f-' + k + '">' + esc(M.DATOS[k]) + '</label>'
        + '<input id="ban-f-' + k + '" data-dato="' + k + '" type="'
        + (/correo/.test(k) ? 'email' : 'text') + '" value="' + esc(d.ficha[k] || '') + '"></div>';
    });
    h += '</div></div>';

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

    /* A LA ESPERA. Aqui no hay avisos: esta puesto para que se vea de
       un vistazo a quien se le ha pedido que, cuando y que falta. */
    var vivas = d.gestiones.filter(function (g) { return g.estado !== "cerrada"; });
    var cerradas = d.gestiones.filter(function (g) { return g.estado === "cerrada"; });
    var listas = vivas.filter(function (g) { return g.estado === "preparada"; });
    var fuera  = vivas.filter(function (g) { return g.estado !== "preparada"; });

    if (listas.length) {
      h += '<div class="ban-bloque"><h3>Escrito y listo — solo falta mandarlo</h3>'
        + '<p class="sub">El correo va entero, con la norma que obliga a contestar. Lo unico que no puedo hacer yo todavia es darle a Enviar.</p>';
      listas.forEach(function (g) {
        h += '<div class="ban-esp">'
          + '<b>' + esc(g.motivo.charAt(0).toUpperCase() + g.motivo.slice(1)) + '</b>'
          + '<small>Para ' + esc(g.organismo)
          + (g.correo ? ' (' + esc(g.correo) + ')' : ' — falta su correo, ponlo arriba en el expediente') + '.</small>'
          + '<small>Escrito el ' + esc(enCristiano(g.preparada))
          + '. El plazo no empieza a contar hasta que salga.</small>'
          + '<div class="ban-acc">'
          + '<button class="ban-si" data-correo="' + g.paso + '">Ver el correo y mandarlo</button>'
          + '<button data-mandada="' + g.paso + '">Ya lo he mandado</button>'
          + '</div></div>';
      });
      h += '</div>';
    }

    if (fuera.length) {
      h += '<div class="ban-bloque"><h3>A la espera</h3>';
      fuera.forEach(function (g) {
        var quedan = diasHasta(g.vence);
        var tarde = g.estado === "vencida" || quedan < 0;
        var cuando = tarde
          ? 'Se le acabo el plazo el ' + enCristiano(g.vence) + '.'
          : (quedan === 0 ? 'Hoy se le acaba el plazo.' : 'Le quedan ' + quedan + ' dia(s): hasta el ' + enCristiano(g.vence) + '.');
        h += '<div class="ban-esp' + (tarde ? ' ban-tarde' : '') + '">'
          + '<b>' + esc(g.motivo.charAt(0).toUpperCase() + g.motivo.slice(1)) + '</b>'
          + '<small>Pedido a ' + esc(g.organismo) + ' el ' + esc(enCristiano(g.desde))
          + (g.reclamada ? ', reclamado el ' + esc(enCristiano(g.reclamada)) : '') + '.</small>'
          + '<small>' + esc(cuando) + ' ' + esc(g.plazo_porque) + '</small>'
          + '<small>Sin esto no se puede cerrar el expediente.</small>'
          + '<div class="ban-acc">'
          + '<button class="ban-si" data-llegada="' + g.paso + '">Ya ha llegado</button>'
          + (tarde ? '<button data-reclamar="' + g.paso + '">Reclamar otra vez</button>' : '')
          + '<button data-correo="' + g.paso + '">Ver el correo</button>'
          + '</div></div>';
      });
      h += '</div>';
    }
    if (cerradas.length) {
      h += '<div class="ban-bloque"><h3>Ya resuelto</h3><ul>'
        + cerradas.map(function (g) {
            return '<li>' + esc(g.motivo) + ' — ' + esc(g.organismo)
                 + ', contestado el ' + esc(enCristiano(g.cerrada || g.desde)) + '</li>'; }).join("")
        + '</ul></div>';
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

    /* EL PARTE DEL DIA. Lo escribe motor.parte_del_dia(), que existia
       desde el principio y no se pintaba en ningun sitio. */
    if (d.parte) h += '<p class="ban-parte">' + esc(d.parte) + '</p>';

    /* Al repintar se pierde el foco, y escribiendo en la ficha eso
       saca a la persona de donde estaba. Se guarda donde tenia el
       cursor y se le devuelve ahi. */
    var foco = document.activeElement;
    var idFoco = foco && foco.id && foco.id.indexOf("ban-f-") === 0 ? foco.id : null;
    var punto = idFoco && typeof foco.selectionStart === "number" ? foco.selectionStart : null;

    caja.innerHTML = h;

    if (idFoco) {
      var vuelve = document.getElementById(idFoco);
      if (vuelve) {
        try { vuelve.focus({ preventScroll: true }); } catch (e) { vuelve.focus(); }
        if (punto !== null) { try { vuelve.setSelectionRange(punto, punto); } catch (e) {} }
      }
    }
    var si = document.getElementById("ban-si"); if (si) si.addEventListener("click", decirQueSi);
    var no = document.getElementById("ban-no"); if (no) no.addEventListener("click", decirQueNo);
    caja.querySelectorAll("[data-dar]").forEach(function (b) {
      b.addEventListener("click", function () { autorizar(b.getAttribute("data-dar")); });
    });
    caja.querySelectorAll("[data-quitar]").forEach(function (b) {
      b.addEventListener("click", function () { retirar(b.getAttribute("data-quitar")); });
    });
    /* La ficha se guarda al salir del campo: ni boton ni "guardar
       cambios". Se repinta solo si el dato cambia algo. */
    caja.querySelectorAll("[data-dato]").forEach(function (c) {
      c.addEventListener("change", function () {
        ponerDato(c.getAttribute("data-dato"), c.value);
        pintar();
      });
    });
    caja.querySelectorAll("[data-llegada]").forEach(function (b) {
      b.addEventListener("click", function () { gestionLlegada(b.getAttribute("data-llegada")); });
    });
    caja.querySelectorAll("[data-mandada]").forEach(function (b) {
      b.addEventListener("click", function () { gestionMandada(b.getAttribute("data-mandada")); });
    });
    caja.querySelectorAll("[data-reclamar]").forEach(function (b) {
      b.addEventListener("click", function () { gestionReclamada(b.getAttribute("data-reclamar")); });
    });
    /* El correo va escrito entero. Lo unico que hace la persona es
       mirarlo y pulsar Enviar en su propio correo. */
    caja.querySelectorAll("[data-correo]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = correoDe(b.getAttribute("data-correo"));
        if (!c) return;
        var caj = document.createElement("div");
        caj.className = "ban-esp";
        caj.innerHTML = '<b>El correo, ya escrito</b>'
          + '<small>Para: ' + esc(c.para || "(falta el correo: ponlo arriba en el expediente)") + '</small>'
          + '<small>Asunto: ' + esc(c.asunto) + '</small>'
          + '<small style="white-space:pre-wrap;margin-top:6px">' + esc(c.cuerpo) + '</small>'
          + '<div class="ban-acc"><a class="ban-si" style="display:inline-block;padding:6px 12px;'
          + 'border-radius:7px;background:#13342A;color:#fff;text-decoration:none;font-size:13px;'
          + 'font-weight:600" href="' + c.url + '">Abrirlo en mi correo</a></div>';
        b.parentNode.parentNode.appendChild(caj);
        b.disabled = true;
      });
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
    if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("bandeja:montada", { version: "1.2" });
  }

  window.IMMOIA_BANDEJA = {
    version: "1.2",
    estado: function () { return ultimo || calcular(); },
    autorizar: autorizar, retirar: retirar,
    ponerDatos: ponerDatos, ponerDato: ponerDato,
    gestiones: function () { return G.gestiones.slice(); },
    gestionMandada: gestionMandada,
    gestionLlegada: gestionLlegada, gestionReclamada: gestionReclamada,
    correoDe: correoDe, SALIDAS: SALIDAS,
    decirQueSi: decirQueSi, decirQueNo: decirQueNo,
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
