/* ============================================================
   PIEZA 3 - cerebro_hablador.js  (EL CEREBRO EJECUTIVO)
   Lleva la conversacion: recibe lo que dice la persona, habla con
   el cerebro (tu worker de IMMO IA, o el simulado) y va soltando
   frases para la voz segun llegan.

   NO busca archivos. Cuando el cerebro pide una herramienta, se la
   pide a "pedirDatos" (que main.js conecta con el cerebro de datos)
   y mientras tanto NO DEJA SILENCIOS:
     - si el cerebro dijo algo antes de pedirla ("Voy a mirarlo"), eso suena
     - si no ha sonado nada, en cuanto arranca la busqueda suena una
       frase de la casa, escrita aqui abajo: "Mira, lo estoy viendo."
       Sale al momento, asi que aunque el analitico conteste en dos
       milesimas el ejecutivo ya ha dicho algo.
     - si pasa de "segundoRellenoMs": "Sigo busc\u00e1ndolo, un momento."
   Los rellenos nunca adelantan informacion.

   Y SI NO HAY DATO (el analitico no encuentra nada, o no puede
   buscar), el ejecutivo lo dice con la frase de la casa: "No lo
   tengo." El turno se acaba ahi mismo, para que no haya ninguna
   ocasion de rellenar con lo que parece probable.

   Otras reglas:
     - Un turno cada vez: si llega otro, el anterior se corta.
     - "adi\u00f3s", "para"... terminan la conversacion sin gastar.
     - Tope de rondas de herramientas por turno (la ultima ronda va
       sin herramientas: el cerebro tiene que contestar ya).
     - Tope de turnos por conversacion y de tiempo por turno.
     - Al empezar dice que es una inteligencia artificial.

   Eventos: hablador:pensando, hablador:frase, hablador:busca,
            hablador:fin, hablador:cortado, hablador:despedida, hablador:error
   ============================================================ */

import { crearTroceador } from "./troceador.js";
import { crearContexto } from "./contexto.js";

export const OPCIONES_HABLADOR = Object.freeze({
  maxRondas: 2,
  rellenoMs: 1500,
  segundoRellenoMs: 6000,
  maxTurnoMs: 45000,
  topeTurnos: 40,
  avisoIA: "Hola, soy un asistente de inteligencia artificial, no una persona. Cu\u00e9ntame, te escucho.",
  avisoIAcorto: "Te escucho.",
  /* frases de la casa, escritas aqui: no las genera nadie */
  avisosBusqueda: ["Mira, lo estoy viendo.", "Un segundo, que lo saco.", "Espera, que lo miro en la oficina."],
  rellenos: ["Dame un segundo, que lo miro.", "Un momento, que lo busco.", "D\u00e9jame mirarlo."],
  segundoRelleno: "Sigo busc\u00e1ndolo, un momento.",
  noLoTengo: "No lo tengo. No me aparece en los papeles de la oficina, as\u00ed que no te lo confirmo.",
  cortarSiNoHay: true,          /* si no hay dato, se dice y se acaba el turno */
  despedida: "Vale, lo dejamos aqu\u00ed. Cuando quieras seguir, aqu\u00ed estoy.",
  /* 18/09: la direccion distingue PARAR de DESCANSAR. "voy a comer" no es
     un adios: es un hasta ahora. Se deja de escuchar, pero la conversacion
     sigue viva y se retoma con "ya estoy" o "sigue". */
  pausa: "Vale, descanso. Cuando vuelvas, dime \u00abya estoy\u00bb y seguimos donde lo dejamos.",
  vuelta: "Aqu\u00ed estoy. Seguimos.",
  mensajeTope: "Hemos llegado al l\u00edmite de esta conversaci\u00f3n. Para seguir, empieza una nueva.",
  mensajeError: "Perdona, no he podido contestar ahora. Int\u00e9ntalo otra vez.",
  mensajeTiempo: "Esto est\u00e1 tardando demasiado. Prueba a preguntarme otra vez."
});

/* Los estados en los que el analitico no trae dato. Con cualquiera
   de estos, el ejecutivo dice "no lo tengo" y no rellena nada.
   Escritos aqui a mano para no atar esta pieza a la otra. */
