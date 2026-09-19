/* ============================================================
   orden.js — EL MOTOR DE ORDEN DE IMMO IA
   ------------------------------------------------------------
   Para qué sirve: hay cosas que, si se hacen en el orden
   equivocado, el cliente PIERDE dinero y ya no hay marcha atrás.
   Este motor las revisa TODAS antes de que la IA diga nada.

   Cómo se usa:
       const aviso = IMMOIA_ORDEN.revisar(cliente);
       aviso.bloqueos   -> lo que impide cobrar la deducción
       aviso.urgencias  -> lo que caduca pronto
       aviso.consejos   -> lo que conviene decidir antes
       aviso.orden      -> los pasos, en el orden correcto

   Cada regla lleva su fuente. Ninguna regla se inventa:
   todas salen de la investigación de trámites de septiembre 2026.
   ============================================================ */

(function (global) {
  "use strict";

  var REGLAS = [

    /* ---- BLOQUEOS: si esto pasa, no hay deducción ---- */

    {
      id: "ya_instalado",
      tipo: "bloqueo",
      aplica: function (c) { return c.yaInstalo === true; },
      titulo: "Ya tiene las placas puestas: la deducción del 40 % está perdida",
      porque: "El certificado energético de ANTES tiene que estar expedido antes de " +
              "empezar la obra. Si la instalación ya está hecha, ese certificado ya no " +
              "se puede emitir con fecha anterior.",
      salida: "No se le vende la deducción. Sí se le pueden llevar el IBI, el ICIO y " +
              "la deducción autonómica, que no dependen del certificado previo.",
      fuente: "Ley 35/2006 IRPF, DA 50.ª · requisito de certificado anterior a la obra"
    },

    {
      id: "no_apto",
      tipo: "bloqueo",
      aplica: function (c) { return c.aguaElectrica === false && c.aire === false; },
      titulo: "Esta casa no da derecho al 40 %: la deducción va a cero",
      porque: "El certificado energético solo mide calefacción, aire, agua caliente y " +
              "ventilación. Con el agua de bombona y sin aire, las placas no tienen nada " +
              "eléctrico que compensar, así que el certificado no mejora y no hay deducción.",
      salida: "Un termo eléctrico o un aire acondicionado lo cambian. Un técnico lo simula " +
              "en una hora antes de decidir. Con eso, la casa tipo pasa de 12 años a 5.",
      fuente: "Certificación energética · RD 390/2021, consumos considerados"
    },

    {
      id: "cuota_corta",
      tipo: "bloqueo",
      aplica: function (c) { return typeof c.cuotaIrpf === "number" && c.cuotaIrpf < 1000; },
      titulo: "Su cuota de IRPF no llega: parte del dinero se evapora",
      porque: "En la modalidad del 40 % el exceso NO se traslada a años siguientes. " +
              "Quien tiene una cuota de 900 € se ahorra 900, no 3.000. El único que " +
              "arrastra (4 años) es el 60 % de obra en edificio.",
      salida: "Si la vivienda está a nombre de dos, se reparte la factura y el pago entre " +
              "los dos: el techo de 7.500 € es POR CONTRIBUYENTE y se duplica. " +
              "Pero hay que decidirlo ANTES de emitir la factura.",
      fuente: "Ley 35/2006 IRPF, DA 50.ª · base máxima por contribuyente"
    },

    /* ---- URGENCIAS: esto caduca ---- */

    {
      id: "caduca_deduccion",
      tipo: "urgencia",
      aplica: function (c) { return c.diasHastaFinDeduccion !== null && c.diasHastaFinDeduccion <= 120; },
      titulo: "Quedan pocos días para la deducción estatal de vivienda",
      porque: "Manda la fecha del certificado FINAL, no la de la obra. Obra terminada en " +
              "diciembre con el certificado firmado en enero = deducción perdida, sin arreglo.",
      salida: "Se reserva al técnico del certificado final ANTES de empezar la obra, no " +
              "después. Si no da tiempo, se le dice al cliente y se planifica para la " +
              "siguiente ventana en vez de prometerle algo que no va a cobrar.",
      fuente: "Ley 35/2006 IRPF, DA 50.ª · fecha límite en datos.js (fechas.finDeduccionVivienda)"
    },

    {
      id: "ibi_diciembre",
      tipo: "urgencia",
      aplica: function (c) { return c.mes >= 9; },
      titulo: "El IBI se pide antes del 31 de diciembre y no hay marcha atrás",
      porque: "La bonificación no tiene efecto retroactivo, y el silencio administrativo " +
              "es desestimatorio a los seis meses.",
      salida: "El pico de trabajo del año es de octubre a diciembre. Todo expediente que " +
              "entre en enero pierde un año entero de bonificación.",
      fuente: "Ordenanzas fiscales municipales · plazo de solicitud anual"
    },

    /* ---- CONSEJOS: decisiones que se toman antes ---- */

    {
      id: "dos_titulares",
      tipo: "consejo",
      aplica: function (c) { return c.titulares >= 2; },
      titulo: "Repartid la factura entre los dos titulares",
      porque: "La base máxima de 7.500 € es por contribuyente, no por vivienda.",
      salida: "Factura y pago repartidos entre los dos = el techo se duplica. " +
              "Se decide ANTES de que el instalador emita la factura.",
      fuente: "Ley 35/2006 IRPF, DA 50.ª"
    },

    {
      id: "excedentes_normal",
      tipo: "consejo",
      aplica: function (c) { return c.vacacional === false; },
      titulo: "A esta casa no le ofrecemos la cesión de excedentes",
      porque: "En vivienda normal el excedente vale unos 239 €/año para el propietario, " +
              "así que cederlo le CUESTA dinero: un pago único de 500 € no lo cubre.",
      salida: "La cesión solo crea valor en el vacacional, donde se desperdician entre " +
              "103 y 470 €/año. La página ya oculta la opción cuando no conviene.",
      fuente: "RD 244/2019 art. 14 · cálculo propio sobre precio de excedente publicado"
    },

    {
      id: "plazo_sin_confirmar",
      tipo: "consejo",
      aplica: function (c) { return c.plazoAnos > 10; },
      titulo: "Cuidado con enseñar una cuota a más de 10 años",
      porque: "BBVA dice 15 años en su página de placas y 2-8 en su ficha de producto, " +
              "y se contradice también en la comisión por amortizar antes.",
      salida: "Mientras no esté confirmado por teléfono y por escrito, la pantalla enseña " +
              "el plazo confirmado (10 años, Kutxabank), no el más favorable.",
      fuente: "Páginas de producto de BBVA y Kutxabank · pendiente de confirmación telefónica"
    },

    {
      id: "plazo_ibi_no_es_igual",
      tipo: "urgencia",
      aplica: function (c) { return c.municipio !== null; },
      titulo: "El plazo del IBI no es el 31 de diciembre en todas partes",
      porque: "«Antes del 31 de diciembre» vale de regla general, pero hay ciudades grandes " +
              "donde el plazo se cierra MUCHO antes y quien llega tarde pierde el año entero: " +
              "Malaga cierra el 31 de enero (lo presentado despues cuenta ya para el ano " +
              "siguiente), Sevilla exige pedirlo antes del 1 de marzo del ejercicio en que " +
              "deba surtir efecto, Madrid solo da los cinco anos completos si se pide en el " +
              "MISMO ano en que la instalacion se inscribe en el registro, y Barcelona da tres " +
              "anos si se pide en los 6 primeros meses desde la legalizacion, dos si se pide " +
              "entre 6 y 12 meses, y NADA pasados 12 meses.",
      salida: "Antes de decirle una fecha al cliente se mira la ficha de SU municipio en " +
              "publicar/municipios/. Si su municipio no esta en la ficha, se le dice que hay " +
              "que mirar su ordenanza, no se le da el 31 de diciembre por bueno.",
      fuente: "Ordenanzas fiscales y sedes de Madrid, Barcelona, Valencia, Sevilla y Malaga, consultadas el 18/09/2026"
    },

    {
      id: "icio_antes_de_empezar",
      tipo: "bloqueo",
      aplica: function (c) { return c.municipio !== null && c.obraEmpezada === true; },
      titulo: "La obra ya ha empezado: la bonificacion del ICIO puede estar perdida",
      porque: "El ICIO se devenga al empezar la obra, aunque no se haya pedido licencia. " +
              "Y la bonificacion tiene plazo propio: Barcelona exige pedirla ANTES DEL INICIO " +
              "DE LAS OBRAS y despues la rechaza; Valencia da un mes desde la licencia; " +
              "Madrid da dos meses desde la licencia, la declaracion responsable o la orden " +
              "de ejecucion.",
      salida: "Se comprueba la fecha de la licencia o de la declaracion responsable y se mira " +
              "la ficha del municipio antes de contarle al cliente ese ahorro. Si el plazo ha " +
              "pasado, se le dice: es dinero que ya no esta.",
      fuente: "Ordenanzas fiscales del ICIO de Barcelona (art. 7e.4), Madrid (cap. VI, cod. 9114) y Valencia (HA.CO.30), consultadas el 18/09/2026"
    },

    {
      id: "amortizar_acortando",
      tipo: "consejo",
      aplica: function (c) { return c.conPrestamo === true; },
      titulo: "Al amortizar hay que ACORTAR PLAZO, no bajar cuota",
      porque: "Todo el modelo es «pagas lo mismo que ahora y un día dejas de pagar». " +
              "Si el banco solo deja bajar la cuota, el modelo no funciona.",
      salida: "Kutxabank publica que el cliente elige. Es el único que lo publica: " +
              "con cualquier otro banco hay que exigirlo por escrito antes de firmar.",
      fuente: "Condiciones publicadas de Kutxabank · septiembre 2026"
    }
  ];

  /* El orden correcto de los pasos. Lo que está arriba condiciona a lo de abajo. */
  var ORDEN_TRAMITES = [
    { paso: 1, que: "Certificado energético ANTES de tocar nada",
      ojo: "Sin esto no hay deducción del 40 %. Es irreversible." },
    { paso: 2, que: "Decidir a nombre de quién va la factura",
      ojo: "Si son dos titulares, se duplica el techo de 7.500 €." },
    { paso: 3, que: "Pedir la licencia o comunicación previa y liquidar el ICIO",
      ojo: "La bonificación del ICIO se pide con la licencia, no después. En Barcelona, ANTES de empezar la obra. En Madrid hay 2 meses desde la licencia o la declaración responsable; en València, 1 mes." },
    { paso: 4, que: "Firmar el préstamo, exigiendo poder acortar plazo al amortizar",
      ojo: "Y con la comisión de amortización anticipada por escrito." },
    { paso: 5, que: "Hacer la instalación" },
    { paso: 6, que: "Certificado energético FINAL",
      ojo: "La FECHA de este certificado es la que manda para la deducción." },
    { paso: 7, que: "Solicitar la bonificación del IBI",
      ojo: "Antes del 31 de diciembre COMO REGLA GENERAL, pero mira la ficha de su municipio: Málaga cierra el 31 de enero, Sevilla el 1 de marzo, Barcelona cuenta 6 y 12 meses desde la legalización. No es retroactiva." },
    { paso: 8, que: "Declarar la deducción en la renta del ejercicio correspondiente" }
  ];

  function revisar(cliente) {
    var c = cliente || {};
    // valores por defecto prudentes: si no sabemos algo, la regla no salta
    var ctx = {
      yaInstalo:            c.yaInstalo === true,
      aguaElectrica:        c.aguaElectrica === true ? true : (c.aguaElectrica === false ? false : null),
      aire:                 c.aire === true ? true : (c.aire === false ? false : null),
      cuotaIrpf:            typeof c.cuotaIrpf === "number" ? c.cuotaIrpf : null,
      titulares:            typeof c.titulares === "number" ? c.titulares : 1,
      vacacional:           c.vacacional === true ? true : (c.vacacional === false ? false : null),
      plazoAnos:            typeof c.plazoAnos === "number" ? c.plazoAnos : 0,
      conPrestamo:          c.conPrestamo === true,
      municipio:            (typeof c.municipio === "string" && c.municipio) ? c.municipio : null,
      obraEmpezada:         c.obraEmpezada === true,
      mes:                  typeof c.mes === "number" ? c.mes : (new Date().getMonth() + 1),
      diasHastaFinDeduccion: typeof c.diasHastaFinDeduccion === "number" ? c.diasHastaFinDeduccion : null
    };

    var out = { bloqueos: [], urgencias: [], consejos: [], orden: ORDEN_TRAMITES, revisadas: 0 };

    REGLAS.forEach(function (r) {
      out.revisadas++;
      var salta = false;
      try { salta = r.aplica(ctx) === true; } catch (e) { salta = false; }
      if (!salta) return;
      var aviso = { id: r.id, titulo: r.titulo, porque: r.porque, salida: r.salida, fuente: r.fuente };
      if (r.tipo === "bloqueo")  out.bloqueos.push(aviso);
      if (r.tipo === "urgencia") out.urgencias.push(aviso);
      if (r.tipo === "consejo")  out.consejos.push(aviso);
    });

    // Lo que la IA debe decir PRIMERO, si hay algo que decir.
    out.loPrimero = out.bloqueos[0] || out.urgencias[0] || null;
    out.hayQueAvisar = out.bloqueos.length > 0 || out.urgencias.length > 0;
    return out;
  }

  global.IMMOIA_ORDEN = { version: "1.1", revisado: "2026-09-18", revisar: revisar, reglas: REGLAS, orden: ORDEN_TRAMITES };

})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) module.exports = (typeof window !== "undefined" ? window : globalThis).IMMOIA_ORDEN;
