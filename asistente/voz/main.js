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
import { crearDespertador } from "./despertador.js";
import { crearRelleno } from "./relleno.js";

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
  /* EL MOVIL 19/09 */
  noApagarLaPantalla: true,      /* pedirle al navegador que no apague la pantalla */
  revisarAlVolverMs: 400,        /* lo que se espera al volver antes de revisar el oido */
  /* EL SILENCIO 19/09 (tanda 10) */
  conRelleno: true,              /* que no haya silencio sin explicar mientras se piensa */
  relleno: {},                   /* los tramos y las frases: ver relleno.js */
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
  /* EL MOVIL 19/09 */
  const despertador = crearDespertador({
    avisar: (tipo, d) => {
      if (tipo === "puesto") { bus.emitir("pantalla:despierta", { puesta: true }); avisar("pantalla", { puesta: true }); }
      else if (tipo === "no_se_puede") { bus.emitir("pantalla:despierta", { puesta: false, porque: d.porque }); avisar("pantalla", { puesta: false, porque: d.porque, codigo: d.codigo }); }
    }
  });
  let escondidaDesde = 0;
  let quitarCiclo = null;

  /* ============================================================
     EL SILENCIO · 19/09/2026 · TANDA 10

     La direccion lo midio en su telefono: entre que termina de hablar
     y la secretaria abre la boca pasan CINCO O SEIS SEGUNDOS, y en
     silencio absoluto. «A veces voy a hablar de nuevo o pienso que se
     apago.» Cinco segundos de silencio no se leen como «esta
     pensando»: se leen como «se ha roto».

     El relleno son frases de la casa, escritas en relleno.js, que
     dice el propio telefono. NO se llama al modelo para decir «mmm»:
     eso seria pagar por un ruido. Y no se pone delante de nada: el
     reloj arranca en hablador:pensando, que sale DESPUES de haber
     pedido el turno, asi que el relleno suena MIENTRAS viene la
     respuesta y no le anade ni un milisegundo.

     Con -1 en la "n" se marcan las frases que salen de aqui, para
     distinguirlas de los rellenos que suelta el propio cerebro
     hablador mientras busca en los archivos (esos tienen su n de
     verdad). Sirve para devolver el oido a su sitio despues de
     decirlas, sin tocar como se comportan los otros.
     ============================================================ */
  const relleno = crearRelleno({
    opciones: c.relleno,
    decir: (d) => {
      if (!encendido) return;
      bus.emitir("relleno:frase", { turno: d.turno, texto: d.texto, tramo: d.tramo, n: d.n, msDeSilencio: d.msDeSilencio });
      /* la pantalla la pinta como relleno (en cursiva) y la memoria la
         tira sola: primer_minuto/memoria.js ya mira tipo === "relleno" */
      avisar("frase", { turno: d.turno, n: -1, texto: d.texto, tipo: "relleno", tramo: d.tramo });
      salida.encolar({ turno: d.turno, n: -1, texto: d.texto, tipo: "relleno" });
    }
  });
  /* Se calla EN EL ACTO: cuando llega la respuesta de verdad y cuando
     la persona empieza a hablar. Si se solapan, es peor que el silencio. */
  function callarElRelleno(porque) {
    const r = relleno.parar(porque);
    const cortado = salida.callarRelleno(porque);
    if (cortado.habia) bus.emitir("relleno:callado", { turno: salida.turno(), porque, habiaVoz: cortado.sonaba });
    return r.parado || cortado.habia;
  }

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
  bus.en("entrada:empieza_a_hablar", (d) => {
    console.log("Usuario empez\u00f3 a hablar");
    /* TANDA 10: si estaba soltando un \u00abmmm\u00bb, se calla. Que se solapen es
       peor que el silencio. (Si estaba en sordina, de esto se encarga
       entrada:interrumpe, que salta antes.) */
    callarElRelleno("ha empezado a hablar la persona");
    avisar("empieza", d);
  });
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
    relleno.parar("la persona ha hablado encima");   /* TANDA 10: el reloj, ya; la voz la calla interrumpir() */
    const habia = interrumpir();
    avisar("interrumpida", Object.assign({ n: interrupciones, habiaVoz: habia }, d));
  });
  bus.en("entrada:sordina", (d) => avisar("sordina", d));
  bus.en("entrada:tirado", (d) => { try { console.log("[eco tirado]", d.texto); } catch (e) {} avisar("eco_tirado", d); });
  bus.en("entrada:reintentando", (d) => avisar("reintentando", d));
  bus.en("entrada:recuperada", (d) => avisar("recuperada", d));
  bus.en("entrada:rendida", (d) => avisar("rendida", d));
  /* EL MOVIL 19/09: el oido esta abierto pero no llega sonido */
  bus.en("entrada:dormida", (d) => { console.warn("[entrada dormida]", d.porque); avisar("dormida", d); });
  bus.en("entrada:despierta", (d) => avisar("despierta", d));

  /* TANDA 10. AQUI EMPIEZA EL SILENCIO QUE SE MIDE. hablador:pensando sale
     en cuanto el turno esta pedido y ANTES de leer ni un trozo de la
     respuesta, asi que el reloj del relleno corre mientras la respuesta
     viene de camino: no la retrasa, la acompana. */
  bus.en("hablador:pensando", (d) => {
    ponerEstado("pensando");
    avisar("pensando", d);
    if (c.conRelleno) relleno.empezar(d.turno);
  });
  bus.en("hablador:frase", (d) => {
    /* Ha sonado algo de verdad (o el propio hablador ha soltado su relleno
       de busqueda): el reloj se para y lo que estuviera diciendo se corta. */
    callarElRelleno(d.tipo === "relleno" ? "habla el hablador" : "ha llegado la respuesta");
    avisar("frase", d);
    salida.encolar(d);
  });
  bus.en("hablador:busca", (d) => avisar("busca", d));
  bus.en("hablador:sin_dato", (d) => avisar("sin_dato", d));
  bus.en("hablador:fin", (d) => {
    relleno.parar("se ha acabado el turno");   /* TANDA 10 */
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
  /* TANDA 10. Un relleno NO cierra el turno, asi que salida_audio no manda
     "salida:fin" detras: sin esto, la pantalla se quedaria diciendo «estoy
     hablando» durante los cinco segundos de despues, que es justo la
     mentira que se viene a quitar, y el oido se quedaria en sordina. Con
     esto vuelve a «un momento, que lo miro» y el oido a su sitio, igual que
     detras de cualquier otra frase. Solo las de esta casa (n = -1): los
     rellenos del cerebro hablador se quedan como estaban. */
  bus.en("salida:frase_dicha", (d) => {
    if (d.tipo === "relleno" && d.n === -1 && !salida.hablando()) trasHablar();
  });
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
    /* EL MOVIL 19/09: en cuanto hay oido abierto, que no se apague la
       pantalla, y que la pagina se entere si se esconde o se congela. */
    if (!quitarCiclo) quitarCiclo = engancharElCicloDeVida();
    if (c.noApagarLaPantalla) { try { await despertador.encender(); } catch (e) {} }
    return true;
  }

  async function parar() {
    if (!encendido) return;
    encendido = false;
    relleno.parar("se ha parado el asistente");   /* TANDA 10 */
    ponerLatido(false);
    try { await despertador.apagar(); } catch (e) {}   /* que se pueda apagar la pantalla otra vez */
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
    if (!entrada.encendida()) {
      if (!entrada.volviendo() && !entrada.rendida()) entrada.volverAAbrir("el latido ha visto el oído cerrado");
      return;
    }
    /* EL MOVIL · 19/09/2026. ANTES ESTO SE ACABABA AQUI, y por eso «se
       quedaba callado»: encendida() es una BANDERA que sigue diciendo que si
       aunque el movil haya dejado de mandar sonido. Ahora, con el oido
       abierto, se MIDE si de verdad esta llegando algo. */
    if (entrada.volviendo() || entrada.pausada() || salida.hablando()) return;
    entrada.revisar("latido");
  }
  function ponerLatido(si) {
    clearInterval(latido); latido = null;
    if (si && c.latidoMs > 0) latido = setInterval(mirarElOido, c.latidoMs);
  }

  /* ============================================================
     EL MOVIL · 19/09/2026 · QUE SE ENTERE DE QUE HA VUELTO

     La direccion lo probo en un movil de verdad: «se corta mucho, se queda
     callado, se apaga el telefono y se corta». Hasta hoy esta pagina NO
     escuchaba ni uno de los avisos que da el navegador cuando se esconde,
     se congela o vuelve: ni visibilitychange, ni pageshow, ni freeze, ni
     resume. Comprobado buscandolos en toda la carpeta: no habia ninguno.
     Asi que al volver de apagar la pantalla se quedaba muerta y habia que
     recargar.

     Lo que se escucha, y por que cada uno:
       visibilitychange  lo tienen TODOS los navegadores. Es el que vale en
                         el iPhone, porque Safari NO manda freeze ni resume
                         (developer.chrome.com, Page Lifecycle API: «Firefox
                         and Safari do not fire them», consultado 19/09/2026).
       freeze / resume   solo Chrome y Edge. En Android es el aviso bueno:
                         dice que el sistema ha congelado la pestana de
                         verdad, no solo que se ha escondido.
       pageshow          cuando la pagina vuelve de la memoria del navegador
                         (event.persisted). Ahi no se recarga nada, asi que
                         si no se mira, se vuelve con todo parado.
     ============================================================ */
  function engancharElCicloDeVida() {
    if (typeof document === "undefined" || typeof document.addEventListener !== "function") return null;
    const doc = document;
    const quitar = [];
    const oir = (obj, ev, fn) => {
      if (!obj || !obj.addEventListener) return;
      obj.addEventListener(ev, fn);
      quitar.push(() => { try { obj.removeEventListener(ev, fn); } catch (e) {} });
    };

    const seEsconde = () => {
      if (!escondidaDesde) escondidaDesde = Date.now();
      bus.emitir("pagina:escondida", {});
      avisar("escondida", {});
    };

    const vuelve = async (comoVuelve) => {
      const msFuera = escondidaDesde ? Date.now() - escondidaDesde : 0;
      escondidaDesde = 0;
      bus.emitir("pagina:vuelve", { msFuera, comoVuelve });
      avisar("vuelve", { msFuera, comoVuelve });
      if (!encendido) return;
      /* 1. la pantalla: el navegador SUELTA el permiso al esconderse la
            pagina, asi que hay que volver a pedirlo siempre. */
      if (c.noApagarLaPantalla) { try { await despertador.alVolver(); } catch (e) {} }
      /* 2. el oido: se le da un respiro al sistema y se revisa de verdad */
      await new Promise((r) => setTimeout(r, c.revisarAlVolverMs));
      if (!encendido) return;
      try { await entrada.revisar("ha vuelto la página (" + comoVuelve + ")", { vuelveDeFuera: true }); } catch (e) {}
    };

    oir(doc, "visibilitychange", () => {
      if (doc.visibilityState === "hidden") seEsconde();
      else vuelve("visibilitychange");
    });
    oir(doc, "freeze", seEsconde);
    oir(doc, "resume", () => vuelve("resume"));
    if (typeof window !== "undefined") {
      oir(window, "pageshow", (ev) => { if (ev && ev.persisted) vuelve("pageshow"); });
    }
    return () => quitar.forEach((f) => f());
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
    mirarElOido,
    /* EL MOVIL 19/09 */
    despertador,
    /* EL SILENCIO 19/09 (tanda 10) */
    relleno,
    callarElRelleno,
    salud: () => entrada.salud(),
    revisar: (porque) => entrada.revisar(porque || "a mano")
  };
}