const ESTADOS_SIN_DATO = new Set(["sin_resultados", "sin fuente disponible", "error"]);

/* la ficha que se pone delante cuando no ha venido ningun dato */
export function fichaVacia(herramienta, porque = "no ha venido ningun dato") {
  return "[DATO DE HERRAMIENTA · lo ha buscado la oficina, esto SI lo tienes delante]\n" +
    "herramienta: " + herramienta + "\n" +
    "estado: sin fuente disponible\n" +
    "nota: " + porque + "\n" +
    "aviso: no hay dato. Di que no lo tienes. No completes nada con lo que parezca probable.\n" +
    "datos:\nnull";
}

export function noHayDato(datos) {
  if (!datos) return true;
  if (datos.sinDato === true) return true;
  const r = datos.resultado;
  if (!r) return !datos.ficha;          /* sin ficha y sin resultado: no hay nada */
  return ESTADOS_SIN_DATO.has(String(r.estado));
}

/* ---------- palabras para terminar ---------- */
/* DESCANSAR no es terminar: la conversacion se queda esperando. */
const PAUSAR = new Set(["voy a comer", "me voy a comer", "voy a comer algo", "vuelvo en un rato",
  "ahora vuelvo", "me voy un momento", "un momento", "dame un momento", "voy a por un cafe",
  "voy por un cafe", "me voy a tomar un cafe", "descansa", "descansamos", "pausa",
  "hacemos una pausa", "salgo un momento"]);
const VOLVER = new Set(["ya estoy", "ya he vuelto", "he vuelto", "sigue", "seguimos", "continua",
  "continuamos", "vamos", "listo", "aqui estoy"]);

const PARAR = new Set(["para", "parar", "parate", "basta", "stop", "adios", "hasta luego", "hasta otra",
  "terminar", "termina", "terminamos", "fin", "callate", "ya esta", "eso es todo", "nada mas",
  "no gracias", "corta", "cortar", "salir"]);

function normalizaFrase(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\u00f1 ]+/g, " ").replace(/\s+/g, " ").trim();
}
export function esPausa(t)  { const n = normalizaFrase(t); return !!n && PAUSAR.has(n); }
export function esVuelta(t) { const n = normalizaFrase(t); return !!n && VOLVER.has(n); }

export function esDespedida(t) {
  let n = String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\u00f1 ]+/g, " ").replace(/\s+/g, " ").trim();
  let antes;
  do {
    antes = n;
    n = n.replace(/^(vale|ok|okay|bueno|pues|muchas gracias|gracias|venga|nada)\b ?/, "")
         .replace(/ ?\b(gracias|muchas gracias|vale|ok|entonces)$/, "").trim();
  } while (n !== antes && n);
  return !!n && PARAR.has(n);
}

