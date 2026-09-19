/* ==================================================================
   IMMO IA · secretaria_sabe.js — QUE LA SECRETARIA TENGA SU OFICINA
                                  DELANTE
   ------------------------------------------------------------------
   EL PROBLEMA QUE ARREGLA, medido el 19/09/2026:

   charla.js manda al servidor {codigo, mensajes} y nada mas. saber.js
   le anade las ayudas del municipio y la ficha de contexto; inmo.js le
   anade el encargo, la mesa y las fichas de temas. NINGUNO DE LOS DOS
   MANDA UN SOLO DATO DE LOS EXPEDIENTES. Asi que cuando la directora
   pregunta «¿que tengo pendiente?», la secretaria no contesta mal: no
   tiene con que contestar.

   LO QUE HACE ESTO: una ficha mas en la peticion, con el RESUMEN de la
   cartera. No la base de datos: el resumen. Cuantos expedientes hay,
   cual vence, cual esta parado y que papel falta en cual.

   DE DONDE SALE: de repaso.js, que ya existe y ya esta publicado. El
   repaso mira la cartera entera con reglas, sin llamar a ninguna IA, y
   dice que frena cada expediente. Aqui no se calcula NADA nuevo: se
   coge lo que el repaso ya sabe y se escribe en el formato de ficha
   que el servidor ya entiende.

   LAS DOS REGLAS DE LA CASA, GRABADAS AQUI DENTRO:

   1) CERO INVENTO. Solo se escribe lo que este en el expediente. Si
      falta un dato, se escribe que falta, con esas palabras. Esto no
      redondea una fecha, no supone el tipo de operacion y no cuenta un
      papel que no consta. Y no recorta en silencio: si no caben todos
      los expedientes, LO DICE y dice cuantos se han quedado fuera, que
      es lo unico que evita que «tienes 4» suene a «tienes 4 en total».

   2) QUE QUEPA Y NO CUESTE UNA FORTUNA. El bloque de reglas del
      servidor ya mide 19.584 letras, y en la pagina de la inmobiliaria
      viajan 30.073 de reglas fijas en CADA mensaje. Asi que esta ficha
      tiene un tope duro de letras (TOPE) y se ajusta a el quitando
      detalle, nunca inventandolo. Si la cartera crece, la ficha no.

   DONDE SE ENCHUFA: charla.js la carga junto a secretaria.js y
   saber.js. Se envuelve window.fetch igual que hacen esos dos, asi que
   ni charla.js ni inmobiliaria.html tienen que saber que existe.

   DONDE NO HACE NADA: si no hay cartera en la pagina (la portada, la
   calculadora), esto no anade ni una letra y la pregunta va tal cual.
   Se comprueba con IMMOIA_CARTERA, no con la direccion de la pagina.

   Si algun dia molesta, se quita la linea de charla.js y todo vuelve a
   estar exactamente igual.
   ================================================================== */
