/* ==================================================================
   IMMO IA · repaso.js — EL REPASO DE TODA LA CARTERA, DE UNA VEZ
   ------------------------------------------------------------------
   Lo que hace: coge los expedientes que hay, los mira TODOS a la vez
   y devuelve un parte corto de cinco líneas, ordenado por lo que más
   corre. No conversa: son cuentas sobre fechas. NO GASTA IA.

   Lo que mira en cada expediente:
     1. qué papel falta      (contra la tabla de OT-25, nada más)
     2. qué caduca y cuándo  (solo vigencias comprobadas)
     3. qué lleva parado     (días desde el último movimiento)
     4. qué está incompleto  (sin dirección, sin fecha, sin dueño)
     5. qué se contradice    (dos direcciones iguales, dos fechas)

   Y lo que de verdad impresiona, que es lo que NO se ve mirando los
   expedientes de uno en uno: el papel que se repite en media cartera,
   el día en que chocan dos relojes, el mismo piso metido dos veces.

   LA REGLA DE LA CASA, GRABADA AQUÍ DENTRO:
   ni un papel inventado. Un papel solo se pide si (a) el propio
   expediente dice que falta, o (b) está en la tabla de OT-25 para ese
   tipo de operación. Cada aviso lleva su fuente escrita al lado. Si la
   tabla no lo dice, esto no lo dice.

   Y la segunda regla: si no hay datos, se dice «no lo sé». No se
   supone el tipo de operación, no se rellena una fecha que no está,
   no se da por vigente un papel sin fecha de emisión.

   Hermano de motor.js (que ordena UN expediente) y de manana.js (que
   pinta el día). Este no escribe en ningún expediente: solo mira.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.0";

  /* ==================================================================
     1. LA TABLA DE PAPELES  (OT25_TABLA_DE_PAPELES.md, 18/09/2026)
     ------------------------------------------------------------------
     Solo las filas de frecuencia «todos los días» cuya propia tabla
     dice que sin ese papel no se puede seguir. Ni una más. El texto de
     «porque» y de «fuente» está copiado de la tabla, no redactado aquí.
     ================================================================== */

  var CARPETA = {
    venta: [
      { clave: "nota_simple", cual: "la nota simple del registro",
        busca: ["nota simple"],
        porque: "de ahí salen el dueño, la superficie registral y las cargas",
        fuente: "OT-25 · venta · Registro de la Propiedad" },
      { clave: "energetico", cual: "el certificado energético",
        busca: ["energetic"],
        porque: "sin él no se puede ni anunciar",
        fuente: "OT-25 · venta · RD 390/2021" },
      { clave: "comunidad", cual: "el certificado de estar al día con la comunidad",
        busca: ["comunidad"],
        porque: "el notario lo exige el día de la firma",
        fuente: "OT-25 · venta · art. 9.1.e Ley 49/1960" },
      { clave: "ibi", cual: "los últimos recibos del IBI",
        busca: ["ibi"],
        porque: "si hay deuda, se queda pegada al piso",
        fuente: "OT-25 · venta · art. 64 RDL 2/2004" },
      { clave: "dni", cual: "el DNI o NIE de las partes",
        busca: ["dni", "nie", "pasaporte", "identific"],
        porque: "sin él no se empieza",
        fuente: "OT-25 · venta · art. 3 Ley 10/2010" }
    ],
    alquiler: [
      { clave: "contrato", cual: "el contrato de arrendamiento",
        busca: ["arrendamiento", "contrato de alquiler"],
        porque: "es el papel que fija la renta y la duración",
        fuente: "OT-25 · alquiler · art. 9 Ley 29/1994" },
      { clave: "energetico", cual: "el certificado energético",
        busca: ["energetic"],
        porque: "es obligatorio antes de alquilar y la etiqueta va en el anuncio",
        fuente: "OT-25 · alquiler · RD 390/2021" },
      { clave: "fianza", cual: "la fianza y su depósito en el Instituto Canario de la Vivienda",
        busca: ["fianza"],
        porque: "no depositarla es infracción grave",
        fuente: "OT-25 · alquiler · Ley 2/2014 de Canarias, art. 2" },
      { clave: "inventario", cual: "el inventario y las fotos del piso",
        busca: ["inventario"],
        porque: "sin ellos, la discusión de la fianza no tiene prueba",
        fuente: "OT-25 · alquiler · práctica de la casa" },
      { clave: "dni", cual: "el DNI o NIE de las dos partes",
        busca: ["dni", "nie", "pasaporte", "identific"],
        porque: "sin él no se empieza",
        fuente: "OT-25 · alquiler · art. 3 Ley 10/2010" }
    ],
    vacacional: [
      { clave: "memoria", cual: "la memoria técnica con planos y fotos",
        busca: ["memoria tecnica"],
        porque: "es lo que documenta la vivienda para la declaración responsable",
        fuente: "OT-25 · vacacional" },
      { clave: "ocupacion", cual: "la comunicación de primera ocupación",
        busca: ["ocupacion", "habitabilidad", "cedula"],
        porque: "es requisito previo a la declaración responsable",
        fuente: "OT-25 · vacacional · art. 332.1.c Ley 4/2017" },
      { clave: "declaracion", cual: "la declaración responsable de inicio de actividad",
        busca: ["declaracion responsable"],
        porque: "sin ella no se puede empezar a comercializar",
        fuente: "OT-25 · vacacional · trámite 5548" },
      { clave: "registro_tur", cual: "la inscripción en el Registro General Turístico",
        busca: ["registro general turistico", "registro turistico", "licencia turistica"],
        porque: "sin número de registro no se puede anunciar en los portales",
        fuente: "OT-25 · vacacional · trámite 5548" },
      { clave: "energetico", cual: "el certificado energético",
        busca: ["energetic"],
        porque: "es obligatorio para anunciar",
        fuente: "OT-25 · vacacional · RD 390/2021" },
      /* AÑADIDO EL 18/09/2026 (EL_WOW_DEL_LUNES). La tabla de papeles lo
         da como de frecuencia «todos los días» y lo llama «la pieza que
         más atasca» el vacacional, así que faltaba en esta lista.
         Va con su contradicción escrita al lado, porque la hay. */
      { clave: "urbanistico", cual: "el certificado urbanístico de compatibilidad del ayuntamiento",
        busca: ["urbanistic"],
        porque: "según la tabla de papeles es la pieza que más atasca el vacacional",
        fuente: "OT-25 · vacacional · TABLA_PAPELES_Y_VENTANILLAS.md ap. 5 — OJO: " +
                "cifras_legales.json (URBANISTICO-01) dice que con ese nombre no existe; " +
                "lo que sí hay es la cédula urbanística y el informe de viabilidad urbanística" },
      { clave: "dni", cual: "el DNI, NIE o NIF del titular",
        busca: ["dni", "nie", "nif", "pasaporte", "identific"],
        porque: "sin él no se puede tramitar",
        fuente: "OT-25 · vacacional · art. 3 Ley 10/2010" }
    ]
  };

  /* ==================================================================
     2. LO QUE CADUCA  —  SOLO VIGENCIAS COMPROBADAS
     ------------------------------------------------------------------
     Aquí no entra ningún plazo «de memoria». Lo que es práctica de
     oficina va marcado como práctica y se dice como práctica, nunca
     como ley (cifras_legales.json, tabla del 18/09/2026).
     ================================================================== */

  var VIGENCIAS = [
    { clave: "energetico", desde: "emitido", anios: 10, anios_g: 5,
      ley: true,
      dice: "el certificado energético caduca a los diez años de emitirse (cinco si la letra es G)",
      fuente: "RD 390/2021 · OT-25" },
    { clave: "comunidad", desde: "pedido", dias: 7,
      ley: true,
      dice: "el administrador tiene siete días naturales para darlo",
      fuente: "art. 9.1.e Ley 49/1960 · comprobado el 18 de septiembre de 2026" }
  ];

  /* La fianza no «caduca»: lo que corre es el mes que hay para depositarla
     desde la firma del contrato. Por eso va aparte, y solo salta cuando el
     contrato está firmado y el depósito NO consta. */
  var FIANZA = { meses: 1,
    dice: "la fianza hay que depositarla en el plazo de un mes contado desde la firma del contrato, y no hacerlo es infracción grave (multa del 35 % al 100 % de la fianza no depositada)",
    fuente: "Ley 2/2014 de Canarias, art. 2.3 y art. 16 · el mes se cuenta de fecha a fecha (Código Civil, art. 5.1) · comprobado 20/09/2026" };

  /* La nota simple NO caduca por ley (Reglamento Hipotecario, art. 354.a,
     citado en la Resolución de la DGSJFP de 06/02/2023). Lo de refrescarla
     antes de la notaría es práctica de la casa, y así se dice. */
  var NOTA_ANTES_DE_FIRMAR = 2;      /* días · práctica, no ley */
  var PARADO = 21;                   /* tres semanas sin moverse */
  var PARADO_MUCHO = 40;
  var ESTA_SEMANA = 7;

  /* ==================================================================
     3. UTILIDADES
     ================================================================== */

  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  function sinTildes(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
      .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n");
  }
  function esFecha(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }
  function aISO(d) {
    var m = d.getMonth() + 1, x = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (x < 10 ? "0" : "") + x;
  }
  function masDias(iso, n) {
    if (!esFecha(iso)) return null;
    var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return aISO(d);
  }
  /* 20/09/2026 · tanda 13. UN MES NO SON 30 DÍAS.
     El art. 2.3 de la Ley 2/2014 de Canarias da «el plazo de un mes contado
     desde» la firma, y el art. 5.1 del Código Civil dice cómo se cuenta un
     plazo por meses: «se computarán de fecha a fecha» y «cuando en el mes del
     vencimiento no hubiera día equivalente al inicial del cómputo, se
     entenderá que el plazo expira el último del mes».
     Antes se sumaban 30 días: con un contrato firmado el 31 de enero daba el
     2 de marzo, cuando el último día es el 28 de febrero. Dos días tarde. */
  function masMeses(iso, n) {
    if (!esFecha(iso)) return null;
    var a = +iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10);
    var total = (m - 1) + n, anio = a + Math.floor(total / 12), mes = ((total % 12) + 12) % 12;
    var ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();   /* último día de ESE mes */
    var dia = Math.min(d, ultimo);
    return anio + "-" + (mes + 1 < 10 ? "0" : "") + (mes + 1) + "-" + (dia < 10 ? "0" : "") + dia;
  }
  function masAnios(iso, n) {
    if (!esFecha(iso)) return null;
    var d = new Date(iso + "T12:00:00"); d.setFullYear(d.getFullYear() + n); return aISO(d);
  }
  function entre(a, b) {
    if (!esFecha(a) || !esFecha(b)) return null;
    return Math.round((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000);
  }
  /* El año solo se dice cuando no es este: «el 4 de septiembre», pero
     «el 25 de septiembre de 2016», que si no parece de hace tres días. */
  function enCristiano(iso, hoy) {
    if (!esFecha(iso)) return "";
    var p = iso.split("-");
    var texto = Number(p[2]) + " de " + MESES[Number(p[1]) - 1];
    var esteAnio = String(hoy || "").slice(0, 4) || String(new Date().getFullYear());
    return p[0] === esteAnio ? texto : texto + " de " + p[0];
  }
  function elDia(iso) {
    if (!esFecha(iso)) return "";
    var d = new Date(iso + "T12:00:00");
    return DIAS[d.getDay()] + " " + d.getDate();
  }
  /* «vence el jueves 24», «se pasó hace 7 días»: como lo diría una persona */
  function cuando(iso, hoy) {
    var d = entre(iso, hoy);
    if (d === null) return "";
    if (d < -1) return "se pasó hace " + (-d) + " días";
    if (d === -1) return "se pasó ayer";
    if (d === 0) return "es hoy";
    if (d === 1) return "es mañana";
    if (d <= 7) return "es el " + elDia(iso);
    return "es el " + enCristiano(iso, hoy) + " (" + d + " días)";
  }
  /* «tres», no «3»: esto lo lee una persona, no un informe */
  var LETRA = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
  function enLetra(n) { return (n >= 0 && n <= 10) ? LETRA[n] : String(n); }
  function plural(n, uno, varios) { return enLetra(n) + " " + (n === 1 ? uno : varios); }
  /* «falta certificado energético» no lo dice nadie: aquí se escribe
     «falta el certificado energético», y «del certificado», no «de el».
     Y «faltan los últimos recibos», no «falta el últimos recibos». */
  function esPlural(t) {
    t = String(t || "").trim();
    if (/^(los|las)\s/i.test(t)) return true;
    if (/^(el|la|un|una)\s/i.test(t)) return false;
    return /s$/i.test(t.split(/\s+/)[0] || "");
  }
  function conEl(t) {
    t = String(t || "").trim();
    if (/^(el|la|los|las|un|una|mi|tu|su)\s/i.test(t)) return t;
    var uno = sinTildes(t.split(/\s+/)[0] || "");
    if (/s$/.test(uno)) return "los " + t;
    if (/(a|cion|sion|dad|tad|umbre|cia)$/.test(uno)) return "la " + t;
    return "el " + t;
  }
  function conDel(t) {
    t = conEl(t);
    if (/^el /i.test(t)) return "del " + t.slice(3);
    if (/^los /i.test(t)) return "de los " + t.slice(4);
    if (/^la /i.test(t)) return "de la " + t.slice(3);
    if (/^las /i.test(t)) return "de las " + t.slice(4);
    return "de " + t;
  }
  function enumerar(l) {
    if (!l.length) return "";
    if (l.length === 1) return l[0];
    return l.slice(0, -1).join(", ") + " y " + l[l.length - 1];
  }
  function hoyISO() { return aISO(new Date()); }

  /* ==================================================================
     4. LEER UN EXPEDIENTE SIN SUPONER NADA
     ================================================================== */

  /* venta / alquiler / vacacional. Si el propio expediente dice que el
     tipo está sin confirmar, aquí se devuelve null y no se pide NADA:
     antes de pedir papeles hay que saber de qué operación se habla. */
  function queOperacion(t) {
    var s = sinTildes(t);
    if (!s) return null;
    if (/sin confirmar|supuesto|por confirmar/.test(s)) return null;
    if (/vacacional|turistic/.test(s)) return "vacacional";
    if (/alquiler|arrendamiento/.test(s)) return "alquiler";
    if (/venta|compraventa/.test(s)) return "venta";
    return null;
  }

  /* «todos», «el resto del expediente»: eso no es un papel, es un hueco */
  function esGenerico(cual) {
    var s = sinTildes(cual).trim();
    return s === "todos" || s === "todo" || /resto del expediente/.test(s);
  }

  function comoSeLlama(e) {
    var v = (e && e.vivienda) || {};
    var t = [];
    if (v.via) t.push(String(v.via));
    if (v.piso) t.push(String(v.piso));
    if (t.length) return t.join(", ");
    if (e && e.nombre) return String(e.nombre);
    var lit = String(v.direccion_literal || "").split("—")[0].replace(/\(EJEMPLO\)/gi, "").trim();
    if (lit) return lit;
    return "el expediente sin dirección";
  }

  /* La misma casa escrita de dos maneras sigue siendo la misma casa. */
  function huellaDeLaCasa(e) {
    var v = (e && e.vivienda) || {};
    if (!v.via || !v.municipio) return null;
    return sinTildes(v.via).replace(/[^a-z0-9]/g, "") + "|" +
           sinTildes(v.piso || "").replace(/[^a-z0-9]/g, "") + "|" +
           sinTildes(v.municipio).replace(/[^a-z0-9]/g, "");
  }

  function casaEn(doc, entrada) {
    var s = sinTildes(doc && doc.cual);
    for (var i = 0; i < entrada.busca.length; i++) {
      if (s.indexOf(entrada.busca[i]) >= 0) return true;
    }
    return false;
  }

  function buscaDoc(docs, entrada) {
    for (var i = 0; i < docs.length; i++) if (casaEn(docs[i], entrada)) return docs[i];
    return null;
  }

  /* Un papel está «en la carpeta» si consta recibido o verificado.
     Que conste no quiere decir que esté bien: esto solo ve que está. */
  function estaEnLaCarpeta(doc) {
    var s = sinTildes(doc && doc.estado_documento);
    return s === "recibido" || s === "verificado";
  }

  /* Las fechas sueltas que un papel menciona en su texto y que no tienen
     papel propio. Es de donde salen las contradicciones de fechas. */
  /* ------------------------------------------------------------------
     ARREGLO DEL 23/09/2026 · UNA FECHA QUE EL PAPEL DICE DE SÍ MISMO NO
     ES UN PAPEL QUE FALTE
     ------------------------------------------------------------------
     Lo que pasaba (nivel 7 del campo de entrenamiento, expediente
     «Doble Fecha 21»): un certificado energético que lleva dentro la
     línea «Válido hasta: 07/11/2026» hacía saltar el aviso «Hay una
     fecha apuntada que no tiene papel». Esa fecha está DENTRO del papel
     que se está mirando: no falta ningún papel, y no puede faltar.
     Mandaba a la agencia a buscar algo que no existe.

     La diferencia está en lo que la fecha anuncia:
       · una fecha que anuncia OTRO trámite («hay que escriturar antes
         del…», nivel 2) -> el aviso está bien y sigue saliendo;
       · una fecha que habla DEL PROPIO PAPEL («válido hasta», «caduca
         el», «emitido el») -> ahí no falta nada: lo que toca decir es
         cuándo deja de valer ese papel.
     Por eso cada fecha del texto sale ahora con su etiqueta, que se lee
     de las palabras que tiene justo delante (o entre paréntesis detrás,
     que es como las deja deduccion.js).
     ------------------------------------------------------------------ */
  var RE_VALIDEZ = /(valido|valida|validez|caduca|caducidad|vence|vencimiento|expira|expiracion)[^0-9]{0,20}$/;
  var RE_EMISION = /(emitid[oa]|expedid[oa]|fecha de emision|fecha del documento|firmad[oa]|de fecha)[^0-9]{0,20}$/;

  function etiquetaDeLaFecha(texto, desde, hasta) {
    var antes = sinTildes(String(texto).slice(Math.max(0, desde - 40), desde));
    var detras = String(texto).slice(hasta, hasta + 34);
    var entreParentesis = /^\s*\(([^)]{0,30})\)/.exec(detras);
    var etiqueta = entreParentesis ? sinTildes(entreParentesis[1]) + " " : "";
    if (RE_VALIDEZ.test(antes) || RE_VALIDEZ.test(etiqueta)) return "validez";
    if (RE_EMISION.test(antes) || RE_EMISION.test(etiqueta)) return "emision";
    return null;
  }

  /* Las fechas del texto, cada una con su etiqueta (o sin ninguna). */
  function fechasEtiquetadas(t) {
    var s = String(t || ""), out = [], m, re = /(\d{2})\/(\d{2})\/(\d{4})/g;
    while ((m = re.exec(s))) {
      out.push({ iso: m[3] + "-" + m[2] + "-" + m[1], crudo: m[0],
                 etiqueta: etiquetaDeLaFecha(s, m.index, m.index + m[0].length) });
    }
    return out;
  }

  /* La fecha de caducidad que el propio papel declara, si la declara. */
  function validezQueDiceElPapel(d) {
    var fuera = null;
    fechasEtiquetadas(d && d.literal_en_OT25).forEach(function (f) {
      if (!fuera && f.etiqueta === "validez") fuera = f;
    });
    return fuera;
  }

  function fechasDelTexto(t) {
    return fechasEtiquetadas(t).map(function (f) { return f.iso; });
  }

  /* ==================================================================
     5. EL REPASO DE UN EXPEDIENTE
     ================================================================== */

  function nuevo(exp, clase, urgencia, titulo, detalle, fuente, vence) {
    return { exp: exp.id, donde: exp.donde, clase: clase, urgencia: urgencia,
             titulo: titulo, detalle: detalle || "", fuente: fuente || "",
             vence: vence || null };
  }

  function mirarUno(e, hoy) {
    var id = String((e && (e.expediente_id || e.id)) || "sin número");
    var donde = comoSeLlama(e);
    var yo = { id: id, donde: donde, huella: huellaDeLaCasa(e),
               propietario: (e && e.propietario && e.propietario.nombre) || null,
               operacion: queOperacion(e && e.tipo_operacion),
               faltan: [], hallazgos: [], plazos: [] };
    var docs = ((e && e.documentos) || []).filter(function (d) { return d && d.cual; });
    var carpeta = yo.operacion ? CARPETA[yo.operacion] : null;
    var h = yo.hallazgos;

    /* ------------------------------------------------------------------
       ARREGLO DEL 20/09/2026 · UNA VENTA YA ESCRITURADA ES HISTORIA
       ------------------------------------------------------------------
       Lo que pasaba: una venta firmada en enero salía en «lo que te
       frena hoy», arriba del todo y por orden de urgencia, con avisos
       de papeles que le faltaban y con «lleva 244 días sin moverse».
       Claro que lleva 244 días sin moverse: está vendida. Cualquier
       expediente antiguo y cerrado de su mesa haría lo mismo el lunes.

       Si consta LA ESCRITURA DE ESTA COMPRAVENTA y su fecha ya pasó,
       esta venta está cerrada y aquí no se dice ni una cosa más. No es
       urgente, es historia. En «Tus expedientes» sigue viéndose, con
       su fase, que es donde le toca estar.

       CUIDADO CON UNA COSA, y por eso la condición es tan estrecha: en
       la carpeta de un expediente hay muchas veces la ESCRITURA
       ANTERIOR, la del dueño actual, que no cierra nada. Confundirlas
       haría callar un expediente vivo, que es peor que el fallo que se
       arregla. Por eso se pide que diga «de compraventa» y que NO diga
       «anterior», «previa», «antigua» ni «herencia».
       ------------------------------------------------------------------ */
    var LA_ESCRITURA_DE_ESTA_VENTA = /escritura\s*(publica\s*)?de\s*(compra\s*venta|compraventa|venta)/;
    var NO_ES_LA_DE_ESTA_VENTA = /anterior|previa|antigua|herencia|del vendedor|de origen/;
    if (yo.operacion === "venta") {
      var escritura = null;
      docs.forEach(function (d) {
        if (escritura) return;
        var n = sinTildes(d.cual) + " " + sinTildes(d.literal_en_OT25 || "");
        if (!LA_ESCRITURA_DE_ESTA_VENTA.test(n)) return;
        if (NO_ES_LA_DE_ESTA_VENTA.test(n)) return;
        if (!estaEnLaCarpeta(d)) return;
        if (esFecha(d.fecha)) {
          var q = entre(d.fecha, hoy);
          if (q !== null && q > 0) return;       /* una escritura con fecha futura no ha cerrado nada */
        }
        escritura = d;
      });
      if (escritura) {
        yo.cerrada = { por: "la escritura de compraventa", fecha: escritura.fecha || null };
        return yo;      /* ni un aviso: está vendida */
      }
    }

    /* ---- 5.1 datos básicos: si no están, no se supone nada ---- */
    var v = (e && e.vivienda) || {};
    var ciego = [];
    /* ------------------------------------------------------------------
       ARREGLO DEL 18/09/2026 (EL_WOW_DEL_LUNES) — ÚNICO CAMBIO DE ESTE
       FICHERO RESPECTO AL ORIGINAL DE WOW_REPASO / PRIMER_MINUTO.
       Antes esta línea era:
           if (!v.via || !v.municipio) ciego.push("la dirección exacta");
       Con la calle conocida y el municipio no, decía «me falta la
       dirección exacta» en un aviso cuyo propio título ERA la dirección.
       Salió 25 veces sobre 25 expedientes en el banco de pruebas.
       Ahora se distingue: si no hay calle, falta la dirección; si hay
       calle y no municipio, falta el municipio, que es la verdad y no
       impide repasar. CONVIENE LLEVAR ESTE ARREGLO A LOS OTROS DOS.
       ------------------------------------------------------------------ */
    if (!v.via) ciego.push("la dirección exacta");
    /* El municipio NO se pide aquí, a propósito: sin él se repasa igual de
       bien (lo único que se pierde es el cruce de fincas repetidas).
       Pedirlo hacía que un expediente con su calle y todos sus papeles
       saliera con un «No sé lo suficiente para repasarlo» encima de un
       repaso completo, que es contradecirse en dos líneas. */
    if (!(e && e.propietario && e.propietario.nombre)) ciego.push("el nombre del propietario");
    if (!yo.operacion) ciego.push("si es venta, alquiler o vacacional");
    /* ------------------------------------------------------------------
       ARREGLO DEL 23/09/2026 · EL MOTIVO DE VERDAD, NO UNO CUALQUIERA
       ------------------------------------------------------------------
       Cuando en un portal se conocen dos pisos y el papel no dice cuál
       es, la regla de la casa deja el papel aparte — y eso está bien.
       Lo que estaba mal es lo que se decía en pantalla: «me falta el
       nombre del propietario y si es venta, alquiler o vacacional».
       Eso hace creer que se arregla poniendo el propietario, y no se
       arregla: aunque lo supiera, seguiría sin saber si es el 1ºA o el
       4ºC. Aquí se dice el motivo de verdad, y el genérico se calla.
       ------------------------------------------------------------------ */
    var sinRepartir = e && e._sin_repartir;
    if (sinRepartir) {
      h.push(nuevo(yo, "incompleto", 60,
        "Este papel no dice de qué piso es",
        "En " + sinRepartir.portal + " conozco " +
        (sinRepartir.pisos.length === 2 ? "dos pisos" : sinRepartir.pisos.length + " pisos") +
        (sinRepartir.pisos.length ? ", el " + sinRepartir.pisos.join(" y el ") : "") +
        ", y este papel no dice cuál es. No lo reparto a ciegas: lo dejo aparte hasta que alguien " +
        "mire el papel y me diga de cuál es.",
        "regla de la casa: sin datos, no se supone"));
      ciego = [];
    }
    if (e && e._piso_supuesto) {
      h.push(nuevo(yo, "incompleto", 40,
        "He supuesto de qué piso es",
        "El papel no dice el piso. He supuesto que es el " +
        (e._piso_supuesto.piso || "que conozco") + ", porque es el único piso que conozco de " +
        e._piso_supuesto.portal + ". Si no es ése, dímelo y lo cambio.",
        "lo he supuesto yo, y por eso te lo digo"));
    }
    if (ciego.length) {
      h.push(nuevo(yo, "incompleto", 60,
        "No sé lo suficiente para repasarlo",
        "Me falta " + enumerar(ciego) + ". Hasta que no lo tenga, no te voy a decir qué papel falta ni qué plazo corre: me lo estaría inventando.",
        "regla de la casa: sin datos, no se supone"));
    }

    /* ---- 5.2 qué papel falta ----
       (a) lo que el propio expediente declara como «falta»
       (b) lo que la tabla de OT-25 pide y no aparece por ningún lado    */
    docs.forEach(function (d) {
      if (sinTildes(d.estado_documento) !== "falta") return;
      if (esGenerico(d.cual)) {
        h.push(nuevo(yo, "incompleto", 62,
          "Está apenas empezado",
          "Tu propio expediente dice: «" + String(d.literal_en_OT25 || d.cual) + "». No voy a adivinar cuáles son: "
            + (yo.operacion
                ? "te pongo abajo los que la tabla pide para una " + (yo.operacion === "venta" ? "venta" : yo.operacion === "alquiler" ? "vivienda en alquiler" : "vivienda vacacional") + "."
                : "dime si es venta, alquiler o vacacional y te doy la lista."),
          "lo dice tu expediente"));
        return;
      }
      var clave = null, porque = "", fuente = "lo dice tu expediente";
      if (carpeta) {
        for (var i = 0; i < carpeta.length; i++) {
          if (casaEn(d, carpeta[i])) { clave = carpeta[i].clave; porque = carpeta[i].porque; fuente = carpeta[i].fuente; break; }
        }
      }
      var falta1 = { clave: clave || sinTildes(d.cual), cual: d.cual, duro: true };
      yo.faltan.push(falta1);
      /* el aviso queda enganchado al «falta» que lo produjo: así, si luego
         el aviso se calla, este «falta» tampoco cuenta en el parte */
      falta1._aviso = nuevo(yo, "falta", porque ? 75 : 70,
        (esPlural(d.cual) ? "Faltan " : "Falta ") + conEl(d.cual),
        (porque ? porque.charAt(0).toUpperCase() + porque.slice(1) + ". " : "") +
        "Tu expediente lo tiene apuntado como que falta.",
        fuente);
      h.push(falta1._aviso);
    });

    if (carpeta) {
      carpeta.forEach(function (p) {
        var d = buscaDoc(docs, p);
        if (d) {
          /* está nombrado: si sigue pedido, cuenta como que aún no lo tienes */
          if (sinTildes(d.estado_documento) === "pedido") {
            yo.faltan.push({ clave: p.clave, cual: p.cual, duro: false, pedido: true });
          }
          return;
        }
        var falta2 = { clave: p.clave, cual: p.cual, duro: false };
        yo.faltan.push(falta2);
        falta2._aviso = nuevo(yo, "falta", 55,
          (esPlural(p.cual) ? "No aparecen " : "No aparece ") + p.cual,
          "No digo que no lo tengas: digo que en este expediente no está puesto. " +
          p.porque.charAt(0).toUpperCase() + p.porque.slice(1) + ".",
          p.fuente);
        h.push(falta2._aviso);
      });
    }

    /* ---- 5.3 qué caduca y cuándo ---- */
    docs.forEach(function (d) {
      /* Si el papel trae escrito hasta cuándo vale, eso manda sobre
         cualquier cuenta nuestra: es lo que dice el documento. */
      var suya = estaEnLaCarpeta(d) ? validezQueDiceElPapel(d) : null;
      if (suya) {
        var qs = entre(suya.iso, hoy);
        if (qs !== null && qs <= 90) {
          var us = qs < 0 ? 100 : qs === 0 ? 95 : qs <= 2 ? 90 : qs <= ESTA_SEMANA ? 80 : qs <= 15 ? 60 : 35;
          var plazoSuyo = { fecha: suya.iso, que: conEl(d.cual), dias: qs };
          yo.plazos.push(plazoSuyo);
          plazoSuyo._aviso = nuevo(yo, qs < 0 ? "vencido" : "vence", us,
            (qs < 0 ? "Está caducado " + conEl(d.cual) : "Caduca " + conEl(d.cual)),
            "Lo pone el propio papel: «" + suya.crudo + "». " +
            (qs < 0 ? "Lleva sin valer desde el " + enCristiano(suya.iso, hoy) + "."
                    : "Deja de valer " + cuando(suya.iso, hoy).replace(/^es /, "") + "."),
            "lo que dice el propio papel", suya.iso);
          h.push(plazoSuyo._aviso);
        }
      }
      VIGENCIAS.forEach(function (vg) {
        if (suya) return;          /* ya lo ha dicho el papel, no lo calculamos nosotros */
        var entrada = null;
        for (var k in CARPETA) {
          for (var i = 0; i < CARPETA[k].length; i++) {
            if (CARPETA[k][i].clave === vg.clave) { entrada = CARPETA[k][i]; break; }
          }
          if (entrada) break;
        }
        if (!entrada || !casaEn(d, entrada)) return;

        /* el reloj de los siete días solo corre sobre lo que está pedido */
        if (vg.desde === "pedido" && sinTildes(d.estado_documento) !== "pedido") return;
        if (vg.desde === "emitido" && !estaEnLaCarpeta(d)) return;

        if (!esFecha(d.fecha)) {
          if (vg.desde === "emitido") {
            h.push(nuevo(yo, "incompleto", 50,
              "No puedo comprobar si " + conEl(d.cual) + " sigue vigente",
              "Pone que está vigente, pero no hay fecha de emisión, así que " + vg.dice + " y yo no sé desde cuándo cuenta. Ponme la fecha y te aviso.",
              vg.fuente));
          }
          return;
        }

        var tope = null;
        if (vg.anios) {
          var esG = /\(letra g\)|letra g\b/.test(sinTildes(d.cual));
          tope = masAnios(d.fecha, esG ? (vg.anios_g || vg.anios) : vg.anios);
        } else if (vg.dias) {
          tope = masDias(d.fecha, vg.dias);
        }
        if (!tope) return;

        var q = entre(tope, hoy);
        var u = q < 0 ? 100 : q === 0 ? 95 : q <= 2 ? 90 : q <= ESTA_SEMANA ? 80 : q <= 15 ? 60 : 35;
        if (q > 90) return;   /* dentro de tres meses no es noticia de hoy */

        var plazo1 = { fecha: tope, que: conEl(d.cual), dias: q };
        yo.plazos.push(plazo1);
        plazo1._aviso = nuevo(yo, q < 0 ? "vencido" : "vence", u,
          (vg.desde === "emitido"
            ? (q < 0 ? "Está caducado " + conEl(d.cual) : "Caduca " + conEl(d.cual))
            : (q < 0 ? "Se pasó el plazo " : "Se acaba el plazo ") + conDel(d.cual)),
          (vg.desde === "pedido"
            ? "Lo pediste el " + enCristiano(d.fecha, hoy) + " y " + vg.dice + ": el plazo " + cuando(tope, hoy) + "."
              + (q < 0 ? " Toca reclamarlo por escrito." : "")
            : vg.dice.charAt(0).toUpperCase() + vg.dice.slice(1) + ". El que tienes es del " + enCristiano(d.fecha, hoy)
              + ", así que " + (q < 0 ? "lleva caducado desde el " + enCristiano(tope, hoy)
                                      : "caduca " + cuando(tope, hoy).replace(/^es /, "")) + "."),
          vg.fuente, tope);
        h.push(plazo1._aviso);
      });

      /* la cita de notaría es una fecha, no un papel que caduque */
      if (/notaria/.test(sinTildes(d.cual)) && esFecha(d.fecha) && estaEnLaCarpeta(d)) {
        var qn = entre(d.fecha, hoy);
        if (qn !== null && qn >= 0 && qn <= 30) {
          yo.plazos.push({ fecha: d.fecha, que: "la notaría", dias: qn });
          h.push(nuevo(yo, "vence", qn <= 2 ? 90 : qn <= ESTA_SEMANA ? 78 : 55,
            "Firma en notaría",
            "La firma " + cuando(d.fecha, hoy) + ".", "lo dice tu expediente", d.fecha));
        }
      }
    });

    /* la nota simple no caduca por ley; refrescarla antes de firmar es
       práctica de la casa, y aquí se dice como práctica */
    (function () {
      if (yo.operacion !== "venta") return;
      var firma = null;
      docs.forEach(function (d) {
        if (/notaria/.test(sinTildes(d.cual)) && esFecha(d.fecha) && estaEnLaCarpeta(d)) firma = d.fecha;
      });
      if (!firma) return;
      /* ------------------------------------------------------------------
         ARREGLO DEL 20/09/2026 · SI LA FIRMA YA PASÓ, ESTO NO SE DICE.
         Antes esto no miraba la fecha. Con una venta escriturada hace
         ocho meses salía, en «lo que te frena hoy» y en futuro:
           «Firmas el martes 20, así que pide una nueva antes del
            domingo 18» — y debajo, «hace 246 días».
         Mandarle hacer algo antes de una fecha que pasó hace ocho meses
         no es un aviso: es un error que se ve a un metro. Si la firma ya
         pasó, esa venta es historia, y aquí no se dice nada.
         ------------------------------------------------------------------ */
      var haciaLaFirma = entre(firma, hoy);
      if (haciaLaFirma === null || haciaLaFirma < 0) return;
      var nota = null;
      docs.forEach(function (d) {
        if (/nota simple/.test(sinTildes(d.cual)) && estaEnLaCarpeta(d) && esFecha(d.fecha)) {
          if (!nota || d.fecha > nota) nota = d.fecha;
        }
      });
      if (!nota) return;
      var edad = -entre(nota, hoy);
      if (edad < 30) return;
      var pedirla = masDias(firma, -NOTA_ANTES_DE_FIRMAR);
      h.push(nuevo(yo, "vence", 72,
        "La nota simple que tienes ya tiene " + edad + " días",
        "No caduca por ley, pero no recoge las cargas que hayan entrado después. Firmas el " + elDia(firma)
          + ", así que pide una nueva antes del " + elDia(pedirla) + ".",
        "práctica de la casa (OT-25) · la nota simple no caduca por norma (art. 354.a Reglamento Hipotecario)",
        pedirla));
    })();

    /* ---- 5.4 bis · la parte vendedora podría no ser residente ----
       ----------------------------------------------------------------
       La señal es de papel: el titular se identifica con pasaporte y no
       con DNI ni con NIE. De ahí NO se concluye que no sea residente —
       eso no lo dice ningún papel de la carpeta — se concluye que hay
       que preguntarlo, y cuanto antes.

       Lo que sí está confirmado es la consecuencia: si la parte
       vendedora no es residente fiscal en España, el comprador está
       obligado a retener el 3 % y a presentar el modelo 211, y si no lo
       hace responde él de la deuda (TABLA_PAPELES_Y_VENTANILLAS.md ap. 3,
       marcado ✅ INV-02 «la obligación»).

       El PLAZO del modelo 211 va en esa misma tabla como ⚠️ NO VERIFICADO
       y en su lista de lo que falta por confirmar. Así que aquí no se da
       ninguna fecha: se dice la obligación y se dice que el plazo no
       está confirmado. Una cifra que no se puede defender no se pinta.
       ---------------------------------------------------------------- */
    (function () {
      if (yo.operacion !== "venta") return;
      var pas = null;
      docs.forEach(function (d) {
        if (!pas && d._titular_con_pasaporte && estaEnLaCarpeta(d)) pas = d;
      });
      if (!pas) return;
      h.push(nuevo(yo, "incompleto", 74,
        "Pregunta si la parte vendedora es residente fiscal en España",
        "En " + conEl(pas.cual) + " el titular no se identifica con DNI ni con NIE, sino con pasaporte («" +
        pas._titular_con_pasaporte.frase + "»). No digo que no sea residente: digo que no lo sé y que hay que " +
        "preguntarlo ahora, no el día de la firma. Si no lo es, el comprador está obligado a retener el 3 % del " +
        "precio y a presentar el modelo 211 ante la AEAT, y si no lo hace responde él de esa deuda. " +
        "El plazo del 211 no te lo doy: en mi tabla está sin confirmar y no me lo invento.",
        "TABLA_PAPELES_Y_VENTANILLAS.md ap. 3 — la obligación está verificada (INV-02); el plazo de un mes figura como NO VERIFICADO"));
    })();

    /* la fianza: el mes corre desde que se firma el contrato, y solo
       importa mientras el depósito no conste */
    (function () {
      if (yo.operacion !== "alquiler" || !carpeta) return;
      var eContrato = null, eFianza = null;
      carpeta.forEach(function (p) {
        if (p.clave === "contrato") eContrato = p;
        if (p.clave === "fianza") eFianza = p;
      });
      var dc = eContrato && buscaDoc(docs, eContrato);
      var df = eFianza && buscaDoc(docs, eFianza);
      if (!dc || !esFecha(dc.fecha) || !estaEnLaCarpeta(dc)) return;
      if (df && estaEnLaCarpeta(df)) return;            /* ya está depositada */
      var tope = masMeses(dc.fecha, FIANZA.meses);
      var q = entre(tope, hoy);
      if (q === null || q > 60) return;
      yo.plazos.push({ fecha: tope, que: "el depósito de la fianza", dias: q });
      h.push(nuevo(yo, q < 0 ? "vencido" : "vence", q < 0 ? 100 : q <= ESTA_SEMANA ? 82 : 60,
        (q < 0 ? "Se pasó el plazo de depositar la fianza" : "Hay que depositar la fianza"),
        "El contrato se firmó el " + enCristiano(dc.fecha, hoy) + " y " + FIANZA.dice + ": el plazo " + cuando(tope, hoy) + ".",
        FIANZA.fuente, tope));
    })();

    /* ---- 5.4 qué lleva parado ---- */
    var mov = (e && e.ultimo_movimiento) || {};
    if (esFecha(mov.fecha)) {
      var quieto = -entre(mov.fecha, hoy);
      if (quieto >= PARADO) {
        /* parado no es lo mismo que abandonado: si hay algo pedido y sin
           llegar, el expediente está esperando a otro, y eso se dice */
        var esperando = null;
        docs.forEach(function (d) {
          if (sinTildes(d.estado_documento) === "pedido" && !esperando) esperando = d;
        });
        h.push(nuevo(yo, "parado", quieto >= PARADO_MUCHO ? 72 : 65,
          "Lleva " + quieto + " días sin moverse",
          "Lo último que consta es del " + enCristiano(mov.fecha, hoy)
            + (mov.que ? ": " + String(mov.que) : ", y ni siquiera pone qué fue") + "."
            + (esperando
                ? " No está abandonado: está esperando " + conEl(esperando.cual) + ". Ya toca preguntar por él."
                : " Aquí no espera nadie de fuera: se ha quedado parado y ya está."),
          "cuenta de días sobre tu expediente"));
      }
      /* el diario se ha quedado atrás respecto a los papeles */
      var ultimoPapel = null;
      docs.forEach(function (d) {
        if (esFecha(d.fecha) && d.fecha <= hoy && (!ultimoPapel || d.fecha > ultimoPapel)) ultimoPapel = d.fecha;
      });
      if (ultimoPapel && ultimoPapel > mov.fecha) {
        h.push(nuevo(yo, "choca", 58,
          "El diario y los papeles no cuadran",
          "El último movimiento apuntado es del " + enCristiano(mov.fecha, hoy)
            + ", pero hay un papel con fecha del " + enCristiano(ultimoPapel, hoy) + ". Uno de los dos está mal.",
          "cruce de fechas dentro del mismo expediente"));
      }
    } else if (docs.length) {
      h.push(nuevo(yo, "incompleto", 45,
        "No sé cuándo se tocó por última vez",
        "No hay fecha de último movimiento, así que no puedo decirte si está parado o no.",
        "regla de la casa: sin datos, no se supone"));
    }

    /* ---- 5.5 fechas sueltas: se nombran y no tienen papel ---- */
    docs.forEach(function (d) {
      fechasEtiquetadas(d.literal_en_OT25).forEach(function (x) {
        var f = x.iso;
        if (f === d.fecha) return;
        /* ARREGLO 23/09/2026: si la fecha habla del propio papel («válido
           hasta», «emitido el»), no falta ningún papel. Lo que caduca ya
           se ha dicho arriba, en 5.3. */
        if (x.etiqueta) return;
        var tienePapel = docs.some(function (o) { return o.fecha === f; });
        if (tienePapel) return;
        var q = entre(f, hoy);
        if (q === null || q < 0 || q > 60) return;
        yo.plazos.push({ fecha: f, que: "la fecha que apunta " + conEl(d.cual), dias: q });
        h.push(nuevo(yo, "choca", 76,
          "Hay una fecha apuntada que no tiene papel",
          "En el texto de «" + String(d.cual) + "» pone el " + enCristiano(f, hoy)
            + ", pero en el expediente no hay ningún papel con esa fecha. O falta el papel, o la fecha es vieja.",
          "cruce de fechas dentro del mismo expediente", f));
      });
    });

    h.sort(function (a, b) { return b.urgencia - a.urgencia; });
    yo.urgencia = h.length ? h[0].urgencia : 0;
    /* «tranquilo» = no le falta ningún papel y no tiene firma a la vista.
       Es justo el expediente que nadie abre, y donde peor sienta un susto. */
    yo.tranquilo = !yo.faltan.some(function (f) { return f.duro || f.pedido; })
                && !yo.plazos.some(function (z) { return /notaria|firma/.test(sinTildes(z.que)); });
    return yo;
  }

  /* ==================================================================
     6. LO QUE SOLO SE VE MIRÁNDOLOS TODOS A LA VEZ
     ------------------------------------------------------------------
     Esto es lo que ella no sabe esta mañana: no está en ninguna de sus
     pantallas, porque cada pantalla enseña un expediente.
     ================================================================== */

  function patrones(unos, hoy) {
    var p = { atasco: null, duplicados: [], choques: [], parados: [], cerca: [] };

    /* 6.1 el papel que se repite en media cartera */
    var cuenta = {};
    unos.forEach(function (u) {
      var vistos = {};
      u.faltan.forEach(function (f) {
        if (vistos[f.clave]) return;
        vistos[f.clave] = true;
        if (!cuenta[f.clave]) cuenta[f.clave] = { clave: f.clave, cual: f.cual, cuantos: 0, donde: [] };
        cuenta[f.clave].cuantos++;
        cuenta[f.clave].donde.push(u.donde);
      });
    });
    Object.keys(cuenta).forEach(function (k) {
      if (cuenta[k].cuantos < 2) return;
      if (!p.atasco || cuenta[k].cuantos > p.atasco.cuantos) p.atasco = cuenta[k];
    });

    /* 6.2 el mismo piso metido dos veces */
    var porCasa = {};
    unos.forEach(function (u) {
      if (!u.huella) return;
      (porCasa[u.huella] = porCasa[u.huella] || []).push(u);
    });
    Object.keys(porCasa).forEach(function (k) {
      if (porCasa[k].length < 2) return;
      var duenos = porCasa[k].map(function (u) { return u.propietario || "sin nombre"; });
      var distintos = duenos.filter(function (x, i) { return duenos.indexOf(x) === i; }).length > 1;
      p.duplicados.push({ donde: porCasa[k][0].donde, cuantos: porCasa[k].length,
                          expedientes: porCasa[k].map(function (u) { return u.id; }),
                          duenos_distintos: distintos });
    });

    /* 6.3 dos relojes que caen el mismo día */
    var porDia = {};
    unos.forEach(function (u) {
      u.plazos.forEach(function (z) {
        if (z.dias === null || z.dias < 0 || z.dias > 30) return;
        (porDia[z.fecha] = porDia[z.fecha] || []).push({ donde: u.donde, id: u.id, que: z.que, dias: z.dias });
      });
    });
    Object.keys(porDia).sort().forEach(function (f) {
      if (porDia[f].length < 2) return;
      var ids = porDia[f].map(function (x) { return x.id; });
      p.choques.push({ fecha: f, dias: porDia[f][0].dias, cosas: porDia[f],
                       mismo_expediente: ids.every(function (x) { return x === ids[0]; }) });
    });
    p.choques.sort(function (a, b) { return a.dias - b.dias; });

    /* 6.4 los parados y los que corren */
    unos.forEach(function (u) {
      u.hallazgos.forEach(function (x) {
        if (x.clase === "parado") p.parados.push(x);
        if (x.clase === "vence" && x.vence) {
          var q = entre(x.vence, hoy);
          if (q !== null && q >= 0 && q <= ESTA_SEMANA) p.cerca.push({ dias: q, x: x, tranquilo: u.tranquilo });
        }
      });
    });
    p.cerca.sort(function (a, b) { return a.dias - b.dias; });
    /* cuántos EXPEDIENTES, no cuántos avisos: ella lleva casos, no líneas */
    function cuantosExp(l, dame) {
      var v = {}; l.forEach(function (x) { v[dame(x)] = 1; }); return Object.keys(v).length;
    }
    p.expedientes_con_prisa = cuantosExp(p.cerca, function (x) { return x.x.exp; });
    p.expedientes_parados = cuantosExp(p.parados, function (x) { return x.exp; });
    return p;
  }

  /* ==================================================================
     7. EL PARTE: CINCO LÍNEAS Y UNA PREGUNTA
     ------------------------------------------------------------------
     Un parte de treinta líneas no impresiona a nadie. Se escoge lo que
     más corre y, sobre todo, lo que ella NO puede ver en su pantalla.
     ================================================================== */

  var TOPE_LINEAS = 5;

  function parte(r) {
    if (!r || !r.cuantos) {
      return ["Todavía no tienes ningún expediente encima de la mesa.",
              "Abre el primero y te lo repaso entero: qué papel falta, qué caduca y qué lleva parado. Tardo un segundo y no gasta nada."];
    }

    var hoy = r.hoy, p = r.patrones, l = [];

    /* línea 1 · el titular, con los números */
    var vencidos = {};
    r.hallazgos.forEach(function (x) { if (x.clase === "vencido") vencidos[x.exp] = 1; });
    var nVencidos = Object.keys(vencidos).length;
    var trozos = [];
    if (p.expedientes_con_prisa) {
      trozos.push(plural(p.expedientes_con_prisa, "tiene algo encima esta semana", "tienen algo encima esta semana")
                  + ", lo primero el " + elDia(p.cerca[0].x.vence));
    }
    if (nVencidos) trozos.push(nVencidos === 1 ? "en uno el plazo legal ya se pasó"
                                               : "en " + enLetra(nVencidos) + " el plazo legal ya se pasó");
    if (p.expedientes_parados) trozos.push(plural(p.expedientes_parados, "lleva más de tres semanas parado", "llevan más de tres semanas parados"));
    /* SINGULAR Y PLURAL, BIEN. Antes ponía «He mirado tus 1 expedientes»,
       que es la frase más grande de la pantalla y la que más delata que
       esto lo ha escrito un programa. ARREGLO DEL 20/09/2026. */
    l.push((r.cuantos === 1 ? "He mirado tu único expediente." : "He mirado tus " + r.cuantos + " expedientes.")
           + (trozos.length ? " " + capital(enumerar(trozos)) + "." : " Hoy no corre nada."));

    /* línea 2 · el atasco de toda la cartera: esto no se ve de uno en uno */
    if (p.atasco) {
      /* «te frena dos de los 1» tampoco se dice. Si solo hay un
         expediente, el atasco no es un patrón de la cartera: es ese
         expediente, y así se cuenta. */
      if (r.cuantos <= 1) {
        l.push(capital(p.atasco.cual) + " es lo que te frena aquí.");
      } else {
        l.push(capital(p.atasco.cual) + " te frena " + enLetra(p.atasco.cuantos) + " de los " + enLetra(r.cuantos)
               + ": no es un caso suelto, es tu atasco número uno.");
      }
    }

    /* línea 3 · el mismo piso dos veces */
    p.duplicados.slice(0, 1).forEach(function (d) {
      l.push("El mismo piso está dos veces: " + d.donde
             + (d.duenos_distintos ? ", a nombre de dos propietarios distintos" : "")
             + ". Míralo antes de seguir con ninguno de los dos.");
    });

    /* línea 4 · dos relojes el mismo día
       ------------------------------------------------------------------
       ARREGLO DEL 20/09/2026. Antes salía «chocan dos relojes: el
       certificado de estar al día en la comunidad de propietarios Y el
       certificado de estar al día en la comunidad de propietarios»: la
       misma cosa nombrada dos veces. Pasa cuando los dos plazos que
       caen ese día son el mismo tipo de papel en DOS expedientes
       distintos — que es justo lo interesante y es lo que no se decía.

       La regla: si las dos cosas se llaman igual, lo que hay que
       nombrar son los dos expedientes, no dos veces el papel. Y si de
       verdad son la misma cosa en el mismo expediente, entonces no hay
       choque y no se dice nada. */
    p.choques.slice(0, 1).forEach(function (c) {
      var qs = c.cosas.map(function (x) { return x.que; });
      var donde = c.cosas.map(function (x) { return x.donde; });
      var qsDistintas = qs.filter(function (x, i) { return qs.indexOf(x) === i; });
      var dondeDistintos = donde.filter(function (x, i) { return donde.indexOf(x) === i; });

      if (qsDistintas.length >= 2) {
        /* dos cosas distintas: como siempre */
        l.push("El " + elDia(c.fecha) + " chocan dos relojes"
               + (c.mismo_expediente ? " en " + c.cosas[0].donde : "")
               + ": " + enumerar(qsDistintas.slice(0, 2)) + ". Si uno no llega antes, el otro se mueve.");
      } else if (dondeDistintos.length >= 2) {
        /* la misma cosa en dos expedientes: se nombran los expedientes */
        l.push("El " + elDia(c.fecha) + " te vence lo mismo en "
               + (dondeDistintos.length === 2 ? "dos expedientes a la vez" : dondeDistintos.length + " expedientes a la vez")
               + ": " + minu(qsDistintas[0]) + " en " + enumerar(dondeDistintos.slice(0, 3))
               + ". Son dos gestiones distintas el mismo día.");
      }
      /* misma cosa y mismo expediente: no es un choque, no se dice nada */
    });

    /* línea 5 · lo que corre en el expediente que nadie abre.
       Primero los tranquilos: son los que no se miran nunca. */
    var yaDicho = l.join(" ").toLowerCase();
    var quedan = p.cerca.filter(function (c) {
      return yaDicho.indexOf(String(c.x.donde).toLowerCase()) < 0;
    }).sort(function (a, b) {
      if (!!b.tranquilo !== !!a.tranquilo) return b.tranquilo ? 1 : -1;
      return a.dias - b.dias;
    });
    if (quedan.length) {
      var s = quedan[0];
      l.push("Y la que no salta a la vista: en " + s.x.donde + ", " + minu(s.x.titulo) + " — " + cuando(s.x.vence, hoy) + "."
             + (s.tranquilo ? " Ahí no tienes nada más pendiente, y por eso no lo abre nadie." : ""));
    } else if (p.parados.length) {
      l.push("Y " + p.parados[0].donde + " " + minu(p.parados[0].titulo) + ".");
    }

    l = l.slice(0, TOPE_LINEAS);
    l.push("¿Por cuál empezamos?");
    return l;
  }

  function capital(t) { t = String(t || ""); return t.charAt(0).toUpperCase() + t.slice(1); }
  function minu(t) { t = String(t || ""); return t.charAt(0).toLowerCase() + t.slice(1); }

  /* ==================================================================
     7 bis · EL PARTE SE REHACE SOBRE LO QUE DE VERDAD SE DICE
     ------------------------------------------------------------------
     El parte contaba sobre los hallazgos en bruto, y la pantalla calla
     unos cuantos: los que se desmienten con un fichero que está ahí,
     los de un expediente que se abrió anteayer, los que no pueden
     señalar el papel del que salen. Resultado: el titular decía «te
     frena a diez» y abajo se pintaban nueve. Uno de esos diez era una
     trampa del banco de pruebas, callada bien en la lista y contada mal
     en el titular.

     Aquí se rehace el repaso entero quedándose solo con los avisos que
     la pantalla va a pintar. Los «falta» y los plazos que no llegaron a
     pintarse se caen con su aviso, porque cada uno lleva enganchado el
     suyo. El número de expedientes NO se toca: el denominador sigue
     siendo tu cartera entera.
     ================================================================== */
  function soloConLoQueSeDice(r, seDice) {
    if (!r || !r.expedientes || typeof seDice !== "function") return r;
    var vive = function (x) { return !!(x && x._aviso) && seDice(x._aviso); };
    var unos = r.expedientes.map(function (u) {
      var v = {};
      for (var k in u) if (Object.prototype.hasOwnProperty.call(u, k)) v[k] = u[k];
      v.hallazgos = (u.hallazgos || []).filter(seDice);
      v.faltan = (u.faltan || []).filter(vive);
      v.plazos = (u.plazos || []).filter(vive);
      return v;
    });
    var todos = [];
    unos.forEach(function (u) { u.hallazgos.forEach(function (x) { todos.push(x); }); });
    todos.sort(function (a, b) { return b.urgencia - a.urgencia; });
    var r2 = { version: r.version, hoy: r.hoy, cuantos: r.cuantos,
               expedientes: unos, hallazgos: todos, patrones: patrones(unos, r.hoy) };
    r2.parte = parte(r2);
    return r2;
  }

  /* ==================================================================
     8. LA PUERTA DE ENTRADA
     ================================================================== */

  function repasar(expedientes, hoy) {
    hoy = esFecha(hoy) ? hoy : hoyISO();
    var lista = [];
    if (expedientes && expedientes.expedientes) {
      if (esFecha(expedientes.hoy) && arguments.length < 2) hoy = expedientes.hoy;
      lista = expedientes.expedientes;
    } else if (Object.prototype.toString.call(expedientes) === "[object Array]") {
      lista = expedientes;
    }
    lista = (lista || []).filter(function (e) { return e && typeof e === "object" && !e.cerrado; });

    var unos = lista.map(function (e) { return mirarUno(e, hoy); });
    var todos = [];
    unos.forEach(function (u) { u.hallazgos.forEach(function (x) { todos.push(x); }); });
    todos.sort(function (a, b) { return b.urgencia - a.urgencia; });

    var r = { version: VERSION, hoy: hoy, cuantos: unos.length,
              expedientes: unos, hallazgos: todos,
              patrones: patrones(unos, hoy) };
    r.parte = parte(r);
    return r;
  }

  /* Lo mismo, pero leyendo de la cartera que ya existe (cartera.js).
     No toca nada: copia lo que necesita y lo repasa. */
  function deLaCartera(C, hoy) {
    C = C || (raiz && raiz.IMMOIA_CARTERA);
    if (!C || !C.lista) return repasar([], hoy);
    var l = [];
    (C.lista() || []).forEach(function (e) {
      var x = C.expediente(e.id);
      if (!x || x.cerrado) return;
      var g = x.guardado || {}, f = g.ficha || {};
      l.push({
        expediente_id: e.id,
        nombre: x.nombre,
        vivienda: { via: f.direccion || f.via || null, piso: f.piso || null, municipio: f.municipio || null },
        propietario: { nombre: f.propietario || null },
        tipo_operacion: f.operacion || f.tipo_operacion || null,
        documentos: (f.documentos || g.documentos || []),
        ultimo_movimiento: { fecha: f.ultimo_movimiento || null, que: null }
      });
    });
    return repasar(l, hoy);
  }

  /* El parte, en texto plano, listo para pegarlo donde sea. */
  function enTexto(r) { return (r && r.parte ? r.parte : parte(r)).join("\n"); }

  var API = {
    version: VERSION,
    CARPETA: CARPETA, VIGENCIAS: VIGENCIAS,
    repasar: repasar, deLaCartera: deLaCartera,
    parte: parte, enTexto: enTexto,
    mirarUno: mirarUno, patrones: patrones,
    fechasEtiquetadas: fechasEtiquetadas, validezQueDiceElPapel: validezQueDiceElPapel,
    soloConLoQueSeDice: soloConLoQueSeDice,
    /* por si alguien quiere comprobar la regla de la casa desde fuera */
    papelesQuePuedePedir: function () {
      var out = [];
      for (var k in CARPETA) CARPETA[k].forEach(function (p) { out.push({ operacion: k, cual: p.cual, fuente: p.fuente }); });
      return out;
    }
  };

  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_REPASO = API;
})(typeof window !== "undefined" ? window : null);
