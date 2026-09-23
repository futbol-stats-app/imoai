/* =============================================================
   IMMO IA · ENERGIA_CUENTA.JS — la cuenta de las placas, UNA sola
   =============================================================
   Las tres paginas de placas (renovables.html, renovables_vacacional.html
   y energia.html) hacian cada una su cuenta, y para el mismo caso daban
   cifras distintas (646 € contra 384 € de ahorro al ano, cuota a 10 contra
   12 anos, el 40 % a cualquiera en una y solo con termo o aire en otra).
   Desde ahora las tres llaman a ESTE fichero, y este fichero solo lee
   datos.js. Si una cifra cambia, se cambia en datos.js.

   Se carga DESPUES de datos.js y ANTES del script de la pagina:
       <script src="datos.js"></script>
       <script src="energia_cuenta.js"></script>

   REGLAS QUE CUMPLE
   - Una bonificacion de N anos se reparte en N anos: nunca se resta
     entera del precio de hoy.
   - El 40 % solo con los dos certificados, pagando IRPF, con termo
     electrico o aire, y nunca en un alquiler turistico.
   - Los certificados solo se cobran si dan alguna deduccion.
   - El ICIO solo se resta donde el municipio tiene bonificacion publicada
     (y se marca como estimacion sin verificar).
   - Una vivienda (habitual o de larga temporada) esta ocupada todo el ano.
   - El tope de la compensacion (RD 244/2019, art. 14) se aplica siempre.
   - El tipo del prestamo es NOMINAL anual y es un supuesto: no es una TAE.
   ============================================================= */
