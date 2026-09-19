/* IMMO IA · TAREAS DEL ALQUILER (datos, no motor)
   ------------------------------------------------------------------
   Rama de ALQUILER, escrita el 18/09/2026 por la pestana INQUILINOS.

   QUE ES ESTE FICHERO
   Es el gemelo de las tablas LLAVES / DATOS / COMO_DATOS / TAREAS /
   GUION que hoy viven dentro de motor.js, pero de alquiler en vez de
   compraventa. MISMA FORMA, EXACTA: cada tarea es
       [nombre, fase, llaves que necesita, datos que necesita]
   y cada llave declara { que, como, necesita, pide_a, esfuerzo }.

   PROBADO CON EL MOTOR DE VERDAD, no con una copia: prueba_alquiler.mjs
   carga el motor.js publicado, le cambia las tablas en caliente (sus
   arrays salen por la API, asi que se pueden vaciar y rellenar desde
   fuera), le pide que calcule y se las deja como estaban.
   532 comprobaciones, 532 correctas.

   LO QUE NO HACE, Y HAY QUE DECIRLO
   NO se engancha solo a la web. Quien decide cuando el expediente es
   de alquiler y le pone estas tablas al motor es un cargador que
   todavia no existe, y motor.js no es mio: no lo toco. La propuesta,
   en INFORME_INQUILINOS.md.

   LOS COMENTARIOS VAN SIN TILDES, como motor.js. LOS TEXTOS QUE SE
   VEN EN PANTALLA, NO: llevan sus tildes y sus enes. El motor mete el
   nombre de la tarea dentro de la frase que lee la persona, asi que
   un nombre de tarea es texto de pantalla, no codigo.
   ------------------------------------------------------------------ */
