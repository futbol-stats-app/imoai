/* ============================================================
   PIEZA 4 \u00b7 lectura.js
   Como se lee en voz alta lo que esta escrito, y en que trozos.

   Parte de la logica de secretaria.js de IMMO IA. Diferencia
   (17/09): las fechas se leen en palabras.
     - "euros" y no "\u20ac", "metros cuadrados" y no "m\u00b2"
     - fechas 31/07/2027 -> treinta y uno de julio de dos mil veintisiete
     - 5.500 -> 5500 (que no diga "cinco punto quinientos")
     - trozos de 220 letras como mucho: Chrome corta los largos
     - nunca corta tras "Sr." o "D.N.I."
   ============================================================ */

var MESES = ["enero","febrero","marzo","abril","mayo","junio","julio",
             "agosto","septiembre","octubre","noviembre","diciembre"];

var UNI = ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez",
           "once","doce","trece","catorce","quince","diecis\u00e9is","diecisiete","dieciocho","diecinueve",
           "veinte","veintiuno","veintid\u00f3s","veintitr\u00e9s","veinticuatro","veinticinco",
           "veintis\u00e9is","veintisiete","veintiocho","veintinueve"];
var DEC = ["", "", "", "treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
var CEN = ["", "ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos",
           "setecientos","ochocientos","novecientos"];

/* 0..9999 en letras (lo justo para dias y anos) */
export function enLetras(n) {
  n = Math.floor(Number(n));
  if (!(n >= 0) || n > 9999) return String(n);
  if (n < 30) return UNI[n];
  if (n < 100) return DEC[Math.floor(n / 10)] + (n % 10 ? " y " + UNI[n % 10] : "");
  if (n === 100) return "cien";
  if (n < 1000) return CEN[Math.floor(n / 100)] + (n % 100 ? " " + enLetras(n % 100) : "");
  var mil = Math.floor(n / 1000), resto = n % 1000;
  return (mil === 1 ? "mil" : enLetras(mil) + " mil") + (resto ? " " + enLetras(resto) : "");
}

export function paraDecir(t) {
  t = String(t == null ? "" : t);

  t = t.replace(/\[CASA\s*:\s*[^\]]+\]/gi, " ");        /* la marca del v\u00eddeo no se lee */
  t = t.replace(/https?:\/\/\S+/g, " el enlace que te dejo ");
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ");  /* emojis fuera */

  /* fechas, en palabras para que ninguna voz las lea como ordinales
     (17/09: una voz de Windows leyo "el 15/10/2026" como "el quinto"):
       15/10/2026 -> quince de octubre de dos mil veintiseis
       5/10       -> cinco de octubre
       el 5 de octubre, el 24 -> el cinco de octubre, el veinticuatro */
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, function (x, d, m, a) {
    var i = parseInt(m, 10) - 1, dd = parseInt(d, 10);
    if (!MESES[i] || dd < 1 || dd > 31) return x;
    return enLetras(dd) + " de " + MESES[i] + " de " + enLetras(parseInt(a, 10));
  });
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\b(?!\s*(?:partes?|del?\b))/g, function (x, d, m) {
    var i = parseInt(m, 10) - 1, dd = parseInt(d, 10);
    if (!MESES[i] || dd < 1 || dd > 31) return x;
    return enLetras(dd) + " de " + MESES[i];
  });
  t = t.replace(new RegExp("\\b(\\d{1,2})\\s+de\\s+(" + MESES.join("|") + ")\\b(?:\\s+de\\s+(\\d{4})\\b)?", "gi"), function (x, d, mes, a) {
    var dd = parseInt(d, 10);
    if (dd < 1 || dd > 31) return x;
    return enLetras(dd) + " de " + mes + (a ? " de " + enLetras(parseInt(a, 10)) : "");
  });
  t = t.replace(/\b(el|del|al|d[i\u00ed]a)\s+(\d{1,2})(?=\s*(?:[.,;:!?)](?!\d)|$|y\s|o\s|al\s|a\s+las?\s))/gi, function (x, art, d) {
    var dd = parseInt(d, 10);
    if (dd < 1 || dd > 31) return x;
    return art + " " + enLetras(dd);
  });

  /* n\u00fameros con punto de miles: 5.500 -> 5500 para que no diga \u00abcinco punto quinientos\u00bb */
  t = t.replace(/\b(\d{1,3})(?:\.(\d{3}))+\b/g, function (m) { return m.replace(/\./g, ""); });
  /* decimales con coma: 4,91 -> 4 con 91 */
  t = t.replace(/\b(\d+),(\d+)\b/g, "$1 con $2");

  t = t.replace(/(\d)\s*\u20ac/g, "$1 euros").replace(/\u20ac/g, " euros ");
  t = t.replace(/(\d)\s*%/g, "$1 por ciento").replace(/%/g, " por ciento ");
  t = t.replace(/m\u00b2|m2\b/gi, "metros cuadrados");
  t = t.replace(/\bkWp?\b/gi, "kilovatios");
  t = t.replace(/\bIBI\b/g, "I.B.I.").replace(/\bICIO\b/g, "I.C.I.O.");
  t = t.replace(/\bIRPF\b/g, "I.R.P.F.").replace(/\bDNI\b/g, "D.N.I.");
  t = t.replace(/\bIA\b/g, "I.A.");
  t = t.replace(/\bn\u00ba|\bn\.\u00ba/gi, "n\u00famero ");
  t = t.replace(/\bhab\b\.?/gi, "habitaciones");
  t = t.replace(/\baprox\b\.?/gi, "aproximadamente");

  t = t.replace(/(\d)\s*\u20ac?\s*\/\s*mes\b/gi, "$1 al mes");
  t = t.replace(/\/\s*(mes|a[\u00f1n]o|kWh|m2)\b/gi, " al $1");
  t = t.replace(/[*_#`>|\u00b7\u2022]/g, " ");                     /* restos de formato */
  t = t.replace(/\s*[-\u2013\u2014]\s+/g, ", ");                   /* guiones de lista -> pausa */
  t = t.replace(/\.{3,}/g, "\u2026");

  /* limpieza de puntuaci\u00f3n: quitar formato deja cosas como \u00aba la vez :, El CUPS\u00bb */
  t = t.replace(/\s+([,.;:!?])/g, "$1");                 /* sin espacio antes del signo */
  t = t.replace(/([:;])\s*[,;]+/g, "$1");                /* \u00ab:,\u00bb -> \u00ab:\u00bb */
  t = t.replace(/,\s*([.:;!?])/g, "$1");                 /* \u00ab,.\u00bb -> \u00ab.\u00bb */
  /* \u00ab.,\u00bb -> \u00ab.\u00bb, pero sin tocar \u00abI.B.I.,\u00bb ni \u00abD.N.I.,\u00bb */
  t = t.replace(/([a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f10-9]{2,}[)\]"\u00bb']?[.!?])\s*,/g, "$1");
  t = t.replace(/,{2,}/g, ",");
  t = t.replace(/([,:;])(?=\S)/g, "$1 ");                /* siempre un espacio detr\u00e1s */

  t = t.replace(/\s{2,}/g, " ").trim();
  t = t.replace(/^[,;:.\s]+/, "");                       /* que no empiece por un signo */
  return t;
}

var CORTAS = ["sr","sra","srta","dr","dra","d\u00f1a","dna","ud","uds","n\u00fam","num",
              "art","p\u00e1g","pag","etc","ej","av","avda","ref","apdo","tel",
              "h","min","seg","km","kg","aprox","m\u00e1x","max","m\u00edn","min","pta","dcha","izq"];

function esAbreviatura(act) {
  var m = /([A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00dc\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f10-9.]+)\.$/.exec(act);
  if (!m) return false;
  var pal = m[1];
  if (pal.length === 1) return true;                       /* \u00abD.\u00bb, \u00aby.\u00bb */
  if (/^(?:[A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]\.)+[A-Za-z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]$/.test(pal)) return true;  /* \u00abD.N.I.\u00bb */
  return CORTAS.indexOf(pal.toLowerCase()) >= 0;
}

export function frases(t) {
  t = String(t);
  var out = [], act = "";
  for (var i = 0; i < t.length; i++) {
    act += t[i];
    if (".!?\u2026:".indexOf(t[i]) >= 0) {
      var sig = t[i + 1];
      /* solo corta si detr\u00e1s viene un espacio: as\u00ed no parte 1.500 */
      if (sig === undefined || sig === " " || sig === "\n" || sig === "\t") {
        /* y nunca detr\u00e1s de \u00abSr.\u00bb o \u00abD.N.I.\u00bb: eso no es final de frase */
        if (t[i] === "." && esAbreviatura(act)) continue;
        if (act.trim()) out.push(act.trim());
        act = "";
      }
    }
  }
  if (act.trim()) out.push(act.trim());
  return out;
}

export function trocear(t) {
  var trozos = [];
  /* corta por final de frase, y si una frase es largu\u00edsima, por comas */
  frases(t).forEach(function (f) {
    f = f.trim(); if (!f) return;
    if (f.length <= 220) { trozos.push(f); return; }
    var acumulado = "";
    f.split(/,\s*/).forEach(function (p) {
      /* la coma se queda en el trozo: si no, se pierde la pausa al juntarlos */
      if ((acumulado + ", " + p).length > 220 && acumulado) { trozos.push(acumulado + ","); acumulado = p; }
      else { acumulado = acumulado ? acumulado + ", " + p : p; }
    });
    if (acumulado) trozos.push(acumulado);
  });
  trozos = pegarCortos(trozos);
  return trozos.length ? trozos : [String(t)];
}

/* \u00abEl Sr.\u00bb no se dice solo y luego \u00abP\u00e9rez\u00bb: eso suena a tartamudeo.
   Pegamos los trozos muy cortos y los que acaban en abreviatura. */
var ABREV = /(?:^|\s)(?:sr|sra|srta|dr|dra|d\u00f1a|dna|ud|uds|n\u00fam|num|art|p[\u00e1a]g|etc|ej|av|avda|ref|apdo|tel)\.$|(?:^|\s)(?:[A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1]\.){2,}$/i;

function pegarCortos(lista) {
  var out = [];
  lista.forEach(function (t) {
    var prev = out.length ? out[out.length - 1] : null;
    if (prev && (prev.length < 45 || ABREV.test(prev)) && (prev + " " + t).length <= 220) {
      out[out.length - 1] = prev + " " + t;
    } else out.push(t);
  });
  return out;
}
