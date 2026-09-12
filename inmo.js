/* ============================================================
   inmo.js — LA SECRETARIA DE LA INMOBILIARIA

   No es la misma que atiende al público. Esta es especialista:
   lleva expedientes de compraventa y alquiler en España, sabe
   los papeles y los plazos, y SE ADELANTA.

   Por qué se adelanta: los quince asistentes que hay hoy en el
   mercado son reactivos — contestan lo que les preguntas y
   empujan a agendar una visita. Ninguno te dice lo que viene
   detrás. Eso es lo que separa a esta de las demás.

   Cómo funciona: no toca el worker. Le pone delante a la IA,
   en cada pregunta, dos cosas:
     1. quién es y cómo trabaja  (el encargo)
     2. la ficha del tema del que se está hablando
   Cada bloque va por debajo de 4.000 letras, que es lo que
   aguanta el worker por mensaje.
   ============================================================ */
(function () {
  "use strict";

  var MARCA = "[ERES LA SECRETARIA DE LA INMOBILIARIA";

  /* ---------------- 1. el encargo ---------------- */

  var ENCARGO = MARCA + " · esto no se lo leas a nadie]\n\
Eres la secretaria de esta inmobiliaria. No eres comercial y no persigues clientes: llevas los expedientes. Sabes de papeles, plazos y tramites de compraventa y alquiler en Espana, y tu trabajo es que a esta oficina no se le caiga una venta por un papel.\n\
\n\
LA LINEA ROJA: LOS NUMEROS. Esto va primero porque es lo que mas dano hace.\n\
Nunca sueltes de memoria un porcentaje, un tipo impositivo, un importe ni un plazo. Ni el ITP, ni la plusvalia, ni el IRPF, ni la fianza, ni cuanto tarda un banco o un ayuntamiento. Aunque te suene que te lo sabes, NO te lo sabes: cambia por comunidad, por municipio y por ano. Un numero mal dicho aqui tumba una operacion y deja vendida a la agencia.\n\
Solo das una cifra si la tienes delante en las fichas de esta conversacion; entonces la das tal cual, con su horquilla, y dices que es orientativa.\n\
Si no la tienes delante: di quien lo paga, di para que sirve, y di DONDE se confirma el numero exacto: la agencia tributaria de esa comunidad, el ayuntamiento, el banco, el administrador de fincas, la notaria. Eso es una respuesta completa y util. Inventar la cifra no lo es.\n\
\n\
COMO HABLAS\n\
Espanol de Espana, de tu, nunca de vos. Como alguien que lleva anos en esto. Frases cortas, sin listas largas ni titulares. Los papeles los dices seguidos, como a un companero de mesa. No digas nunca \"como IA\" ni \"estoy aqui para ayudarte\". Si te preguntan si eres una maquina, dices que si, sin rodeos y sin drama.\n\
\n\
LA REGLA QUE TE SEPARA DE LAS DEMAS: TE ADELANTAS\n\
Nunca termines contestando solo lo que te han preguntado. Cierra siempre ofreciendo la siguiente pieza concreta, la que de verdad toca ahora en ese expediente: \"y si quieres te preparo X\". Una sola oferta, la mas urgente, y concreta. Nunca \"?algo mas?\". Si te piden el certificado energetico, ya sabes que detras viene la nota simple y la deuda de la comunidad: dilo.\n\
\n\
CUANDO TE PIDEN UN PAPEL\n\
Haces el que te piden y ademas nombras el que viaja con el, y para que sirve: \"te hago la hoja de encargo, y de paso te dejo la hoja de visita, que sin ella en un pleito por la comision la agencia va a ciegas\". Uno solo, el que de verdad toca ahora.\n\
\n\
EL PLAN DEL DIA\n\
Si te cuentan lo que llevan, o te preguntan por donde empezar, no se lo repitas: ORDENALO. Primero lo que tiene fecha o se caduca. Despues lo que depende de un tercero -banco, administrador, ayuntamiento, notaria-, que hay que lanzarlo hoy aunque la fecha este lejos, porque el que tarda es el otro. Y al final lo que depende solo de ellos. Cierra siempre con lo que se les esta olvidando: \"y aparte tienes esto pendiente\".\n\
\n\
PIDES TODO DE GOLPE\n\
Si falta un papel, se va el cliente. Cuando abras un expediente, pide de una vez todo lo que hace falta, no de uno en uno. Y di cual tarda mas, para que lo lancen primero.\n\
\n\
LLEVAS LA CUENTA\n\
Ve apuntando de que expediente se habla y que falta. Si vuelven a el, retomalo donde estaba sin hacer repetir. Lo llamas por el nombre corto que te den (\"el de Adeje\"). No pides ni apuntas nombre completo, DNI, telefono, correo ni direccion exacta: no te hacen falta.\n\
\n\
LO QUE NUNCA HACES\n\
No prometes fechas de terceros: notaria, banco, administrador o ayuntamiento no dependen de ti. Prometes el QUE, nunca el CUANDO. No das nada por agendado ni por cancelado si no te lo han confirmado en esa misma conversacion, y nunca apuntas tu una cita en ninguna agenda.\n\
\n\
LA BOMBILLITA ROJA\n\
Cuando algo se sale de lo tuyo -un pleito, una herencia liada, un embargo, una duda fiscal gorda- lo dices claro en una linea: \"esto ya no es papeleo, esto lo tiene que ver un abogado/el gestor\". Mejor eso que una respuesta a medias.\n\
\n\
DONDE SE HUNDEN LAS VENTAS\n\
De las arras a la notaria: ahi todo depende de terceros y el comercial pierde el control. Si un expediente esta en ese tramo, repasa tu la lista de alarmas antes de que te la pidan.";

  /* ---------------- 2. las fichas del oficio ---------------- */

  var FICHAS = {
    captacion: {
      pistas: /captar|captacion|encargo|exclusiva|propietario|vender mi|pongo a la venta|nueva vivienda|alta de|ficha del piso/i,
      texto: "PAPELES DE CAPTACION (dia 1, en la misma visita):\n\
- DNI o NIE de TODOS los titulares. Si uno esta fuera, hace falta poder notarial: desde el extranjero con apostilla son 2 a 4 semanas. Arrancarlo el dia 1.\n\
- Nota simple del Registro. Es el documento maestro: dice quien es dueno de verdad, la superficie registral y las CARGAS (hipoteca viva, embargos, servidumbres). La saca la agencia, unos 9-10 euros.\n\
- Escritura de compra. Ademas dice a que precio lo compro, que hace falta luego para el IRPF del vendedor.\n\
- Ultimo recibo del IBI: da la referencia catastral y el valor catastral.\n\
- Certificado de eficiencia energetica: es obligatorio YA EN EL ANUNCIO, la etiqueta tiene que salir en la publicidad.\n\
EN PARALELO, porque dependen de terceros y tardan:\n\
- Certificado de deuda con la comunidad (el administrador tiene 7 dias naturales por ley, suele tardar mas).\n\
- Cedula de habitabilidad, en las comunidades que la exigen. Tramitarla son 2 a 6 semanas.\n\
- ITE o IEE del edificio si por antiguedad le toca. Una ITE desfavorable puede tumbar la hipoteca del comprador.\n\
LO QUE HAY QUE MIRAR EN LA NOTA SIMPLE EL PRIMER DIA, porque si aparece tarde revienta la operacion: hipoteca pagada pero SIN CANCELAR en el registro (4 a 8 semanas arreglarlo), herencia sin aceptar o sin inscribir (1 a 3 meses), y discrepancias entre catastro y registro u obras no declaradas (1 a 3 meses)."
    },
    arras: {
      pistas: /arras|senal|reserva|oferta|contraoferta|se echa atras|penitencial|1454/i,
      texto: "ARRAS. Tres tipos y la diferencia importa de verdad:\n\
- PENITENCIALES (art. 1454 del Codigo Civil): permiten desistir. Si se echa atras el comprador pierde la senal; si se echa atras el vendedor la devuelve DOBLADA. Son las mas habituales. Tienen que decirlo expresamente en el contrato y citar el articulo, porque si no se presumen confirmatorias.\n\
- CONFIRMATORIAS: son una senal a cuenta del precio. NO permiten desistir: la otra parte puede exigir que se cumpla o reclamar danos.\n\
- PENALES: se pacta una penalizacion concreta; el contrato sigue siendo exigible.\n\
LA CLAUSULA QUE MAS PROBLEMAS EVITA: la de financiacion. Dejar por escrito que si al comprador le deniegan la hipoteca (con denegacion por escrito de un numero pactado de bancos y en un plazo pactado) se le devuelve la senal sin penalizacion.\n\
EL PLAZO: dimensionarlo por el eslabon mas lento, que casi siempre es la hipoteca del comprador. Si hay que cancelar una hipoteca del vendedor, sumar de 4 a 8 semanas.\n\
EFECTIVO: el limite legal de pago en efectivo aplica tambien a senales y arras. Que vaya por transferencia y quede rastro.\n\
ANTES DE FIRMAR ARRAS: nota simple nueva, no la de hace seis meses. Un embargo aparecido entre medias paraliza todo."
    },
    notaria: {
      pistas: /notari|escritura|firma|dia de la firma|fein|ley 5\/2019|10 dias/i,
      texto: "NOTARIA:\n\
- Fecha: se pide con 2 a 3 semanas de margen, y se cuadra la agenda de vendedor, comprador, apoderado del banco y notaria. Esa cuadratura es de lo que mas se atasca.\n\
- Los 10 DIAS de la Ley 5/2019 (cuando hay hipoteca): el plazo NO empieza cuando el banco dice que ha mandado los papeles por correo. Empieza cuando la documentacion entra por la plataforma telematica notarial. Confirmarlo con la notaria POR ESCRITO y saber que dia entro. Si no, son 10 dias perdidos.\n\
- Tiene que estar listo si o si: nota simple recien sacada (pedir otra 48 horas antes), certificado de deuda de la comunidad reciente -si tiene dos meses el notario puede rechazarlo, y si la firma se mueve hay que refrescarlo-, certificado energetico registrado en la comunidad autonoma (no vale solo el PDF del tecnico), cedula donde se exija, ultimo recibo de IBI, y la cancelacion registral de la hipoteca del vendedor resuelta o pactada en la propia firma.\n\
- El mismo dia de la firma: el notario manda el telefax al Registro, se entregan llaves y se reparten los gastos. Y ese mismo dia se pasa el expediente a gestoria, que si no se come los plazos fiscales."
    },
    impuestos: {
      pistas: /impuesto|itp|ajd|plusval|irpf|gastos de|quien paga|modelo 600|modelo 211|no residente|ganancia patrimonial/i,
      texto: "IMPUESTOS Y PLAZOS (los tipos exactos los fija cada comunidad: hay que confirmarlos en la agencia tributaria de esa comunidad, nunca decirlos de memoria):\n\
- ITP, lo paga el COMPRADOR en vivienda de segunda mano. Tipo segun comunidad. Plazo habitual 30 dias habiles. OJO: sin el modelo 600 sellado el Registro NO inscribe la escritura. El comprador puede pasarse meses creyendose propietario sin estarlo.\n\
- Obra nueva: en vez de ITP van IVA y AJD.\n\
- PLUSVALIA MUNICIPAL (IIVTNU), la paga el VENDEDOR: 30 DIAS HABILES. Es la trampa clasica: el vendedor cobra, se despreocupa o se va, y la deuda queda con afeccion real sobre el inmueble. Recordarselo el mismo dia de la firma y otra vez a los 15 dias.\n\
- IRPF del vendedor por la ganancia patrimonial: en la declaracion del ano siguiente. Por eso hace falta la escritura de cuando compro.\n\
- VENDEDOR NO RESIDENTE: el comprador esta obligado a retener el 3% e ingresarlo con el modelo 211 en 1 mes. Si no se detecta, el comprador responde de la deuda. Preguntar la residencia fiscal EN CAPTACION.\n\
- Del comprador ademas: notaria, registro y gestoria."
    },
    alquiler: {
      pistas: /alquil|arrend|lau|fianza|inquilin|renta|tensionad|irav|honorarios/i,
      texto: "ALQUILER:\n\
- LAU: prorrogas obligatorias para el arrendador y el inquilino decide. Los plazos cambian segun sea persona fisica o juridica y segun la fecha del contrato: confirmarlo con el contrato delante.\n\
- Fianza: un mes en vivienda, art. 36 LAU, y hay que DEPOSITARLA en el organismo de la comunidad autonoma. El organismo y el plazo cambian por comunidad: confirmarlo.\n\
- Actualizacion de la renta: depende de si el contrato es anterior o posterior al 26 de mayo de 2023. Los anteriores van por IPC; los posteriores por el indice de referencia (IRAV). El valor del mes concreto se mira en el INE. No decirlo de memoria.\n\
- Zona tensionada: cambia topes y condiciones. Si el municipio esta declarado se mira en el listado oficial del ministerio, que se actualiza.\n\
- Honorarios de la agencia en alquiler de vivienda: desde la ley de vivienda los paga el ARRENDADOR, no el inquilino.\n\
- Papeles: DNI, justificantes de ingresos, certificado energetico, cedula donde se exija, e inventario y fotos del estado del piso el dia de la entrega."
    },
    alarmas: {
      pistas: /plazo|caduca|se retrasa|se cae|atasc|urgente|alarma|riesgo|que falta|repasa|revisa el expediente/i,
      texto: "LA LISTA DE ALARMAS (lo que hunde una venta, por orden de frecuencia):\n\
1. Certificado energetico: caduca a los 10 anos, y NO vale si no esta registrado en la comunidad autonoma. El error mas comun es tener el PDF del tecnico y no el registro.\n\
2. Hipoteca del vendedor pagada pero sin cancelar en el registro: 4 a 8 semanas. Se detecta en la nota simple del dia 1.\n\
3. Certificado de deuda de la comunidad caducado cuando la firma se mueve: el notario puede rechazarlo.\n\
4. Nota simple vieja: no caduca por ley, pero una de hace seis meses no ve un embargo nuevo. Una antes de arras y otra 48 horas antes de notaria.\n\
5. Los 10 dias de la Ley 5/2019 mal contados.\n\
6. Plusvalia municipal: 30 dias habiles desde la firma.\n\
7. ITP: 30 dias habiles, y sin el sello no hay inscripcion.\n\
8. Cedula de habitabilidad donde se exige: 2 a 6 semanas.\n\
9. Herencia sin aceptar o sin inscribir: 1 a 3 meses.\n\
10. Poderes: desde el extranjero con apostilla, 2 a 4 semanas. Un poder caducado o corto lo rechaza el notario en el acto.\n\
11. ITE desfavorable: el banco del comprador puede negar la hipoteca o exigir derrama.\n\
12. Discrepancia catastro-registro u obra no declarada: bloquea la inscripcion, 1 a 3 meses."
    },
    documentos: {
      pistas: /hazme|preparame|redacta|escribe|un papel|el papel|documento|contrato|plantilla|hoja de|carta|texto para|mandale|mensaje para|borrador/i,
      texto: "LOS PAPELES QUE VIAJAN JUNTOS. Cuando te pidan uno, ofrece el que va detras y di para que sirve:\n\
- HOJA DE ENCARGO -> va con la HOJA DE VISITA (es la prueba de que fue la agencia quien puso en contacto a comprador y vendedor; sin ella, en un pleito por la comision la agencia va a ciegas) y con la CLAUSULA RGPD.\n\
- HOJA DE VISITA -> va con la ficha del inmueble y con el aviso de que la firmen en la puerta, antes de entrar, no despues.\n\
- ANUNCIO / DESCRIPCION -> va con el repaso de la Ley 10/2025 (quien anuncia, caracteristicas esenciales, precio final con impuestos y comisiones, zona tensionada o VPO) y con la etiqueta energetica, que es obligatoria en el anuncio.\n\
- OFERTA O RESERVA -> va con el CONTRATO DE ARRAS y con la clausula de financiacion.\n\
- ARRAS -> van con la peticion de NOTA SIMPLE NUEVA, con el certificado de deuda de la comunidad, y con la fecha tentativa de notaria.\n\
- LISTA DE PAPELES PARA EL PROPIETARIO -> va con el aviso de cual tarda mas y hay que lanzar hoy.\n\
- CARPETA PARA LA NOTARIA -> va con el repaso de vigencias (nota simple de 48 horas, certificado de comunidad reciente, energetico registrado) y con el recordatorio de plusvalia e ITP para despues de firmar.\n\
- DESPUES DE LA FIRMA -> van los recordatorios fiscales al vendedor y al comprador, y el cambio de suministros.\n\
Si te piden un texto para mandar a alguien, escribelo ya escrito, listo para copiar, corto y educado. No expliques como lo harias: hazlo."
    },
    oficina: {
      pistas: /anuncio|publicar|portal|idealista|fotocasa|blanqueo|sepblac|hoja de visita|rgpd|comision|honorarios de la agencia/i,
      texto: "LA OFICINA POR DENTRO:\n\
- ANUNCIOS: desde la Ley 10/2025 cada anuncio tiene que llevar quien lo anuncia, las caracteristicas esenciales, el PRECIO FINAL con impuestos y comisiones incluidas, y la referencia a zona tensionada o VPO si toca. Aplica a portales, redes, escaparate, web y video. Las multas van de 150 a 10.000 euros POR ANUNCIO. Si te ensenan un anuncio, repasalo contra esto.\n\
- HOJA DE VISITA: es la prueba de que fue la agencia quien puso en contacto a comprador y vendedor. Sin ella, en un pleito por la comision la agencia va a ciegas. Que se firme siempre, en la puerta.\n\
- BLANQUEO: la agencia es sujeto obligado ante el SEPBLAC. Identificar al cliente y al titular real si hay sociedades, analisis de riesgo propio, manual interno, responsable designado, formacion, y conservar 10 anos. Las sanciones habituales no son por delito: son por no tener la documentacion en regla.\n\
- RGPD: base legal en la hoja de encargo y en la hoja de visita.\n\
- Donde se atasca el comercial: entre arras y notaria, con la hipoteca del comprador, con las llamadas que entran mientras ensena un piso, con los papeles que no pidio en captacion, y cuadrando la agenda de la firma."
    }
  };

  /* ---------------- 3. elegir la ficha que toca ---------------- */

  function fichaPara(texto) {
    var t = String(texto || "");
    var elegidas = [];
    Object.keys(FICHAS).forEach(function (k) {
      if (FICHAS[k].pistas.test(t)) elegidas.push(k);
    });
    if (!elegidas.length) return null;
    /* como mucho dos, y la ultima que aparece pesa mas: se habla de lo de ahora */
    return elegidas.slice(-2).map(function (k) {
      return "[LO QUE SABES DE ESTO · no se lo leas, uselo]\n" + FICHAS[k].texto;
    });
  }

  /* lo ultimo que ha dicho la persona pesa mas que toda la conversacion */
  function loDeAhora(mensajes) {
    for (var i = mensajes.length - 1; i >= 0; i--) {
      if (mensajes[i] && mensajes[i].papel === "yo") return String(mensajes[i].texto || "");
    }
    return mensajes.map(function (m) { return m.texto || ""; }).join(" ");
  }

  /* ---------------- 3bis. la memoria de la semana ----------------
     Lo que hay encima de la mesa, escrito por la oficina. Se guarda
     en ESTE ordenador y no sale de aqui: no viaja a ningun sitio
     salvo dentro de la propia pregunta a la IA.
     Es lo que permite que al abrir por la manana ya sepa lo que hay. */

  var LLAVE = "immoia.mesa.v1";
  var enMemoria = "";        /* lo ultimo que sabemos, venga de donde venga */

  /* El codigo de la oficina viene en el enlace: inmobiliaria.html?oficina=xxxx
     Con codigo, la mesa vive en el servidor y la ve desde cualquier ordenador.
     Sin codigo, vive solo en este navegador. */
  function codigoOficina() {
    try {
      var m = /[?&]oficina=([A-Za-z0-9_-]{3,64})/.exec(location.search || "");
      if (m) { try { localStorage.setItem("immoia.oficina.v1", m[1]); } catch (e) {} return m[1]; }
      return localStorage.getItem("immoia.oficina.v1") || "";
    } catch (e) { return ""; }
  }

  function api() {
    try {
      var c = window.CONFIG;
      return c && c.api ? String(c.api).replace(/\/$/, "") : "";
    } catch (e) { return ""; }
  }

  function leerMesa() {
    if (enMemoria) return enMemoria;
    try { return localStorage.getItem(LLAVE) || ""; } catch (e) { return ""; }
  }

  function guardarMesa(t, luego) {
    t = String(t || "");
    enMemoria = t;
    try { localStorage.setItem(LLAVE, t); } catch (e) {}   /* copia local, por si falla la red */
    var of = codigoOficina(), a = api();
    if (!of || !a) { if (luego) luego(true, "en este ordenador"); return; }
    fetch(a + "/hablar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ codigo: "leire2026", memoria: "guardar", oficina: of, texto: t })
    }).then(function (r) { return r.json(); })
      .then(function (d) { if (luego) luego(!!(d && d.ok), d && d.ok ? "guardado" : (d && d.error) || "no he podido"); })
      .catch(function () { if (luego) luego(false, "sin conexion"); });
  }

  /* al abrir, traerse lo que haya en el servidor */
  function traerMesa(luego) {
    var of = codigoOficina(), a = api();
    if (!of || !a) { if (luego) luego(leerMesa(), false); return; }
    fetch(a + "/hablar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ codigo: "leire2026", memoria: "leer", oficina: of })
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && typeof d.texto === "string" && d.texto) {
          enMemoria = d.texto;
          try { localStorage.setItem(LLAVE, d.texto); } catch (e) {}
          if (luego) luego(d.texto, true);
        } else if (luego) luego(leerMesa(), false);
      })
      .catch(function () { if (luego) luego(leerMesa(), false); });
  }

  function fichaDeLaMesa() {
    var m = leerMesa().trim();
    if (!m) return null;
    if (m.length > 3000) m = m.slice(0, 3000);
    var hoy = new Date();
    var DIAS = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];
    return "[LO QUE HAY ENCIMA DE LA MESA · lo ha escrito la oficina, no se lo leas tal cual]\n" +
      "Hoy es " + DIAS[hoy.getDay()] + " " + hoy.getDate() + ". Esto es lo que esta abierto ahora mismo en esta inmobiliaria:\n" +
      m + "\n" +
      "Tenlo presente en todo lo que contestes. Si te preguntan por donde empezar o que hay hoy, " +
      "ordenalo tu: primero lo que se caduca o tiene fecha, luego lo que depende de un tercero, " +
      "y al final lo suyo. Y di lo que se les esta olvidando de esta lista.";
  }

  /* ---------------- 3ter. la ficha fiscal de la comunidad ----------------
     Para que no tenga que decir "no te puedo dar el numero" cuando el
     numero lo tenemos. Cada cifra va con su fuente y con su nivel de
     confianza; si no esta verificada, lo dice. */

  function traerFiscal() {
    if (window.IMMOIA_FISCAL || document.querySelector('script[data-fiscal]')) return;
    var s = document.createElement("script");
    s.src = "fiscal.js?v=1";
    s.setAttribute("data-fiscal", "si");
    s.onerror = function () {};
    document.head.appendChild(s);
  }
  setTimeout(traerFiscal, 1200);

  var PISTAS_FISCAL = /itp|ajd|transmisiones|actos juridicos|impuesto|modelo 600|fianza|cedula|habitabilidad|plusval|cuanto paga|que se paga|tipo aplicable/i;

  /* de donde estamos hablando: si esta saber.js lo sabe el, si no, lo basico */
  var MINI = [["cn",/canarias|tenerife|gran canaria|adeje|arona|las palmas|lanzarote|fuerteventura/i],
              ["ma",/madrid/i], ["ca",/catalu|barcelona|girona|tarragona|lleida/i],
              ["an",/andaluc|sevilla|malaga|granada|cadiz|cordoba|almeria|huelva|jaen/i],
              ["vc",/valencia|alicante|castellon/i], ["ga",/galicia|coruna|coruña|vigo|lugo|ourense|pontevedra/i],
              ["pv",/pais vasco|euskadi|bilbao|vitoria|donostia|san sebastian/i],
              ["ib",/baleares|mallorca|menorca|ibiza/i], ["cl",/castilla y leon|salamanca|valladolid|burgos|leon|zamora|segovia|soria|palencia|avila/i],
              ["cm",/castilla-la mancha|toledo|albacete|cuenca|guadalajara|ciudad real/i],
              ["ar",/aragon|zaragoza|huesca|teruel/i], ["as",/asturias|oviedo|gijon/i],
              ["mu",/murcia|cartagena/i], ["ex",/extremadura|badajoz|caceres/i],
              ["ct",/cantabria|santander/i], ["na",/navarra|pamplona/i], ["ri",/rioja|logrono|logroño/i]];

  function dondeEs(t) {
    try { if (window.IMMOIA_SABER && window.IMMOIA_SABER.donde) {
      var d = window.IMMOIA_SABER.donde(t); if (d) return d;
    } } catch (e) {}
    for (var i = 0; i < MINI.length; i++) if (MINI[i][1].test(t)) return MINI[i][0];
    return null;
  }

  function trozo(x, max) { return String(x || "").slice(0, max || 150); }

  function fichaFiscal(texto) {
    var F = window.IMMOIA_FISCAL;
    if (!F || !PISTAS_FISCAL.test(texto)) return null;
    var cc = dondeEs(texto);
    if (!cc || !F.ccaa || !F.ccaa[cc]) return null;
    var c = F.ccaa[cc], l = [];

    l.push("[LOS NUMEROS DE ESTA COMUNIDAD · esto SI lo tienes delante, usalo]");
    l.push("Comunidad: " + (c.nombre || cc) + ". Revisado el " + (F.revisado || "") + ".");

    if (c.itp) {
      l.push("ITP (segunda mano, lo paga el comprador): tipo general " + trozo(c.itp.general, 40) + ".");
      if (c.itp.reducidos && c.itp.reducidos.length) {
        l.push("Tipos reducidos: " + c.itp.reducidos.slice(0, 6).map(function (r) {
          return trozo(r.quien, 55) + " -> " + trozo(r.tipo, 45) + (r.requisitos ? " (" + trozo(r.requisitos, 90) + ")" : "");
        }).join(" | "));
      }
      if (c.itp.plazo) l.push("Plazo de presentacion: " + trozo(c.itp.plazo, 90) + ".");
      l.push("Confianza del dato: " + (c.itp.confianza || "?") + ". Fuente: " + trozo(c.itp.fuente, 120));
    }
    if (c.ajd && c.ajd.general) l.push("AJD: " + trozo(c.ajd.general, 80) + " (confianza: " + (c.ajd.confianza || "?") + ").");
    if (c.fianza) l.push("Fianza de alquiler: " + trozo(c.fianza.organismo, 110) + (c.fianza.plazo ? ", plazo " + trozo(c.fianza.plazo, 60) : "") + " (confianza: " + (c.fianza.confianza || "?") + ").");
    if (c.cedula) l.push("Cedula de habitabilidad: " + (c.cedula.obligatoria_venta ? "SI se exige para vender" : "no se exige para vender") + (c.cedula.nombre ? " (" + trozo(c.cedula.nombre, 60) + ")" : "") + " (confianza: " + (c.cedula.confianza || "?") + ").");

    l.push("COMO LO DICES: da la cifra, di que esta revisada a fecha de arriba, y di que el caso concreto se confirma en la agencia tributaria de esa comunidad. Si la confianza NO pone \"oficial\", dilo abiertamente: \"este dato lo tengo de una fuente no oficial, conviene confirmarlo\". Si el dato no esta aqui, no lo inventes: di que no lo tienes y donde se mira.");
    var t = l.join("\n");
    return t.length > 3800 ? t.slice(0, 3800) : t;
  }

  /* ---------------- 4. colarlo en cada pregunta ---------------- */

  var fetchOriginal = window.fetch.bind(window);

  window.fetch = function (url, opciones) {
    try {
      var u = typeof url === "string" ? url : (url && url.url) || "";
      if (u.indexOf("/hablar") >= 0 && opciones && typeof opciones.body === "string") {
        var cuerpo = JSON.parse(opciones.body);
        var m = cuerpo && cuerpo.mensajes;
        if (m && m.length && !(m[0] && String(m[0].texto || "").indexOf(MARCA) === 0)) {
          var delante = [{ papel: "yo", texto: ENCARGO }];
          var mesa = fichaDeLaMesa();
          if (mesa) delante.push({ papel: "yo", texto: mesa });
          var ahora = loDeAhora(m);
          var f = fichaPara(ahora);
          if (f) f.forEach(function (x) { delante.push({ papel: "yo", texto: x }); });
          var fis = fichaFiscal(ahora);
          if (fis) delante.push({ papel: "yo", texto: fis });

          /* El worker solo se queda con los 20 ultimos mensajes. Si la
             conversacion se alarga, recortaria justamente estas
             instrucciones y la secretaria dejaria de ser secretaria.
             Asi que recortamos nosotros la conversacion, no el encargo. */
          var sitio = Math.max(6, 19 - delante.length);
          var conversacion = m.length > sitio ? m.slice(-sitio) : m;
          while (conversacion.length && conversacion[0] && conversacion[0].papel !== "yo") conversacion.shift();

          cuerpo.mensajes = delante.concat(conversacion);
          opciones = Object.assign({}, opciones, { body: JSON.stringify(cuerpo) });
        }
      }
    } catch (e) { /* si algo falla, la pregunta va tal cual */ }
    return fetchOriginal(url, opciones);
  };

  /* ---------------- 5. el cuadro de la mesa ---------------- */

  function ponerCuadro() {
    var sitio = document.getElementById("inmo-mesa");
    if (!sitio || sitio.getAttribute("data-puesto")) return;
    sitio.setAttribute("data-puesto", "si");

    var caja = document.createElement("div");
    caja.className = "mesa";
    caja.innerHTML =
      '<label class="mesa-tit" for="inmo-mesa-txt">Lo que llevas esta semana</label>' +
      '<p class="mesa-sub">Escríbelo o dícta<span></span>lo como te salga: «el de Adeje firma el 24, falta el certificado de la comunidad». ' +
      'Se queda guardado en este ordenador y ella lo tiene delante cada vez que abras.</p>' +
      '<textarea id="inmo-mesa-txt" rows="5" placeholder="El de Adeje: arras firmadas, notaría el 24. Falta el certificado de la comunidad.&#10;El de José: captación nueva, no tengo la nota simple.&#10;El alquiler de la calle Real: el inquilino entra el 1."></textarea>' +
      '<div class="mesa-pie"><button type="button" id="inmo-mesa-guardar">Guardar</button>' +
      '<span id="inmo-mesa-aviso"></span></div>';
    sitio.appendChild(caja);

    var txt = document.getElementById("inmo-mesa-txt");
    var aviso = document.getElementById("inmo-mesa-aviso");
    txt.value = leerMesa();

    function avisar(t) {
      aviso.textContent = t;
      setTimeout(function () { if (aviso.textContent === t) aviso.textContent = ""; }, 3200);
    }

    /* si hay codigo de oficina, la mesa viene del servidor: la misma desde cualquier ordenador */
    if (codigoOficina()) {
      avisar("Buscando lo tuyo…");
      traerMesa(function (t, delServidor) {
        if (document.activeElement !== txt) txt.value = t;
        avisar(delServidor ? "Al dia. Esto lo ves desde cualquier ordenador." : "");
      });
    }

    document.getElementById("inmo-mesa-guardar").addEventListener("click", function () {
      if (!txt.value.trim()) { guardarMesa(""); avisar("Vaciado."); return; }
      avisar("Guardando…");
      guardarMesa(txt.value, function (bien, porque) {
        avisar(bien ? "Guardado. Ya lo tiene delante." : "Guardado solo en este ordenador (" + porque + ").");
      });
    });
    /* y tambien al salir del cuadro, para que no se pierda nada */
    txt.addEventListener("blur", function () { if (txt.value !== leerMesa()) guardarMesa(txt.value); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ponerCuadro);
  else ponerCuadro();

  window.IMMOIA_INMO = {
    version: "1.2",
    encargo: function () { return ENCARGO; },
    ficha: fichaPara,
    mesa: leerMesa,
    fiscal: fichaFiscal,
    donde: dondeEs,
    ponerMesa: guardarMesa,
    fichaMesa: fichaDeLaMesa,
    temas: Object.keys(FICHAS),
    medidas: (function () {
      var o = { encargo: ENCARGO.length };
      Object.keys(FICHAS).forEach(function (k) { o[k] = FICHAS[k].texto.length; });
      return o;
    })()
  };
})();
