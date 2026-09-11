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

  version: "1.3",
  revisado: "2026-09-11",

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

    /* PLAZO. Cambiado de 10 a 15 anos el 11/09/2026 por CORREGIR_PLAZO.md
       (Jarvis e Ivan). El motivo es bueno: a 15 anos la cuota del ano 1 sale
       ~47 €/mes en vez de ~62 €, y desde el ano 2 el cliente paga MENOS que su
       factura de hoy, que es justo la oferta.
       ⚠️ LO QUE CUESTA, y hay que decirlo: a 6,25 % y 5.500 €, 10 anos son
       ~1.910 € de intereses y 15 anos ~2.989 €. Alargar el plazo son ~1.080 €
       mas de intereses a cambio de ~15 €/mes menos de cuota.
       ⚠️ Y QUIEN DA 15 ANOS: solo la pagina de placas de BBVA (12 meses-15 anos).
       Su propia ficha de "Prestamo Eficiencia Energetica" dice 2-8 anos. El fijo
       de Kutxabank se queda en 10. O sea: el plazo de 15 depende de una pagina
       que la propia web del banco contradice. CONFIRMAR POR TELEFONO antes de
       ensenarle a nadie la cuota de 15 anos. */
    plazoAnos: 10,   /* 11/09/2026: se pone el CONFIRMADO (Kutxabank, 10 anos). Los 15 solo los dice una pagina de BBVA y su propia ficha dice 2-8. En cuanto lo confirmen por telefono y por escrito, aqui se pone 15 y listo. */
    plazosDisponibles: [10, 12, 15],   /* 20 anos NO: ningun banco lo publica para esto */
    mejorTaePublicada: 0.0491,   /* revisado 11/09/2026: sin cambios */
    mejorTaeQuien: "BBVA, pagina de placas solares · 4,80 % TIN / 4,91 % TAE · 3.000-75.000 € · "
                 + "de 12 meses a 15 anos · SIN comision de apertura NI de cancelacion · "
                 + "oferta valida hasta el 30/09/2026. "
                 + "(Su propia ficha de prestamo dice 2-8 anos: hay contradiccion dentro de la "
                 + "web de BBVA, confirmar por telefono.) "
                 + "Segunda: Kutxabank 5,50 % TIN / 5,64 % TAE, hasta 10 anos. "
                 + "[Revisado 11/09/2026: los dos tipos siguen publicados igual. Quedan 19 dias "
                 + "de la oferta de BBVA.]",

    /* Revision del 11/09/2026 · lo nuevo, y las dos cosas importan:
       1) RESUELTO lo que estaba en 'tramites.prestamo.critico': KUTXABANK SI PUBLICA
          que el cliente elige entre acortar plazo o bajar cuota al amortizar
          (clientes.kutxabank.es/es/prestamos/eficiencia-energetica.html, 11/09/2026).
          Es el unico que lo publica. Nuestro modelo necesita ACORTAR PLAZO.
       2) CONTRADICCION NUEVA EN BBVA: su pagina de placas dice "sin comision de
          cancelacion", pero su ficha de Prestamo Eficiencia Energetica publica
          0,50 % (si quedan menos de 12 meses) / 1 % (si quedan mas) de amortizacion
          anticipada. Sobre 5.500 € es poco dinero, pero decide si el modelo funciona:
          hay que exigir POR ESCRITO cual de las dos fichas aplica.
       Santander (4,32 % TAE) y Bankinter (4,54 %) publican TAE mas baja, pero son el
       minimo de un rango que llega al 11-13 % y dependen del perfil: no son tipo
       garantizado. Y Bankinter limita a 60 meses justo el tramo de 4.000-8.000 €. */
    ojoAmortizacion: "Kutxabank publica que se puede elegir acortar plazo. BBVA se "
                   + "contradice en la comision de amortizacion anticipada (0 % vs 0,50-1 %).",

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
    parteEnergiaFactura: 0.70,

    /* Lo que se cobra por llevar los papeles, segun la opcion que elija el cliente
       (TRES_OPCIONES_SERVICIO.md, Jarvis e Ivan, 10/09/2026).
       Opcion 1 "hazmelo todo": gestion gratis y el excedente es de IMMO IA.
       Opcion 2 "buscame instalador y llevame los papeles": 200 € y el excedente es suyo.
       Opcion 3 "solo los papeles": 200 € y el excedente es suyo.
       ⚠️ 200 € es el precio que fijaron ellos, no un precio de mercado publicado. */
    precioGestion: 200
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
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Andalucía no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT y en la Ley 5/2021 de Tributos Cedidos (arts. 9 a 22 quater). Sí se aplica la deducción estatal del 40 %." }, foral:false },

    ar: { nombre:"Aragón",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Aragón no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT y en el Decreto Legislativo 1/2005 (arts. 110-2 a 110-22). Sí se aplica la estatal del 40 %." }, foral:false },

    as: { nombre:"Asturias",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Asturias no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT: sus 27 deducciones son de familia, alquiler, despoblamiento y similares. Sí se aplica la estatal del 40 %." }, foral:false },

    ib: { nombre:"Baleares",
          subvencion:{ estado:"cerrada", importe:0, unidad:"€/kWp",
                       nota:"🔴 CORREGIDO el 11/09/2026. Antes aquí ponía «reabre el 26/01/2027», y ESA FECHA NO ESTÁ PUBLICADA: es la fecha en que abrió la convocatoria de 2026 (FOTOPAR2026, cerrada el 30/04/2026), no un anuncio del Govern. La convocatoria de 2027 no está publicada. Baleares sí tiene abierta otra ayuda (FACTOR 2026, del 09/07/2026 al 28/02/2027), pero NO cubre fotovoltaica para particulares: solo baterías, aerotermia y recarga. La deducción del 50 % del IRPF sí sigue en pie." },
          deduccion:{ pct:0.50, base:10000, tope:5000,
                      nota:"Hay que subir al menos un nivel la calificación energética. Límite de base imponible: 33.000 € individual / 52.800 € conjunta." },
          foral:false },

    cn: { nombre:"Canarias",
          subvencion:{ estado:"cerrada", importe:0, nota:"Las dos convocatorias cerraron en junio y agosto de 2026. Revisado el 11/09/2026: NO hay convocatoria autonómica nueva en el BOC. ⚠️ Pero sí las hay INSULARES en otras islas (Cabildo de Lanzarote, BOP Las Palmas nº 99 de 19/08/2026, abierta hasta ~21/09/2026; y Consejo Insular de la Energía de Gran Canaria). Los cabildos convocan por su cuenta: falta mirar si el Cabildo de Tenerife tiene o prepara la suya. Aquí no se pone ningún importe hasta verlo publicado." },
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
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Castilla-La Mancha no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT (sus 27 deducciones son de familia, guardería, alquiler y zonas rurales). Sí se aplica la estatal del 40 %." }, foral:false },

    cl: { nombre:"Castilla y León",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, deduccionCondicionada:{ pct:0.15, base:20000, tope:3000, fecha:"2026-09-11", nota:"OJO: Castilla y León tiene una deducción del 15 % (base 20.000 €, hasta 3.000 €) por rehabilitación, PERO solo si la obra ha recibido subvención de la Dirección General de Vivienda. Quien paga las placas de su bolsillo NO deduce nada, así que esta cifra NO se suma sola en la cuenta: hay que preguntarle primero si le subvencionaron la obra. Además la Junta avisa de que los paneles entraban por el Plan Estatal 2018-2021 y que en el de 2022-2025 solo entran las adaptaciones por discapacidad. Confirmar antes de contar con ella. Arts. 7.2 y 10 del Decreto Legislativo 1/2013. Revisado el 11/09/2026." }, foral:false },

    ca: { nombre:"Cataluña",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Cataluña no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT: sus deducciones de vivienda son de alquiler y rehabilitación para alquilar. Sí se aplica la estatal del 40 %." }, foral:false },

    vc: { nombre:"Comunidad Valenciana",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:{ pct:0.40, base:8800, tope:0,
                      nota:"40 % si es la vivienda habitual, 20 % si es segunda. La instalación tiene que estar inscrita en el registro autonómico. Lo no deducido se aplica los cuatro años siguientes." },
          foral:false },

    ex: { nombre:"Extremadura",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Extremadura no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT y en el Decreto Legislativo 1/2018. Sí se aplica la estatal del 40 %." }, foral:false },

    ga: { nombre:"Galicia",
          subvencion:{ estado:"cerrada", importe:0, nota:"Cerró el 01/12/2025. Era de 4.000 €." },
          deduccion:{ pct:0.15, base:9000, tope:1350,
                      nota:"Obras de mejora de eficiencia energética: 15 % con base de 9.000 € (hasta 1.350 €). Además, el 100 % de lo que cueste el certificado energético, con tope de 150 €. Hace falta certificado de antes y de después. La puede pedir el propietario —vivienda habitual, segunda, alquilada o vacía—, pero NO el usufructuario ni el inquilino, ni los inmuebles afectos a una actividad. Art. 5.Dieciocho del Decreto Legislativo 1/2011 de Galicia. Revisado el 11/09/2026." },
          foral:false },

    ma: { nombre:"Madrid",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Madrid no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT: sus 24 deducciones son de familia, vivienda habitual, despoblación, estudios e inversión. Sí se aplica la estatal del 40 %." }, foral:false },

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
                       nota:"La única abierta en España, hasta el 30/09/2026. 🔴 REVISADO 11/09/2026: el propio EVE avisa en su web de que el presupuesto está próximo a agotarse, y la prensa del sector daba más de 7.000 solicitudes el 07/09/2026 sobre 80 M€. NO se le promete el dinero a nadie: se dice que está abierta y que el presupuesto puede acabarse antes de la fecha. El EVE ha anunciado otra convocatoria para las próximas semanas, pero AÚN NO ESTÁ PUBLICADA." },
          deduccion:{ pct:0.15, base:20000, tope:0,
                      nota:"En los tres territorios. Y algo que no pasa en el resto de España: la fotovoltaica da derecho por sí sola, con el certificado de instalación eléctrica y SIN los certificados energéticos." },
          foral:true },

    ri: { nombre:"La Rioja",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"La Rioja no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT. OJO con una confusión habitual: su deducción por rehabilitación de vivienda habitual es un régimen transitorio de obras anteriores a 2013 y no tiene nada que ver con la energía. Sí se aplica la estatal del 40 %." }, foral:false }
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
    sc:  [0.50,  5, 0,   "Hay que pedirlo antes del 1 de enero, o se pierde el primer año. Novedad confirmada el 11/09/2026: desde el 01/01/2026 la bonificación ya no es solo solar, cubre todas las energías de ambiente (eólica, hidráulica, biomasa).", "Santa Cruz de Tenerife", false],
    ll:  [0.50,  5, 0,   "Piden estar al corriente de pagos y tener el IBI domiciliado.", "San Cristóbal de La Laguna", false],
    re:  [0.50,  5, 0,   "", "Los Realejos", false],
    pc:  [0.50,  5, 0,   "", "Puerto de la Cruz", false],
    ta:  [0.50,  5, 300, "Tope de 300 € al año. Los paneles tienen que dar al menos el 30 % de la potencia contratada. ⚠️ 11/09/2026: el tope de 300 € NO se ha podido verificar en la ordenanza publicada. Se deja porque es el dato más prudente (si no hubiera tope, saldría más a favor del cliente), pero confirmarlo antes de usarlo en una oferta.", "Tacoronte", false],
    ca:  [0.30,  5, 0,   "Hay que pedirlo antes del 30 de noviembre del año anterior.", "Candelaria", false],
    gr:  [0.25,  5, 0,   "Solo vivienda habitual, con empadronamiento y contrato de mantenimiento.", "Granadilla de Abona", true],
    st:  [0.20,  3, 0,   "SIN CONFIRMAR que cubra fotovoltaica: la ordenanza publicada habla de solar térmica. Llamar al ayuntamiento.", "Santiago del Teide", false],
    sm:  [0,     0, 0,   "El ayuntamiento anunció un 50 % en 2022. Revisado el 11/09/2026: la ordenanza del IBI consta modificada y en vigor desde el 30/05/2024 (BOP Santa Cruz nº 65, 29/05/2024), pero la sede solo enlaza el PDF del boletín y los años, los requisitos y el tope SIGUEN SIN PUBLICARSE de forma accesible. Aquí va a cero hasta confirmarlo por teléfono.", "San Miguel de Abona", false],
    ar:  [0,     0, 0,   "Arona no tiene bonificación de IBI ni de ICIO por placas solares.", "Arona", false],
    ad:  [0,     0, 0,   "COMPROBADO el 11/09/2026 en las ordenanzas del propio ayuntamiento: Adeje NO tiene bonificación de IBI por placas solares. Su ordenanza del IBI para 2026 es la misma de 2025 y solo bonifica urbanización/construcción, VPO y familia numerosa. Ya no hace falta llamar para esto.", "Adeje", false],
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
    /* 🔴 ARREGLADO el 11/09/2026. Aqui ponia this.irpfEstatal.simple, y esa clave
       NO EXISTE en este archivo: cualquier llamada sin certificados petaba la
       calculadora entera ("no se puede leer .base de undefined").
       Y el valor correcto es CERO, no otro porcentaje: sin los dos certificados no
       hay deduccion del 40 %, y la del 20 % exige bajar la DEMANDA, cosa que la
       fotovoltaica no hace. Sin certificados, no se promete nada. */
    if(!conCertificados) return 0;
    var t = this.irpfEstatal.conCertificados;
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
