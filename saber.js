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
          var yaEsta = cuerpo.mensajes.slice(0, 2).some(function (m) {
            var t = m && typeof m.texto === "string" ? m.texto : "";
            return t.indexOf(MARCA) === 0 || t.indexOf(MARCA_FISCAL) === 0;
          });
          if (!yaEsta) {
            var todo = cuerpo.mensajes.map(function (m) { return m.texto || ""; }).join(" ");
            var delante = [];
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
    version: "1.1",
    listo: function () { return LISTO; },
    donde: dondeEs,
    tema: deQueVa,
    contexto: contexto,
    fiscal: fiscal,
    nivel: nivel,
    cargar: cargarTodo
  };
})();
