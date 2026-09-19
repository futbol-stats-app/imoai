# Como funciona el asistente de voz

El asistente esta hecho con cuatro piezas y un pegamento. Ninguna pieza conoce a las otras: se hablan por un canal de eventos que monta main.js.

# La pieza 1: el oido

El oido abre el microfono, detecta cuando la persona habla y cuando se calla, y pasa la voz a texto con el navegador. Da una frase por terminada cuando hay 700 milisegundos de silencio.

# La pieza 2: el cerebro de datos

El cerebro de datos busca en los archivos guardados de esta carpeta. Trabaja en un hilo aparte del navegador para no frenar la voz. Devuelve trozos copiados literalmente, con el nombre del archivo.

# La pieza 3: el cerebro hablador

El cerebro hablador lleva la conversacion. No busca archivos: se los pide al cerebro de datos. Mientras espera, dice una frase corta para que no haya silencios.

# La pieza 4: la voz

La voz dice cada frase en cuanto llega, sin esperar a la respuesta entera. Mientras habla, el oido esta en pausa para no oirse a si mismo.
