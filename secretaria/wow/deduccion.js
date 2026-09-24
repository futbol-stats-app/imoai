/* ==================================================================
   IMMO IA · deduccion.js — DE UN MONTÓN DE FICHEROS A EXPEDIENTES
   ------------------------------------------------------------------
   Esto es lo que convierte «200 cosas en una carpeta» en «once
   expedientes», y lo hace SIN dar por hecha ninguna estructura.

   LA REGLA: el expediente se deduce DEL FICHERO — de lo que pone su
   nombre, de la fecha, y del texto cuando se ha podido abrir — NO de
   la carpeta donde estaba. La carpeta solo se usa como último recurso,
   y cuando se usa se dice en pantalla que se ha usado.

   Y la segunda regla, la que manda: cada cosa que se afirma tiene que
   poder señalar el fichero del que salió. Por eso aquí todo lo que se
   deduce se guarda con su `de_donde` (qué fichero) y su `por_que`
   (qué frase exacta lo dice). Lo que no tiene fichero detrás, no se
   dice.

   No llama a ninguna IA. Son reglas y expresiones regulares: gratis,
   instantáneo y no se puede inventar nada.
   ================================================================== */
(function (raiz) {
  "use strict";

  var VERSION = "1.0";

  function sinTildes(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u").replace(/ñ/g, "n");
  }

  /* ==================================================================
     1. QUÉ PAPEL ES CADA FICHERO
     ------------------------------------------------------------------
     El texto de `cual` NO es decorativo: es la cadena con la que
     repaso.js casa contra su tabla de OT-25. Si se cambia una palabra
     aquí, deja de reconocerse allí. Por eso va junto a la clave.
     ================================================================== */

  var TIPOS = [
    { clave: "nota_simple", cual: "nota simple informativa",
      pistas: [/nota\s*simple/, /registro\s+de\s+la\s+propiedad/, /nota\s*informativa/] },

    { clave: "energetico", cual: "certificado de eficiencia energética",
      pistas: [/certificad\w*\s+(de\s+)?(eficiencia\s+)?energetic/, /\bcee\b/, /eficiencia\s+energetica/,
               /certificad\w*\s+energetic/, /\benergetic\w*\b/, /calificacion\s+energetica/] },

    { clave: "comunidad", cual: "certificado de estar al día en la comunidad",
      pistas: [/al\s+(dia|corriente)\s+(en|con)\s+(la|los)\s+(gastos\s+de\s+la\s+)?comunidad/,
               /certificad\w*\s+.{0,25}comunidad/, /comunidad\s+de\s+propietarios.{0,25}(deuda|corriente|dia)/,
               /deuda\s+cero\s+comunidad/, /\bcomunidad\b/] },

    { clave: "ibi", cual: "últimos recibos del IBI",
      pistas: [/\bibi\b/, /impuesto\s+sobre\s+bienes\s+inmuebles/] },

    { clave: "dni", cual: "DNI/NIE del propietario",
      pistas: [/\bdni\b/, /\bnie\b/, /\bnif\b/, /pasaporte/, /documento\s+nacional\s+de\s+identidad/] },

    { clave: "arras", cual: "contrato de arras",
      pistas: [/\barras\b/, /senal\s+y\s+arras/] },

    { clave: "notaria", cual: "cita de notaría",
      pistas: [/notari/, /\bescritura\s+publica/, /otorgamiento/] },

    { clave: "contrato", cual: "contrato de arrendamiento",
      pistas: [/contrato\s+(de\s+)?arrendamiento/, /contrato\s+(de\s+)?alquiler/,
               /arrendamiento\s+de\s+vivienda/, /\barrendamiento\b/] },

    { clave: "fianza", cual: "justificante del depósito de la fianza",
      pistas: [/fianza/, /instituto\s+canario\s+de\s+la\s+vivienda/, /\bicv\b/] },

    { clave: "inventario", cual: "inventario y fotos del piso",
      pistas: [/inventario/] },

    { clave: "memoria", cual: "memoria técnica con planos y fotos",
      pistas: [/memoria\s+tecnica/] },

    { clave: "ocupacion", cual: "comunicación de primera ocupación",
      pistas: [/primera\s+ocupacion/, /cedula\s+de\s+habitabilidad/, /habitabilidad/,
               /comunicacion\s+(previa\s+)?(de\s+)?ocupacion/, /\bocupacion\b/] },

    { clave: "declaracion", cual: "declaración responsable de inicio de actividad",
      pistas: [/declaracion\s+responsable/] },

    { clave: "registro_tur", cual: "inscripción en el Registro General Turístico",
      pistas: [/registro\s+general\s+turistico/, /registro\s+turistico/, /licencia\s+turistica/,
               /vivienda\s+vacacional.{0,20}registro/] },

    { clave: "hipoteca", cual: "certificado de deuda cero de la hipoteca",
      pistas: [/deuda\s+(cero|pendiente)/, /cancelacion\s+(economica\s+)?(de\s+la\s+)?hipoteca/,
               /saldo\s+pendiente\s+hipoteca/] },

    { clave: "escritura", cual: "escritura de compraventa",
      pistas: [/escritura\s+de\s+compraventa/, /compraventa/, /escritura\s+anterior/, /\bescritura\b/] },

    { clave: "tasacion", cual: "certificado de tasación",
      pistas: [/tasacion/] },

    { clave: "transferencia", cual: "justificante de transferencia",
      pistas: [/justificante\s+(de\s+)?transferencia/, /transferencia/] },

    { clave: "ingresos", cual: "justificante de ingresos",
      pistas: [/justificante\s+(de\s+)?ingresos/, /nomina/, /vida\s+laboral/] },

    { clave: "encargo", cual: "hoja de encargo",
      pistas: [/hoja\s+(de\s+)?encargo/, /nota\s+de\s+encargo/] },

    { clave: "urbanistico", cual: "certificado urbanístico de compatibilidad",
      pistas: [/urbanistic/, /compatibilidad\s+urbanistica/] },

    /* E1 · LA ENERGÍA (24/09/2026) · el recibo de la luz. Salía como
       «papel sin identificar» en la carpeta de un cliente de placas, y es
       uno de los papeles que pide el expediente de energía («0 - EL MVP DE
       ENERGIA.md», ALCANCE punto 5: certificados, recibo de luz, IBI, DNI).
       Las pistas piden «recibo»/«factura» delante de «luz»/«electricidad»,
       o el código CUPS del suministro: «luz» a secas no basta. */
    { clave: "recibo_luz", cual: "recibo de la luz",
      pistas: [/recibo\s+(de\s+)?(la\s+)?luz/, /factura\s+(de\s+)?(la\s+)?(luz|electricidad)/,
               /\bcups\b/, /suministro\s+electric/] },

    { clave: "foto", cual: "foto del piso",
      pistas: [] }    /* se pone por la extensión, no por el texto */
  ];

  /* ------------------------------------------------------------------
     LA COMA, EL GUION Y EL SUBRAYADO TAMBIÉN SEPARAN PALABRAS
     ------------------------------------------------------------------
     Este es el fallo que más caro salió: los ficheros de una oficina se
     llaman «2026-09-05_certificado-comunidad.pdf», con guiones y
     subrayados, no con espacios. Buscando «certificado ... comunidad»
     con \s+ no casaba NUNCA, y entonces el papel se quedaba sin
     clasificar y el repaso decía «no aparece el certificado de la
     comunidad» teniendo el fichero delante. Peor todavía con el DNI:
     «DNI_Josefina.jpg» no casaba con \bdni\b porque el subrayado, para
     una expresión regular, es parte de la misma palabra.
     Así que antes de mirar nada, todo separador se convierte en espacio.

     Se cambia cada separador por UN espacio, sin juntar los espacios que
     salgan, para que la posición de cada letra siga siendo la misma que
     en el texto original: así el «de dónde lo saco» puede enseñar el
     trozo de verdad, con sus tildes y sus mayúsculas.
     ------------------------------------------------------------------ */
  function comoPalabras(t) {
    return sinTildes(t).replace(/[_\-.,;:()\[\]{}\/\\+]/g, " ");
  }

  /* Un papel puede oler a dos cosas a la vez ("contrato de arras ante
     notario"). Gana el que aparece ANTES en el texto: el título manda
     sobre la letra pequeña. Y el nombre del fichero pesa más que el
     texto, porque el nombre lo puso una persona a propósito. */
  function queePapelEs(f) {
    var nombre = comoPalabras(f.nombre);
    var texto = comoPalabras(String(f.texto || "").slice(0, 3000));

    var mejor = null;
    TIPOS.forEach(function (t) {
      t.pistas.forEach(function (re) {
        var m = nombre.match(re);
        if (m) {
          var p = { tipo: t, donde: "el nombre del fichero", pos: m.index, peso: 1000 - m.index,
                    frase: recorte(f.nombre, m.index, m[0].length) };
          if (!mejor || p.peso > mejor.peso) mejor = p;
        }
      });
    });
    if (!mejor) {
      TIPOS.forEach(function (t) {
        t.pistas.forEach(function (re) {
          var m = texto.match(re);
          if (m) {
            var p = { tipo: t, donde: "el texto de dentro", pos: m.index, peso: 500 - Math.min(m.index, 499),
                      frase: recorte(f.texto, m.index, m[0].length) };
            if (!mejor || p.peso > mejor.peso) mejor = p;
          }
        });
      });
    }
    if (!mejor && raiz.IMMOIA_LECTOR && raiz.IMMOIA_LECTOR.EXT_FOTO.indexOf(f.ext) >= 0) {
      return { clave: "foto", cual: "foto del piso", seguro: false,
               por_que: "es un ." + f.ext + ", así que lo trato como una foto del piso",
               de_donde: "la extensión del fichero" };
    }
    if (!mejor) {
      return { clave: null, cual: "papel sin identificar", seguro: false,
               por_que: "ni el nombre ni el texto dicen qué papel es",
               de_donde: null };
    }
    var cual = mejor.tipo.cual;
    /* la letra del certificado energético cambia el plazo (5 años si es G),
       así que si está escrita se recoge; si no está, no se inventa */
    if (mejor.tipo.clave === "energetico") {
      var letra = (nombre + " " + texto).match(/letra\s*([a-g])\b/) ||
                  (nombre + " " + texto).match(/calificacion\s+energetica[:\s]+([a-g])\b/);
      if (letra) cual += " (letra " + letra[1].toUpperCase() + ")";
    }
    return { clave: mejor.tipo.clave, cual: cual, seguro: true,
             por_que: "lo dice " + mejor.donde + ": «" + mejor.frase + "»",
             de_donde: mejor.donde };
  }

  function recorte(t, i, n) {
    t = String(t || "");
    var a = Math.max(0, i - 15), b = Math.min(t.length, i + n + 20);
    return (a > 0 ? "…" : "") + t.slice(a, b).trim() + (b < t.length ? "…" : "");
  }

  /* ==================================================================
     2. QUÉ FINCA, QUÉ PERSONA, QUÉ REFERENCIA, QUÉ FECHA
     ================================================================== */

  var VIAS = "calle|c\\/|c\\.|avenida|avda\\.?|avd\\.?|av\\.?|plaza|pza\\.?|pl\\.?|paseo|camino|carretera|ctra\\.?|urbanizacion|urb\\.?|travesia|rambla|via|carrera|glorieta|poligono";
  /* Dos cosas que parecen detalles y no lo son:
     · entre el nombre de la calle y el número TIENE que haber un espacio
       o una coma ([\s,]+, no *). Con * el «nº» opcional se comía la ene
       de «Plutón» y la calle se quedaba en «Pluto».
     · el «nº» solo se acepta escrito de verdad (nº, n°, n., núm.). Una
       «n» suelta no es un número: es parte del nombre de la calle. */
  var RE_DIRECCION = new RegExp(
    "\\b(" + VIAS + ")\\s+([a-z0-9áéíóúñ'\\.\\- ]{2,40}?)" +
    "[\\s,]+(?:n[º°]\\.?\\s*|núm\\.?\\s*|num\\.?\\s*|n\\.\\s*)?(\\d{1,4})\\b", "i");
  var RE_PISO = /\b(\d{1,2})\s*[ºª°o]?\s*([a-h])\b/i;
  var RE_CP = /\b(\d{5})\s+([a-záéíóúñ][a-záéíóúñ .'\-]{2,35})/i;

  /* Se busca sobre el texto SIN tildes y en minúscula (para que «Júpiter»
     y «JUPITER» sean lo mismo), pero se ENSEÑA el trozo original, con sus
     tildes y sus mayúsculas: en pantalla ella tiene que leer su calle tal
     y como la escribió. Por eso la normalización no cambia la longitud
     del texto: así las posiciones valen para los dos. */
  function direccionDe(txt, deDonde) {
    var original = String(txt || "");
    var s = sinTildes(original).replace(/_/g, " ");
    var m = s.match(RE_DIRECCION);
    if (!m) return null;
    var viaNorm = (m[1] + " " + m[2]).replace(/\s+/g, " ").trim().replace(/[ ,\.]+$/, "");
    viaNorm = viaNorm.replace(/^c\/\s*/, "calle ").replace(/^c\.\s*/, "calle ")
                     .replace(/^avda?\.?\s+/, "avenida ").replace(/^av\.?\s+/, "avenida ")
                     .replace(/^pza?\.?\s+/, "plaza ").replace(/^ctra\.?\s+/, "carretera ")
                     .replace(/^urb\.?\s+/, "urbanizacion ");
    var numero = m[3];
    /* el trozo original, con tildes, desde la palabra «calle» hasta el número */
    var finNumero = m.index + m[0].length;
    var bonita = original.slice(m.index, finNumero).replace(/\s+/g, " ").trim();
    bonita = bonita.charAt(0).toUpperCase() + bonita.slice(1);

    var cola = s.slice(finNumero, finNumero + 60);
    var piso = cola.match(RE_PISO);
    var municipio = municipioDetras(original, finNumero);
    if (!municipio) {
      var cp = s.match(RE_CP);
      if (cp) municipio = titulo(original.substr(cp.index + cp[0].length - cp[2].length, cp[2].length).trim());
    }
    return {
      via: bonita,
      piso: piso ? (piso[1] + "º" + piso[2].toUpperCase()) : null,
      municipio: municipio,
      clave: viaNorm.replace(/[^a-z0-9]/g, "") + "|" + numero + "|" + (piso ? piso[1] + piso[2].toLowerCase() : ""),
      de_donde: deDonde,
      frase: recorte(original, m.index, m[0].length)
    };
  }

  /* El nombre se busca en dos pasos, y a propósito: la ETIQUETA da igual
     cómo esté escrita («Titular», «TITULAR», «titular»), pero el NOMBRE
     tiene que venir en mayúscula inicial, que es como se escriben los
     nombres. Si se hiciera todo sin distinguir mayúsculas, cualquier
     frase detrás de «propietario» pasaría por un nombre. */
  /* ------------------------------------------------------------------
     EL MUNICIPIO
     ------------------------------------------------------------------
     Un papel de verdad no siempre trae código postal: pone
     «Inmueble: calle Estrella del Sur 12, 2ºB, Los Cristianos, Arona».
     Exigir el código postal dejaba el municipio en blanco casi siempre, y
     entonces el repaso decía «me falta la dirección exacta» en un aviso
     cuyo propio título ERA la dirección. Así que el municipio se lee de
     lo que va detrás del número, hasta la siguiente etiqueta del papel.
     ------------------------------------------------------------------ */
  var CORTA_LA_COLA = new RegExp(
    "\\s(?:referencia|emite|fecha|titular|propietari[oa]|arrendador|arrendatari[oa]|vendedor|comprador|" +
    "superficie|finca|naturaleza|cargas|aviso|operacion|notaria|comunidad|administrador|situacion|" +
    "derramas|documento|inmueble|vivienda|expediente|importe|objeto|calificacion|letra|clase|nota|" +
    "campo|todos|este|el\\s|la\\s)", "i");

  function municipioDetras(original, desde) {
    var cola = original.slice(desde, desde + 140);
    var corte = cola.search(CORTA_LA_COLA);
    if (corte > 0) cola = cola.slice(0, corte);
    cola = cola.replace(/^[\s,;.\-]+/, "");
    if (!cola) return null;
    var trozos = cola.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    /* se descartan los trozos que son el piso o un número suelto */
    trozos = trozos.filter(function (x) {
      if (RE_PISO.test(sinTildes(x)) && x.length <= 6) return false;
      if (/^\d+[ºª°o]?$/i.test(x)) return false;
      if (/^(bajo|entresuelo|atico|s\/n|sn)$/i.test(sinTildes(x))) return false;
      return /[a-záéíóúñ]/i.test(x) && x.length >= 3 && x.length <= 40;
    });
    if (!trozos.length) return null;
    var m = trozos[trozos.length - 1].replace(/\s+/g, " ").replace(/[.;:]+$/, "").trim();
    if (!m || m.length < 3) return null;
    return titulo(m);
  }

  /* «Titular registral: Ubaldo Sosa» lleva una palabra entre la etiqueta y
     los dos puntos. Sin admitirla, el expediente se quedaba sin
     propietario y saltaba un «me falta el nombre del propietario» que era
     mentira: el nombre estaba escrito en la nota simple. */
  var RE_ETIQUETA_PERSONA =
    /(?:(titular|propietari[oa]|arrendador[a]?|arrendatari[oa]|vendedor[a]?|comprador[a]?|solicitante|beneficiari[oa])(?:\s+[a-záéíóúñ]{3,12})?\s*:\s*|(a nombre de|d\.?\s?\/?\s?d[ñn]a\.?)\s+)/gi;
  var RE_NOMBRE_DETRAS = new RegExp(
    "^([A-ZÁÉÍÓÚÑ][a-záéíóúñ']+" +
    "(?:\\s+(?:de|del|la|las|los|y|van|von)\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ']+" +
    "|\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ']+){1,3})");

  /* Un PDF se lee de corrido, sin saltos de línea: detrás del nombre viene
     la palabra siguiente del papel, y si empieza por mayúscula se colaba
     dentro del nombre («Josefa Marciana del Crater Firmado»). Estas son
     las palabras que NO pueden formar parte de un nombre de persona. */
  var NO_ES_APELLIDO = ("firmado firmada expedida expedido emitido emitida otorgado otorgada " +
    "domicilio direccion titular titulares propietario propietaria propietarios arrendador " +
    "arrendadora arrendatario arrendataria vendedor vendedora comprador compradora solicitante " +
    "fecha importe finca inmueble vivienda objeto calle avenida plaza paseo camino carretera " +
    "referencia expediente nota certificado contrato copia documento inscripcion registro " +
    "persona inventada ejemplo numero nif nie dni pasaporte con las los por para segun").split(" ");

  function limpiarNombre(nombre) {
    var partes = nombre.split(/\s+/);
    while (partes.length > 2 &&
           NO_ES_APELLIDO.indexOf(sinTildes(partes[partes.length - 1])) >= 0) {
      partes.pop();
    }
    /* y no se queda colgando un «de» o un «del» al final */
    while (partes.length > 2 && /^(de|del|la|las|los|y)$/i.test(partes[partes.length - 1])) partes.pop();
    return partes.join(" ");
  }

  function personaDe(txt, deDonde) {
    var s = String(txt || "");
    RE_ETIQUETA_PERSONA.lastIndex = 0;
    var m;
    while ((m = RE_ETIQUETA_PERSONA.exec(s))) {
      var detras = s.slice(m.index + m[0].length, m.index + m[0].length + 70);
      var n = detras.match(RE_NOMBRE_DETRAS);
      if (!n) continue;
      var nombre = limpiarNombre(n[1].replace(/\s+/g, " ").trim());
      if (nombre.split(/\s+/).length < 2) continue;
      if (sinTildes(nombre).replace(/[^a-z]/g, "").length < 6) continue;
      return { nombre: nombre, clave: sinTildes(nombre).replace(/[^a-z]/g, ""),
               etiqueta: m[1] || m[2], de_donde: deDonde,
               frase: recorte(s, m.index, m[0].length + nombre.length) };
    }
    return null;
  }

  /* ------------------------------------------------------------------
     LA REFERENCIA DEL EXPEDIENTE
     ------------------------------------------------------------------
     Dos fallos que costaron caro, los dos de la misma expresión regular:

     1. «Expedida el 3 de marzo» se leía como el expediente «EDIDA»
        (sin el \b de después de «exp»), y juntaba expedientes distintos.
     2. En «EXP-2026-001_2026-05-20_recibo-IBI.pdf» la clase de caracteres
        llevaba dentro el subrayado y la barra, así que la referencia se
        tragaba MEDIO NOMBRE DEL FICHERO: «2026-001_2026-05-20_r». Como
        cada fichero tenía un nombre distinto, cada fichero se convertía
        en un expediente: 84 expedientes donde había 25.

     Ahora: primero se busca el código canónico (EXP-AAAA-NNN), que es el
     que usan de verdad las oficinas; y el patrón general ni admite
     subrayados ni barras, se corta en el primer separador y exige que
     haya al menos un número.
     ------------------------------------------------------------------ */
  /* El \b del final tenía el mismo problema que en las fechas: en
     «EXP-2026-002_2015-05-14_...» no hay frontera entre «002» y «_»,
     porque el subrayado es una letra más. Así la referencia no se
     encontraba y los papeles escaneados de esa carpeta se quedaban
     huérfanos. Se pide «que no siga un número», que es lo que hace falta. */
  var RE_REF_CANONICA = /\b(exp|expte|expediente|ref)[-_ ]?(\d{2,4})[-_ ](\d{1,5})(?!\d)/i;
  var RE_REF_GENERAL = /\b(?:exp(?:ediente)?|ref(?:erencia)?)\b(?:\s+(?:interno|interna|numero|num|n[º°]))?\s*[:\-]?\s*([A-Za-z0-9]+(?:-[A-Za-z0-9]+){0,3})/i;
  var TOPE_REF = 24;

  function referenciaDe(txt, deDonde) {
    var s = String(txt || "");
    var m = s.match(RE_REF_CANONICA);
    if (m) {
      return { ref: m[0], clave: (m[1] + m[2] + m[3]).toUpperCase().replace(/[^A-Z0-9]/g, ""),
               de_donde: deDonde, frase: recorte(s, m.index, m[0].length) };
    }
    m = s.match(RE_REF_GENERAL);
    if (!m) return null;
    var crudo = m[1];
    if (crudo.length > TOPE_REF) return null;
    var r = crudo.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (r.length < 3 || !/\d/.test(r)) return null;
    /* una referencia que es solo una fecha no es una referencia */
    if (/^\d{4}\d{2}\d{2}$/.test(r) || /^\d{6,8}$/.test(r)) return null;
    return { ref: crudo, clave: r, de_donde: deDonde, frase: recorte(s, m.index, m[0].length) };
  }

  /* Fechas: dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd y «12 de marzo de 2024».
     Solo se aceptan fechas verosímiles (1990..2100). */
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  /* El 30 de febrero no existe. Antes se daba por buena cualquier fecha
     con el día entre 1 y 31, así que «2026-02-30_justificante.pdf» pasaba
     como fecha válida. Ahora se comprueba contra el calendario de verdad
     y las imposibles se guardan aparte para poder avisar de ellas. */
  function diasDelMes(a, me) {
    return [31, ((a % 4 === 0 && a % 100 !== 0) || a % 400 === 0) ? 29 : 28,
            31, 30, 31, 30, 31, 31, 30, 31, 30, 31][me - 1];
  }
  /* OJO CON \b Y EL SUBRAYADO. Para una expresión regular el subrayado es
     una letra más, así que \b NO corta entre «14» y «_». En
     «2015-05-14_certificado-energetico.pdf» la fecha no se encontraba, el
     papel se quedaba sin fecha de emisión y el certificado energético
     caducado en 2015 pasaba desapercibido. Por eso aquí no se usa \b: se
     mira que delante y detrás no haya un número, que es lo que de verdad
     hace falta. */
  function fechasDe(txt, incluirImposibles) {
    var s = String(txt || ""), out = [], m, re;
    re = /(?<![\d])(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?![\d])/g;
    while ((m = re.exec(s))) empuja(out, m[3], m[2], m[1], m.index, m[0], incluirImposibles);
    re = /(?<![\d])(\d{4})-(\d{1,2})-(\d{1,2})(?![\d])/g;
    while ((m = re.exec(s))) empuja(out, m[1], m[2], m[3], m.index, m[0], incluirImposibles);
    /* ARREGLO DEL 24/09/2026 (S2, fallo 7) · «7/11/26». El año con dos
       cifras se lee SOLO con barras, que es como lo escribe la gente
       («válido hasta 7/11/26»). Con guiones o puntos no: «1.2.26» o
       «9-1-25» son números de artículo o de versión tanto como fechas, y
       una fecha que no es no se inventa. Dos cifras son siempre 20xx. */
    re = /(?<![\d\/…])(\d{1,2})\/(\d{1,2})\/(\d{2})(?![\d\/…])/g;
    while ((m = re.exec(s))) empuja(out, "20" + m[3], m[2], m[1], m.index, m[0], incluirImposibles);
    re = new RegExp("(?<![\\d])(\\d{1,2})\\s+de\\s+(" + MESES.join("|") + ")\\s+de\\s+(\\d{4})(?![\\d])", "gi");
    while ((m = re.exec(s))) empuja(out, m[3], MESES.indexOf(m[2].toLowerCase()) + 1, m[1], m.index, m[0], incluirImposibles);
    /* por orden de aparición: la primera fecha del texto es la primera */
    out.sort(function (a, b) { return a.pos - b.pos; });
    return out;
  }
  /* ARREGLO DEL 24/09/2026 (S2, fallo 12) · EL MES IMPOSIBLE.
     Antes un mes fuera de 1-12 salía por el primer «return», ANTES de
     llegar a donde se guardan las imposibles: «2026-13-01» se descartaba
     en silencio mientras «2026-02-30» sí se avisaba. Ahora las dos van
     al mismo sitio, y se apunta qué es lo que no existe (el mes o el
     día) para decir el motivo verdadero. El año sigue igual: fuera de
     1990-2100 no se toma por fecha, porque puede ser cualquier número. */
  function empuja(out, a, me, d, i, crudo, incluirImposibles) {
    a = Number(a); me = Number(me); d = Number(d);
    if (!(a >= 1990 && a <= 2100 && d >= 1 && d <= 99 && me >= 0 && me <= 99)) return;
    var que = null;
    if (me < 1 || me > 12) que = "mes";
    else if (d > diasDelMes(a, me)) que = "dia";
    if (que) {
      if (incluirImposibles) out.push({ iso: null, imposible: true, que_no_existe: que, mes: me, pos: i, crudo: crudo });
      return;
    }
    out.push({ iso: a + "-" + dos(me) + "-" + dos(d), pos: i, crudo: crudo });
  }
  function dos(n) { return (n < 10 ? "0" : "") + n; }

  /* Lo que el papel dice de esa fecha, leído de las palabras que tiene
     justo delante. Sirve para no confundir la caducidad del propio papel
     con una fecha que anuncia otro trámite (ver repaso.js, 23/09/2026). */
  var ROTULOS = [
    [/(valido|valida|validez|caduca|caducidad|vence|vencimiento|expira|expiracion)[^0-9]{0,20}$/, "válido hasta"],
    [/(emitid[oa]|expedid[oa]|fecha de emision|fecha del documento|firmad[oa])[^0-9]{0,20}$/, "emitido el"]
  ];
  function rotuloDeLaFecha(texto, pos) {
    var antes = sinTildes(String(texto).slice(Math.max(0, pos - 40), pos));
    for (var i = 0; i < ROTULOS.length; i++) if (ROTULOS[i][0].test(antes)) return ROTULOS[i][1];
    return null;
  }

  function aISO(ms) {
    if (!ms) return null;
    var d = new Date(ms);
    return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate());
  }
  function titulo(t) {
    return String(t || "").split(/\s+/).map(function (p) {
      return p.length > 2 ? p.charAt(0).toUpperCase() + p.slice(1) : p;
    }).join(" ");
  }

  /* La fecha DEL PAPEL no es la fecha del fichero en Windows. La fecha
     de Windows dice cuándo se copió, no cuándo se emitió. Por eso:
       · si el texto o el nombre traen una fecha, esa es la del papel;
       · si no, el papel se queda SIN fecha, y repaso.js dirá
         «no puedo comprobar si sigue vigente», que es la verdad.
     La fecha de Windows solo se usa para saber qué lleva parado. */
  var RE_EMISION = /(?:emitid[oa]|expedid[oa]|fecha de emision|fecha del documento|de fecha|firmad[oa])\s*(?:el|:)?\s*$/i;

  /* El código del expediente lleva números que parecen fechas
     («EXP-2026-001»). Se quita del nombre antes de buscar fechas para
     que no se cuele un trozo del código como si fuera una fecha. */
  function nombreSinReferencia(nombre) {
    return String(nombre).replace(RE_REF_CANONICA, " ");
  }

  function fechaDelPapel(f) {
    var limpio = nombreSinReferencia(f.nombre);
    var enNombre = fechasDe(limpio, true);
    var imposible = null, buenaEnNombre = null;
    enNombre.forEach(function (x) {
      if (x.imposible && !imposible) imposible = x;
      if (!x.imposible && !buenaEnNombre) buenaEnNombre = x;
    });
    if (imposible) {
      f.fecha_imposible_en_el_nombre = imposible.crudo;
      f.fecha_imposible_que = imposible.que_no_existe;      /* «mes» o «dia» */
      f.fecha_imposible_mes = imposible.mes;
    }
    if (buenaEnNombre) {
      return { iso: buenaEnNombre.iso, de_donde: "el nombre del fichero",
               frase: "«" + buenaEnNombre.crudo + "» en «" + f.nombre + "»" };
    }
    var enTexto = fechasDe(String(f.texto || "").slice(0, 4000));
    if (!enTexto.length) return null;
    /* si alguna va precedida de «emitido el», «expedido el», «de fecha», esa gana */
    for (var i = 0; i < enTexto.length; i++) {
      var antes = String(f.texto).slice(Math.max(0, enTexto[i].pos - 30), enTexto[i].pos);
      if (RE_EMISION.test(antes.replace(/\s+$/, " ").replace(/\s+/g, " ") + "")) {
        return { iso: enTexto[i].iso, de_donde: "el texto del papel",
                 frase: recorte(f.texto, Math.max(0, enTexto[i].pos - 25), enTexto[i].crudo.length + 25) };
      }
    }
    /* S2, fallo 7 · si la primera fecha del texto es la de «válido
       hasta», ésa NO es la del papel: es cuándo deja de valer. Se coge
       la primera que no sea de caducidad; si todas lo son, el papel se
       queda sin fecha de emisión (y su caducidad la dirá el repaso,
       leída del propio papel). */
    var t0 = String(f.texto || "").slice(0, 4000);
    for (var j = 0; j < enTexto.length; j++) {
      if (rotuloDeLaFecha(t0, enTexto[j].pos) === "válido hasta") continue;
      return { iso: enTexto[j].iso, de_donde: "el texto del papel",
               frase: recorte(f.texto, enTexto[j].pos, enTexto[j].crudo.length) };
    }
    return null;
  }

  /* ==================================================================
     3. DUPLICADOS Y COPIAS «(1)»
     ================================================================== */

  var RE_COPIA = /\s*(?:\((\d+)\)|-\s*cop(?:ia|y)|_cop(?:ia|y)|\s+cop(?:ia|y)|_\d{1,2})\s*$/i;
  function nombreLimpio(nombre) {
    var p = String(nombre).lastIndexOf(".");
    var base = p > 0 ? nombre.slice(0, p) : nombre;
    var ext = p > 0 ? nombre.slice(p) : "";
    var antes;
    do { antes = base; base = base.replace(RE_COPIA, ""); } while (base !== antes);
    return sinTildes(base.trim()) + sinTildes(ext);
  }

  /* Dos papeles son el mismo cuando tienen el mismo CONTENIDO. Antes se
     comparaba nombre + tamaño y eso fallaba por los dos lados: no veía
     «descarga (11).pdf» y «Documento nuevo (7).pdf» (la misma nota simple
     con dos nombres) y en cambio juntaba como copias cuatro notas simples
     de cuatro expedientes distintos solo porque pesaban igual. */
  function buscarDuplicados(ficheros) {
    var porHuella = {};
    ficheros.forEach(function (f) {
      if (!f.huella) return;
      (porHuella[f.huella] = porHuella[f.huella] || []).push(f);
    });
    var grupos = [];
    Object.keys(porHuella).forEach(function (k) {
      if (porHuella[k].length < 2) return;
      var g = porHuella[k].slice().sort(function (a, b) {
        return (a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0);
      });
      var nombresDistintos = g.some(function (x) {
        return nombreLimpio(x.nombre) !== nombreLimpio(g[0].nombre);
      });
      grupos.push({ se_queda: g[0], sobran: g.slice(1), bytes: g[0].bytes,
                    nombre: g[0].nombre, cuantos: g.length,
                    nombres_distintos: nombresDistintos,
                    como_se_ha_visto: "mismo contenido byte a byte (huella SHA-256" +
                      (raiz.IMMOIA_LECTOR && raiz.IMMOIA_LECTOR.EXT_FOTO.indexOf(g[0].ext) >= 0
                        ? " de los datos de la imagen, sin los metadatos)" : ")") });
      g.slice(1).forEach(function (x) { x.duplicado_de = g[0].id; });
    });
    return grupos;
  }

  /* Un borrador no es un contrato. Mientras no esté firmado no corre
     ningún plazo, y decir que se ha pasado el plazo de la fianza sobre un
     borrador es exactamente el susto que no nos podemos permitir. */
  var RE_BORRADOR = /\bborrador\b|\bdraft\b|sin\s+firmar|pendiente\s+de\s+firma|no\s+firmado/i;
  function esBorrador(f) {
    if (RE_BORRADOR.test(comoPalabras(f.nombre))) {
      return "el nombre del fichero dice «BORRADOR»";
    }
    if (f.texto && RE_BORRADOR.test(String(f.texto).slice(0, 2500))) {
      var m = String(f.texto).slice(0, 2500).match(RE_BORRADOR);
      return "el texto del papel dice «" + m[0] + "»";
    }
    return null;
  }

  /* ------------------------------------------------------------------
     EL TITULAR QUE SE IDENTIFICA CON PASAPORTE
     ------------------------------------------------------------------
     En una venta, si la parte vendedora no es residente fiscal en
     España, el comprador tiene que retener el 3 % del precio y
     presentar el modelo 211: si no lo hace, responde él de la deuda
     (TABLA_PAPELES_Y_VENTANILLAS.md, apartado 3; la obligación va
     marcada como verificada, INV-02).

     Aquí NO se decide si alguien es residente o no: eso no sale de un
     papel. Lo único que se mira es una señal que sí está escrita: que
     el papel identifique al titular con un PASAPORTE con número, en
     vez de con DNI o NIE. Es motivo para preguntar, no para concluir,
     y así se dice luego en la pantalla.

     Se exige que detrás de «pasaporte» venga un número de documento, a
     propósito: una lista de la compra que diga «DNI, NIE o pasaporte
     del titular» no es una señal de nada y no puede disparar el aviso.
     ------------------------------------------------------------------ */
  var RE_PASAPORTE_DEL_TITULAR =
    /(titular(?:\s+registral)?|vendedor[ao]?|propietari[oa]|parte\s+vendedora)[^.\n]{0,60}?\bpasaporte\s+[A-Za-z0-9][A-Za-z0-9-]{4,}/i;

  function titularConPasaporte(f) {
    if (!f || !f.texto) return null;
    var m = String(f.texto).slice(0, 6000).match(RE_PASAPORTE_DEL_TITULAR);
    if (!m) return null;
    return { frase: m[0].replace(/\s+/g, " ").trim() };
  }

  /* ==================================================================
     4. AGRUPAR EN EXPEDIENTES  (sin fiarse de la carpeta)
     ================================================================== */

  var MAX_FICHEROS_PARA_FIARSE_DE_LA_CARPETA = 25;

  function agrupar(ficheros, opciones) {
    opciones = opciones || {};
    /* ARREGLO DEL 24/09/2026 (S2, fallo 11) · LAS COPIAS, PRIMERO.
       hacerExpediente() ya se saltaba las copias («if (f.duplicado_de)
       return»), pero la marca duplicado_de la ponía buscarDuplicados(),
       que se llamaba AL FINAL, en el «return» de esta función: cuando se
       montaban los expedientes la marca todavía no existía. Así un papel
       y su copia contaban como dos papeles, y cada aviso que salía del
       papel salía dos veces («hay una fecha apuntada que no tiene papel»
       x2 en el nivel 4). Ahora se buscan antes de repartir nada. */
    ficheros.forEach(function (f) { if (f) delete f.duplicado_de; });
    var losDuplicados = buscarDuplicados(ficheros);
    /* --- 4.1 lo que dice cada fichero por sí mismo --- */
    ficheros.forEach(function (f) {
      f.papel = queePapelEs(f);
      f.fecha_papel = fechaDelPapel(f);
      f.direccion = direccionDe(f.nombre, "el nombre del fichero") ||
                    (f.texto ? direccionDe(f.texto.slice(0, 2500), "el texto de dentro") : null);
      f.persona = (f.texto ? personaDe(f.texto.slice(0, 2500), "el texto de dentro") : null) ||
                  personaDe(f.nombre.replace(/[_\-]+/g, " "), "el nombre del fichero");
      f.referencia = referenciaDe(f.nombre, "el nombre del fichero") ||
                     (f.texto ? referenciaDe(f.texto.slice(0, 2500), "el texto de dentro") : null);
    });

    /* --- 4.1.a EL NOMBRE DE LA CARPETA TAMBIÉN SE LEE ---
       ------------------------------------------------------------------
       ARREGLO DEL 20/09/2026. Antes aquí solo se miraba el nombre del
       fichero y el texto de dentro. Con papeles escaneados no hay texto
       dentro, así que NINGÚN papel daba señal fuerte y la pantalla
       acababa diciéndole a una directora que no tenía ni un expediente
       teniendo 122 papeles en 25 carpetas delante.

       Una carpeta que se llama «Tabaiba Dulce 14 - compraventa» ya está
       diciendo de qué expediente es todo lo que hay dentro. Eso no es
       adivinar: es leer el rótulo que ella misma le puso.

       DOS CANDADOS, para no pasarse:
         · solo se mira si el fichero NO ha dado ya esa señal por sí
           mismo. Lo que dice el papel manda siempre sobre el rótulo.
         · no se mira la carpeta raíz de lo que ha soltado: esa es «mis
           expedientes» o «Escritorio», y no es ningún expediente.
       Se recorre de la carpeta más honda a la más alta, porque la más
       honda es la que más cerca está del papel. Y queda apuntado de
       dónde ha salido, para que en pantalla se pueda decir.
       ------------------------------------------------------------------ */
    var raizDeLoSoltado = raizDe(ficheros);
    ficheros.forEach(function (f) {
      if (f.direccion && f.referencia) return;
      var segs = String(f.carpeta || "").split("/").filter(function (x) { return x !== ""; });
      for (var i = segs.length - 1; i >= 0; i--) {
        if (i === 0 && segs[0] === raizDeLoSoltado) continue;
        var rotulo = segs[i];
        var limpio = rotulo.replace(/[_]+/g, " ");
        if (!f.direccion) {
          var d = direccionDe(limpio, "el nombre de la carpeta «" + rotulo + "»");
          if (d) { f.direccion = d; f.senal_de_la_carpeta = true; }
        }
        if (!f.referencia) {
          var rr = referenciaDe(limpio, "el nombre de la carpeta «" + rotulo + "»");
          if (rr) { f.referencia = rr; f.senal_de_la_carpeta = true; }
        }
        if (f.direccion && f.referencia) break;
      }
    });

    /* --- 4.1.b «calle Júpiter 4» y «calle Júpiter 4, 3ºB» son el mismo
       expediente mientras en ese portal solo se conozca un piso. Si se
       conocen dos pisos distintos, el papel que no dice el piso NO se
       reparte a ojo: se queda aparte, y en pantalla se ve. --- */
    var pisosPorPortal = {};
    ficheros.forEach(function (f) {
      if (!f.direccion) return;
      var t = f.direccion.clave.split("|");
      var portal = t[0] + "|" + t[1];
      pisosPorPortal[portal] = pisosPorPortal[portal] || {};
      if (t[2]) pisosPorPortal[portal][t[2]] = 1;
    });
    /* ARREGLO DEL 23/09/2026 · LO QUE SUPONE, SE DICE; Y LO QUE NO
       REPARTE, SE DICE POR QUÉ.
       Antes esta marca («piso_supuesto») se apuntaba y no se usaba en
       ningún otro sitio del programa: la aplicación suponía el piso y se
       lo callaba. Y en el caso contrario —dos pisos conocidos, papel que
       no dice cuál— dejaba el papel aparte, que es lo correcto, pero en
       pantalla daba otro motivo («me falta el nombre del propietario»),
       que no es verdad: aunque supiera el propietario seguiría sin saber
       si es el 1ºA o el 4ºC.
       Ahora las dos caras quedan escritas, con el nombre del portal y
       los pisos que se conocen, para que la pantalla las cuente. */
    function comoSeLlamaElPortal(f) {
      return String(f.direccion.via || "").replace(/,\s*$/, "");
    }
    ficheros.forEach(function (f) {
      if (!f.direccion) return;
      var t = f.direccion.clave.split("|");
      if (t[2]) return;
      var portal = t[0] + "|" + t[1];
      var pisos = Object.keys(pisosPorPortal[portal] || {});
      var comoSeEscriben = [];
      ficheros.forEach(function (o) {
        if (!o.direccion || !o.direccion.piso) return;
        var ot = o.direccion.clave.split("|");
        if (ot[0] + "|" + ot[1] !== portal) return;
        if (comoSeEscriben.indexOf(o.direccion.piso) < 0) comoSeEscriben.push(o.direccion.piso);
      });
      comoSeEscriben.sort();
      if (pisos.length === 1) {
        f.direccion.clave = portal + "|" + pisos[0];
        f.direccion.piso_supuesto = true;
        f.direccion.piso_supuesto_cual = comoSeEscriben[0] || null;
        f.direccion.piso_supuesto_portal = comoSeLlamaElPortal(f);
        f.piso_supuesto = { piso: comoSeEscriben[0] || null, portal: comoSeLlamaElPortal(f) };
      } else if (pisos.length > 1) {
        f.direccion.sin_repartir = { portal: comoSeLlamaElPortal(f), pisos: comoSeEscriben };
        f.sin_repartir = f.direccion.sin_repartir;
      }
    });

    /* --- 4.2 SEÑALES FUERTES Y SEÑALES FLOJAS ---
       Fuerte = identifica la operación: la referencia del expediente y
       la dirección de la finca. Si un papel trae las dos, son la misma
       cosa y se unen.
       Floja = el nombre de una persona y la carpeta donde estaba. Estas
       NO identifican por sí solas: un propietario puede tener dos pisos,
       y una carpeta puede ser un cajón. Una señal floja solo arrastra a
       un expediente cuando en TODO el montón apunta a uno y a uno solo.
       Si apunta a dos, no se reparte a ojo: se queda aparte y se dice. */
    ficheros.forEach(function (f) {
      f.fuertes = [];
      if (f.referencia) f.fuertes.push("ref:" + f.referencia.clave);
      if (f.direccion) f.fuertes.push("dir:" + f.direccion.clave);
      f.flojas = [];
      if (f.persona) f.flojas.push("per:" + f.persona.clave);
    });

    /* ¿la carpeta sirve siquiera de señal floja? Solo si NO es la raíz de
       lo que ha soltado y tiene pocos ficheros. Una carpeta con 200 cosas
       dentro no es un expediente: es un cajón. */
    var porCarpeta = {};
    ficheros.forEach(function (f) {
      (porCarpeta[f.carpeta] = porCarpeta[f.carpeta] || []).push(f);
    });
    var raizComun = raizDe(ficheros);
    var carpetaSirve = {};
    Object.keys(porCarpeta).forEach(function (c) {
      carpetaSirve[c] = c !== "" && c !== raizComun &&
                        porCarpeta[c].length <= MAX_FICHEROS_PARA_FIARSE_DE_LA_CARPETA;
    });
    ficheros.forEach(function (f) {
      if (carpetaSirve[f.carpeta]) f.flojas.push("carp:" + f.carpeta);
    });

    /* --- 4.3 unir SOLO las fuertes entre sí --- */
    var padre = {};
    function raizDeClave(k) { while (padre[k] && padre[k] !== k) k = padre[k]; return k; }
    function unir(a, b) {
      padre[a] = padre[a] || a; padre[b] = padre[b] || b;
      var ra = raizDeClave(a), rb = raizDeClave(b);
      if (ra !== rb) padre[ra] = rb;
    }
    ficheros.forEach(function (f) {
      f.fuertes.forEach(function (k) { padre[k] = padre[k] || k; });
      for (var i = 1; i < f.fuertes.length; i++) unir(f.fuertes[0], f.fuertes[i]);
    });

    /* --- 4.4 a dónde lleva cada señal floja --- */
    var aDondeLleva = {};        /* señal floja -> conjunto de raíces fuertes */
    ficheros.forEach(function (f) {
      if (!f.fuertes.length) return;
      var r = raizDeClave(f.fuertes[0]);
      f.flojas.forEach(function (k) {
        aDondeLleva[k] = aDondeLleva[k] || {};
        aDondeLleva[k][r] = (aDondeLleva[k][r] || 0) + 1;
      });
    });
    var aliasDeFloja = {}, ambigua = {};
    Object.keys(aDondeLleva).forEach(function (k) {
      var destinos = Object.keys(aDondeLleva[k]);
      if (destinos.length === 1) aliasDeFloja[k] = destinos[0];
      else ambigua[k] = destinos.length;      /* apunta a varios: no se usa */
    });

    /* --- 4.5 repartir los ficheros --- */
    var grupos = {}, sueltos = [];
    ficheros.forEach(function (f) {
      var g = null;
      if (f.fuertes.length) {
        g = raizDeClave(f.fuertes[0]);
        f.por_que_aqui = f.fuertes[0].indexOf("dir:") === 0
          ? "porque " + f.direccion.de_donde + " dice la dirección: «" + f.direccion.frase + "»"
          : "porque " + f.referencia.de_donde + " trae la referencia " + f.referencia.ref;
        if (f.piso_supuesto) {
          f.por_que_aqui += ". El papel no dice el piso: he supuesto que es el " +
            (f.piso_supuesto.piso || "único que conozco") + ", que es el único piso que conozco de " +
            f.piso_supuesto.portal;
        } else if (f.sin_repartir) {
          f.por_que_aqui += ". El papel no dice el piso y en " + f.sin_repartir.portal +
            " conozco " + (f.sin_repartir.pisos.length === 2 ? "dos pisos" : f.sin_repartir.pisos.length + " pisos") +
            ", el " + f.sin_repartir.pisos.join(" y el ") + ": no lo reparto a ciegas";
        }
      } else {
        for (var i = 0; i < f.flojas.length && !g; i++) {
          var k = f.flojas[i];
          if (ambigua[k]) {
            f.senal_ambigua = (f.senal_ambigua || []).concat([
              k.indexOf("per:") === 0
                ? "el nombre «" + f.persona.nombre + "» sale en " + ambigua[k] + " expedientes distintos"
                : "la carpeta «" + f.carpeta + "» tiene papeles de " + ambigua[k] + " expedientes distintos"]);
            continue;
          }
          if (aliasDeFloja[k]) {
            g = aliasDeFloja[k];
            if (k.indexOf("per:") === 0) {
              f.por_que_aqui = "porque " + f.persona.de_donde + " trae el nombre: «" + f.persona.frase +
                               "», y ese nombre solo sale en este expediente";
              f.agrupado_por_la_persona = true;
            } else {
              f.por_que_aqui = "solo por la carpeta en la que estaba («" + f.carpeta + "»), " +
                               "porque el fichero por sí mismo no dice de quién es";
              f.agrupado_por_la_carpeta = true;
            }
          } else if (k.indexOf("per:") === 0) {
            /* un nombre de persona que no lleva a ningún expediente
               conocido sí sirve para juntar entre sí los papeles que lo
               comparten: todos son de la misma persona */
            g = k;
            f.por_que_aqui = "porque todos estos papeles llevan el mismo nombre: «" +
                             f.persona.nombre + "»";
          }
          /* Una CARPETA que no lleva a ningún expediente conocido no es un
             expediente: es un cajón con el nombre que le pusieron ese día.
             Contarla como expediente es contar un expediente que no
             existe («el expediente de la carpeta pendiente/2024»). Esos
             papeles se van a los sueltos, que es donde está la verdad:
             no sé de quién son. */
        }
      }
      if (!g) { sueltos.push(f); f.por_que_aqui = null; return; }
      (grupos[g] = grupos[g] || []).push(f);
    });

    /* --- 4.5 construir el expediente tal y como lo espera repaso.js --- */
    var expedientes = [], n = 0;
    Object.keys(grupos).forEach(function (g) {
      n++;
      expedientes.push(hacerExpediente("EXP-" + n, grupos[g], opciones));
    });
    /* orden estable y previsible: por dirección, luego por nombre */
    expedientes.sort(function (a, b) {
      return String(a._titulo).localeCompare(String(b._titulo), "es");
    });
    expedientes.forEach(function (e, i) {
      var viejo = e.expediente_id;
      e.expediente_id = "EXP-" + (i + 1);
      e._ficheros.forEach(function (f) { f.expediente = e.expediente_id; });
    });

    return { expedientes: expedientes, sueltos: sueltos,
             duplicados: losDuplicados, raiz: raizComun };
  }

  function raizDe(ficheros) {
    var r = null;
    ficheros.forEach(function (f) {
      var primera = f.ruta.indexOf("/") >= 0 ? f.ruta.split("/")[0] : "";
      if (r === null) r = primera; else if (r !== primera) r = "";
    });
    return r || "";
  }

  /* De qué operación es. Se puntúa lo que dicen los papeles, y si no
     hay un ganador claro se devuelve null: repaso.js entonces dice «no
     sé lo suficiente para repasarlo», que es lo honrado. */
  var SENALES = {
    venta: [/compraventa/, /\barras\b/, /\bventa\b/, /comprador/, /vendedor/, /nota simple/, /notari/, /escritura/],
    alquiler: [/arrendamiento/, /alquiler/, /inquilin/, /arrendatari/, /arrendador/, /fianza/, /renta mensual/],
    vacacional: [/vacacional/, /turistic/, /declaracion responsable/, /registro general turistico/, /alquiler de temporada/]
  };
  function queOperacionEs(ficheros) {
    var punt = { venta: 0, alquiler: 0, vacacional: 0 }, pruebas = {};
    ficheros.forEach(function (f) {
      var s = sinTildes(f.nombre + " " + String(f.texto || "").slice(0, 2500));
      Object.keys(SENALES).forEach(function (k) {
        SENALES[k].forEach(function (re) {
          var m = s.match(re);
          if (m && !pruebas[k]) {
            pruebas[k] = { fichero: f.id, nombre: f.nombre, frase: m[0] };
          }
          if (m) punt[k]++;
        });
      });
    });
    var orden = Object.keys(punt).sort(function (a, b) { return punt[b] - punt[a]; });
    if (!punt[orden[0]]) return { tipo: null, por_que: "ningún papel dice si es venta, alquiler o vacacional" };
    if (punt[orden[0]] === punt[orden[1]]) {
      return { tipo: null, por_que: "los papeles dicen a la vez «" + orden[0] + "» y «" + orden[1] +
               "», así que no me la juego" };
    }
    return { tipo: orden[0], prueba: pruebas[orden[0]],
             por_que: "lo dice «" + pruebas[orden[0]].nombre + "»: aparece «" + pruebas[orden[0]].frase + "»" };
  }

  /* ------------------------------------------------------------------
     E1 · LA ENERGÍA (24/09/2026) · EL EXPEDIENTE DE ENERGÍA (PLACAS)
     ------------------------------------------------------------------
     Un cliente que quiere placas no vende, no alquila y no pone su casa
     en vacacional. Hasta hoy La Secretaria solo sabía de esas tres, así
     que a sus carpetas les decía «me falta si es venta, alquiler o
     vacacional». Ahora lo reconoce por una de dos vías, y dice cuál:
       1. la CARPETA donde están sus papeles lo dice («PLACAS»,
          «ENERGÍA», «FOTOVOLTAICA», «AUTOCONSUMO»), en al menos la mitad
          de ellos. La carpeta raíz que se suelta no cuenta cuando los
          papeles están en subcarpetas: si alguien suelta «ENERGÍA» con
          ventas dentro, eso no convierte las ventas en placas.
       2. LOS PAPELES: certificado energético + recibo de la luz + recibo
          del IBI, y ninguno dice venta, alquiler ni vacacional.
     En los dos casos, si hay un papel que es de otra operación sin
     discusión (arras, contrato de alquiler, fianza, notaría, escritura
     de compraventa, declaración responsable, registro turístico...), NO
     es energía: se queda como estaba.
     No cambia `tipo_operacion` (sigue en null): la pantalla solo sabe
     pintar venta, alquiler y vacacional, y pantalla.js no es de este
     taller. Va en `tipo_expediente: "energia"`, que es lo que lee
     repaso.js para pedirle SUS papeles y no los de una venta.
     ------------------------------------------------------------------ */
  var CARPETA_DE_ENERGIA = /\bplacas?\b|\benergia\b|fotovoltaic|autoconsumo|paneles\s+solares/;
  var PAPEL_DE_OTRA_OPERACION = ["arras", "notaria", "contrato", "fianza", "inventario", "memoria",
                                 "declaracion", "registro_tur", "urbanistico"];
  function carpetasPropias(f) {
    var t = String(f.ruta || "").split("/");
    t.pop();
    if (t.length > 1) t.shift();      /* la raíz que se ha soltado no cuenta si hay subcarpetas */
    return t.join(" / ");
  }
  function esDeEnergia(ficheros, op) {
    var propios = ficheros.filter(function (f) { return !f.duplicado_de; });
    if (!propios.length) return null;
    var otra = null;
    propios.forEach(function (f) {
      if (otra || !f.papel) return;
      if (PAPEL_DE_OTRA_OPERACION.indexOf(f.papel.clave) >= 0) otra = f;
      else if (f.papel.clave === "escritura" &&
               /compraventa/.test(sinTildes(f.nombre + " " + String(f.texto || "").slice(0, 1500)))) otra = f;
    });
    if (otra) return null;
    var porCarpeta = propios.filter(function (f) { return CARPETA_DE_ENERGIA.test(comoPalabras(carpetasPropias(f))); });
    if (porCarpeta.length && porCarpeta.length * 2 >= propios.length) {
      return { via: "carpeta", fichero: porCarpeta[0].id, nombre: porCarpeta[0].nombre,
               por_que: "lo dice la carpeta donde están sus papeles: «" + carpetasPropias(porCarpeta[0]) + "»" };
    }
    if (op && op.tipo) return null;
    var hay = {};
    propios.forEach(function (f) { if (f.papel && f.papel.clave) hay[f.papel.clave] = hay[f.papel.clave] || f; });
    if (hay.energetico && hay.recibo_luz && hay.ibi) {
      return { via: "papeles", fichero: hay.recibo_luz.id, nombre: hay.recibo_luz.nombre,
               por_que: "lo dicen sus papeles: certificado energético, recibo de la luz y recibo del IBI, " +
                        "y ninguno habla de venta, alquiler ni vacacional" };
    }
    return null;
  }

  /* ------------------------------------------------------------------
     ARREGLO DEL 24/09/2026 (S2, fallo 8) · EL PAPEL QUE HACE CADA NOMBRE
     ------------------------------------------------------------------
     En una compraventa con arras el comprador y el vendedor SON dos
     personas distintas, y en un alquiler el inquilino y el casero. El
     aviso de «papeles a nombre de 2 personas distintas» salía en toda
     venta con arras, con un motivo («o es el mismo expediente abierto
     dos veces») que ahí es falso. La etiqueta que va delante del nombre
     ya se leía («Comprador:», «Titular registral:»): ahora se usa.
       · «otra_parte»: comprador, arrendatario. Es la otra parte de la
         operación: que no se llame como el dueño es lo normal.
       · «dueno»: titular, propietario, vendedor, arrendador.
       · «sin_rol»: «a nombre de», «D./Dña.», solicitante, beneficiario.
         No dicen qué papel hace esa persona, así que se siguen mirando
         igual que antes: no se calla nada que antes se dijera por ellos.
     ------------------------------------------------------------------ */
  function rolDelNombre(etiqueta) {
    var e = sinTildes(etiqueta || "");
    if (/^(comprador|arrendatari)/.test(e)) return "otra_parte";
    if (/^(titular|propietari|vendedor|arrendador)/.test(e)) return "dueno";
    return "sin_rol";
  }

  function hacerExpediente(id, ficheros, opciones) {
    var dir = null, per = null, ref = null;
    var nombres = {};
    /* Un papel repetido solo se salta aquí si el papel del que es copia
       está en ESTE mismo expediente. Si estuviera en otro, saltárselo
       dejaría a este expediente sin un papel que sí tiene. */
    var aqui = {};
    ficheros.forEach(function (f) { aqui[f.id] = true; });
    function esCopiaDeAqui(f) { return !!(f.duplicado_de && aqui[f.duplicado_de]); }
    /* Un papel que EXPLICA un cambio de dueño: una escritura (la
       anterior trae al vendedor de antes) o una herencia o donación. Los
       nombres que salen de ese papel no se cruzan con el titular de hoy. */
    function explicaElCambio(f) {
      if (f.papel && f.papel.clave === "escritura") return true;
      return /herencia|donacion|adjudicacion hereditaria/.test(sinTildes(f.nombre + " " + String(f.texto || "").slice(0, 2500)));
    }
    ficheros.forEach(function (f) {
      if (!dir && f.direccion) dir = { d: f.direccion, f: f };
      if (!per && f.persona && rolDelNombre(f.persona.etiqueta) !== "otra_parte") per = { p: f.persona, f: f };
      if (!ref && f.referencia) ref = { r: f.referencia, f: f };
      if (f.persona && !esCopiaDeAqui(f)) {
        var rol = rolDelNombre(f.persona.etiqueta);
        if (rol === "otra_parte" || explicaElCambio(f)) return;
        nombres[f.persona.clave] = nombres[f.persona.clave] ||
          { nombre: f.persona.nombre, fichero: f.id, ruta: f.ruta, frase: f.persona.frase,
            rol: rol, etiqueta: String(f.persona.etiqueta || "").toLowerCase() };
      }
    });
    /* si ningún nombre es del lado del dueño, el propietario se queda como
       estaba antes (el primer nombre que salga): no se deja en blanco */
    if (!per) ficheros.forEach(function (f) { if (!per && f.persona) per = { p: f.persona, f: f }; });
    /* La misma finca con papeles a nombre de dos personas distintas.
       Esto no se ve nunca abriendo un expediente: hay que mirarlos
       todos a la vez. Y no se afirma nada: se señalan los dos papeles.

       Antes de decirlo hay que estar seguro de que son DOS PERSONAS y
       no la misma escrita de dos maneras. «Jose Lunero» y «Jose Lunero
       Estrellado» es el mismo señor con un apellido de menos: si uno es
       el principio del otro, no se dice nada. Decir que hay dos cuando
       hay uno sería justo el tipo de fallo que no nos podemos permitir. */
    var distintas = [];
    Object.keys(nombres).map(function (k) { return nombres[k]; })
      .sort(function (a, b) { return b.nombre.length - a.nombre.length; })
      .forEach(function (x) {
        var xs = sinTildes(x.nombre) + " ";
        var yaEsta = distintas.some(function (y) {
          var ys = sinTildes(y.nombre) + " ";
          return ys.indexOf(xs) === 0 || xs.indexOf(ys) === 0;
        });
        if (!yaEsta) distintas.push(x);
      });
    var dosNombres = distintas.length > 1 ? distintas : null;
    /* el motivo, para la pantalla: qué papel hace cada nombre */
    if (dosNombres) dosNombres.forEach(function (x) {
      x.como = x.rol === "dueno" ? "como " + (x.etiqueta || "titular") : "sin decir qué papel hace";
    });
    var op = queOperacionEs(ficheros);
    /* E1 · energía: si lo es, la operación se queda en null (ver esDeEnergia) */
    var energia = esDeEnergia(ficheros, op);
    if (energia && op.tipo) {
      op = { tipo: null, antes: op.tipo,
             por_que: "los papeles olían a «" + op.tipo + "», pero " + energia.por_que + " y no hay ningún papel que sea de esa operación sin discusión" };
    }

    /* ----------------------------------------------------------------
       QUÉ LLEVA PARADO: la fecha tiene que salir DE LOS PAPELES
       ----------------------------------------------------------------
       Antes esto se calculaba con la fecha del fichero en Windows, y era
       un error de bulto: en cuanto una carpeta se copia, se restaura de
       una copia de seguridad o se baja de la nube, TODOS los ficheros
       pasan a tener la fecha de la copia y no hay nada parado. Eso hacía
       que la pantalla dijera «no hay nada parado» cuando lo que pasaba
       es que no lo sabía.

       Ahora el último movimiento es la fecha más nueva que sale de los
       propios papeles (del nombre o del texto). Si ningún papel tiene
       fecha, se queda en blanco, y entonces se dice que no se sabe — no
       se dice que no hay nada.
       ---------------------------------------------------------------- */
    var masNuevo = null, masViejo = null;
    ficheros.forEach(function (f) {
      if (esCopiaDeAqui(f) || !f.fecha_papel) return;
      if (!masNuevo || f.fecha_papel.iso > masNuevo.fecha_papel.iso) masNuevo = f;
      if (!masViejo || f.fecha_papel.iso < masViejo.fecha_papel.iso) masViejo = f;
    });
    var sinFechaNinguna = ficheros.filter(function (f) { return !esCopiaDeAqui(f) && !f.fecha_papel; }).length;

    var docs = [];
    ficheros.forEach(function (f) {
      if (esCopiaDeAqui(f)) return;               /* las copias no cuentan como papeles distintos */
      var literal = f.nombre;
      if (f.fecha_papel) literal += " — " + f.fecha_papel.frase;
      /* las fechas sueltas que menciona el papel: de ahí salen los choques */
      if (f.texto) {
        /* ARREGLO DEL 23/09/2026 · CADA FECHA, CON LO QUE EL PAPEL DICE
           DE ELLA.  Antes aquí se perdía el rótulo: «Válido hasta:
           07/11/2026» salía como un 07/11/2026 a secas, y repaso.js, que
           solo veía el número, lo trataba como «una fecha de la que no
           hay papel». Ahora la etiqueta viaja con la fecha, entre
           paréntesis, y así se lee igual en pantalla y en el repaso. */
        var trozo = f.texto.slice(0, 4000);
        var otras = fechasDe(trozo).slice(0, 6)
          .filter(function (x) { return !f.fecha_papel || x.iso !== f.fecha_papel.iso; })
          .map(function (x) {
            var et = rotuloDeLaFecha(trozo, x.pos);
            return x.crudo + (et ? " (" + et + ")" : "");
          });
        if (otras.length) literal += " — fechas que menciona: " + otras.join(", ");
      }
      var borrador = esBorrador(f);
      if (borrador) f.es_borrador = borrador;
      docs.push({
        cual: f.papel.cual,
        /* «recibido» = el papel está. «borrador» = está, pero sin firmar,
           y por eso no arranca ningún plazo. repaso.js solo cuenta plazos
           sobre lo que está recibido o verificado. */
        estado_documento: borrador ? "borrador" : "recibido",
        fecha: f.fecha_papel ? f.fecha_papel.iso : null,
        literal_en_OT25: literal,
        _fichero: f.id, _nombre: f.nombre, _papel: f.papel, _borrador: borrador || null,
        /* S2, fallo 9: repaso.js tiene que saber si este papel se ha
           podido leer, para no decir «pone que...» de uno que no pone nada */
        _lectura: f.lectura || null, _bytes: f.bytes == null ? null : f.bytes,
        _motivo_no_leido: f.motivo_no_leido || "",
        _titular_con_pasaporte: titularConPasaporte(f)
      });
    });

    var titulo = dir ? (dir.d.via + (dir.d.piso ? ", " + dir.d.piso : ""))
               : per ? ("los papeles de " + per.p.nombre)
               : ref ? ("el expediente " + ref.r.ref)
               : ("los papeles de la carpeta «" + (ficheros[0].carpeta || "(la raíz)") + "»");

    return {
      expediente_id: id,
      nombre: titulo,
      vivienda: dir ? { via: dir.d.via, piso: dir.d.piso, municipio: dir.d.municipio,
                        direccion_literal: dir.d.via + (dir.d.piso ? ", " + dir.d.piso : "") +
                                           (dir.d.municipio ? ", " + dir.d.municipio : "") }
                    : { via: null, piso: null, municipio: null, direccion_literal: null },
      propietario: { nombre: per ? per.p.nombre : null },
      tipo_operacion: op.tipo,
      /* E1 · «energia» (placas) o null. repaso.js lo lee para pedirle sus papeles */
      tipo_expediente: energia ? "energia" : null,
      documentos: docs,
      ultimo_movimiento: masNuevo
        ? { fecha: masNuevo.fecha_papel.iso,
            que: "el papel más reciente que hay es «" + masNuevo.nombre + "»" }
        : { fecha: null, que: null },
      /* --- todo lo de abajo es NUESTRO, repaso.js lo ignora --- */
      _titulo: titulo,
      _ficheros: ficheros,
      _dos_nombres: dosNombres,
      _pruebas: {
        direccion: dir ? { fichero: dir.f.id, nombre: dir.f.nombre, de_donde: dir.d.de_donde, frase: dir.d.frase } : null,
        persona: per ? { fichero: per.f.id, nombre: per.f.nombre, de_donde: per.p.de_donde, frase: per.p.frase } : null,
        referencia: ref ? { fichero: ref.f.id, nombre: ref.f.nombre, de_donde: ref.r.de_donde, frase: ref.r.frase } : null,
        operacion: op,
        energia: energia,
        ultimo_movimiento: masNuevo ? { fichero: masNuevo.id, nombre: masNuevo.nombre,
                                        frase: masNuevo.fecha_papel.frase } : null
      },
      /* un expediente abierto hace cuatro días no tiene papeles que
         reprocharle todavía: el papel más viejo que hay dice cuándo se
         abrió, y hasta que no pase un tiempo razonable no se le pide nada */
      _recien_abierto: masViejo || null,
      _sin_fecha_ninguna: sinFechaNinguna,
      _borradores: ficheros.filter(function (f) { return f.es_borrador; }),
      _agrupado_por_carpeta: ficheros.every(function (f) { return f.agrupado_por_la_carpeta; }),
      /* las dos caras del piso: lo que se ha supuesto y lo que no se ha
         repartido a ciegas. Lo lee la pantalla y lo lee el repaso. */
      _piso_supuesto: (function () {
        var x = null;
        ficheros.forEach(function (f) { if (!x && f.piso_supuesto) x = f.piso_supuesto; });
        return x;
      })(),
      _sin_repartir: (function () {
        var x = null;
        ficheros.forEach(function (f) { if (!x && f.sin_repartir) x = f.sin_repartir; });
        return x;
      })(),
      /* S2, fallo 10: TODOS sus papeles son papeles que no dicen el piso
         de un portal donde conozco varios. Esto no es una casa: es un
         montón apartado. No se le piden papeles como a una casa. */
      _solo_papeles_sin_piso: (function () {
        var propios = ficheros.filter(function (f) { return !esCopiaDeAqui(f); });
        return propios.length > 0 && propios.every(function (f) { return !!f.sin_repartir; });
      })()
    };
  }

  /* ==================================================================
     5. QUÉ FICHERO SOSTIENE CADA AVISO
     ------------------------------------------------------------------
     repaso.js mete el nombre del papel dentro del título y del detalle
     del aviso (lo hace con conEl(d.cual)). Así que para saber de qué
     fichero salió un aviso basta con mirar qué documento del expediente
     está nombrado ahí dentro. Si no hay ninguno, el aviso se apoya en
     TODOS los papeles del expediente — que es exactamente lo que
     sostiene un «aquí no aparece X»: la ausencia se prueba con la lista
     entera, no con un papel suelto.
     ================================================================== */
  function pruebasDelAviso(aviso, exp) {
    var texto = sinTildes(aviso.titulo + " " + aviso.detalle);
    var senalados = [];
    (exp.documentos || []).forEach(function (d) {
      var c = sinTildes(d.cual);
      if (c && texto.indexOf(c) >= 0) senalados.push({ fichero: d._fichero, nombre: d._nombre, papel: d.cual });
    });
    if (senalados.length) return { tipo: "papeles", ficheros: senalados };
    if (aviso.clase === "parado" && exp._pruebas.ultimo_movimiento) {
      return { tipo: "fecha", ficheros: [{ fichero: exp._pruebas.ultimo_movimiento.fichero,
                                           nombre: exp._pruebas.ultimo_movimiento.nombre,
                                           papel: exp._pruebas.ultimo_movimiento.frase }] };
    }
    return { tipo: "ausencia",
             ficheros: (exp.documentos || []).map(function (d) {
               return { fichero: d._fichero, nombre: d._nombre, papel: d.cual };
             }) };
  }

  /* ==================================================================
     6. LA RED DE SEGURIDAD
     ------------------------------------------------------------------
     Un aviso que se contradice a sí mismo es lo peor que puede pasar
     delante de una clienta: decirle «no aparece el certificado de la
     comunidad» y que justo debajo, en «de dónde lo saco», salga el
     fichero con ese nombre. Pasó quince veces.

     La causa de fondo ya está arreglada (el clasificador no leía los
     guiones ni los subrayados). Esto es lo de encima: antes de pintar un
     aviso de «falta X», se mira el NOMBRE de todos los ficheros del
     expediente. Si alguno lo nombra, el aviso NO se pinta, y queda
     apuntado por qué no se ha pintado.

     Se mira el nombre del fichero a propósito, porque es lo único que
     hay cuando el papel está escaneado — que es justo cuando fallaba.
     ================================================================== */
  function loQueBuscaLaTabla(cual) {
    var busca = [];
    var C = raiz && raiz.IMMOIA_REPASO && raiz.IMMOIA_REPASO.CARPETA;
    if (!C) return busca;
    for (var k in C) {
      for (var i = 0; i < C[k].length; i++) {
        if (C[k][i].cual === cual || sinTildes(C[k][i].cual) === sinTildes(cual)) {
          C[k][i].busca.forEach(function (b) { if (busca.indexOf(b) < 0) busca.push(b); });
        }
      }
    }
    return busca;
  }

  function avisoDesmentido(aviso, exp) {
    if (aviso.clase !== "falta") return null;
    var texto = sinTildes(aviso.titulo + " " + aviso.detalle);
    /* qué papel dice que falta: el que la tabla nombra dentro del aviso */
    var palabras = null, cualDice = null;
    var C = raiz && raiz.IMMOIA_REPASO && raiz.IMMOIA_REPASO.CARPETA;
    if (C) {
      for (var k in C) {
        for (var i = 0; i < C[k].length; i++) {
          if (texto.indexOf(sinTildes(C[k][i].cual)) >= 0) {
            palabras = loQueBuscaLaTabla(C[k][i].cual);
            cualDice = C[k][i].cual;
            break;
          }
        }
        if (palabras) break;
      }
    }
    if (!palabras || !palabras.length) return null;
    var encontrado = null;
    (exp._ficheros || []).forEach(function (f) {
      if (encontrado) return;
      var n = comoPalabras(f.nombre);
      palabras.forEach(function (p) {
        if (!encontrado && n.indexOf(p) >= 0) encontrado = { fichero: f, palabra: p, cual: cualDice };
      });
    });
    return encontrado;
  }

  /* Cuántos días hacen falta para empezar a pedirle papeles a un
     expediente. Por debajo de esto, lo que pasa no es que falten: es que
     acaba de abrirse. */
  var DIAS_PARA_PEDIRLE_PAPELES = 10;
  function recienAbierto(exp, hoy) {
    if (!exp._recien_abierto || !exp._recien_abierto.fecha_papel) return null;
    var desde = exp._recien_abierto.fecha_papel.iso;
    var d = Math.round((new Date(hoy + "T12:00:00") - new Date(desde + "T12:00:00")) / 86400000);
    if (d < 0 || d > DIAS_PARA_PEDIRLE_PAPELES) return null;
    return { dias: d, desde: desde, fichero: exp._recien_abierto };
  }

  /* ==================================================================
     7. LO QUE MIRA ESTA CAPA Y NO MIRA repaso.js
     ------------------------------------------------------------------
     Todo lo de aquí sale de la tabla de papeles de OT-25 o de las cifras
     legales comprobadas, y todo señala el fichero del que sale.
     ================================================================== */

  /* --- 7.1 Un borrador sin firmar no arrastra papeles detrás ---------
     Si el contrato de alquiler es un borrador, el depósito de la fianza
     y el inventario todavía no tocan: no hay contrato del que cuelguen.
     Decir «falta el resguardo de la fianza» sobre un borrador es el
     susto que no nos podemos permitir. */
  var CUELGAN_DEL_CONTRATO = ["fianza", "inventario"];
  function colgadoDeUnBorrador(aviso, exp) {
    if (aviso.clase !== "falta") return null;
    var borradorContrato = null;
    (exp._ficheros || []).forEach(function (f) {
      if (f.es_borrador && f.papel && f.papel.clave === "contrato") borradorContrato = f;
    });
    if (!borradorContrato) return null;
    var texto = sinTildes(aviso.titulo + " " + aviso.detalle);
    var toca = CUELGAN_DEL_CONTRATO.some(function (c) { return texto.indexOf(c) >= 0; });
    return toca ? borradorContrato : null;
  }

  /* --- 7.1.b Un plazo que se pasó hace años no es la noticia de hoy ---
     «Se pasó el plazo de depositar la fianza — infracción grave» sobre un
     contrato firmado hace cinco años es alarmismo: la única prueba que
     tenemos es que el resguardo no está HOY en la carpeta, y de un
     contrato de 2021 eso no prueba que no se depositara en su momento.
     Para un contrato reciente sí es noticia; para uno viejo, no.
     Así que por encima del año, el aviso se calla y se deja apuntado. */
  var MESES_PARA_QUE_EL_PLAZO_SEA_NOTICIA = 12;
  function plazoDemasiadoViejo(aviso, exp, hoy) {
    if (aviso.clase !== "vencido") return null;
    if (sinTildes(aviso.titulo).indexOf("fianza") < 0) return null;
    var contrato = null;
    (exp._ficheros || []).forEach(function (f) {
      if (!contrato && !f.duplicado_de && f.papel && f.papel.clave === "contrato" && f.fecha_papel) {
        contrato = f;
      }
    });
    if (!contrato) return null;
    var meses = (new Date(hoy + "T12:00:00") - new Date(contrato.fecha_papel.iso + "T12:00:00")) / 86400000 / 30.4;
    if (meses <= MESES_PARA_QUE_EL_PLAZO_SEA_NOTICIA) return null;
    return { fichero: contrato, meses: Math.round(meses) };
  }

  /* --- 7.2 Fechas que solo dice el nombre y no se pueden confirmar ---
     Un papel escaneado con la fecha en el nombre es una fecha de la que
     no podemos responder. Y si de esa fecha cuelga un plazo, peor. */
  var LA_FECHA_IMPORTA = ["energetico", "comunidad", "contrato", "arras", "notaria", "fianza"];
  function fechasDeLasQueNoMeFio(exp) {
    return (exp._ficheros || []).filter(function (f) {
      return !f.duplicado_de && f.lectura !== "leido" && f.fecha_papel &&
             f.fecha_papel.de_donde === "el nombre del fichero" &&
             f.papel && LA_FECHA_IMPORTA.indexOf(f.papel.clave) >= 0;
    });
  }
  function fechasImposibles(exp) {
    return (exp._ficheros || []).filter(function (f) { return f.fecha_imposible_en_el_nombre; });
  }

  /* --- 7.3 El contrato de alquiler que cumple años ------------------
     Mínimo de 5 años (7 si el arrendador es empresa) y preaviso de 4
     meses el arrendador / 2 el inquilino.
     Fuente: TABLA_PAPELES_Y_VENTANILLAS.md ap. 4 (art. 9 y 36 LAU). */
  var ANIOS_MINIMO_LAU = 5;
  var MESES_PREAVISO_ARRENDADOR = 4;
  function cumpleAniosElContrato(exp, hoy) {
    if (exp.tipo_operacion !== "alquiler") return null;
    var contrato = null;
    (exp._ficheros || []).forEach(function (f) {
      if (contrato || f.duplicado_de) return;
      if (f.papel && f.papel.clave === "contrato" && f.fecha_papel && !f.es_borrador) contrato = f;
    });
    if (!contrato) return null;
    var firma = contrato.fecha_papel.iso;
    var p = firma.split("-");
    var cumple = (Number(p[0]) + ANIOS_MINIMO_LAU) + "-" + p[1] + "-" + p[2];
    var dias = Math.round((new Date(cumple + "T12:00:00") - new Date(hoy + "T12:00:00")) / 86400000);
    if (dias < -30 || dias > 60) return null;      /* ni muy pasado ni muy lejos */
    return { fichero: contrato, firma: firma, cumple: cumple, dias: dias,
             preaviso_pasado: dias < MESES_PREAVISO_ARRENDADOR * 30 };
  }

  /* --- 7.4 Los papeles que la tabla marca «a veces» -----------------
     No son obligatorios en toda operación, así que NO se dicen como
     «falta»: se dicen aparte y con su matiz. Si se metieran en la lista
     dura saldría un falso «te falta» en cada venta que no lo necesita. */
  var A_VECES = [
    { operacion: "venta", clave: "ocupacion",
      cual: "la cédula de habitabilidad o la comunicación previa de ocupación",
      busca: ["ocupacion", "habitabilidad", "cedula"],
      porque: "sin ella no se dan de alta los suministros al comprador, y tramitarla lleva de 2 a 6 " +
              "semanas (eso es práctica de oficina, no plazo de norma: el plazo de norma es el mes " +
              "de la comunicación previa)",
      fuente: "OT-25 · TABLA_PAPELES_Y_VENTANILLAS.md ap. 1 (frecuencia «a veces») · " +
              "cifras_legales.json OCUPACION-01, Ley 4/2017 art. 332.1.c" }
  ];
  function papelesDeAVeces(exp) {
    var out = [];
    A_VECES.forEach(function (p) {
      if (exp.tipo_operacion !== p.operacion) return;
      var esta = (exp._ficheros || []).some(function (f) {
        var n = comoPalabras(f.nombre) + " " + comoPalabras(String(f.texto || "").slice(0, 1500));
        return p.busca.some(function (b) { return n.indexOf(b) >= 0; });
      });
      if (!esta) out.push(p);
    });
    return out;
  }

  /* ==================================================================
     8. LO QUE NO SE ABRE, CON SU MOTIVO VERDADERO (S2, 24/09/2026)
     ------------------------------------------------------------------
     lector_carpeta.js no es de este taller y no se toca. Aquí se corrige
     encima, antes de contar, lo que dice de dos casos:
       · un PDF de 0 bytes: el lector de PDF lo daba como «error» con un
         motivo en inglés («The PDF file is empty...») y se contaba como
         roto. No está roto: está vacío. Se dice así y en castellano.
       · un fichero que se llama .pdf y por dentro es un zip (el Word
         .docx lo es): pareceUnZip() mira los cuatro primeros bytes. Lo
         demás (leerlo como Word) lo hace la pantalla, que es quien tiene
         el fichero entero.
     ================================================================== */
  function corregirLoQueNoSeAbre(ficheros) {
    var cambiados = 0;
    (ficheros || []).forEach(function (f) {
      if (!f || f.bytes !== 0 || f.lectura === "vacio" || f.lectura === "leido") return;
      f.lectura = "vacio";
      f.lectura_antes = f.lectura_antes || "error";
      f.motivo_no_leido = "el fichero está vacío: pesa 0 bytes, así que dentro no pone nada";
      cambiados++;
    });
    return cambiados;
  }
  function pareceUnZip(u8) {
    return !!(u8 && u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 0x03 && u8[3] === 0x04);
  }

  var API = {
    version: VERSION,
    corregirLoQueNoSeAbre: corregirLoQueNoSeAbre,
    pareceUnZip: pareceUnZip,
    rolDelNombre: rolDelNombre,
    TIPOS: TIPOS,
    colgadoDeUnBorrador: colgadoDeUnBorrador,
    plazoDemasiadoViejo: plazoDemasiadoViejo,
    fechasDeLasQueNoMeFio: fechasDeLasQueNoMeFio,
    fechasImposibles: fechasImposibles,
    cumpleAniosElContrato: cumpleAniosElContrato,
    papelesDeAVeces: papelesDeAVeces,
    avisoDesmentido: avisoDesmentido,
    recienAbierto: recienAbierto,
    esBorrador: esBorrador,
    titularConPasaporte: titularConPasaporte,
    comoPalabras: comoPalabras,
    DIAS_PARA_PEDIRLE_PAPELES: DIAS_PARA_PEDIRLE_PAPELES,
    agrupar: agrupar,
    queePapelEs: queePapelEs,
    direccionDe: direccionDe,
    personaDe: personaDe,
    referenciaDe: referenciaDe,
    fechasDe: fechasDe,
    fechaDelPapel: fechaDelPapel,
    nombreLimpio: nombreLimpio,
    buscarDuplicados: buscarDuplicados,
    queOperacionEs: queOperacionEs,
    esDeEnergia: esDeEnergia,
    pruebasDelAviso: pruebasDelAviso,
    aISO: aISO, sinTildes: sinTildes
  };
  if (typeof module === "object" && module.exports) module.exports = API;
  if (raiz) raiz.IMMOIA_DEDUCCION = API;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null));