export function crearCerebroHablador({ bus, conexion, pedirDatos, herramientas = () => [], catalogo = () => [], opciones = {} }) {
  /* 18/09: si la persona se ha ido a comer, la conversacion queda esperando. */
  let enPausa = false;
  const o = Object.assign({}, OPCIONES_HABLADOR, opciones);
  const contexto = crearContexto();

  let turnoN = 0;
  let activo = null;            /* {turno, control, promesa} */
  let turnosHechos = 0;
  let saludado = false;
  let rellenoIdx = 0;

  function emitirFrase(t, estado, texto, tipo) {
    if (t !== turnoN) return;
    const n = estado.n++;
    if (tipo !== "relleno") estado.dicho.push(texto);
    estado.sonoAlgo = true;
    bus.emitir("hablador:frase", { turno: t, n, texto, tipo });
  }

  function esperarOcortar(promesa, senal) {
    return new Promise((ok, mal) => {
      if (senal.aborted) { mal(new DOMException("cortado", "AbortError")); return; }
      const alCortar = () => mal(new DOMException("cortado", "AbortError"));
      senal.addEventListener("abort", alCortar, { once: true });
      promesa.then((v) => { senal.removeEventListener("abort", alCortar); ok(v); },
                   (e) => { senal.removeEventListener("abort", alCortar); mal(e); });
    });
  }

  /* ---------- un turno completo ---------- */
  async function ejecutarTurno(t, texto, control) {
    const t0 = performance.now();
    const estado = { n: 0, dicho: [], sonoAlgo: false };
    const senal = control.signal;
    let rondas = 0;
    let motivo = "ok";

    contexto.persona(texto, t);
    bus.emitir("hablador:pensando", { turno: t, texto });

    const relojTurno = setTimeout(() => { if (!senal.aborted) { control.motivo = "tiempo"; control.abort(); } }, o.maxTurnoMs);

    try {
      for (let ronda = 0; ronda <= o.maxRondas; ronda++) {
        rondas = ronda + 1;
        const conHerramientas = ronda < o.maxRondas ? herramientas() : [];
        let pedida = null;
        let textoRonda = "";
        let frasesRonda = 0;
        const troceador = crearTroceador({
          alFrase: (f) => { frasesRonda++; emitirFrase(t, estado, f, pedida ? "preambulo" : "respuesta"); }
        });

        for await (const ev of conexion.hablar({
          mensajes: contexto.paraEnviar(),
          herramientas: conHerramientas,
          catalogo: conHerramientas.length ? catalogo() : [],
          ronda,
          senal
        })) {
          if (senal.aborted) throw new DOMException("cortado", "AbortError");
          if (ev.tipo === "texto" && !pedida) { textoRonda += ev.delta; troceador.anadir(ev.delta); }
          else if (ev.tipo === "herramienta" && !pedida && ev.nombre) {
            pedida = ev;
            troceador.cerrar();
          }
          else if (ev.tipo === "fin") break;
        }
        troceador.cerrar();

        if (!pedida) {
          if (textoRonda.trim()) contexto.asistente(textoRonda, t);
          break;
        }

        /* ---- el cerebro pide datos ---- */
        if (textoRonda.trim()) contexto.asistente(textoRonda, t);
        else if (pedida.porque && pedida.porque.trim()) {
          emitirFrase(t, estado, pedida.porque.trim(), "preambulo");
          contexto.asistente(pedida.porque.trim(), t);
        }
        bus.emitir("hablador:busca", { turno: t, herramienta: pedida.nombre, porque: pedida.porque || "", ronda: ronda + 1 });

        if (!conHerramientas.includes(pedida.nombre)) {
          /* ha pedido una que no tiene: se le dice como dato, sin inventar */
          contexto.ficha(fichaVacia(pedida.nombre, "esa herramienta no esta disponible ahora"), t);
          continue;
        }

        /* Nada de silencio: si todavia no ha sonado nada en este turno,
           suena YA una frase de la casa, antes de empezar a buscar. */
        if (!estado.sonoAlgo) {
          emitirFrase(t, estado, o.avisosBusqueda[rellenoIdx++ % o.avisosBusqueda.length], "relleno");
        }

        const relojes = [];
        relojes.push(setTimeout(() => {
          if (!senal.aborted) emitirFrase(t, estado, o.rellenos[rellenoIdx++ % o.rellenos.length], "relleno");
        }, o.rellenoMs));
        relojes.push(setTimeout(() => {
          if (!senal.aborted) emitirFrase(t, estado, o.segundoRelleno, "relleno");
        }, o.segundoRellenoMs));

        let datos;
        try {
          datos = await esperarOcortar(Promise.resolve(pedirDatos(pedida.nombre, pedida.entrada || {})), senal);
        } finally {
          relojes.forEach(clearTimeout);
        }

        /* ---- no hay dato: se dice, y no se rellena ---- */
        if (noHayDato(datos)) {
          bus.emitir("hablador:sin_dato", {
            turno: t, herramienta: pedida.nombre,
            estado: (datos && datos.resultado && datos.resultado.estado) || "sin fuente disponible"
          });
          emitirFrase(t, estado, o.noLoTengo, "aviso");
          contexto.asistente(o.noLoTengo, t);
          motivo = "sin_dato";
          if (o.cortarSiNoHay) break;
          contexto.ficha(datos && datos.ficha ? datos.ficha : fichaVacia(pedida.nombre), t);
          continue;
        }

        contexto.ficha(datos && datos.ficha ? datos.ficha : fichaVacia(pedida.nombre), t);
      }
    } catch (e) {
      const cortado = e && e.name === "AbortError";
      if (cortado && control.motivo !== "tiempo") {
        motivo = "cortado";
        if (estado.dicho.length) contexto.asistente(estado.dicho.join(" ") + " (me interrumpieron)", t);
        bus.emitir("hablador:cortado", { turno: t });
      } else {
        motivo = cortado ? "tiempo" : "error";
        const mensaje = cortado ? o.mensajeTiempo : (e && e.message) || String(e);
        bus.emitir("hablador:error", { turno: t, mensaje });
        /* el aviso sale aunque el turno ya este abortado: por eso no pasa por emitirFrase */
        if (t === turnoN) bus.emitir("hablador:frase", { turno: t, n: estado.n++, texto: cortado ? o.mensajeTiempo : o.mensajeError, tipo: "aviso" });
      }
    } finally {
      clearTimeout(relojTurno);
    }

    turnosHechos++;
    bus.emitir("hablador:fin", { turno: t, motivo, rondas, ms: Math.round(performance.now() - t0) });
    return { turno: t, motivo, dicho: estado.dicho.join(" ") };
  }

  /* ---------- la cara de la pieza ---------- */
  function cortar() {
    if (!activo) return false;
    const a = activo;
    activo = null;
    try { a.control.abort(); } catch (e) {}
    return true;
  }

  async function turno(texto) {
    const limpio = String(texto || "").trim();
    if (!limpio) return null;
    cortar();
    const t = ++turnoN;

    if (esPausa(limpio)) {
      enPausa = true;
      bus.emitir("hablador:frase", { turno: t, n: 0, texto: o.pausa, tipo: "aviso" });
      bus.emitir("hablador:pausa", { turno: t });
      bus.emitir("hablador:fin", { turno: t, motivo: "pausa", rondas: 0, ms: 0 });
      return { turno: t, motivo: "pausa" };
    }
    if (enPausa && esVuelta(limpio)) {
      enPausa = false;
      bus.emitir("hablador:frase", { turno: t, n: 0, texto: o.vuelta, tipo: "aviso" });
      bus.emitir("hablador:vuelta", { turno: t });
      bus.emitir("hablador:fin", { turno: t, motivo: "vuelta", rondas: 0, ms: 0 });
      return { turno: t, motivo: "vuelta" };
    }
    if (esDespedida(limpio)) {
      bus.emitir("hablador:frase", { turno: t, n: 0, texto: o.despedida, tipo: "aviso" });
      bus.emitir("hablador:despedida", { turno: t });
      bus.emitir("hablador:fin", { turno: t, motivo: "despedida", rondas: 0, ms: 0 });
      return { turno: t, motivo: "despedida" };
    }
    if (turnosHechos >= o.topeTurnos) {
      bus.emitir("hablador:frase", { turno: t, n: 0, texto: o.mensajeTope, tipo: "aviso" });
      bus.emitir("hablador:fin", { turno: t, motivo: "tope", rondas: 0, ms: 0 });
      return { turno: t, motivo: "tope" };
    }

    const control = new AbortController();
    const promesa = ejecutarTurno(t, limpio, control);
    activo = { turno: t, control, promesa };
    try { return await promesa; }
    finally { if (activo && activo.turno === t) activo = null; }
  }

  /* el aviso de IA, dicho al empezar (primera vez largo, luego corto) */
  function saludar() {
    const t = ++turnoN;
    const texto = saludado ? o.avisoIAcorto : o.avisoIA;
    saludado = true;
    bus.emitir("hablador:frase", { turno: t, n: 0, texto, tipo: "aviso" });
    bus.emitir("hablador:fin", { turno: t, motivo: "saludo", rondas: 0, ms: 0 });
    return t;
  }

  return {
    turno,
    cortar,
    saludar,
    ocupado: () => !!activo,
    turnoActual: () => turnoN,
    reiniciar() { cortar(); contexto.vaciar(); turnosHechos = 0; },
    historial: () => contexto.todos(),
    conexion: () => conexion.nombre,
    gasta: () => !!conexion.gasta,
    ajustar: (x) => Object.assign(o, x)
  };
}
