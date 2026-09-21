/* ============================================================
   saber.js — que la secretaria tenga delante las ayudas de verdad.

   El problema que arregla: en el asistente principal la IA no tenía
   las 293 ayudas a mano. Cuando le preguntaban «¿hay alguna ayuda
   para el comprador en Canarias?» contestaba «prefiero que te lo
   mire una persona del equipo». Ahora contesta.

   Cómo: escucha de qué sitio se está hablando (comunidad, provincia,
   isla o pueblo), y antes de mandarle la pregunta a la IA le pone
   delante las ayudas de ESE sitio. Nada más. No sale a internet:
   todo sale del archivo que ya tenemos.

   NO toca charla.js por dentro. Si algún día molesta, se borra este
   archivo de la web y todo vuelve a estar como estaba.
   ============================================================ */
(function () {
  "use strict";

  var LISTO = false;          /* ya tenemos las ayudas cargadas */
  var ULTIMO_SITIO = null;    /* el último sitio del que se habló */

  /* ---------- 1. traer los datos, sin frenar la página ---------- */

  function traer(src, luego) {
    if (document.querySelector('script[data-saber="' + src + '"]')) { luego(); return; }
    var s = document.createElement("script");
    s.src = src;
    s.setAttribute("data-saber", src);
    s.onload = luego;
    s.onerror = function () { luego(); };   /* si falta, seguimos sin ayudas */
    document.head.appendChild(s);
  }

  function cargarTodo() {
    traer("ayudas_todas.js?v=1", function () {
      traer("municipios_todos.js?v=1", function () {
        traer("ayudas.js?v=2", function () {
          if (window.IMMOIA_AYUDAS && window.IMMOIA_AYUDAS_TODAS) LISTO = true;
          mapaDePueblos();
          /* los impuestos de la comunidad: en la portada no los tenia nadie.
             En la pagina de la inmobiliaria ya los pone inmo.js, asi que alli
             no se cargan otra vez. */
          if (!window.IMMOIA_INMO) traer("fiscal.js?v=2", function () {});
        });
      });
    });
  }
  setTimeout(cargarTodo, 1500);   /* deja que la página pinte primero */

  /* ---------- 2. de qué sitio se está hablando ---------- */

  /* provincia (código INE) -> comunidad */
  var PROV = {
    "01":"pv","02":"cm","03":"vc","04":"an","05":"cl","06":"ex","07":"ib","08":"ca",
    "09":"cl","10":"ex","11":"an","12":"vc","13":"cm","14":"an","15":"ga","16":"cm",
    "17":"ca","18":"an","19":"cm","20":"pv","21":"an","22":"ar","23":"an","24":"cl",
    "25":"ca","26":"ri","27":"ga","28":"ma","29":"an","30":"mu","31":"na","32":"ga",
    "33":"as","34":"cl","35":"cn","36":"ga","37":"cl","38":"cn","39":"ct","40":"cl",
    "41":"an","42":"cl","43":"ca","44":"ar","45":"cm","46":"vc","47":"cl","48":"pv",
    "49":"cl","50":"ar","51":"ce","52":"me"
  };

  /* nombres que delatan el sitio. El orden importa: lo más concreto primero. */
  var NOMBRES = [
    /* comunidades */
    ["an", "andaluc"], ["ar", "arag"], ["as", "asturias"], ["as", "principado de asturias"],
    ["ib", "baleares"], ["ib", "illes balears"], ["cn", "canarias"], ["ct", "cantabria"],
    ["cm", "castilla-la mancha"], ["cm", "castilla la mancha"], ["cl", "castilla y leon"],
    ["ca", "cataluny"], ["ca", "cataluñ"], ["vc", "comunidad valenciana"], ["vc", "comunitat valenciana"],
    ["ex", "extremadura"], ["ga", "galicia"], ["ma", "comunidad de madrid"], ["mu", "murcia"],
    ["na", "navarra"], ["pv", "pais vasco"], ["pv", "euskadi"], ["ri", "la rioja"],
    ["ce", "ceuta"], ["me", "melilla"],   /* faltaban: quien es de Ceuta o Melilla no veia nada */
    /* islas */
    ["cn", "tenerife"], ["cn", "gran canaria"], ["cn", "lanzarote"], ["cn", "fuerteventura"],
    ["cn", "la gomera"], ["cn", "el hierro"], ["cn", "las palmas"],
    ["ib", "mallorca"], ["ib", "menorca"], ["ib", "ibiza"], ["ib", "eivissa"], ["ib", "formentera"],
    /* provincias */
    ["pv", "alava"], ["cm", "albacete"], ["vc", "alicante"], ["an", "almeria"], ["cl", "avila"],
    ["ex", "badajoz"], ["ca", "barcelona"], ["cl", "burgos"], ["ex", "caceres"], ["an", "cadiz"],
    ["vc", "castellon"], ["cm", "ciudad real"], ["an", "cordoba"], ["ga", "coruña"], ["ga", "coruna"],
    ["cm", "cuenca"], ["ca", "girona"], ["ca", "gerona"], ["an", "granada"], ["cm", "guadalajara"],
    ["pv", "guipuzcoa"], ["pv", "gipuzkoa"], ["an", "huelva"], ["ar", "huesca"], ["an", "jaen"],
    ["cl", "leon"], ["ca", "lleida"], ["ca", "lerida"], ["ga", "lugo"], ["ma", "madrid"],
    ["an", "malaga"], ["cl", "palencia"], ["ga", "pontevedra"], ["cl", "salamanca"],
    ["cl", "segovia"], ["an", "sevilla"], ["cl", "soria"], ["ca", "tarragona"], ["ar", "teruel"],
    ["cm", "toledo"], ["vc", "valencia"], ["cl", "valladolid"], ["pv", "vizcaya"], ["pv", "bizkaia"],
    ["cl", "zamora"], ["ar", "zaragoza"],
    /* ciudades que se nombran mucho y no son la provincia */
    ["pv", "bilbao"], ["pv", "vitoria"], ["pv", "san sebastian"], ["pv", "donostia"],
    ["ga", "vigo"], ["ga", "santiago de compostela"], ["ga", "ourense"], ["ga", "orense"],
    ["as", "gijon"], ["as", "oviedo"], ["ct", "santander"], ["na", "pamplona"], ["ri", "logroño"],
    ["ri", "logrono"], ["mu", "cartagena"], ["an", "marbella"], ["an", "estepona"], ["an", "jerez"],
    ["cn", "adeje"], ["cn", "arona"], ["cn", "granadilla"], ["cn", "la laguna"],
    ["cn", "puerto de la cruz"], ["cn", "santa cruz de tenerife"], ["cn", "los cristianos"],
    ["cn", "costa adeje"], ["cn", "guia de isora"], ["cn", "candelaria"], ["cn", "icod"],
    ["ib", "palma de mallorca"]
  ];

  var PUEBLOS = null;   /* los 43 municipios del archivo, con su comunidad */

  function mapaDePueblos() {
    if (PUEBLOS || !window.IMMOIA_MUNICIPIOS_TODOS) return;
    PUEBLOS = [];
    try {
      var M = window.IMMOIA_MUNICIPIOS_TODOS;
      Object.keys(M).forEach(function (prov) {
        var cc = PROV[prov];
        if (!cc || !M[prov] || !M[prov].forEach) return;
        M[prov].forEach(function (m) {
          if (m && m.nombre) PUEBLOS.push([cc, sinTildes(m.nombre)]);
        });
      });
    } catch (e) { PUEBLOS = []; }
  }

  function sinTildes(s) {
    return String(s).toLowerCase()
      .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
      .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u");
  }

  function dondeEs(texto) {
    var t = sinTildes(texto);
    mapaDePueblos();
    /* primero los pueblos: si dice «Adeje» es más concreto que «Canarias» */
    if (PUEBLOS) {
      for (var i = 0; i < PUEBLOS.length; i++) {
        if (PUEBLOS[i][1].length >= 4 && t.indexOf(PUEBLOS[i][1]) >= 0) return PUEBLOS[i][0];
      }
    }
    for (var j = 0; j < NOMBRES.length; j++) {
      if (t.indexOf(sinTildes(NOMBRES[j][1])) >= 0) return NOMBRES[j][0];
    }
    return null;
  }

  /* ---------- 3. de qué va la conversación ---------- */

  function deQueVa(t) {
    t = sinTildes(t);
    if (/placa|solar|fotovolt|autoconsum|panel|aerotermia/.test(t)) return "placas";
    if (/alquil|arrend|inquilin/.test(t)) return "alquiler";
    if (/reforma|rehabilit|obra|accesibilidad|ascensor/.test(t)) return "reforma";
    if (/compra|vende|venta|hipotec|escritura|notari|aval/.test(t)) return "compra";
    return "compra";
  }

  /* ---------- 3bis. LA FICHA DE CONTEXTO (18/09/2026) ----------------
     Por que existe: el cerebro central tiene escritas dos reglas, la 34
     (el contexto y EL IDIOMA) y la 36 (el aparato no es la fuente de
     verdad), y las dos viven en la misma constante, R_CONTEXTO
     (worker.js:11). Solo viajan si algun mensaje EMPIEZA por
     "[CONTEXTO DE ESTA PREGUNTA" (worker.js:2152). Hasta hoy no lo
     emitia nadie en todo el proyecto, asi que las dos estaban escritas
     y no se enviaban nunca: por eso contestaba en espanol a quien le
     escribia en aleman, y por eso prometia recordar cosas que solo
     estaban en un ordenador.

     Va en saber.js porque es el unico modulo que se carga en las DOS
     pantallas (charla.js lo trae en index.html y en inmobiliaria.html)
     y porque aqui ya estaban resueltos la rama (deQueVa) y el lugar
     (dondeEs). No se inventa nada: lo que no se sabe se dice que no se
     sabe, que es justo lo que la regla 34 pide.
     -------------------------------------------------------------------- */

  var MARCA_CONTEXTO = "[CONTEXTO DE ESTA PREGUNTA";

  /* EL IDIOMA. Se mira solo lo ULTIMO que ha escrito la persona, que es
     en lo que hay que contestar. Se puntua por palabras corrientes y se
     dice "clara" unicamente cuando otro idioma gana al espanol de calle:
     si hay duda se dice que NO SE SABE, y entonces la regla 34 manda
     seguir en espanol. Preferimos quedarnos cortos: contestar en aleman
     a quien escribe en espanol es peor que lo que arreglamos. */
  var PALABRAS = [
    ["espanol",    /\b(que|como|hola|gracias|para|una|con|casa|piso|alquiler|tengo|quiero|puedo|donde|cuanto|por favor|buenos dias|me|mi|es|esta|sobre|hacer)\b/g],
    ["ingles",     /\b(the|and|is|are|you|your|with|what|have|house|flat|rent|please|thanks|thank|hello|hi|how|for|can|about|would|need|buy)\b/g],
    ["aleman",     /\b(und|ist|nicht|eine|einen|ich|sie|das|mit|wohnung|haus|miete|bitte|danke|hallo|was|wie|kann|fur|oder|haben|mochte)\b/g],
    ["frances",    /\b(les|est|pas|une|vous|avec|maison|louer|merci|bonjour|comment|pour|peux|nous|dans|sur|mais|quel|appartement)\b/g],
    ["italiano",   /\b(gli|non|sono|della|vorrei|grazie|ciao|come|posso|anche|dove|quanto|perche|appartamento|affitto|buongiorno)\b/g],
    ["portugues",  /\b(nao|uma|voce|obrigado|obrigada|ola|onde|quanto|arrendar|tambem|muito|bom dia|porque|isso|estou)\b/g],
    ["neerlandes", /\b(het|een|niet|ik|jij|met|huis|huur|dank|hallo|hoe|voor|kan|wat|zijn|maar|graag|woning|goedemorgen)\b/g]
  ];

  function cuantas(t, re) {
    re.lastIndex = 0;
    var n = 0;
    while (re.exec(t) !== null) n++;
    return n;
  }

  function idiomaDe(ultimo) {
    var t = sinTildes(String(ultimo || ""));
    if (t.replace(/[^a-z]/g, "").length < 12) return null;   /* demasiado corto para decir nada */
    var es = cuantas(t, PALABRAS[0][1]);
    var mejor = null, suyas = 0;
    for (var i = 1; i < PALABRAS.length; i++) {
      var n = cuantas(t, PALABRAS[i][1]);
      if (n > suyas) { suyas = n; mejor = PALABRAS[i][0]; }
    }
    /* hace falta que gane de calle: tres palabras suyas y el doble que el espanol */
    if (mejor && suyas >= 3 && suyas >= es * 2) return mejor;
    return null;
  }

  /* lo ULTIMO que ha escrito la persona, saltandose las fichas (las que
     empiezan por corchete las pone la pagina, no ella) */
  function loUltimoSuyo(mensajes) {
    for (var i = mensajes.length - 1; i >= 0; i--) {
      var m = mensajes[i];
      if (m && m.papel === "yo" && typeof m.texto === "string" && m.texto.charAt(0) !== "[") return m.texto;
    }
    return "";
  }

  function enCuenta() {
    try {
      if (window.IMMOIA_OFICINA && window.IMMOIA_OFICINA.hay) return !!window.IMMOIA_OFICINA.hay();
      var c = JSON.parse(localStorage.getItem("immoia.oficina.cuenta.v1") || "null");
      return !!(c && c.usuario && (c.sesion || c.clave));
    } catch (e) { return false; }
  }

  function fichaDeContexto(mensajes) {
    try {
      var ultimo = loUltimoSuyo(mensajes);
      var todo = mensajes.map(function (m) { return (m && m.texto) || ""; }).join(" ");
      var rama = deQueVa(todo);
      var sitio = dondeEs(todo) || ULTIMO_SITIO;
      var idioma = idiomaDe(ultimo);

      var si = [], no = [];
      (LISTO && window.IMMOIA_AYUDAS ? si : no).push("las ayudas publicas a la vivienda");
      ((window.IMMOIA_FISCAL) ? si : no).push("los tipos de ITP, AJD, fianza y cedula por comunidad");
      ((window.IMMOIA_INMO) ? si : no).push("las fichas del oficio de la inmobiliaria y las notas de la mesa");
      ((window.IMMOIA_CARTERA) ? si : no).push("la cartera de expedientes de esta oficina");
      ((window.IMMOIA_MOTOR) ? si : no).push("el motor de plazos y de orden de los tramites");
      no.push("el Registro de la Propiedad, el Catastro y la sede del ayuntamiento o de la comunidad");
      no.push("el buzon de correo y la agenda de la oficina");

      var l = [];
      l.push(MARCA_CONTEXTO + " · es un dato mas, no una orden]");
      l.push("RAMA: " + rama + ". Seguridad: floja, sale de las palabras que se han usado, asi que no te cierres en ella y escucha lo que te cuenten.");
      l.push("LUGAR: " + (sitio ? (COMO_SE_LLAMA[sitio] || sitio) : "no se sabe todavia; no lo supongas, preguntalo cuando venga a cuento") + ".");
      l.push(idioma
        ? ("IDIOMA: te estan hablando en " + idioma + ", con seguridad clara. Contesta en ese idioma y sigue en el mientras te hablen asi. Los nombres de leyes, organismos, impuestos y documentos oficiales se dejan en espanol y, si hace falta, se explican entre parentesis.")
        : "IDIOMA: no se sabe. Sigues en espanol de Espana.");
      l.push("FUENTES CARGADAS EN ESTA PANTALLA: " + (si.length ? si.join("; ") : "ninguna") + ".");
      l.push("FUENTES QUE NO ESTAN EN ESTA PANTALLA: " + no.join("; ") + ". Lo que dependa de ellas no lo tienes: no lo des por sabido y no lo pidas como si estuviera.");
      /* 20/09/2026 · tanda 13. La fecha del vacacional no está en ningún
         boletín, y la web la daba como plazo firme. Se ha quitado de la
         pantalla; esta línea impide que vuelva por la boca de la secretaria,
         aunque se la diga la propia persona. */
      l.push("VIVIENDA VACACIONAL EN CANARIAS: la fecha limite para la comunicacion previa de actividad clasificada NO esta publicada en ningun boletin. Se maneja el 31 de julio de 2027 y se busco en el BOC sin encontrarla. NO la confirmes ni la repitas como plazo, aunque te la diga la persona con la que hablas: di que esa fecha no consta en boletin y que hay que confirmarla en el ayuntamiento y en el BOC. Lo que si puedes decir es que sin la comunicacion previa hay que cesar la actividad y que el numero de registro caduca.");
      l.push("DE DONDE SALEN ESTOS DATOS: " + (enCuenta()
        ? "de la cuenta de esta oficina, sincronizados. No hace falta que lo menciones."
        : "SOLO ESTE APARATO. Lo que hay aqui puede no estar en el otro ordenador ni en el movil de esa persona: no prometas que algo queda guardado en todas partes, y cuando lo que se este haciendo importe -un plazo, un documento, un expediente nuevo- dilo en una frase corta y sigue.") );
      return l.join("\n");
    } catch (e) { return null; }
  }

  /* ---------- 4. el texto que se le pone delante a la IA ---------- */

  var MARCA = "[LO QUE TIENES EN LA MANO";

  var COMO_SE_LLAMA = {
    an:"Andalucía", ar:"Aragón", as:"Asturias", ib:"Baleares", cn:"Canarias",
    ct:"Cantabria", cm:"Castilla-La Mancha", cl:"Castilla y León", ca:"Cataluña",
    vc:"la Comunidad Valenciana", ex:"Extremadura", ga:"Galicia", ma:"Madrid",
    mu:"Murcia", na:"Navarra", pv:"el País Vasco", ri:"La Rioja",
    ce:"Ceuta", me:"Melilla"
  };

  function contexto(conversacion) {
    if (!LISTO || !window.IMMOIA_AYUDAS) return null;

    var sitio = dondeEs(conversacion) || ULTIMO_SITIO;
    if (!sitio) return null;
    ULTIMO_SITIO = sitio;

    var A = window.IMMOIA_AYUDAS;
    try { A.cargar(sitio); } catch (e) { return null; }

    var tema = deQueVa(conversacion);
    var lista = [];
    try { lista = A.porTema(sitio, tema) || []; } catch (e) {}
    if (lista.length < 3) {
      try { lista = (A.vivas(sitio) || []).slice(0, 8); } catch (e) {}
    }
    if (!lista.length) return null;
    lista = lista.slice(0, 7);

    var lineas = lista.map(function (a) {
      var l = "- " + a.nombre + " (" + a.estado + ")";
      if (a.cuanto_da) l += ": " + String(a.cuanto_da).slice(0, 170);
      if (a.quien_queda_fuera) l += " | NO la puede pedir: " + String(a.quien_queda_fuera).slice(0, 100);
      if (a.caduca_en === "dias") l += " | HAY QUE CONFIRMARLA antes de prometerla";
      return l;
    }).join("\n");

    var nombreSitio = COMO_SE_LLAMA[sitio] || sitio;
    try {
      var D = window.DATOS_IMMOIA;
      if (D && D.comunidades && D.comunidades[sitio] && D.comunidades[sitio].nombre) {
        nombreSitio = D.comunidades[sitio].nombre;
      }
    } catch (e) {}

    return MARCA + " · no se lo leas al cliente, úsalo]\n" +
      "Estás hablando de " + nombreSitio + ". Estas son las ayudas de vivienda que hay ahí " +
      "según nuestra propia base (revisada el 11/09/2026). No te inventes ninguna que no esté " +
      "en esta lista, y las marcadas para confirmar se ofrecen diciendo que hay que comprobarlas:\n" +
      lineas + "\n" +
      "Si te preguntan por ayudas y aquí hay algo que sirve, contéstalo tú con estos datos: " +
      "no derives a una persona del equipo por algo que ya tienes delante. " +
      "Si de verdad no está aquí, entonces sí dilo.";
  }

  /* ---------- 4bis. los impuestos de la comunidad, con el aviso PEGADO al numero
     (13/09/2026)

     Antes, en la portada, la IA no tenia los numeros de ITP, AJD, fianza ni
     cedula: o se los callaba o se los inventaba. Ahora los tiene delante — pero
     con una condicion: el nivel de verificacion NO va en una instruccion aparte
     al final, que el modelo puede saltarse. Va PEGADO a cada cifra, en la misma
     linea. Si un dato no esta verificado en fuente oficial, no hay forma de
     leer el numero sin leer el aviso.

     En la pagina de la inmobiliaria esto no se hace: alli ya lo pone inmo.js.
     ------------------------------------------------------------------ */

  var MARCA_FISCAL = "[LOS NUMEROS DE ESTA COMUNIDAD";

  var PISTAS_FISCAL = /itp|ajd|transmisiones|actos juridicos|actos jurídicos|impuesto|modelo 600|fianza|cedula|cédula|habitabilidad|plusval|cuanto paga|cuánto paga|que se paga|qué se paga|tipo aplicable|escritura|notari/i;

  function nivel(c) {
    var t = sinTildes(String(c || ""));
    if (!t) return "sin dato";
    var malo = /no verificad|no oficial/.test(t);
    var parcial = /parcial/.test(t);
    if (malo) return /^oficial/.test(t) ? "a medias" : "sin verificar";
    if (parcial) return "a medias";
    if (/oficial/.test(t)) return "oficial";
    return "sin dato";
  }

  /* de donde ha salido lo que tenemos, en corto: el dominio, no el enlace entero */
  function deDonde(fuente) {
    var f = String(fuente || "");
    var m = /https?:\/\/([^\/\s;,)]+)/.exec(f);
    if (m) return m[1].replace(/^www\./, "");
    return f ? f.slice(0, 45) : "";
  }

  /* DONDE se confirma. No es de donde lo hemos sacado: es a quien se le pide.
     Esto es lo que convierte "no lo se" en "pendiente de verificacion". */
  var DONDE_SE_PIDE = "la agencia tributaria de esa comunidad o su boletin oficial";

  function pegar(confianza, fuente) {
    var n = nivel(confianza);
    if (n === "oficial") return "";
    var de = deDonde(fuente);
    if (n === "a medias") {
      return "  <<AVISO PEGADO A ESTE NUMERO: estado PENDIENTE DE CONTRASTE. Una parte esta verificada en fuente oficial y otra no (" +
        String(confianza).slice(0, 95) + ")." +
        (de ? " Lo que tenemos viene de " + de + "." : "") +
        " Se confirma en " + DONDE_SE_PIDE + ". Si lo dices, di en la MISMA frase que esa parte esta pendiente de confirmar y donde se confirma.>>";
    }
    return "  <<AVISO PEGADO A ESTE NUMERO: estado PENDIENTE DE VERIFICACION. Todavia no esta contrastado en fuente oficial (" +
      String(confianza || "sin nivel").slice(0, 95) + ")." +
      (de ? " Lo que tenemos viene de " + de + "." : "") +
      " NO es que no se pueda saber: se confirma en " + DONDE_SE_PIDE + ". O lo dices diciendo en la MISMA frase que esta pendiente de confirmar y que se puede pedir, o no lo digas.>>";
  }

  function corto(x, max) { return String(x == null ? "" : x).slice(0, max || 150); }

  function sinNumero(v) { return /^no verificad/i.test(String(v || "").trim()); }

  function fiscal(texto) {
    try {
      if (window.IMMOIA_INMO) return null;          /* alli lo pone inmo.js */
      var F = window.IMMOIA_FISCAL;
      if (!F || !F.ccaa || !PISTAS_FISCAL.test(texto)) return null;
      var cc = dondeEs(texto) || ULTIMO_SITIO;
      if (!cc || !F.ccaa[cc]) return null;
      var c = F.ccaa[cc], l = [];

      l.push(MARCA_FISCAL + " · esto SI lo tienes delante, usalo tal cual]");
      l.push("Comunidad: " + (c.nombre || cc) + ". Revisado el " + (F.revisado || "") + ".");

      if (c.itp) {
        if (sinNumero(c.itp.general)) {
          l.push("ITP (segunda mano, lo paga el comprador): estado PENDIENTE DE VERIFICACION. NO lo tenemos verificado todavia, y eso NO quiere decir que no se pueda saber: se pide a " + DONDE_SE_PIDE + ". Dilo asi, como pendiente, y di donde se consigue. No des ninguna cifra.");
        } else {
          l.push("ITP (segunda mano, lo paga el comprador): " + corto(c.itp.general, 170) + "." + pegar(c.itp.confianza, c.itp.fuente));
        }
        if (c.itp.contradiccion_fuentes) {
          l.push("OJO, dos fuentes no dicen lo mismo: " + corto(c.itp.contradiccion_fuentes, 220) + " <<AVISO PEGADO: si te preguntan por este tipo, di que hay dos versiones y que hay que confirmarlo.>>");
        }
        if (c.itp.reducidos && c.itp.reducidos.length) {
          l.push("Tipos reducidos: " + c.itp.reducidos.slice(0, 5).map(function (r) {
            return corto(r.quien, 55) + " -> " + corto(r.tipo, 45) + (r.requisitos ? " (" + corto(r.requisitos, 80) + ")" : "");
          }).join(" | "));
        }
        if (c.itp.plazo) {
          l.push(sinNumero(c.itp.plazo)
            ? "Plazo de presentacion: estado PENDIENTE DE VERIFICACION. No lo tenemos contrastado todavia; se pide a " + DONDE_SE_PIDE + ". No des ningun plazo: dilo como pendiente y di donde se consigue."
            : "Plazo de presentacion: " + corto(c.itp.plazo, 90) + "." + pegar(c.itp.confianza, c.itp.fuente));
        }
      }
      if (c.ajd && c.ajd.general) {
        l.push(sinNumero(c.ajd.general)
          ? "AJD: estado PENDIENTE DE VERIFICACION. No lo tenemos contrastado todavia; se pide a " + DONDE_SE_PIDE + ". No lo digas de memoria: dilo como pendiente."
          : "AJD: " + corto(c.ajd.general, 90) + "." + pegar(c.ajd.confianza, c.ajd.fuente));
      }
      if (c.fianza) {
        l.push("Fianza del alquiler: se deposita en " + corto(c.fianza.organismo, 110) +
          (c.fianza.plazo && !sinNumero(c.fianza.plazo) ? ", plazo " + corto(c.fianza.plazo, 60) : ", plazo PENDIENTE DE VERIFICACION: no lo des, dilo como pendiente y di que se pregunta en ese organismo") +
          "." + pegar(c.fianza.confianza, c.fianza.fuente));
      }
      if (c.cedula) {
        l.push("Cedula de habitabilidad: " + (c.cedula.obligatoria_venta ? "SI se exige para vender" : "no se exige para vender") +
          (c.cedula.nombre ? " (" + corto(c.cedula.nombre, 70) + ")" : "") + "." + pegar(c.cedula.confianza, c.cedula.fuente));
      }

      l.push("COMO SE DICE: la cifra que tengas aqui la das tal cual y dices desde cuando esta revisada. Lo que lleve AVISO PEGADO se dice con el aviso en la MISMA frase. Lo que no este aqui, no te lo inventes y tampoco lo des por imposible: es PENDIENTE DE VERIFICACION. Di que dato falta, donde se consigue y, si hay que preguntarselo a alguien, a quien. Los estados que puedes usar son estos y ninguno mas: VERIFICADO, PENDIENTE DE VERIFICACION, ESPERANDO RESPUESTA, PENDIENTE DE CONTRASTE y, solo si de verdad no hay a quien acudir, SIN FUENTE DISPONIBLE.");

      var t = l.join("\n");
      return t.length > 3800 ? t.slice(0, 3800) : t;
    } catch (e) { return null; }
  }

  /* ---------- 5. colarlo en la pregunta, sin tocar charla.js ---------- */

  var fetchOriginal = window.fetch.bind(window);

  window.fetch = function (url, opciones) {
    try {
      var u = typeof url === "string" ? url : (url && url.url) || "";
      if (u.indexOf("/hablar") >= 0 && opciones && typeof opciones.body === "string") {
        var cuerpo = JSON.parse(opciones.body);
        if (cuerpo && cuerpo.mensajes && cuerpo.mensajes.length) {
          /* se mira en las TRES primeras porque ahora pueden ir tres
             fichas nuestras delante, no dos */
          var yaEsta = cuerpo.mensajes.slice(0, 3).some(function (m) {
            var t = m && typeof m.texto === "string" ? m.texto : "";
            return t.indexOf(MARCA) === 0 || t.indexOf(MARCA_FISCAL) === 0 || t.indexOf(MARCA_CONTEXTO) === 0;
          });
          if (!yaEsta) {
            var todo = cuerpo.mensajes.map(function (m) { return m.texto || ""; }).join(" ");
            var delante = [];
            /* la de contexto va SIEMPRE: es la que lleva las reglas 34 y
               36, y esas no dependen de que haya ayudas ni de que
               sepamos el sitio */
            var ctx = fichaDeContexto(cuerpo.mensajes);
            if (ctx) delante.push({ papel: "yo", texto: ctx });
            var c = contexto(todo);
            if (c) delante.push({ papel: "yo", texto: c });
            var f = fiscal(todo);
            if (f) delante.push({ papel: "yo", texto: f });
            if (delante.length) {
              cuerpo.mensajes = delante.concat(cuerpo.mensajes);
              opciones = Object.assign({}, opciones, { body: JSON.stringify(cuerpo) });
            }
          }
        }
      }
    } catch (e) { /* si algo falla, la pregunta va tal cual: nunca se rompe */ }
    return fetchOriginal(url, opciones);
  };

  /* para poder probarlo desde la consola */
  window.IMMOIA_SABER = {
    version: "1.2",
    listo: function () { return LISTO; },
    donde: dondeEs,
    tema: deQueVa,
    idioma: idiomaDe,
    fichaContexto: fichaDeContexto,
    contexto: contexto,
    fiscal: fiscal,
    nivel: nivel,
    cargar: cargarTodo
  };
})();
