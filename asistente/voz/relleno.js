/* ============================================================
   relleno.js  ·  QUE NUNCA HAYA SILENCIO SIN EXPLICAR
   IMMO IA · TANDA 10 · 19/09/2026

   POR QUE EXISTE ESTO.
   La direccion lo probo en su telefono: entre que termina de hablar
   y la secretaria abre la boca pasan CINCO O SEIS SEGUNDOS, y en
   silencio absoluto. Sus palabras: «a veces voy a hablar de nuevo o
   pienso que se apago. Me ha pasado como tres veces que pense que se
   apagaba». Y eso lo dice alguien que SABE que funciona. Una clienta
   que lo ve por primera vez colgaria.

   Cinco segundos de silencio no se leen como «esta pensando»: se
   leen como «se ha roto».

   LA REGLA, que la puso la direccion:

     menos de medio segundo  nada
     a partir de medio seg.  un sonido corto: «mmm», «a ver», «vale».
                             ESTO es lo que dice «te he oido».
     a partir de tres seg.   con palabras: «dejame que lo mire»,
                             «dame un momento»...
     a partir de ocho seg.   que diga que esta tardando mas de lo
                             normal, y QUE SIGA VIVA (cada seguirCadaMs).

   LAS CUATRO CONDICIONES, y donde se cumple cada una:

     1. NO CUESTA NADA. Las frases estan escritas aqui abajo, a mano.
        Esta pieza NO llama a ningun modelo, no abre ninguna conexion
        y no importa ninguna otra pieza. Las dice el propio telefono
        con su voz de serie (salida_audio).
     2. NO ANADE NI UN MILISEGUNDO a la respuesta de verdad. Esta
        pieza no se pone DELANTE de nada: main.js arranca el reloj
        DESPUES de haber mandado el turno al cerebro (en
        hablador:pensando, que sale antes de leer ni un trozo de la
        respuesta). El relleno suena MIENTRAS viene la respuesta.
     3. CAMBIA CADA VEZ. Cada tramo tiene su bolsa de frases, que se
        baraja y se va vaciando; cuando se acaba se vuelve a barajar
        cuidando que la primera de la baraja nueva NO sea la ultima
        que se dijo. Asi no se repite ninguna dos veces seguidas y,
        de paso, tampoco se oyen siempre en el mismo orden.
     4. SE CALLA EN EL ACTO. Esta pieza avisa por su callback y
        main.js llama a salida.callarRelleno(), que tira las de la
        cola y corta en seco la que este sonando, SIN tocar la
        respuesta de verdad. Se para cuando llega la respuesta y
        cuando la persona empieza a hablar.

   Y UNA QUE VIENE DE ANTES: estas frases NO SE GUARDAN EN LA
   CONVERSACION. Salen marcadas con tipo "relleno", que es lo que ya
   mira primer_minuto/memoria.js (trozoDeLaSecretaria: si el tipo es
   "relleno", se va sin apuntar nada). No hay otro camino ni hace
   falta. Tampoco entran en el contexto del cerebro hablador, porque
   no pasan por el: nacen y mueren aqui.

   LO QUE NO PUEDE DECIR NINGUNA DE ESTAS FRASES.
   Ninguna puede sonar a respuesta. «Dejame que lo mire» es honesto:
   dice lo que esta pasando. «Claro, por supuesto...» mientras
   todavia no sabe nada, no: eso seria fingir que ya sabe algo. Por
   eso aqui abajo no hay ni una sola frase que afirme, prometa o
   adelante nada.
   ============================================================ */

