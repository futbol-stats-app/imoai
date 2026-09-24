/* ==================================================================
   redactar.js · LA SECRETARIA REDACTA  (V1 · taller RD · 24/09/2026)

   Punto 6 de «La Secretaria en su plenitud»: que redacte los correos
   que hacen falta en cada expediente, a nombre de la inmobiliaria, y
   que una persona los lea, los cambie si quiere y pulse enviar.

   LO QUE HACE
     · Cinco plantillas, rellenas con lo que La Secretaria ya sabe del
       expediente (dirección, titular, papeles, qué falta y qué vence):
         1. pedir al cliente los papeles que faltan
         2. recordar lo que vence
         3. pedir el certificado de la comunidad al administrador
         4. pedir cita al notario
         5. proponer al propietario la cuenta de las placas
     · Lo que falta y lo que vence NO se calcula aquí: sale de
       IMMOIA_REPASO.mirarUno(), igual que en la ficha. Las normas que
       se citan salen de las fuentes que trae el repaso; si el repaso no
       trae norma, no se cita ninguna. Citar o callar.
     · Si falta un dato (el correo del cliente, el nombre del
       administrador, quién firma...) se deja un hueco visible entre
       corchetes, [así], para que se vea antes de mandarlo.

   LO QUE NO HACE, A PROPÓSITO
     · No manda nada. Ni un fetch, ni un XHR, ni un WebSocket. Los tres
       botones son «Copiar», «Abrir en el correo» (un enlace mailto:
       que abre el programa de correo de su ordenador con el texto
       puesto, y ahí lo manda ella o no) y «Guardar como .txt».
     · No usa IA: son plantillas escritas aquí, con los datos puestos.
     · No inventa cifras, plazos ni normas.

   LO QUE SE GUARDA
     · El nombre de la inmobiliaria y quién firma, una vez, en
       «immoia.secretaria.redactar.v1» de este navegador. Empieza por
       «immoia.secretaria.», así que la copia de seguridad de La
       Secretaria (casa\la_copia.js) se lo lleva con lo demás.

   Lo carga mesa\la_mesa.js la primera vez que se pulsa «Redactar».
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.0";
  var LLAVE = "immoia.secretaria.redactar.v1";
  /* El único enlace que sale en un texto: la página de Energía de la
     web. Es TEXTO dentro de una carta; este fichero no lo abre nunca. */
  var PAGINA_ENERGIA = "https://inmoiaallhouse.com/energia.html";

  /* Líneas rojas de la casa. Se vigilan en cada texto que sale de
     aquí: si una plantilla las tuviera, no se enseña. */
  var PROHIBIDAS = [/asesoramiento\s+legal/i, /servicios\s+legales/i, /equipo\s+jur[ií]dico/i, /gestor[ií]a/i];

  /* ------------------------------------------------------------------
     0 · UTILIDADES
     ------------------------------------------------------------------ */
  function sinTildes(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
      .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n");
  }
  function fechaDeVerdad(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s == null ? "" : s))) return null;
    var p = String(s).split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    if (d.getUTCFullYear() !== +p[0] || (d.getUTCMonth() + 1) !== +p[1] || d.getUTCDate() !== +p[2]) return null;
    return d;
  }
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function enCristiano(iso) {
    var d = fechaDeVerdad(iso);
    if (!d) return String(iso == null ? "" : iso);
    return d.getUTCDate() + " de " + MESES[d.getUTCMonth()] + " de " + d.getUTCFullYear();
  }
  function diasEntre(fin, desde) {
    var a = fechaDeVerdad(fin), b = fechaDeVerdad(desde);
    if (!a || !b) return null;
    return Math.round((a - b) / 86400000);
  }
  function hoyDelSistema() {
    var d = new Date();
    function dd(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + dd(d.getMonth() + 1) + "-" + dd(d.getDate());
  }
  function hueco(que) { return "[" + que + "]"; }
  function limpio(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function esCorreo(s) { return /^[^\s@<>()\[\],;:]+@[^\s@<>()\[\],;:]+\.[a-z]{2,}$/i.test(limpio(s)); }
  function mayuscula(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function prohibida(texto) {
    for (var i = 0; i < PROHIBIDAS.length; i++) if (PROHIBIDAS[i].test(texto)) return true;
    return false;
  }
  function huecosDe(texto) {
    var m = String(texto || "").match(/\[[^\]\n]{1,80}\]/g) || [];
    var vistos = {}, out = [];
    m.forEach(function (x) { if (!vistos[x]) { vistos[x] = 1; out.push(x); } });
    return out;
  }

  /* De una fuente del repaso se queda SOLO con los trozos que son una
     norma (ley, real decreto, artículo...). «OT-25», «práctica de la
     casa» o «lo dice tu expediente» son cosas de dentro: al cliente no
     se le cita eso. Si no queda ninguna norma, no se cita nada. */
  function normas(fuente) {
    if (!fuente) return "";
    var trozos = String(fuente).split(/\s+·\s+|\s+—\s+/);
    var buenos = trozos.filter(function (t) {
      t = limpio(t);
      if (!t) return false;
      if (/OJO|comprobado|\.md\b|\.json\b|OT-25/i.test(t)) return false;
      return /\b(ley|rdl?|real decreto|decreto|art\.|c[oó]digo civil)\b/i.test(t) || /^RD\s*\d/.test(t);
    });
    return buenos.map(limpio).join(" · ");
  }

  /* ------------------------------------------------------------------
     1 · LOS AJUSTES DE LA OFICINA: NOMBRE Y QUIÉN FIRMA
     ------------------------------------------------------------------ */
  function ajustes() {
    var a = { inmobiliaria: "", firma: "" };
    try {
      var x = JSON.parse(raiz.localStorage.getItem(LLAVE) || "null");
      if (x && typeof x === "object") {
        a.inmobiliaria = limpio(x.inmobiliaria).slice(0, 120);
        a.firma = limpio(x.firma).slice(0, 120);
      }
    } catch (e) {}
    return a;
  }
  function guardarAjustes(nuevo) {
    var a = { formato: "immoia.secretaria.redactar", version: 1,
              inmobiliaria: limpio(nuevo && nuevo.inmobiliaria).slice(0, 120),
              firma: limpio(nuevo && nuevo.firma).slice(0, 120) };
    try {
      raiz.localStorage.setItem(LLAVE, JSON.stringify(a));
      var vuelta = ajustes();
      if (vuelta.inmobiliaria !== a.inmobiliaria || vuelta.firma !== a.firma) {
        return { ok: false, error: "No se ha guardado: al leerlo de vuelta no coincide." };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "No se ha podido guardar en este navegador (" + (e && e.message ? e.message : e) + "). " +
                                 "Puedes escribirlo en el texto a mano." };
    }
  }

  /* ------------------------------------------------------------------
     2 · LO QUE SE SABE DEL EXPEDIENTE (y nada más)
     ------------------------------------------------------------------ */
  function queOperacion(t) {
    var s = sinTildes(t);
    if (/energ/.test(s)) return "energia";
    if (/vacacional|turistic/.test(s)) return "vacacional";
    if (/alquiler|arrendamiento/.test(s)) return "alquiler";
    if (/venta|compraventa/.test(s)) return "venta";
    return null;
  }
  var DE_QUE = { venta: "la venta", alquiler: "el alquiler", vacacional: "el alquiler vacacional", energia: "el estudio de energía" };

  function docsDe(e) { return ((e && e.documentos) || []).filter(function (d) { return d && d.cual; }); }
  function estaDentro(d) { var s = sinTildes(d && d.estado_documento); return s === "recibido" || s === "verificado"; }

  function sabido(e, hoy) {
    var R = raiz.IMMOIA_REPASO;
    var u = null;
    if (R && typeof R.mirarUno === "function") {
      try { u = R.mirarUno(e, hoy); } catch (err) { u = null; }
    }
    var p = (e && e.propietario) || {};
    var correo = [p.correo, p.email, p.correo_electronico, e && e.correo].filter(esCorreo)[0] || "";
    var comprador = (e && e.comprador && e.comprador.nombre) || "";
    return {
      id: String((e && (e.expediente_id || e.id)) || "sin número"),
      direccion: limpio((e && e.vivienda && e.vivienda.direccion_literal) || (e && e.nombre)) || null,
      cliente: limpio(p.nombre) || null,
      correo: correo ? limpio(correo) : null,
      comprador: limpio(comprador) || null,
      operacion: queOperacion(e && e.tipo_operacion),
      docs: docsDe(e),
      u: u
    };
  }

  /* ------------------------------------------------------------------
     3 · LAS CINCO PLANTILLAS
     ------------------------------------------------------------------ */
  function firmaDe(aj) {
    return "Un saludo,\n\n" +
      (aj.firma || hueco("quién firma")) + "\n" +
      (aj.inmobiliaria || hueco("nombre de la inmobiliaria"));
  }
  function saludo(nombre, siNo) { return "Buenos días, " + (nombre || hueco(siNo)) + ":"; }

  function pedirPapeles(S, aj) {
    var out = { clave: "papeles", titulo: "Pedir al cliente los papeles que faltan" };
    if (!S.u) { out.disponible = false; out.porque_no = "No he podido repasar este expediente, así que no sé qué le falta."; return out; }
    var todos = (S.u.faltan || []);
    var pedir = todos.filter(function (f) { return !f.pedido; });
    var yaPedidos = todos.filter(function (f) { return f.pedido; });
    if (!pedir.length) {
      out.disponible = false;
      out.porque_no = yaPedidos.length
        ? "Lo que falta ya está pedido: no hay nada que pedirle al cliente."
        : "No le falta ninguno de los papeles que pide la tabla.";
      return out;
    }
    var dir = S.direccion || hueco("dirección de la vivienda");
    var t = saludo(S.cliente, "nombre del cliente") + "\n\n" +
      "Para seguir con " + (DE_QUE[S.operacion] || "su expediente") + " de " + dir + ", en " +
      (aj.inmobiliaria || hueco("nombre de la inmobiliaria")) + " nos " +
      (pedir.length === 1 ? "falta este papel" : "faltan estos papeles") + ":\n\n" +
      pedir.map(function (f) { return "  · " + mayuscula(f.cual); }).join("\n") + "\n\n";
    if (yaPedidos.length) {
      t += (yaPedidos.length === 1 ? "Este otro" : "Estos otros") + " ya " +
        (yaPedidos.length === 1 ? "lo hemos pedido" : "los hemos pedido") + " nosotros, no tiene que hacer nada:\n\n" +
        yaPedidos.map(function (f) { return "  · " + mayuscula(f.cual); }).join("\n") + "\n\n";
    }
    t += "Nos los puede mandar contestando a este correo o traerlos a la oficina. " +
      "Si alguno no lo tiene o no sabe dónde pedirlo, díganoslo y lo vemos.\n\n" +
      "Muchas gracias.\n\n" + firmaDe(aj);
    out.disponible = true;
    out.para = S.correo || hueco("correo del cliente");
    out.asunto = "Papeles que nos faltan · " + dir;
    out.cuerpo = t;
    return out;
  }

  function loQueVence(S) {
    var out = [];
    ((S.u && S.u.hallazgos) || []).forEach(function (h) {
      if ((h.clase === "vence" || h.clase === "vencido") && fechaDeVerdad(h.vence)) out.push(h);
    });
    out.sort(function (a, b) { return a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0; });
    return out;
  }

  function recordatorio(S, aj, hoy) {
    var out = { clave: "vence", titulo: "Recordatorio de lo que vence" };
    var v = loQueVence(S);
    if (!v.length) {
      out.disponible = false;
      out.porque_no = S.u ? "A este expediente no le vence nada con fecha." : "No he podido repasar este expediente.";
      return out;
    }
    var dir = S.direccion || hueco("dirección de la vivienda");
    function linea(h) {
      var q = diasEntre(h.vence, hoy);
      var n = normas(h.fuente);
      return "  · " + h.titulo + ": " + enCristiano(h.vence) +
        (q == null ? "" : q < 0 ? " (esa fecha ya pasó)" : q === 0 ? " (es hoy)" : "") +
        (n ? "\n    Lo dice: " + n + "." : "");
    }
    /* Los plazos de lo que la oficina ha PEDIDO a otros (el repaso los
       titula «Se acaba el plazo» / «Se pasó el plazo») no son cosa del
       cliente: van aparte, para que lo sepa, sin pedirle nada. */
    var deOtros = v.filter(function (h) { return /^Se (acaba|pas[oó]) el plazo/.test(h.titulo || ""); });
    var suyos = v.filter(function (h) { return deOtros.indexOf(h) < 0; });
    var t = saludo(S.cliente, "nombre del cliente") + "\n\n" +
      "Le escribimos de " + (aj.inmobiliaria || hueco("nombre de la inmobiliaria")) + " por " +
      (DE_QUE[S.operacion] || "su expediente") + " de " + dir + ".";
    if (suyos.length) {
      t += " Le recordamos " + (suyos.length === 1 ? "esta fecha" : "estas fechas") + ":\n\n" +
        suyos.map(linea).join("\n") + "\n\n";
    } else t += "\n\n";
    if (deOtros.length) {
      t += (suyos.length ? "Y esto" : "Esto") + " lo estamos esperando nosotros; se lo contamos para que lo sepa, " +
        "no tiene que hacer nada:\n\n" + deOtros.map(linea).join("\n") + "\n\n";
    }
    t +=
      "Si tiene cualquier duda, contéstenos a este correo o llámenos.\n\n" + firmaDe(aj);
    out.disponible = true;
    out.para = S.correo || hueco("correo del cliente");
    out.asunto = "Recordatorio: lo que vence · " + dir;
    out.cuerpo = t;
    return out;
  }

  function entradaDeLaTabla(clave, operacion) {
    var R = raiz.IMMOIA_REPASO;
    var C = (R && R.CARPETA) || {};
    var listas = operacion && C[operacion] ? [C[operacion]] : Object.keys(C).map(function (k) { return C[k]; });
    for (var i = 0; i < listas.length; i++) for (var j = 0; j < listas[i].length; j++) {
      if (listas[i][j].clave === clave) return listas[i][j];
    }
    return null;
  }
  function vigencia(clave) {
    var R = raiz.IMMOIA_REPASO;
    var V = (R && R.VIGENCIAS) || [];
    for (var i = 0; i < V.length; i++) if (V[i].clave === clave) return V[i];
    return null;
  }

  function comunidad(S, aj) {
    var out = { clave: "comunidad", titulo: "Pedir el certificado de la comunidad al administrador" };
    var f = ((S.u && S.u.faltan) || []).filter(function (x) {
      return x.clave === "comunidad" || /comunidad/.test(sinTildes(x.cual));
    })[0];
    if (!f) {
      out.disponible = false;
      out.porque_no = S.u ? "No falta: el certificado de la comunidad no sale entre lo que le falta." : "No he podido repasar este expediente.";
      return out;
    }
    var dir = S.direccion || hueco("dirección de la vivienda");
    var doc = S.docs.filter(function (d) { return /comunidad/.test(sinTildes(d.cual)); })[0] || null;
    var pedidoEl = doc && sinTildes(doc.estado_documento) === "pedido" && fechaDeVerdad(doc.fecha) ? doc.fecha : null;
    var tabla = entradaDeLaTabla("comunidad", S.operacion);
    var vg = vigencia("comunidad");
    var t = saludo(null, "nombre del administrador de fincas") + "\n\n" +
      "Le escribimos de " + (aj.inmobiliaria || hueco("nombre de la inmobiliaria")) + ". Llevamos " +
      (DE_QUE[S.operacion] || "el expediente") + " de la vivienda de " + dir +
      (S.cliente ? ", de " + S.cliente : ", de " + hueco("nombre del propietario")) +
      ", que está en la comunidad que usted administra.\n\n" +
      (pedidoEl
        ? "Se lo pedimos el " + enCristiano(pedidoEl) + " y todavía no nos ha llegado. Le escribimos de nuevo para pedirle"
        : "Le pedimos") +
      " el certificado de que esa vivienda está al día en los pagos a la comunidad" +
      (tabla && tabla.porque ? ", porque " + tabla.porque : "") +
      (tabla && normas(tabla.fuente) ? " (" + normas(tabla.fuente) + ")" : "") + ".\n\n";
    if (vg && vg.dice && normas(vg.fuente)) {
      t += "Para que lo tenga en cuenta: " + vg.dice + " (" + normas(vg.fuente) + ").\n\n";
    }
    t += "Si necesita la autorización del propietario o algún dato más, díganoslo y se lo mandamos.\n\n" +
      "Muchas gracias.\n\n" + firmaDe(aj);
    out.disponible = true;
    out.para = hueco("correo del administrador de fincas");
    out.asunto = "Certificado de la comunidad · " + dir;
    out.cuerpo = t;
    return out;
  }

  function notario(S, aj, hoy) {
    var out = { clave: "notario", titulo: "Pedir cita al notario" };
    var not = S.docs.filter(function (d) { return /notari/.test(sinTildes(d.cual)); })[0] || null;
    if (S.operacion !== "venta" && !not) {
      out.disponible = false;
      out.porque_no = "Este expediente no es una venta: no hay firma en notaría.";
      return out;
    }
    if ((S.u && S.u.cerrada)) {
      out.disponible = false;
      out.porque_no = "Esta venta ya consta escriturada: no hay cita que pedir.";
      return out;
    }
    var fecha = not && fechaDeVerdad(not.fecha) ? not.fecha : null;
    var q = fecha ? diasEntre(fecha, hoy) : null;
    var yaPaso = q != null && q < 0;
    var dir = S.direccion || hueco("dirección de la vivienda");
    var tenemos = S.docs.filter(estaDentro).map(function (d) { return "  · " + mayuscula(d.cual); });
    var faltan = ((S.u && S.u.faltan) || []).map(function (f) { return "  · " + mayuscula(f.cual); });
    var t = saludo(null, "nombre de la notaría o del notario") + "\n\n" +
      "Le escribimos de " + (aj.inmobiliaria || hueco("nombre de la inmobiliaria")) +
      " por la compraventa de la vivienda de " + dir + ".\n\n";
    if (fecha && !yaPaso) {
      t += "Queremos confirmar la cita para firmar la escritura el " + enCristiano(fecha) +
        ", a las " + hueco("hora") + ". Si esa fecha no les viene bien, díganos cuál les va mejor.\n\n";
    } else {
      t += (yaPaso ? "La fecha que teníamos (" + enCristiano(fecha) + ") ya ha pasado. " : "") +
        "Queremos pedir cita para firmar la escritura. Nos vendría bien el " + hueco("fecha que proponemos") +
        ", a las " + hueco("hora") + ", o la fecha que ustedes nos digan.\n\n";
    }
    t += "Vende: " + (S.cliente || hueco("nombre del vendedor")) + ".\n" +
      "Compra: " + (S.comprador || hueco("nombre del comprador")) + ".\n\n";
    if (tenemos.length) t += "Tenemos ya en la carpeta:\n" + tenemos.join("\n") + "\n\n";
    if (faltan.length) t += "Estamos reuniendo todavía:\n" + faltan.join("\n") + "\n\n";
    t += "Díganos qué más necesitan y con cuánto tiempo, y se lo mandamos.\n\n" + firmaDe(aj);
    out.disponible = true;
    out.para = hueco("correo de la notaría");
    out.asunto = (fecha && !yaPaso ? "Cita de firma del " + enCristiano(fecha) : "Pedir cita de firma") + " · " + dir;
    out.cuerpo = t;
    return out;
  }

  function letraEnergetica(S) {
    for (var i = 0; i < S.docs.length; i++) {
      var s = String(S.docs[i].cual || "") + " " + String(S.docs[i].literal_en_OT25 || "");
      var m = s.match(/\(letra\s+([a-g])\)/i) || s.match(/letra\s+([a-g])\b/i);
      if (m && /energ/i.test(sinTildes(s))) return m[1].toUpperCase();
    }
    return null;
  }

  function energia(S, aj) {
    var out = { clave: "energia", titulo: "Proponer al propietario la cuenta de las placas" };
    var letra = letraEnergetica(S);
    var mala = letra && /[EFG]/.test(letra);
    if (S.operacion !== "energia" && !mala) {
      out.disponible = false;
      out.porque_no = letra
        ? "El certificado energético tiene la letra " + letra + ": esta propuesta es para los expedientes de energía o con letra E, F o G."
        : "No es un expediente de energía y no consta la letra del certificado energético.";
      return out;
    }
    var dir = S.direccion || hueco("dirección de la vivienda");
    var t = saludo(S.cliente, "nombre del propietario") + "\n\n" +
      "Le escribimos de " + (aj.inmobiliaria || hueco("nombre de la inmobiliaria")) + " por su vivienda de " + dir + ".\n\n" +
      (mala ? "En el certificado energético que tenemos consta la letra " + letra + ". " : "") +
      "Le proponemos hacer la cuenta de las placas solares para su casa: lo que le costarían y lo que le podrían " +
      "ahorrar. La cuenta se hace con los datos de su vivienda en la página de Energía de IMMO IA:\n\n" +
      PAGINA_ENERGIA + "\n\n" +
      "No le adelantamos ninguna cifra en este correo: sale de la cuenta, con sus datos. Si lo prefiere, " +
      "la hacemos juntos en la oficina.\n\n" + firmaDe(aj);
    out.disponible = true;
    out.para = S.correo || hueco("correo del propietario");
    out.asunto = "La cuenta de las placas para su vivienda · " + dir;
    out.cuerpo = t;
    return out;
  }

  function plantillas(e, opciones) {
    opciones = opciones || {};
    var hoy = fechaDeVerdad(opciones.hoy) ? opciones.hoy : hoyDelSistema();
    var aj = opciones.ajustes || ajustes();
    var S = sabido(e, hoy);
    var lista = [pedirPapeles(S, aj), recordatorio(S, aj, hoy), comunidad(S, aj), notario(S, aj, hoy), energia(S, aj)];
    lista.forEach(function (p) {
      if (!p.disponible) return;
      /* la línea roja: si algo prohibido se colara, no se enseña */
      if (prohibida(p.asunto + "\n" + p.cuerpo)) {
        p.disponible = false; p.porque_no = "Este texto llevaba una expresión que la casa no usa. No lo enseño.";
        p.asunto = p.cuerpo = p.para = null;
        return;
      }
      p.huecos = huecosDe(p.para + "\n" + p.asunto + "\n" + p.cuerpo);
    });
    return lista;
  }

  function mailto(para, asunto, cuerpo) {
    var dest = esCorreo(para) ? limpio(para) : "";
    return "mailto:" + encodeURIComponent(dest).replace(/%40/g, "@") +
      "?subject=" + encodeURIComponent(asunto || "") +
      "&body=" + encodeURIComponent(String(cuerpo || "").replace(/\r?\n/g, "\r\n"));
  }
  function comoTxt(para, asunto, cuerpo) {
    return "Para: " + (para || "") + "\r\nAsunto: " + (asunto || "") + "\r\n\r\n" +
      String(cuerpo || "").replace(/\r?\n/g, "\r\n") + "\r\n";
  }

  /* ------------------------------------------------------------------
     4 · LA PANTALLA
     ------------------------------------------------------------------ */
  function crear(tag, clase, texto, atrs) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    if (atrs) Object.keys(atrs).forEach(function (k) { n.setAttribute(k, atrs[k]); });
    return n;
  }
  function boton(texto, clase, alPulsar, atrs) {
    var b = crear("button", clase || "rd_boton", texto, atrs);
    b.setAttribute("type", "button");
    b.addEventListener("click", alPulsar);
    return b;
  }
  function vaciar(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  function montar(caja, e, opciones) {
    opciones = opciones || {};
    vaciar(caja);
    var hoy = fechaDeVerdad(opciones.hoy) ? opciones.hoy : hoyDelSistema();
    var id = String((e && (e.expediente_id || e.id)) || "sin número");
    var panel = crear("section", "rd_panel", null, { "data-rd": id, "aria-label": "Redactar" });
    panel.appendChild(crear("h3", "rd_titulo", "Redactar"));
    panel.appendChild(crear("p", "rd_nota",
      "Te lo dejo escrito con lo que sé de este expediente. Nada se envía solo: lo lees, lo cambias si quieres " +
      "y lo mandas tú desde tu correo. Lo que va entre corchetes [así] es un dato que no tengo: rellénalo antes."));

    /* --- quién firma, una vez --- */
    var aj = ajustes();
    var fa = crear("div", "rd_ajustes");
    var inm = crear("input", "rd_entrada rd_inmobiliaria", null,
      { type: "text", "aria-label": "Nombre de la inmobiliaria", placeholder: "Nombre de la inmobiliaria", maxlength: "120" });
    inm.value = aj.inmobiliaria;
    var fir = crear("input", "rd_entrada rd_firma", null,
      { type: "text", "aria-label": "Quién firma", placeholder: "Quién firma (nombre y apellidos)", maxlength: "120" });
    fir.value = aj.firma;
    var msgAj = crear("span", "rd_msg_ajustes flojo", aj.firma ? "" : "Se guarda en este ordenador y ya no te lo vuelvo a pedir.");
    fa.appendChild(inm); fa.appendChild(fir);
    fa.appendChild(boton("Guardar", "rd_boton rd_guardar_firma", function () {
      var r = guardarAjustes({ inmobiliaria: inm.value, firma: fir.value });
      if (!r.ok) { msgAj.textContent = r.error; msgAj.className = "rd_msg_ajustes rd_error"; return; }
      msgAj.className = "rd_msg_ajustes rd_bien";
      if (actual && !tocado) { elegir(actual.clave); msgAj.textContent = "Guardado. Ya está puesto en el texto."; }
      else msgAj.textContent = "Guardado." + (actual ? " Este texto lo has cambiado tú y no lo toco: vuelve a elegir la plantilla para verlo puesto." : "");
    }));
    fa.appendChild(msgAj);
    panel.appendChild(fa);

    /* --- las plantillas --- */
    var elegibles = crear("div", "rd_plantillas");
    panel.appendChild(elegibles);
    var hoja = crear("div", "rd_hoja");
    hoja.style.display = "none";
    panel.appendChild(hoja);

    var actual = null, tocado = false;
    var para = crear("input", "rd_entrada rd_para", null, { type: "text", "aria-label": "Para" });
    var asunto = crear("input", "rd_entrada rd_asunto", null, { type: "text", "aria-label": "Asunto" });
    var cuerpo = crear("textarea", "rd_entrada rd_cuerpo", null, { rows: "16", "aria-label": "Texto", spellcheck: "true" });
    var quedan = crear("div", "rd_huecos");
    var msg = crear("div", "rd_msg", null, { "aria-live": "polite" });
    function decir(tipo, t) { msg.className = "rd_msg rd_" + tipo; msg.textContent = t; }
    function contarHuecos() {
      var h = huecosDe(para.value + "\n" + asunto.value + "\n" + cuerpo.value);
      quedan.textContent = h.length ? "Quedan por rellenar: " + h.join(", ") + "." : "No queda ningún hueco por rellenar.";
      quedan.className = "rd_huecos " + (h.length ? "rd_con_huecos" : "rd_sin_huecos");
    }
    [para, asunto, cuerpo].forEach(function (x) {
      x.addEventListener("input", function () { tocado = true; contarHuecos(); });
    });

    var l1 = crear("label", "rd_etiqueta", "Para: "); l1.appendChild(para);
    var l2 = crear("label", "rd_etiqueta", "Asunto: "); l2.appendChild(asunto);
    hoja.appendChild(crear("h4", "rd_hoja_titulo", ""));
    hoja.appendChild(l1); hoja.appendChild(l2); hoja.appendChild(cuerpo); hoja.appendChild(quedan);

    var bots = crear("div", "rd_botones");
    bots.appendChild(boton("Copiar", "rd_boton rd_copiar", function () {
      var texto = cuerpo.value;
      function aMano() {
        try {
          cuerpo.focus(); cuerpo.select();
          var ok = document.execCommand && document.execCommand("copy");
          if (ok) decir("bien", "Copiado. El asunto va aparte, arriba.");
          else decir("error", "Tu navegador no me deja copiar: selecciona el texto y copia con el teclado.");
        } catch (err) { decir("error", "Tu navegador no me deja copiar: selecciona el texto y copia con el teclado."); }
      }
      try {
        if (raiz.navigator && raiz.navigator.clipboard && raiz.navigator.clipboard.writeText) {
          raiz.navigator.clipboard.writeText(texto).then(function () { decir("bien", "Copiado. El asunto va aparte, arriba."); }, aMano);
        } else aMano();
      } catch (err) { aMano(); }
    }));
    bots.appendChild(boton("Abrir en el correo", "rd_boton rd_principal rd_correo", function () {
      var href = mailto(para.value, asunto.value, cuerpo.value);
      var a = crear("a", null, null, { href: href });
      a.href = href;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      var h = huecosDe(para.value + "\n" + asunto.value + "\n" + cuerpo.value);
      decir(h.length ? "aviso" : "bien",
        "Lo he abierto en tu programa de correo. No se ha enviado: lo mandas tú desde allí." +
        (h.length ? " Ojo, quedan huecos por rellenar: " + h.join(", ") + "." : "") +
        (esCorreo(para.value) ? "" : " El «Para» lo tienes que poner allí."));
    }));
    bots.appendChild(boton("Guardar como .txt", "rd_boton rd_txt", function () {
      try {
        var nombre = ("redactado_" + (actual ? actual.clave : "texto") + "_" + id + "_" + hoy)
          .replace(/[^A-Za-z0-9_.-]+/g, "_") + ".txt";
        var blob = new Blob(["\ufeff" + comoTxt(para.value, asunto.value, cuerpo.value)], { type: "text/plain;charset=utf-8" });
        var a = crear("a", null, null, { download: nombre });
        a.href = URL.createObjectURL(blob);
        document.body.appendChild(a); a.click();
        setTimeout(function () { try { URL.revokeObjectURL(a.href); document.body.removeChild(a); } catch (err) {} }, 1000);
        decir("bien", "Guardado como «" + nombre + "», en tu carpeta de Descargas.");
      } catch (err) {
        decir("error", "No he podido guardarlo: " + (err && err.message ? err.message : err));
      }
    }));
    hoja.appendChild(bots);
    hoja.appendChild(msg);

    var lista = [];
    function elegir(clave) {
      lista = plantillas(e, { hoy: hoy, ajustes: ajustes() });
      var p = lista.filter(function (x) { return x.clave === clave; })[0];
      if (!p || !p.disponible) return false;
      actual = p; tocado = false;
      hoja.style.display = "";
      hoja.firstChild.textContent = p.titulo;
      para.value = p.para; asunto.value = p.asunto; cuerpo.value = p.cuerpo;
      decir("info", "");
      contarHuecos();
      return true;
    }

    lista = plantillas(e, { hoy: hoy, ajustes: aj });
    lista.forEach(function (p) {
      var fila = crear("div", "rd_opcion" + (p.disponible ? "" : " rd_no"), null, { "data-plantilla": p.clave });
      var b = boton(p.titulo, "rd_boton rd_elegir", function () { elegir(p.clave); }, { "data-plantilla": p.clave });
      if (!p.disponible) b.disabled = true;
      fila.appendChild(b);
      if (!p.disponible) fila.appendChild(crear("span", "rd_porque flojo", p.porque_no));
      elegibles.appendChild(fila);
    });

    caja.appendChild(panel);
    return { panel: panel, elegir: elegir, textos: function () { return { para: para.value, asunto: asunto.value, cuerpo: cuerpo.value }; } };
  }

  var API = {
    version: VERSION,
    LLAVE: LLAVE,
    PROHIBIDAS: PROHIBIDAS,
    plantillas: plantillas,
    montar: montar,
    ajustes: ajustes,
    guardarAjustes: guardarAjustes,
    mailto: mailto,
    comoTxt: comoTxt,
    normas: normas,
    huecosDe: huecosDe
  };
  if (raiz) raiz.IMMOIA_REDACTAR = API;
  if (typeof module === "object" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : null);
