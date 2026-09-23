/* ==================================================================
   los_expedientes.js · LO QUE HAY HOY EN SU MESA

   CUATRO EXPEDIENTES DE EJEMPLO, TODOS INVENTADOS. Calles inventadas
   en Adeje y Arona, personas inventadas, documentos con ceros y
   rotulados EJEMPLO. NI UN DATO DE UNA PERSONA REAL.

   Vienen de SUBIR\LA_CUENTA_DE_ELLA\cuenta\ (el fichero original
   está copiado al lado, en mesa\, tal y como llegó). Aquí están en un
   fichero de JavaScript en vez de en un JSON porque la aplicación
   tiene que abrir con doble clic: desde file:// el navegador no deja
   leer un JSON de al lado, y un .js sí.

   NO SE LLAMA A NINGÚN SERVIDOR PARA TRAER ESTO. La oficina de verdad
   todavía no está enchufada aquí, y la pantalla lo dice.

   ==================================================================
   LAS FECHAS · ARREGLO DEL 20/09/2026. LO MÁS IMPORTANTE DE ESTE
   FICHERO, Y LO QUE HAY QUE ENTENDER ANTES DE TOCARLO.
   ------------------------------------------------------------------
   ANTES, ARRIBA DE ESTE FICHERO PONÍA  "hoy": "2026-09-21"  Y TODAS
   LAS FECHAS ERAN FECHAS DE CALENDARIO. Eso era una bomba de
   relojería: la aplicación daba por bueno ese día y contaba los
   plazos desde él. El lunes 21 cuadraba. El martes 22 ya no. Dentro
   de un mes, la mesa le habría dicho a una directora que algo «vence
   el jueves 24» con el jueves 24 un mes atrás.

   AHORA NO HAY NINGUNA FECHA ESCRITA. Hay DISTANCIAS al día en que se
   abre la aplicación, y las fechas de verdad se calculan aquí abajo
   con el reloj del ordenador. Se abra el día que se abra, la mesa
   enseña siempre lo mismo: unas cosas ya pasadas, una que vence
   dentro de tres días, y otras lejos.

   Hay tres maneras de colocar una fecha, y no hay más:

     { "hace_dias": 24 }
         hace 24 días. Es lo normal: la nota simple que pidió, el
         contrato que firmó, la última vez que se movió el expediente.

     { "dentro_de_dias": 4 }
         dentro de 4 días. La cita de notaría que todavía no ha
         llegado.

     { "caduca_dentro_de_dias": 3, "vigencia_anios": 10 }
         para los papeles QUE CADUCAN. Aquí no se dice cuándo se
         emitió: se dice CUÁNDO CADUCA, que es lo único que importa en
         la pantalla, y de ahí se saca hacia atrás el día en que se
         emitió. El certificado energético dura diez años, así que uno
         que caduca dentro de 3 días se emitió hace diez años menos
         tres días. Si se pusiera la fecha de emisión a pelo, el día
         que caduca se movería solo con cada año bisiesto.

   SI ALGUIEN VUELVE A ESCRIBIR UNA FECHA DE CALENDARIO AQUÍ, o vuelve
   a poner un "hoy", la bomba se rearma. Hay una comprobación que lo
   caza: apartado M de prueba_los_arreglos.mjs.
   ================================================================== */
