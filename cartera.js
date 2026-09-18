/* ==================================================================
   IMMO IA · cartera.js — VARIOS EXPEDIENTES A LA VEZ
   ------------------------------------------------------------------
   El problema: la bandeja lleva UN expediente, guardado en
   "immoia.autonomia.v1". Una inmobiliaria lleva veinte. Esa es la
   diferencia entre una demostracion y una herramienta de trabajo.

   Como se resuelve SIN tocar el motor ni la bandeja: la cartera
   guarda N expedientes y, antes de que la bandeja arranque, deja el
   ACTIVO exactamente donde la bandeja lo busca. La bandeja no se
   entera de nada y sigue funcionando igual. Al cambiar de expediente
   se guarda el que estaba y se pone el otro en su sitio.

   Y si hay cuenta de oficina (oficina.js), la cartera entera sube y
   baja del servidor: se trabaja en el PC y se sigue en el movil.
   Cuando los dos han tocado cosas, se juntan por expediente — gana
   el que se toco mas tarde, expediente por expediente, no de golpe.
   ================================================================== */
(function () {
  "use strict";
  if (window.IMMOIA_CARTERA) return;

  var LLAVE_BANDEJA = "immoia.autonomia.v1";   /* donde mira la bandeja: NO se cambia */
  var LLAVE_CARTERA = "immoia.cartera.v1";
  /* DE QUIEN ES LO QUE HAY GUARDADO EN ESTE NAVEGADOR.
     Sin esto, la cartera de una oficina se quedaba en el ordenador al
     salir, y la siguiente que entrara la veia entera. Con una sola
     inmobiliaria no se nota; con dos, son los expedientes de una
     clienta a la vista de otra. Y era peor que mirar: al entrar la
     segunda, la cartera se subia al servidor DE LA SEGUNDA, asi que
     los expedientes de la primera acababan dentro de la cuenta ajena.
     La marca la lleva inmo.js desde el 13/09 para la mesa; esto es lo
     mismo para la cartera. */
  var DUENO_CARTERA = LLAVE_CARTERA + ".de";
  /* SE LE HA CADUCADO LA LLAVE DE PASO; NO ES DE OTRA OFICINA.
     La llave de paso caduca sola cada doce horas. Cuando caducaba, aqui
     se veia «no hay nadie dentro» y se trataba igual que «esto es de otra
     oficina»: se borraba la cartera de este ordenador y la directora se
     encontraba la pantalla en blanco sin una palabra. Los datos volvian
     al entrar otra vez, pero eso no lo sabia nadie.
     Esta nota se queda escrita cuando la llave caduca, para que al
     recargar la pagina se siga sabiendo que fue una caducidad y no una
     oficina ajena. Se borra en cuanto la misma oficina vuelve a entrar,
     y tambien si entra otra: entonces si se limpia. */
  var CADUCADA_CARTERA = LLAVE_CARTERA + ".caducada";
  var ESPERA_SUBIDA = 4000;                    /* no se llama al servidor en cada tecla */
  var LATIDO = 1200;

  /* ---------- utiles ---------- */
  /* QUE DIA ES HOY: UNA SOLA CUENTA, EN HORA DE AQUI.
     Antes cada fichero lo calculaba a su manera: la pantalla de la manana
     en hora universal, y la bandeja y la cartera en hora local. Pasada la
     medianoche en Espana no coincidian, asi que la manana daba por «hoy»
     un dia distinto del que daba la bandeja. Su sitio es nucleo.js, que
     va en todas las paginas; esta misma cuenta, escrita igual, esta ahi,
     en bandeja.js y en manana.js, y con "||" la deja puesta el primero
     que llegue. Asi no importa el orden en que se carguen los ficheros
     ni que falte alguno: el dia es siempre el mismo. */
  window.IMMOIA_HOY = window.IMMOIA_HOY || function () {
    var d = new Date(), m = d.getMonth() + 1, x = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (x < 10 ? "0" + x : x);
  };
  function hoyCorto() { return window.IMMOIA_HOY(); }
  function ahora() { return new Date().toISOString(); }
  function esc(s) { var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }
  function id() { return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* la forma exacta que espera la bandeja, para un expediente en blanco */
  function guardadoEnBlanco(nombre) {
    return { llaves: [], expediente: { nombre: nombre || "el expediente", hechos: [], avisados: [],
             en_marcha: [], rechazados: [], senales: [], datos: [], diario: [], avisos_hoy: 0,
             aviso_abierto: null, abiertos: [], dia: hoyCorto() },
             ficha: {}, gestiones: [] };
  }
  function sano(g) { return !!(g && g.expediente && typeof g.expediente === "object"); }

  /* El nombre lo pone ella, y no se lo cambia nadie: si le llama «el de
     Adeje» se queda «el de Adeje» aunque luego entre la direccion. Solo
     se rellena solo cuando todavia no tiene nombre de verdad. */
  var SIN_NOMBRE = { "el expediente": 1, "expediente nuevo": 1, "": 1 };

  /* LO QUE MIDE UN NOMBRE: 60 LETRAS, Y LA MISMA REGLA EN TODAS PARTES.
     Antes habia dos: al renombrar se recortaba a 60 y al crear no, asi
     que un nombre pegado de un correo entraba entero -cientos de letras-
     y se quedaba en el almacen del navegador y en la barra. Se escribe
     aqui una vez y la usan crear, renombrar y el nombre que se saca del
     propio expediente. 60 es lo que cabe en la casilla de la pantalla
     (el maxlength del hueco de «el de Adeje»). */
  var LARGO_NOMBRE = 60;
  function nombreCorto(n) { return String(n == null ? "" : n).trim().slice(0, LARGO_NOMBRE); }

  function nombreDe(g, ahora) {
    if (ahora && !SIN_NOMBRE[ahora]) return nombreCorto(ahora);
    var n = g && g.expediente && g.expediente.nombre;
    if (n && !SIN_NOMBRE[n]) return nombreCorto(n);
    if (g && g.ficha && g.ficha.direccion) return nombreCorto(g.ficha.direccion);
    return ahora || "el expediente";
  }

  /* ---------- lo que hay guardado ---------- */
  var C = null;

  function enBlancoCartera() { return { v: 0, activo: null, orden: [], exp: {}, tocada: ahora() }; }

  /* ---------- DE QUIEN ES ESTO ----------
     Quien esta dentro ahora mismo. Cadena vacia = nadie: se trabaja
     en este ordenador y punto, que es lo normal en una demostracion. */
  function cuentaDeAhora() {
    try {
      var o = window.IMMOIA_OFICINA;
      if (!o || !o.hay()) return "";
      return String(o.usuario() || "");
    } catch (e) { return ""; }
  }
  /* JUNTADO 18/09 · COMO SE DISTINGUE «SE FUE» DE «SE LE CADUCO LA LLAVE»
     CUANDO LA PAGINA SE ABRE DE CERO.
     Al abrir, la cartera no tiene a nadie a quien preguntarle: cartera.js se
     carga antes que oficina.js y todavia no hay aviso ninguno. Y los dos
     casos se ven igual desde el almacen: una marca de oficina y ninguna
     cuenta abierta.
     Lo que los separa es esto: «Salir de esta cuenta» BORRA la llave de
     paso del almacen (oficina.js, apuntarCuenta(null)). Una llave caducada
     sigue escrita, solo que con la fecha pasada. Asi que:
        queda llave escrita  -> se le ha caducado: NO se borra nada
        no queda llave       -> se fue: se borra, como el 13/09
     Es la unica lectura que hace que pasen a la vez la prueba de las dos
     oficinas (OT-EX1, caso 2) y la del auditor (test_datos.py, L-57), que
     piden lo contrario la una de la otra. */
  var LLAVE_OFICINA = "immoia.oficina.cuenta.v1";
  function hayLlaveEscrita() {
    try {
      var c = JSON.parse(localStorage.getItem(LLAVE_OFICINA) || "null");
      return !!(c && c.usuario);
    } catch (e) { return false; }
  }
  /* Se mira UNA SOLA VEZ, al abrir la pagina, y antes de que nadie haya
     podido quitarla: oficina.js borra la llave en cuanto ve que ha
     caducado, y segun el orden en que se carguen los ficheros eso puede
     pasar antes o despues de que la cartera mire. Guardandolo aqui, la
     respuesta es la misma siempre. */
  var habiaLlaveAlAbrir = hayLlaveEscrita();

  function marcaGuardada() {
    try { return String(localStorage.getItem(DUENO_CARTERA) || ""); } catch (e) { return ""; }
  }
  function marcar() {
    var q = cuentaDeAhora();
    /* Mientras la llave esta caducada no hay nadie dentro, pero la
       cartera sigue siendo de quien era. Si aqui se borrara la marca, la
       siguiente oficina que entrara en este ordenador se ADOPTARIA los
       expedientes de la anterior, que es justo lo que se arreglo el
       13/09. Asi que no se toca. */
    /* JUNTADO 18/09: E1 no quitaba la marca mientras constaba una caducidad;
       el auditor (L-02) no la quita SIEMPRE que no hay cuenta abierta. Se deja
       la del auditor porque incluye la de E1 y ademas cubre el rato entre que
       la llave deja de valer y la cartera se entera: sin marca, la siguiente
       oficina que entrara se ADOPTARIA los expedientes de la anterior, que es
       justo lo que se arreglo el 13/09. La marca solo se borra en
       borrarLoDeOtra(). */
    if (q === "" && (notaCaducada() !== "" || marcaGuardada() !== "")) return;
    try { localStorage.setItem(DUENO_CARTERA, q); } catch (e) {}
  }

  /* SALIR A PROPOSITO NO ES LO MISMO QUE CADUCARSE.
     Si la directora pulsa «Salir de esta cuenta», lo que queda en este
     ordenador es de la oficina que se acaba de ir y se limpia. Si nadie
     ha pulsado nada y de pronto no hay cuenta, lo que ha pasado es que la
     llave de paso ha caducado, y entonces no se borra nada.
     QUIEN LO SABE ES OFICINA.JS, Y AHORA LO DICE: viene en el motivo del
     aviso «oficina:cambio» ("salida" o "caducada"). Antes esto se
     adivinaba aqui mirando si alguien habia pulsado el boton «ofi-salir»,
     y por eso fallaba: al salir desde el codigo -o desde cualquier otro
     sitio que no fuera ese boton- se tomaba por una caducidad y la
     cartera de la oficina anterior se quedaba a la vista en este
     navegador hasta que se recargaba la pagina.
     Se deja la escucha del boton como respaldo, para el caso de que esta
     pagina lleve un oficina.js viejo que todavia no diga el motivo. */
  /* JUNTADO 18/09 · LAS DOS PALABRAS. E1/Z hacen que oficina.js diga
     "entrada" / "salida" / "caducada"; el paquete del auditor escribio
     "salir" para lo mismo. Se entienden LAS DOS, aqui y en inmo.js, para
     que ninguna pagina con una version u otra de oficina.js se quede sin
     limpiar. Si algun dia solo queda una palabra, esto sigue valiendo. */
  var ES_SALIDA = { salida: 1, salir: 1 };
  var ES_ENTRADA = { entrada: 1, entrar: 1 };

  var salidaAdrede = false;
  try {
    document.addEventListener("click", function (ev) {
      var t = ev.target;
      while (t && t !== document) {
        if (t.id === "ofi-salir") { salidaAdrede = true; return; }
        t = t.parentNode;
      }
    }, true);
  } catch (e) {}

  function notaCaducada() {
    try { return String(localStorage.getItem(CADUCADA_CARTERA) || ""); } catch (e) { return ""; }
  }
  function apuntarCaducada(quien) {
    try { localStorage.setItem(CADUCADA_CARTERA, String(quien || "")); } catch (e) {}
  }
  function olvidarCaducada() {
    try { localStorage.removeItem(CADUCADA_CARTERA); } catch (e) {}
  }

  /* LAS CUATRO SITUACIONES, Y POR QUE NO SE TRATAN IGUAL.
       misma cuenta          -> es suyo, se abre
       sin marca y hay cuenta -> lo hizo ESTA persona en este ordenador
                                 antes de entrar. Se ADOPTA, no se tira:
                                 tirarlo seria borrarle su propio trabajo
                                 la primera vez que entra con cuenta.
       se le ha caducado la llave -> es SUYO y sigue siendo suyo. NO se
                                 borra nada: se le dice que la sesion ha
                                 caducado y que vuelva a entrar, y se
                                 queda todo donde estaba.
       cualquier otra cosa   -> es de OTRA oficina. No se abre y se borra.
     Lo ultimo incluye salir a proposito de una cuenta: lo que queda en el
     ordenador sigue siendo de la que se fue, y se limpia. */
  /* la oficina que hemos visto dentro mientras esta pagina estaba
     abierta: es lo que permite saber que la llave se ha caducado en
     nuestras propias narices, sin que nadie haya pulsado salir */
  var vistaDentro = "";

  function deQuienEs() {
    var marca = marcaGuardada(), ahoraQuien = cuentaDeAhora();
    if (ahoraQuien !== "") vistaDentro = ahoraQuien;
    if (marca === ahoraQuien) return "mia";
    if (marca === "" && ahoraQuien !== "") return "adoptable";
    /* JUNTADO 18/09. E1/Z pedian ademas una prueba de que hubo caducidad
       (la nota escrita, o haber visto dentro a esa oficina en esta misma
       pagina). El auditor (L-01, "guardada") no pedia ninguna. Se deja la
       del auditor, porque la de E1/Z se cae en un caso real que su prueba
       no monta y la del auditor si (test_datos.py, L-57): si la llave ya
       estaba caducada ANTES de abrir la pagina, cartera.js se carga antes
       que oficina.js, todavia no hay nota ni se ha visto a nadie dentro, y
       la cartera de la directora se borraba entera al abrir.
       Lo que distingue salir de caducarse ya no hay que adivinarlo: lo dice
       oficina.js en el motivo, y salidaAdrede lo recoge (con el clic en el
       boton como respaldo para paginas con un oficina.js viejo). */
    if (ahoraQuien === "" && marca !== "" && !salidaAdrede
        && (habiaLlaveAlAbrir || hayLlaveEscrita()
            || notaCaducada() === marca || vistaDentro === marca)) return "caducada";
    return "de_otra";
  }

  /* No queda ni rastro: ni la cartera, ni la marca, ni el expediente
     que la bandeja tiene abierto en pantalla. */
  function borrarLoDeOtra() {
    try { localStorage.removeItem(LLAVE_CARTERA); } catch (e) {}
    try { localStorage.removeItem(LLAVE_BANDEJA); } catch (e) {}
    try { localStorage.removeItem(DUENO_CARTERA); } catch (e) {}
    olvidarCaducada();
    ultimoVisto = null;
  }

  /* Lo que se le dice cuando la llave caduca. Se pinta en la propia barra
     de expedientes y se queda ahi hasta que vuelve a entrar: no es un
     aviso de cuatro segundos, es algo que tiene que hacer. */
  var FRASE_CADUCADA = "Se te ha caducado la sesión. Vuelve a entrar con tu clave: "
    + "tus expedientes siguen aquí, no se ha perdido nada.";
  var frase = "";

  function caducada() {
    apuntarCaducada(marcaGuardada());
    frase = FRASE_CADUCADA;
  }

  function leerCartera() {
    /* Se mira de quien es ANTES de leer nada. */
    var quien = deQuienEs();
    if (quien === "de_otra") { borrarLoDeOtra(); return null; }
    if (quien === "caducada") caducada();
    if (quien === "mia") { olvidarCaducada(); frase = ""; }
    try {
      var c = JSON.parse(localStorage.getItem(LLAVE_CARTERA) || "null");
      if (c && c.exp && typeof c.exp === "object") {
        if (!c.orden) c.orden = Object.keys(c.exp);
        if (quien === "adoptable") marcar();
        return c;
      }
    } catch (e) {}
    return null;
  }
  function guardarCartera() {
    C.tocada = ahora();
    try { localStorage.setItem(LLAVE_CARTERA, JSON.stringify(C)); } catch (e) {}
    marcar();
  }

  /* Lo que hubiera de antes NO se pierde: el expediente que la
     directora tuviera abierto pasa a ser el primero de la cartera. */
  function arrancar() {
    C = leerCartera();
    if (!C) {
      C = enBlancoCartera();
      var viejo = null;
      /* Solo se hereda el expediente suelto si NO es de otra oficina.
         Si lo era, leerCartera ya lo ha borrado y aqui no hay nada. */
      try { viejo = JSON.parse(localStorage.getItem(LLAVE_BANDEJA) || "null"); } catch (e) {}
      if (sano(viejo)) {
        var i1 = id();
        var n1 = nombreDe(viejo, "");
        if (n1 === "el expediente") n1 = "el primero";
        C.exp[i1] = { id: i1, nombre: n1, creado: ahora(), tocado: ahora(), guardado: viejo };
        C.orden = [i1]; C.activo = i1;
      }
      guardarCartera();
    }
    if (!C.activo || !C.exp[C.activo]) C.activo = C.orden[0] || null;
    if (C.activo) ponerEnLaBandeja(C.exp[C.activo].guardado);
  }

  function ponerEnLaBandeja(g) {
    try { localStorage.setItem(LLAVE_BANDEJA, JSON.stringify(g)); } catch (e) {}
    ultimoVisto = null;
  }

  /* ---------- el puente con la bandeja ----------
     La bandeja escribe en su llave de siempre cada vez que calcula.
     Aqui se recoge y se mete en el expediente activo. */
  var ultimoVisto = null;

  function recoger() {
    if (!C.activo) return false;
    var crudo = null;
    try { crudo = localStorage.getItem(LLAVE_BANDEJA); } catch (e) { return false; }
    if (!crudo || crudo === ultimoVisto) return false;
    ultimoVisto = crudo;
    var g = null; try { g = JSON.parse(crudo); } catch (e) { return false; }
    if (!sano(g)) return false;
    var e = C.exp[C.activo];
    if (!e) return false;
    if (JSON.stringify(e.guardado) === crudo) return false;
    e.guardado = g;
    e.nombre = nombreDe(g, e.nombre);
    e.tocado = ahora();
    guardarCartera();
    pintar();
    pedirSubida();
    return true;
  }

  /* ---------- las acciones ---------- */
  function lista() {
    return C.orden.filter(function (k) { return !!C.exp[k]; }).map(function (k) {
      var e = C.exp[k];
      return { id: e.id, nombre: e.nombre, creado: e.creado, tocado: e.tocado, activo: k === C.activo };
    });
  }

  function nuevo(nombre, noAbrir) {
    recoger();
    var i1 = id();
    /* mismo recorte que al renombrar: nombreCorto(), no dos reglas */
    var puesto = nombreCorto(nombre);
    C.exp[i1] = { id: i1, nombre: puesto || "expediente nuevo", creado: ahora(), tocado: ahora(),
                  guardado: guardadoEnBlanco(puesto || "el expediente") };
    C.orden.push(i1);
    guardarCartera();
    pedirSubida();
    if (!noAbrir) abrir(i1); else pintar();
    return i1;
  }

  function abrir(cual) {
    if (!C.exp[cual]) return false;
    recoger();
    C.activo = cual;
    guardarCartera();
    ponerEnLaBandeja(C.exp[cual].guardado);
    pedirSubida();
    /* La bandeja lee su llave UNA vez, al arrancar la pagina. Para que
       coja el expediente nuevo hay que volver a entrar en la pagina:
       es instantaneo y es mas honesto que dejarla pintando lo de antes. */
    if (document.getElementById("ban")) { location.reload(); return true; }
    pintar();
    return true;
  }

  function renombrar(cual, nombre) {
    if (!C.exp[cual]) return false;
    nombre = nombreCorto(nombre);
    if (!nombre) return false;
    C.exp[cual].nombre = nombre;
    C.exp[cual].guardado.expediente.nombre = nombre;
    C.exp[cual].tocado = ahora();
    if (cual === C.activo) ponerEnLaBandeja(C.exp[cual].guardado);
    guardarCartera(); pintar(); pedirSubida();
    return true;
  }

  function cerrar(cual) {
    if (!C.exp[cual]) return false;
    C.exp[cual].cerrado = ahora();
    C.exp[cual].tocado = ahora();
    if (cual === C.activo) {
      var otro = C.orden.filter(function (k) { return k !== cual && C.exp[k] && !C.exp[k].cerrado; })[0] || null;
      if (otro) { abrir(otro); return true; }
      C.activo = null;
    }
    guardarCartera(); pintar(); pedirSubida();
    return true;
  }
  function reabrir(cual) {
    if (!C.exp[cual]) return false;
    delete C.exp[cual].cerrado;
    C.exp[cual].tocado = ahora();
    guardarCartera(); pintar(); pedirSubida();
    return true;
  }

  /* ---------- el servidor: PC y movil ---------- */
  var relojSubida = null, subiendo = false, aviso = function () {};

  function hayCuenta() { try { return !!(window.IMMOIA_OFICINA && window.IMMOIA_OFICINA.hay()); } catch (e) { return false; } }

  function pedirSubida() {
    if (!hayCuenta()) return;
    if (relojSubida) clearTimeout(relojSubida);
    relojSubida = setTimeout(subir, ESPERA_SUBIDA);
  }

  function paraElServidor() {
    return { activo: C.activo, orden: C.orden, exp: C.exp, tocada: C.tocada };
  }

  /* Para Salir: cancela la espera de 4 s y sube YA. Si hay una subida en
     marcha, espera a que acabe y vuelve a subir. Siempre contesta.
     (Del paquete del auditor: es lo que hace que «Salir de esta cuenta»
     no se lleve por delante lo ultimo que se escribio.) */
  function subirYa(luego) {
    luego = luego || function () {};
    if (relojSubida) { clearTimeout(relojSubida); relojSubida = null; }
    if (!hayCuenta()) { luego({ ok: true }); return; }
    var intentos = 0;
    (function probar() {
      if (subiendo && intentos++ < 40) { setTimeout(probar, 200); return; }
      subir(luego);
    })();
  }

  function subir(luego, vuelta) {
    luego = luego || function () {};
    vuelta = vuelta || 0;
    if (!hayCuenta()) { luego({ error: "sin cuenta" }); return; }
    if (subiendo) { pedirSubida(); luego({ esperando: true }); return; }
    subiendo = true;
    aviso("Guardando en tu oficina…");
    window.IMMOIA_OFICINA.guardar(paraElServidor(), C.v, function (d) {
      subiendo = false;
      if (d && d.ok) {
        C.v = d.v; guardarCartera();
        aviso("Guardado. Lo ves igual desde el móvil.");
        luego(d); return;
      }
      if (d && d.conflicto && vuelta >= 3) {
        /* L-63: si tras tres vueltas sigue habiendo conflicto (dos aparatos
           guardando sin parar), se para aqui y se reintenta mas tarde. */
        juntar(d.datos); C.v = d.v; guardarCartera(); pintar();
        aviso("Hay otro aparato guardando a la vez: lo vuelvo a intentar en un momento.");
        pedirSubida(); luego({ esperando: true }); return;
      }
      if (d && d.conflicto) {
        /* alguien guardo desde otro sitio: se juntan y se vuelve a subir */
        var hubo = juntar(d.datos);
        C.v = d.v; guardarCartera(); pintar();
        aviso("Había cambios desde otro sitio: los he juntado.");
        /* L-09: la bandeja tiene su copia en memoria; si no se recarga,
           al guardar pisaria lo juntado. Se sube y despues se recarga. */
        subir(function (r) {
          if (hubo && r && r.ok && document.getElementById("ban")) location.reload();
          luego(r);
        }, vuelta + 1); return;
      }
      aviso("Guardado solo en este ordenador (" + ((d && d.error) || "sin conexion") + ").");
      luego(d);
    });
  }

  /* Juntar dos carteras: expediente por expediente, gana el que se
     toco mas tarde. Asi el PC y el movil pueden haber trabajado en
     expedientes distintos y no se pierde ninguno de los dos. */
  function juntar(otra) {
    if (!otra || !otra.exp) return 0;
    var cambios = 0;
    Object.keys(otra.exp).forEach(function (k) {
      var alla = otra.exp[k], aqui = C.exp[k];
      if (!alla || !sano(alla.guardado)) return;
      if (!aqui) { C.exp[k] = alla; if (C.orden.indexOf(k) === -1) C.orden.push(k); cambios++; return; }
      if (String(alla.tocado || "") > String(aqui.tocado || "")) { C.exp[k] = alla; cambios++; }
    });
    (otra.orden || []).forEach(function (k) { if (C.exp[k] && C.orden.indexOf(k) === -1) C.orden.push(k); });
    if (!C.activo || !C.exp[C.activo]) C.activo = otra.activo && C.exp[otra.activo] ? otra.activo : (C.orden[0] || null);
    if (C.activo && C.exp[C.activo]) ponerEnLaBandeja(C.exp[C.activo].guardado);
    guardarCartera();
    return cambios;
  }

  function bajar(luego) {
    luego = luego || function () {};
    if (!hayCuenta()) { luego({ error: "sin cuenta" }); return; }
    aviso("Buscando lo de tu oficina…");
    window.IMMOIA_OFICINA.traer(function (d) {
      if (!d || d.error) { aviso("No he podido traerlo (" + ((d && d.error) || "sin conexion") + ")."); luego(d); return; }
      if (!d.hay || !d.datos) { aviso(""); C.v = d.v || 0; guardarCartera(); subir(); luego(d); return; }
      var cambios = juntar(d.datos);
      C.v = d.v || 0;
      guardarCartera(); pintar();
      try { if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("cartera:al-dia", { cambios: cambios }); } catch (e) {}
      aviso(cambios ? "Al día: " + cambios + " expediente(s) traídos de tu oficina." : "Al día.");
      /* si aqui habia algo que alla no, se sube */
      /* L-10: no basta con que falte un expediente entero: si alguno de
         aqui es MAS NUEVO que el de alla, tambien se sube. Y se sube
         ANTES de recargar, para que la recarga no se lleve la subida. */
      var faltaAlla = Object.keys(C.exp).some(function (k) {
        var alla = d.datos.exp && d.datos.exp[k];
        return !alla || String((C.exp[k] || {}).tocado || "") > String(alla.tocado || "");
      });
      var recargar = cambios && document.getElementById("ban");
      if (faltaAlla) {
        subir(function () { if (recargar) location.reload(); luego(d); });
        return;
      }
      if (recargar) location.reload();
      luego(d);
    });
  }

  /* ---------- la barra de expedientes ---------- */
  var CSS = ".car{border:1px solid var(--linea,#D8D1BE);border-radius:12px;background:var(--tarjeta,#fff);padding:13px 15px;margin:0 0 18px}"
    + ".car h2{font-size:15px;color:var(--marca,#13342A);margin:0 0 2px}"
    + ".car>p{margin:0 0 10px;font-size:13px;color:var(--tinta-2,#635C4B)}"
    + ".car-lista{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 10px}"
    + ".car-e{display:flex;align-items:center;gap:6px;border:1px solid var(--linea,#D8D1BE);border-radius:999px;"
    + "padding:5px 6px 5px 12px;background:#FAF8F2;max-width:100%}"
    + ".car-e button.car-ir{border:0;background:none;font:inherit;font-size:14px;color:var(--tinta,#1B231F);cursor:pointer;padding:0;"
    + "max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".car-e.car-aqui{background:var(--marca,#13342A);border-color:var(--marca,#13342A)}"
    + ".car-e.car-aqui button.car-ir{color:#fff;font-weight:600;cursor:default}"
    + ".car-e small{font-size:11.5px;color:var(--tinta-2,#635C4B)}"
    + ".car-e.car-aqui small{color:#CFE0D6}"
    + ".car-e.car-cerrado{opacity:.55}"
    + ".car-x{border:0;background:none;color:inherit;opacity:.6;cursor:pointer;font:inherit;font-size:15px;line-height:1;padding:2px 6px}"
    + ".car-x:hover{opacity:1}"
    + ".car-pie{display:flex;gap:8px;align-items:center;flex-wrap:wrap}"
    + ".car-pie input{flex:1 1 200px;min-width:0;padding:8px 10px;font:inherit;font-size:14.5px;border:1px solid var(--linea,#D8D1BE);border-radius:8px;background:#fff;color:inherit}"
    + ".car-pie button{padding:8px 14px;font:inherit;font-weight:600;font-size:14px;border:0;border-radius:8px;cursor:pointer;background:var(--marca,#13342A);color:#fff}"
    + ".car-pie .car-2{background:#EEE9DE;color:#5B4646}"
    + ".car-aviso{font-size:13px;color:var(--tinta-2,#635C4B);margin-left:2px}"
    + ".car-link{float:right;font-size:13.5px;font-weight:400;color:var(--marca,#13342A)}"
    + ".car-caducada{margin:0 0 10px;padding:9px 12px;border:1px solid #E3BFA0;background:#FBEDE4;color:#7A3B12;border-radius:9px;font-size:13.5px}"
    + "@media (max-width:520px){.car-e button.car-ir{max-width:160px}}";

  var sitio = null, cssPuesto = false;

  function pintar() {
    if (!sitio) return;
    if (!cssPuesto) { cssPuesto = true; var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }
    var ls = lista();
    var abiertos = ls.filter(function (e) { return !C.exp[e.id].cerrado; });
    var cerrados = ls.filter(function (e) { return !!C.exp[e.id].cerrado; });

    var enManana = /manana\.html/i.test(location.pathname || "");
    var h = '<h2>Tus expedientes'
      + (enManana ? '' : ' <a class="car-link" href="manana.html">ver tu mañana →</a>') + '</h2>'
      + (frase ? '<p class="car-caducada" role="status">' + esc(frase) + '</p>' : '')
      + '<p>' + (abiertos.length ? (abiertos.length === 1 ? '1 abierto' : abiertos.length + ' abiertos')
                                 + '. Pulsa uno para trabajar en él; lo que hagas en cada uno se queda ahí.'
                                 : 'Todavía no tienes ninguno. Ponle un nombre corto, como «el de Adeje».') + '</p>'
      + '<div class="car-lista">';
    abiertos.concat(cerrados).forEach(function (e) {
      var ce = !!C.exp[e.id].cerrado;
      h += '<span class="car-e' + (e.activo ? ' car-aqui' : '') + (ce ? ' car-cerrado' : '') + '">'
        + '<button type="button" class="car-ir" data-ir="' + esc(e.id) + '" title="' + esc(e.nombre) + '">' + esc(e.nombre) + '</button>'
        + (ce ? '<small>cerrado</small>' : '')
        + '<button type="button" class="car-x" data-' + (ce ? 'reabrir' : 'cerrar') + '="' + esc(e.id) + '" title="'
        + (ce ? 'volver a abrirlo' : 'darlo por cerrado') + '">' + (ce ? '↺' : '×') + '</button>'
        + '</span>';
    });
    h += '</div><div class="car-pie">'
      + '<input type="text" id="car-nombre" placeholder="el de Adeje" maxlength="60" aria-label="Nombre del expediente nuevo">'
      + '<button type="button" id="car-nuevo">Abrir expediente</button>'
      + (hayCuenta() ? '<button type="button" class="car-2" id="car-sinc">Traer lo de mi oficina</button>' : '')
      + '<span class="car-aviso" id="car-aviso"></span></div>';
    sitio.innerHTML = h;

    sitio.querySelectorAll("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () { abrir(b.getAttribute("data-ir")); });
    });
    sitio.querySelectorAll("[data-cerrar]").forEach(function (b) {
      b.addEventListener("click", function () { cerrar(b.getAttribute("data-cerrar")); });
    });
    sitio.querySelectorAll("[data-reabrir]").forEach(function (b) {
      b.addEventListener("click", function () { reabrir(b.getAttribute("data-reabrir")); });
    });
    var campo = sitio.querySelector("#car-nombre");
    var bn = sitio.querySelector("#car-nuevo");
    if (bn) bn.addEventListener("click", function () { nuevo(campo.value); });
    if (campo) campo.addEventListener("keydown", function (e) { if (e.key === "Enter") nuevo(campo.value); });
    var bs = sitio.querySelector("#car-sinc");
    if (bs) bs.addEventListener("click", function () { bajar(); });
  }

  aviso = function (t) {
    if (!sitio) return;
    var a = sitio.querySelector("#car-aviso");
    if (!a) return;
    a.textContent = t;
    if (t) setTimeout(function () { if (a.textContent === t) a.textContent = ""; }, 4000);
  };

  function montar() {
    sitio = document.getElementById("cartera");
    if (!sitio) {
      var ancla = document.getElementById("inmo-mesa");
      if (!ancla) return;
      sitio = document.createElement("div");
      sitio.id = "cartera"; sitio.className = "car";
      ancla.parentNode.insertBefore(sitio, ancla);
    } else { sitio.className = "car"; }
    pintar();
    if (hayCuenta()) bajar();
  }

  /* ---------- arranque ---------- */
  arrancar();

  /* La bandeja avisa por el nucleo cada vez que recalcula, y para
     entonces ya ha guardado: recogerlo ahi es inmediato. El latido de
     abajo se queda como red, por si alguna vez no llega el aviso. */
  try {
    if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.cuando("bandeja:calculada", function () { recoger(); });
  } catch (e) {}

  /* CUANDO SE ENTRA O SE SALE DE UNA CUENTA.
     oficina.js avisa por el nucleo en las dos direcciones. Sin esto,
     la limpieza solo ocurriria al recargar la pagina, y salir y entrar
     con otra cuenta sin recargar deja los expedientes a la vista. */
  try {
    if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.cuando("oficina:cambio", function (datos) {
      /* EL MOTIVO LO PONE OFICINA.JS, NO SE ADIVINA AQUI. Al entrar se
         vuelve a cero, para que una caducidad posterior se vea como lo
         que es y no como una salida a proposito de antes. */
      var motivo = String((datos && datos.motivo) || "");
      if (ES_SALIDA[motivo]) salidaAdrede = true;
      else if (motivo === "caducada" || ES_ENTRADA[motivo]) salidaAdrede = false;
      var quien = deQuienEs();
      /* SE LE HA CADUCADO LA LLAVE. No se borra NADA: la cartera se queda
         entera, el expediente sigue abierto en la bandeja, y lo unico que
         cambia es que se le dice lo que pasa y lo que tiene que hacer. */
      if (quien === "caducada") {
        caducada();
        pintar();
        return;
      }
      if (quien === "de_otra") {
        borrarLoDeOtra();
        C = enBlancoCartera();
        guardarCartera();
        pintar();
        /* La bandeja tiene su propia copia en memoria: borrar la llave
           no le quita de la pantalla el expediente de la otra oficina.
           empezarDeCero() ya existe en su API publica (bandeja.js:380):
           la deja en blanco y repinta. Asi no hay que tocar bandeja.js. */
        try {
          if (window.IMMOIA_BANDEJA && window.IMMOIA_BANDEJA.empezarDeCero) window.IMMOIA_BANDEJA.empezarDeCero();
        } catch (e) {}
        if (hayCuenta()) bajar();
        return;
      }
      if (quien === "adoptable") marcar();
      if (quien === "mia" && cuentaDeAhora() !== "") { olvidarCaducada(); frase = ""; salidaAdrede = false; pintar(); }
      if (hayCuenta()) bajar();
    });
  } catch (e) {}
  setInterval(recoger, LATIDO);
  window.addEventListener("pagehide", function () { recoger(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { recoger(); if (relojSubida) { clearTimeout(relojSubida); subir(); } }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();

  window.IMMOIA_CARTERA = {
    version: "1.1",
    lista: lista,
    activo: function () { return C.activo; },
    expediente: function (cual) { return C.exp[cual || C.activo] || null; },
    guardado: function (cual) { var e = C.exp[cual || C.activo]; return e ? e.guardado : null; },
    nuevo: nuevo, abrir: abrir, renombrar: renombrar, cerrar: cerrar, reabrir: reabrir,
    /* subir() de puertas afuera es subirYa(): es lo que llama oficina.js
       al salir. subirLuego() es la espera de 4 s de siempre. */
    recoger: recoger, subir: subirYa, subirLuego: pedirSubida, bajar: bajar, juntar: juntar,
    version_servidor: function () { return C.v; },
    /* lo que se le esta diciendo ahora mismo en la barra, si algo */
    frase: function () { return frase; },
    todo: function () { return C; },
    montar: montar
  };
  try { if (window.IMMOIA_NUCLEO) window.IMMOIA_NUCLEO.avisar("cartera:montada", { cuantos: C.orden.length }); } catch (e) {}
})();