(function(global){
"use strict";

function D(){ return global.DATOS_IMMOIA || {}; }
function num(v, porDefecto){ return (typeof v === "number" && isFinite(v)) ? v : porDefecto; }

/* ---------- los numeros, todos de datos.js ---------- */
function parametros(){
  var d = D(), n = d.numeros || {}, ie = d.irpfEstatal || {};
  var c40 = ie.conCertificados || {};
  return {
    eurPanel:     num(n.eurPorPanel, 687.5),
    kwpPanel:     num(n.kwpPorPanel, 0.45),
    kwhPorKwp:    num(n.kwhPorKwp, 1700),
    autoconsumo:  num(n.autoconsumo, 0.35),
    precioLuz:    num(n.precioLuz, 0.19),
    precioExc:    num(n.precioExcedente, 0.06),
    costeCert:    num(n.costeCertificados, 200),
    icio:         num(n.icio, 150),
    /* datos.js lo guarda con el nombre «tae», pero la cuenta lo usa como tipo
       NOMINAL anual (se divide entre 12). Por eso aqui se llama por su nombre. */
    tipoNominal:  num(n.tae, 0.0625),
    mejorTae:     num(n.mejorTaePublicada, null),
    plazo:        num(n.plazoAnos, 10),
    kwhDiaOcupado:num(n.kwhDiaOcupado, 10),
    kwhDiaVacio:  num(n.kwhDiaVacio, 1.2),
    solOcupado:   num(n.solOcupado, 0.45),
    solVacio:     num(n.solVacio, 0.50),
    parteEnergia: num(n.parteEnergiaFactura, 0.70),
    mesDevolucion:num(n.mesDevolucion, 12),
    descuentoInstalador: num(n.descuentoInstalador, 0),
    pct40:        num(c40.pct, 0.40),
    base40:       num(c40.base, 7500)
  };
}

/* ---------- formatos: coma decimal y punto de miles, como en Espana ---------- */
function miles(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
function eur(x){
  var r = Math.round(Number(x) || 0);
  return (r < 0 ? "−" : "") + miles(Math.abs(r)) + " €";
}
function decimal(x, dec){
  var p = Math.pow(10, dec == null ? 1 : dec);
  return (Math.round(x * p) / p).toString().replace(".", ",");
}
function anos(x){ return decimal(x, 1) + " años"; }
function mesesTexto(m){
  m = Math.max(0, Math.round(m));
  var a = Math.floor(m / 12), r = m % 12;
  var t = [];
  if(a) t.push(a + (a === 1 ? " año" : " años"));
  if(r) t.push(r + (r === 1 ? " mes" : " meses"));
  return t.length ? t.join(" y ") : "0 meses";
}
function pct(x){ return decimal(x * 100, 2) + " %"; }
function kwh(x){ return miles(Math.round(Number(x) || 0)) + " kWh"; }

/* ---------- el prestamo ---------- */
function cuota(principal, plazoAnos){
  var p = parametros();
  if(!(principal > 0) || !(plazoAnos > 0)) return 0;
  var i = p.tipoNominal / 12, m = plazoAnos * 12;
  if(i === 0) return principal / m;
  return principal * i / (1 - Math.pow(1 + i, -m));
}
function saldoTras(principal, cuotaMes, meses){
  var i = parametros().tipoNominal / 12, s = principal;
  for(var k = 0; k < meses && s > 0; k++){ s = s * (1 + i) - cuotaMes; }
  return Math.max(0, s);
}
/* Cuantos meses tarda en pagarse un prestamo con una cuota fija dada, metiendo
   la devolucion de Hacienda en el mes que toque. null = no se paga nunca. */
function mesesPagando(principal, cuotaMes, devolucion, mesDev){
  if(!(principal > 0)) return 0;
  if(!(cuotaMes > 0)) return null;
  var i = parametros().tipoNominal / 12, s = principal, m = 0;
  while(s > 1e-9 && m < 480){
    s = s * (1 + i) - cuotaMes;
    m++;
    if(m === mesDev && devolucion > 0) s = Math.max(0, s - devolucion);
    if(m > 60 && cuotaMes <= s * i) return null;
  }
  return s <= 1e-9 ? m : null;
}
/* La TAE que corresponde al tipo nominal (sin comisiones): (1 + i/12)^12 - 1 */
function taeDeNominal(tn){ return Math.pow(1 + tn / 12, 12) - 1; }

/* ---------- cuantos paneles pide una factura ---------- */
function consumoDeFactura(facturaMes){
  var p = parametros();
  return facturaMes * 12 * p.parteEnergia / p.precioLuz;
}
function panelesPara(facturaMes){
  var p = parametros();
  var consumo = consumoDeFactura(facturaMes);
  var kwpIdeal = (consumo / p.kwhPorKwp) * 1.4;
  var n = Math.round(kwpIdeal / p.kwpPanel);
  return Math.max(4, Math.min(16, Math.round(n / 2) * 2));
}

/* ---------- los municipios ---------- */
function municipios(){ return D().municipios || {}; }
function municipio(k){
  var M = municipios();
  var b = M[k] || M.otro || [0, 0, 0, "No se han podido cargar los datos de los municipios: la bonificación del IBI va a 0.", "otro municipio", false];
  return { clave: M[k] ? k : "otro", pct: num(b[0], 0), anos: num(b[1], 0), tope: num(b[2], 0),
           aviso: b[3] || "", nombre: b[4] || "", soloHabitual: b[5] === true };
}
/* La etiqueta de la lista sale de datos.js y de ningun otro sitio: asi las
   tres paginas no pueden decir cosas distintas de un mismo municipio. */
function etiquetaMunicipio(k){
  var m = municipio(k);
  if(m.pct > 0){
    return m.nombre + " — " + Math.round(m.pct * 100) + " % · " + m.anos + " años"
         + (m.tope > 0 ? " (tope " + eur(m.tope) + ")" : "");
  }
  return m.nombre + " — sin bonificación confirmada (cuenta 0 €)";
}

/* ---------- las comunidades ---------- */
function comunidades(){ return D().comunidades || {}; }
function comunidadesConDeduccion(){
  var C = comunidades();
  return Object.keys(C).filter(function(k){ return !!(C[k] && C[k].deduccion); });
}

/* =============================================================
   LA CUENTA
   -------------------------------------------------------------
   e = {
     paneles        numero de paneles (si no viene y hay factura, se calcula)
     uso            "vivienda" | "tur" | "lar" | "hab"  ("casa", "piso" = vivienda)
     dias           dias ocupado al ano (solo cuenta en "tur")
     facturaMes     lo que paga de luz al mes (opcional)
     ccaa           clave de datos.js (por defecto "cn")
     muni           clave del municipio (solo Canarias/Tenerife)
     ibiRecibo      IBI al ano segun su recibo (opcional)
     irpf           "si" | "no" | "nose"   (paga mas de 2.500 € de cuota)
     apto           true si el agua caliente es electrica o hay aire
     certificados   false si NO quiere los dos certificados (por defecto: si,
                    pero solo se cobran si dan alguna deduccion)
     entrada        euros de entrada (se avisa si es negativa o pasa del total)
     plazoAnos      anos del prestamo; 0 = al contado
     hoy            Date (para la fecha limite de la deduccion del 10 %)
   }
   ============================================================= */
function cuenta(e){
  e = e || {};
  var p = parametros(), d = D(), avisos = [];
  var uso = (e.uso === "tur" || e.uso === "vac") ? "tur"
          : (e.uso === "lar") ? "lar"
          : "vivienda";
  var esTur = uso === "tur";
  var hoy = e.hoy instanceof Date ? e.hoy : new Date();

  var factura = Number(e.facturaMes);
  var hayFactura = factura > 0 && isFinite(factura);

  var n = Math.round(Number(e.paneles));
  if(!(n > 0)) n = hayFactura ? panelesPara(factura) : 8;

  /* ---- dias ocupado: una vivienda lo esta todo el ano ---- */
  var dias = esTur ? Math.max(0, Math.min(365, Number(e.dias))) : 365;
  if(!isFinite(dias)) dias = 0;
  var oc = dias / 365;

  /* ---- produccion ---- */
  var kwp = n * p.kwpPanel;
  var prod = kwp * p.kwhPorKwp;
  var coste = n * p.eurPanel;

  /* ---- consumo: el de su factura si la da; si no, el estimado ---- */
  var consumo, consumoFuente;
  if(hayFactura){ consumo = consumoDeFactura(factura); consumoFuente = "factura"; }
  else {
    consumo = (p.kwhDiaVacio + oc * (p.kwhDiaOcupado - p.kwhDiaVacio)) * 365;
    consumoFuente = "estimado";
  }

  /* ---- lo que se aprovecha en casa ---- */
  var auto;
  if(esTur){
    /* en un turistico solo cuenta lo que coincide con horas de sol */
    var solDia = (p.kwhDiaVacio * p.solVacio)
               + oc * (p.kwhDiaOcupado * p.solOcupado - p.kwhDiaVacio * p.solVacio);
    auto = Math.min(solDia * 365, prod, consumo);
  } else {
    auto = Math.min(prod * p.autoconsumo, consumo);
  }
  var sobra = Math.max(0, prod - auto);

  /* ---- el tope de la compensacion (RD 244/2019, art. 14) ---- */
  var compra = Math.max(0, consumo - auto);
  var topeCompensa = compra * p.precioLuz;
  var valorSobra = sobra * p.precioExc;
  var compensa = Math.min(valorSobra, topeCompensa);
  var regala = Math.max(0, valorSobra - compensa);
  var kwhRegala = p.precioExc > 0 ? regala / p.precioExc : 0;
  var kwhCompensa = Math.max(0, sobra - kwhRegala);

  var ahorroPropio = auto * p.precioLuz;
  var ahorroAno = ahorroPropio + compensa;
  var ahorroCede = ahorroPropio;

  /* ---- la comunidad ---- */
  var ccaa = e.ccaa || "cn";
  var CC = comunidades()[ccaa] || null;
  var esForal = !!(CC && CC.foral);

  /* ---- la subvencion, si hay alguna abierta ---- */
  var subv = 0, subvNota = CC && CC.subvencion ? (CC.subvencion.nota || "") : "";
  if(CC && CC.subvencion && CC.subvencion.estado === "abierta" && CC.subvencion.importe > 0){
    subv = Math.min(CC.subvencion.importe * kwp, coste);
  }

  /* ---- las deducciones ---- */
  var irpfSi = e.irpf === "si";
  var apto = e.apto === true;
  var puede40 = !esTur && irpfSi && apto && !esForal;
  /* la autonomica: no en turistico; en larga temporada no la contamos (sin verificar) */
  var puedeCcaa = !esTur && uso !== "lar" && irpfSi && apto && !!(CC && CC.deduccion);
  var certUtiles = puede40 || puedeCcaa;
  var gastoCert = (e.certificados !== false && certUtiles) ? p.costeCert : 0;
  var conCert = gastoCert > 0;
  var baseIrpf = Math.max(0, coste + gastoCert - subv);

  var irpfEstado = 0, irpfTipo = "";
  if(conCert && puede40){
    irpfEstado = p.pct40 * Math.min(baseIrpf, p.base40);
    irpfTipo = "40 %, eficiencia energética";
  } else if(irpfSi && !esTur && !esForal){
    /* la del 10 % por autoconsumo: no pide certificados, solo el CIE */
    var AC = (d.irpfEstatal || {}).autoconsumo;
    if(AC && AC.hasta && hoy <= new Date(AC.hasta + "T23:59:59")){
      irpfEstado = AC.pct * Math.min(Math.max(0, coste - subv), AC.base);
      irpfTipo = "10 %, autoconsumo 2026";
    }
  }
  var irpfCcaa = 0;
  if(conCert && puedeCcaa && typeof d.deduccionAutonomica === "function"){
    irpfCcaa = d.deduccionAutonomica(ccaa, baseIrpf);
  }
  var irpf = irpfEstado + irpfCcaa;

  /* por que no hay 40 %, dicho una vez para las tres paginas */
  var motivoSin40 = "";
  if(!(irpfEstado > 0 && irpfTipo.indexOf("40") === 0)){
    motivoSin40 = esTur ? "no aplica al alquiler turístico"
                : esForal ? "tu comunidad tiene IRPF propio"
                : !irpfSi ? (e.irpf === "no" ? "no llegas a la cuota" : "no sabemos si pagas IRPF suficiente")
                : e.apto === false ? "sin termo eléctrico ni aire no hay consumo eléctrico que compensar"
                : !apto ? "no sabemos si tienes termo eléctrico o aire: mientras no lo sepamos, va a 0"
                : e.certificados === false ? "sin los dos certificados no hay 40 %"
                : "";
  }

  /* ---- el IBI y el ICIO, que son municipales (solo tenemos Tenerife) ---- */
  var hayMuni = ccaa === "cn" && !!e.muni;
  var m = municipio(hayMuni ? e.muni : "otro");
  var recibo = Math.max(0, Number(e.ibiRecibo) || 0);
  var aplicaIbi = hayMuni && m.pct > 0 && !(m.soloHabitual && esTur);
  var ibiAnual = (aplicaIbi && recibo > 0) ? recibo * m.pct : 0;
  if(m.tope > 0 && ibiAnual > m.tope) ibiAnual = m.tope;
  var ibiAnos = ibiAnual > 0 ? m.anos : 0;
  var ibiTotal = ibiAnual * ibiAnos;
  var icio = (hayMuni && m.pct > 0) ? p.icio : 0;

  /* ---- lo que cuesta ---- */
  var aPagar = Math.max(0, coste + gastoCert - subv);       /* lo que sale del bolsillo el dia 1 */
  var neto = coste + gastoCert - subv - icio - irpf;         /* sin el IBI, que llega ano a ano */
  var netoConIbi = neto - ibiTotal;                          /* al acabar la bonificacion */

  /* se paga sola: el ahorro de luz cada ano, mas el IBI SOLO los anos que dura */
  var pagaSola;
  if(neto <= 0) pagaSola = 0;
  else {
    var porAno = ahorroAno + ibiAnual;
    if(porAno > 0 && porAno * ibiAnos >= neto) pagaSola = neto / porAno;
    else if(ahorroAno > 0) pagaSola = ibiAnos + (neto - porAno * ibiAnos) / ahorroAno;
    else pagaSola = null;                                    /* nunca */
  }

  /* ---- el prestamo ---- */
  var plazo = Number(e.plazoAnos);
  if(!(plazo >= 0)) plazo = p.plazo;
  var entradaDicha = Number(e.entrada);
  if(!isFinite(entradaDicha)) entradaDicha = 0;
  var entrada = entradaDicha;
  if(entrada < 0){
    avisos.push("La entrada no puede ser negativa: la contamos como 0 €.");
    entrada = 0;
  }
  if(plazo > 0 && entrada > aPagar){
    avisos.push("Has puesto " + eur(entradaDicha) + " de entrada y la instalación cuesta "
      + eur(aPagar) + ": la entrada pasa del total, así que no hace falta préstamo "
      + "(te sobran " + eur(entrada - aPagar) + ").");
    entrada = aPagar;
  }
  var alContado = !(plazo > 0);
  var presta = alContado ? 0 : Math.max(0, aPagar - entrada);
  var c1 = alContado ? 0 : cuota(presta, plazo);

  /* tras la devolucion: o baja la cuota, o se acaba antes */
  var mesDev = p.mesDevolucion;
  var c2 = 0, mesesMismaCuota = null, cuotasQueTeQuitas = 0;
  if(!alContado && presta > 0){
    var saldo = saldoTras(presta, c1, mesDev);
    var resto = Math.max(0, saldo - irpf);
    var mesesQuedan = plazo * 12 - mesDev;
    c2 = (resto > 0 && mesesQuedan > 0) ? cuota(resto, mesesQuedan / 12) : 0;
    mesesMismaCuota = irpf > 0 ? mesesPagando(presta, c1, irpf, mesDev) : plazo * 12;
    if(mesesMismaCuota !== null) cuotasQueTeQuitas = Math.max(0, plazo * 12 - mesesMismaCuota);
  }

  var luzNueva = hayFactura ? Math.max(0, factura - ahorroAno / 12) : null;

  return {
    /* lo que ha entrado */
    uso: uso, esTuristico: esTur, dias: dias, ccaa: ccaa, ccaaNom: CC ? CC.nombre : "—",
    esForal: esForal, hayFactura: hayFactura, factura: hayFactura ? factura : null,
    irpfSi: irpfSi, apto: apto,
    /* la luz */
    n: n, kwp: kwp, prod: prod, consumo: consumo, consumoFuente: consumoFuente,
    auto: auto, sobra: sobra, compra: compra, compensa: compensa, regala: regala,
    kwhRegala: kwhRegala, kwhCompensa: kwhCompensa, valorSobra: valorSobra,
    ahorroPropio: ahorroPropio, ahorroAno: ahorroAno, ahorroCede: ahorroCede,
    ahorroMes: ahorroAno / 12, luzNueva: luzNueva,
    /* el dinero */
    coste: coste, gastoCert: gastoCert, cert: gastoCert, conCert: conCert, certUtiles: certUtiles,
    subv: subv, subvNota: subvNota,
    irpf: irpf, irpfEstado: irpfEstado, irpfTipo: irpfTipo, irpfCcaa: irpfCcaa,
    ccaaDed: (CC && CC.deduccion) ? CC.deduccion : null, motivoSin40: motivoSin40,
    aptoDeduccion: puede40 || puedeCcaa,
    hayMuni: hayMuni, muni: m, muniNom: hayMuni ? m.nombre : (CC ? CC.nombre : "—"),
    ibiPct: hayMuni ? m.pct : 0, ibiRecibo: recibo, aplicaIbi: aplicaIbi,
    ibiAnual: ibiAnual, ibiAnos: ibiAnos, ibiTotal: ibiTotal, icio: icio,
    aPagar: aPagar, neto: neto, netoConIbi: netoConIbi, pagaSola: pagaSola,
    /* el prestamo */
    alContado: alContado, plazo: alContado ? 0 : plazo, entrada: entrada, entradaDicha: entradaDicha,
    presta: presta, c1: c1, c2: c2, mesDevolucion: mesDev,
    mesesMismaCuota: mesesMismaCuota, cuotasQueTeQuitas: cuotasQueTeQuitas,
    tipoNominal: p.tipoNominal,
    avisos: avisos
  };
}

/* El plan de «pagas lo mismo que ahora»: al prestamo va cada mes justo lo que
   ahorra la luz. Devuelve null si asi no se paga en 12 anos. */
function planIgual(r){
  var disponible = r.ahorroAno / 12;
  var p = parametros();
  var principal = r.aPagar;
  var meses = mesesPagando(principal, disponible, r.irpf, p.mesDevolucion);
  var sinDev = mesesPagando(principal, disponible, 0, 0);
  if(meses === null || meses > 144) return null;
  return { cuota: disponible, meses: meses, mesesSinDevolucion: sinDev,
           anos: meses / 12, principal: principal };
}

function textoPagaSola(r){
  if(r.pagaSola === null) return "nunca";
  return anos(r.pagaSola);
}
function textoTipo(){
  var p = parametros();
  return pct(p.tipoNominal) + " de interés nominal, supuesto";
}
function textoTipoLargo(){
  var p = parametros();
  return "El préstamo está calculado con un " + pct(p.tipoNominal) + " de interés nominal anual. "
    + "Es un supuesto de prudencia, no la oferta de ningún banco: ese tipo equivale a una TAE de "
    + pct(Math.round(taeDeNominal(p.tipoNominal) * 10000) / 10000) + " sin comisiones"
    + (p.mejorTae ? ", y la mejor TAE publicada que tenemos apuntada es del " + pct(p.mejorTae) : "")
    + ". La cuota de verdad la da el banco.";
}

global.IMMOIA_ENERGIA_CUENTA = {
  version: "1.0",
  parametros: parametros,
  cuenta: cuenta,
  planIgual: planIgual,
  cuota: cuota,
  saldoTras: saldoTras,
  mesesPagando: mesesPagando,
  taeDeNominal: taeDeNominal,
  panelesPara: panelesPara,
  municipio: municipio,
  etiquetaMunicipio: etiquetaMunicipio,
  comunidadesConDeduccion: comunidadesConDeduccion,
  textoPagaSola: textoPagaSola,
  textoTipo: textoTipo,
  textoTipoLargo: textoTipoLargo,
  fmt: { eur: eur, kwh: kwh, miles: miles, anos: anos, decimal: decimal, meses: mesesTexto, pct: pct }
};
})(typeof window !== "undefined" ? window : this);
