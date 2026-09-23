/* ==================================================================
   IMMO IA · pantalla.js — LO QUE VE LA DIRECTORA
   ------------------------------------------------------------------
   Aquí no se calcula nada: solo se pinta lo que han dicho el lector,
   la deducción, repaso.js y los seis órdenes.

   REGLA DE PANTALLA: ninguna frase que el código no sostenga. Cada
   aviso sale con el botón «de dónde lo saco», y ese botón enseña el
   fichero (o los ficheros) de los que salió. Si un aviso no tiene
   ficheros detrás, NO se pinta.
   ================================================================== */
(function () {
  "use strict";

  var E = {};   /* el estado de toda la sesión */
  window.__WOW = E;

  function $(id) { return document.getElementById(id); }
  function crear(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }
  function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  /* SINGULAR Y PLURAL · ARREGLO DEL 20/09/2026.
     «1 ficheros», «1 carpetas», «dentro de 1 días»: son las frases que
     delatan que esto lo ha escrito un programa, y salen en la pantalla
     grande. Se dicen con esta función y no a mano. */
  function nCosas(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function nDias(n) { return nCosas(n, "día", "días"); }
  function pantalla(cual) {
    ["puerta", "trabajando", "parte"].forEach(function (p) {
      $("p_" + p).style.display = (p === cual) ? "" : "none";
    });
    E.pantalla = cual;
  }
  function tamano(b) {
    if (b == null) return "";
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  }

  /* ==================================================================
     1. LA PUERTA
     ================================================================== */
  /* ------------------------------------------------------------------
     ¿PUEDE ESTE NAVEGADOR ABRIR LA VENTANA DE «ELEGIR CARPETA»?
     ------------------------------------------------------------------
     ARREGLO DEL 23/09/2026. Ayer, probando con las manos, el botón
     «Elegir carpeta» no hacía NADA y no decía nada. Esto es lo que
     pasaba, comprobado ejecutándolo:

     · La comprobación de antes solo miraba si existía la función
       (`showDirectoryPicker`). En una página abierta con DOBLE CLIC
       (dirección `file://`) la función existe... y al llamarla el
       navegador la rechaza. Así que el botón se enseñaba y no hacía
       nada.
     · Y el rechazo llegaba con el nombre `AbortError`, que es el mismo
       nombre que usa el navegador cuando la persona le da a «Cancelar».
       El código de antes, con buen criterio, se callaba ante un
       `AbortError`. Resultado: silencio absoluto.

     Ahora: con doble clic ese botón NO se enseña, y si aun así algo
     falla, se dice en pantalla. Nunca se queda muda.
     ------------------------------------------------------------------ */
  function puedeAbrirLaVentanaDeCarpetas() {
    if (typeof window.showDirectoryPicker !== "function") return false;
    try { if (window.location && window.location.protocol === "file:") return false; } catch (e) {}
    return true;
  }

  function arrancar() {
    var cap = window.IMMOIA_COPIA.queSabeHacerEsteNavegador();
    E.navegador = cap;
    E.puede_elegir_carpeta = puedeAbrirLaVentanaDeCarpetas();
    $("que_sabe").textContent = cap.frase;
    $("boton_carpeta_real").style.display = E.puede_elegir_carpeta ? "" : "none";

    var zona = $("zona");
    ["dragenter", "dragover"].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); zona.classList.add("encima"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      zona.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); zona.classList.remove("encima"); });
    });
    zona.addEventListener("drop", function (e) {
      e.preventDefault();
      permitirLaVoz();
      /* dataTransfer hay que leerlo AQUÍ, sin esperar a nada */
      E.origen = "arrastrar";
      window.IMMOIA_LECTOR.desdeSoltar(e.dataTransfer).then(conLosFicheros, seRompio);
      pantalla("trabajando");
      $("t_que").textContent = "Abriendo lo que me has soltado…";
    });

    $("entrada_carpeta").addEventListener("change", function (e) {
      E.origen = "boton_universal";
      pantalla("trabajando");
      $("t_que").textContent = "Abriendo la carpeta…";
      window.IMMOIA_LECTOR.desdeInput(e.target.files).then(conLosFicheros, seRompio);
    });
    $("boton_carpeta").addEventListener("click", function () {
      permitirLaVoz();
      $("error").style.display = "none";
      $("entrada_carpeta").click();
    });
    $("boton_carpeta_real").addEventListener("click", function () {
      permitirLaVoz();
      $("error").style.display = "none";
      /* Un «Cancelar» de verdad tarda: la persona tiene que ver la
         ventana y pulsar. Si el rechazo llega en menos de un cuarto de
         segundo, ahí no ha cancelado nadie: es que la ventana no se ha
         llegado a abrir, y eso SÍ se dice. */
      var empezo = Date.now();
      var p;
      try {
        p = window.showDirectoryPicker({ mode: "read" });
      } catch (err) {
        noSePudoAbrirLaVentana(err);
        return;
      }
      p.then(function (h) {
        E.handleOrigen = h;
        E.origen = "elegir_carpeta";
        pantalla("trabajando");
        $("t_que").textContent = "Abriendo «" + h.name + "»…";
        return window.IMMOIA_LECTOR.desdeCarpetaDeVerdad(h).then(conLosFicheros);
      }).catch(function (err) {
        var deprisa = (Date.now() - empezo) < 250;
        if (err && err.name === "AbortError" && !deprisa) return;   /* le dio a cancelar */
        if (err && err.name === "AbortError") { noSePudoAbrirLaVentana(err); return; }
        seRompio(err);
      });
    });
    $("volver").addEventListener("click", function () { location.reload(); });
    var callar = $("boton_callar");
    if (callar) {
      callar.addEventListener("click", function () {
        if (!window.IMMOIA_VOZ) return;
        if (window.IMMOIA_VOZ.estaCallada()) {
          window.IMMOIA_VOZ.volverAHablar();
          callar.textContent = "Callar la voz";
          window.IMMOIA_VOZ.contar(E);
        } else {
          window.IMMOIA_VOZ.callar();
          callar.textContent = "Volver a contármelo";
          var est = $("voz_estado");
          if (est) est.textContent = "La voz está callada. Lo tienes escrito aquí debajo.";
        }
      });
    }
    pantalla("puerta");
  }

  /* El mensaje de error llevaba style.display = "" y en la hoja de
     estilos #error tiene display:none, así que NINGÚN error se veía
     nunca: si algo se rompía, ella se quedaba mirando la pantalla de
     inicio sin explicación. Tiene que ser "block". */
  /* La ventana de elegir carpeta no se ha abierto. Se dice, se esconde
     ese botón para que no lo vuelva a pulsar, y se le enseña el camino
     que sí funciona. */
  function noSePudoAbrirLaVentana(err) {
    E.puede_elegir_carpeta = false;
    $("boton_carpeta_real").style.display = "none";
    $("error").style.display = "block";
    $("error").textContent = "Este navegador no me ha dejado abrir la ventana de elegir carpeta" +
      (err && err.name ? " (" + err.name + ")" : "") +
      ". Usa el botón «Elegir carpeta» de arriba, o arrastra la carpeta al recuadro: " +
      "las dos formas funcionan igual de bien.";
    var b = $("boton_carpeta");
    if (b) { try { b.focus(); } catch (e) {} }
  }

  function permitirLaVoz() {
    if (window.IMMOIA_VOZ && typeof window.IMMOIA_VOZ.permitir === "function") {
      window.IMMOIA_VOZ.permitir();
    }
  }

  function seRompio(e) {
    pantalla("puerta");
    $("error").style.display = "block";
    $("error").textContent = "No he podido con eso: " + ((e && e.message) || e);
  }

  /* ==================================================================
     2. TRABAJAR
     ================================================================== */
  function conLosFicheros(ficheros) {
    E.ficheros = ficheros;
    E.carpetas_vacias = ficheros.vacias || [];
    if (!ficheros.length) {
      pantalla("puerta");
      $("error").style.display = "block";
      $("error").textContent = "Ahí dentro no he encontrado ni un fichero. " +
        "Si la carpeta tiene subcarpetas, arrástrala entera en vez de elegirla.";
      return;
    }
    $("t_que").textContent = "Mirando " + nCosas(ficheros.length, "fichero", "ficheros") + ". Los PDF con texto los abro y los leo.";
    barra(0, ficheros.length);
    return window.IMMOIA_LECTOR.leerPorDentro(ficheros, function (hechos, total, f) {
      barra(hechos, total);
      $("t_detalle").textContent = f.nombre;
    }).then(function (cuenta) {
      E.cuenta = cuenta;
      $("t_que").textContent = "Comparando los papeles entre sí para ver cuáles están repetidos…";
      $("t_detalle").textContent = "";
      barra(0, ficheros.length);
      return window.IMMOIA_LECTOR.huellasDeContenido(ficheros, function (a, b) { barra(a, b); });
    }).then(function () {
      $("t_que").textContent = "Deduciendo de qué expediente es cada papel…";
      return new Promise(function (r) { setTimeout(r, 30); });
    }).then(function () {
      var g = window.IMMOIA_DEDUCCION.agrupar(E.ficheros, {});
      E.expedientes = g.expedientes;
      E.sueltos = g.sueltos;
      E.duplicados = g.duplicados;
      E.repaso = window.IMMOIA_REPASO.repasar(E.expedientes);
      /* Se filtra ANTES de ordenar: lo que no se dice en pantalla tampoco
         puede mandar en cómo se ordenan las carpetas. Si un aviso está
         callado porque no nos lo creemos, no puede seguir decidiendo que
         un expediente va en «01_YA_SE_PASO_EL_PLAZO». */
      filtrarHallazgos();
      /* El parte se rehace sobre los avisos que van a pintarse de verdad.
         Si no, el titular cuenta uno y la lista de abajo pinta otro, y la
         primera frase de la pantalla ya no la sostiene el código. */
      var dichos = E.hallazgos_utiles;
      E.repaso = window.IMMOIA_REPASO.soloConLoQueSeDice(E.repaso,
        function (h) { return dichos.indexOf(h) >= 0; });
      E.hallazgos_utiles = E.repaso.hallazgos;
      E.planes = window.IMMOIA_ORDENES.todos(E);
      pintarParte();
      pantalla("parte");
    }).catch(seRompio);
  }

  /* ==================================================================
     LO QUE NO SE DICE, Y POR QUÉ
     ------------------------------------------------------------------
     Cinco razones para callar un aviso. Las cinco quedan apuntadas en
     E.callados, con el motivo, para poder responder si alguien pregunta.
     ================================================================== */
  function filtrarHallazgos() {
    var porExp = {};
    E.expedientes.forEach(function (e) { porExp[e.expediente_id] = e; });
    E.callados = [];
    E.hallazgos_utiles = E.repaso.hallazgos.filter(function (h) {
      var e = porExp[h.exp];
      if (!e) return false;
      var callar = null;

      /* 1 · se contradice con un fichero que está ahí, con su nombre */
      var desmentido = window.IMMOIA_DEDUCCION.avisoDesmentido(h, e);
      if (desmentido) callar = "lo desmiente el fichero «" + desmentido.fichero.ruta + "»";

      /* 2 · el plazo se pasó hace tanto que no es la noticia de hoy */
      if (!callar) {
        var viejo = window.IMMOIA_DEDUCCION.plazoDemasiadoViejo(h, e, E.repaso.hoy);
        if (viejo) callar = "el contrato es de hace " + viejo.meses + " meses: que el resguardo no " +
          "esté hoy en la carpeta no prueba que no se depositara en su día";
      }
      /* 3 · cuelga de un contrato que todavía es un borrador */
      if (!callar) {
        var b = window.IMMOIA_DEDUCCION.colgadoDeUnBorrador(h, e);
        if (b) callar = "el contrato todavía es un borrador («" + b.ruta + "»)";
      }
      /* 4 · el expediente acaba de abrirse */
      if (!callar && h.clase === "falta") {
        var n = window.IMMOIA_DEDUCCION.recienAbierto(e, E.repaso.hoy);
        if (n) callar = "el expediente se abrió hace " + nDias(n.dias);
      }
      /* 5 · no puede señalar ni un papel del que salga.
         LA REGLA de la casa: si no puede señalar el fichero, no lo dice.
         Estaba aplicada al pintar, pero no aquí, así que un aviso que
         nunca llegaba a la pantalla seguía contando en el parte y en
         cómo se ordenan las carpetas. Ahora se calla en el mismo sitio
         que los demás, y con su motivo apuntado. */
      if (!callar) {
        var pr = window.IMMOIA_DEDUCCION.pruebasDelAviso(h, e);
        if (!pr.ficheros.length) callar = "no puedo señalar ni un papel del que salga este aviso";
      }

      if (callar) {
        E.callados.push({ aviso: h.titulo, donde: h.donde, por_que: callar });
        return false;
      }
      return true;
    });
  }

  function barra(a, b) {
    $("barra_dentro").style.width = (b ? Math.round(a * 100 / b) : 0) + "%";
    $("t_cuantos").textContent = a + " / " + b;
  }

  /* ==================================================================
     3. EL PARTE
     ================================================================== */
  function pintarParte() {
    pintarCuentas();
    pintarLoQueDice();
    pintarBloques();
    pintarOrdenes();
    contarEnAlto();
  }

  /* LA VOZ · dice lo que ya está pintado, ni una palabra más.
     Si no hay voz instalada en español, esto deja el texto escrito y no
     se rompe nada. */
  function contarEnAlto() {
    if (!window.IMMOIA_VOZ) return;
    try { window.IMMOIA_VOZ.contar(E); } catch (e) {}
  }

  /* --- 3.1 lo que he leído y lo que no, con el número exacto --- */
  function pintarCuentas() {
    var c = E.cuenta, caja = $("cuentas");
    vaciar(caja);

    var carpetas = {};
    E.ficheros.forEach(function (f) { carpetas[f.carpeta] = 1; });

    /* ARREGLO DE REDACCIÓN (20/09/2026): aquí se leía «1 fichero
       repartidos en 1 carpeta» delante del cliente. El nombre iba en
       singular y el participio se quedaba en plural. El participio tiene
       que ir con el mismo número que el nombre al que acompaña. */
    linea(caja, "He encontrado " + nCosas(c.total, "fichero", "ficheros") +
                (c.total === 1 ? " repartido en " : " repartidos en ") +
                nCosas(Object.keys(carpetas).length, "carpeta", "carpetas") + ".", "neutro");

    var l2 = linea(caja, window.IMMOIA_LECTOR.frameDeHonradez(c),
                   c.no_leidos ? "ojo" : "bien");
    l2.appendChild(detalleLectura());

    linea(caja, "Los he agrupado en " + E.expedientes.length +
          (E.expedientes.length === 1 ? " expediente." : " expedientes.") +
          (E.sueltos.length
            ? " " + E.sueltos.length + (E.sueltos.length === 1
                ? " papel no dice de quién es, ni por el nombre ni por dentro: no me lo invento."
                : " papeles no dicen de quién son, ni por el nombre ni por dentro: no me los invento.")
            : ""), "neutro");

    /* LOS QUE PESAN DEMASIADO · ARREGLO DEL 20/09/2026.
       Se dice con todas las letras: cuál era, cuánto pesaba, por qué no
       lo he abierto, y que lo demás SÍ lo he mirado. Callarlo sería
       exactamente lo mismo que caerse en silencio. */
    if (c.demasiado_grandes) {
      var cuantos = c.demasiado_grandes;
      var mirados = c.total - cuantos;
      var gordos = c.los_demasiado_grandes || [];
      /* EL NOMBRE, A LA VISTA. Esconderlo detrás de un botón no es
         decirle qué fichero se ha saltado: es decírselo si pregunta.
         Hasta tres se nombran aquí mismo; de ahí en adelante, la lista
         entera está en el botón de al lado. */
      var cuales = gordos.length <= 3
        ? gordos.map(function (g) { return "«" + g.ruta + "» (" + g.cuanto + ")"; }).join(" y ")
        : gordos.slice(0, 3).map(function (g) { return "«" + g.ruta + "» (" + g.cuanto + ")"; }).join(", ") +
          " y " + (gordos.length - 3) + " más";
      var lg = linea(caja,
        "Me he saltado " + cuantos + (cuantos === 1 ? " fichero porque pesa" : " ficheros porque pesan") +
        " demasiado para abrirlo" + (cuantos === 1 ? "" : "s") + " aquí dentro: " + cuales +
        ". Por encima de 60 MB el navegador se cae y te quedarías sin nada. No " +
        (cuantos === 1 ? "lo" : "los") + " he abierto, pero " + (cuantos === 1 ? "está" : "están") +
        " ahí y " + (cuantos === 1 ? "lo" : "los") + " cuento: veo su nombre, su tamaño y su fecha. " +
        "Los otros " + mirados + " sí los he mirado, y lo que te digo abajo sale de ellos.", "ojo");
      lg.appendChild(botonPruebas("ver cuáles son", [{
        titulo: "Los que no he abierto por el tamaño (" + cuantos + ")",
        ficheros: c.los_demasiado_grandes.map(function (g) {
          return { nombre: g.ruta, papel: g.cuanto };
        })
      }]));
    }

    var porCarpeta = E.ficheros.filter(function (f) { return f.agrupado_por_la_carpeta; }).length;
    if (porCarpeta) {
      linea(caja, "De los " + c.total + ", " + porCarpeta + (porCarpeta === 1
        ? " fichero lo he colocado solo por la carpeta en la que estaba, porque él por sí mismo no dice nada."
        : " ficheros los he colocado solo por la carpeta en la que estaban, porque ellos por sí mismos no dicen nada."), "ojo");
    }
    if (E.duplicados.length) {
      var sobran = E.duplicados.reduce(function (n, g) { return n + g.sobran.length; }, 0);
      var conOtroNombre = E.duplicados.filter(function (g) { return g.nombres_distintos; }).length;
      /* Lo que se dice aquí tiene que ser lo que se ha hecho de verdad:
         se comparan por CONTENIDO, no por nombre y tamaño. */
      var l = linea(caja, "Hay " + sobran + (sobran === 1 ? " papel repetido" : " papeles repetidos") +
        (sobran === 1 ? ": lo he comparado por dentro, byte a byte, no por el nombre."
                      : ": los he comparado por dentro, byte a byte, no por el nombre.") +
        (conOtroNombre
          ? " " + (conOtroNombre === 1 && sobran === 1 ? "Y está" : conOtroNombre + (conOtroNombre === 1
              ? " de ellos está" : " de ellos están")) + (conOtroNombre === 1
              ? " guardado dos veces con nombres distintos, así que a simple vista no se ve."
              : " guardados dos veces con nombres distintos, así que a simple vista no se ven.")
          : "") +
        " No borro ninguno: los aparto.", "ojo");
      l.appendChild(botonPruebas("ver cuáles", E.duplicados.map(function (g) {
        return { titulo: g.nombre + " — está " + g.cuantos + " veces (" + g.como_se_ha_visto + ")",
                 ficheros: [g.se_queda].concat(g.sobran).map(function (f) {
                   return { nombre: f.ruta, papel: tamano(f.bytes) };
                 }) };
      })));
    }
    /* Con el botón de toda la vida el navegador NO enseña las carpetas
       vacías: para él no existen. Callarlo sería dar una cuenta a medias. */
    if (E.origen === "boton_universal") {
      linea(caja, "Con este botón el navegador no me deja ver las carpetas vacías: para él no existen. " +
                  "Si quieres que también las cuente, arrástrame la carpeta en vez de elegirla.", "ojo");
    }
    if (E.carpetas_vacias.length) {
      var lv = linea(caja, "Hay " + E.carpetas_vacias.length +
        (E.carpetas_vacias.length === 1 ? " carpeta vacía." : " carpetas vacías."), "neutro");
      lv.appendChild(botonPruebas("ver cuáles", [{ titulo: "Carpetas sin nada dentro",
        ficheros: E.carpetas_vacias.map(function (r) { return { nombre: r, papel: "" }; }) }]));
    }
  }

  function detalleLectura() {
    var b = botonPruebas("ver el detalle, fichero a fichero", [
      { titulo: "Los que he podido leer por dentro (" + E.cuenta.leidos + ")",
        ficheros: E.ficheros.filter(function (f) { return f.lectura === "leido"; })
          .map(function (f) { return { nombre: f.ruta, papel: f.papel ? f.papel.cual : "" }; }) },
      { titulo: "Los que NO he podido abrir (" + E.cuenta.no_leidos + ")",
        ficheros: E.ficheros.filter(function (f) { return f.lectura !== "leido"; })
          .map(function (f) { return { nombre: f.ruta, papel: f.motivo_no_leido }; }) }
    ]);
    return b;
  }

  function linea(caja, texto, clase) {
    var d = crear("div", "cuenta " + (clase || ""));
    d.appendChild(crear("span", "cuenta_txt", texto));
    caja.appendChild(d);
    return d;
  }

  /* --- 3.2 el parte de repaso.js, y LA REGLA DE ARRIBA Y ABAJO ---
     ------------------------------------------------------------------
     ARREGLO DEL 20/09/2026. LA REGLA DE LA CASA: lo que dice el titular
     grande no puede contradecir lo que dice la cuenta de arriba.

     Lo que pasaba: con papeles escaneados, arriba ponía «He encontrado
     122 ficheros repartidos en 25 carpetas» y aquí abajo, en la letra
     más grande de la pantalla, «Todavía no tienes ningún expediente
     encima de la mesa. Abre el primero». Es mentira, y es mentira
     delante de sus propios papeles.

     El repaso (repaso.js) NO tiene la culpa ni se toca: él solo ve la
     lista de expedientes, y si la lista viene vacía dice lo que le
     corresponde decir en la mesa, donde de verdad no hay ninguno.
     Quien sabe cuántos papeles y cuántas carpetas hay es ESTA pantalla,
     así que es aquí donde se dice la verdad entera.
     ------------------------------------------------------------------ */

  /* Por qué no se han podido abrir, con las palabras de siempre. */
  function porQueNoSeLeen() {
    var c = E.cuenta || {};
    var p = [];
    if (c.pdf_escaneados) p.push(c.pdf_escaneados === 1 ? "uno es un PDF escaneado" : "son PDF escaneados");
    if (c.fotos) p.push(c.fotos === 1 ? "hay una foto" : "hay fotos");
    if (c.demasiado_grandes) p.push(c.demasiado_grandes === 1
      ? "uno pesa demasiado y lo he saltado" : "algunos pesan demasiado y los he saltado");
    if (c.otros) p.push("hay formatos que no sé abrir");
    if (c.vacios) p.push(c.vacios === 1 ? "uno viene vacío" : "vienen vacíos");
    if (c.casi_vacios) p.push(c.casi_vacios === 1
      ? "uno trae muy pocas letras dentro" : "algunos traen muy pocas letras dentro");
    if (c.errores) p.push(c.errores === 1 ? "uno está roto" : "algunos están rotos");
    if (!p.length) return "parecen escaneados o fotos";
    return p.join(", ");
  }

  function cuantasCarpetas() {
    var c = {};
    (E.ficheros || []).forEach(function (f) { c[f.carpeta] = 1; });
    return Object.keys(c).length;
  }

  /* El parte que se pinta de verdad. Sale del repaso, menos cuando el
     repaso diría algo que la cuenta de arriba desmiente. */
  function elParteQueSePinta() {
    var c = E.cuenta || { total: 0, leidos: 0 };
    var nCarp = cuantasCarpetas();
    var papeles = c.total + (c.total === 1 ? " papel" : " papeles");
    var carps = nCarp + (nCarp === 1 ? " carpeta" : " carpetas");

    /* CASO 1 · hay papeles y no ha salido ni un expediente.
       NUNCA «no tienes ningún expediente»: los tiene delante. */
    if (c.total > 0 && (!E.expedientes || !E.expedientes.length)) {
      var l = [];
      if (c.leidos === 0) {
        l.push("He visto " + carps + " y " + papeles + ", pero no he podido leer ninguno por dentro: " +
               porQueNoSeLeen() + ". Te digo lo que veo por los nombres, y lo de dentro no lo puedo comprobar.");
      } else {
        /* ARREGLO DE REDACCIÓN (20/09/2026): aquí había un «si es uno di
           esto, si no di esto otro» con LAS DOS RESPUESTAS IGUALES (un
           punto), así que la frase se quedaba coja: «…y he podido leer
           por dentro 3.» sin decir 3 de qué. Ahora se dice entero. */
        l.push("He visto " + carps + " y " + papeles + ", y he podido leer por dentro " +
               (c.leidos === 1 ? "uno de ellos." : c.leidos + " de ellos."));
      }
      l.push("Lo que no he encontrado es de qué finca es cada papel: ni los papeles ni el rótulo de las " +
             "carpetas traen una dirección o una referencia de expediente que yo sepa leer. " +
             "Así que no te agrupo nada: prefiero decirte que no lo sé a inventarme expedientes.");
      l.push("Lo que sí puedo hacer ahora mismo: enseñarte los " + c.total + " nombres, ordenarte la carpeta " +
             "por fecha o por tipo de papel, y apartarte los repetidos. ¿Te lo ordeno?");
      return l;
    }

    /* CASO 2 · sí hay expedientes, pero no se ha leído ni un papel por
       dentro. El parte de abajo es verdad, pero sale de los rótulos:
       hay que decirlo ANTES de decir nada más. */
    var base = (E.repaso && E.repaso.parte) ? E.repaso.parte.slice(0) : [];
    if (c.total > 0 && c.leidos === 0 && E.expedientes.length) {
      base.unshift("He visto " + carps + " y " + papeles + ", y no he podido leer ninguno por dentro: " +
                   porQueNoSeLeen() + ". Los he colocado por el rótulo de las carpetas y por el nombre de " +
                   "los ficheros. Lo de dentro no lo puedo comprobar, así que lo que te digo debajo es lo " +
                   "que se ve por fuera.");
    }
    return base;
  }

  function pintarLoQueDice() {
    var caja = $("parte_texto");
    vaciar(caja);
    var lineas = elParteQueSePinta();
    lineas.forEach(function (l, i) {
      caja.appendChild(crear("p", i === lineas.length - 1 ? "parte_pregunta" : "parte_linea", l));
    });
  }

  /* --- 3.3 los cuatro bloques, cada aviso con su fichero --- */
  function pintarBloques() {
    var porExp = {};
    E.expedientes.forEach(function (e) { porExp[e.expediente_id] = e; });

    /* QUÉ TIENES */
    var q = $("b_tienes"); vaciar(q);
    var porOp = { venta: [], alquiler: [], vacacional: [], "": [] };
    E.expedientes.forEach(function (e) { (porOp[e.tipo_operacion || ""]).push(e); });
    [["venta", "en venta"], ["alquiler", "en alquiler"], ["vacacional", "de vacacional"],
     ["", "sin saber de qué operación son"]].forEach(function (par) {
      var l = porOp[par[0]];
      if (!l.length) return;
      var t = crear("div", "grupo");
      t.appendChild(crear("h4", null, l.length + " " + (l.length === 1 ? "expediente " : "expedientes ") + par[1]));
      l.forEach(function (e) {
        var f = crear("div", "fila");
        f.appendChild(crear("span", "fila_que", e._titulo));
        f.appendChild(crear("span", "fila_mas", e.documentos.length +
          (e.documentos.length === 1 ? " papel" : " papeles") +
          (e.propietario.nombre ? " · " + e.propietario.nombre : "")));
        f.appendChild(botonPruebas("de dónde lo saco", [{
          titulo: "Los papeles de " + e._titulo,
          ficheros: e._ficheros.map(function (x) {
            return { nombre: x.ruta, papel: (x.papel ? x.papel.cual : "") +
                     (x.por_que_aqui ? " — " + x.por_que_aqui : "") };
          })
        }]));
        t.appendChild(f);
      });
      q.appendChild(t);
    });
    if (E.sueltos.length) {
      var s = crear("div", "grupo");
      s.appendChild(crear("h4", null, E.sueltos.length +
        (E.sueltos.length === 1 ? " papel que no sé de quién es" : " papeles que no sé de quién son")));
      var fs = crear("div", "fila");
      fs.appendChild(crear("span", "fila_que", "Ni el nombre ni el texto dicen nada. No los reparto a ciegas."));
      fs.appendChild(botonPruebas("ver cuáles", [{ titulo: "Sin expediente",
        ficheros: E.sueltos.map(function (f) {
          return { nombre: f.ruta, papel: f.lectura === "leido" ? "leído, pero no dice de quién es" : f.motivo_no_leido };
        }) }]));
      s.appendChild(fs);
      q.appendChild(s);
    }

    /* los tres bloques que salen de repaso.js */
    avisos($("b_falta"), ["falta"], "Aquí no falta ningún papel de los que pide la tabla.", porExp);
    pintarParados($("b_parado"), porExp);
    avisos($("b_vence"), ["vencido", "vence"], "No hay ningún plazo encima.", porExp);
    avisos($("b_raro"), ["choca", "incompleto"], "No hay nada que se contradiga.", porExp);
    losMiosRaros($("b_raro"));
  }

  /* ------------------------------------------------------------------
     QUÉ ESTÁ PARADO — y qué NO se puede afirmar
     ------------------------------------------------------------------
     Dos cosas se arreglan aquí:

     1. La alarma es a partir de 40 días, que es el número que usa la
        casa. Entre tres semanas y 40 días se dice, pero como dato, no
        como alarma: un expediente que lleva 22 días esperando un poder
        apostillado no está abandonado, está esperando.
     2. repaso.js remata el aviso con «aquí no espera nadie de fuera».
        Esa frase afirma que NADA de fuera está pendiente de llegar, y
        para poder decirla hacen falta DOS cosas, no una:
          a) que se hayan podido leer todos los papeles del expediente, y
          b) que no haya, en toda la sesión, papeles sin dueño.
        Lo segundo faltaba: un papel que no hemos sabido colocar puede
        ser justamente lo que este expediente estaba esperando, y que ya
        llegó. Con papeles sueltos encima de la mesa, la frase no se
        sostiene en ningún expediente, aunque ese expediente se haya
        leído entero. En cualquiera de los dos casos se quita y se dice
        la verdad: que no se sabe.
     ------------------------------------------------------------------ */
  var FRASE_QUE_NO_SE_SOSTIENE =
    /\s*Aqu[ií] no espera nadie de fuera: se ha quedado parado y ya est[áa]\./;
  var DIAS_PARA_LA_ALARMA = 40;

  function pintarParados(caja, porExp) {
    vaciar(caja);
    var l = E.hallazgos_utiles.filter(function (h) { return h.clase === "parado"; });
    var alarma = [], soloDato = [];
    l.forEach(function (h) {
      var m = h.titulo.match(/(\d+)\s*d[ií]as/);
      var dias = m ? Number(m[1]) : 0;
      (dias >= DIAS_PARA_LA_ALARMA ? alarma : soloDato).push({ h: h, dias: dias });
    });
    alarma.sort(function (a, b) { return b.dias - a.dias; });
    soloDato.sort(function (a, b) { return b.dias - a.dias; });

    alarma.forEach(function (x) { unParado(caja, x.h, porExp, true); });
    if (!alarma.length) caja.appendChild(crear("div", "nada", fraseDeLoParado()));

    if (soloDato.length) {
      var d = crear("div", "grupo");
      d.appendChild(crear("h4", null, "Y estos llevan entre tres semanas y " + DIAS_PARA_LA_ALARMA +
        " días sin moverse. No es alarma: es para que lo sepas."));
      caja.appendChild(d);
      soloDato.forEach(function (x) { unParado(caja, x.h, porExp, false); });
    }
  }

  function unParado(caja, h, porExp, esAlarma) {
    var e = porExp[h.exp];
    if (!e) return;
    var pr = window.IMMOIA_DEDUCCION.pruebasDelAviso(h, e);
    if (!pr.ficheros.length) return;
    var sinLeer = e._ficheros.filter(function (f) { return f.lectura !== "leido"; }).length;
    var sinDueno = (E.sueltos || []).length;
    var detalle = h.detalle;
    if ((sinLeer || sinDueno) && FRASE_QUE_NO_SE_SOSTIENE.test(detalle)) {
      /* se quita la frase que el motor no puede sostener y se pone la verdad,
         diciendo cuál de las dos cosas (o las dos) impide afirmarla */
      var por = [];
      if (sinLeer) por.push("en este expediente hay " + sinLeer +
        (sinLeer === 1 ? " papel que no he podido abrir" : " papeles que no he podido abrir"));
      if (sinDueno) por.push("hay " + sinDueno +
        (sinDueno === 1 ? " papel encima de la mesa que no sé de quién es, y podría ser de aquí"
                        : " papeles encima de la mesa que no sé de quién son, y podrían ser de aquí"));
      detalle = detalle.replace(FRASE_QUE_NO_SE_SOSTIENE, "")
        + " No sé si está esperando algo de fuera: " + por.join("; y ") + ".";
    }
    /* La clase cambia a propósito: lo que es alarma se pinta como alarma
       y lo que es solo un dato se pinta como un dato. La diferencia tiene
       que verse en la pantalla, no solo en la cabeza de quien lo escribió. */
    var f = crear("div", "aviso " + (esAlarma ? "c_parado" : "c_dato flojito"));
    f.appendChild(crear("div", "aviso_donde", h.donde));
    f.appendChild(crear("div", "aviso_titulo", h.titulo));
    f.appendChild(crear("div", "aviso_detalle", detalle));
    f.appendChild(crear("div", "aviso_fuente", "fuente: " + h.fuente));
    f.appendChild(botonPruebas("de dónde lo saco", [{
      titulo: "El papel más reciente de " + h.donde,
      ficheros: pr.ficheros.map(function (x) {
        var fi = buscarFichero(x.fichero);
        return { nombre: fi ? fi.ruta : x.nombre, papel: x.papel };
      })
    }]));
    caja.appendChild(f);
  }

  /* «No hay nada parado» solo se puede decir cuando se sabe. Si los
     papeles no traen fecha, lo que pasa no es que no haya nada parado:
     es que no se puede saber, y eso hay que decirlo tal cual. Nunca
     afirmar que no hay nada cuando lo que pasa es que no lo sabes. */
  function fraseDeLoParado() {
    var sinFecha = E.expedientes.filter(function (e) {
      return !(e.ultimo_movimiento && e.ultimo_movimiento.fecha);
    }).length;
    if (!sinFecha) return "No hay ningún expediente parado más de tres semanas.";
    if (sinFecha === E.expedientes.length) {
      return "Esto no te lo puedo decir: en ninguno de tus expedientes hay un papel con fecha, " +
             "y sin fechas no sé qué lleva parado. La fecha del fichero en Windows no me vale, " +
             "porque en cuanto se copia una carpeta todos los ficheros pasan a tener la fecha de la copia.";
    }
    return "De los que tienen fecha, ninguno lleva parado más de tres semanas. Pero en " + sinFecha +
           (sinFecha === 1 ? " expediente no hay ningún papel con fecha, así que de ese no lo sé."
                           : " expedientes no hay ningún papel con fecha, así que de esos no lo sé.");
  }

  /* Dos cosas que solo se ven mirando TODOS los papeles a la vez, y que
     no salen de repaso.js sino de la deducción: la misma finca con dos
     nombres distintos, y el papel que podría ser de dos expedientes. */
  function losMiosRaros(caja) {
    var nada = caja.querySelector(".nada");
    var puestos = 0;

    E.expedientes.forEach(function (e) {
      if (!e._dos_nombres) return;
      puestos++;
      var f = crear("div", "aviso c_choca");
      f.appendChild(crear("div", "aviso_donde", e._titulo));
      f.appendChild(crear("div", "aviso_titulo",
        "Aquí hay papeles a nombre de " + e._dos_nombres.length + " personas distintas"));
      f.appendChild(crear("div", "aviso_detalle",
        "En la misma finca aparecen " + e._dos_nombres.map(function (x) { return "«" + x.nombre + "»"; }).join(" y ") +
        ". O es el mismo expediente abierto dos veces, o uno de los dos papeles no es de aquí. " +
        "Míralo antes de seguir: esto no se ve nunca abriendo un expediente de uno en uno."));
      f.appendChild(crear("div", "aviso_fuente", "fuente: los propios papeles, cruzados entre sí"));
      f.appendChild(botonPruebas("de dónde lo saco", [{
        titulo: "El papel donde sale cada nombre",
        ficheros: e._dos_nombres.map(function (x) { return { nombre: x.ruta, papel: x.frase }; })
      }]));
      caja.appendChild(f);
    });

    /* --- fechas del nombre que no se pueden confirmar, y fechas que no
       existen. Si de una fecha cuelga un plazo y esa fecha solo la dice
       el nombre de un papel escaneado, hay que decirlo. --- */
    E.expedientes.forEach(function (e) {
      var imposibles = window.IMMOIA_DEDUCCION.fechasImposibles(e);
      if (imposibles.length) {
        puestos++;
        var fi = crear("div", "aviso c_choca");
        fi.appendChild(crear("div", "aviso_donde", e._titulo));
        fi.appendChild(crear("div", "aviso_titulo",
          "El nombre de un fichero dice una fecha que no existe"));
        fi.appendChild(crear("div", "aviso_detalle",
          imposibles.map(function (f) {
            return "«" + f.nombre + "» lleva delante la fecha " + f.fecha_imposible_en_el_nombre +
              ", y ese día no existe en el calendario." +
              (f.fecha_papel
                ? " La buena es la que pone dentro del papel: " + f.fecha_papel.iso + "."
                : " Y no puedo mirar dentro para saber la buena, porque este papel no se deja abrir.");
          }).join(" ")));
        fi.appendChild(crear("div", "aviso_fuente", "fuente: el calendario"));
        fi.appendChild(botonPruebas("de dónde lo saco", [{ titulo: "El fichero mal fechado",
          ficheros: imposibles.map(function (f) { return { nombre: f.ruta, papel: f.fecha_imposible_en_el_nombre }; }) }]));
        caja.appendChild(fi);
      }

      var dudosas = window.IMMOIA_DEDUCCION.fechasDeLasQueNoMeFio(e);
      if (dudosas.length) {
        puestos++;
        var fd = crear("div", "aviso c_incompleto");
        fd.appendChild(crear("div", "aviso_donde", e._titulo));
        fd.appendChild(crear("div", "aviso_titulo",
          dudosas.length === 1
            ? "Hay una fecha que solo dice el nombre del fichero y no puedo confirmarla"
            : "Hay " + dudosas.length + " fechas que solo dicen los nombres de los ficheros y no puedo confirmarlas"));
        fd.appendChild(crear("div", "aviso_detalle",
          "Estos papeles están escaneados: no puedo abrirlos para comprobar la fecha que llevan en el " +
          "nombre. Y de esa fecha cuelga un plazo. Si el nombre está mal puesto, el plazo que yo calcule " +
          "también estará mal."));
        fd.appendChild(crear("div", "aviso_fuente", "regla de la casa: lo que no puedo comprobar, lo digo"));
        fd.appendChild(botonPruebas("ver cuáles", [{ titulo: "Fechas que solo dice el nombre",
          ficheros: dudosas.map(function (f) {
            return { nombre: f.ruta, papel: f.papel.cual + " — el nombre dice " + f.fecha_papel.iso };
          }) }]));
        caja.appendChild(fd);
      }

      /* --- el contrato de alquiler que cumple cinco años --- */
      var aniversario = window.IMMOIA_DEDUCCION.cumpleAniosElContrato(e, E.repaso.hoy);
      if (aniversario) {
        puestos++;
        var fa = crear("div", "aviso c_vence");
        fa.appendChild(crear("div", "aviso_donde", e._titulo));
        fa.appendChild(crear("div", "aviso_titulo",
          aniversario.dias >= 0
            ? "El contrato de alquiler cumple cinco años dentro de " + nDias(aniversario.dias)
            : "El contrato de alquiler cumplió cinco años hace " + nDias(-aniversario.dias)));
        fa.appendChild(crear("div", "aviso_detalle",
          "Se firmó el " + aniversario.firma + ", así que los cinco años se cumplen el " +
          aniversario.cumple + ". Cinco años es el mínimo cuando el arrendador es una persona física " +
          "(siete si es una empresa). " +
          (aniversario.preaviso_pasado
            ? "El preaviso para no prorrogar es de cuatro meses el arrendador y dos el inquilino, y ese " +
              "plazo ya pasó: lo que toca es contar con que el contrato entra en prórroga, no con cortarlo."
            : "El preaviso para no prorrogar es de cuatro meses el arrendador y dos el inquilino.") +
          " En la carpeta no hay ningún papel que diga nada de la prórroga."));
        fa.appendChild(crear("div", "aviso_fuente",
          "OT-25 · TABLA_PAPELES_Y_VENTANILLAS.md ap. 4 (art. 9 y 36 LAU)"));
        fa.appendChild(botonPruebas("de dónde lo saco", [{ titulo: "El contrato",
          ficheros: [{ nombre: aniversario.fichero.ruta, papel: "firmado el " + aniversario.firma }] }]));
        caja.appendChild(fa);
      }

      /* --- los papeles que la tabla marca «a veces» ---
         A un expediente recién abierto tampoco se le piden: no es que le
         falten, es que acaba de empezar. */
      var esNuevo = window.IMMOIA_DEDUCCION.recienAbierto(e, E.repaso.hoy);
      (esNuevo ? [] : window.IMMOIA_DEDUCCION.papelesDeAVeces(e)).forEach(function (p) {
        puestos++;
        var fv = crear("div", "aviso c_falta flojito");
        fv.appendChild(crear("div", "aviso_donde", e._titulo));
        fv.appendChild(crear("div", "aviso_titulo", "Puede que te pidan " + p.cual + ", y aquí no está"));
        fv.appendChild(crear("div", "aviso_detalle",
          "No te digo que falte: la tabla la marca como «a veces», no como obligatoria en toda venta. " +
          "Pero " + p.porque + "."));
        fv.appendChild(crear("div", "aviso_fuente", "fuente: " + p.fuente));
        fv.appendChild(botonPruebas("de dónde lo saco: de que entre estos " + e.documentos.length +
          " papeles no está", [{ titulo: "Los papeles que hay en " + e._titulo,
          ficheros: e._ficheros.map(function (f) { return { nombre: f.ruta, papel: f.papel.cual }; }) }]));
        caja.appendChild(fv);
      });

      /* --- borradores sin firmar --- */
      (e._borradores || []).forEach(function (f) {
        puestos++;
        var fb = crear("div", "aviso c_incompleto");
        fb.appendChild(crear("div", "aviso_donde", e._titulo));
        fb.appendChild(crear("div", "aviso_titulo", "Aquí lo que hay es un borrador, no un papel firmado"));
        fb.appendChild(crear("div", "aviso_detalle",
          "«" + f.nombre + "»: " + f.es_borrador + ". Mientras no se firme no corre ningún plazo, " +
          "así que no te voy a reclamar ni la fianza ni el inventario: todavía no tocan."));
        fb.appendChild(crear("div", "aviso_fuente", "lo dice el propio fichero"));
        fb.appendChild(botonPruebas("de dónde lo saco", [{ titulo: "El borrador",
          ficheros: [{ nombre: f.ruta, papel: f.es_borrador }] }]));
        caja.appendChild(fb);
      });
    });

    var ambiguos = E.ficheros.filter(function (f) { return f.senal_ambigua && !f.expediente; });
    if (ambiguos.length) {
      puestos++;
      var g = crear("div", "aviso c_incompleto");
      g.appendChild(crear("div", "aviso_donde", "papeles que podrían ser de varios sitios"));
      g.appendChild(crear("div", "aviso_titulo",
        ambiguos.length + (ambiguos.length === 1 ? " papel no sé a cuál de tus expedientes va"
                                                 : " papeles no sé a cuál de tus expedientes van")));
      g.appendChild(crear("div", "aviso_detalle",
        "La única pista que traen apunta a más de un expediente a la vez. Antes que repartirlos a ojo, los dejo aparte."));
      g.appendChild(crear("div", "aviso_fuente", "regla de la casa: sin datos, no se supone"));
      g.appendChild(botonPruebas("ver cuáles y por qué", [{
        titulo: "Sin poder decidir",
        ficheros: ambiguos.map(function (f) { return { nombre: f.ruta, papel: f.senal_ambigua.join("; ") }; })
      }]));
      caja.appendChild(g);
    }
    if (puestos && nada) nada.parentNode.removeChild(nada);
  }

  function avisos(caja, clases, siNoHay, porExp) {
    vaciar(caja);
    var l = E.hallazgos_utiles.filter(function (h) { return clases.indexOf(h.clase) >= 0; });
    var pintados = 0;
    l.forEach(function (h) {
      var e = porExp[h.exp];
      if (!e) return;

      var pr = window.IMMOIA_DEDUCCION.pruebasDelAviso(h, e);
      /* LA REGLA: si no puede señalar el fichero, no lo dice */
      if (!pr.ficheros.length) return;
      pintados++;
      var f = crear("div", "aviso c_" + h.clase);
      f.appendChild(crear("div", "aviso_donde", h.donde));
      f.appendChild(crear("div", "aviso_titulo", h.titulo));
      f.appendChild(crear("div", "aviso_detalle", h.detalle));
      if (h.fuente) f.appendChild(crear("div", "aviso_fuente", "fuente: " + h.fuente));
      f.appendChild(botonPruebas(
        pr.tipo === "ausencia"
          ? "de dónde lo saco: de que entre estos " + nCosas(pr.ficheros.length, "papel", "papeles") + " no está"
          : "de dónde lo saco",
        [{ titulo: pr.tipo === "ausencia"
              ? "Los papeles que hay en " + h.donde + " — y entre ellos no está el que digo"
              : "El papel del que sale este aviso",
           ficheros: pr.ficheros.map(function (x) {
             var fich = buscarFichero(x.fichero);
             return { nombre: fich ? fich.ruta : x.nombre, papel: x.papel };
           }) }]));
      caja.appendChild(f);
    });
    if (!pintados) caja.appendChild(crear("div", "nada", siNoHay));
  }

  function buscarFichero(id) {
    for (var i = 0; i < E.ficheros.length; i++) if (E.ficheros[i].id === id) return E.ficheros[i];
    return null;
  }

  /* El botón de «de dónde lo saco»: abre y cierra la lista de ficheros */
  function botonPruebas(texto, grupos) {
    var cont = crear("span", "pruebas");
    var b = crear("button", "boton_prueba", texto);
    var caja = crear("div", "prueba_caja");
    caja.style.display = "none";
    grupos.forEach(function (g) {
      if (!g.ficheros.length) return;
      caja.appendChild(crear("div", "prueba_titulo", g.titulo));
      g.ficheros.forEach(function (f) {
        var d = crear("div", "prueba_fila");
        d.appendChild(crear("span", "prueba_nombre", f.nombre));
        if (f.papel) d.appendChild(crear("span", "prueba_papel", f.papel));
        caja.appendChild(d);
      });
    });
    b.addEventListener("click", function () {
      var abierto = caja.style.display !== "none";
      caja.style.display = abierto ? "none" : "";
      b.classList.toggle("abierto", !abierto);
    });
    cont.appendChild(b);
    cont.appendChild(caja);
    return cont;
  }

  /* ==================================================================
     4. LOS SEIS ÓRDENES
     ================================================================== */
  function pintarOrdenes() {
    var tabs = $("tabs"); vaciar(tabs);
    E.planes.forEach(function (p, i) {
      var b = crear("button", "tab" + (i === 0 ? " activa" : ""), (i + 1) + " · " + p.titulo);
      if (i < 2) b.appendChild(crear("span", "sello", "Windows no sabe"));
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(tabs.children, function (x) { x.classList.remove("activa"); });
        b.classList.add("activa");
        verPlan(i);
      });
      tabs.appendChild(b);
    });
    verPlan(0);
  }

  function verPlan(i) {
    var p = E.planes[i];
    E.plan_a_la_vista = p;
    $("plan_titulo").textContent = "Así te quedaría: " + p.titulo.toLowerCase();
    $("plan_sub").textContent = p.subtitulo;
    $("plan_ventaja").textContent = p.ventaja || "";
    $("plan_ventaja").style.display = p.ventaja ? "" : "none";
    var notas = $("plan_notas"); vaciar(notas);
    p.notas.forEach(function (n) { notas.appendChild(crear("li", null, n)); });
    $("plan_cuenta").textContent = nCosas(p.destinos.length, "fichero", "ficheros") + " en " + nCosas(p.carpetas, "carpeta", "carpetas") + ".";
    pintarArbol(p);
    $("estado_copia").textContent = "";
    $("boton_deshacer").style.display = E.ultimoRegistro ? "" : "none";
  }

  function pintarArbol(p) {
    var caja = $("arbol"); vaciar(caja);
    var arbol = window.IMMOIA_ORDENES.arbolDe(p);
    function bajar(nodo, nivel, dentro) {
      var claves = Object.keys(nodo.hijos).sort(function (a, b) { return a.localeCompare(b, "es"); });
      claves.forEach(function (k) {
        var h = nodo.hijos[k];
        var d = crear("div", "nodo carpeta");
        d.style.paddingLeft = (nivel * 18) + "px";
        d.appendChild(crear("span", "icono", "▸"));
        d.appendChild(crear("span", "nombre_carpeta", k));
        var cuantos = contar(h);
        d.appendChild(crear("span", "cuantos", cuantos + (cuantos === 1 ? " fichero" : " ficheros")));
        dentro.appendChild(d);
        bajar(h, nivel + 1, dentro);
      });
      nodo.ficheros.forEach(function (f) {
        var d = crear("div", "nodo fichero");
        d.style.paddingLeft = (nivel * 18 + 14) + "px";
        d.appendChild(crear("span", "nombre_fichero", f.nombre));
        d.appendChild(crear("span", "de_donde", "venía de: " + f.fichero.ruta));
        dentro.appendChild(d);
      });
    }
    function contar(n) {
      var t = n.ficheros.length;
      Object.keys(n.hijos).forEach(function (k) { t += contar(n.hijos[k]); });
      return t;
    }
    bajar(arbol, 0, caja);
  }

  /* ==================================================================
     5. ENSEÑAR ANTES DE TOCAR · COPIAR · DESHACER
     ================================================================== */
  function conectarBotonesDePlan() {
    $("boton_descargar_plan").addEventListener("click", function () {
      var p = E.plan_a_la_vista;
      window.IMMOIA_COPIA.descargar(
        new Blob([window.IMMOIA_COPIA.planEnTexto(p)], { type: "text/plain;charset=utf-8" }),
        "IMMO_IA_PLAN_" + p.clave + ".txt");
      $("estado_copia").textContent = "Te he descargado el plan en un fichero de texto. No he tocado nada.";
    });

    $("boton_ordenar").addEventListener("click", function () {
      var p = E.plan_a_la_vista;
      if (!E.navegador.escribir_en_disco) return hacerZip(p);
      $("estado_copia").textContent = "Elige la carpeta donde quieres la COPIA ordenada. Tus carpetas de siempre no se tocan.";
      window.IMMOIA_COPIA.pedirDestino().then(function (h) {
        E.handleDestino = h;
        $("estado_copia").textContent = "Copiando…";
        return window.IMMOIA_COPIA.copiar(p, h, function (a, b) {
          $("estado_copia").textContent = "Copiando… " + a + " de " + b;
        });
      }).then(function (r) {
        if (!r) return;
        E.ultimoRegistro = r.registro;
        E.ultimoDestino = E.handleDestino;
        $("estado_copia").textContent =
          "Hecho: " + nCosas(r.copiados, "fichero copiado", "ficheros copiados") + " en «" + r.carpeta + "»." +
          (r.fallos.length ? " " + r.fallos.length + " no se han podido escribir." : "") +
          " Tus carpetas originales están exactamente igual que estaban. " +
          "Lo he apuntado todo en " + window.IMMOIA_COPIA.REGISTRO + ".";
        $("boton_deshacer").style.display = "";
      }).catch(function (e) {
        if (e && e.name === "AbortError") { $("estado_copia").textContent = "No he tocado nada."; return; }
        $("estado_copia").textContent = "No he podido: " + ((e && e.message) || e);
      });
    });

    $("boton_deshacer").addEventListener("click", function () {
      if (!E.ultimoRegistro || !E.ultimoDestino) return;
      $("estado_copia").textContent = "Deshaciendo…";
      window.IMMOIA_COPIA.deshacer(E.ultimoDestino, E.ultimoRegistro, function (a, b) {
        $("estado_copia").textContent = "Deshaciendo… " + a + " de " + b;
      }).then(function (r) {
        E.ultimoDeshacer = r;
        $("estado_copia").textContent =
          "Deshecho: he quitado " + nCosas(r.borrados.length, "fichero", "ficheros") +
          (r.carpeta_borrada
            ? " y la carpeta que había creado. En tu disco no queda nada mío."
            : ". La carpeta sigue ahí porque dentro hay cosas que yo no puse.") +
          (r.respetados.length
            ? " He dejado " + r.respetados.length + " cosas donde estaban: " +
              r.respetados.slice(0, 3).map(function (x) { return x.a + " (" + x.por_que + ")"; }).join("; ")
            : "");
        if (r.carpeta_borrada) { E.ultimoRegistro = null; $("boton_deshacer").style.display = "none"; }
      }).catch(function (e) {
        $("estado_copia").textContent = "No he podido deshacer: " + ((e && e.message) || e);
      });
    });
  }

  function hacerZip(p) {
    $("estado_copia").textContent = "Este navegador no me deja escribir en tu disco. Te preparo un ZIP ya ordenado…";
    return window.IMMOIA_COPIA.hacerZip(p, function (a, b) {
      $("estado_copia").textContent = "Preparando el ZIP… " + a + " de " + b;
    }).then(function (z) {
      window.IMMOIA_COPIA.descargar(z.blob, "IMMO_IA_ORDENADO_" + p.clave + ".zip");
      $("estado_copia").textContent = "Te he descargado un ZIP con los " + z.cuantos +
        " ficheros ya ordenados. Tus carpetas de siempre no se han tocado.";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    arrancar();
    conectarBotonesDePlan();
  });
})();
