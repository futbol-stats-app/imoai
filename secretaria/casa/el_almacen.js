/* ==================================================================
   el_almacen.js · DONDE SE GUARDAN SUS EXPEDIENTES  (PESTAÑA 6)

   Lo que ella mete a mano en su mesa: sus casas, sus papeles, sus
   fechas y sus notas. Todo se guarda EN ESTE ORDENADOR, en el propio
   navegador (localStorage). No sale ni un byte a internet: aquí no hay
   ni un fetch, ni un XHR, ni un WebSocket, ni una dirección escrita.

   POR QUÉ AQUÍ Y NO EN OTRO SITIO (el informe lo explica entero):
     · localStorage funciona igual abriendo con doble clic (file://)
       que servido desde este ordenador, y es síncrono: cuando la
       función vuelve, o está guardado o ha dado un error que se ve.
     · Cabe de sobra: 1.000 expedientes con papeles y notas ocupan
       ~1,5 MB y el navegador da 5 MB.

   LAS CUATRO PROMESAS DE ESTE FICHERO:
     1. NADA SE PIERDE EN SILENCIO. Si guardar falla, el cambio NO se
        hace, la pantalla se queda como estaba y se dice con letras
        rojas. Nunca se enseña como hecho algo que no está guardado.
     2. DOS VENTANAS NO SE PISAN. Cada cambio se hace sobre lo que hay
        guardado EN ESE MOMENTO, no sobre lo que había cuando se abrió
        la ventana. Si la otra ventana metió una casa, sigue ahí.
     3. TODO SE PUEDE DESHACER. Cada cambio guarda cómo estaba antes el
        expediente que toca. «Deshacer» lo devuelve tal cual.
     4. LO DE EJEMPLO NO SE TOCA. Los cuatro expedientes inventados de
        casa\los_expedientes.js se enseñan igual que antes y no se
        pueden cambiar. Lo suyo va aparte y se pinta junto.

   Las fechas de lo suyo son FECHAS DE CALENDARIO (2026-09-25), no
   distancias a hoy: la cita de notaría que ella apunta es un día
   concreto. Las distancias (hace_dias, dentro_de_dias) son solo para
   que los ejemplos parezcan siempre de esta semana; aquí no hacen falta.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.0";
  var CLAVE = "immoia.secretaria.mis_expedientes.v1";
  var CLAVE_COPIA = CLAVE + ".copia_anterior";
  var MAX_DESHACER = 30;
  var LIMITE = { direccion: 200, nombre: 120, nota: 2000, papel: 160, que: 120 };

  /* ------------------------------------------------------------------
     0 · UTILIDADES
     ------------------------------------------------------------------ */
  function sinTildes(s) {
    var t = String(s == null ? "" : s).toLowerCase();
    return t.normalize ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : t;
  }
  function paraComparar(s) {
    return sinTildes(s).replace(/[^a-z0-9ñ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function dd(n) { return (n < 10 ? "0" : "") + n; }
  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + "-" + dd(d.getMonth() + 1) + "-" + dd(d.getDate());
  }
  function ahoraISO() { return new Date().toISOString(); }
  function fechaDeVerdad(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s == null ? "" : s))) return false;
    var p = String(s).split("-");
    var y = +p[0], m = +p[1], d = +p[2];
    if (y < 1900 || y > 2100) return false;
    var f = new Date(Date.UTC(y, m - 1, d));
    return f.getUTCFullYear() === y && f.getUTCMonth() + 1 === m && f.getUTCDate() === d;
  }
  function copiar(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }

  /* ------------------------------------------------------------------
     LAS FECHAS, SIEMPRE CON EL MES EN LETRA  ·  ARREGLO DEL 21/09/2026
     ------------------------------------------------------------------
     En esta casa una fecha NO se escribe «03/10/2027». Ese renglón no
     dice si es el 3 de octubre o el 10 de marzo, y el miedo declarado
     de esta aplicación es justamente ése: confundir el día con el mes.
     Se escribe entera, con el mes en letra, y se acabó la duda.
     ------------------------------------------------------------------ */
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function enLetra(iso) {
    if (!fechaDeVerdad(iso)) return String(iso == null ? "" : iso);
    var p = String(iso).split("-");
    return (+p[2]) + " de " + MESES[+p[1] - 1] + " de " + p[0];
  }

  /* ¿Esa fecha todavía NO ha llegado? Se compara con el día del reloj
     de este ordenador, el mismo que mira el resto de la aplicación.
     Las fechas van en ISO (2027-10-03), así que comparar los textos
     ordena igual que comparar los días. */
  function esFutura(iso) {
    return fechaDeVerdad(iso) && String(iso) > hoyISO();
  }

  /* Texto que escribe una persona: se quitan los caracteres de control
     (los invisibles que llegan al pegar de otro programa) y los
     espacios de sobra. Las tildes, la ñ, la ü y los símbolos normales
     se quedan TAL CUAL. Nunca se pinta como HTML: siempre como texto. */
  /* caracteres de control e invisibles (se escriben con códigos para que
     no se cuelen tal cual en este fichero) */
  var INVISIBLES = "\\u007F\\u200B-\\u200F\\u2028\\u2029\\uFEFF";
  var RARO_UNA = new RegExp("[\\u0000-\\u001F" + INVISIBLES + "]", "g");
  var RARO_MULTI = new RegExp("[\\u0000-\\u0009\\u000B-\\u001F" + INVISIBLES + "]", "g");
  function limpiarTexto(s, multilinea) {
    var t = String(s == null ? "" : s);
    t = t.replace(multilinea ? RARO_MULTI : RARO_UNA, multilinea ? "" : " ");
    t = t.normalize ? t.normalize("NFC") : t;
    return multilinea ? t.replace(/[ \t]+/g, " ").trim() : t.replace(/\s+/g, " ").trim();
  }

  /* ------------------------------------------------------------------
     1 · LEER Y ESCRIBIR EN EL DISCO DEL NAVEGADOR
     ------------------------------------------------------------------ */
  var AVISOS = [];          /* quien pinte, que se suscriba */
  function avisar(tipo, texto) {
    AVISOS.slice().forEach(function (f) { try { f(tipo, texto); } catch (e) {} });
  }

  function vacio() {
    return { formato: "immoia.mis_expedientes", version: 1, rev: 0, guardado: null,
             expedientes: [], archivados: [], deshacer: [], preferencias: {} };
  }

  function almacenDisponible() {
    try {
      var s = raiz.localStorage;
      if (!s) return { ok: false, porque: "Este navegador no me deja guardar nada en este ordenador." };
      var k = CLAVE + ".prueba";
      s.setItem(k, "1"); s.removeItem(k);
      return { ok: true };
    } catch (e) {
      return { ok: false, porque: "Este navegador tiene bloqueado guardar en este ordenador (" +
               (e && e.name ? e.name : "error") + "). Suele pasar en ventanas privadas o con las cookies bloqueadas." };
    }
  }

  function bienFormado(x) {
    return x && typeof x === "object" && x.formato === "immoia.mis_expedientes" &&
           Object.prototype.toString.call(x.expedientes) === "[object Array]" &&
           Object.prototype.toString.call(x.archivados) === "[object Array]";
  }

  /* Lee lo guardado. Si lo principal está roto, prueba la copia
     anterior. Si las dos están rotas NO escribe nada encima: se queda
     en solo-lectura y lo dice, para que no se machaque lo que haya. */
  function leer() {
    var s, crudo, copia;
    try { s = raiz.localStorage; crudo = s.getItem(CLAVE); copia = s.getItem(CLAVE_COPIA); }
    catch (e) { return { estado: vacio(), roto: "No puedo leer lo guardado: " + (e && e.message ? e.message : e) }; }
    if (crudo == null && copia == null) return { estado: vacio() };
    try {
      var x = JSON.parse(crudo);
      if (bienFormado(x)) { normalizar(x); return { estado: x }; }
    } catch (e) {}
    try {
      var y = JSON.parse(copia);
      if (bienFormado(y)) {
        normalizar(y);
        return { estado: y, recuperado: "Lo último que se guardó estaba dañado. He vuelto a la copia anterior " +
                 "(del " + (y.guardado ? y.guardado.slice(0, 16).replace("T", " a las ") : "momento anterior") + "). " +
                 "Si falta el último cambio, es por eso." };
      }
    } catch (e) {}
    return { estado: vacio(),
             roto: "Lo que tienes guardado está dañado y la copia también. NO escribo nada encima para no " +
                   "perderlo: descarga una copia (botón «Guardar una copia en un fichero») y avísanos." };
  }

  function normalizar(x) {
    x.deshacer = Object.prototype.toString.call(x.deshacer) === "[object Array]" ? x.deshacer : [];
    x.preferencias = x.preferencias && typeof x.preferencias === "object" ? x.preferencias : {};
    x.rev = typeof x.rev === "number" ? x.rev : 0;
  }

  function escribir(estado, crudoAnterior) {
    var s = raiz.localStorage;
    var nuevo = JSON.stringify(estado);
    /* primero la copia de lo que había, después lo nuevo: si lo nuevo
       falla a medias, la copia sigue siendo buena */
    if (crudoAnterior != null) s.setItem(CLAVE_COPIA, crudoAnterior);
    s.setItem(CLAVE, nuevo);
    /* y se lee de vuelta: si no es lo mismo, no se ha guardado */
    if (s.getItem(CLAVE) !== nuevo) throw new Error("lo que se ha guardado no coincide con lo que se mandó guardar");
    return nuevo.length;
  }

  /* ------------------------------------------------------------------
     2 · EL ESTADO EN MEMORIA Y LOS CAMBIOS
     ------------------------------------------------------------------ */
  var A = {
    disponible: null,         /* { ok, porque } */
    solo_lectura: null,       /* texto si no se puede escribir */
    estado: vacio(),
    ejemplos: null,           /* los de casa\los_expedientes.js, tal cual */
    ultimo_error: null
  };

  /* Todo cambio pasa por aquí. «hacer» recibe el estado FRESCO recién
     leído del disco (no el de la memoria: así no se pisa lo que haya
     hecho otra ventana), lo cambia y devuelve {ok, que, id, antes}.
     Si no se puede guardar, el estado en memoria NO cambia. */
  /* ------------------------------------------------------------------
     EL CONTADOR «rev»  ·  ARREGLO DEL 21/09/2026
     ------------------------------------------------------------------
     El fichero guardado lleva desde el principio un contador «rev» que
     sube de uno en uno con cada cambio. Estaba escrito y NO SE MIRABA.
     Por eso, con dos ventanas abiertas, pasaba esto:

        ventana A lee (rev 7)   ...   ventana B lee (rev 7)
        ventana A escribe (rev 8)
        ventana B escribe (rev 8)  <- encima, con su copia vieja
        las dos dicen «Hecho y guardado». En el disco queda UNA casa.

     Y el hermano del mismo fallo: si A borraba un expediente y B le
     escribía una nota con su copia vieja, el expediente borrado volvía.

     Ahora, justo ANTES de escribir, se vuelve a mirar el contador del
     disco. Si ya no es el que se leyó, es que otra ventana ha guardado
     en medio: NO se escribe encima. Se vuelve a empezar sobre lo fresco
     (hasta MAX_INTENTOS veces), y si aun así no se puede, SE DICE.
     Nunca se pierde nada en silencio: silencio es la palabra prohibida
     de esta casa.
     ------------------------------------------------------------------ */
  var MAX_INTENTOS = 5;

  /* El contador que hay AHORA MISMO en el disco. Devuelve null si no se
     puede saber (y entonces no se usa para decidir: de eso ya se ocupa
     leer(), que dice cuándo lo guardado está roto). */
  function revEnElDisco() {
    var crudo;
    try { crudo = raiz.localStorage.getItem(CLAVE); } catch (e) { return null; }
    if (crudo == null) return 0;
    try {
      var x = JSON.parse(crudo);
      return x && typeof x.rev === "number" ? x.rev : 0;
    } catch (e) { return null; }
  }

  function cambiar(nombre, hacer) {
    if (!A.disponible || !A.disponible.ok) {
      return fallo(A.disponible ? A.disponible.porque : "No hay dónde guardar.");
    }
    if (A.solo_lectura) return fallo(A.solo_lectura);

    var choques = 0;
    for (var intento = 1; intento <= MAX_INTENTOS; intento++) {
      var crudoAnterior;
      try { crudoAnterior = raiz.localStorage.getItem(CLAVE); } catch (e) { return fallo("No puedo leer lo guardado: " + e.message); }
      var l = leer();
      if (l.roto) { A.solo_lectura = l.roto; return fallo(l.roto); }
      var fresco = l.estado;
      var revLeida = fresco.rev;      /* con este número estaba el disco cuando lo leí */
      var r;
      try { r = hacer(fresco); } catch (e) { return fallo("No he podido hacer el cambio: " + (e && e.message ? e.message : e)); }
      if (!r || !r.ok) return r || fallo("No se ha hecho nada.");
      if (!r.sin_deshacer) {
        fresco.deshacer.push({ que: r.que, id: r.id, antes: r.antes, lugar_antes: r.lugar_antes || null,
                               cuando: ahoraISO(), rev: revLeida + 1 });
        if (fresco.deshacer.length > MAX_DESHACER) fresco.deshacer = fresco.deshacer.slice(-MAX_DESHACER);
      }
      fresco.rev = revLeida + 1;
      fresco.guardado = ahoraISO();

      /* AQUÍ SE MIRA EL CONTADOR, JUSTO ANTES DE ESCRIBIR. */
      var revAhora = revEnElDisco();
      if (revAhora !== null && revAhora !== revLeida) {
        choques++;
        continue;                     /* otra ventana ha guardado: se rehace sobre lo fresco */
      }

      try {
        escribir(fresco, crudoAnterior);
      } catch (e) {
        /* EL CAMBIO NO SE HA HECHO. Se deja todo como estaba, en memoria
           y en disco, y se dice. */
        try { if (crudoAnterior != null) raiz.localStorage.setItem(CLAVE, crudoAnterior); } catch (e2) {}
        var lleno = e && (e.name === "QuotaExceededError" || e.code === 22 || /quota/i.test(e.message || ""));
        var txt = lleno
          ? "NO SE HA GUARDADO «" + nombre + "»: el espacio de este navegador para guardar está lleno. " +
            "Todo lo que ya tenías sigue guardado y no se ha perdido nada; este último cambio no está hecho. " +
            "Archiva expedientes cerrados o guarda una copia en un fichero para hacer sitio."
          : "NO SE HA GUARDADO «" + nombre + "»: " + (e && e.message ? e.message : e) + ". " +
            "Lo que ya tenías sigue igual; este último cambio no está hecho.";
        return fallo(txt);
      }

      /* Y DESPUÉS DE ESCRIBIR se vuelve a mirar: si lo que hay en el
         disco ya no es lo nuestro, es que otra ventana ha escrito justo
         detrás. No se calla: se dice que hay que mirarlo. */
      var revDespues = revEnElDisco();
      if (revDespues !== null && revDespues !== fresco.rev) {
        var l2 = leer();
        if (!l2.roto) { A.estado = l2.estado; juntar(); }
        return fallo("CUIDADO con «" + nombre + "»: otra ventana ha guardado en el mismo instante y " +
                     "puede haber escrito encima. En esta pantalla ya tienes lo último que hay guardado: " +
                     "míralo antes de seguir, y si falta algo vuelve a hacerlo. Cierra las ventanas que " +
                     "no estés usando para que esto no vuelva a pasar.");
      }

      A.estado = fresco;
      A.ultimo_error = null;
      avisar("hecho", r.que);
      return { ok: true, que: r.que, id: r.id };
    }

    /* Cinco veces seguidas con otra ventana escribiendo en medio. */
    var l3 = leer();
    if (!l3.roto) { A.estado = l3.estado; juntar(); }
    return fallo("NO SE HA GUARDADO «" + nombre + "»: otra ventana de esta aplicación está guardando cosas " +
                 "en este mismo momento (" + choques + " veces seguidas) y no quiero escribir encima de lo suyo. " +
                 "Aquí ya tienes lo último que hay guardado. Cierra las demás ventanas y vuelve a hacerlo.");
  }
  function fallo(texto) {
    A.ultimo_error = texto;
    avisar("error", texto);
    return { ok: false, error: texto };
  }

  function buscar(estado, id) {
    for (var i = 0; i < estado.expedientes.length; i++) if (estado.expedientes[i].expediente_id === id) return { lista: "expedientes", i: i, e: estado.expedientes[i] };
    for (var j = 0; j < estado.archivados.length; j++) if (estado.archivados[j].expediente_id === id) return { lista: "archivados", i: j, e: estado.archivados[j] };
    return null;
  }

  function nuevoId(estado) {
    var base = "MIO-" + hoyISO().replace(/-/g, "");
    var n = 1, id;
    do { id = base + "-" + (n < 10 ? "00" : n < 100 ? "0" : "") + n; n++; } while (buscar(estado, id) || esDeEjemplo(id));
    return id;
  }
  function esDeEjemplo(id) {
    return (A.ejemplos || []).some(function (e) { return String(e && (e.expediente_id || e.id)) === String(id); });
  }

  /* Un cambio en un expediente suyo: se guarda cómo estaba antes, se
     aplica, y se apunta como último movimiento (el repaso lo usa para
     saber qué está parado). */
  function tocar(id, nombre, aplicar) {
    return cambiar(nombre, function (st) {
      if (esDeEjemplo(id)) return { ok: false, error: "Ese expediente es de ejemplo y no se cambia." };
      var b = buscar(st, id);
      if (!b) return { ok: false, error: "Ese expediente ya no está (quizá lo has borrado en otra ventana)." };
      var antes = copiar(b.e);
      var r = aplicar(b.e, st);
      if (r && r.ok === false) return r;
      b.e.ultimo_movimiento = { fecha: hoyISO(), que: nombre };
      b.e.cambiado = ahoraISO();
      return { ok: true, que: nombre, id: id, antes: antes, lugar_antes: b.lista };
    });
  }

  /* ------------------------------------------------------------------
     3 · LO QUE SE PUEDE HACER (cada cosa dice por qué no, si no puede)
     ------------------------------------------------------------------ */
  function validarDireccion(d) {
    var t = limpiarTexto(d);
    if (!t) return { error: "Falta la dirección. Con la calle y el número basta." };
    if (t.length > LIMITE.direccion) return { error: "La dirección es demasiado larga (" + t.length + " letras; como mucho " + LIMITE.direccion + "). ¿Se ha pegado algo de más?" };
    if (!/[a-zA-Z0-9À-ɏ]/.test(t)) return { error: "En la dirección no hay ni una letra ni un número. Escríbela otra vez." };
    return { ok: t };
  }
  function queOperacion(op) {
    var o = sinTildes(op);
    if (o === "venta" || o === "compraventa") return "venta";
    if (o === "alquiler") return "alquiler";
    return null;
  }

  function meterCasa(datos) {
    datos = datos || {};
    var v = validarDireccion(datos.direccion);
    if (v.error) return fallo(v.error);
    var op = queOperacion(datos.tipo_operacion);
    if (!op) return fallo("Dime si es una venta o un alquiler.");
    var quien = limpiarTexto(datos.propietario || "");
    if (quien.length > LIMITE.nombre) return fallo("El nombre es demasiado largo (como mucho " + LIMITE.nombre + " letras).");
    var dir = v.ok;
    return cambiar("meter " + dir, function (st) {
      var clave = paraComparar(dir) + "|" + op;
      var todos = st.expedientes.concat(st.archivados).concat(A.ejemplos || []);
      for (var i = 0; i < todos.length; i++) {
        var o = todos[i];
        var dO = (o.vivienda && (o.vivienda.via || o.vivienda.direccion_literal)) || o.nombre || "";
        if (paraComparar(dO) + "|" + queOperacion(o.tipo_operacion) === clave) {
          return { ok: false, error: "Ya tienes esa casa en " + (op === "venta" ? "venta" : "alquiler") + ": «" + dO + "»" +
                   (st.archivados.indexOf(o) >= 0 ? " (está archivada; la puedes recuperar)." : ".") +
                   " No la meto dos veces.", repetido: o.expediente_id };
        }
      }
      var id = nuevoId(st);
      var e = {
        expediente_id: id, es_mio: true, creado: ahoraISO(),
        nombre: dir,
        vivienda: { via: dir, direccion_literal: dir },
        propietario: quien ? { nombre: quien } : {},
        tipo_operacion: op,
        documentos: [], notas: [], fechas: [],
        ultimo_movimiento: { fecha: hoyISO(), que: "dado de alta en la mesa" }
      };
      st.expedientes.unshift(e);
      return { ok: true, que: "meter " + dir, id: id, antes: null, lugar_antes: null };
    });
  }

  /* ------------------------------------------------------------------
     LOS ESTADOS DE UN PAPEL  ·  ARREGLO DEL 21/09/2026
     ------------------------------------------------------------------
     Los cuatro de siempre son los que ella elige a mano. El quinto,
     «confirmado», NO se elige: lo pone la propia aplicación cuando la
     fecha del papel todavía no ha llegado.

     POR QUÉ. Antes, apuntar la cita de notaría del 3 de octubre de 2027
     guardaba el papel como «recibido» y escribía en pantalla:

         cita de notaría — recibido 03/10/2027 (lo apuntaste tú)

     Dos mentiras en un renglón: daba por celebrado un trámite del año
     que viene, y escribía la fecha en números. Y no pasaba sólo con la
     notaría: CUALQUIER papel se podía marcar como llegado con una fecha
     que todavía no ha llegado. Ahora no: si la fecha es posterior a hoy,
     el papel queda «confirmado para el 3 de octubre de 2027». Cuando
     llegue el día, ella le da a «Ha llegado hoy» y entonces sí.
     ------------------------------------------------------------------ */
  var ESTADOS = ["falta", "pedido", "recibido", "verificado"];
  var CONFIRMADO = "confirmado";                 /* lo pone la aplicación, no ella */
  var ESTADOS_VALIDOS = ESTADOS.concat([CONFIRMADO]);
  function validarFecha(f, obligatoria) {
    if (f == null || f === "") return obligatoria ? { error: "Falta la fecha." } : { ok: null };
    if (!fechaDeVerdad(f)) return { error: "La fecha «" + f + "» no existe en el calendario. Mírala otra vez." };
    return { ok: f };
  }

  function ponerPapel(id, cual, estado, fecha) {
    var c = limpiarTexto(cual);
    if (!c) return fallo("¿Qué papel? Falta el nombre del papel.");
    if (c.length > LIMITE.papel) return fallo("El nombre del papel es demasiado largo (como mucho " + LIMITE.papel + " letras).");
    var est = sinTildes(estado);
    if (ESTADOS_VALIDOS.indexOf(est) < 0) return fallo("Ese estado no lo entiendo: tiene que ser falta, pedido, recibido o verificado.");
    var vf = validarFecha(fecha, false);
    if (vf.error) return fallo(vf.error);

    /* LA REGLA, EN UNA LÍNEA: una fecha que todavía no ha llegado no
       puede decir que el papel ha llegado. Vale para TODOS los papeles,
       no sólo para la notaría. */
    var futura = esFutura(vf.ok);
    if (futura && (est === "recibido" || est === "verificado" || est === CONFIRMADO)) est = CONFIRMADO;
    else if (est === CONFIRMADO) est = "recibido";   /* ya llegó el día: es un papel normal */

    /* «confirmada la cita», pero «confirmado el certificado». Se mira
       la primera palabra del nombre del papel, que es de lo que se
       habla: si acaba en «a», va en femenino. Con los nombres que usa
       esta casa (cita, escritura, nota, fianza / contrato, certificado,
       DNI, recibos) sale bien siempre. */
    var femenino = /a$/.test(sinTildes(c).split(" ")[0] || "");
    var CONFIRMA = femenino ? "confirmada para el " : "confirmado para el ";
    var verbo = est === CONFIRMADO ? CONFIRMA + enLetra(vf.ok)
              : est === "recibido" || est === "verificado" ? "ha llegado"
              : est === "pedido" ? "pedido" : "falta";
    return tocar(id, c + ": " + verbo, function (e) {
      e.documentos = e.documentos || [];
      var n = paraComparar(c), d = null;
      for (var i = 0; i < e.documentos.length; i++) if (paraComparar(e.documentos[i].cual) === n) d = e.documentos[i];
      if (!d) { d = { cual: c }; e.documentos.push(d); }
      d.estado_documento = est;
      if (vf.ok) d.fecha = vf.ok; else if (est === "recibido" || est === "verificado") d.fecha = d.fecha || hoyISO();
      /* EL RENGLÓN QUE SE LEE EN PANTALLA. El mes, siempre en letra. */
      d.literal_en_OT25 = c + " — " +
        (est === CONFIRMADO ? CONFIRMA + enLetra(d.fecha)
                            : est + (d.fecha ? " el " + enLetra(d.fecha) : "")) +
        " (lo apuntaste tú)";
    });
  }
  function quitarPapel(id, cual) {
    var n = paraComparar(cual);
    return tocar(id, "quitar el papel «" + limpiarTexto(cual) + "»", function (e) {
      var antes = (e.documentos || []).length;
      e.documentos = (e.documentos || []).filter(function (d) { return paraComparar(d.cual) !== n; });
      if (e.documentos.length === antes) return { ok: false, error: "Ese papel no está en el expediente." };
    });
  }

  /* LA FASE. En esta mesa la fase NO es un campo que se escribe: sale
     de los papeles (mesa\la_mesa.js, faseDe). Así que «cambiar la fase»
     es apuntar el papel que la demuestra. Es más lento de explicar que
     de hacer: un botón, y queda el papel como prueba. */
  var FASES = {
    venta: [
      { clave: "arras", texto: "Arras firmadas", papel: "contrato de arras", pide_fecha: false },
      { clave: "notaria", texto: "Notaría con fecha", papel: "cita de notaría", pide_fecha: true },
      { clave: "escriturada", texto: "Escriturada (vendida)", papel: "escritura pública de compraventa", pide_fecha: false }
    ],
    alquiler: [
      { clave: "contrato", texto: "Contrato firmado", papel: "contrato de arrendamiento", pide_fecha: false },
      { clave: "fianza", texto: "Fianza depositada", papel: "depósito de la fianza", pide_fecha: false }
    ]
  };
  function cambiarFase(id, clave, fecha) {
    var b = buscar(A.estado, id);
    var op = b ? queOperacion(b.e.tipo_operacion) : null;
    var f = op ? (FASES[op] || []).filter(function (x) { return x.clave === clave; })[0] : null;
    if (!f) return fallo("Esa fase no existe para este expediente.");
    var vf = validarFecha(fecha, f.pide_fecha);
    if (vf.error) return fallo(f.pide_fecha && !fecha ? "Para «" + f.texto + "» hace falta la fecha." : vf.error);
    return ponerPapel(id, f.papel, "recibido", vf.ok || hoyISO());
  }

  function apuntarFecha(id, que, fecha) {
    var q = limpiarTexto(que);
    if (!q) return fallo("¿Qué es esa fecha? Escribe para qué es (por ejemplo, «llamar al administrador»).");
    if (q.length > LIMITE.que) return fallo("Demasiado largo (como mucho " + LIMITE.que + " letras).");
    var vf = validarFecha(fecha, true);
    if (vf.error) return fallo(vf.error);
    /* ------------------------------------------------------------------
       QUITADO EL 21/09/2026 · EL DESVÍO POR LA PALABRA «notari»
       ------------------------------------------------------------------
       Aquí había una línea que decía: si lo que ella escribe lleva
       dentro las letras «notari», esto no es una fecha, es el papel
       «cita de notaría» y se marca como recibido.

       Es la palabra más natural que va a teclear una directora de
       inmobiliaria, y el desvío la mordía siempre: «llamar a la
       notaría» apuntaba que la notaría YA SE HABÍA CELEBRADO, y la
       fecha no aparecía en «Las fechas que has apuntado tú», porque no
       estaba ahí.

       APUNTAR UNA FECHA APUNTA UNA FECHA. Sin excepciones y sin
       adivinar nada por una palabra. Para la cita de notaría está el
       botón «Notaría con fecha», que es explícito y se ve.
       ------------------------------------------------------------------ */
    return tocar(id, "fecha: " + q, function (e) {
      e.fechas = e.fechas || [];
      e.fechas.push({ que: q, fecha: vf.ok, apuntada: hoyISO() });
      e.fechas.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
    });
  }
  function quitarFecha(id, indice) {
    return tocar(id, "quitar una fecha", function (e) {
      if (!e.fechas || !e.fechas[indice]) return { ok: false, error: "Esa fecha ya no está." };
      e.fechas.splice(indice, 1);
    });
  }

  function escribirNota(id, texto) {
    var t = limpiarTexto(texto, true);
    if (!t) return fallo("La nota está vacía.");
    if (t.length > LIMITE.nota) return fallo("La nota es demasiado larga (" + t.length + " letras; como mucho " + LIMITE.nota + "). Pártela en dos.");
    return tocar(id, "nota", function (e) {
      e.notas = e.notas || [];
      e.notas.unshift({ fecha: hoyISO(), cuando: ahoraISO(), texto: t });
    });
  }

  function corregir(id, datos) {
    var cambios = {};
    if (datos.direccion != null) {
      var v = validarDireccion(datos.direccion);
      if (v.error) return fallo(v.error);
      cambios.direccion = v.ok;
    }
    if (datos.propietario != null) {
      var q = limpiarTexto(datos.propietario);
      if (q.length > LIMITE.nombre) return fallo("El nombre es demasiado largo.");
      cambios.propietario = q;
    }
    return tocar(id, "corregir los datos", function (e) {
      if (cambios.direccion) { e.nombre = cambios.direccion; e.vivienda = e.vivienda || {}; e.vivienda.via = cambios.direccion; e.vivienda.direccion_literal = cambios.direccion; }
      if (cambios.propietario != null) e.propietario = cambios.propietario ? { nombre: cambios.propietario } : {};
    });
  }

  function archivar(id) {
    return cambiar("archivar", function (st) {
      if (esDeEjemplo(id)) return { ok: false, error: "Ese expediente es de ejemplo y no se archiva." };
      var b = buscar(st, id);
      if (!b) return { ok: false, error: "Ese expediente ya no está." };
      if (b.lista === "archivados") return { ok: false, error: "Ya estaba archivado." };
      var antes = copiar(b.e);
      st.expedientes.splice(b.i, 1);
      b.e.archivado = ahoraISO();
      st.archivados.unshift(b.e);
      return { ok: true, que: "archivar " + (b.e.nombre || id), id: id, antes: antes, lugar_antes: "expedientes" };
    });
  }
  function recuperar(id) {
    return cambiar("recuperar", function (st) {
      var b = buscar(st, id);
      if (!b || b.lista !== "archivados") return { ok: false, error: "Ese expediente no está en los archivados." };
      var antes = copiar(b.e);
      st.archivados.splice(b.i, 1);
      delete b.e.archivado;
      st.expedientes.unshift(b.e);
      return { ok: true, que: "recuperar " + (b.e.nombre || id), id: id, antes: antes, lugar_antes: "archivados" };
    });
  }
  /* Borrar de verdad. La pantalla pregunta ANTES; aquí se pide además
     la palabra «confirmado» para que ningún clic suelto borre nada. */
  function borrar(id, confirmado) {
    if (confirmado !== "confirmado") return fallo("Para borrar hay que confirmarlo.");
    return cambiar("borrar", function (st) {
      if (esDeEjemplo(id)) return { ok: false, error: "Ese expediente es de ejemplo y no se borra." };
      var b = buscar(st, id);
      if (!b) return { ok: false, error: "Ese expediente ya no está." };
      var antes = copiar(b.e);
      st[b.lista].splice(b.i, 1);
      return { ok: true, que: "borrar " + (b.e.nombre || id), id: id, antes: antes, lugar_antes: b.lista };
    });
  }

  /* DESHACER: devuelve el expediente a como estaba antes del último
     cambio. Se hace sobre lo que hay guardado ahora, así que si otra
     ventana ha tocado OTROS expedientes, eso se respeta. */
  function deshacer() {
    return cambiar("deshacer", function (st) {
      var u = st.deshacer.pop();
      if (!u) return { ok: false, error: "No hay nada que deshacer." };
      var b = buscar(st, u.id);
      if (b) st[b.lista].splice(b.i, 1);
      if (u.antes) st[u.lugar_antes || "expedientes"].unshift(u.antes);
      /* se vuelve a poner en su sitio de la lista, no arriba del todo,
         si se sabe dónde estaba: no hace falta, el orden es por creación */
      ordenar(st);
      return { ok: true, que: "deshecho: " + u.que, id: u.id, sin_deshacer: true };
    });
  }
  function ordenar(st) {
    function k(e) { return e.creado || ""; }
    st.expedientes.sort(function (a, b) { return k(a) < k(b) ? 1 : k(a) > k(b) ? -1 : 0; });
  }
  function loUltimo() {
    var u = A.estado.deshacer[A.estado.deshacer.length - 1];
    return u ? u.que : null;
  }

  function preferencia(clave, valor) {
    return cambiar("preferencia", function (st) {
      st.preferencias[clave] = valor;
      return { ok: true, que: "preferencia", sin_deshacer: true };
    });
  }

  /* ------------------------------------------------------------------
     4 · COPIA EN UN FICHERO (para cambiar de ordenador o por si acaso)
     No sale a internet: el fichero se descarga en su propio ordenador.
     ------------------------------------------------------------------ */
  function comoFichero() {
    return JSON.stringify({ formato: "immoia.mis_expedientes", version: 1, exportado: ahoraISO(),
      expedientes: A.estado.expedientes, archivados: A.estado.archivados, preferencias: A.estado.preferencias }, null, 1);
  }
  function desdeFichero(texto) {
    var x;
    try { x = JSON.parse(String(texto || "")); } catch (e) { return fallo("Ese fichero no es una copia de la mesa: no se puede leer."); }
    if (!x || x.formato !== "immoia.mis_expedientes" || !Array.isArray(x.expedientes)) {
      return fallo("Ese fichero no es una copia de la mesa de IMMO IA.");
    }
    return cambiar("traer la copia del fichero", function (st) {
      var puestos = 0, repetidos = 0;
      var ids = {};
      st.expedientes.concat(st.archivados).forEach(function (e) { ids[e.expediente_id] = true; });
      function meter(lista, destino) {
        (lista || []).forEach(function (e) {
          if (!e || typeof e !== "object" || !e.expediente_id) return;
          if (ids[e.expediente_id]) { repetidos++; return; }
          e.es_mio = true; st[destino].push(e); ids[e.expediente_id] = true; puestos++;
        });
      }
      meter(x.expedientes, "expedientes");
      meter(x.archivados, "archivados");
      ordenar(st);
      /* traer una copia no se deshace con «deshacer»: se deshace
         borrando lo que ha entrado. Se dice. */
      st.deshacer = [];
      return { ok: true, que: "traídos " + puestos + " expedientes del fichero" +
               (repetidos ? " (" + repetidos + " ya los tenías y no se han duplicado)" : ""), sin_deshacer: true };
    });
  }

  /* ------------------------------------------------------------------
     5 · JUNTARLO CON LA MESA
     La mesa (mesa\la_mesa.js) lee window.LA_SECRETARIA_MESA.expedientes.
     Aquí se pone: primero los suyos, detrás los de ejemplo tal cual.
     Si ella no tiene ninguno, la lista es EXACTAMENTE la de antes.
     ------------------------------------------------------------------ */
  function juntar() {
    var M = raiz.LA_SECRETARIA_MESA;
    if (!M || Object.prototype.toString.call(M.expedientes) !== "[object Array]") return false;
    if (!A.ejemplos) A.ejemplos = M.expedientes.slice();
    var ocultar = !!(A.estado.preferencias && A.estado.preferencias.ocultar_ejemplos) && A.estado.expedientes.length > 0;
    M.expedientes = A.estado.expedientes.map(copiar).concat(ocultar ? [] : A.ejemplos);
    return true;
  }

  function arrancar() {
    A.disponible = almacenDisponible();
    if (A.disponible.ok) {
      var l = leer();
      A.estado = l.estado;
      if (l.roto) A.solo_lectura = l.roto;
      if (l.recuperado) A.aviso_al_abrir = l.recuperado;
    }
    juntar();
  }

  /* Si otra ventana guarda algo, esta se entera sola. */
  try {
    raiz.addEventListener("storage", function (ev) {
      if (ev.key !== CLAVE) return;
      var l = leer();
      if (l.roto) return;
      A.estado = l.estado;
      juntar();
      avisar("otra_ventana", "Otra ventana ha cambiado tus expedientes; aquí ya está al día.");
    });
  } catch (e) {}

  arrancar();

  var API = {
    version: VERSION,
    CLAVE: CLAVE,
    LIMITE: LIMITE,
    FASES: FASES,
    disponible: function () { return A.disponible; },
    soloLectura: function () { return A.solo_lectura; },
    avisoAlAbrir: function () { return A.aviso_al_abrir || null; },
    mios: function () { return copiar(A.estado.expedientes); },
    archivados: function () { return copiar(A.estado.archivados); },
    uno: function (id) { var b = buscar(A.estado, id); return b ? copiar(b.e) : null; },
    esMio: function (id) { return !!buscar(A.estado, id); },
    esDeEjemplo: esDeEjemplo,
    ejemplos: function () { return copiar(A.ejemplos || []); },
    preferencias: function () { return copiar(A.estado.preferencias); },
    meterCasa: meterCasa,
    ponerPapel: ponerPapel,
    quitarPapel: quitarPapel,
    cambiarFase: cambiarFase,
    apuntarFecha: apuntarFecha,
    quitarFecha: quitarFecha,
    escribirNota: escribirNota,
    corregir: corregir,
    archivar: archivar,
    recuperar: recuperar,
    borrar: borrar,
    deshacer: deshacer,
    loUltimo: loUltimo,
    preferencia: preferencia,
    comoFichero: comoFichero,
    desdeFichero: desdeFichero,
    juntar: juntar,
    releer: function () { var l = leer(); if (!l.roto) { A.estado = l.estado; } juntar(); return !l.roto; },
    alAvisar: function (f) { AVISOS.push(f); },
    ultimoError: function () { return A.ultimo_error; },
    fechaDeVerdad: fechaDeVerdad,
    hoy: hoyISO
  };
  raiz.IMMOIA_ALMACEN = API;
})(typeof window !== "undefined" ? window : this);
