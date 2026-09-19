/* ============================================================
   bus.js - el canal de eventos por el que se hablan las piezas

   Las piezas no se importan entre si. Cada una emite sus eventos
   por aqui y main.js decide que pasa con cada uno.

   Solo valen los eventos de esta lista: un nombre mal escrito da
   error en vez de perderse sin avisar.
   ============================================================ */

export const EVENTOS = Object.freeze([
  /* PIEZA 1 - entrada_audio (oido) */
  "entrada:lista",              /* microfono abierto y ruido de fondo medido  {fondoDb, transcribe} */
  "entrada:empieza_a_hablar",   /* {db, fondoDb} */
  "entrada:termino_de_hablar",  /* {duracionMs, finT} */
  "entrada:nivel",              /* {db, fondoDb, umbralDb, hablando}  ~50 por segundo */
  "entrada:texto_parcial",      /* {turno, texto} mientras hablas */
  "entrada:frase",              /* {turno, texto, fuente, latenciaMs, duracionMs}  lista para el cerebro */
  "entrada:ruido",              /* {turno, duracionMs}  hubo sonido pero ninguna palabra */
  "entrada:pausada",
  "entrada:reanudada",
  "entrada:parada",
  "entrada:error",              /* {codigo, mensaje} */

  /* IDA Y VUELTA 18/09 - PIEZA 1, lo nuevo */
  "entrada:sordina",            /* {puesta}  el oido sigue abierto mientras ella habla */
  "entrada:interrumpe",         /* {db, fondoDb}  ha empezado a hablar ENCIMA de la secretaria */
  "entrada:tirado",             /* {porque}  texto descartado por ser el eco de la propia voz */
  "entrada:reintentando",       /* {intento, dentroMs, porque} */
  "entrada:recuperada",         /* {intentos} */
  "entrada:rendida",            /* {intentos, mensaje}  ya no vuelve sola: hay que decirlo en pantalla */

  /* EL MOVIL 19/09 - el oido esta abierto pero NO llega sonido */
  "entrada:dormida",            /* {codigo, porque}  pantalla apagada, llamada, otra app */
  "entrada:despierta",          /* {porque} */

  /* EL MOVIL 19/09 - la pagina se esconde, se congela y vuelve */
  "pagina:escondida",           /* {} */
  "pagina:vuelve",              /* {msFuera, comoVuelve} */
  "pantalla:despierta",         /* {puesta, porque}  la pantalla no se apaga / no se ha podido */

  /* PIEZA 2 - cerebro_datos (analitico) */
  "datos:listo",                /* {documentos, herramientas, enSegundoPlano} */
  "datos:pedido",               /* {id, herramienta, entrada} */
  "datos:resultado",            /* {id, herramienta, estado, ms} */
  "datos:tarde",                /* {id, herramienta, ms}  se ha pasado del tiempo */
  "datos:error",                /* {id, mensaje} */

  /* PIEZA 3 - cerebro_hablador (ejecutivo) */
  "hablador:pensando",          /* {turno, texto} */
  "hablador:frase",             /* {turno, n, texto, tipo}  tipo: respuesta | preambulo | relleno | aviso */
  "hablador:busca",             /* {turno, herramienta, porque, ronda} */
  "hablador:sin_dato",          /* {turno, herramienta, estado}  no hay dato: se dice "no lo tengo" */
  "hablador:fin",               /* {turno, motivo, rondas, ms} */
  "hablador:cortado",           /* {turno} */
  "hablador:despedida",         /* {turno} */
  "hablador:pausa",             /* {turno}  "voy a comer": descansa, la conversacion sigue viva */
  "hablador:vuelta",            /* {turno}  "ya estoy": se retoma donde se dejo */
  "hablador:error",             /* {turno, mensaje} */

  /* EL SILENCIO 19/09 (tanda 10) - las frases de relleno de la casa.
     NO las genera nadie y NO se guardan en la conversacion: salen con
     tipo "relleno", que es lo que ya mira primer_minuto/memoria.js. */
  "relleno:frase",              /* {turno, texto, tramo, n, msDeSilencio}  tramo: corto | medio | largo | sigue */
  "relleno:callado",            /* {turno, porque, habiaVoz}  se ha callado en el acto */

  /* PIEZA 4 - salida_audio (voz) */
  "salida:empieza",             /* {turno}  empieza a sonar */
  "salida:frase_dicha",         /* {turno, n} */
  "salida:fin",                 /* {turno}  ha dicho todo lo del turno */
  "salida:callada",             /* {turno}  la han mandado callar */
  "salida:error",               /* {mensaje} */
  "salida:interrumpida",        /* {turno}  la han cortado hablando ella encima */

  /* main.js */
  "asistente:estado"            /* {estado}  apagado | escuchando | pensando | hablando | pausa */
]);

export function crearBus({ registro = null } = {}) {
  const validos = new Set(EVENTOS);
  const canal = new EventTarget();
  const comprobar = (nombre) => {
    if (!validos.has(nombre)) throw new Error("Evento desconocido en el bus: " + nombre);
  };
  return {
    emitir(nombre, datos = {}) {
      comprobar(nombre);
      const detalle = Object.assign({}, datos, { evento: nombre, t: Math.round(performance.now()) });
      if (registro && nombre !== "entrada:nivel") { try { registro(detalle); } catch (e) {} }
      canal.dispatchEvent(new CustomEvent(nombre, { detail: detalle }));
    },
    /* devuelve una funcion para dejar de escuchar */
    en(nombre, fn) {
      comprobar(nombre);
      const h = (e) => { try { fn(e.detail); } catch (err) { console.error("[bus]", nombre, err); } };
      canal.addEventListener(nombre, h);
      return () => canal.removeEventListener(nombre, h);
    },
    /* espera a un evento concreto (para pruebas y para main.js) */
    esperar(nombre, condicion = () => true, maxMs = 30000) {
      comprobar(nombre);
      return new Promise((ok, mal) => {
        const reloj = setTimeout(() => { quitar(); mal(new Error("No ha llegado " + nombre)); }, maxMs);
        const quitar = this.en(nombre, (d) => { if (condicion(d)) { clearTimeout(reloj); quitar(); ok(d); } });
      });
    }
  };
}
