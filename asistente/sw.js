/* ============================================================
   sw.js  ·  EL AYUDANTE QUE DEJA INSTALAR LA APLICACIÓN

   X3 · 18/09/2026. La dirección quiso que el asistente se abra y
   hable, sin botones. Los navegadores solo dejan eso cuando la
   página está instalada como aplicación en el ordenador, y para
   instalarse hace falta este archivo.

   Lo que hace, en llano:
     1. El día de la instalación se guarda una copia de la página
        en el ordenador de la oficina.
     2. Cada vez que se abre, primero mira si hay internet y trae
        lo último. Si no hay, abre con la copia guardada.

   No manda nada a ninguna parte y no guarda ninguna conversación:
   solo los archivos de la propia página.
   ============================================================ */

const CAJA = "immoia-asistente-v4";

/* Los archivos de la casa. Si mañana se añade uno nuevo, se apunta aquí. */
const ARCHIVOS = [
  "./",
  "./index.html",
  "./configuracion.js",
  "./manifest.webmanifest",
  "./iconos/icono.svg",
  "./iconos/icono-192.png",
  "./iconos/icono-512.png",
  "./primer_minuto/cinta.js",
  "./primer_minuto/memoria.js",
  "./primer_minuto/mesa.js",
  "./voz/arranque_solo.js",
  "./voz/bus.js",
  "./voz/main.js",
  "./voz/despertador.js",
  "./voz/relleno.js",
  "./voz/cerebro_datos/buscador.js",
  "./voz/cerebro_datos/cerebro_datos.js",
  "./voz/cerebro_datos/herramientas.js",
  "./voz/cerebro_datos/trabajador_datos.js",
  "./voz/salida_audio/lectura.js",
  "./voz/salida_audio/salida_audio.js",
  "./voz/salida_audio/voz_navegador.js",
  "./voz/entrada_audio/detector_voz.js",
  "./voz/entrada_audio/entrada_audio.js",
  "./voz/entrada_audio/transcripcion.js",
  "./voz/cerebro_hablador/cerebro_hablador.js",
  "./voz/cerebro_hablador/conexion_simulada.js",
  "./voz/cerebro_hablador/conexion_stream.js",
  "./voz/cerebro_hablador/conexion_worker.js",
  "./voz/cerebro_hablador/contexto.js",
  "./voz/cerebro_hablador/troceador.js",
  "./datos/cifras_legales.json",
  "./datos/como_funciona_el_asistente.md",
  "./datos/expediente_ejemplo_adeje.json",
  "./datos/expedientes_ejemplo.json",
  "./datos/indice.json",
  "./datos/notas_oficina_ejemplo.md"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const caja = await caches.open(CAJA);
    /* uno a uno: si mañana falta un archivo, no se cae la instalación entera */
    await Promise.all(ARCHIVOS.map((a) => caja.add(a).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n !== CAJA).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (ev) => {
  const p = ev.request;
  if (p.method !== "GET") return;                       /* lo que va al servidor, va al servidor */
  const url = new URL(p.url);
  if (url.origin !== self.location.origin) return;      /* el cerebro de IMMO IA no se guarda aquí */

  ev.respondWith((async () => {
    try {
      const deLaRed = await fetch(p);
      if (deLaRed && deLaRed.ok) {
        const caja = await caches.open(CAJA);
        caja.put(p, deLaRed.clone()).catch(() => {});
      }
      return deLaRed;
    } catch (e) {
      const guardado = await caches.match(p);
      if (guardado) return guardado;
      const portada = await caches.match("./index.html");
      if (portada && p.mode === "navigate") return portada;
      throw e;
    }
  })());
});