export const OPCIONES_RELLENO = Object.freeze({
  activo: true,
  /* POR QUE 420 Y NO 500, que es lo que dice la tabla.
     Lo que se pide es que NO HAYA MEDIO SEGUNDO DE SILENCIO. Entre que
     salta el reloj y el aparato de voz empieza a sonar de verdad pasan
     unas decenas de milisegundos, asi que un reloj puesto justo en el
     medio segundo da un silencio medido de 500 y pico: se incumple por
     un pelo lo unico que se pedia. Puesto en 420, el sonido ENTRA
     dentro del medio segundo. Se dispara un poco antes de la raya,
     nunca despues. Medido, no supuesto: ver prueba_el_silencio.mjs. */
  cortoMs: 420,          /* a partir de (casi) medio segundo: un sonido corto */
  medioMs: 3000,         /* a partir de tres segundos: con palabras */
  largoMs: 8000,         /* a partir de ocho: que esta tardando mas de lo normal */
  seguirCadaMs: 6000,    /* y despues, cada tanto, que sigue viva */
  maxSeguidos: 10,       /* tope de «sigo aqui» (mas que maxTurnoMs, 45 s) */
  /* EL TAPON. Las rayas de arriba son las de la direccion y se respetan
     tal cual: a los 3 segundos se habla con palabras, a los 8 se dice
     que tarda. Pero entre la raya de los 3 y la de los 8 caben CINCO
     SEGUNDOS callada, que es exactamente el numero que se viene a
     quitar. Asi que, una vez ha dicho algo, no se le deja pasar mas de
     esto sin volver a abrir la boca: repite el tramo en el que este,
     con otra frase. Nunca adelanta una raya, solo rellena el hueco. */
  descansoMaxMs: 4000,

  /* ---- LAS FRASES. Escritas a mano, en espanol de Espana, como
     hablaria una secretaria. Ninguna afirma nada. ---- */

  /* medio segundo: no es una frase, es el ruido que hace una persona
     cuando te ha oido y esta empezando a pensar */
  cortos: [
    "Mmm…",
    "A ver…",
    "Vale…",
    "Mmm, a ver…",
    "Ajá…",
    "Vale, a ver…"
  ],
  /* tres segundos: ya con palabras, diciendo lo que esta haciendo */
  medios: [
    "Déjame que lo mire.",
    "Dame un momento.",
    "Espera un segundo, que lo miro.",
    "Dame un segundo y te digo.",
    "Un momento, que lo estoy mirando.",
    "Espera, que lo estoy viendo."
  ],
  /* ocho segundos: que esto no es lo normal, y que sigue ahi */
  largos: [
    "Perdona, esto está tardando más de lo normal. Sigo aquí.",
    "Está tardando más de lo que suele. No me he ido, sigo en ello.",
    "Esto va más lento de lo normal, pero sigo mirándolo.",
    "Me está costando más de lo normal. Aguanta, que sigo aquí."
  ],
  /* y a partir de ahi, cada tanto: que siga viva */
  siguen: [
    "Sigo aquí, ¿eh?",
    "Un poquito más, que sigo en ello.",
    "Aguanta, que no me he ido.",
    "Sigo con ello, no te he dejado colgada."
  ]
});

/* ============================================================
   LA BOLSA: que no repita la misma dos veces seguidas.

   Si dice siempre lo mismo suena a maquina y cansa al tercer turno.
   Una eleccion al azar a secas repite: con seis frases, una de cada
   seis veces sale la misma dos veces seguidas. Asi que se baraja la
   lista entera y se va sacando de una en una; cuando se acaba, se
   vuelve a barajar, y si la primera de la baraja nueva es la que
   acaba de sonar, se cambia por la segunda. Garantia: NUNCA dos
   veces seguidas la misma, y encima se oyen todas antes de repetir
   ninguna.
   ============================================================ */
export function crearBolsa(lista, azar = Math.random) {
  const todas = (lista || []).slice();
  let monton = [];
  let ultima = null;

  function barajar() {
    monton = todas.slice();
    for (let i = monton.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      const x = monton[i]; monton[i] = monton[j]; monton[j] = x;
    }
    /* que la primera de la baraja nueva no sea la ultima que sono */
    if (monton.length > 1 && monton[0] === ultima) {
      const x = monton[0]; monton[0] = monton[1]; monton[1] = x;
    }
  }

  return {
    sacar() {
      if (!todas.length) return "";
      if (!monton.length) barajar();
      const f = monton.shift();
      ultima = f;
      return f;
    },
    ultima: () => ultima,
    cuantas: () => todas.length
  };
}

/* ============================================================
   EL RELLENO

     empezar(turno)   la persona ha terminado de hablar y el turno ya
                      esta pedido: empieza el silencio, arranca el reloj
     parar(porque)    ha llegado la respuesta, o ha empezado a hablar
                      ella, o se ha acabado el turno
     corriendo()      si hay reloj puesto
     dichas()         cuantas frases ha soltado en este turno (pruebas)

   El reloj se encadena solo. Las rayas se cuentan SIEMPRE desde que
   empezo el silencio -no desde la ultima frase-, para que los tramos
   sean los de la tabla y no se vayan corriendo turno a turno. Lo
   unico que puede adelantar una frase es el tapon (descansoMaxMs), y
   aun asi nunca antes de la primera raya.
   ============================================================ */
