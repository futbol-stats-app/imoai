/* IMMO IA · MOTOR DE AUTONOMIA Y ANTICIPACION
   ------------------------------------------------------------------
   Traduccion fiel, linea por linea, de motor_autonomia.py y de
   anticipacion.py. Mismas tablas, mismas reglas, mismos textos.
   Se comprueba con una prueba que ejecuta los dos y compara.

   Las cinco reglas, tal cual estaban:
     1. Cada tarea declara QUE LE FALTA, no de que color es.
     2. El color se calcula. Al aparecer un permiso, todo se
        reevalua solo.
     3. Los permisos dependen unos de otros.
     4. NUNCA se pide algo que hoy no desbloquearia nada.
     5. Se propone SIEMPRE un solo siguiente paso, el mas rentable.
   ------------------------------------------------------------------ */
(function (raiz) {
  "use strict";

  var IMPOSIBLE = "imposible";

  var LLAVES = {
    gmail:         { que: "El correo de la agencia",
                     como: "La directora pulsa 'Autorizar' una vez. 30 segundos.",
                     necesita: [], pide_a: "agencia", esfuerzo: 1 },
    calendario:    { que: "El calendario de la agencia",
                     como: "El mismo boton que el correo.",
                     necesita: [], pide_a: "agencia", esfuerzo: 1 },
    cert_empresa:  { que: "El certificado de representante de la agencia",
                     como: "Se saca en la FNMT y se custodia en servidor seguro.",
                     necesita: [], pide_a: "agencia", esfuerzo: 3 },
    poder_rea:     { que: "El apoderamiento del cliente",
                     como: "El cliente lo inscribe en apodera.redsara.es. Dura 5 anios.",
                     necesita: ["cert_empresa"], pide_a: "cliente", esfuerzo: 2 },
    poder_not:     { que: "Poder notarial expreso",
                     como: "El cliente va al notario. Solo para vender o hipotecar.",
                     necesita: ["cert_empresa"], pide_a: "cliente", esfuerzo: 5 },
    cuenta_corpme: { que: "Cuenta con el Colegio de Registradores",
                     como: "Contrato con el CORPME. Se paga por consulta.",
                     necesita: [], pide_a: "agencia", esfuerzo: 4 },
    consent_datos: { que: "Consentimiento del titular para sus datos protegidos",
                     como: "Una firma del dueno de la casa.",
                     necesita: [], pide_a: "cliente", esfuerzo: 2 }
  };

  var DATOS = {
    direccion: "La direccion de la casa",
    precio: "El precio pactado",
    ccaa: "En que comunidad esta la casa",
    correo_admin: "El correo del administrador de fincas",
    fecha_firma: "La fecha prevista de firma",
    correo_cliente: "El correo del cliente"
  };
  /* [nombre, fase, llaves que necesita, datos que necesita] */
  var TAREAS = [
    ["Sacar superficie, ano y uso del Catastro", "Captacion", [], ["direccion"]],
    ["Montar la ficha de la vivienda", "Captacion", [], ["direccion"]],
    ["Decir que papeles hacen falta", "Captacion", [], []],
    ["Saber quien es el titular registral", "Captacion", ["cuenta_corpme"], ["direccion"]],
    ["Saber el valor catastral", "Captacion", ["consent_datos"], ["direccion"]],

    ["Redactar la peticion del certificado de la comunidad", "Papeles", [], []],
    ["Enviar la peticion al administrador", "Papeles", ["gmail"], ["correo_admin"]],
    ["Reclamar cuando pasan los 7 dias", "Papeles", ["gmail"], ["correo_admin"]],
    ["Detectar que ha llegado el certificado", "Papeles", ["gmail"], []],
    ["Archivar el papel en el expediente", "Papeles", [], []],
    ["Leer el PDF que llega", "Papeles", [], []],
    ["Pedir la nota simple al Registro", "Papeles", ["cuenta_corpme"], ["direccion"]],
    ["Encargar el certificado energetico", "Papeles", ["gmail"], ["direccion"]],
    ["Emitir el certificado energetico", "Papeles", [IMPOSIBLE], []],
    ["Emitir el certificado de deuda de la comunidad", "Papeles", [IMPOSIBLE], []],
    ["Pedir la cedula de habitabilidad", "Papeles", ["poder_rea"], ["direccion"]],
    ["Pedir el certificado de IBI al ayuntamiento", "Papeles", ["poder_rea"], ["direccion"]],

    ["Llevar los plazos de cada papel", "Seguimiento", [], []],
    ["Avisar de lo que vence", "Seguimiento", [], []],
    ["Preguntar como va un expediente", "Seguimiento", [], []],
    ["Insistir a quien no contesta", "Seguimiento", [], []],
    ["Vigilar el BOE cada manana", "Seguimiento", [], []],
    ["Detectar que ha cambiado un impuesto", "Seguimiento", [], []],

    ["Redactar el contrato de arras", "Documentos", [], ["precio", "fecha_firma"]],
    ["Redactar la hoja de encargo", "Documentos", [], ["precio"]],
    ["Calcular el ITP y el AJD", "Documentos", [], ["precio", "ccaa"]],
    ["Rellenar el modelo 600", "Documentos", [], ["precio", "ccaa"]],
    ["Presentar y pagar el modelo 600", "Documentos", ["poder_rea"], ["precio", "ccaa"]],
    ["Firmar un documento como la agencia", "Documentos", ["cert_empresa"], []],
    ["Firmar en nombre del cliente", "Documentos", [IMPOSIBLE], []],
    ["Mandar el documento al cliente", "Documentos", ["gmail"], ["correo_cliente"]],

    ["Proponer fecha de firma", "Citas", [], []],
    ["Poner la cita en el calendario", "Citas", ["calendario"], ["fecha_firma"]],
    ["Mandar la documentacion al notario", "Citas", ["gmail"], ["fecha_firma"]],
    ["Firmar la escritura", "Citas", [IMPOSIBLE], []],
    ["El acta previa de la hipoteca", "Citas", [IMPOSIBLE], []],

    ["Buscar la ordenanza de un ayuntamiento", "Ayuntamiento", [], ["direccion"]],
    ["Presentar un escrito en el ayuntamiento", "Ayuntamiento", ["poder_rea"], ["direccion"]],
    ["Consultar el estado del escrito", "Ayuntamiento", [], []],

    ["Preparar la factura al cliente", "Cobro", [], ["precio"]],
    ["Cobrar la cuota de la inmobiliaria", "Cobro", ["cert_empresa"], []],
    ["Pagar una tasa por el cliente", "Cobro", ["poder_rea"], []],
    ["Aceptar una herencia", "Cobro", [IMPOSIBLE], []],
    ["Vender o hipotecar por el cliente", "Cobro", ["poder_not"], []]
  ];
  /* ---------- utiles ---------- */
  function conjunto(x) { return (x instanceof Set) ? x : new Set(x || []); }

  function llaves_utiles(llave) {
    if (llave === IMPOSIBLE || !LLAVES[llave]) return new Set([llave]);
    var fuera = new Set([llave]);
    LLAVES[llave].necesita.forEach(function (d) {
      llaves_utiles(d).forEach(function (x) { fuera.add(x); });
    });
    return fuera;
  }

  /* ---------- EL MOTOR ---------- */
  function estado(tarea, tengo, datos_que_hay) {
    tengo = conjunto(tengo); datos_que_hay = conjunto(datos_que_hay);
    var llaves = tarea[2], datos = tarea[3];

    if (llaves.indexOf(IMPOSIBLE) !== -1)
      return ["ROJO", { tipo: "imposible", falta: [] }];

    var necesita = new Set();
    llaves.forEach(function (k) {
      llaves_utiles(k).forEach(function (x) { necesita.add(x); });
    });

    var faltan_llaves = Array.from(necesita).filter(function (k) { return !tengo.has(k); }).sort();
    var faltan_datos = datos.filter(function (d) { return !datos_que_hay.has(d); });

    if (faltan_llaves.indexOf("poder_not") !== -1)
      return ["ROJO", { tipo: "notario", falta: faltan_llaves }];

    if (faltan_llaves.length)
      return ["AMBAR", { tipo: "permiso", falta: faltan_llaves, datos: faltan_datos }];

    if (faltan_datos.length)
      return ["AMBAR", { tipo: "dato", falta: faltan_datos }];

    return ["VERDE", { tipo: "listo", falta: [] }];
  }

  function resumen(tengo, datos_que_hay) {
    var r = { VERDE: 0, AMBAR: 0, ROJO: 0 };
    TAREAS.forEach(function (t) { r[estado(t, tengo, datos_que_hay)[0]] += 1; });
    return r;
  }

  /* Cuantas tareas pasarian a VERDE con SOLO esta llave.
     Regla de oro: si da 0, no se pide. */
  function cuanto_desbloquea(llave, tengo, datos_que_hay) {
    tengo = conjunto(tengo);
    var antes = resumen(tengo, datos_que_hay).VERDE;
    var mas = new Set(tengo); mas.add(llave);
    return resumen(mas, datos_que_hay).VERDE - antes;
  }

  /* Un solo siguiente paso, el mas rentable. */
  function siguiente_paso(tengo, datos_que_hay) {
    tengo = conjunto(tengo);
    var opciones = [];
    Object.keys(LLAVES).forEach(function (k) {
      if (tengo.has(k)) return;
      var pendientes = LLAVES[k].necesita.filter(function (d) { return !tengo.has(d); });
      if (pendientes.length) return;
      var gana = cuanto_desbloquea(k, tengo, datos_que_hay);
      if (gana <= 0) return;
      opciones.push([gana, -LLAVES[k].esfuerzo, k]);
    });
    if (!opciones.length) return null;
    /* mismo orden que Python: sort(reverse=True) sobre la tupla */
    opciones.sort(function (a, b) {
      if (a[0] !== b[0]) return b[0] - a[0];
      if (a[1] !== b[1]) return b[1] - a[1];
      return a[2] < b[2] ? 1 : (a[2] > b[2] ? -1 : 0);
    });
    var g = opciones[0], info = LLAVES[g[2]];
    return { llave: g[2], desbloquea: g[0], que: info.que, como: info.como,
             necesita: info.necesita, pide_a: info.pide_a, esfuerzo: info.esfuerzo };
  }

  function bloqueado_por(llave, tengo) {
    tengo = conjunto(tengo);
    if (tengo.has(llave)) return null;
    var faltan = LLAVES[llave].necesita.filter(function (d) { return !tengo.has(d); });
    return faltan.length ? faltan : null;
  }
  /* ================= ANTICIPACION ================= */

  var GUION = [
    { paso: "ficha_catastro",     tras: [],                  tarea: "Sacar superficie, ano y uso del Catastro",
      porque: "Es lo primero de toda captacion" },
    { paso: "lista_papeles",      tras: ["ficha_catastro"],  tarea: "Decir que papeles hacen falta",
      porque: "Con la ficha ya se sabe que le toca a esta casa" },
    { paso: "pedir_comunidad",    tras: ["lista_papeles"],   tarea: "Enviar la peticion al administrador",
      porque: "El administrador tiene 7 dias por ley y suele tardar mas" },
    { paso: "nota_simple",        tras: ["lista_papeles"],   tarea: "Pedir la nota simple al Registro",
      porque: "Es donde aparecen las cargas y los embargos" },
    { paso: "energetico",         tras: ["lista_papeles"],   tarea: "Encargar el certificado energetico",
      porque: "Sin el no se puede ni anunciar la casa" },
    { paso: "reclamar_comunidad", tras: ["pedir_comunidad"], tarea: "Reclamar cuando pasan los 7 dias",
      porque: "Han pasado los 7 dias de ley y no ha llegado", solo_si: "comunidad_vencida" },
    { paso: "arras",              tras: ["lista_papeles"],   tarea: "Redactar el contrato de arras",
      porque: "Es el papel que fija la operacion" },
    { paso: "impuestos",          tras: ["arras"],           tarea: "Calcular el ITP y el AJD",
      porque: "El comprador necesita saber con cuanto contar" },
    { paso: "modelo600",          tras: ["impuestos"],       tarea: "Rellenar el modelo 600",
      porque: "Hay plazo desde la firma" },
    { paso: "cita_notaria",       tras: ["arras"],           tarea: "Poner la cita en el calendario",
      porque: "La fecha de firma ya esta pactada en las arras" },
    { paso: "docu_notario",       tras: ["cita_notaria"],    tarea: "Mandar la documentacion al notario",
      porque: "El notario la necesita dias antes" },
    { paso: "presentar600",       tras: ["modelo600"],       tarea: "Presentar y pagar el modelo 600",
      porque: "Se acaba el plazo" }
  ];

  var TOPE_AVISOS_DIA = 2;

  function Expediente(nombre) {
    this.nombre = nombre;
    this.hechos = new Set(); this.en_marcha = new Set();
    this.avisados = new Set(); this.rechazados = new Set();
    this.senales = new Set(); this.datos = new Set();
    this.diario = []; this.avisos_hoy = 0;
  }

  function toca(paso, exp) {
    if (exp.hechos.has(paso.paso) || exp.en_marcha.has(paso.paso)) return false;
    if (exp.rechazados.has(paso.paso)) return false;
    if (paso.tras.some(function (t) { return !exp.hechos.has(t); })) return false;
    if (paso.solo_si && !exp.senales.has(paso.solo_si)) return false;
    return true;
  }

  function buscar_tarea(nombre) {
    for (var i = 0; i < TAREAS.length; i++) if (TAREAS[i][0] === nombre) return TAREAS[i];
    return null;
  }

  function adelantarse(exp, tengo_llaves) {
    var hecho_ahora = [], para_pedir = [];
    for (var vuelta = 0; vuelta < GUION.length; vuelta++) {
      var avance = false;
      for (var i = 0; i < GUION.length; i++) {
        var paso = GUION[i];
        if (!toca(paso, exp)) continue;
        var tarea = buscar_tarea(paso.tarea);
        if (!tarea) continue;
        var e = estado(tarea, tengo_llaves, exp.datos), anillo = e[0], info = e[1];
        if (anillo === "VERDE") {
          exp.hechos.add(paso.paso);
          exp.diario.push(paso.tarea);
          hecho_ahora.push(paso.tarea);
          avance = true;
        } else if (anillo === "AMBAR") {
          var ya = para_pedir.some(function (x) { return x[0].paso === paso.paso; });
          if (!exp.avisados.has(paso.paso) && !ya) para_pedir.push([paso, info]);
        }
        /* ROJO: no se toca. Sale en el parte, no como aviso. */
      }
      if (!avance) break;
    }
    var aviso = null;
    if (para_pedir.length && exp.avisos_hoy < TOPE_AVISOS_DIA) {
      aviso = montar_aviso(para_pedir, exp);
      para_pedir.forEach(function (x) { exp.avisados.add(x[0].paso); });
      exp.avisos_hoy += 1;
    }
    return { hecho: hecho_ahora, aviso: aviso, callado: aviso ? 0 : para_pedir.length };
  }
  /* Se agrupa por LO QUE FALTA, no por tarea: si tres cosas esperan
     lo mismo, es UNA frase y no tres. */
  function montar_aviso(para_pedir, exp) {
    var grupos = [];
    function busca(clave) {
      for (var i = 0; i < grupos.length; i++) if (grupos[i].clave === clave) return grupos[i];
      var g = { clave: clave, tareas: [] }; grupos.push(g); return g;
    }
    para_pedir.forEach(function (x) {
      var paso = x[0], info = x[1], clave;
      if (info.tipo === "dato") clave = "dato|" + info.falta.join(",");
      else clave = "llave|" + info.falta.filter(function (k) { return !!LLAVES[k]; }).join(",");
      busca(clave).tareas.push(paso.tarea);
    });
    var orden = grupos.slice().sort(function (a, b) { return b.tareas.length - a.tareas.length; });

    function enumera(cosas) {
      cosas = cosas.map(function (c) { return c.charAt(0).toLowerCase() + c.slice(1); });
      if (cosas.length === 1) return cosas[0];
      if (cosas.length === 2) return cosas[0] + " y " + cosas[1];
      return cosas[0] + ", " + cosas[1] + " y " + (cosas.length - 2) + " cosas mas";
    }

    var frases = [];
    orden.slice(0, 2).forEach(function (g) {
      var trozos = g.clave.split("|"), tipo = trozos[0];
      var falta = trozos[1] ? trozos[1].split(",") : [];
      if (tipo === "dato") {
        var que = falta.map(function (d) { return DATOS[d].toLowerCase(); }).join(" y ");
        frases.push("Para " + enumera(g.tareas) + " me falta " + que + ".");
      } else {
        var q = falta.map(function (k) { return LLAVES[k].que.toLowerCase(); }).join(" y ");
        frases.push("Tengo listo " + enumera(g.tareas) + ". Para mandarlo necesito " + q + ".");
      }
    });

    var resto = orden.length - 2;
    var cola = resto > 0 ? " Hay " + resto + " cosa(s) mas esperando; te las cuento en el parte." : "";
    return "Sobre " + exp.nombre + ": " + frases.join(" ") + cola + " Lo hago?";
  }

  function parte_del_dia(exp) {
    if (!exp.diario.length) return "Hoy no he tocado " + exp.nombre + ".";
    return "En " + exp.nombre + " he hecho esto yo sola: " + exp.diario.join("; ") + ".";
  }

  var API = {
    version: "1.0",
    IMPOSIBLE: IMPOSIBLE, LLAVES: LLAVES, DATOS: DATOS, TAREAS: TAREAS, GUION: GUION,
    TOPE_AVISOS_DIA: TOPE_AVISOS_DIA,
    llaves_utiles: llaves_utiles, estado: estado, resumen: resumen,
    cuanto_desbloquea: cuanto_desbloquea, siguiente_paso: siguiente_paso,
    bloqueado_por: bloqueado_por,
    Expediente: Expediente, toca: toca, buscar_tarea: buscar_tarea,
    adelantarse: adelantarse, montar_aviso: montar_aviso, parte_del_dia: parte_del_dia
  };

  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_MOTOR = API;
})(typeof window !== "undefined" ? window : null);
