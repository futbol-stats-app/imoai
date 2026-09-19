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

  version: "1.6.1",
  revisado: "2026-09-18",

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

    /* Revision del 16/09/2026 · rehecha pagina por pagina, y CORRIGE lo del 11/09:
       1) LO DE ELEGIR PLAZO O CUOTA: lo publica BBVA, no Kutxabank. Esta en el documento
          precontractual (INE) que enlazan las DOS paginas de BBVA:
          bbva.es/content/dam/public-web/bbvaes/documents/productos/prestamos/ine-credito-al-consumo-clientes.pdf
          Dice, literal: "Usted puede elegir para la deuda restante: a. Reducir el plazo del
          prestamo y mantener la misma cuota periodica. b. Reducir la cuota periodica y
          mantener el mismo plazo." Nuestro modelo necesita (a) y BBVA lo deja.
          Comprobado el 16/09/2026 en clientes.kutxabank.es/es/prestamos/eficiencia-energetica.html:
          Kutxabank NO dice nada de esto, ni ahi ni en el simulador. Hay que llamar.
       2) BBVA SE CONTRADICE EN TRES COSAS, no en dos. Su pagina de placas
          (bbva.es/general/ahorro-energetico-hogar/instalacion-de-placas-solares.html) dice
          15 anos, 0 % de cancelacion y 0 % de apertura. Su ficha, su simulador y el INE que
          ella misma enlaza dicen 2-8 anos, 0,50-1 % de amortizacion anticipada y 2,30 % DE
          APERTURA. La de apertura es nueva y no estaba apuntada.
          Tres fuentes contra una, y la que manda es el INE porque es el documento
          precontractual: por defecto van los 8 anos, el 1 % y la posibilidad de que haya
          apertura. La pagina de placas tiene pinta de campana: ella misma dice
          "oferta valida hasta el 30/09/2026". Quedan 14 dias.
       Santander (4,32 % TAE) y Bankinter (4,54 %) publican TAE mas baja, pero son el
       minimo de un rango que llega al 11-13 % y dependen del perfil: no son tipo
       garantizado. Y Bankinter limita a 60 meses justo el tramo de 4.000-8.000 €. */
    ojoAmortizacion: "CORREGIDO 16/09/2026: es BBVA quien publica que se puede ELEGIR entre "
                   + "acortar plazo y bajar cuota (lo dice su INE, no la web). Kutxabank NO lo "
                   + "publica. Y BBVA se contradice en TRES cosas a la vez entre su pagina de "
                   + "placas y su propia ficha/INE: plazo (15 anos vs 2-8), amortizacion "
                   + "anticipada (0 % vs 0,50-1 %) y apertura (0 % vs 2,30 %).",

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
    nota: "RDL 7/2026, de 20 de marzo (BOE 21/03/2026), convalidado el 26 de marzo de 2026 (Resolucion del Congreso de 26/03/2026, BOE-A-2026-7125, BOE de 28/03/2026). Corregido el 16/09/2026: aqui ponia 27 de marzo."
  },

  /* -----------------------------------------------------------
     3 · LA DEDUCCIÓN ESTATAL DEL IRPF
     ----------------------------------------------------------- */
  irpfEstatal: {
    /* Las tres modalidades de la DA 50a de la Ley del IRPF (obras de eficiencia energetica).
       🔴 CORREGIDO EL 16/09/2026. El 10/09/2026 se escribio aqui que el 10 % "no existe".
       SI EXISTE, pero no es una modalidad de esta deduccion: es OTRA deduccion distinta,
       creada por el mismo RDL 7/2026, y esta abajo en "autoconsumo". Confundir las dos
       nos estaba haciendo decirle a un cliente que no tiene nada cuando si tiene.
       Fuente: BOLINFORM oficial de la AEAT sobre el RDL 7/2026,
       sede.agenciatributaria.gob.es/static_files/Sede/Actualidad/Novedades/2026/BOLINFORM_RDL_7_2026.pdf
       (consultado el 16/09/2026). */
    demanda:         { pct: 0.20, base: 5000,  requisito: "bajar un 7 % la demanda de calefaccion y refrigeracion" },
    conCertificados: { pct: 0.40, base: 7500,  requisito: "bajar un 30 % el consumo de energia primaria no renovable, O llegar a letra A o B" },
    edificio:        { pct: 0.60, base: 5000,  acumulado: 15000, arrastra: 4 },

    /* En la del 20 % y la del 40 % el exceso NO se traslada: si la cuota no llega, se
       PIERDE. Solo la del 60 % (edificio entero) se arrastra 4 ejercicios. */
    arrastraEl40: false,
    soloVivienda: "habitual o arrendada para su uso como vivienda",

    /* 🟢 LA OTRA DEDUCCION, la que se nos habia caido. NUEVA AQUI el 16/09/2026.
       No es la de obras: es la de PONER PLACAS, y no pide certificados energeticos.
       Con esta, el cliente canario sin calefaccion —el que no llega al 40 %— SI tiene algo.
       Creada por el RDL 7/2026, con efectos desde el 1 de enero de 2026. */
    autoconsumo: {
      pct: 0.10,             /* vivienda propia */
      pctEdificio: 0.20,     /* edificio de uso predominantemente residencial */
      base: 5000,            /* limite anual de base */
      requisito: "la instalacion tiene que REALIZARSE Y TERMINARSE en 2026, y los pagos "
               + "hacerse en 2026. Hace falta el Certificado de Instalacion Electrica (CIE). "
               + "Pago nunca en efectivo. La parte cubierta por subvencion no deduce.",
      ojo: "NO pide los dos certificados energeticos. Esa es toda la diferencia con el 40 %: "
         + "aqui basta el CIE del instalador. Por eso en Canarias es la que casi siempre aplica.",
      hasta: "2026-12-31",
      fuente: "RDL 7/2026, de 20 de marzo (BOE 21/03/2026) · BOLINFORM de la AEAT, "
            + "consultado el 16/09/2026",
      comprobado: "2026-09-16"
    },

    /* Plazos, revisados el 16/09/2026 contra la Sede de la AEAT:
       20 % y 40 %: obras hasta el 31/12/2026, certificado posterior expedido ANTES del 01/01/2027.
       60 % (edificio): obras hasta el 31/12/2027, certificado ANTES del 01/01/2028.
       ⚠️ AVISO DE FUENTE: el Manual Practico de IRPF 2025 de la AEAT TODAVIA publica los
       plazos viejos (obras hasta 31/12/2025). Esta desactualizado respecto a la prorroga del
       RDL 7/2026. Mandan las paginas vivas de "Vivienda y otros inmuebles" de la Sede, no el manual. */
    plazoCertificado40: "2027-01-01",
    plazoCertificado60: "2028-01-01",

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
      critico: "🟢 RESUELTO EL 16/09/2026, y al reves de como estaba apuntado. BBVA SI LO "
             + "PUBLICA, y publica lo que nos hace falta. Su documento precontractual (INE de "
             + "credito al consumo, bbva.es) dice literalmente: 'Usted puede elegir para la deuda "
             + "restante: a. Reducir el plazo del prestamo y mantener la misma cuota periodica. "
             + "b. Reducir la cuota periodica y mantener el mismo plazo.' O sea: el cliente elige, "
             + "y nuestro modelo se sostiene. KUTXABANK NO lo publica en ningun sitio (ni ficha, ni "
             + "simulador, ni glosario): eso hay que preguntarlo por telefono. "
             + "El 11/09/2026 aqui ponia lo contrario (que lo publicaba Kutxabank y no BBVA); "
             + "comprobado pagina por pagina el 16/09/2026 y corregido."
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
     nota:              lo que LEE EL CLIENTE en pantalla. En cristiano y corto.
     notaInterna:       lo de casa (quién lo verificó, cuándo y qué corregimos).
                        NO SE PINTA NUNCA. Separado el 19/09/2026.
     ----------------------------------------------------------- */
  comunidades: {
    an: { nombre:"Andalucía",
          subvencion:{ estado:"cerrada", importe:0, nota:"En Andalucía no hay ninguna abierta para poner placas en una vivienda particular: la última convocatoria de autoconsumo cerró el 31 de diciembre de 2023 y no hay otra publicada. Tu dinero está en la deducción estatal del 40 % y en las bonificaciones de IBI e ICIO de tu ayuntamiento.", notaInterna:"VERIFICADA el 18/09/2026 (el 17/09 no se pudo: las tres páginas oficiales bloqueaban el acceso automático). Andalucía NO tiene subvención autonómica abierta para que un particular ponga placas en su casa. La convocatoria de autoconsumo que gestiona la Agencia Andaluza de la Energía es la del Real Decreto 477/2021 (Next Generation): el catálogo de procedimientos de la sede de la Junta, trámite 24726, publica plazo del 02/12/2021 al 31/12/2023, y ese plazo está vencido. Lo único de Andalucía en energía registrado en la BDNS en 2026 es la 899702 (Línea 2 Energía, Espacios productivos, 17/04/2026) y es PARA EMPRESAS, no para viviendas. Al cliente andaluz se le lleva al IBI y al ICIO de su ayuntamiento y a la deducción estatal del 40 %, que es donde está su dinero. Fuente: juntadeandalucia.es/servicios/sede/tramites/procedimientos/detalle/24726.html, consultado el 18/09/2026." },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Andalucía no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT y en la Ley 5/2021 de Tributos Cedidos (arts. 9 a 22 quater). Sí se aplica la deducción estatal del 40 %." }, foral:false },

    ar: { nombre:"Aragón",
          subvencion:{ estado:"cerrada", importe:0, nota:"En Aragón no hay ninguna abierta para placas en una vivienda particular: la de autoconsumo cerró el 31 de diciembre de 2023. Sí hay una ayuda anual de rehabilitación para mejorar la eficiencia energética, que en 2026 solo estuvo abierta del 13 de enero al 3 de febrero; pide certificado energético antes y después y bajar un 30 % el consumo de energía primaria no renovable (o un 7 % la demanda). Si te interesa, la ventana es enero: el certificado previo hay que tenerlo hecho en diciembre. La convocatoria de 2027 todavía no está publicada.", notaInterna:"VERIFICADA el 18/09/2026 (antes esta nota estaba VACÍA). Aragón NO tiene ahora mismo subvención autonómica abierta para placas en vivienda particular. Comprobado en el tramitador del Gobierno de Aragón: el Programa 4 de autoconsumo renovable en el sector residencial (trámite 6601) figura FUERA DE PLAZO, del 13/12/2021 al 31/12/2023; las ayudas de renovables cofinanciadas con FEDER siguen con la convocatoria de 2021 (Orden ICD/566/2021) y la página se actualizó por última vez el 24/11/2025. LO QUE SÍ TIENE, y conviene saberlo: una convocatoria ANUAL de rehabilitación residencial para mejora de la eficiencia energética (PRTR), Programa 4, actuaciones en viviendas (trámite 11317), que en 2026 estuvo abierta del 13/01/2026 al 03/02/2026 —tres semanas de enero— y exige certificado energético antes y después y reducir un 30 % el consumo de energía primaria no renovable o un 7 % la demanda. Si el cliente aragonés quiere entrar, la ventana es enero: hay que tenerle el certificado previo hecho en diciembre. NO se le promete la convocatoria de 2027 hasta que se publique. Fuente: aragon.es, trámites 6601 y 11317, consultados el 18/09/2026." },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Aragón no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT y en el Decreto Legislativo 1/2005 (arts. 110-2 a 110-22). Sí se aplica la estatal del 40 %." }, foral:false },

    as: { nombre:"Asturias",
          subvencion:{ estado:"cerrada", importe:0,
                       nota:"En Asturias no hay ninguna abierta para vivienda particular. Las ayudas a renovables que convocó el Principado en 2026 son para empresas y para personas físicas con actividad económica, no para un particular que pone placas en su casa, y además su plazo ya venció.", notaInterna:"VERIFICADA el 17/09/2026 (antes esta nota estaba VACÍA). Asturias convocó en 2026 sus ayudas al uso de energías renovables y al ahorro y la eficiencia energética (Consejería de Ciencia, Empresas, Formación y Empleo, 2.500.000 €, BDNS 901221 y 901222), pero NO son para el particular que pone placas en su casa: los beneficiarios son gran empresa y pymes o personas físicas CON actividad económica. Además el plazo era de un mes desde el extracto publicado el 04/05/2026 en el BOPA, así que está cerrado. Para vivienda particular en Asturias: no hay subvención autonómica abierta." },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"Asturias no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT: sus 27 deducciones son de familia, alquiler, despoblamiento y similares. Sí se aplica la estatal del 40 %." }, foral:false },

    ib: { nombre:"Baleares",
          subvencion:{ estado:"cerrada", importe:0, unidad:"€/kWp",
                       nota:"En Baleares la convocatoria de fotovoltaica de 2026 (FOTOPAR2026) cerró el 30 de abril de 2026, y la de 2027 todavía no está publicada. Hay otra ayuda abierta, FACTOR 2026, del 9 de julio de 2026 al 28 de febrero de 2027, pero no cubre fotovoltaica para particulares: solo baterías, aerotermia y recarga. La deducción del 50 % del IRPF balear sí sigue en pie.", notaInterna:"🔴 CORREGIDO el 11/09/2026. Antes aquí ponía «reabre el 26/01/2027», y ESA FECHA NO ESTÁ PUBLICADA: es la fecha en que abrió la convocatoria de 2026 (FOTOPAR2026, cerrada el 30/04/2026), no un anuncio del Govern. La convocatoria de 2027 no está publicada. Baleares sí tiene abierta otra ayuda (FACTOR 2026, del 09/07/2026 al 28/02/2027), pero NO cubre fotovoltaica para particulares: solo baterías, aerotermia y recarga. La deducción del 50 % del IRPF sí sigue en pie." },
          deduccion:{ pct:0.50, base:10000, tope:5000,
                      nota:"Hay que subir al menos un nivel la calificación energética. Límite de base imponible: 33.000 € individual / 52.800 € conjunta." },
          foral:false },

    cn: { nombre:"Canarias",
          subvencion:{ estado:"cerrada", importe:0, nota:"Del Gobierno de Canarias no hay ninguna abierta: las dos convocatorias de 2026 cerraron en junio y en agosto, y no hay otra publicada. Por islas: en GRAN CANARIA sí hay una abierta, la del Consejo Insular de la Energía para instalaciones fotovoltaicas en viviendas, hasta el 31 de diciembre de 2026 o hasta que se agote el dinero —la cuantía por vivienda no está publicada, hay que preguntarla—. En LA PALMA, la del Cabildo ya cerró, pero el Ayuntamiento de BREÑA BAJA acaba de abrir la suya para autoconsumo y agua caliente en viviendas, con 30 días naturales de plazo desde el día siguiente a la publicación del extracto en el BOP: solo vale si estás empadronado y tienes vivienda allí. En LANZAROTE el Cabildo tiene una de transición energética con el plazo poco claro: antes de contar con ella hay que llamar a su Área de Energía. El CABILDO DE TENERIFE no tiene ninguna línea propia para viviendas, así que si vives en Tenerife tu dinero está en la bonificación del IBI de tu ayuntamiento y en la deducción.", notaInterna:"Revisado el 16/09/2026. Autonómica: sigue sin haber convocatoria nueva en el BOC; las dos de 2026 cerraron en junio y agosto. INSULARES, una por una: 🟢 GRAN CANARIA ABIERTA — Consejo Insular de la Energía, subvención a instalaciones fotovoltaicas EN VIVIENDAS 2026, 700.000 €, para personas físicas sin actividad económica, abierta hasta el 31/12/2026 o hasta agotar el crédito (BDNS 897819). La cuantía por vivienda no está publicada en la BDNS y la sede del Consejo Insular no deja leerse: preguntar. 🔴 LA PALMA CERRADA — Cabildo, fotovoltaica de autoconsumo para viviendas 2026, 171.316,96 € (BDNS 921227, extracto en el BOP de S/C de Tenerife nº 90 de 29/07/2026); el plazo era de 15 días hábiles y ya venció. ⚠️ LANZAROTE — Cabildo, mitigación del cambio climático y transición energética (BDNS 925135, 500.000 €, BOP de Las Palmas de 19/08/2026): el plazo publicado es «un mes desde la publicación», o sea en torno al 21/09/2026, PERO la BDNS la marca ya como cerrada y el BOP de Las Palmas no deja leerse automáticamente. Contradicción sin resolver: llamar al Área de Energía antes de prometerla. 🔴 CABILDO DE TENERIFE: NO TIENE NINGUNA. Comprobado el 16/09/2026 en la BDNS y en su portal de ayudas: ni abierta, ni cerrada, ni anunciada para 2026 ni 2027. Es el único cabildo sin línea propia para viviendas (La Palma, Gran Canaria, Fuerteventura, La Gomera y Lanzarote sí la tienen). Al cliente de Tenerife se le dice eso, y se le lleva al IBI del ayuntamiento y a la deducción, que es donde está su dinero. Aquí no se pone ningún importe hasta verlo publicado. 🟢 NUEVO EL 18/09/2026, Y ES LA PRIMERA DE PLACAS PARA VIVIENDA EN TODA ESPAÑA EN OCHO SEMANAS: el AYUNTAMIENTO DE BREÑA BAJA (La Palma) ha registrado convocatoria 2026 de subvenciones para instalaciones de producción de energía eléctrica de autoconsumo y agua caliente sanitaria EN VIVIENDAS, 22.400 €, para personas físicas sin actividad económica, 30 días naturales desde el día siguiente a la publicación del extracto en el BOP de S/C de Tenerife (BDNS 929841, registrada el 16/09/2026). Es municipal, no autonómica: solo vale para empadronados con vivienda en Breña Baja." },
          deduccion:{ pct:0.12, base:7000, tope:840,
                      nota:"Vivienda habitual en propiedad, pago nunca en efectivo y los dos certificados. Además no puede pasar del 10 % de la cuota autonómica." },
          foral:false },

    ct: { nombre:"Cantabria",
          subvencion:{ estado:"cerrada", importe:0,
                       nota:"En Cantabria no hay ninguna abierta de autoconsumo para particulares: la última cerró el 31 de diciembre de 2023 y no hay convocatoria nueva ni anunciada.", notaInterna:"VERIFICADA el 16/09/2026 (antes ponía «sinVerificar»). Cantabria NO tiene subvención autonómica de autoconsumo para particulares abierta. La última fue el programa 4.2 del RD 477/2021 (BOC de 13/04/2022), que cerró el 31/12/2023. No hay convocatoria nueva ni anunciada en la BDNS. ⚠️ El portal de energía del Gobierno de Cantabria y el BOC estuvieron caídos el 16/09/2026: reconfirmar en dgicc.cantabria.es cuando vuelva." },
          deduccion:{ pct:0.15, base:0, tope:1000,
                      nota:"El 15 % de lo que pagues por la obra, con un límite de 1.000 € de deducción en declaración individual y 1.500 € en conjunta (500 € más si hay una discapacidad del 65 % o superior). Ese límite es de la deducción, no de la base: la base no está limitada. Vale para obras en cualquier vivienda de tu propiedad —rehabilitación, eficiencia energética, energías renovables o accesibilidad—, así que la fotovoltaica entra. El pago nunca en efectivo. Lo que no te quepa un año lo aplicas los dos ejercicios siguientes. Es incompatible con la deducción estatal y con subvenciones por las mismas obras. Art. 2.3 del Decreto Legislativo 62/2008 de Cantabria.", notaInterna:"🔴 CORREGIDO EL 16/09/2026, y a favor del cliente: aquí ponía «tope 150 €» y el tope real es 1.000 € en declaración individual y 1.500 € en conjunta (+500 € con discapacidad ≥ 65 %). Casi siete veces más de lo que le estábamos diciendo. Los 1.000 € NO son la base: son el límite de la deducción, la base no está limitada. 15 % de lo pagado en obras en cualquier vivienda de su propiedad —rehabilitación, eficiencia energética, energías renovables, accesibilidad—, así que la fotovoltaica entra. Pago nunca en efectivo. Lo no deducido por pasarse del límite se aplica los dos ejercicios siguientes. Incompatible con la deducción estatal o con subvenciones por las MISMAS obras. Art. 2.3 del Decreto Legislativo 62/2008 de Cantabria, texto consolidado actualizado el 30/04/2026; contrastado en el manual de IRPF de la AEAT." },
          foral:false },

    cm: { nombre:"Castilla-La Mancha",
          subvencion:{ estado:"cerrada", importe:0,
                       nota:"Para una vivienda individual no hay nada abierto en Castilla-La Mancha. Sí lo hay para edificios: dos convocatorias de ayudas al aprovechamiento de energías renovables abiertas del 9 de septiembre de 2026 al 8 de marzo de 2027, una para comunidades energéticas y otra para comunidades de propietarios. Si la instalación es de todo el edificio, merece la pena mirarlas, que hay plazo hasta marzo de 2027. La cuantía por instalación la fija la Orden 52/2026 y todavía no la tenemos.", notaInterna:"VERIFICADA el 17/09/2026 (antes esta nota estaba VACÍA: decíamos «cerrada» sin haberlo comprobado). Para una VIVIENDA INDIVIDUAL: no hay nada abierto. Pero OJO, que esto sí vale dinero y es nuevo: el 8 de septiembre de 2026 la Dirección General de Transición Energética publicó DOS convocatorias de ayudas al aprovechamiento de energías renovables (Orden 52/2026, de 14 de abril, DOCM de 22/04/2026; extracto en el DOCM de 08/09/2026), con plazo del 09/09/2026 al 08/03/2027: una de 8.534.586,40 € para COMUNIDADES ENERGÉTICAS (personas jurídicas sin actividad económica) y otra de 2.133.654,10 € para COMUNIDADES DE PROPIETARIOS y pymes/personas físicas con actividad económica (BDNS 927466 y 927526). Es decir: al cliente de a pie de Ciudad Real o Toledo se le dice que no hay ayuda para su casa, pero a un EDIFICIO o a una comunidad de propietarios de Castilla-La Mancha SÍ hay que decírselo, y queda plazo hasta marzo de 2027. La cuantía por instalación no se ha leído todavía: está en la Orden 52/2026, pendiente." },
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
          subvencion:{ estado:"cerrada", importe:0, nota:"Cerró el 1 de diciembre de 2025. Era de 4.000 €.", notaInterna:"Cerró el 01/12/2025. Era de 4.000 €." },
          deduccion:{ pct:0.15, base:9000, tope:1350,
                      nota:"Obras de mejora de eficiencia energética: 15 % con base de 9.000 € (hasta 1.350 €). Además, el 100 % de lo que cueste el certificado energético, con tope de 150 €. Hace falta certificado de antes y de después. La puede pedir el propietario —vivienda habitual, segunda, alquilada o vacía—, pero NO el usufructuario ni el inquilino, ni los inmuebles afectos a una actividad. Art. 5.Dieciocho del Decreto Legislativo 1/2011 de Galicia.", notaInterna:"Obras de mejora de eficiencia energética: 15 % con base de 9.000 € (hasta 1.350 €). Además, el 100 % de lo que cueste el certificado energético, con tope de 150 €. Hace falta certificado de antes y de después. La puede pedir el propietario —vivienda habitual, segunda, alquilada o vacía—, pero NO el usufructuario ni el inquilino, ni los inmuebles afectos a una actividad. Art. 5.Dieciocho del Decreto Legislativo 1/2011 de Galicia. Revisado el 11/09/2026." },
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
          subvencion:{ estado:"cerrada", importe:0,
                       nota:"En Navarra no hay ninguna abierta de autoconsumo para particulares: la última cerró el 31 de diciembre de 2023. Lo que hay en 2026 son ayudas a comunidades energéticas, y son para personas jurídicas, no para un particular.", notaInterna:"VERIFICADA el 16/09/2026 (antes ponía «sinVerificar»). Navarra NO tiene subvención autonómica de autoconsumo para particulares abierta. La última para personas físicas fue el Programa 4 del RD 477/2021 (Resolución 121E/2021), que cerró el 31/12/2023. En 2026 solo hay ayudas a comunidades energéticas y son para personas jurídicas. Comprobado en la BDNS." },
          deduccion:{ pct:0.15, base:0, tope:0,
                      nota:"El 15 % de lo que pagues. Hace falta un informe previo del Departamento de Energía del Gobierno de Navarra, que se pide durante todo el año, y la deducción se aplica en la primera declaración posterior a la fecha de ese informe (art. 62.12.e de la Ley Foral 22/2023). La base máxima y el tope en euros no están publicados, así que aquí no ponemos ninguno. Y si has oído que en Navarra se llega al 30 %, ese 30 % es de otra cosa (hidrógeno renovable): en autoconsumo compartido y comunidades energéticas el techo es el 20 %.", notaInterna:"🔴 CORREGIDO EL 16/09/2026. Aquí ponía «hasta el 30 % con almacenamiento, autoconsumo compartido o comunidades energéticas» y ESO ES FALSO: el 30 % es el techo del hidrógeno renovable en sustitución de gas natural (15 % base + 15 puntos, Ley Foral 36/2022). Para autoconsumo compartido y comunidades energéticas el techo es el 20 %, no el 30 % (Manual Teórico de Renta de la Hacienda Foral). NO prometer el 30 % a nadie. El 15 % base es coherente con la aritmética oficial pero NO se ha podido leer literalmente el art. 62.12 del Decreto Foral Legislativo 4/2008 (navarra.es y bon.navarra.es estuvieron caídos el 16/09/2026): pendiente de cerrar. La base máxima y el tope en euros: no publicada. Lo que SÍ está confirmado es que hace falta INFORME PREVIO del Departamento de Energía del Gobierno de Navarra, que se pide todo el año, y que la deducción se aplica en la primera declaración posterior a la fecha del informe (art. 62.12.e), Ley Foral 22/2023)." },
          deduccionObras:{ fecha:"2026-09-16", pct20:0.20, base20:5000, pct40:0.40, base40:7500, pct60:0.60, base60:5000, acumulado60:15000,
                      nota:"🟢 NUEVO el 16/09/2026, y es importante porque Navarra es foral y no aplica el IRPF estatal: el Decreto-ley Foral 1/2026, de 15 de abril, prorroga a las cantidades pagadas EN 2026 las tres deducciones forales por obras de mejora energética, con los mismos porcentajes y bases que el Estado (20 % base 5.000 €, 40 % base 7.500 €, 60 % de edificio base 5.000 €/año hasta 15.000 € acumulados). Modifica la disposición adicional 65ª del Texto Refundido del IRPF navarro. BOE-A-2026-10888. Es decir: al navarro NO hay que decirle que se queda sin el 40 % por ser foral; lo tiene por su propia vía." },
          foral:true },

    pv: { nombre:"País Vasco",
          subvencion:{ estado:"abierta", importe:600, unidad:"€/kW", hasta:"2026-09-30",
                       nota:"es la única abierta en España y el plazo acaba el 30 de septiembre de 2026. Ojo, porque corre prisa: el propio EVE avisa en su web de que el presupuesto está próximo a agotarse —más de 7.000 solicitudes sobre 80 M€— y puede cerrarse antes de esa fecha. No te prometemos el dinero: te decimos que está abierta y que hay que darse prisa. El EVE ha anunciado otra convocatoria, pero todavía no está publicada.", notaInterna:"La única abierta en España, hasta el 30/09/2026. 🔴 REVISADO 11/09/2026: el propio EVE avisa en su web de que el presupuesto está próximo a agotarse, y la prensa del sector daba más de 7.000 solicitudes el 07/09/2026 sobre 80 M€. NO se le promete el dinero a nadie: se dice que está abierta y que el presupuesto puede acabarse antes de la fecha. El EVE ha anunciado otra convocatoria para las próximas semanas, pero AÚN NO ESTÁ PUBLICADA." },
          deduccion:{ pct:0.15, base:20000, tope:0,
                      nota:"En los tres territorios. Y algo que no pasa en el resto de España: la fotovoltaica da derecho por sí sola, con el certificado de instalación eléctrica y SIN los certificados energéticos." },
          foral:true },

    ri: { nombre:"La Rioja",
          subvencion:{ estado:"cerrada", importe:0, nota:"" },
          deduccion:null, deduccionComprobada:{ fecha:"2026-09-11", nota:"La Rioja no tiene deducción propia por placas ni por eficiencia energética. COMPROBADO el 11/09/2026 en el manual de IRPF de la AEAT. OJO con una confusión habitual: su deducción por rehabilitación de vivienda habitual es un régimen transitorio de obras anteriores a 2013 y no tiene nada que ver con la energía. Sí se aplica la estatal del 40 %." }, foral:false }
  },

  /* -----------------------------------------------------------
     4 bis · LA LEY MUNICIPAL DE TODA ESPAÑA (IBI e ICIO)
     -----------------------------------------------------------
     AÑADIDO EL 17/09/2026. Hasta hoy, a un cliente de Lugo, de Huelva o de
     Cuenca no le podíamos decir NADA de su ayuntamiento, porque su municipio
     no estaba en la ficha. Esto lo arregla: no dice lo que hace SU pueblo,
     dice lo que la ley le PERMITE hacer a cualquier pueblo de España y dónde
     se publica su ordenanza. Con eso se contesta al instante y con la verdad,
     sin inventarse un porcentaje.

     Leído palabra por palabra en el texto consolidado del BOE el 17/09/2026.
     Esto cierra el pendiente nº 13 de TRAMITE_5_ICIO.md, que decía que el
     art. 74.5 no se había verificado sobre el texto oficial. Ya está.
     ----------------------------------------------------------- */
  leyMunicipal: {
    ibiMax: 0.50,
    icioMax: 0.95,
    recargaMax: 0.50,
    potestativo: true,
    enCorto: "La ley NO obliga a ningún ayuntamiento. Le PERMITE bonificar hasta el 50 % del IBI y hasta el 95 % del ICIO "
           + "por poner placas. Cada ayuntamiento decide en su ordenanza fiscal, y por eso hay pueblos pegados con "
           + "respuestas opuestas: Santa Cruz y La Laguna bonifican, Adeje y Arona no. Si el municipio del cliente no "
           + "está en nuestra ficha, NO se le dice que no tiene bonificación: se le dice que hay que mirar su ordenanza.",
    ibiLiteral: "Las ordenanzas fiscales podrán regular una bonificación de hasta el 50 por ciento de la cuota íntegra "
              + "del impuesto para los bienes inmuebles en los que se hayan instalado sistemas para el aprovechamiento "
              + "térmico o eléctrico de la energía proveniente del sol o de la energía ambiente. La aplicación de esta "
              + "bonificación estará condicionada a que las instalaciones dispongan de la correspondiente homologación "
              + "por la Administración competente.",
    ibiComunidadesEnergeticas: "🟢 PÁRRAFO NUEVO, y va justo donde está el negocio: «la ordenanza fiscal podrá establecer "
              + "diferentes porcentajes de bonificación, sin exceder el límite máximo fijado en el párrafo anterior, en el "
              + "caso de cesión de espacios para la instalación de sistemas de aprovechamiento de energía cuyo uso o "
              + "propiedad esté asociado a comunidades energéticas». O sea: la ley ya contempla expresamente que el "
              + "propietario ceda el espacio y que la instalación sea de una comunidad energética, y deja al ayuntamiento "
              + "poner un porcentaje distinto para ese caso. Entró con el RDL 7/2026.",
    icioLiteral: "Una bonificación de hasta el 95 por ciento a favor de las construcciones, instalaciones u obras en las "
              + "que se incorporen sistemas para el aprovechamiento térmico o eléctrico de la energía solar o de la "
              + "energía ambiente. La aplicación de esta bonificación estará condicionada a que las instalaciones "
              + "dispongan de la correspondiente homologación de la Administración competente.",
    recargaLiteral: "Las ordenanzas fiscales podrán regular una bonificación de hasta el 50 por ciento de la cuota íntegra "
              + "del impuesto a favor de los bienes inmuebles en los que se hayan instalado puntos de recarga para "
              + "vehículos eléctricos (art. 74.7 TRLRHL). Si el cliente va a poner cargador de coche eléctrico, es otra "
              + "bonificación distinta y se pide aparte.",
    ojoClausulaObligatorias: "NI el art. 74.5 (IBI) NI el art. 103.2.b) (ICIO) llevan la frase «que no sean obligatorias a "
              + "tenor de la normativa específica en la materia». Esa cláusula la meten por su cuenta muchas ordenanzas "
              + "municipales —y pueden, porque la bonificación es potestativa—, pero NO viene de la ley estatal. "
              + "Verificado palabra por palabra el 17/09/2026 sobre el texto consolidado del BOE.",
    homologacion: "Las dos bonificaciones piden «homologación de la Administración competente». Esa redacción es de 2004 y "
              + "está pensada para solar TÉRMICA (colectores). Para fotovoltaica no hay un documento que se llame así: se "
              + "presenta el Certificado de Instalación Eléctrica (CIE) sellado por industria más el registro de "
              + "autoconsumo. Es la única pregunta técnica que puede frenar un expediente.",
    fuente: "Texto refundido de la Ley Reguladora de las Haciendas Locales (Real Decreto Legislativo 2/2004), arts. 74.5, "
          + "74.7 y 103.2.b). Texto consolidado del BOE, BOE-A-2004-4214, https://www.boe.es/buscar/act.php?id=BOE-A-2004-4214 . "
          + "El art. 74.5 está modificado por el art. 44.1 del Real Decreto-ley 7/2026, de 20 de marzo (BOE-A-2026-6544), que "
          + "añadió la energía ambiente y el párrafo de las comunidades energéticas. Consultado el 17/09/2026.",
    cuandoCambia: "De septiembre a diciembre. Es cuando cada ayuntamiento aprueba y publica en su boletín las ordenanzas "
                + "fiscales del año siguiente. Estamos dentro de esa ventana.",
    comprobado: "2026-09-17"
  },

  /* Dónde se publica la ordenanza fiscal de cada municipio, provincia por provincia.
     Fuente: BOE, «Otros diarios oficiales», https://www.boe.es/legislacion/otros_diarios_oficiales.php
     Consultado el 17/09/2026. Las nueve comunidades uniprovinciales (Asturias, Baleares,
     Cantabria, Madrid, Murcia, Navarra, La Rioja) y Ceuta y Melilla no tienen BOP: publican
     en el boletín de la comunidad. El detalle por provincia está en publicar/municipios/<cod>.json */
  boletines: {
    "01":"BOTHA (Álava) · http://www.araba.eus/botha/Inicio/SGBO5001.aspx",
    "02":"BOP de Albacete · https://bop.dipualba.es/",
    "03":"BOP de Alicante · http://sede.diputacionalicante.es/consultas-bop/",
    "04":"BOP de Almería · http://www.dipalme.org/Servicios/cmsdipro/index.nsf/bop_view.xsp?p=dipalme",
    "05":"BOP de Ávila · https://www.diputacionavila.es/boletin-oficial/",
    "06":"BOP de Badajoz · http://www.dip-badajoz.es/bop/",
    "07":"BOIB (Illes Balears, uniprovincial) · http://www.caib.es/eboibfront/?lang=es",
    "08":"BOP de Barcelona · http://bop.diba.cat",
    "09":"BOP de Burgos · http://bopbur.diputaciondeburgos.es/",
    "10":"BOP de Cáceres · https://bop.dip-caceres.es/bop/index.html",
    "11":"BOP de Cádiz · http://www.bopcadiz.org",
    "12":"BOP de Castellón · http://bop.dipcas.es/PortalBOP/boletin.do",
    "13":"BOP de Ciudad Real · https://bop.dipucr.es/",
    "14":"BOP de Córdoba · https://bop.dipucordoba.es/",
    "15":"BOP de A Coruña · https://bop.dacoruna.gal/bopportal/",
    "16":"BOP de Cuenca · https://www.dipucuenca.es/boletin-oficial-de-la-provincia",
    "17":"BOP de Girona · http://www.ddgi.cat/",
    "18":"BOP de Granada · https://www.dipgra.es/bop/",
    "19":"BOP de Guadalajara · http://boletin.dguadalajara.es/",
    "20":"BOG de Gipuzkoa · https://egoitza.gipuzkoa.eus/es/bog",
    "21":"BOP de Huelva · https://sede.diphuelva.es/servicios/bop",
    "22":"BOP de Huesca · http://bop.dphuesca.es/",
    "23":"BOP de Jaén · http://bop.dipujaen.es/",
    "24":"BOP de León · https://bop.dipuleon.es/",
    "25":"BOP de Lleida · https://ebop.diputaciolleida.cat/bop/",
    "26":"BOR (La Rioja, uniprovincial) · http://www.larioja.org/bor/es",
    "27":"BOP de Lugo · http://www.deputacionlugo.gal/boletin-oficial-da-provincia-de-lugo",
    "28":"BOCM (Madrid, uniprovincial) · http://www.bocm.es/",
    "29":"BOP de Málaga · http://www.bopmalaga.es/",
    "30":"BORM (Murcia, uniprovincial) · https://www.borm.es/#/home/",
    "31":"BON (Navarra, uniprovincial) · http://www.navarra.es/home_es/Actualidad/BON/",
    "32":"BOP de Ourense · https://bop.depourense.es/portal/",
    "33":"BOPA (Asturias, uniprovincial) · https://sede.asturias.es/servicios-del-bopa",
    "34":"BOP de Palencia · https://www.diputaciondepalencia.es/servicios/boletin-oficial-provincia",
    "35":"BOP de Las Palmas · http://www.boplaspalmas.com",
    "36":"BOPPO de Pontevedra · https://boppo.depo.gal/es",
    "37":"BOP de Salamanca · https://sede.diputaciondesalamanca.gob.es/BOP/",
    "38":"BOP de Santa Cruz de Tenerife · http://www.bopsantacruzdetenerife.es/ (y el Consorcio de Tributos de Tenerife, 922 20 82 00, recauda por casi todos los ayuntamientos de la isla)",
    "39":"BOC de Cantabria (uniprovincial) · https://boc.cantabria.es/boces/",
    "40":"BOP de Segovia · http://www.dipsegovia.es/bop",
    "41":"BOP de Sevilla · http://www.dipusevilla.es/bop/",
    "42":"BOP de Soria · http://bop.dipsoria.es/",
    "43":"BOP de Tarragona · http://www.diputaciodetarragona.cat/ebop/",
    "44":"BOP de Teruel · http://www.dpteruel.es/boletines.htm",
    "45":"BOP de Toledo · http://bop.diputoledo.es/webEbop/inicio.jsp",
    "46":"BOP de Valencia · https://bop.dival.es/bop/drvisapi.dll",
    "47":"BOP de Valladolid · https://bop.sede.diputaciondevalladolid.es/",
    "48":"BOB de Bizkaia · https://www.bizkaia.eus/es/bob",
    "49":"BOP de Zamora · https://www.diputaciondezamora.es/opencms/servicios/BOP/bop/index.html",
    "50":"BOP de Zaragoza · http://bop.dpz.es/BOPZ/",
    "51":"BOCCE de Ceuta · http://www.ceuta.es/ceuta/documentos/",
    "52":"BOME de Melilla · https://bomemelilla.es/"
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
