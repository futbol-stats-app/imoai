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

  var MARCA = "[CONTEXTO: MODO PROFESIONAL - INMOBILIARIA";

  /* ---------------- 1. el encargo ---------------- */

  var ENCARGO = MARCA + "]\n\
Esta conversacion es con una profesional de una inmobiliaria, no con un cliente. Las reglas de este modo NO se escriben aqui: las pone el cerebro central. Esta pagina solo dice en que contexto estas y te pone delante las fichas del oficio y el expediente.";

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

  function CODIGO_WEB() {
    try { return (window.CONFIG && window.CONFIG.codigo) || "leire2026"; } catch (e) { return "leire2026"; }
  }

  /* LA CUENTA DE LA OFICINA. El nombre suelto ya no vale para nada:
     con el nombre de otra agencia se veian sus cosas. Ahora se manda
     la llave de paso que guarda oficina.js, y si no hay cuenta abierta
     la mesa se queda en este ordenador y se dice.

     Se sigue aceptando la forma vieja -usuario y clave- porque puede
     haber navegadores que todavia no han cambiado la clave por una
     llave. En cuanto oficina.js hace el cambio, esto manda la llave
     sin enterarse de nada. */
  function cuentaAbierta() {
    try {
      var c = JSON.parse(localStorage.getItem("immoia.oficina.cuenta.v1") || "null");
      return (c && c.usuario && (c.sesion || c.clave)) ? c : null;
    } catch (e) { return null; }
  }
  /* La llave VA EN LUGAR de la clave, nunca las dos: el servidor
     rechaza la peticion que trae las dos y hace bien, porque no se
     sabria cual manda. */
  function cuerpoCon(c, extra) {
    var b = { codigo: CODIGO_WEB() };
    if (c.sesion) b.sesion = c.sesion;
    else { b.usuario = c.usuario; b.clave = c.clave; }
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) b[k] = extra[k];
    return b;
  }
  /* SI LA LLAVE YA NO VALE, SE DICE. Quien lo arregla es oficina.js,
     que es quien tiene el cuadro de entrar; aqui solo se le avisa. Sin
     esto, la mesa se quedaria guardandose en este ordenador sin que
     nadie explique por que dejo de subir. */
  function siCaduco(estado, d) {
    if (estado !== 401 || !d || d.entrada !== "no") return false;
    try {
      if (window.IMMOIA_OFICINA && typeof window.IMMOIA_OFICINA.caduco === "function") window.IMMOIA_OFICINA.caduco();
    } catch (e) {}
    return true;
  }

  /* DE QUE CUENTA ES ESTA MESA. Al salir de una cuenta y entrar con
     otra en el mismo ordenador, la mesa de la primera se quedaba aqui:
     se veia en pantalla y, al escribir encima, se subia a la cuenta de
     la segunda. Eso es una fuga entre dos clientas. Ahora la mesa lleva
     escrito de quien es, y si la cuenta abierta es otra, aqui no hay
     nada. Vale tambien al recargar, no solo al cambiar en caliente. */
  var DUENO = LLAVE + ".de";

  /* Se marca con el IDENTIFICADOR INTERNO de la cuenta, no con su
     nombre: el nombre lo sabe cualquiera, el identificador no sale de
     ningun dato de la oficina. Mientras queden cuentas sin pasar al
     modelo nuevo, una mesa marcada con el nombre se sigue reconociendo
     como suya, y al guardarla queda marcada con el identificador. */
  function cuentaAhoraDatos() {
    try {
      var c = JSON.parse(localStorage.getItem("immoia.oficina.cuenta.v1") || "null");
      if (!c) return null;
      return { id: c.id ? String(c.id) : null, usuario: c.usuario ? String(c.usuario) : null };
    } catch (e) { return null; }
  }
  function cuentaDeAhora() {
    var c = cuentaAhoraDatos();
    if (!c) return "";
    return c.id || c.usuario || "";
  }

  function esDeOtra() {
    try {
      var marca = String(localStorage.getItem(DUENO) || "");
      var c = cuentaAhoraDatos();
      if (!c) return marca !== "";
      if (c.id && marca === c.id) return false;
      if (c.usuario && marca === c.usuario) return false;
      return true;
    } catch (e) { return false; }
  }

  function olvidarSiEsDeOtra() {
    try {
      if (!esDeOtra()) return;
      localStorage.removeItem(LLAVE);
      localStorage.setItem(DUENO, cuentaDeAhora());
      enMemoria = "";
    } catch (e) { }
  }
  try {
    if (window.IMMOIA_NUCLEO && typeof window.IMMOIA_NUCLEO.cuando === "function") {
      window.IMMOIA_NUCLEO.cuando("oficina:cambio", function () { olvidarSiEsDeOtra(); });
    }
  } catch (e) { }

  function leerMesa() {
    if (esDeOtra()) {
      enMemoria = "";
      try { localStorage.removeItem(LLAVE); localStorage.setItem(DUENO, cuentaDeAhora()); } catch (e) {}
      return "";
    }
    if (enMemoria) return enMemoria;
    try { return localStorage.getItem(LLAVE) || ""; } catch (e) { return ""; }
  }

  function guardarMesa(t, luego) {
    t = String(t || "");
    enMemoria = t;
    /* la copia local queda marcada con la cuenta de la que es */
    try { localStorage.setItem(LLAVE, t); localStorage.setItem(DUENO, cuentaDeAhora()); } catch (e) {}
    var c = cuentaAbierta(), a = api();
    if (!c || !a) { if (luego) luego(true, "en este ordenador"); return; }
    var estado = 0;
    fetch(a + "/hablar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpoCon(c, { memoria: "guardar", texto: t }))
    }).then(function (r) { estado = r.status; return r.json(); })
      .then(function (d) {
        if (siCaduco(estado, d)) { if (luego) luego(false, "solo aquí: hay que volver a entrar"); return; }
        if (luego) luego(!!(d && d.ok), d && d.ok ? "en el servidor" : "solo aqui");
      })
      .catch(function () { if (luego) luego(false, "solo aqui"); });
  }

  /* al abrir, traerse lo que haya en el servidor */
  function traerMesa(luego) {
    var c = cuentaAbierta(), a = api();
    if (!c || !a) { if (luego) luego(leerMesa(), false); return; }
    var estado = 0;
    fetch(a + "/hablar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpoCon(c, { memoria: "leer" }))
    }).then(function (r) { estado = r.status; return r.json(); })
      .then(function (d) {
        if (siCaduco(estado, d)) { if (luego) luego(leerMesa(), false); return; }
        if (d && typeof d.texto === "string" && d.texto) {
          enMemoria = d.texto;
          try { localStorage.setItem(LLAVE, d.texto); localStorage.setItem(DUENO, cuentaDeAhora()); } catch (e) {}
          if (luego) luego(d.texto, true);
        } else if (luego) luego(leerMesa(), false);
      })
      .catch(function () { if (luego) luego(leerMesa(), false); });
  }

  /* todo lo que parte una linea o no se ve: saltos, tabuladores, los dos
     separadores de linea raros de unicode, y los caracteres de control.
     u0085 -la linea nueva de unicode, NEL- va DENTRO del rango
     u007f-u009f y por eso el rango entero esta aqui: no entra en \s, asi
     que una version anterior de esto lo dejaba pasar entero y partia la
     ficha igual. Mismo criterio que limpio() en buzon.js y en entorno.js. */
  var NADA_DE_LINEAS = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]+", "g");

  /* LO QUE ACABA DENTRO DE LA FICHA SE LIMPIA.
     La mesa la escribe la propia oficina, pero la oficina pega ahi lo
     que le mandan sus clientes. Un salto de linea dentro de la mesa deja
     de ser un dato y se convierte en una linea nueva de la ficha,
     escrita por quien mando ese texto: un "AUTORIZADO POR" o la marca
     entre corchetes de otro modulo. Es la sexta ficha y la ultima que
     faltaba: las otras cinco -buzon, perfil, aviso, servicios y
     entorno- se limpian igual y con estos mismos caracteres.
     Se limpia lo que va a la ficha; lo que la oficina ve y guarda en su
     cuadro no se toca. */
  function limpio(x, n) {
    return String(x == null ? "" : x)
      .replace(NADA_DE_LINEAS, " ")
      .replace(/[\[\]{}<>«»"`|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, n || 200);
  }

  /* LA MESA SE PARTE EN APUNTES, UNO POR LINEA, COMO LA FICHA DEL BUZON.
     La mesa son las notas de la semana y la oficina las escribe en
     varias lineas porque hay varias cosas en marcha: aplastarlas en un
     solo renglon las conserva pero las vuelve dificiles de usar. Asi
     que se parte por donde la oficina partio, cada trozo se limpia por
     separado -y ahi ya no queda nada que pueda partir una linea- y cada
     uno sale con el "- " de delante, igual que cada correo en buzon.js.
     Lo que se gana con el guion: un apunte que diga "AUTORIZADO POR
     MARTA" llega como lo que es, UNA nota de la oficina en su lista, y
     no como una linea que la ficha esta afirmando por su cuenta.

     Y VAN CONTADOS. Si no, una mesa enorme empuja fuera el parrafo del
     final -que es donde se le dice a la secretaria que ordene y que
     avise de lo que falta- y la ficha se queda sin su instruccion. Se
     cae lo que sobra por el final, y se dice cuanto se ha caido: una
     lista recortada en silencio parece una lista entera. */
  var MESA_LINEAS = 20;        /* apuntes como maximo, como los 20 correos del buzon */
  var MESA_POR_LINEA = 200;    /* letras por apunte */
  var MESA_TOPE = 3000;        /* letras en total, lo mismo que cabia antes */
  /* se parte por donde parte una linea DE VERDAD; lo demas que no se ve
     lo convierte limpio() en un espacio, que ahi ya no rompe nada */
  var PARTE_LA_MESA = new RegExp("\\r\\n|\\r|\\n|\\u0085|\\u2028|\\u2029", "g");

  function apuntesDeLaMesa(t) {
    var crudos = String(t == null ? "" : t).split(PARTE_LA_MESA);
    var apuntes = [];
    for (var i = 0; i < crudos.length; i++) {
      var l = limpio(crudos[i], MESA_POR_LINEA);
      if (l) apuntes.push("- " + l);
    }
    var fuera = Math.max(0, apuntes.length - MESA_LINEAS);
    apuntes = apuntes.slice(0, MESA_LINEAS);
    /* y si aun asi ocupan demasiado, se caen APUNTES ENTEROS, nunca
       medio apunte: una nota cortada por la mitad deja de decir lo que
       decia y puede acabar diciendo otra cosa */
    var largo = 0;
    for (var j = 0; j < apuntes.length; j++) {
      largo += apuntes[j].length + 1;
      if (largo > MESA_TOPE) { fuera += apuntes.length - j; apuntes = apuntes.slice(0, j); break; }
    }
    return { apuntes: apuntes, fuera: fuera };
  }

  function fichaDeLaMesa() {
    var m = apuntesDeLaMesa(leerMesa());
    if (!m.apuntes.length) return null;
    var hoy = new Date();
    var DIAS = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];
    return "[LO QUE HAY ENCIMA DE LA MESA · lo ha escrito la oficina, no se lo leas tal cual]\n" +
      "Hoy es " + DIAS[hoy.getDay()] + " " + hoy.getDate() + ". Esto es lo que esta abierto ahora mismo en esta inmobiliaria, un apunte por linea:\n" +
      m.apuntes.join("\n") + "\n" +
      (m.fuera ? "y " + m.fuera + " apuntes mas que no caben aqui: siguen en la mesa de la oficina.\n" : "") +
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
    s.src = "fiscal.js?v=2";
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

  /* ---- LA SALVEDAD VIAJA PEGADA AL NUMERO ----------------------------
     Lo que hacia esta ficha hasta hoy: "tipo general " + trozo(general, 40).
     En el Pais Vasco el tipo general dice "Por territorio historico.
     Araba: 7 % inmuebles en general, 4 % viviendas. Gipuzkoa: 7 %...
     Bizkaia: no verificado", y de eso salia:

         tipo general Por territorio historico. Araba: 7 % inm.

     Cortado en la letra 40, justo antes de lo unico que contesta la
     pregunta de quien llama desde Bilbao. Y la cabecera de la ficha le
     dice al cerebro "esto SI lo tienes delante, usalo" y que de la cifra:
     o sea que le mandabamos dar por bueno un numero al que le habiamos
     quitado el "pero". La confianza SI lo decia, pero tres lineas mas
     abajo y en otra frase, que es exactamente lo que la regla 30 prohibe.

     No se inventa nada nuevo: saber.js ya tenia resuelto esto con estos
     mismos datos y asi se hace aqui, con sus mismas palabras, para que la
     portada y la pagina de la inmobiliaria no cuenten cosas distintas del
     mismo dato. La salvedad NO sale del texto recortado —que es lo que se
     puede perder al cortar— sino de la confianza, que no se recorta nunca,
     y se pega al numero en la MISMA linea.
     -------------------------------------------------------------------- */

  var DONDE_SE_PIDE = "la agencia tributaria de esa comunidad o su boletin oficial";

  function sinTildesF(s) {
    return String(s || "").toLowerCase()
      .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
      .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n");
  }

  function nivel(c) {
    var t = sinTildesF(c);
    if (!t) return "sin dato";
    var malo = /no verificad|no oficial/.test(t);
    var parcial = /parcial/.test(t);
    if (malo) return /^oficial/.test(t) ? "a medias" : "sin verificar";
    if (parcial) return "a medias";
    if (/oficial/.test(t)) return "oficial";
    return "sin dato";
  }

  function deDonde(fuente) {
    var f = String(fuente || "");
    var m = /https?:\/\/([^\/\s;,)]+)/.exec(f);
    if (m) return m[1].replace(/^www\./, "");
    return f ? f.slice(0, 45) : "";
  }

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

  /* "no verificado" a secas no es una cifra recortable: es que no hay cifra. */
  function sinNumero(v) { return /^no verificad/i.test(String(v || "").trim()); }

  /* Cortar un valor nunca puede llevarse su salvedad. Si lo que se queda
     fuera dice "no verificado" y lo que se queda dentro no lo dice, sale un
     numero limpio y mentiroso. En ese caso el corte lo confiesa aqui mismo,
     pegado al numero, que es donde tiene que estar. */
  var SALVEDAD = /no verificad|no oficial|sin verificar|no consta|pendiente/i;

  function corto(x, max) {
    var s = String(x == null ? "" : x);
    max = max || 150;
    if (s.length <= max) return s;
    var dentro = s.slice(0, max), fuera = s.slice(max);
    if (!SALVEDAD.test(fuera) || SALVEDAD.test(dentro)) return dentro + "...";
    return dentro + "... <<AVISO PEGADO A ESTE NUMERO: lo que no cabe aqui es una SALVEDAD de este mismo dato. No lo des por bueno entero: di en la MISMA frase que una parte esta pendiente de confirmar.>>";
  }

  function fichaFiscal(texto) {
    var F = window.IMMOIA_FISCAL;
    if (!F || !PISTAS_FISCAL.test(texto)) return null;
    var cc = dondeEs(texto);
    if (!cc || !F.ccaa || !F.ccaa[cc]) return null;
    var c = F.ccaa[cc], l = [];

    l.push("[LOS NUMEROS DE ESTA COMUNIDAD · esto SI lo tienes delante, usalo]");
    l.push("Comunidad: " + (c.nombre || cc) + ". Revisado el " + (F.revisado || "") + ".");

    if (c.itp) {
      if (sinNumero(c.itp.general)) {
        l.push("ITP (segunda mano, lo paga el comprador): estado PENDIENTE DE VERIFICACION. NO lo tenemos verificado todavia, y eso NO quiere decir que no se pueda saber: se pide a " + DONDE_SE_PIDE + ". Dilo asi, como pendiente, y di donde se consigue. No des ninguna cifra.");
      } else {
        l.push("ITP (segunda mano, lo paga el comprador): tipo general " + corto(c.itp.general, 170) + "." + pegar(c.itp.confianza, c.itp.fuente));
      }
      if (c.itp.contradiccion_fuentes) {
        l.push("OJO, dos fuentes no dicen lo mismo: " + corto(c.itp.contradiccion_fuentes, 220) + " <<AVISO PEGADO: si te preguntan por este tipo, di que hay dos versiones y que hay que confirmarlo.>>");
      }
      if (c.itp.reducidos && c.itp.reducidos.length) {
        l.push("Tipos reducidos: " + c.itp.reducidos.slice(0, 6).map(function (r) {
          return corto(r.quien, 55) + " -> " + corto(r.tipo, 45) + (r.requisitos ? " (" + corto(r.requisitos, 90) + ")" : "");
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
      l.push("Fianza de alquiler: se deposita en " + corto(c.fianza.organismo, 110) +
        (c.fianza.plazo && !sinNumero(c.fianza.plazo) ? ", plazo " + corto(c.fianza.plazo, 60) : ", plazo PENDIENTE DE VERIFICACION: no lo des, dilo como pendiente y di que se pregunta en ese organismo") +
        "." + pegar(c.fianza.confianza, c.fianza.fuente));
    }
    if (c.cedula) {
      l.push("Cedula de habitabilidad: " + (c.cedula.obligatoria_venta ? "SI se exige para vender" : "no se exige para vender") +
        (c.cedula.nombre ? " (" + corto(c.cedula.nombre, 70) + ")" : "") + "." + pegar(c.cedula.confianza, c.cedula.fuente));
    }

    l.push("COMO LO DICES: da la cifra, di que esta revisada a fecha de arriba, y di que el caso concreto se confirma en la agencia tributaria de esa comunidad. Lo que lleve AVISO PEGADO se dice CON el aviso en la MISMA frase, no en otra. Si el dato no esta aqui, no lo inventes y tampoco lo des por imposible: es PENDIENTE DE VERIFICACION, di que falta, donde se consigue y a quien se le pide.");
    return cabe(l);
  }

  /* El recorte de la ficha entera, con el mismo cuidado que el de cada
     numero: si no cabe, se van lineas ENTERAS por el medio —nunca media
     linea, que dejaria un numero sin su aviso— y la ultima, la que dice
     como se cuenta todo esto, se queda siempre. */
  function cabe(l) {
    var TOPE = 3800;
    var ultima = l[l.length - 1];
    var t = l.join("\n");
    while (t.length > TOPE && l.length > 3) {
      l.splice(l.length - 2, 1);
      t = l.join("\n");
    }
    if (t.length > TOPE) return l[0] + "\n" + l[1] + "\n" + ultima;
    return t;
  }

  /* ---------------- 4. colarlo en cada pregunta ---------------- */

  var fetchOriginal = window.fetch.bind(window);

  window.fetch = function (url, opciones) {
    try {
      var u = typeof url === "string" ? url : (url && url.url) || "";
      if (u.indexOf("/hablar") >= 0 && opciones && typeof opciones.body === "string") {
        var cuerpo = JSON.parse(opciones.body);
        var m = cuerpo && cuerpo.mensajes;

        /* DE QUIEN ES ESTA CONVERSACION.
           El chat no llevaba NADA que dijera de que oficina viene, y
           eso no era un detalle: el tope de gasto del servidor cobra
           al cubo de los anonimos todo lo que no sabe de quien es. Una
           oficina que paga se habria quedado cortada a los pocos
           mensajes del dia, compartiendo cubo con cualquiera que entre
           en la web, y sin que nadie pudiera explicar por que.
           Va la LLAVE DE PASO, nunca la clave: una clave no tiene por
           que viajar en cada mensaje. Si no hay llave -nadie ha
           entrado, o es la pagina de particulares- no se manda nada y
           la conversacion es anonima, que es lo correcto.
           Se pone FUERA del "if" de abajo a proposito: ese solo entra
           cuando hay que colar el encargo, y el gasto hay que
           atribuirlo en todas. */
        if (m && m.length && !cuerpo.sesion && !cuerpo.usuario) {
          var cAhora = cuentaAbierta();
          if (cAhora && cAhora.sesion) cuerpo.sesion = cAhora.sesion;
          else {
            try {
              var s = window.IMMOIA_OFICINA && window.IMMOIA_OFICINA.sesion && window.IMMOIA_OFICINA.sesion();
              if (s) cuerpo.sesion = s;
            } catch (e) {}
          }
          if (cuerpo.sesion) opciones = Object.assign({}, opciones, { body: JSON.stringify(cuerpo) });
        }

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
      guardarMesa(txt.value, function (bien) {
        avisar(bien ? "Guardado. Lo ves desde cualquier ordenador."
                    : "Guardado. Ya lo tiene delante.");
      });
    });
    /* y tambien al salir del cuadro, para que no se pierda nada */
    txt.addEventListener("blur", function () { if (txt.value !== leerMesa()) guardarMesa(txt.value); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ponerCuadro);
  else ponerCuadro();

  window.IMMOIA_INMO = {
    version: "1.3",
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