window.LA_SECRETARIA_MESA = (function () {
  "use strict";

  /* ------------------------------------------------------------------
     EL RELOJ. El del ordenador de ella, y ninguno más.
     ------------------------------------------------------------------ */
  function dosCifras(n) { return (n < 10 ? "0" : "") + n; }
  function aISO(d) {
    return d.getFullYear() + "-" + dosCifras(d.getMonth() + 1) + "-" + dosCifras(d.getDate());
  }
  function hoyDelOrdenador() { return aISO(new Date()); }
  function masDias(iso, n) {
    var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return aISO(d);
  }
  function masAnios(iso, n) {
    var d = new Date(iso + "T12:00:00"); d.setFullYear(d.getFullYear() + n); return aISO(d);
  }

  var HOY = hoyDelOrdenador();

  /* Convierte una de las tres maneras de colocar una fecha en la fecha
     de verdad. Si le llega otra cosa, devuelve null y no se inventa
     nada: la pantalla ya sabe decir «no lo sé». */
  function colocar(f) {
    if (f == null) return null;
    if (typeof f === "string") return f;              /* por si alguien pone una a pelo */
    if (typeof f !== "object") return null;
    if (typeof f.hace_dias === "number") return masDias(HOY, -f.hace_dias);
    if (typeof f.dentro_de_dias === "number") return masDias(HOY, f.dentro_de_dias);
    if (typeof f.caduca_dentro_de_dias === "number") {
      var caduca = masDias(HOY, f.caduca_dentro_de_dias);
      return masAnios(caduca, -(f.vigencia_anios || 10));
    }
    return null;
  }

  /* ------------------------------------------------------------------
     LOS CUATRO EXPEDIENTES. Todos inventados.
     ------------------------------------------------------------------ */
  var DATOS =
  {
   "fuente": "SUBIR\\LA_CUENTA_DE_ELLA\\cuenta\\",
   "semana": null,
   "expedientes": [
    {
     "expediente_id": "EXP-DIR-01",
     "es_test": true,
     "nombre": "Tabaiba Dulce 14",
     "vivienda": {
      "via": "calle Tabaiba Dulce 14",
      "piso": "2ºC",
      "municipio": "Adeje",
      "direccion_literal": "calle Tabaiba Dulce 14, 2ºC, Adeje (EJEMPLO, calle inventada)"
     },
     "propietario": {
      "nombre": "Nieves Garabato Luz",
      "documento": "DNI 00000011-A (EJEMPLO)"
     },
     "tipo_operacion": "venta",
     "documentos": [
      {
       "cual": "nota simple informativa",
       "estado_documento": "recibido",
       "fecha": {
        "hace_dias": 24
       },
       "literal_en_OT25": "Nota simple informativa — recibida {FECHA}"
      },
      {
       "cual": "certificado de eficiencia energética (letra E)",
       "estado_documento": "recibido",
       "fecha": {
        "caduca_dentro_de_dias": 901,
        "vigencia_anios": 10
       },
       "literal_en_OT25": "Certificado de eficiencia energética (letra E) — emitido {FECHA}"
      },
      {
       "cual": "últimos recibos del IBI",
       "estado_documento": "recibido",
       "literal_en_OT25": "Últimos recibos del IBI — al día, recibo de {ANIO}"
      },
      {
       "cual": "DNI de la propietaria",
       "estado_documento": "verificado",
       "fecha": {
        "hace_dias": 24
       },
       "literal_en_OT25": "DNI de la propietaria — verificado {FECHA}"
      },
      {
       "cual": "contrato de arras",
       "estado_documento": "recibido",
       "fecha": {
        "hace_dias": 19
       },
       "literal_en_OT25": "Contrato de arras — firmado {FECHA}; escritura como tarde el {DENTRO:24}"
      },
      {
       "cual": "certificado de estar al día en la comunidad de propietarios",
       "estado_documento": "pedido",
       "fecha": {
        "hace_dias": 5
       },
       "literal_en_OT25": "Certificado de estar al día en la comunidad de propietarios — pedido al administrador el {FECHA}"
      },
      {
       "cual": "cita de notaría",
       "estado_documento": "pedido",
       "literal_en_OT25": "Cita de notaría — pedida, sin fecha todavía"
      }
     ],
     "ultimo_movimiento": {
      "fecha": {
       "hace_dias": 5
      },
      "que": "pedido el certificado de la comunidad al administrador"
     }
    },
    {
     "expediente_id": "EXP-DIR-02",
     "es_test": true,
     "nombre": "Mar de Nubes 5",
     "vivienda": {
      "via": "avenida Mar de Nubes 5",
      "piso": "bajo A",
      "municipio": "Costa Adeje, Adeje",
      "direccion_literal": "avenida Mar de Nubes 5, bajo A, Costa Adeje, Adeje (EJEMPLO, calle inventada)"
     },
     "propietario": {
      "nombre": "Hans Beispiel",
      "documento": "NIE X0000012-B (EJEMPLO)"
     },
     "tipo_operacion": "venta",
     "documentos": [
      {
       "cual": "nota simple informativa",
       "estado_documento": "recibido",
       "fecha": {
        "hace_dias": 32
       },
       "literal_en_OT25": "Nota simple informativa — recibida {FECHA}"
      },
      {
       "cual": "certificado de eficiencia energética",
       "estado_documento": "falta",
       "literal_en_OT25": "Certificado de eficiencia energética — falta, el técnico todavía no ha ido"
      },
      {
       "cual": "últimos recibos del IBI",
       "estado_documento": "recibido",
       "literal_en_OT25": "Últimos recibos del IBI — al día"
      },
      {
       "cual": "NIE del propietario",
       "estado_documento": "verificado",
       "fecha": {
        "hace_dias": 32
       },
       "literal_en_OT25": "NIE del propietario — verificado {FECHA}"
      }
     ],
     "ultimo_movimiento": {
      "fecha": {
       "hace_dias": 27
      },
      "que": "visita con una pareja interesada"
     }
    },
    {
     "expediente_id": "EXP-DIR-03",
     "es_test": true,
     "nombre": "Cardón Alto 22",
     "vivienda": {
      "via": "calle Cardón Alto 22",
      "piso": "1ºB",
      "municipio": "Los Cristianos, Arona",
      "direccion_literal": "calle Cardón Alto 22, 1ºB, Los Cristianos, Arona (EJEMPLO, calle inventada)"
     },
     "propietario": {
      "nombre": "Tomás Brezo Almácigo",
      "documento": "DNI 00000013-C (EJEMPLO)"
     },
     "tipo_operacion": "alquiler",
     "documentos": [
      {
       "cual": "contrato de arrendamiento",
       "estado_documento": "recibido",
       "fecha": {
        "hace_dias": 20
       },
       "literal_en_OT25": "Contrato de arrendamiento — firmado {FECHA}"
      },
      {
       "cual": "certificado de eficiencia energética (letra F)",
       "estado_documento": "recibido",
       "fecha": {
        "caduca_dentro_de_dias": 3,
        "vigencia_anios": 10
       },
       "literal_en_OT25": "Certificado de eficiencia energética (letra F) — emitido {FECHA}"
      },
      {
       "cual": "fianza depositada en el Instituto Canario de la Vivienda",
       "estado_documento": "recibido",
       "fecha": {
        "hace_dias": 13
       },
       "literal_en_OT25": "Fianza — depositada {FECHA}"
      },
      {
       "cual": "inventario y fotos del piso",
       "estado_documento": "recibido",
       "fecha": {
        "hace_dias": 20
       },
       "literal_en_OT25": "Inventario y fotos del piso — hechos {FECHA}"
      },
      {
       "cual": "DNI de las dos partes",
       "estado_documento": "verificado",
       "fecha": {
        "hace_dias": 20
       },
       "literal_en_OT25": "DNI de las dos partes — verificado {FECHA}"
      }
     ],
     "ultimo_movimiento": {
      "fecha": {
       "hace_dias": 13
      },
      "que": "depositada la fianza"
     }
    },
    {
     "expediente_id": "EXP-DIR-04",
     "es_test": true,
     "nombre": "Risco del Guirre 7",
     "vivienda": {
      "via": "calle Risco del Guirre 7",
      "piso": null,
      "municipio": "Valle San Lorenzo, Arona",
      "direccion_literal": "calle Risco del Guirre 7, Valle San Lorenzo, Arona (EJEMPLO, calle inventada)"
     },
     "propietario": {
      "nombre": "Eleanor Sample",
      "documento": "pasaporte 000000014 (EJEMPLO)"
     },
     "tipo_operacion": "venta",
     "documentos": [
      {
       "cual": "nota simple informativa",
       "estado_documento": "recibido",
       "fecha": {
        "hace_dias": 16
       },
       "literal_en_OT25": "Nota simple informativa — recibida {FECHA}"
      },
      {
       "cual": "certificado de eficiencia energética (letra D)",
       "estado_documento": "recibido",
       "fecha": {
        "caduca_dentro_de_dias": 2060,
        "vigencia_anios": 10
       },
       "literal_en_OT25": "Certificado de eficiencia energética (letra D) — emitido {FECHA}"
      },
      {
       "cual": "últimos recibos del IBI",
       "estado_documento": "recibido",
       "literal_en_OT25": "Últimos recibos del IBI — al día"
      },
      {
       "cual": "pasaporte de la propietaria",
       "estado_documento": "verificado",
       "fecha": {
        "hace_dias": 16
       },
       "literal_en_OT25": "Pasaporte de la propietaria — verificado {FECHA}"
      },
      {
       "cual": "contrato de arras",
       "estado_documento": "recibido",
       "fecha": {
        "hace_dias": 14
       },
       "literal_en_OT25": "Contrato de arras — firmado {FECHA}"
      },
      {
       "cual": "certificado de estar al día en la comunidad de propietarios",
       "estado_documento": "pedido",
       "fecha": {
        "hace_dias": 12
       },
       "literal_en_OT25": "Certificado de estar al día en la comunidad de propietarios — pedido al administrador el {FECHA}, no contesta"
      },
      {
       "cual": "cita de notaría",
       "estado_documento": "recibido",
       "fecha": {
        "dentro_de_dias": 4
       },
       "literal_en_OT25": "Cita de notaría — confirmada para el {FECHA}"
      }
     ],
     "ultimo_movimiento": {
      "fecha": {
       "hace_dias": 11
      },
      "que": "confirmada la cita de notaría"
     }
    }
   ]
  }  ;

  /* ------------------------------------------------------------------
     Y AQUÍ SE COLOCAN LAS FECHAS, CONTANDO DESDE HOY
     ------------------------------------------------------------------ */
  /* Y LO MISMO CON EL TEXTO QUE SE LEE EN PANTALLA. Cada papel trae
     su renglón tal y como está escrito en la hoja de la oficina, y ese
     renglón lleva la fecha dentro: «Nota simple informativa — recibida
     28/08/2026». Si la fecha de arriba se mueve con el día y el
     renglón no, la pantalla se contradice sola: pondría «recibida el
     28/08» al lado de «hace 12 días». Ya nos pasó: el 22 de
     septiembre la mesa decía «en el texto de la cita de notaría pone
     el 25 de septiembre, pero no hay ningún papel con esa fecha».

     Así que los renglones llevan huecos y se rellenan aquí:
        {FECHA}      la fecha de ese mismo papel
        {DENTRO:24}  una fecha 24 días después de hoy
        {HACE:19}    una fecha 19 días antes de hoy
        {ANIO}       el año en el que se esté */
  /* ARREGLO DEL 21/09/2026 · EL MES, EN LETRA.
     Esto devolvía «28/08/2026». Con esos dos números delante nadie sabe
     si es el 28 de agosto o, en un ordenador que ponga el mes primero,
     otra cosa. En una aplicación cuyo miedo declarado es confundir el
     día con el mes, escribir la fecha en números es sembrar el
     problema. Ahora se escribe entera: ocupa más y se entiende sola.
     (El nombre «enCorto» se queda para no tocar nada más; ya no es
     corto, es claro.) */
  var MESES_DEL_RENGLON = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                           "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function enCorto(iso) {
    if (!iso) return "";
    return Number(iso.slice(8, 10)) + " de " + MESES_DEL_RENGLON[Number(iso.slice(5, 7)) - 1] +
           " de " + iso.slice(0, 4);
  }
  function rellenar(texto, fechaDelPapel) {
    if (typeof texto !== "string") return texto;
    return texto
      .replace(/\{FECHA\}/g, enCorto(fechaDelPapel))
      .replace(/\{ANIO\}/g, HOY.slice(0, 4))
      .replace(/\{DENTRO:(\d+)\}/g, function (_, n) { return enCorto(masDias(HOY, Number(n))); })
      .replace(/\{HACE:(\d+)\}/g, function (_, n) { return enCorto(masDias(HOY, -Number(n))); });
  }

  (DATOS.expedientes || []).forEach(function (e) {
    if (e.ultimo_movimiento) e.ultimo_movimiento.fecha = colocar(e.ultimo_movimiento.fecha);
    (e.documentos || []).forEach(function (d) {
      d.fecha = colocar(d.fecha);
      d.literal_en_OT25 = rellenar(d.literal_en_OT25, d.fecha);
    });
  });

  /* ------------------------------------------------------------------
     SUS NOTAS DE LA SEMANA
     ------------------------------------------------------------------
     Son notas de ejemplo, como todo lo demás de este fichero. Los días
     que nombran son los MISMOS que las fechas de arriba: si no, sus
     notas dirían una cosa y la mesa otra, que es justo lo que no
     puede pasar en esta pantalla.
     ------------------------------------------------------------------ */
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function diaDelMes(iso) { return Number(iso.slice(8, 10)); }
  /* 21/09/2026: esto devolvía «24/9». Mismo problema, misma regla: el
     mes en letra. Aquí no hace falta el año, porque sus notas de la
     semana hablan siempre de estos días. */
  function diaYMes(iso) { return diaDelMes(iso) + " de " + MESES[Number(iso.slice(5, 7)) - 1]; }
  function elDiaLargo(iso) {
    return diaDelMes(iso) + " de " + MESES[Number(iso.slice(5, 7)) - 1];
  }
  function hace(n) { return masDias(HOY, -n); }
  function dentro(n) { return masDias(HOY, n); }

  DATOS.semana =
    "Semana del " + elDiaLargo(HOY) + "\n\n" +
    "Tabaiba Dulce 14 (Nieves) — arras firmadas el " + diaDelMes(hace(19)) + ". " +
    "Pedido el de la comunidad el " + diaDelMes(hace(5)) + ", el administrador va lento. " +
    "Notaría sin fecha todavía; en las arras pone como tarde el " + diaYMes(dentro(24)) + ".\n\n" +
    "Mar de Nubes 5 (Hans) — parado desde la visita del " + diaYMes(hace(27)) + ". " +
    "Llamarle esta semana. Sigue sin certificado energético, el técnico no ha ido.\n\n" +
    "Cardón Alto 22 (alquiler, Tomás) — firmado el " + diaDelMes(hace(20)) + ", " +
    "fianza depositada el " + diaDelMes(hace(13)) + ". Nada pendiente.\n\n" +
    "Risco del Guirre 7 (Eleanor) — notaría el " + diaDelMes(dentro(4)) + ". " +
    "El administrador no contesta lo de la comunidad desde el " + diaDelMes(hace(12)) + ": " +
    "reclamar por escrito.\n";

  /* AQUÍ NO SE DEVUELVE NINGÚN "hoy". A propósito: el día lo pone el
     reloj del ordenador, y solo el reloj del ordenador. */
  return DATOS;
})();
