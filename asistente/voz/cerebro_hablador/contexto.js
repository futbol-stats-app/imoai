/* ============================================================
   PIEZA 3 \u00b7 contexto.js
   El historial de la conversacion que se le manda al cerebro.

   Formato de cada mensaje (el mismo que ya usa IMMO IA):
     { papel: "yo" | "ella", texto, ficha?: true, turno }
   - "yo"   lo que dice la persona
   - "ella" lo que contesta el asistente
   - ficha:true  un dato que ha traido el cerebro de datos. Va como
     "yo" (asi lo espera el worker de IMMO IA) pero marcado, para que
     el worker nuevo sepa que no lo ha escrito la persona.

   Para que no crezca sin fin:
     - como mucho "maxMensajes" y "maxLetras" en total
     - las fichas de turnos viejos se quitan antes que nada
   ============================================================ */

export function crearContexto({ maxMensajes = 24, maxLetras = 16000, turnosConFicha = 2 } = {}) {
  let mensajes = [];

  const letras = () => mensajes.reduce((s, m) => s + m.texto.length, 0);

  function recortar(turnoActual) {
    /* 1. fichas de turnos viejos fuera */
    mensajes = mensajes.filter((m) => !m.ficha || turnoActual - m.turno < turnosConFicha);
    /* 2. lo mas antiguo fuera, siempre empezando por un mensaje de la persona */
    while (mensajes.length > maxMensajes || (letras() > maxLetras && mensajes.length > 1)) {
      mensajes.shift();
      while (mensajes.length && mensajes[0].papel !== "yo") mensajes.shift();
    }
  }

  return {
    persona(texto, turno) {
      mensajes.push({ papel: "yo", texto: String(texto), turno });
      recortar(turno);
    },
    asistente(texto, turno) {
      const t = String(texto || "").trim();
      if (!t) return;
      /* dos respuestas seguidas se juntan (el worker espera alternancia) */
      const ult = mensajes[mensajes.length - 1];
      if (ult && ult.papel === "ella") ult.texto += " " + t;
      else mensajes.push({ papel: "ella", texto: t, turno });
      recortar(turno);
    },
    ficha(texto, turno) {
      /* antes de la ficha, lo que ya dijo el asistente en esta ronda queda guardado */
      mensajes.push({ papel: "yo", texto: String(texto), ficha: true, turno });
      recortar(turno);
    },
    /* copia para mandar (sin el numero de turno) */
    paraEnviar() {
      return mensajes.map((m) => (m.ficha ? { papel: m.papel, texto: m.texto, ficha: true } : { papel: m.papel, texto: m.texto }));
    },
    todos: () => mensajes.slice(),
    vaciar() { mensajes = []; },
    letras,
    cuantos: () => mensajes.length
  };
}
