/* ==================================================================
   meter_y_cambiar.js · METER Y CAMBIAR EXPEDIENTES  (PESTAÑA 6)

   Lo que le faltaba a la mesa: que no solo se mire.
     · Meter una casa nueva: la dirección y «venta» o «alquiler». Nada más.
     · Cambiar lo que hay: que llegó un papel, la fase, una fecha, una nota.
     · Archivar lo cerrado, y borrar preguntando antes.
     · Deshacer lo último, siempre a la vista.

   CÓMO SE ENGANCHA SIN TOCAR LA MESA:
     mesa\la_mesa.js no se ha cambiado ni una letra. Esta pieza:
       1. pone sus controles encima de «Tus expedientes»,
       2. mira cuándo la mesa abre una ficha y le añade debajo el
          cuadro «Cambiar este expediente» si el expediente es suyo,
       3. después de cada cambio le pide a la mesa que se vuelva a
          pintar (LA_MESA._olvidar + LA_MESA.pintar), para que lo que
          le frena y lo que le vence salgan del repaso de siempre.
     Lo que se guarda y cómo, está en casa\el_almacen.js.

   Todo lo que escribe una persona se pinta con textContent: nunca
   como HTML. Una dirección con «<b>» sale tal cual, con los signos.
   Aquí no hay ni un fetch, ni un XHR, ni un WebSocket.
   ================================================================== */
