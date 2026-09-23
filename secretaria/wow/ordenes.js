/* ==================================================================
   IMMO IA · ordenes.js — LOS SEIS SISTEMAS DE ORDENAR
   ------------------------------------------------------------------
   Por este orden en pantalla, que el orden importa:
     1. Por lo que vence          <- esto Windows no lo sabe hacer
     2. Por lo que está parado    <- esto Windows no lo sabe hacer
     3. Por expediente / operación
     4. Por cliente o propietario
     5. Por tipo de papel
     6. Alfabético y por fecha

   Cada sistema devuelve un PLAN: la lista completa de «este fichero
   iría aquí, con este nombre». El plan se enseña entero antes de
   tocar nada. Aquí no se mueve ni se copia nada: eso es de
   copia_y_deshacer.js.

   Los nombres de carpeta llevan número delante a propósito: así el
   propio Explorador de Windows los deja en el orden bueno.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.0";
  var CARPETA_COPIAS = "00_COPIAS_REPETIDAS";
  var CARPETA_SUELTOS = "99_NO_SE_DE_QUIEN_SON";

  /* Windows no admite  \ / : * ? " < > |  ni terminar en punto o espacio. */
  /* ------------------------------------------------------------------
     ARREGLO DEL 23/09/2026 · AL ACORTAR, LA EXTENSIÓN SE QUEDA
     ------------------------------------------------------------------
     Lo que pasaba (nivel 8 del campo de entrenamiento): un nombre de 168
     letras salía cortado a 120 y SIN el «.pdf» del final, en los seis
     órdenes. En Windows eso es un fichero que al doble clic pregunta con
     qué programa abrirlo. El original no se toca nunca —la aplicación
     copia, no mueve—, pero la carpeta ordenada, que es el producto, se
     queda con un papel que no se abre.
     Ahora se corta por el tronco y la extensión se pega detrás. Y cada
     nombre acortado se cuenta, para poder decirlo en las notas del plan.
     ------------------------------------------------------------------ */
  var EXTENSION = /\.([A-Za-z0-9]{1,8})$/;

  function limpiarNombre(t, tope) {
    var s = String(t == null ? "" : t)
      .replace(/[\\\/:*?"<>|]/g, "-")
      .replace(/[\x00-\x1f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/, "");
    if (!s) s = "sin nombre";
    tope = tope || 90;
    if (s.length <= tope) return s;

    /* el tronco se acorta; la extensión, si la hay, se queda pegada */
    var ext = EXTENSION.exec(s);
    var cola = ext ? ext[0].toLowerCase() : "";
    var tronco = ext ? s.slice(0, s.length - cola.length) : s;
    var sitio = tope - cola.length;
    if (sitio < 1) {                       /* una extensión rarísima y larguísima */
      return s.slice(0, tope).replace(/[. ]+$/, "");
    }
    tronco = tronco.slice(0, sitio).replace(/[. ]+$/, "");
    if (!tronco) tronco = "sin nombre".slice(0, sitio);
    return tronco + cola;
  }

  function dos(n) { return (n < 10 ? "0" : "") + n; }
  function fechaFichero(f) {
    if (!f.modificado) return null;
    var d = new Date(f.modificado);
    return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate());
  }
  function diasEntre(a, b) {
    if (!a || !b) return null;
    return Math.round((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000);
  }

  /* ------------------------------------------------------------------
     Lo que sabemos de cada expediente para poder ordenarlo
     ------------------------------------------------------------------ */
  function resumirExpedientes(estado) {
    var porId = {};
    (estado.expedientes || []).forEach(function (e) {
      porId[e.expediente_id] = {
        exp: e,
        titulo: e._titulo,
        vence: null, vence_que: null, vence_prueba: null,
        parado: null,
        operacion: e.tipo_operacion,
        propietario: e.propietario && e.propietario.nombre
      };
    });
    var hoy = estado.repaso.hoy;
    /* la lista ya filtrada: lo que no se dice tampoco ordena */
    (estado.hallazgos_utiles || estado.repaso.hallazgos || []).forEach(function (h) {
      var r = porId[h.exp];
      if (!r) return;
      if (h.vence && (!r.vence || h.vence < r.vence)) {
        r.vence = h.vence; r.vence_que = h.titulo;
      }
    });
    (estado.repaso.expedientes || []).forEach(function (u) {
      var r = porId[u.id];
      if (!r) return;
      var e = r.exp;
      var mov = e.ultimo_movimiento && e.ultimo_movimiento.fecha;
      r.parado = mov ? -diasEntre(mov, hoy) : null;
      r.movimiento = mov;
    });
    return porId;
  }

  /* ------------------------------------------------------------------
     Un plan es una lista de destinos. Nada más.
     ------------------------------------------------------------------ */
  function nuevoPlan(clave, titulo, subtitulo, ventaja) {
    return { clave: clave, titulo: titulo, subtitulo: subtitulo, ventaja: ventaja || "",
             destinos: [], notas: [] };
  }
  function poner(plan, carpeta, fichero, nombreFinal) {
    var pedido = String(nombreFinal || fichero.nombre || "");
    var nombre = limpiarNombre(pedido, 120);
    /* si se ha acortado, queda apuntado: se dice en las notas del plan */
    if (pedido.length > 120) {
      plan.acortados = (plan.acortados || []);
      plan.acortados.push({ antes: pedido, despues: nombre });
    }
    plan.destinos.push({
      carpeta: carpeta.map(function (x) { return limpiarNombre(x); }).join("/"),
      nombre: nombre,
      fichero: fichero
    });
  }

  /* Las copias repetidas van SIEMPRE al mismo sitio, en todos los
     sistemas: así la copia ordenada tiene cada papel una sola vez y
     ninguna se pierde por el camino. */
  function apartarCopias(plan, estado) {
    var n = 0;
    (estado.ficheros || []).forEach(function (f) {
      if (!f.duplicado_de) return;
      poner(plan, [CARPETA_COPIAS], f, f.nombre);
      n++;
    });
    if (n) plan.notas.push("Aparto " + n + (n === 1 ? " copia repetida" : " copias repetidas") +
                          " en «" + CARPETA_COPIAS + "»: no se borra ninguna, pero deja de estorbar.");
    return n;
  }

  /* Un papel sin expediente que ADEMÁS es una copia repetida entra por
     las dos puertas: la de los sueltos y la de las copias. Si se deja
     así, ese fichero sale dos veces en el plan y la copia ordenada
     acaba con más ficheros de los que había. Manda la regla de las
     copias, que es la que vale en los seis sistemas: la copia va a
     «00_COPIAS_REPETIDAS» y NO se repite en el cajón de los sueltos.
     La cuenta que se enseña es la de los que de verdad van al cajón. */
  function sueltosAlCajon(plan, estado, prefijo) {
    var n = 0, copias = 0;
    (estado.sueltos || []).forEach(function (f) {
      if (f.duplicado_de) { copias++; return; }
      poner(plan, (prefijo || []).concat([CARPETA_SUELTOS]), f, f.nombre);
      n++;
    });
    if (n) plan.notas.push(n + (n === 1 ? " papel no dice" : " papeles no dicen") +
      " de qué expediente son ni por el nombre ni por dentro. No me los invento: van a «" +
      CARPETA_SUELTOS + "» para que los mires tú." +
      (copias ? " Otr" + (copias === 1 ? "o papel sin expediente es una copia repetida y va" :
                                         "os " + copias + " papeles sin expediente son copias repetidas y van") +
                " a «" + CARPETA_COPIAS + "», no aquí: cada fichero se copia una sola vez." : ""));
    else if (copias) plan.notas.push(copias + (copias === 1
      ? " papel sin expediente es una copia repetida: va a «"
      : " papeles sin expediente son copias repetidas: van a «") + CARPETA_COPIAS + "».");
  }

  /* ==================================================================
     1 · POR LO QUE VENCE
     ================================================================== */
  function porLoQueVence(estado) {
    var p = nuevoPlan("vence", "Por lo que vence",
      "Lo que caduca antes, primero.",
      "Windows no sabe hacer esto: ordena por la fecha del fichero, no por la fecha que corre dentro del papel.");
    var res = resumirExpedientes(estado), hoy = estado.repaso.hoy;
    var conFecha = [], sinFecha = [];
    Object.keys(res).forEach(function (k) { (res[k].vence ? conFecha : sinFecha).push(res[k]); });
    conFecha.sort(function (a, b) { return a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0; });
    sinFecha.sort(function (a, b) { return String(a.titulo).localeCompare(String(b.titulo), "es"); });

    conFecha.forEach(function (r) {
      var d = diasEntre(r.vence, hoy);
      var cajon = d < 0 ? "01_YA_SE_PASO_EL_PLAZO"
                : d <= 7 ? "02_VENCE_ESTA_SEMANA"
                : d <= 31 ? "03_VENCE_ESTE_MES"
                : "04_MAS_ADELANTE";
      var carpeta = r.vence + " - " + r.titulo;
      r.exp._ficheros.forEach(function (f) {
        if (f.duplicado_de) return;
        poner(p, [cajon, carpeta], f, f.nombre);
      });
    });
    sinFecha.forEach(function (r) {
      r.exp._ficheros.forEach(function (f) {
        if (f.duplicado_de) return;
        poner(p, ["05_SIN_FECHA_A_LA_VISTA", r.titulo], f, f.nombre);
      });
    });
    p.notas.push("La fecha que manda aquí es la que sale del papel (la de emisión, la de la firma), " +
                 "no la fecha del fichero en el disco.");
    if (sinFecha.length) p.notas.push(sinFecha.length + " " +
      (sinFecha.length === 1 ? "expediente no tiene ninguna fecha que corra" : "expedientes no tienen ninguna fecha que corra") +
      ": no me la invento, van al final.");
    sueltosAlCajon(p, estado);
    apartarCopias(p, estado);
    return p;
  }

  /* ==================================================================
     2 · POR LO QUE ESTÁ PARADO
     ================================================================== */
  function porLoQueEstaParado(estado) {
    var p = nuevoPlan("parado", "Por lo que está parado",
      "Lo que lleva más tiempo sin moverse, primero.",
      "Windows tampoco sabe hacer esto: mira fichero a fichero, no expediente a expediente.");
    var res = resumirExpedientes(estado);
    var l = Object.keys(res).map(function (k) { return res[k]; });
    l.sort(function (a, b) {
      if (a.parado === null) return 1;
      if (b.parado === null) return -1;
      return b.parado - a.parado;
    });
    l.forEach(function (r) {
      var cajon = r.parado === null ? "04_SIN_FECHA_NO_LO_SE"
                : r.parado >= 40 ? "01_MAS_DE_40_DIAS_PARADO"
                : r.parado >= 21 ? "02_MAS_DE_21_DIAS_PARADO"
                : "03_SE_HA_MOVIDO_ESTE_MES";
      var carpeta = (r.parado === null ? "sin fecha" : pad3(r.parado) + " dias parado") + " - " + r.titulo;
      r.exp._ficheros.forEach(function (f) {
        if (f.duplicado_de) return;
        poner(p, [cajon, carpeta], f, f.nombre);
      });
    });
    p.notas.push("Los días se cuentan desde el papel más nuevo que hay en el expediente. " +
                 "Aquí sí vale la fecha del fichero en el disco: no dice cuándo se emitió el papel, " +
                 "pero sí cuándo se tocó el expediente por última vez.");
    sueltosAlCajon(p, estado);
    apartarCopias(p, estado);
    return p;
  }
  function pad3(n) { n = Math.max(0, Math.round(n)); return n < 10 ? "00" + n : n < 100 ? "0" + n : String(n); }

  /* ==================================================================
     3 · POR EXPEDIENTE / OPERACIÓN
     ================================================================== */
  function porExpediente(estado) {
    var p = nuevoPlan("expediente", "Por expediente / operación",
      "Una carpeta por operación, y dentro una por expediente.", "");
    var nombres = { venta: "1_VENTAS", alquiler: "2_ALQUILERES", vacacional: "3_VACACIONAL" };
    var sinSaber = 0;
    (estado.expedientes || []).forEach(function (e) {
      var cajon = nombres[e.tipo_operacion] || "4_NO_SE_QUE_OPERACION_ES";
      if (!nombres[e.tipo_operacion]) sinSaber++;
      e._ficheros.forEach(function (f) {
        if (f.duplicado_de) return;
        poner(p, [cajon, e._titulo], f, f.nombre);
      });
    });
    if (sinSaber) p.notas.push(sinSaber + " " + (sinSaber === 1 ? "expediente no dice" : "expedientes no dicen") +
      " si es venta, alquiler o vacacional. No lo supongo: van a «4_NO_SE_QUE_OPERACION_ES».");
    sueltosAlCajon(p, estado);
    apartarCopias(p, estado);
    return p;
  }

  /* ==================================================================
     4 · POR CLIENTE O PROPIETARIO
     ================================================================== */
  function porCliente(estado) {
    var p = nuevoPlan("cliente", "Por cliente o propietario",
      "Una carpeta por persona, y dentro sus expedientes.", "");
    var sinDueno = 0;
    (estado.expedientes || []).forEach(function (e) {
      var quien = (e.propietario && e.propietario.nombre) || null;
      if (!quien) sinDueno++;
      e._ficheros.forEach(function (f) {
        if (f.duplicado_de) return;
        poner(p, [quien || "99_SIN_NOMBRE_EN_NINGUN_PAPEL", e._titulo], f, f.nombre);
      });
    });
    if (sinDueno) p.notas.push("En " + sinDueno + " " + (sinDueno === 1 ? "expediente" : "expedientes") +
      " no hay ningún papel que diga a nombre de quién está. No lo relleno con el nombre de la carpeta.");
    sueltosAlCajon(p, estado);
    apartarCopias(p, estado);
    return p;
  }

  /* ==================================================================
     5 · POR TIPO DE PAPEL
     ------------------------------------------------------------------
     Todas las notas simples juntas. Sirve para ver de un vistazo a
     quién le falta: si en la carpeta de los certificados energéticos
     hay ocho papeles y tienes once expedientes, ya sabes cuántos van
     sin él sin abrir ninguno.
     ================================================================== */
  var CAJONES_PAPEL = {
    nota_simple: "01_NOTAS_SIMPLES",
    energetico: "02_CERTIFICADOS_ENERGETICOS",
    comunidad: "03_CERTIFICADOS_DE_LA_COMUNIDAD",
    ibi: "04_IBI",
    dni: "05_DNI_Y_NIE",
    arras: "06_CONTRATOS_DE_ARRAS",
    notaria: "07_NOTARIA_Y_ESCRITURAS",
    escritura: "07_NOTARIA_Y_ESCRITURAS",
    contrato: "08_CONTRATOS_DE_ALQUILER",
    fianza: "09_FIANZAS",
    inventario: "10_INVENTARIOS",
    memoria: "11_MEMORIAS_TECNICAS",
    ocupacion: "12_PRIMERA_OCUPACION",
    declaracion: "13_DECLARACIONES_RESPONSABLES",
    registro_tur: "14_REGISTRO_TURISTICO",
    hipoteca: "15_HIPOTECA",
    foto: "16_FOTOS"
  };
  function porTipoDePapel(estado) {
    var p = nuevoPlan("papel", "Por tipo de papel",
      "Todas las notas simples juntas, todos los energéticos juntos.",
      "Sirve para ver de un golpe a quién le falta: se cuenta lo que hay en cada cajón y se compara con los expedientes que tienes.");
    /* Se cuentan EXPEDIENTES, no ficheros: si un expediente tiene dos
       notas simples sigue siendo un expediente con nota simple. Contar
       ficheros daría un número más bonito y sería mentira. */
    var expPorCajon = {};
    (estado.expedientes || []).forEach(function (e) {
      e._ficheros.forEach(function (f) {
        if (f.duplicado_de) return;
        var cajon = CAJONES_PAPEL[f.papel && f.papel.clave] || "99_SIN_IDENTIFICAR";
        expPorCajon[cajon] = expPorCajon[cajon] || {};
        expPorCajon[cajon][e.expediente_id] = 1;
        /* el nombre lleva delante de quién es: así el cajón se lee solo */
        poner(p, [cajon], f, e._titulo + " - " + f.nombre);
      });
    });
    var total = (estado.expedientes || []).length;
    ["01_NOTAS_SIMPLES", "02_CERTIFICADOS_ENERGETICOS", "03_CERTIFICADOS_DE_LA_COMUNIDAD"].forEach(function (c) {
      var hay = Object.keys(expPorCajon[c] || {}).length;
      if (total && hay < total) {
        var sin = total - hay;
        p.notas.push("En «" + c + "» van a caer papeles de " + hay + " de tus " + total +
                     " expedientes: " + (sin === 1 ? "a uno le falta ese papel, o lo tiene"
                                                   : "a " + sin + " les falta ese papel, o lo tienen") +
                     " con otro nombre.");
      }
    });
    sueltosAlCajon(p, estado);
    apartarCopias(p, estado);
    return p;
  }

  /* ==================================================================
     6 · ALFABÉTICO Y POR FECHA
     ================================================================== */
  function alfabeticoYFecha(estado) {
    var p = nuevoPlan("alfabetico", "Alfabético y por fecha",
      "Una carpeta por letra, y dentro los ficheros con la fecha delante.",
      "Esto lo hace Windows. Está por completitud, para que no eches nada de menos.");
    (estado.ficheros || []).forEach(function (f) {
      if (f.duplicado_de) return;
      var primera = quitarTildes(String(f.nombre).trim().charAt(0).toUpperCase());
      var letra = /[A-Z]/.test(primera) ? primera : "0-9_y_otros";
      var fecha = fechaFichero(f);
      poner(p, [letra], f, (fecha ? fecha + " - " : "") + f.nombre);
    });
    p.notas.push("La fecha que va delante del nombre es la del fichero en el disco, " +
                 "que es la que ve Windows. No es la fecha de emisión del papel.");
    apartarCopias(p, estado);
    return p;
  }
  function quitarTildes(c) {
    return String(c).replace(/[ÁÀÄÂ]/g, "A").replace(/[ÉÈËÊ]/g, "E").replace(/[ÍÌÏÎ]/g, "I")
      .replace(/[ÓÒÖÔ]/g, "O").replace(/[ÚÙÜÛ]/g, "U").replace(/Ñ/g, "N");
  }

  /* ==================================================================
     EL ÁRBOL, PARA ENSEÑARLO EN PANTALLA
     ================================================================== */
  function arbolDe(plan) {
    var raizN = { nombre: "", hijos: {}, ficheros: [] };
    plan.destinos.forEach(function (d) {
      var nodo = raizN;
      (d.carpeta ? d.carpeta.split("/") : []).forEach(function (t) {
        nodo.hijos[t] = nodo.hijos[t] || { nombre: t, hijos: {}, ficheros: [] };
        nodo = nodo.hijos[t];
      });
      nodo.ficheros.push(d);
    });
    return raizN;
  }

  /* LA CUENTA QUE NO PUEDE FALLAR: en un plan hay tantos destinos como
     ficheros hay, ni uno más. Si un fichero apareciera dos veces, la
     copia ordenada sacaría ficheros de más; si faltara, se perdería un
     papel. Se mide aquí y se deja apuntado en el propio plan para que
     se pueda comprobar desde fuera sin fiarse de la palabra de nadie. */
  function unaSolaVez(plan, estado) {
    var veces = {}, repetidos = [];
    plan.destinos.forEach(function (d) {
      var k = (d.fichero && d.fichero.id != null) ? d.fichero.id : d.carpeta + "/" + d.nombre;
      veces[k] = (veces[k] || 0) + 1;
      if (veces[k] === 2) repetidos.push(d.fichero && d.fichero.ruta ? d.fichero.ruta : String(k));
    });
    var hay = (estado && estado.ficheros) ? estado.ficheros.length : null;
    return { destinos: plan.destinos.length, ficheros_distintos: Object.keys(veces).length,
             ficheros_que_hay: hay, repetidos: repetidos,
             cuadra: hay === null ? null : (plan.destinos.length === hay && !repetidos.length) };
  }

  function cuantasCarpetas(plan) {
    var v = {};
    plan.destinos.forEach(function (d) {
      var t = d.carpeta ? d.carpeta.split("/") : [];
      for (var i = 1; i <= t.length; i++) v[t.slice(0, i).join("/")] = 1;
    });
    return Object.keys(v).length;
  }

  var LOS_SEIS = [
    { clave: "vence", hacer: porLoQueVence },
    { clave: "parado", hacer: porLoQueEstaParado },
    { clave: "expediente", hacer: porExpediente },
    { clave: "cliente", hacer: porCliente },
    { clave: "papel", hacer: porTipoDePapel },
    { clave: "alfabetico", hacer: alfabeticoYFecha }
  ];

  function todos(estado) {
    return LOS_SEIS.map(function (o) {
      var p = o.hacer(estado);
      p.carpetas = cuantasCarpetas(p);
      p.cuenta = unaSolaVez(p, estado);
      /* ARREGLO DEL 23/09/2026: acortar un nombre es una decisión, y las
         decisiones se cuentan. Antes no se decía en ningún sitio. */
      if (p.acortados && p.acortados.length) {
        p.notas.push("He acortado " + p.acortados.length + " " +
          (p.acortados.length === 1 ? "nombre demasiado largo" : "nombres demasiado largos") +
          " para que quepan en Windows. La extensión se queda: el fichero se abre igual.");
      }
      return p;
    });
  }

  var API = {
    version: VERSION,
    LOS_SEIS: LOS_SEIS,
    todos: todos,
    arbolDe: arbolDe,
    cuantasCarpetas: cuantasCarpetas,
    unaSolaVez: unaSolaVez,
    limpiarNombre: limpiarNombre,
    CARPETA_COPIAS: CARPETA_COPIAS,
    CARPETA_SUELTOS: CARPETA_SUELTOS
  };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_ORDENES = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
