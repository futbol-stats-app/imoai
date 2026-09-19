/* ============================================================
   main.js - EL PEGAMENTO
   El unico archivo que conoce a todas las piezas. Las crea, las
   conecta por el bus y decide que pasa con cada evento.

     PIEZA 1 entrada_audio     oye, detecta silencios, transcribe
     PIEZA 2 cerebro_datos     busca en archivos, en segundo plano
     PIEZA 3 cerebro_hablador  lleva la conversacion, suelta frases
     PIEZA 4 salida_audio      dice las frases en cuanto llegan

   El recorrido de un turno:
     entrada:frase  -> hablador.turno(texto)
     hablador:frase -> salida.encolar(frase)          (la voz empieza ya)
     hablador pide datos -> datos.pedir(...)          (puente: pedirDatos)
     hablador:fin   -> salida.terminarTurno(turno)
     salida:empieza -> entrada.pausar()               (no oirse a si mismo)
     salida:fin     -> entrada.reanudar()             (vuelve a escuchar)
   ============================================================ */

import { crearBus } from "./bus.js";
import { crearEntradaAudio } from "./entrada_audio/entrada_audio.js";
import { crearCerebroDatos } from "./cerebro_datos/cerebro_datos.js";
import { crearCerebroHablador } from "./cerebro_hablador/cerebro_hablador.js";
import { crearConexionSimulada } from "./cerebro_hablador/conexion_simulada.js";
import { crearConexionWorker } from "./cerebro_hablador/conexion_worker.js";
import { crearConexionStream } from "./cerebro_hablador/conexion_stream.js";
import { crearSalidaAudio } from "./salida_audio/salida_audio.js";

/* EL INTERRUPTOR NO ESTA AQUI: esta en ../configuracion.js, que es lo
   unico que hay que tocar para cambiar de cerebro. Lo de abajo solo se
   usa si nadie dice nada, y se deja igual que alli para que no haya dos
   verdades distintas. */
export const CONFIG_POR_DEFECTO = Object.freeze({
  conexion: "worker",            /* worker (el servidor de verdad) | simulada (no gasta) | stream (el futuro) */
  urlCerebro: "https://immoia.ley1998ortizz.workers.dev",
  codigo: "",                    /* el codigo de acceso del worker, si se usa */
  conVoz: true,
  transcribir: true,
  reanudarTrasHablarMs: 350,     /* pausa tras hablar antes de volver a escuchar (eco) */
  esperarSaludoMs: 15000,
  /* IDA Y VUELTA 18/09 */
  sePuedeInterrumpir: true,      /* el oido NO se apaga mientras ella habla: se la puede cortar */
  latidoMs: 5000,                /* cada cuanto se comprueba que el oido sigue abierto */
  entrada: {},
  datos: {},
  hablador: {},
  conexionOpciones: {}
});

function crearConexion(c) {
  const op = Object.assign({ url: c.urlCerebro, codigo: c.codigo }, c.conexionOpciones);
  if (c.conexion === "worker") return crearConexionWorker(op);
  if (c.conexion === "stream") return crearConexionStream(op);
  return crearConexionSimulada(c.conexionOpciones);
}