(function (raiz) {
  "use strict";
  var AL = raiz.IMMOIA_ALMACEN;
  if (!AL) return;

  function $(id) { return document.getElementById(id); }
  function crear(tag, clase, texto, atrs) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    if (atrs) Object.keys(atrs).forEach(function (k) { n.setAttribute(k, atrs[k]); });
    return n;
  }
  function boton(texto, clase, id, alPulsar) {
    var b = crear("button", clase || "mc_boton", texto, { type: "button" });
    if (id) b.id = id;
    b.addEventListener("click", alPulsar);
    return b;
  }
  function vaciar(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function enCristiano(iso) {
    if (!AL.fechaDeVerdad(iso)) return String(iso || "");
    var p = iso.split("-");
    return (+p[2]) + " de " + MESES[+p[1] - 1] + " de " + p[0];
  }
  /* ------------------------------------------------------------------
     EL CARTEL DEL ORDEN DE LA FECHA  ·  ARREGLO DEL 21/09/2026
     ------------------------------------------------------------------
     Una casilla «type=date» la pinta el navegador, no nosotros: en un
     ordenador pone dd/mm/aaaa y en otro mm/dd/aaaa, y NOSOTROS NO
     PODEMOS CAMBIARLO. Hasta hoy no había ni una palabra al lado, así
     que si ella tecleaba el 3 de octubre donde el navegador esperaba el
     mes primero, no tenía forma de enterarse.

     Aquí se le pregunta al ordenador en qué orden escribe una fecha
     (Intl.DateTimeFormat().formatToParts) y se pone al lado, en una
     línea. Si no sabe contestar, se dice que no se sabe, que es muy
     distinto de decir algo.
     ------------------------------------------------------------------ */
  var ORDEN_DE_LA_CASILLA = null;
  function ordenDeLaCasilla() {
    if (ORDEN_DE_LA_CASILLA !== null) return ORDEN_DE_LA_CASILLA;
    ORDEN_DE_LA_CASILLA = "";
    try {
      var partes = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })
                     .formatToParts(new Date(2026, 9, 3));
      var orden = [];
      partes.forEach(function (p) {
        if (p.type === "day") orden.push("día");
        else if (p.type === "month") orden.push("mes");
        else if (p.type === "year") orden.push("año");
      });
      if (orden.length === 3) ORDEN_DE_LA_CASILLA = orden.join("/");
    } catch (e) { ORDEN_DE_LA_CASILLA = ""; }
    return ORDEN_DE_LA_CASILLA;
  }
  /* EL CARTEL NO SE FÍA DE SÍ MISMO, Y POR ESO SIRVE.
     El orden que se saca de arriba es el que usa el IDIOMA DEL
     ORDENADOR. El que pinta la casilla lo decide el IDIOMA DEL
     NAVEGADOR, y NO HAY MANERA DE PREGUNTÁRSELO. Casi siempre son el
     mismo, pero no siempre: en el navegador de laboratorio de esta casa
     el ordenador dice día/mes/año y la casilla pinta mm/dd/yyyy.

     Así que el cartel hace DOS cosas, y la segunda es la que de verdad
     la protege: dice el orden que se espera, y en cuanto ella escribe
     algo LE DEVUELVE LA FECHA CON EL MES EN LETRA. Si tecleó el 3 de
     octubre y el ordenador entendió el 10 de marzo, lo lee ahí mismo,
     debajo de su dedo, y no hace falta creerse nada. */
  function textoDelOrden() {
    var o = ordenDeLaCasilla();
    return o
      ? "Tu ordenador escribe las fechas en el orden " + o + ". Escríbela y aquí te la repito con el mes en letra."
      : "Escribe la fecha y aquí te la repito con el mes en letra, para que veas si es la que querías.";
  }
  function carteldelOrden(casilla) {
    var c = crear("span", "mc_orden_fecha flojo", textoDelOrden());
    if (casilla && casilla.addEventListener) {
      var repetir = function () {
        var v = casilla.value;
        if (AL.fechaDeVerdad(v)) {
          c.textContent = "Has escrito el " + enCristiano(v) + ". Si no es ése, cámbialo antes de guardar.";
          c.className = "mc_orden_fecha mc_orden_eco";
        } else {
          c.textContent = textoDelOrden();
          c.className = "mc_orden_fecha flojo";
        }
      };
      casilla.addEventListener("input", repetir);
      casilla.addEventListener("change", repetir);
      repetir();
    }
    return c;
  }

  function diasHasta(iso) {
    if (!AL.fechaDeVerdad(iso)) return null;
    var h = AL.hoy().split("-"), f = iso.split("-");
    return Math.round((Date.UTC(+f[0], +f[1] - 1, +f[2]) - Date.UTC(+h[0], +h[1] - 1, +h[2])) / 86400000);
  }

  /* ------------------------------------------------------------------
     1 · EL MENSAJE DE LO QUE HA PASADO (verde si se hizo, rojo si no)
     ------------------------------------------------------------------ */
  /* el mensaje sale donde ella esté mirando: arriba de la mesa, o
     arriba del cuadro de cambiar si está dentro de un expediente */
  var ULTIMO = null, FICHA_ANTERIOR = null;
  function decir(tipo, texto) {
    ULTIMO = texto ? { tipo: tipo, texto: texto } : null;
    ["mc_mensaje", "mc_mensaje_ficha"].forEach(function (x) {
      var m = $(x);
      if (!m) return;
      m.className = "mc_mensaje mc_" + tipo;
      m.textContent = texto;
      m.style.display = texto ? "" : "none";
      m.setAttribute("role", tipo === "error" ? "alert" : "status");
    });
  }
  AL.alAvisar(function (tipo, texto) {
    if (tipo === "error") decir("error", texto);
    if (tipo === "otra_ventana") { refrescar(); decir("info", texto); }
  });

  function hecho(r, siHecho) {
    if (!r) return false;
    if (!r.ok) { decir("error", r.error || "No se ha hecho."); return false; }
    refrescar(r.id);
    decir("bien", siHecho || ("Hecho y guardado en este ordenador: " + r.que + "."));
    return true;
  }

  /* ------------------------------------------------------------------
     2 · VOLVER A PINTAR LA MESA DESPUÉS DE UN CAMBIO
     ------------------------------------------------------------------ */
  function refrescar(idQueQuieroVer) {
    var M = raiz.LA_MESA;
    AL.juntar();
    if (!M) return;
    var abierto = M.estado ? M.estado().abierto : null;
    var y = raiz.scrollY || 0;
    var enMesa = !$("lugar_mesa") || $("lugar_mesa").style.display !== "none";
    if (typeof M._olvidar === "function") M._olvidar();
    if (enMesa) M.pintar();
    var id = abierto && (AL.esMio(abierto) || AL.esDeEjemplo(abierto)) ? abierto : null;
    if (!id && idQueQuieroVer && abierto && AL.esMio(idQueQuieroVer)) id = idQueQuieroVer;
    if (enMesa && id) M.abrirExpediente(id);
    decorarMesa();
    pintarBarra();
    filtrar();
    try { raiz.scrollTo(0, y); } catch (e) {}
  }

  /* ------------------------------------------------------------------
     3 · ARRIBA DE LA MESA: METER UNA CASA, DESHACER, Y LO DEMÁS
     ------------------------------------------------------------------ */
  function montarBarra() {
    var lista = $("mesa_lista");
    if (!lista || $("mc_barra")) return;
    var barra = crear("section", "mc_barra", null, { id: "mc_barra", "aria-label": "Meter y cambiar expedientes" });

    var aviso = crear("div", "mc_aviso_fijo", null, { id: "mc_aviso_fijo" });
    aviso.style.display = "none";
    barra.appendChild(aviso);

    /* --- meter una casa: una línea y dos botones --- */
    var caja = crear("div", "mc_meter", null, { id: "mc_meter" });
    caja.appendChild(crear("h2", "mc_titulo", "Meter una casa"));
    var fila = crear("div", "mc_fila");
    var dir = crear("input", "mc_entrada", null, {
      id: "mc_direccion", type: "text", autocomplete: "off", maxlength: String(AL.LIMITE.direccion + 50),
      placeholder: "Calle y número (por ejemplo: calle Añaza 3, Güímar)", "aria-label": "Dirección de la casa"
    });
    fila.appendChild(dir);
    caja.appendChild(fila);
    var quien = crear("input", "mc_entrada mc_pequena", null, {
      id: "mc_propietario", type: "text", autocomplete: "off",
      placeholder: "De quién es (si lo sabes; se puede poner luego)", "aria-label": "Propietario (opcional)"
    });
    caja.appendChild(quien);
    var bots = crear("div", "mc_fila mc_botones");
    function meter(op) {
      var r = AL.meterCasa({ direccion: dir.value, tipo_operacion: op, propietario: quien.value });
      if (r.ok) { dir.value = ""; quien.value = ""; }
      hecho(r, r.ok ? "Metida y guardada en este ordenador. Ya está en tu mesa, arriba del todo." : null);
      if (r.ok) { var c = document.querySelector('[data-exp="' + r.id + '"]'); if (c && c.scrollIntoView) try { c.scrollIntoView({ block: "center" }); } catch (e) {} }
      else dir.focus();
    }
    bots.appendChild(boton("Es una venta", "mc_boton mc_principal", "mc_meter_venta", function () { meter("venta"); }));
    bots.appendChild(boton("Es un alquiler", "mc_boton mc_principal", "mc_meter_alquiler", function () { meter("alquiler"); }));
    caja.appendChild(bots);
    dir.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") decir("info", "Ahora pulsa «Es una venta» o «Es un alquiler» y queda metida.");
    });
    barra.appendChild(caja);

    var msg = crear("div", "mc_mensaje", null, { id: "mc_mensaje", "aria-live": "polite" });
    msg.style.display = "none";
    barra.appendChild(msg);

    /* --- deshacer, siempre a la vista si hay algo que deshacer --- */
    var des = crear("div", "mc_deshacer_caja", null, { id: "mc_deshacer_caja" });
    barra.appendChild(des);

    /* --- buscar una casa: con 200 expedientes, bajar a buscarla no vale --- */
    var bus = crear("div", "mc_fila mc_buscar");
    var q = crear("input", "mc_entrada", null, { id: "mc_buscar", type: "search", autocomplete: "off",
      placeholder: "Buscar en tus expedientes (calle, pueblo, propietario…)", "aria-label": "Buscar un expediente" });
    q.addEventListener("input", filtrar);
    bus.appendChild(q);
    bus.appendChild(crear("span", "flojo", null, { id: "mc_buscar_cuantos" }));
    barra.appendChild(bus);

    /* --- lo que ella ha apuntado y vence pronto --- */
    barra.appendChild(crear("div", "mc_fechas_mesa", null, { id: "mc_fechas_mesa" }));

    /* --- lo de más abajo: archivados, copia, ejemplos --- */
    var mas = crear("details", "mc_mas", null, { id: "mc_mas" });
    mas.appendChild(crear("summary", null, "Archivados, copia en un fichero y los de ejemplo"));
    mas.appendChild(crear("div", "mc_archivados", null, { id: "mc_archivados" }));
    var copia = crear("div", "mc_fila mc_copia");
    copia.appendChild(boton("Guardar una copia en un fichero", "mc_boton", "mc_exportar", exportar));
    var entrada = crear("input", null, null, { id: "mc_importar_fichero", type: "file", accept: ".json,application/json" });
    entrada.style.display = "none";
    entrada.addEventListener("change", function () { importar(entrada); });
    copia.appendChild(entrada);
    copia.appendChild(boton("Traer una copia de un fichero", "mc_boton", "mc_importar", function () { entrada.click(); }));
    mas.appendChild(copia);
    mas.appendChild(crear("p", "flojo",
      "La copia es un fichero que se queda en tu ordenador (en Descargas). Sirve para pasar tus expedientes a otro " +
      "ordenador o para tenerlos a salvo. No se manda a ningún sitio."));
    var ej = crear("label", "mc_ejemplos");
    var chk = crear("input", null, null, { id: "mc_ocultar_ejemplos", type: "checkbox" });
    chk.addEventListener("change", function () {
      hecho(AL.preferencia("ocultar_ejemplos", chk.checked),
        chk.checked ? "Los de ejemplo ya no salen en tu mesa (cuando tengas alguno tuyo)." : "Los de ejemplo vuelven a salir.");
    });
    ej.appendChild(chk);
    ej.appendChild(document.createTextNode(" Esconder los expedientes de ejemplo cuando tenga alguno mío"));
    mas.appendChild(ej);
    barra.appendChild(mas);

    /* va justo antes de «Lo que te frena hoy» */
    var h1 = lista.querySelector("h1");
    var pie = $("mesa_pie");
    var ancla = pie ? pie.nextSibling : (h1 ? h1.nextSibling : lista.firstChild);
    lista.insertBefore(barra, ancla);

    /* si no se puede guardar, se dice arriba y en rojo, y no se deja meter nada */
    var d = AL.disponible();
    var sl = AL.soloLectura();
    if (!d || !d.ok || sl) {
      aviso.style.display = "";
      aviso.className = "mc_aviso_fijo mc_error";
      aviso.textContent = (sl || (d && d.porque) || "No se puede guardar.") +
        " Mientras esto salga, no se puede meter ni cambiar nada: así no se pierde trabajo sin que lo sepas.";
      [dir, quien].forEach(function (x) { x.disabled = true; });
      barra.querySelectorAll("button").forEach(function (b) { if (b.id !== "mc_exportar") b.disabled = true; });
    } else if (AL.avisoAlAbrir()) {
      aviso.style.display = "";
      aviso.className = "mc_aviso_fijo mc_info";
      aviso.textContent = AL.avisoAlAbrir();
    } else if (raiz.location && raiz.location.protocol !== "file:") {
      /* El navegador guarda aparte lo de cada dirección: lo metido abriendo
         con doble clic NO se ve abriendo desde el servidor de la voz, ni al
         revés. Comprobado en las pruebas. Se dice para que no crea que ha
         perdido sus casas. */
      aviso.style.display = "";
      aviso.className = "mc_aviso_fijo mc_info";
      aviso.textContent = "Ojo: has abierto la mesa desde el servidor de la voz (" + raiz.location.host + "). " +
        "Lo que metas aquí se guarda aparte de lo que metes abriendo LA_SECRETARIA.html con doble clic: " +
        "no se mezcla y no se pierde, pero no lo verás en la otra. Usa siempre la misma forma de abrir.";
    }
  }

  function pintarBarra() {
    var des = $("mc_deshacer_caja");
    if (des) {
      vaciar(des);
      var u = AL.loUltimo();
      if (u) {
        des.appendChild(boton("Deshacer lo último: " + u, "mc_boton mc_deshacer", "mc_deshacer", function () {
          hecho(AL.deshacer());
        }));
      }
    }
    var fm = $("mc_fechas_mesa");
    if (fm) {
      vaciar(fm);
      var pronto = [];
      AL.mios().forEach(function (e) {
        (e.fechas || []).forEach(function (f) {
          var q = diasHasta(f.fecha);
          if (q !== null && q >= -3 && q <= 14) pronto.push({ e: e, f: f, q: q });
        });
      });
      pronto.sort(function (a, b) { return a.q - b.q; });
      if (pronto.length) {
        fm.appendChild(crear("h3", "mc_sub", "Las fechas que has apuntado tú (de hace 3 días a dentro de 14)"));
        pronto.forEach(function (x) {
          var l = crear("div", "mc_fecha_linea" + (x.q < 0 ? " mc_pasada" : x.q <= 2 ? " mc_cerca" : ""));
          l.appendChild(crear("b", null, enCristiano(x.f.fecha)));
          l.appendChild(document.createTextNode(" · " + (x.q < 0 ? "hace " + (-x.q) + (x.q === -1 ? " día" : " días")
            : x.q === 0 ? "hoy" : "dentro de " + x.q + (x.q === 1 ? " día" : " días")) + " · " + x.f.que + " · "));
          var a = boton(x.e.nombre, "mc_enlace", null, function () { raiz.LA_MESA.abrirExpediente(x.e.expediente_id); });
          l.appendChild(a);
          fm.appendChild(l);
        });
        fm.appendChild(crear("p", "flojo", "Estas fechas las has escrito tú: no pasan por el repaso, así que no salen en «Lo que te frena hoy»."));
      }
    }
    var ar = $("mc_archivados");
    if (ar) {
      vaciar(ar);
      var lista = AL.archivados();
      ar.appendChild(crear("h3", "mc_sub", "Archivados (" + lista.length + ")"));
      if (!lista.length) ar.appendChild(crear("p", "flojo", "No tienes nada archivado."));
      lista.forEach(function (e) {
        var l = crear("div", "mc_archivado", null, { "data-archivado": e.expediente_id });
        l.appendChild(crear("span", null, e.nombre + " · " + (e.tipo_operacion || "") + " "));
        l.appendChild(boton("Recuperar", "mc_boton", null, function () { hecho(AL.recuperar(e.expediente_id)); }));
        l.appendChild(botonBorrar(e.expediente_id, e.nombre));
        ar.appendChild(l);
      });
    }
    var chk = $("mc_ocultar_ejemplos");
    if (chk) chk.checked = !!AL.preferencias().ocultar_ejemplos;
  }

  /* Borrar pregunta ANTES, en la propia página. */
  function botonBorrar(id, nombre) {
    var caja = crear("span", "mc_borrar_caja");
    var b = boton("Borrar para siempre", "mc_boton mc_peligro", null, function () {
      vaciar(caja);
      caja.appendChild(crear("span", "mc_pregunta", "¿Borrar «" + nombre + "» de este ordenador? "));
      caja.appendChild(boton("Sí, bórralo", "mc_boton mc_peligro", "mc_si_borrar", function () {
        hecho(AL.borrar(id, "confirmado"), "Borrado. Si ha sido sin querer, pulsa «Deshacer lo último».");
        if (raiz.LA_MESA && raiz.LA_MESA.estado().abierto === id) raiz.LA_MESA.volverALaMesa();
      }));
      caja.appendChild(boton("No", "mc_boton", "mc_no_borrar", function () {
        vaciar(caja); caja.appendChild(botonBorrar(id, nombre));
      }));
    });
    caja.appendChild(b);
    return caja;
  }

  function plano(t) {
    t = String(t || "").toLowerCase();
    return t.normalize ? t.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : t;
  }
  /* Esconde las tarjetas que no tienen lo buscado. No toca nada más:
     lo que te frena y lo que vence siguen enteros. */
  function filtrar() {
    var q = $("mc_buscar"), cont = $("mesa_expedientes"), n = $("mc_buscar_cuantos");
    if (!q || !cont) return;
    var palabras = plano(q.value).split(/\s+/).filter(Boolean);
    var total = 0, salen = 0, extra = {};
    /* el propietario no sale en la tarjeta, pero se busca igual */
    ((raiz.LA_SECRETARIA_MESA || {}).expedientes || []).forEach(function (e) {
      extra[String(e.expediente_id || e.id)] = (e.propietario && e.propietario.nombre) || "";
    });
    cont.querySelectorAll(".exp_mesa").forEach(function (c) {
      total++;
      var t = plano(c.textContent + " " + (extra[c.getAttribute("data-exp")] || ""));
      var si = palabras.every(function (w) { return t.indexOf(w) >= 0; });
      c.style.display = si ? "" : "none";
      if (si) salen++;
    });
    if (n) n.textContent = palabras.length ? (salen === 1 ? "Sale 1 de " : "Salen " + salen + " de ") + total +
      (salen ? "." : ". Prueba con menos palabras o sin el número.") : "";
  }

  /* ------------------------------------------------------------------
     4 · LAS TARJETAS DE LA MESA: SE SEÑALA CUÁL ES SUYA Y CUÁL DE EJEMPLO
     y el pie de la mesa dice la verdad cuando ya hay casas suyas
     ------------------------------------------------------------------ */
  function decorarMesa() {
    var cont = $("mesa_expedientes");
    if (!cont) return;
    var mios = AL.mios().length;
    /* sin casas suyas la mesa se queda EXACTAMENTE como estaba: ni sellos */
    if (mios > 0) cont.querySelectorAll(".exp_mesa").forEach(function (c) {
      if (c.querySelector(".mc_sello")) return;
      var id = c.getAttribute("data-exp");
      var suyo = AL.esMio(id);
      var s = crear("span", "mc_sello " + (suyo ? "mc_sello_tuyo" : "mc_sello_ejemplo"), suyo ? "TUYO" : "EJEMPLO");
      c.insertBefore(s, c.firstChild);
    });
    var pie = $("mesa_pie");
    if (pie && mios > 0) {
      var ej = (raiz.LA_SECRETARIA_MESA.expedientes || []).length - mios;
      pie.textContent = "Tienes " + (mios === 1 ? "1 expediente tuyo" : mios + " expedientes tuyos") +
        ", guardado" + (mios === 1 ? "" : "s") + " solo en este ordenador." +
        (ej > 0 ? " Los " + (ej === 1 ? "" : ej + " ") + "de ejemplo están inventados y rotulados EJEMPLO." : "") +
        " Nada de esto se manda a ningún servidor.";
    }
  }

  /* ------------------------------------------------------------------
     5 · DENTRO DE UNA FICHA: «CAMBIAR ESTE EXPEDIENTE»
     ------------------------------------------------------------------ */
  function idDeLaFicha(ficha) {
    var t = ficha.querySelector(".ficha_id");
    if (!t) return null;
    return String(t.textContent || "").replace(/^Expediente\s+/, "").trim();
  }

  function decorarFicha() {
    var ficha = $("mesa_ficha");
    if (!ficha || ficha.style.display === "none" || ficha.querySelector("#mc_panel")) return;
    var id = idDeLaFicha(ficha);
    if (!id) return;
    if (id !== FICHA_ANTERIOR) { ULTIMO = null; FICHA_ANTERIOR = id; }
    var panel = crear("section", "mc_panel", null, { id: "mc_panel" });
    if (!AL.esMio(id)) {
      panel.appendChild(crear("p", "mc_nota_ejemplo",
        "Este expediente es de ejemplo: está inventado y no se cambia. Para trabajar con una casa tuya, " +
        "vuelve a tu mesa y pulsa «Meter una casa»."));
      insertarPanel(ficha, panel);
      return;
    }
    var e = AL.uno(id);
    panel.appendChild(crear("h3", "mc_titulo", "Cambiar este expediente"));
    var mf = crear("div", "mc_mensaje", null, { id: "mc_mensaje_ficha", "aria-live": "polite" });
    mf.style.display = "none";
    if (ULTIMO) { mf.className = "mc_mensaje mc_" + ULTIMO.tipo; mf.textContent = ULTIMO.texto; mf.style.display = ""; }
    panel.appendChild(mf);
    var u = AL.loUltimo();
    if (u) panel.appendChild(boton("Deshacer lo último: " + u, "mc_boton mc_deshacer", "mc_deshacer_ficha", function () { hecho(AL.deshacer()); }));

    /* --- la fase: un botón por fase, que apunta el papel que la demuestra --- */
    var fases = AL.FASES[e.tipo_operacion] || [];
    var cf = crear("div", "mc_bloque");
    cf.appendChild(crear("h4", "mc_sub", "Pasar de fase"));
    var ff = crear("div", "mc_fila mc_botones");
    var fechaFase = crear("input", "mc_entrada mc_fecha", null, { id: "mc_fase_fecha", type: "date", "aria-label": "Fecha" });
    fases.forEach(function (f) {
      ff.appendChild(boton(f.texto, "mc_boton", "mc_fase_" + f.clave, function () {
        /* SIN FRASE PROPIA (21/09/2026). Antes aquí iba escrito «Hecho:
           «Notaría con fecha». Apuntado en sus papeles y guardado.», y
           esa frase tapaba lo que de verdad se había apuntado. Ahora se
           enseña lo que dice el almacén: si la fecha todavía no ha
           llegado, dirá «confirmada para el 3 de octubre de 2027», no
           «ha llegado». */
        hecho(AL.cambiarFase(id, f.clave, fechaFase.value || null));
      }));
    });
    cf.appendChild(ff);
    var lf = crear("label", "mc_etiqueta", "Fecha (la de la notaría, o si no fue hoy): ");
    lf.appendChild(fechaFase);
    cf.appendChild(lf);
    cf.appendChild(carteldelOrden(fechaFase));
    cf.appendChild(crear("p", "flojo", "La fase sale de los papeles: al pulsar, se apunta el papel que lo demuestra (arras, cita de notaría, escritura, contrato o fianza)."));
    panel.appendChild(cf);

    /* --- los papeles --- */
    var cp = crear("div", "mc_bloque");
    cp.appendChild(crear("h4", "mc_sub", "Papeles"));
    var docs = e.documentos || [];
    if (!docs.length) cp.appendChild(crear("p", "flojo", "Todavía no has apuntado ningún papel."));
    docs.forEach(function (d, i) {
      var l = crear("div", "mc_papel", null, { "data-papel": d.cual });
      l.appendChild(crear("span", "mc_papel_cual", d.cual));
      var sel = crear("select", "mc_entrada mc_estado", null, { "aria-label": "Cómo está " + d.cual });
      /* Los cuatro de siempre. Y si la aplicación ha puesto «confirmado»
         porque la fecha todavía no ha llegado (21/09/2026), sale también
         en la lista: si no, el desplegable enseñaría «falta» sin que
         nadie lo haya cambiado, y al dar a Guardar lo cambiaría de
         verdad. Lo de arriba no puede contradecir a lo de abajo. */
      var opciones = ["falta", "pedido", "recibido", "verificado"];
      if (d.estado_documento === "confirmado") opciones = opciones.concat(["confirmado"]);
      opciones.forEach(function (s) {
        var o = crear("option", null, s, { value: s }); if (s === d.estado_documento) o.selected = true; sel.appendChild(o);
      });
      var fe = crear("input", "mc_entrada mc_fecha", null, { type: "date", value: d.fecha || "", "aria-label": "Fecha de " + d.cual });
      l.appendChild(sel); l.appendChild(fe); l.appendChild(carteldelOrden(fe));
      l.appendChild(boton("Guardar", "mc_boton", null, function () { hecho(AL.ponerPapel(id, d.cual, sel.value, fe.value || null)); }));
      if (d.estado_documento !== "recibido" && d.estado_documento !== "verificado") {
        l.appendChild(boton("Ha llegado hoy", "mc_boton mc_principal", "mc_llego_" + i, function () {
          hecho(AL.ponerPapel(id, d.cual, "recibido", AL.hoy()), "Apuntado: «" + d.cual + "» ha llegado hoy.");
        }));
      }
      l.appendChild(boton("Quitar", "mc_boton mc_suave", null, function () { hecho(AL.quitarPapel(id, d.cual)); }));
      cp.appendChild(l);
    });
    /* añadir uno: los que pide la tabla del repaso para esta operación, y «otro» */
    var np = crear("div", "mc_fila mc_nuevo_papel");
    var elegir = crear("select", "mc_entrada", null, { id: "mc_papel_elegir", "aria-label": "Qué papel" });
    var R = raiz.IMMOIA_REPASO;
    var tabla = (R && R.CARPETA && R.CARPETA[e.tipo_operacion]) || [];
    elegir.appendChild(crear("option", null, "Elige un papel…", { value: "" }));
    tabla.forEach(function (t) { elegir.appendChild(crear("option", null, t.cual, { value: t.cual })); });
    elegir.appendChild(crear("option", null, "Otro (lo escribo yo)", { value: "__otro" }));
    var otro = crear("input", "mc_entrada", null, { id: "mc_papel_otro", type: "text", placeholder: "Nombre del papel", "aria-label": "Nombre del papel" });
    otro.style.display = "none";
    elegir.addEventListener("change", function () { otro.style.display = elegir.value === "__otro" ? "" : "none"; });
    var est = crear("select", "mc_entrada", null, { id: "mc_papel_estado", "aria-label": "Cómo está" });
    [["pedido", "pedido"], ["recibido", "ha llegado"], ["falta", "falta"], ["verificado", "verificado"]].forEach(function (s) {
      est.appendChild(crear("option", null, s[1], { value: s[0] }));
    });
    np.appendChild(elegir); np.appendChild(otro); np.appendChild(est);
    np.appendChild(boton("Añadir papel", "mc_boton", "mc_papel_anadir", function () {
      var cual = elegir.value === "__otro" ? otro.value : elegir.value;
      hecho(AL.ponerPapel(id, cual, est.value, null));
    }));
    cp.appendChild(np);
    panel.appendChild(cp);

    /* --- una fecha --- */
    var cfe = crear("div", "mc_bloque");
    cfe.appendChild(crear("h4", "mc_sub", "Apuntar una fecha"));
    var fq = crear("input", "mc_entrada", null, { id: "mc_fecha_que", type: "text", list: "mc_fecha_sugerencias",
      placeholder: "Para qué (cita de notaría, llamar al banco…)", "aria-label": "Para qué es la fecha" });
    var dl = crear("datalist", null, null, { id: "mc_fecha_sugerencias" });
    ["cita de notaría", "visita con el comprador", "llamar al administrador", "entrega de llaves", "tasación del banco"].forEach(function (s) {
      dl.appendChild(crear("option", null, null, { value: s }));
    });
    var fd = crear("input", "mc_entrada mc_fecha", null, { id: "mc_fecha_dia", type: "date", "aria-label": "Día" });
    var ffe = crear("div", "mc_fila");
    ffe.appendChild(fq); ffe.appendChild(dl); ffe.appendChild(fd); ffe.appendChild(carteldelOrden(fd));
    ffe.appendChild(boton("Apuntar", "mc_boton", "mc_fecha_apuntar", function () { hecho(AL.apuntarFecha(id, fq.value, fd.value)); }));
    cfe.appendChild(ffe);
    (e.fechas || []).forEach(function (f, i) {
      var l = crear("div", "mc_fecha_linea");
      l.appendChild(crear("b", null, enCristiano(f.fecha)));
      l.appendChild(document.createTextNode(" · " + f.que + " "));
      l.appendChild(boton("Quitar", "mc_boton mc_suave", null, function () { hecho(AL.quitarFecha(id, i)); }));
      cfe.appendChild(l);
    });
    panel.appendChild(cfe);

    /* --- una nota --- */
    var cn = crear("div", "mc_bloque");
    cn.appendChild(crear("h4", "mc_sub", "Notas"));
    var ta = crear("textarea", "mc_entrada mc_nota", null, { id: "mc_nota_texto", rows: "3", "aria-label": "Nota",
      placeholder: "Lo que te han dicho, lo que tienes que acordarte…" });
    cn.appendChild(ta);
    cn.appendChild(boton("Guardar la nota", "mc_boton", "mc_nota_guardar", function () { hecho(AL.escribirNota(id, ta.value)); }));
    (e.notas || []).forEach(function (n) {
      var l = crear("div", "mc_nota_linea");
      l.appendChild(crear("b", null, enCristiano(n.fecha) + ": "));
      l.appendChild(crear("span", "mc_nota_texto", n.texto));
      cn.appendChild(l);
    });
    panel.appendChild(cn);

    /* --- corregir la dirección o el propietario --- */
    var cc = crear("details", "mc_bloque");
    cc.appendChild(crear("summary", null, "Corregir la dirección o de quién es"));
    var cd = crear("input", "mc_entrada", null, { id: "mc_corregir_dir", type: "text", value: (e.vivienda && e.vivienda.via) || "", "aria-label": "Dirección" });
    var cq = crear("input", "mc_entrada", null, { id: "mc_corregir_quien", type: "text", value: (e.propietario && e.propietario.nombre) || "", placeholder: "De quién es", "aria-label": "Propietario" });
    cc.appendChild(cd); cc.appendChild(cq);
    cc.appendChild(boton("Guardar la corrección", "mc_boton", "mc_corregir", function () {
      hecho(AL.corregir(id, { direccion: cd.value, propietario: cq.value }));
    }));
    panel.appendChild(cc);

    /* --- cerrar: archivar o borrar --- */
    var cx = crear("div", "mc_bloque mc_cerrar");
    cx.appendChild(crear("h4", "mc_sub", "Cuando esté cerrado"));
    cx.appendChild(boton("Archivar (se puede recuperar)", "mc_boton", "mc_archivar", function () {
      var r = AL.archivar(id);
      if (r.ok && raiz.LA_MESA) raiz.LA_MESA.volverALaMesa();
      hecho(r, "Archivado. Ya no sale en tu mesa; lo tienes en «Archivados», abajo del todo de la mesa.");
    }));
    cx.appendChild(botonBorrar(id, e.nombre));
    panel.appendChild(cx);

    insertarPanel(ficha, panel);
  }
  function insertarPanel(ficha, panel) {
    /* justo antes de «Sus papeles», para que se vea sin bajar mucho */
    var h = null;
    ficha.querySelectorAll("h3").forEach(function (x) { if (!h && /Sus papeles/.test(x.textContent)) h = x; });
    if (h) ficha.insertBefore(panel, h); else ficha.appendChild(panel);
  }

  /* ------------------------------------------------------------------
     6 · COPIA EN UN FICHERO
     ------------------------------------------------------------------ */
  function exportar() {
    try {
      var blob = new Blob([AL.comoFichero()], { type: "application/json" });
      var a = crear("a", null, null, { download: "mis_expedientes_" + AL.hoy() + ".json" });
      a.href = URL.createObjectURL(blob);
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      decir("bien", "Copia hecha: «mis_expedientes_" + AL.hoy() + ".json», en tu carpeta de Descargas.");
    } catch (e) {
      decir("error", "No he podido hacer la copia: " + (e && e.message ? e.message : e));
    }
  }
  function importar(entrada) {
    var f = entrada.files && entrada.files[0];
    if (!f) return;
    var lector = new FileReader();
    lector.onload = function () { hecho(AL.desdeFichero(lector.result)); entrada.value = ""; };
    lector.onerror = function () { decir("error", "No he podido leer ese fichero."); };
    lector.readAsText(f, "utf-8");
  }

  /* ------------------------------------------------------------------
     7 · ARRANQUE: se engancha cuando la mesa está en la página
     ------------------------------------------------------------------ */
  function arrancar() {
    montarBarra();
    pintarBarra();
    decorarMesa();
    var obs = new MutationObserver(function () { decorarMesa(); decorarFicha(); });
    ["mesa_expedientes", "mesa_ficha"].forEach(function (x) {
      var n = $(x); if (n) obs.observe(n, { childList: true, attributes: true, attributeFilter: ["style"] });
    });
    decorarFicha();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();

  raiz.IMMOIA_METER = { refrescar: refrescar, version: "1.0" };
})(typeof window !== "undefined" ? window : this);