(function (raiz) {
  "use strict";

  var IMPOSIBLE = "imposible";

  /* Las seis primeras son las MISMAS que en compraventa, con el mismo
     nombre a proposito: si una agencia ya autorizo el correo para
     vender, no se le vuelve a pedir para alquilar. Las tres ultimas
     son de alquiler y no existen en motor.js. */
  var LLAVES = {
    gmail:          { que: "El correo de la agencia",
                      como: "La directora pulsa 'Autorizar' una vez. 30 segundos.",
                      necesita: [], pide_a: "agencia", esfuerzo: 1 },
    calendario:     { que: "El calendario de la agencia",
                      como: "El mismo botón que el correo.",
                      necesita: [], pide_a: "agencia", esfuerzo: 1 },
    cert_empresa:   { que: "El certificado de representante de la agencia",
                      como: "Se saca en la FNMT y se custodia en servidor seguro.",
                      necesita: [], pide_a: "agencia", esfuerzo: 3 },
    poder_rea:      { que: "El apoderamiento del cliente",
                      como: "El cliente lo inscribe en apodera.redsara.es. Dura 5 años.",
                      necesita: ["cert_empresa"], pide_a: "cliente", esfuerzo: 2 },
    cuenta_corpme:  { que: "La cuenta con el Colegio de Registradores",
                      como: "Contrato con el CORPME. Se paga por consulta.",
                      necesita: [], pide_a: "agencia", esfuerzo: 4 },
    consent_datos:  { que: "El consentimiento del propietario para sus datos protegidos",
                      como: "Una firma del dueño de la vivienda.",
                      necesita: [], pide_a: "cliente", esfuerzo: 2 },

    /* --- estas tres son de alquiler --- */
    mandato_arr:    { que: "La autorización escrita del propietario para alquilar en su nombre",
                      como: "La hoja de encargo firmada por el dueño. Es un papel de la agencia, no del notario.",
                      necesita: [], pide_a: "cliente", esfuerzo: 2 },
    alta_terceros:  { que: "El alta de la agencia como tercero en el Gobierno de Canarias",
                      como: "Se pide una vez y sirve para todos los depósitos de fianza. Es el primero de los tres pasos del Instituto Canario de la Vivienda.",
                      necesita: [], pide_a: "agencia", esfuerzo: 2 },
    consent_inq:    { que: "El consentimiento del candidato a inquilino para mirar sus datos",
                      como: "Una hoja firmada por el candidato antes de pedirle nada. Sin ella no se le pide ni la nómina.",
                      necesita: [], pide_a: "inquilino", esfuerzo: 1 }
  };

  var DATOS = {
    direccion:        "La dirección de la vivienda",
    renta:            "La renta mensual pactada",
    fecha_entrada:    "La fecha prevista de entrada del inquilino",
    ccaa:             "En qué comunidad está la vivienda",
    correo_cliente:   "El correo del propietario",
    correo_inquilino: "El correo del inquilino",
    tipo_arrendador:  "Si el propietario es un particular o una sociedad",
    vive_fuera:       "Si el propietario vive fuera de España"
  };

  /* Un dato se consigue PREGUNTANDO: esfuerzo 0 o 1, siempre por
     debajo de cualquier llave. Es la correccion que se le hizo a
     motor.js el 16/09, y aqui nace ya bien. */
  var COMO_DATOS = {
    direccion:        { como: "Me la dices tú: la sabes de memoria.", pide_a: "agencia", esfuerzo: 0 },
    renta:            { como: "En cuanto esté pactada, me la dices.", pide_a: "agencia", esfuerzo: 0 },
    fecha_entrada:    { como: "La fecha que hayáis hablado, aunque sea aproximada.", pide_a: "agencia", esfuerzo: 0 },
    ccaa:             { como: "Sale sola de la dirección, o me la dices.", pide_a: "agencia", esfuerzo: 0 },
    tipo_arrendador:  { como: "Particular o sociedad. Cambia la duración mínima: cinco años o siete.", pide_a: "agencia", esfuerzo: 0 },
    vive_fuera:       { como: "Se pregunta en la captación, no al final: si vive fuera, hay un impuesto que presentar.", pide_a: "agencia", esfuerzo: 0 },
    correo_cliente:   { como: "El correo del propietario, para mandarle los papeles.", pide_a: "cliente", esfuerzo: 1 },
    correo_inquilino: { como: "El correo del inquilino, para mandarle el contrato y los avisos.", pide_a: "inquilino", esfuerzo: 1 }
  };

  /* [nombre, fase, llaves que necesita, datos que necesita]
     Las que llevan IMPOSIBLE son las que la secretaria NO puede hacer
     nunca: las hace una persona. Salen en el parte, no como aviso. */
  var TAREAS = [
    /* ---------- CAPTACIÓN ---------- */
    ["Sacar superficie, año y uso del Catastro", "Captación", [], ["direccion"]],
    ["Montar la ficha de la vivienda en alquiler", "Captación", [], ["direccion"]],
    ["Decir qué papeles hacen falta para alquilar", "Captación", [], []],
    ["Saber quién es el titular registral", "Captación", ["cuenta_corpme"], ["direccion"]],
    ["Avisar de que la duración mínima es de cinco años, o de siete", "Captación", [], ["tipo_arrendador"]],
    ["Avisar de que el propietario vive fuera y hay un impuesto suyo", "Captación", [], ["vive_fuera"]],
    ["Redactar la hoja de encargo del alquiler", "Captación", [], ["renta"]],
    ["Recordar que los honorarios los paga el propietario", "Captación", [], []],

    /* ---------- PAPELES ---------- */
    ["Encargar el certificado energético", "Papeles", ["gmail"], ["direccion"]],
    ["Emitir el certificado energético", "Papeles", [IMPOSIBLE], []],
    ["Comprobar si hay comunicación de ocupación o de habitabilidad", "Papeles", [], ["direccion"]],
    ["Pedir la comunicación de ocupación al ayuntamiento", "Papeles", ["poder_rea"], ["direccion"]],
    ["Pedir los últimos recibos del IBI al propietario", "Papeles", ["gmail"], ["correo_cliente"]],
    ["Pedir la nota simple para ver las cargas", "Papeles", ["cuenta_corpme"], ["direccion"]],
    ["Comprobar si el municipio está en zona tensionada", "Papeles", [], ["direccion"]],
    ["Archivar cada papel en el expediente", "Papeles", [], []],
    ["Leer el PDF que llega", "Papeles", [], []],

    /* ---------- INQUILINO ---------- */
    ["Preparar la hoja de consentimiento del candidato", "Inquilino", [], []],
    ["Pedir la documentación de solvencia al candidato", "Inquilino", ["gmail", "consent_inq"], ["correo_inquilino"]],
    ["Comprobar que la documentación del candidato está completa", "Inquilino", ["consent_inq"], []],
    ["Consultar un fichero de morosos sobre el candidato", "Inquilino", [IMPOSIBLE], []],
    ["Decidir a qué candidato se le alquila", "Inquilino", [IMPOSIBLE], []],
    ["Organizar las visitas", "Inquilino", ["calendario"], ["direccion"]],
    ["Contestar a los interesados que preguntan por el anuncio", "Inquilino", ["gmail"], []],

    /* ---------- CONTRATO ---------- */
    ["Redactar el contrato de arrendamiento", "Contrato", [], ["renta", "fecha_entrada", "tipo_arrendador"]],
    ["Calcular la fianza y la garantía adicional máxima", "Contrato", [], ["renta"]],
    ["Escribir en el contrato cómo se actualiza la renta", "Contrato", [], []],
    ["Mandar el borrador al propietario y al inquilino", "Contrato", ["gmail"], ["correo_cliente", "correo_inquilino"]],
    ["Firmar el contrato como la agencia", "Contrato", ["cert_empresa", "mandato_arr"], []],
    ["Firmar el contrato en nombre del propietario", "Contrato", [IMPOSIBLE], []],

    /* ---------- ENTRADA ---------- */
    ["Preparar el inventario de entrada con fotos", "Entrada", [], []],
    ["Entregar las llaves", "Entrada", [IMPOSIBLE], []],
    ["Avisar de que la fianza se deposita en un mes", "Entrada", [], ["fecha_entrada"]],
    ["Preparar el depósito de la fianza", "Entrada", ["alta_terceros"], ["renta"]],
    ["Presentar el depósito de la fianza", "Entrada", ["alta_terceros", "poder_rea"], ["renta"]],
    ["Guardar el resguardo del depósito en el expediente", "Entrada", [], []],
    ["Dar de alta la luz y el agua a nombre del inquilino", "Entrada", ["poder_rea"], ["direccion"]],

    /* ---------- VIDA DEL CONTRATO ---------- */
    ["Llevar los plazos de cada papel", "Vida del contrato", [], []],
    ["Avisar de lo que vence", "Vida del contrato", [], []],
    ["Avisar de que toca la subida anual de la renta", "Vida del contrato", [], ["fecha_entrada"]],
    ["Preparar la carta de actualización de la renta", "Vida del contrato", [], ["renta"]],
    ["Avisar del preaviso de no renovación antes de que se pase", "Vida del contrato", [], ["fecha_entrada", "tipo_arrendador"]],
    ["Avisar de que el inquilino ya puede irse si quiere", "Vida del contrato", [], ["fecha_entrada"]],
    ["Vigilar el BOE cada mañana", "Vida del contrato", [], []],

    /* ---------- IMPAGOS ---------- */
    ["Detectar que una mensualidad no ha entrado", "Impagos", [], ["renta"]],
    ["Mandar el primer aviso de impago", "Impagos", ["gmail"], ["correo_inquilino"]],
    ["Preparar el requerimiento fehaciente de pago", "Impagos", [], ["correo_inquilino"]],
    ["Mandar el requerimiento por burofax", "Impagos", ["poder_rea"], []],
    ["Presentar la demanda de desahucio", "Impagos", [IMPOSIBLE], []],

    /* ---------- SALIDA ---------- */
    ["Preparar el inventario de salida y compararlo con el de entrada", "Salida", [], []],
    ["Calcular la liquidación de la fianza", "Salida", [], ["renta"]],
    ["Avisar de que el mes para devolver la fianza ya corre", "Salida", [], []],
    ["Pedir la devolución del depósito al Instituto Canario de la Vivienda", "Salida", ["alta_terceros", "poder_rea"], []],
    ["Devolver el dinero al inquilino", "Salida", [IMPOSIBLE], []],

    /* ---------- IMPUESTOS ---------- */
    ["Explicar la reducción del alquiler en la declaración de la renta", "Impuestos", [], []],
    ["Avisar del impuesto del propietario que vive fuera", "Impuestos", [], ["vive_fuera"]],
    ["Presentar ese impuesto por el propietario", "Impuestos", [IMPOSIBLE], []],

    /* ---------- COBRO ---------- */
    ["Preparar la factura de honorarios al propietario", "Cobro", [], ["renta"]],
    ["Cobrar la cuota de la inmobiliaria", "Cobro", ["cert_empresa"], []]
  ];

  /* EL GUION: en que orden se hacen, y por que. Mismo formato que el
     GUION de motor.js: paso, tras, tarea, porque, y solo_si cuando la
     tarea depende de que haya pasado algo. */
  var GUION = [
    { paso: "ficha_catastro",    tras: [],                    tarea: "Sacar superficie, año y uso del Catastro",
      porque: "Es lo primero de toda captación" },
    { paso: "lista_papeles",     tras: ["ficha_catastro"],    tarea: "Decir qué papeles hacen falta para alquilar",
      porque: "Con la ficha ya se sabe qué le toca a esta vivienda" },
    { paso: "duracion",          tras: ["lista_papeles"],     tarea: "Avisar de que la duración mínima es de cinco años, o de siete",
      porque: "El propietario tiene que saberlo antes de firmar, no después" },
    { paso: "encargo",           tras: ["lista_papeles"],     tarea: "Redactar la hoja de encargo del alquiler",
      porque: "Es el papel que autoriza a la agencia a alquilar" },
    { paso: "energetico",        tras: ["lista_papeles"],     tarea: "Encargar el certificado energético",
      porque: "Sin él no se puede ni anunciar la vivienda" },
    { paso: "ocupacion",         tras: ["lista_papeles"],     tarea: "Comprobar si hay comunicación de ocupación o de habitabilidad",
      porque: "Sin ella el inquilino no puede dar de alta la luz ni el agua" },
    { paso: "tensionada",        tras: ["lista_papeles"],     tarea: "Comprobar si el municipio está en zona tensionada",
      porque: "Si lo estuviera, la renta tendría tope" },
    { paso: "consent_inq",       tras: ["encargo"],           tarea: "Preparar la hoja de consentimiento del candidato",
      porque: "Antes de pedirle un solo papel al candidato hay que tener su consentimiento" },
    { paso: "solvencia",         tras: ["consent_inq"],       tarea: "Pedir la documentación de solvencia al candidato",
      porque: "Es lo que decide si se le alquila" },
    { paso: "contrato",          tras: ["solvencia"],         tarea: "Redactar el contrato de arrendamiento",
      porque: "Con el candidato ya elegido, toca el papel" },
    { paso: "fianza_calculo",    tras: ["contrato"],          tarea: "Calcular la fianza y la garantía adicional máxima",
      porque: "Pedir de más es ilegal, y pedir de menos deja al propietario sin garantía" },
    { paso: "inventario",        tras: ["contrato"],          tarea: "Preparar el inventario de entrada con fotos",
      porque: "Sin él, la discusión de la fianza al final no tiene prueba" },
    { paso: "aviso_fianza",      tras: ["contrato"],          tarea: "Avisar de que la fianza se deposita en un mes",
      porque: "Es plazo de ley y la multa va del 35 al 100 por ciento de la fianza" },
    { paso: "deposito_fianza",   tras: ["aviso_fianza"],      tarea: "Presentar el depósito de la fianza",
      porque: "Se acaba el mes desde la firma" },
    { paso: "suministros",       tras: ["inventario"],        tarea: "Dar de alta la luz y el agua a nombre del inquilino",
      porque: "El inquilino entra y necesita luz y agua" },
    { paso: "subida_renta",      tras: ["contrato"],          tarea: "Avisar de que toca la subida anual de la renta",
      porque: "Solo se puede subir en la fecha del aniversario, y avisando por escrito",
      solo_si: "cumple_ano" },
    { paso: "preaviso",          tras: ["contrato"],          tarea: "Avisar del preaviso de no renovación antes de que se pase",
      porque: "Si se pasa el plazo, el contrato se prorroga solo",
      solo_si: "cerca_del_fin" },
    { paso: "impago_aviso",      tras: ["contrato"],          tarea: "Mandar el primer aviso de impago",
      porque: "Cuanto antes se avisa, más fácil se arregla sin juzgado",
      solo_si: "impago" },
    { paso: "impago_requerim",   tras: ["impago_aviso"],      tarea: "Preparar el requerimiento fehaciente de pago",
      porque: "Requerir con treinta días de antelación le quita al inquilino la carta de pagar y quedarse",
      solo_si: "impago" },
    { paso: "salida_inventario", tras: ["inventario"],        tarea: "Preparar el inventario de salida y compararlo con el de entrada",
      porque: "Es lo que justifica descontar de la fianza, o no descontar",
      solo_si: "se_va" },
    { paso: "salida_fianza",     tras: ["salida_inventario"], tarea: "Calcular la liquidación de la fianza",
      porque: "Desde la entrega de llaves corre el mes a partir del cual el saldo devenga interés",
      solo_si: "se_va" }
  ];

  /* Las senales que encienden los pasos con solo_si. Se ponen desde
     fuera, igual que "comunidad_vencida" en compraventa. */
  var SENALES = {
    cumple_ano:     "Hoy se cumple un año del contrato, o falta poco",
    cerca_del_fin:  "Falta poco para el plazo de preaviso de no renovación",
    impago:         "Una mensualidad no ha entrado",
    se_va:          "El inquilino ha dicho que se va, o el contrato termina"
  };

  var API = {
    version: "1.0",
    rama: "alquiler",
    IMPOSIBLE: IMPOSIBLE,
    LLAVES: LLAVES, DATOS: DATOS, COMO_DATOS: COMO_DATOS,
    TAREAS: TAREAS, GUION: GUION, SENALES: SENALES
  };

  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_ALQUILER = API;
})(typeof window !== "undefined" ? window : null);