export function crearAsistente(config = {}, { avisar = () => {}, registro = null, Reconocedor = null, motorVoz = null } = {}) {
  const c = Object.assign({}, CONFIG_POR_DEFECTO, config);
  const bus = crearBus({ registro });

  /* ---------- las piezas ---------- */
  const entrada = crearEntradaAudio({ bus, opciones: Object.assign({ transcribir: c.transcribir }, c.entrada), Reconocedor });
  const datos = crearCerebroDatos({ bus, opciones: c.datos });
  const salida = crearSalidaAudio({ bus, opciones: { conVoz: c.conVoz }, motor: motorVoz });
  const conexion = crearConexion(c);

  /* EL PUENTE ENTRE LOS DOS CEREBROS
     El ejecutivo pide y sigue hablando; el analitico busca en su hilo
     aparte y devuelve un resumen corto, nunca el archivo entero.
     "sinDato" va marcado para que el ejecutivo diga "no lo tengo" sin
     tener que mirar por dentro lo que ha traido el otro. */
  const pedirDatos = async (herramienta, entradaHerr) => {
    const resultado = await datos.pedir(herramienta, entradaHerr);
    return {
      resultado,
      ficha: datos.ficha(resultado),
      resumen: resultado && resultado.resumen ? resultado.resumen : null,
      sinDato: datos.sinDato(resultado)
    };
  };
  const hablador = crearCerebroHablador({
    bus, conexion, pedirDatos,
    herramientas: () => datos.herramientas(),
    catalogo: () => datos.catalogo(),
    opciones: c.hablador
  });

  /* ---------- estado general ---------- */
  let estado = "apagado";
  let encendido = false;
  let despidiendo = false;
  let relojReanudar = null;
  let latido = null;
  let interrupciones = 0;
  function ponerEstado(e) {
    if (e === estado) return;
    estado = e;
    bus.emitir("asistente:estado", { estado: e });
    avisar("estado", { estado: e });
  }

  /* ---------- las conexiones entre piezas ---------- */
  bus.en("entrada:frase", (d) => {
    avisar("persona", d);
    if (!encendido) return;
    hablador.turno(d.texto);
  });
  bus.en("entrada:texto_parcial", (d) => avisar("parcial", d));
  bus.en("entrada:empieza_a_hablar", (d) => { console.log("Usuario empez\u00f3 a hablar"); avisar("empieza", d); });
  bus.en("entrada:termino_de_hablar", (d) => { console.log("Usuario termin\u00f3 de hablar"); avisar("termina", d); });
  bus.en("entrada:nivel", (d) => avisar("nivel", d));
  bus.en("entrada:lista", (d) => { avisar("lista", d); if (encendido && estado !== "hablando") ponerEstado("escuchando"); });
  bus.en("entrada:error", (d) => { console.warn("[entrada]", d.mensaje); avisar("error", Object.assign({ pieza: "entrada" }, d)); });

  /* ---------- LO MAS IMPORTANTE: QUE SE LA PUEDA CORTAR ----------
     Ella empieza a hablar mientras habla la secretaria. Hasta hoy eso se
     perdia en silencio. Ahora: la voz se calla EN EL ACTO, se corta al
     cerebro, y lo que ella este diciendo sigue entrando por el oido, que no
     se ha apagado. La funcion interrumpir() existia desde el primer dia y
     no la llamaba nadie; ya la llama esto. */
  bus.en("entrada:interrumpe", (d) => {
    if (!encendido) return;
    interrupciones++;
    const habia = interrumpir();
    avisar("interrumpida", Object.assign({ n: interrupciones, habiaVoz: habia }, d));
  });
  bus.en("entrada:sordina", (d) => avisar("sordina", d));
  bus.en("entrada:tirado", (d) => { try { console.log("[eco tirado]", d.texto); } catch (e) {} avisar("eco_tirado", d); });
  bus.en("entrada:reintentando", (d) => avisar("reintentando", d));
  bus.en("entrada:recuperada", (d) => avisar("recuperada", d));
  bus.en("entrada:rendida", (d) => avisar("rendida", d));

  bus.en("hablador:pensando", (d) => { ponerEstado("pensando"); avisar("pensando", d); });
  bus.en("hablador:frase", (d) => {
    avisar("frase", d);
    salida.encolar(d);
  });
  bus.en("hablador:busca", (d) => avisar("busca", d));
  bus.en("hablador:sin_dato", (d) => avisar("sin_dato", d));
  bus.en("hablador:fin", (d) => {
    avisar("fin_turno", d);
    salida.terminarTurno(d.turno);
    /* turno sin nada que decir: vuelve a escuchar */
    if (encendido && salida.turno() !== d.turno && !salida.hablando() && !hablador.ocupado()) ponerEstado("escuchando");
  });
  bus.en("hablador:cortado", (d) => avisar("cortado", d));
  bus.en("hablador:despedida", () => { despidiendo = true; });
  bus.en("hablador:error", (d) => { console.warn("[hablador]", d.mensaje); avisar("error", Object.assign({ pieza: "hablador" }, d)); });

  bus.en("datos:listo", (d) => avisar("datos_listos", d));
  bus.en("datos:tarde", (d) => avisar("datos_tarde", d));
  bus.en("datos:error", (d) => { console.warn("[datos]", d.mensaje); avisar("error", Object.assign({ pieza: "datos" }, d)); });

  bus.en("salida:empieza", () => {
    clearTimeout(relojReanudar);
    /* ANTES: entrada.pausar() -> el oido se apagaba entero y lo que se
       dijera encima se perdia. AHORA: sordina, el oido sigue abierto. */
    if (c.sePuedeInterrumpir) entrada.ponerSordina();
    else entrada.pausar();
    ponerEstado("hablando");
  });
  const trasHablar = () => {
    clearTimeout(relojReanudar);
    if (!encendido) return;
    if (despidiendo) {
      despidiendo = false;
      parar();
      return;
    }
    /* si la ha cortado ELLA, no se espera nada: ya esta hablando */
    if (entrada.enSordina && !entrada.enSordina() && entrada.encendida() && !entrada.pausada()) {
      ponerEstado(hablador.ocupado() ? "pensando" : "escuchando");
      return;
    }
    relojReanudar = setTimeout(() => {
      if (!encendido || salida.hablando()) return;
      entrada.reanudar();
      ponerEstado(hablador.ocupado() ? "pensando" : "escuchando");
    }, c.reanudarTrasHablarMs);
  };
  bus.en("salida:fin", trasHablar);
  bus.en("salida:callada", trasHablar);
  bus.en("salida:error", (d) => avisar("error", Object.assign({ pieza: "salida" }, d)));

  /* ---------- lo que se puede hacer desde fuera ---------- */

  /* X3 18/09 - AQUI ESTABA EL FALLO DEL MICROFONO MUERTO.
     Antes esta funcion empezaba con "if (encendido) return true;". Al
     escribir una frase, escribir() deja "encendido" puesto, asi que desde
     ese momento arrancar() se iba por esa puerta y no llegaba a abrir el
     oido nunca mas. Lo que hay que mirar no es la conversacion, es el oido. */
  let arrancando = false;
  async function arrancar() {
    if (entrada.encendida()) return true;       /* el oido ya esta abierto */
    if (arrancando) return false;               /* no dos arranques a la vez */
    arrancando = true;
    try { return await abrirElOido(); } finally { arrancando = false; }
  }

  async function abrirElOido() {
    encendido = true; despidiendo = false;
    ponerEstado("hablando");
    datos.iniciar();                                  /* se prepara en segundo plano */
    const t = hablador.saludar();                     /* el aviso de IA, antes de abrir el oido */
    try { await bus.esperar("salida:fin", (d) => d.turno === t, c.esperarSaludoMs); } catch (e) {}
    if (!encendido) return false;
    const ok = await entrada.empezar();
    if (!ok) {
      /* sin microfono se puede seguir escribiendo */
      ponerEstado("escuchando");
      avisar("sin_microfono", {});
      return false;
    }
    if (!entrada.transcribe()) avisar("sin_transcripcion", {});
    ponerLatido(true);
    return true;
  }

  async function parar() {
    if (!encendido) return;
    encendido = false;
    ponerLatido(false);
    clearTimeout(relojReanudar);
    hablador.cortar();
    salida.callar("parada");
    await entrada.parar();
    ponerEstado("apagado");
  }

  /* LA CORTAN. La llama sola entrada:interrumpe (ella habla encima), y se
     puede llamar tambien desde la pantalla. */
  function interrumpir() {
    if (entrada.quitarSordina) entrada.quitarSordina();
    const habia = salida.callar("interrupcion");
    const pensaba = hablador.cortar();
    if (habia) bus.emitir("salida:interrumpida", { turno: salida.turno() });
    if (!habia && encendido) { entrada.reanudar(); ponerEstado("escuchando"); }
    return habia || pensaba;
  }

  /* ---------- EL LATIDO: si el oido se ha caido, se vuelve a abrir ----------
     Cada latidoMs se mira que el oido siga abierto cuando deberia estarlo.
     Si no lo esta, y no se esta intentando ya, se intenta. */
  function mirarElOido() {
    if (!encendido) return;
    if (!entrada.encendida() && !entrada.volviendo() && !entrada.rendida()) {
      entrada.volverAAbrir("el latido ha visto el oído cerrado");
    }
  }
  function ponerLatido(si) {
    clearInterval(latido); latido = null;
    if (si && c.latidoMs > 0) latido = setInterval(mirarElOido, c.latidoMs);
  }

  /* escribir en vez de hablar: mismo camino que una frase oida */
  function escribir(texto) {
    const t = String(texto || "").trim();
    if (!t) return;
    if (salida.hablando()) salida.callar("escrito");
    avisar("persona", { texto: t, fuente: "escrito" });
    if (!encendido) { encendido = true; datos.iniciar(); }
    hablador.turno(t);
  }

  return {
    bus,
    piezas: { entrada, datos, hablador, salida },
    config: c,
    arrancar,
    parar,
    interrumpir,
    escribir,
    estado: () => estado,
    encendido: () => encendido,
    ponerVoz: (si) => salida.ponerVoz(si),
    gasta: () => hablador.gasta(),
    /* para poder comprobarlo desde fuera (pruebas y pantalla) */
    interrupciones: () => interrupciones,
    mirarElOido
  };
}