(function () {
  "use strict";

  if (window.IMMOIA_SABE_LA_OFICINA) return;

  var VERSION = "1.0";

  /* La marca. El servidor parte los mensajes en «fichas» y
     «conversacion» mirando si empiezan por corchete y si el corchete se
     cierra en las primeras 140 letras (worker.js, esFicha). Las fichas
     NO se recortan cuando la conversacion se alarga. Por eso esta linea
     tiene que ser corta y cerrar el corchete pronto. */
  var MARCA = "[LA CARTERA DE ESTA OFICINA";

  /* EL TOPE. 3.000 letras es lo medido: es lo que hace falta para decir
     los numeros de toda la cartera MAS el detalle de seis expedientes.
     Es un tope DURO, y lo que no entra se CUENTA, no se calla.
     Para hacerse una idea de lo que es: en la pagina de la inmobiliaria
     ya viajan hoy 30.073 letras de reglas fijas en cada mensaje. */
  var TOPE = 3000;

  /* cuantos expedientes se cuentan con detalle. Del resto va el nombre
     y se dice que solo va el nombre. */
  var CON_DETALLE = 6;

  /* ---------------- 1. traer repaso.js si no esta ----------------
     repaso.js ya esta publicado, pero inmobiliaria.html no lo carga (y
     no se toca esa pagina). Se trae igual que saber.js se trae las
     ayudas: si no llega, esto no hace nada y la pregunta va tal cual. */

  var PIDIENDO = false;

  function traerRepaso() {
    if (window.IMMOIA_REPASO || PIDIENDO) return;
    PIDIENDO = true;
    try {
      var s = document.createElement("script");
      s.src = "repaso.js?v=1";
      s.async = true;
      (document.body || document.documentElement).appendChild(s);
    } catch (e) { /* sin repaso no hay ficha, y no pasa nada mas */ }
  }

  /* ---------------- 2. utiles ---------------- */

  function sinTildes(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
      .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n");
  }

  function corto(x, n) { return String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, n || 90); }

  /* dd/mm, que es como lo dice ella */
  function dia(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
    return iso.slice(8, 10) + "/" + iso.slice(5, 7);
  }

  function dias(a, b) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b || ""))) return null;
    return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
  }

  /* lo ULTIMO que ha escrito ella, saltandose las fichas que pone la
     pagina (las que empiezan por corchete) */
  function loUltimoSuyo(mensajes) {
    for (var i = mensajes.length - 1; i >= 0; i--) {
      var m = mensajes[i];
      if (m && m.papel === "yo" && typeof m.texto === "string" && m.texto.charAt(0) !== "[") return m.texto;
    }
    return "";
  }

  /* ---------------- 3. el repaso, sin tocar nada ----------------
     Solo LEE. No llama a IMMOIA_BANDEJA.estado(), que recalcula y
     escribe en el almacen: aqui se lee guardado.gestiones tal cual. */

  function hoyISO() {
    try { if (window.IMMOIA_HOY) return window.IMMOIA_HOY(); } catch (e) {}
    var d = new Date(), m = d.getMonth() + 1, x = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (x < 10 ? "0" + x : x);
  }

  /* Las gestiones que ya se pidieron a un tercero y nadie ha
     contestado. Salen de la propia cartera, un expediente por vez, asi
     que valen para TODA la cartera y no solo para el que este abierto. */
  function esperando(C, hoy) {
    var out = [];
    try {
      (C.lista() || []).forEach(function (e) {
        var x = C.expediente(e.id);
        if (!x || x.cerrado) return;
        var g = (x.guardado && x.guardado.gestiones) || [];
        g.forEach(function (z) {
          if (!z || z.estado === "cerrada" || z.estado === "preparada") return;
          out.push({
            donde: x.nombre || e.id,
            quien: corto(z.organismo, 40),
            que: corto(z.motivo, 60),
            desde: z.desde || null,
            vence: z.vence || null,
            estado: z.estado,
            dias: z.vence ? dias(z.vence, hoy) : null
          });
        });
      });
    } catch (e) {}
    return out;
  }

  /* ---------------- 4. LA FICHA ----------------
     Se escribe de mas a menos importante, para que el tope recorte por
     el final -que es el detalle- y nunca por los numeros de arriba. */

  /* El «como se lee esto» va DENTRO de la ficha, no en una regla del
     servidor, y es a proposito: el servidor esta congelado. Es la misma
     idea que usa saber.js con los impuestos -el aviso pegado a la
     cifra, no en una instruccion al final-, porque una instruccion
     aparte se la puede saltar y una que va en el mismo parrafo que el
     dato, no. Cuando el trozo de EL_TROZO_DEL_SERVIDOR.md este puesto,
     estas seis lineas se pueden acortar a una. */
  function comoSeLee() {
    return MARCA + " · leido de su pantalla; no se lo leas tal cual, usalo]\n"
      + "COMO SE LEE: estos numeros y estas fechas salen de su pantalla y de un calculo de "
      + "fechas, no de tu memoria: los dices tal cual, como las cifras de las otras fichas. "
      + "LO QUE NO ESTE AQUI NO LO TIENES: no lo supongas ni lo redondees; di que eso no te "
      + "consta y donde se mira. Mejor un «no me consta» que un plazo inventado. Es SU cartera, "
      + "no clientes de IMMO IA: la regla 2 es sobre lo que IMMO IA cobra y tramita, y hoy no es "
      + "nada. Y SOLO LEES: no has apuntado nada ni has mandado nada.";
  }

  function fichaDeLaCartera(mensajes) {
    var C = window.IMMOIA_CARTERA;
    var R = window.IMMOIA_REPASO;
    if (!C || !C.lista) { traerRepaso(); return null; }   /* no es la pagina de la oficina */
    if (!R || !R.deLaCartera) { traerRepaso(); return null; }

    var hoy = hoyISO();
    var r;
    try { r = R.deLaCartera(C, hoy); } catch (e) { return null; }
    if (!r) return null;

    var l = [comoSeLee()];
    l.push("HOY ES " + hoy + ".");

    if (!r.cuantos) {
      l.push("NO TIENE NINGUN EXPEDIENTE ABIERTO en esta pantalla. Cero. Asi que no hay nada "
           + "pendiente que yo pueda ver, y no te inventes uno: si te pregunta que tiene "
           + "pendiente, dile que no tiene ninguno abierto aqui y ofrecele abrir el primero.");
      return l.join("\n");
    }

    var p = r.patrones || {};

    /* --- 4.1 los numeros de arriba: esto no se recorta nunca --- */
    l.push("TIENE " + r.cuantos + " EXPEDIENTE" + (r.cuantos === 1 ? "" : "S") + " ABIERTO"
         + (r.cuantos === 1 ? "" : "S") + " en esta pantalla. No hay mas: los cerrados no cuentan.");

    /* vencido de verdad */
    var vencidos = [];
    (r.hallazgos || []).forEach(function (x) {
      if (x.clase !== "vencido") return;
      vencidos.push(x.donde + ": " + corto(x.titulo, 48) + (x.vence ? " (el plazo era el " + dia(x.vence) + ")" : ""));
    });
    if (vencidos.length) l.push("PLAZO YA PASADO (" + vencidos.length + "): " + vencidos.slice(0, 4).join(" | ") + ".");

    /* lo que vence dentro de la semana */
    var cerca = (p.cerca || []).map(function (c) {
      return c.x.donde + ": " + corto(c.x.titulo, 48) + " — " + dia(c.x.vence)
           + " (" + (c.dias === 0 ? "hoy" : c.dias === 1 ? "manana" : "en " + c.dias + " dias") + ")";
    });
    l.push(cerca.length
      ? "VENCE ESTA SEMANA (" + (p.expedientes_con_prisa || cerca.length) + " expediente"
        + ((p.expedientes_con_prisa || cerca.length) === 1 ? "" : "s") + "): " + cerca.slice(0, 5).join(" | ") + "."
      : "ESTA SEMANA NO VENCE NADA de lo que yo veo.");

    /* parados */
    var parados = (p.parados || []).map(function (x) { return x.donde + ": " + corto(x.titulo, 48); });
    if (parados.length) l.push("PARADOS (" + (p.expedientes_parados || parados.length) + "): " + parados.slice(0, 4).join(" | ") + ".");

    /* DE LOS QUE NO SE LO SUFICIENTE. Va ARRIBA, con los numeros, y no
       abajo con el detalle, justamente porque es la linea que no se
       puede quedar fuera: es la que evita que un expediente del que no
       sabemos nada parezca un expediente sin nada pendiente. */
    var ciegos = [];
    (r.expedientes || []).forEach(function (u) {
      var x = (u.hallazgos || []).filter(function (h) { return h.clase === "incompleto"; })[0];
      if (x) ciegos.push(u.donde + " (" + corto(x.titulo, 42) + ")");
    });
    if (ciegos.length) {
      l.push("DE " + ciegos.length + " NO SE LO SUFICIENTE PARA REPASARLOS: " + ciegos.slice(0, 4).join(" | ")
           + ". De esos NO digas que estan bien ni que no les falta nada: di que falta el dato y cual.");
    }

    /* el atasco de toda la cartera: esto no se ve de uno en uno */
    if (p.atasco) {
      l.push("EL ATASCO DE TODA LA CARTERA: " + corto(p.atasco.cual, 60) + " frena "
           + p.atasco.cuantos + " de los " + r.cuantos + " (" + p.atasco.donde.slice(0, 4).join(", ") + ").");
    }

    /* el mismo piso dos veces */
    (p.duplicados || []).slice(0, 2).forEach(function (d) {
      l.push("EL MISMO PISO ESTA " + d.cuantos + " VECES: " + d.donde
           + (d.duenos_distintos ? ", y a nombre de propietarios distintos" : "")
           + ". Hay que mirarlo antes de seguir con ninguno de los dos.");
    });

    /* dos relojes el mismo dia */
    (p.choques || []).slice(0, 2).forEach(function (c) {
      l.push("EL " + dia(c.fecha) + " CHOCAN DOS COSAS"
           + (c.mismo_expediente ? " en " + c.cosas[0].donde : "") + ": "
           + c.cosas.slice(0, 3).map(function (x) { return corto(x.que, 40) + (c.mismo_expediente ? "" : " (" + x.donde + ")"); }).join(" y ") + ".");
    });

    /* esperando a un tercero */
    var esp = esperando(C, hoy);
    if (esp.length) {
      l.push("PEDIDO Y SIN CONTESTAR (" + esp.length + "): " + esp.slice(0, 4).map(function (z) {
        return z.donde + ": " + z.que + " a " + z.quien
             + (z.vence ? " — vencia el " + dia(z.vence) + (z.dias !== null && z.dias < 0 ? ", lleva " + (-z.dias) + " dias de retraso" : "") : "")
             + (z.estado === "vencida" ? " [VENCIDA]" : z.estado === "reclamada" ? " [ya reclamada]" : "");
      }).join(" | ") + ".");
    }

    /* --- 4.2 el detalle por expediente: «que le falta al de la calle X» --- */

    /* si ha nombrado un expediente, ese va primero y con todo su
       detalle; es lo unico que hace falta para contestarle a ella */
    var pregunta = sinTildes(loUltimoSuyo(mensajes || []));
    var unos = (r.expedientes || []).slice();
    function nombrada(u) {
      var d = sinTildes(u.donde);
      if (!pregunta || d.length < 4) return false;
      /* se compara por trozos de la direccion de 4 letras o mas, para
         que «la calle Botanico» encuentre «Botanico 14, 2A» */
      return d.split(/[^a-z0-9]+/).some(function (t) {
        return t.length >= 4 && pregunta.indexOf(t) >= 0;
      });
    }
    unos.sort(function (a, b) {
      var na = nombrada(a) ? 1 : 0, nb = nombrada(b) ? 1 : 0;
      if (na !== nb) return nb - na;
      return (b.hallazgos || []).length - (a.hallazgos || []).length;
    });

    /* una linea por expediente */
    function lineaDe(u) {
      var t = "· " + u.donde + " — " + (u.operacion ? u.operacion : "OPERACION SIN DECIR: no supongas si es venta, alquiler o vacacional");
      var faltan = (u.faltan || []).map(function (f) { return corto(f.cual, 45); });
      t += faltan.length ? ". FALTA: " + faltan.slice(0, 5).join(", ")
                         : ". No consta que le falte ningun papel de la tabla";
      var pl = (u.plazos || []).filter(function (z) { return z.fecha; }).slice(0, 3).map(function (z) {
        return corto(z.que, 38) + " el " + dia(z.fecha);
      });
      if (pl.length) t += ". FECHAS: " + pl.join(", ");
      var ciego = (u.hallazgos || []).filter(function (x) { return x.clase === "incompleto"; });
      if (ciego.length) t += ". DE ESTE NO SE LO SUFICIENTE: " + corto(ciego[0].detalle, 110);
      return t + ".";
    }

    /* --- 4.3 EL TOPE DURO.
       Primero se cierran los numeros de arriba, que no se recortan nunca.
       Luego se meten expedientes mientras quepan, y LO QUE NO CABE SE
       CUENTA: que «tienes 6» no puede sonar a «tienes 6 en total» si
       solo van 4, y que un expediente del que no va el detalle no puede
       parecer un expediente sin nada pendiente. --- */

    var arriba = l.join("\n");
    var titular = "UNO POR UNO (lo que hay escrito en cada uno, y nada mas):";

    /* El aviso de lo que se ha quedado fuera. Se escribe de verdad, con
       los nombres, para MEDIRLO: antes se reservaba un numero a ojo y
       con carteras grandes el aviso no cabia, asi que se caia el aviso
       -que es justo lo que no puede faltar- en vez de un expediente. */
    function avisoDeLosQueFaltan(nombres) {
      if (!nombres.length) return null;
      return "Y " + nombres.length + " EXPEDIENTE" + (nombres.length === 1 ? "" : "S")
           + " MAS, de los que aqui NO llevo el detalle (solo el nombre): "
           + nombres.slice(0, 10).join("; ") + (nombres.length > 10 ? "; y " + (nombres.length - 10) + " mas" : "")
           + ". De esos NO sabes que les falta ni que fecha tienen: no digas que no tienen nada "
           + "pendiente, di que necesitas que abra ese en la pantalla. NO te lo inventes.";
    }

    function armar(cuantasLineas) {
      var l2 = [arriba];
      if (cuantasLineas) l2.push(titular, unos.slice(0, cuantasLineas).map(lineaDe).join("\n"));
      var av = avisoDeLosQueFaltan(unos.slice(cuantasLineas).map(function (u) { return u.donde; }));
      if (av) l2.push(av);
      return l2.join("\n");
    }

    /* se van metiendo expedientes de uno en uno y se MIDE el resultado
       entero cada vez, aviso incluido. Se para en el ultimo que cabe. */
    var cuantas = 0;
    var tope = Math.min(CON_DETALLE, unos.length);
    for (var i = 1; i <= tope; i++) {
      if (armar(i).length <= TOPE) cuantas = i; else break;
    }

    var texto = armar(cuantas);
    /* cinturon: si aun asi se pasa, se quedan solo los numeros y se dice */
    if (texto.length > TOPE) {
      texto = arriba + "\nNO CABE EL DETALLE DE UNO POR UNO (son " + r.cuantos
            + " expedientes). Lo de arriba esta completo; del detalle de cada uno no tienes nada, "
            + "asi que si te pregunta por uno concreto di que lo abra en la pantalla. NO te lo inventes.";
    }
    return texto;
  }

  /* ---------------- 5. colarlo en la pregunta, sin tocar charla.js ----------------
     Igual que lo hacen saber.js e inmo.js. Si algo falla, la pregunta
     va tal cual: esto nunca rompe el chat. */

  /* DONDE SE METE LA FICHA, QUE NO ES UN DETALLE.
     Probando se vio que los dos sitios evidentes estan mal:

     AL PRINCIPIO se PIERDE. La cadena es: esta ficha se pone, luego
     saber.js pone la suya delante, y luego inmo.js aparta las fichas que
     encuentra al principio Y con ficha:true, y de lo que queda se
     guarda solo los ultimos ~16 mensajes. La ficha de saber.js no lleva
     ficha:true, asi que inmo.js se para en ella y esta se quedaba
     detras, dentro de lo que se recorta: con 81 mensajes encima
     desaparecia.

     AL FINAL DEL TODO ENGANA A inmo.js. inmo.js mira «de que se esta
     hablando ahora» cogiendo el ULTIMO mensaje de ella, y no se salta
     las fichas: si esta iba la ultima, inmo.js leia ESTA ficha en vez
     de la pregunta y colaba dos fichas de tema equivocadas -medido:
     1.300 letras de mas y el tema mal-.

     ASI QUE VA JUSTO ANTES DE LA ULTIMA PREGUNTA DE ELLA. Ahi entra
     siempre en los ultimos 16 -no se recorta- y la ultima cosa que
     dijo ella sigue siendo su pregunta, asi que inmo.js y saber.js
     siguen viendo lo que tienen que ver. Que vaya en medio no importa,
     porque el servidor reordena: se queda con las que empiezan por
     corchete y las pone DELANTE de la conversacion
     (worker.js: fichas.concat(dicho_antes)).

     OJO, PARA LA DIRECCION: ese mismo recorte se sigue llevando hoy las
     fichas de saber.js -las ayudas y el contexto- en conversaciones
     largas. Eso YA PASA, es de antes y NO se toca aqui: esta tanda
     cambia lo minimo. Esta apuntado en el INFORME.md. */
  function metidaEnSuSitio(mensajes, ficha) {
    for (var i = mensajes.length - 1; i >= 0; i--) {
      var m = mensajes[i];
      if (m && m.papel === "yo" && typeof m.texto === "string" && m.texto.charAt(0) !== "[") {
        return mensajes.slice(0, i).concat([ficha], mensajes.slice(i));
      }
    }
    return mensajes.concat([ficha]);
  }

  /* EL SALUDO DE PRUEBA NO SE PAGA DOS VECES.
     charla.js, al abrir la pagina, manda un solo «hola» para ver si el
     servidor sabe contestar. Esa es una llamada al modelo de verdad, y
     meterle el resumen de la cartera es tirar el dinero: nadie ha
     preguntado nada todavia. Se reconoce por lo que es -un unico
     mensaje que dice exactamente «hola»-, asi que una pregunta de
     verdad no cae aqui nunca. */
  function esElSaludoDePrueba(mensajes) {
    return mensajes.length === 1
        && mensajes[0] && mensajes[0].papel === "yo"
        && String(mensajes[0].texto || "").trim().toLowerCase() === "hola";
  }

  var fetchOriginal = window.fetch.bind(window);

  window.fetch = function (url, opciones) {
    try {
      var u = typeof url === "string" ? url : (url && url.url) || "";
      if (u.indexOf("/hablar") >= 0 && opciones && typeof opciones.body === "string") {
        var cuerpo = JSON.parse(opciones.body);
        if (cuerpo && cuerpo.mensajes && cuerpo.mensajes.length && !esElSaludoDePrueba(cuerpo.mensajes)) {
          /* se mira en TODOS los mensajes, no solo en los primeros,
             porque esta ficha no va al principio (ver abajo) */
          var yaEsta = cuerpo.mensajes.some(function (m) {
            return m && typeof m.texto === "string" && m.texto.indexOf(MARCA) === 0;
          });
          if (!yaEsta) {
            var f = fichaDeLaCartera(cuerpo.mensajes);
            if (f) {
              cuerpo.mensajes = metidaEnSuSitio(cuerpo.mensajes, { papel: "yo", texto: f, ficha: true });
              opciones = Object.assign({}, opciones, { body: JSON.stringify(cuerpo) });
            }
          }
        }
      }
    } catch (e) { /* la pregunta va tal cual */ }
    return fetchOriginal(url, opciones);
  };

  /* se pide repaso.js en cuanto se puede, para que en la primera
     pregunta ya este */
  if (window.IMMOIA_CARTERA || document.getElementById("car-lista")) traerRepaso();
  else setTimeout(function () { if (window.IMMOIA_CARTERA) traerRepaso(); }, 1200);

  /* para poder comprobarlo desde la consola y desde las pruebas */
  window.IMMOIA_SABE_LA_OFICINA = {
    version: VERSION,
    MARCA: MARCA,
    TOPE: TOPE,
    CON_DETALLE: CON_DETALLE,
    ficha: fichaDeLaCartera,
    comoSeLee: comoSeLee,
    esperando: esperando,
    cargar: traerRepaso
  };
})();