export function crearRelleno({
  decir = () => {},
  opciones = {},
  reloj = { poner: (f, ms) => setTimeout(f, ms), quitar: (id) => clearTimeout(id) },
  ahora = () => Date.now(),
  azar = Math.random
} = {}) {
  const o = Object.assign({}, OPCIONES_RELLENO, opciones);
  const bolsas = {
    corto: crearBolsa(o.cortos, azar),
    medio: crearBolsa(o.medios, azar),
    largo: crearBolsa(o.largos, azar),
    sigue: crearBolsa(o.siguen, azar)
  };

  let turno = 0;
  let desde = 0;          /* cuando empezo el silencio de este turno */
  let ultimoMs = null;    /* cuando dijo lo ultimo, contando desde "desde" */
  let id = null;
  let dichas = 0;
  let seguidos = 0;       /* cuantos «sigo aqui» van */
  let dichoLargo = false; /* ya ha dicho que esta tardando mas de lo normal */
  let ultimoTramo = null;

  /* LA PROXIMA RAYA a partir de los N milisegundos de silencio */
  function siguienteRaya(ms) {
    if (ms < o.cortoMs) return o.cortoMs;
    if (ms < o.medioMs) return o.medioMs;
    if (ms < o.largoMs) return o.largoMs;
    const n = Math.floor((ms - o.largoMs) / o.seguirCadaMs) + 1;
    return o.largoMs + n * o.seguirCadaMs;
  }
  /* QUE TRAMO toca si se habla a los N milisegundos de silencio */
  function tramoDe(ms) {
    if (ms < o.medioMs) return "corto";
    if (ms < o.largoMs) return "medio";
    return dichoLargo ? "sigue" : "largo";
  }

  function poner() {
    if (id !== null) { reloj.quitar(id); id = null; }
    if (!o.activo || !turno) return;
    const va = ahora() - desde;
    /* la raya que toca... */
    let cuando = siguienteRaya(va);
    /* ...o antes, si desde lo ultimo que dijo ya va a pasar demasiado
       rato callada. Nunca antes de la primera raya. */
    if (ultimoMs !== null) cuando = Math.max(o.cortoMs, Math.min(cuando, ultimoMs + o.descansoMaxMs));
    const tramo = tramoDe(cuando);
    if (tramo === "sigue" && seguidos >= o.maxSeguidos) return;
    id = reloj.poner(() => { id = null; soltar(tramo); }, Math.max(0, cuando - va));
  }

  function soltar(tramo) {
    if (!turno) return;
    const texto = bolsas[tramo].sacar();
    /* bolsa vacia = ese tramo esta apagado a proposito. Se para aqui: si
       se volviera a poner el reloj se entraria en un bucle apretado. */
    if (!texto) return;
    dichas++;
    ultimoTramo = tramo;
    ultimoMs = ahora() - desde;
    if (tramo === "largo") dichoLargo = true;
    if (tramo === "sigue") seguidos++;
    try {
      decir({ turno, texto, tramo, n: dichas, msDeSilencio: ultimoMs });
    } catch (e) {
      try { console.warn("[relleno]", e && e.message); } catch (e2) {}
    }
    poner();   /* se encadena solo al siguiente tramo */
  }

  return {
    /* El turno ya esta pedido al cerebro. A partir de AQUI se cuenta
       el silencio. No se llama antes de pedir: se llama despues. */
    empezar(t) {
      turno = t || 0;
      desde = ahora();
      ultimoMs = null;
      dichas = 0;
      seguidos = 0;
      dichoLargo = false;
      ultimoTramo = null;
      poner();
    },
    /* Ha llegado la respuesta de verdad, o ha empezado a hablar ella,
       o se ha acabado el turno. Devuelve si habia algo en marcha. */
    parar(porque = "") {
      const habia = turno !== 0 || id !== null;
      if (id !== null) { reloj.quitar(id); id = null; }
      turno = 0;
      return habia ? { parado: true, porque, dichas } : { parado: false, porque, dichas };
    },
    corriendo: () => id !== null,
    turno: () => turno,
    dichas: () => dichas,
    tramo: () => ultimoTramo,
    opciones: () => Object.assign({}, o),
    ajustar: (x) => Object.assign(o, x)
  };
}
