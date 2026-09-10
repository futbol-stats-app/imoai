/* =============================================================
   IMMO IA · DATOS.JS — el único sitio donde se tocan los números
   =============================================================
   Versión: 1.0 · 10 de septiembre de 2026

   QUÉ ES ESTO
   Todas las cifras, los municipios y las ayudas de la web viven aquí.
   Antes estaban copiadas en tres calculadoras distintas: cambiar el
   precio de la luz eran tres ediciones iguales, y si una se quedaba
   sin hacer, la web enseñaba dos precios según por dónde entrase el
   cliente. Ahora se cambia AQUÍ y cambia en toda la web.

   CÓMO SE USA
   Se carga antes que la página:
       <script src="datos.js?v=1"></script>
   Y cada página lo lee así, quedándose con sus valores de siempre
   si este archivo no cargara:
       var D = (window.DATOS_IMMOIA || {});
       var EUR_PANEL = (D.numeros && D.numeros.eurPorPanel) || 687;

   REGLA DE LA CASA
   Solo cifras publicadas. Lo que no está publicado se marca
   "no publicada" y NO se inventa.
   ============================================================= */
(function(){
"use strict";

window.DATOS_IMMOIA = {

  version: "1.0",
  revisado: "2026-09-10",

  /* -----------------------------------------------------------
     1 · LOS NÚMEROS DE LA INSTALACIÓN Y DEL PRÉSTAMO
     ----------------------------------------------------------- */
  numeros: {
    /* 5.500 € la instalación estándar de 8 paneles = 687,50 €/panel.
       Precio negociado con instalador (INSTRUCCIONES_FINALES_CLOUD.md).
       ⚠️ Pendiente de presupuesto por escrito: ningún instalador de
       Tenerife publica precio. Rango publicado: 4.500-8.500 €. */
    eurPorPanel: 687.5,
    precioEstandar8: 5500,

    /* Lo que le negociamos al instalador por volumen y le pasamos AL CLIENTE.
       El techo real es lo que el instalador se ahorra en captacion: el CAC
       publicado del sector son 150-400 € por instalacion vendida, mas el tiempo
       de su comercial. Se pide 500 y se acepta 300.
       ⚠️ Pendiente de cerrarlo por escrito con el instalador. */
    descuentoInstalador: 500,

    kwpPorPanel: 0.45,
    kwhPorKwp: 1700,          /* estimación Tenerife, no dato publicado */
    autoconsumo: 0.35,        /* parte de lo que produce que se aprovecha en casa */
    precioLuz: 0.19,          /* €/kWh de compra · rango 0,16-0,22 */
    precioExcedente: 0.06,    /* €/kWh de venta en mercado · PPA en tejado 0,045 */
    costeCertificados: 200,   /* los dos, antes y después · 60-130 € cada uno */
    icio: 150,

    /* Préstamo. Se trabaja con 6,25 % por prudencia: es peor que la mejor
       oferta publicada, así que la oferta real solo puede mejorar. */
    tae: 0.0625,
    plazoAnos: 10,
    mejorTaePublicada: 0.0491,
    mejorTaeQuien: "BBVA, pagina de placas solares · 4,80 % TIN / 4,91 % TAE · 3.000-75.000 € · "
                 + "de 12 meses a 15 anos · SIN comision de apertura NI de cancelacion · "
                 + "oferta valida hasta el 30/09/2026. "
                 + "(Su propia ficha de prestamo dice 2-8 anos: hay contradiccion dentro de la "
                 + "web de BBVA, confirmar por telefono.) "
                 + "Segunda: Kutxabank 5,50 % TIN / 5,64 % TAE, hasta 10 anos.",

    /* Lo de "que pague lo mismo que ahora" NO necesita un producto especial del banco:
       necesita un prestamo con PLAZO LIBRE y SIN comision de cancelacion, y elegir el
       plazo para que la cuota salga igual al ahorro. BBVA publica las dos cosas.
       En el mercado se vende como "financiacion a coste cero" o "la cuota se cubre con
       el ahorro"; el nombre tecnico internacional es on-bill financing / Pay As You Save.
       Ya lo hace 1KOMMA5 con Sabadell Consumer y BBVA, hasta 144 meses y sin entrada. */

    /* consumo estimado de un vacacional, por día */
    kwhDiaOcupado: 10,
    kwhDiaVacio: 1.2,

    /* cuánto de la factura es energía y no términos fijos ni impuestos */
    parteEnergiaFactura: 0.70
  },

  /* -----------------------------------------------------------
     2 · LAS FECHAS QUE MANDAN
     ----------------------------------------------------------- */
  fechas: {
    finDeduccionVivienda: "2026-12-31",   /* deducción estatal 10 % / 40 %, vivienda individual */
    finDeduccionEdificio: "2027-12-31",   /* deducción estatal 60 %, edificio completo */
    nota: "RDL 7/2026, convalidado el 27 de marzo de 2026"
  },

  /* -----------------------------------------------------------
     3 · LA DEDUCCIÓN ESTATAL DEL IRPF
     ----------------------------------------------------------- */
  irpfEstatal: {
    /* Las tres modalidades reales (AEAT, manual practico IRPF 2025, consultado 10/09/2026).
       CORREGIDO el 10/09/2026: antes aqui ponia 10 %, y no existe tal cosa. */
    demanda:         { pct: 0.20, base: 5000,  requisito: "bajar un 7 % la demanda de calefaccion y refrigeracion" },
    conCertificados: { pct: 0.40, base: 7500,  requisito: "bajar un 30 % el consumo de energia primaria no renovable, O llegar a letra A o B" },
    edificio:        { pct: 0.60, base: 5000,  acumulado: 15000, arrastra: 4 },

    /* En la del 20 % y la del 40 % el exceso NO se traslada: si la cuota no llega, se
       PIERDE. Solo la del 60 % (edificio entero) se arrastra 4 ejercicios. */
    arrastraEl40: false,
    soloVivienda: "habitual o arrendada para su uso como vivienda",

    /* 🔴 LO QUE MAS SE MALENTIENDE, y esta comprobado:
       Hacienda no paga por poner placas. Paga por el RESULTADO que sale de comparar los
       dos certificados. Y el certificado de una vivienda solo mide calefaccion,
       refrigeracion, agua caliente y ventilacion: no mide nevera, lavadora ni luces.
       Asi que las placas solo puntuan si la casa usa ELECTRICIDAD para esos servicios.
       En una casa canaria sin calefaccion y con el agua caliente de butano, las placas
       casi no mueven la letra y NO hay 40 %.
       Y el 20 % tampoco vale de consuelo: exige bajar la DEMANDA, y la fotovoltaica
       baja el consumo, no la demanda. Ninguna fuente oficial lo respalda.
       => La regla de la casa: no prometer deduccion sin simulacion previa del tecnico. */
    decideElResultado: true,
    finObras: "2026-12-31",
    ojoCertificadoFinal: "La deduccion va al ejercicio en que se EXPIDE el certificado "
                       + "posterior. Obra acabada en diciembre de 2026 con certificado "
                       + "firmado en enero de 2027 = deduccion perdida.",
    ojoCertificadoPrevio: "El certificado de ANTES tiene que estar expedido ANTES de "
                        + "empezar la obra, y como mucho 2 anos antes. A quien ya instalo "
                        + "no se le puede vender el 40 %."
  },

  /* -----------------------------------------------------------
     3 bis · COMO SE MUEVEN LOS PAPELES
     -----------------------------------------------------------
     De la investigacion de los 7 tramites, 10/09/2026.
     Esto es lo que la IA tiene que saber para decir "nosotros lo hacemos todo".
     ----------------------------------------------------------- */
  tramites: {
    irpf: {
      donde: "AEAT, en la declaracion de la renta del ano siguiente",
      como: "Renta WEB > Deducciones generales de la cuota > obras de mejora de la "
          + "eficiencia energetica > modalidad del 40 %",
      apoderamiento: "SI. Codigo 100P (modelo 100) o GENERALLEY58 en el Registro de "
                   + "Apoderamientos de la AEAT. El apoderado puede ser persona juridica. "
                   + "Dura 5 anos y se da de alta por internet con Cl@ve o certificado. "
                   + "OJO: el formulario presencial no incluye el modelo 100.",
      coste: 0,
      truco: "La base de 7.500 € es POR CONTRIBUYENTE. Si la casa esta a nombre de dos, "
           + "repartir factura y pago entre los dos duplica el techo. Se decide ANTES de "
           + "emitir la factura."
    },
    ibi: {
      donde: "El ayuntamiento. En Tenerife, el Consorcio de Tributos gestiona 28 municipios",
      como: "Es rogada: hay que pedirla. Es un descuento en el recibo del ano siguiente, "
          + "no una devolucion",
      apoderamiento: "SI, y sin notario. El Consorcio de Tributos tiene sus propios "
                   + "formularios: 004 (acreditacion), 006 (apud acta presencial), "
                   + "008 (apud acta electronico). Una sola firma cubre 28 municipios. "
                   + "Santa Cruz va aparte (admite apud acta en su tramite t238).",
      plazo: "🔴 HASTA EL 31 DE DICIEMBRE del ano anterior, sin efecto retroactivo "
           + "(Ordenanza Fiscal General del Consorcio, art. 32.1). Unica ventana de "
           + "rescate: art. 32.2, solo el primer ejercicio y hasta el fin del pago voluntario",
      silencio: "Desestimatorio a los 6 meses. Un expediente sin vigilar se muere solo",
      coste: 0
    },
    icio: {
      donde: "El ayuntamiento. El Consorcio de Tributos NO gestiona el ICIO",
      como: "Con la autoliquidacion, dentro del mes siguiente al inicio de la obra",
      apoderamiento: "Hacen falta DOS apoderamientos por cliente: el del ayuntamiento y "
                   + "el de la Gerencia de Urbanismo, que es otra sede (Santa Cruz y La Laguna)",
      cuantoEs: "Poco: unos 89 € en Santa Cruz y 196 € en La Laguna sobre 5.500 €. "
              + "No sirve de gancho comercial, va dentro del paquete",
      ojo: "La comunicacion previa exige 15 dias habiles antes de empezar la obra"
    },
    certificados: {
      donde: "Un tecnico competente los firma; se registran en el registro de la comunidad",
      canarias: "Registro gratis, 100 % electronico, y se puede hacer como persona "
              + "autorizada por el titular (basta autorizacion firmada, sin apud acta)",
      ojo: "Registrar en 72 horas: la AEAT esta denegando deducciones por registrar "
         + "pasado un mes desde la emision",
      coste: "Precio libre, no publicado. Rango de mercado en Tenerife para 100-150 m2: "
           + "unos 160-260 € los dos"
    },
    subvencion: {
      estado: "Hoy solo Pais Vasco, hasta el 30/09/2026",
      ojo: "🔴 Se solicita ANTES de firmar nada con el instalador: las bases prohiben "
         + "proyectos ya iniciados. Presupuestos, pedidos y facturas deben ser posteriores "
         + "a la solicitud",
      fiscalidad: "La subvencion cobrada SE RESTA de la base de la deduccion del IRPF "
                + "(DA 50a LIRPF) y ademas tributa como ganancia patrimonial",
      alerta: "La BDNS (infosubvenciones.es) tiene API publica en JSON, sin autenticacion. "
            + "Toda convocatoria de cualquier administracion se publica ahi: el aviso el "
            + "dia 1 es automatizable"
    },
    prestamo: {
      apoderamiento: "NO. El prestamo lo firma el cliente. Y ojo: rellenarle la solicitud "
                   + "es 'trabajos preparatorios' y eso es intermediacion de credito "
                   + "(Ley 2/2009): registro y seguro de 300.000 €. La salida es el canal "
                   + "de punto de venta, donde tramita la financiera y nosotros somos el comercio",
      critico: "Antes que el tipo de interes: que el contrato deje ELEGIR entre bajar cuota "
             + "o ACORTAR PLAZO al amortizar. Si impone bajar cuota, nuestro modelo se cae. "
             + "Ni BBVA ni Kutxabank publican cual aplican"
    }
  },

  /* -----------------------------------------------------------
     4 · LAS 17 COMUNIDADES
     -----------------------------------------------------------
     Fuente: INVESTIGACION_CCAA/AYUDAS_POR_COMUNIDAD.md, 10/09/2026.
     Todas las deducciones autonómicas están contrastadas con la AEAT.

     subvencion.estado: "abierta" | "cerrada" | "reabre" | "sinVerificar"
     deduccion.pct:     % de lo pagado
     deduccion.base:    base máxima anual en €
     deduccion.tope:    tope de la deducción en € (0 = sin tope propio)
     foral:             true = tiene IRPF propio y NO aplica el estatal
     ----------------------------------------------------------- */
  comunidades: {
    an: { nombre:"Andalucía",
          subvencion:{ estado:"cerrada", importe:0, nota:"El programa Next Generation cerró el 31/12/2023." },
          deduccion:null, foral:false },

    ar: { nombre:"Aragón",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, foral:false },

    as: { nombre:"Asturias",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, foral:false },

    ib: { nombre:"Baleares",
          subvencion:{ estado:"reabre", importe:600, unidad:"€/kWp", desde:"2027-01-26",
                       nota:"Vuelve a abrir el 26 de enero de 2027." },
          deduccion:{ pct:0.50, base:10000, tope:5000,
                      nota:"Hay que subir al menos un nivel la calificación energética. Límite de base imponible: 33.000 € individual / 52.800 € conjunta." },
          foral:false },

    cn: { nombre:"Canarias",
          subvencion:{ estado:"cerrada", importe:0, nota:"Las dos convocatorias cerraron en junio y agosto de 2026." },
          deduccion:{ pct:0.12, base:7000, tope:840,
                      nota:"Vivienda habitual en propiedad, pago nunca en efectivo y los dos certificados. Además no puede pasar del 10 % de la cuota autonómica." },
          foral:false },

    ct: { nombre:"Cantabria",
          subvencion:{ estado:"sinVerificar", importe:0, nota:"No verificada." },
          deduccion:{ pct:0.15, base:1000, tope:150,
                      nota:"Pequeña: como mucho 150 €. Lo no deducido se puede aplicar dos años más." },
          foral:false },

    cm: { nombre:"Castilla-La Mancha",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, foral:false },

    cl: { nombre:"Castilla y León",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, foral:false },

    ca: { nombre:"Cataluña",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, foral:false },

    vc: { nombre:"Comunidad Valenciana",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:{ pct:0.40, base:8800, tope:0,
                      nota:"40 % si es la vivienda habitual, 20 % si es segunda. La instalación tiene que estar inscrita en el registro autonómico. Lo no deducido se aplica los cuatro años siguientes." },
          foral:false },

    ex: { nombre:"Extremadura",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, foral:false },

    ga: { nombre:"Galicia",
          subvencion:{ estado:"cerrada", importe:0, nota:"Cerró el 01/12/2025. Era de 4.000 €." },
          deduccion:null, foral:false },

    ma: { nombre:"Madrid",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, foral:false },

    mu: { nombre:"Murcia",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:{ pct:0.50, base:0, tope:7000,
                      nota:"La mejor de España. El 50 % es para bases imponibles de hasta 34.999 € (49.999 en conjunta); por encima baja a 37,5 % y 25 %, y desde 60.000 € no hay derecho. Autoconsumo exclusivo y pago nunca en efectivo." },
          foral:false },

    na: { nombre:"Navarra",
          subvencion:{ estado:"sinVerificar", importe:0, nota:"No localizada." },
          deduccion:{ pct:0.15, base:0, tope:0,
                      nota:"Hasta el 30 % con almacenamiento, autoconsumo compartido o comunidades energéticas. Hace falta informe previo del Gobierno de Navarra. ⚠️ Los porcentajes vienen de una fuente NO oficial: confirmar con Hacienda Foral." },
          foral:true },

    pv: { nombre:"País Vasco",
          subvencion:{ estado:"abierta", importe:600, unidad:"€/kW", hasta:"2026-09-30",
                       nota:"La única abierta en España. Hasta el 30/09/2026 a las 12:00 y con el presupuesto a punto de agotarse." },
          deduccion:{ pct:0.15, base:20000, tope:0,
                      nota:"En los tres territorios. Y algo que no pasa en el resto de España: la fotovoltaica da derecho por sí sola, con el certificado de instalación eléctrica y SIN los certificados energéticos." },
          foral:true },

    ri: { nombre:"La Rioja",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, foral:false }
  },

  /* -----------------------------------------------------------
     5 · LOS MUNICIPIOS DE TENERIFE (IBI e ICIO)
     -----------------------------------------------------------
     El IBI y el ICIO NO son autonómicos: los pone cada ayuntamiento.
     [porcentaje, años, tope anual (0 = sin tope), aviso, nombre, soloViviendaHabitual]
     ----------------------------------------------------------- */
  municipios: {
    gu:  [0.50, 25, 0,   "", "Güímar", false],
    ro:  [0.50, 10, 0,   "", "El Rosario", false],
    sc:  [0.50,  5, 0,   "Hay que pedirlo antes del 1 de enero, o se pierde el primer año.", "Santa Cruz de Tenerife", false],
    ll:  [0.50,  5, 0,   "Piden estar al corriente de pagos y tener el IBI domiciliado.", "San Cristóbal de La Laguna", false],
    re:  [0.50,  5, 0,   "", "Los Realejos", false],
    pc:  [0.50,  5, 0,   "", "Puerto de la Cruz", false],
    ta:  [0.50,  5, 300, "Tope de 300 € al año. Los paneles tienen que dar al menos el 30 % de la potencia contratada.", "Tacoronte", false],
    ca:  [0.30,  5, 0,   "Hay que pedirlo antes del 30 de noviembre del año anterior.", "Candelaria", false],
    gr:  [0.25,  5, 0,   "Solo vivienda habitual, con empadronamiento y contrato de mantenimiento.", "Granadilla de Abona", true],
    st:  [0.20,  3, 0,   "SIN CONFIRMAR que cubra fotovoltaica: la ordenanza publicada habla de solar térmica. Llamar al ayuntamiento.", "Santiago del Teide", false],
    sm:  [0,     0, 0,   "El ayuntamiento anunció un 50 % en 2022, pero no están publicados los años ni los requisitos. Aquí va a cero hasta confirmarlo.", "San Miguel de Abona", false],
    ar:  [0,     0, 0,   "Arona no tiene bonificación de IBI ni de ICIO por placas solares.", "Arona", false],
    ad:  [0,     0, 0,   "Adeje no la tiene publicada. Hay que llamar al 922 756 200 antes de prometer nada.", "Adeje", false],
    otro:[0,     0, 0,   "En tu municipio no consta bonificación publicada. Se puede consultar en el Consorcio de Tributos: 922 20 82 00.", "otro municipio de Tenerife", false]
  },

  /* cómo llama la gente a los sitios, para entender lo que dice por voz */
  comoLoDicen: {
    gu:["guimar"], ro:["el rosario","rosario"],
    sc:["santa cruz","santacruz","la capital"],
    ll:["la laguna","laguna","san cristobal"],
    re:["los realejos","realejos"], pc:["puerto de la cruz","el puerto"],
    ta:["tacoronte"], ca:["candelaria"],
    gr:["granadilla","el medano","medano"], st:["santiago del teide","santiago"],
    sm:["san miguel","las chafiras","chafiras"],
    ar:["arona","los cristianos","las americas","playa de las americas","cabo blanco","buzanada"],
    ad:["adeje","costa adeje","fanabe","la caleta"]
  },

  /* -----------------------------------------------------------
     6 · CONTACTO
     ----------------------------------------------------------- */
  contacto: {
    correo: "immoai.contacto@gmail.com",
    whatsapp: ""      /* ← EL NÚMERO. Da igual el formato: "+34 600 11 12 22" vale */
  },

  /* -----------------------------------------------------------
     7 · CUENTAS (para que las tres calculadoras cuenten igual)
     ----------------------------------------------------------- */
  cuota: function(principal, tae, anos){
    if(principal <= 0 || anos <= 0) return 0;
    var i = tae / 12, m = anos * 12;
    return principal * i / (1 - Math.pow(1 + i, -m));
  },

  /* Deducción autonómica de una comunidad sobre un gasto dado */
  deduccionAutonomica: function(clave, gasto){
    var c = this.comunidades[clave];
    if(!c || !c.deduccion) return 0;
    var d = c.deduccion;
    var base = d.base > 0 ? Math.min(gasto, d.base) : gasto;
    var importe = base * d.pct;
    if(d.tope > 0 && importe > d.tope) importe = d.tope;
    return importe;
  },

  /* Deducción estatal. OJO: en territorio foral (Navarra, País Vasco) no aplica. */
  deduccionEstatal: function(clave, gasto, conCertificados){
    var c = this.comunidades[clave];
    if(c && c.foral) return 0;
    var t = conCertificados ? this.irpfEstatal.conCertificados : this.irpfEstatal.simple;
    return Math.min(gasto, t.base) * t.pct;
  },

  /* Días que quedan hasta que se acabe la deducción de vivienda */
  diasParaElPlazo: function(){
    var f = this.fechas.finDeduccionVivienda.split("-");
    var fin = new Date(Number(f[0]), Number(f[1]) - 1, Number(f[2]));
    return Math.ceil((fin - new Date()) / 86400000);
  }
};

})();
