/* IMMO IA · botones rapidos debajo del chat.
   Va SUELTO: no toca charla.js. Se carga despues de charla.js y se engancha solo.
   Si el chat no esta (porque el servidor todavia no sabe hablar), no hace nada. */
(function(){
  "use strict";

  var BOTONES = [
    { texto: "Certificado energetico", pregunta: "Que es el certificado energetico, cuando hace falta y que me cuesta?" },
    { texto: "Ayudas de vivienda",     pregunta: "Que ayudas de vivienda puedo pedir yo?" },
    { texto: "Vivienda vacacional",    pregunta: "Tengo un apartamento en alquiler vacacional en Canarias. Que papeles me hacen falta y para cuando?" },
    { texto: "Plusvalia municipal",    pregunta: "Vendi un piso. Como se calcula la plusvalia municipal y puedo pagar menos?" }
  ];

  var CSS = ".cha-rapidos{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 11px}"
    + ".cha-rapidos button{padding:8px 13px;font:inherit;font-size:14px;font-weight:600;"
    + "border:1px solid var(--linea,#D8D1BE);border-radius:999px;background:transparent;"
    + "color:inherit;cursor:pointer;line-height:1.2}"
    + ".cha-rapidos button:hover{border-color:var(--marca,#13342A)}"
    + ".cha-rapidos button:focus-visible{outline:2px solid var(--marca,#13342A);outline-offset:2px}"
    + ".cha-rapidos button[disabled]{opacity:.45;cursor:default}";

  var intentos = 0;

  function montar(){
    var caja = document.getElementById("cha-txt");
    var fila = caja && caja.closest ? caja.closest(".cha-fila") : null;
    if(!caja || !fila || document.querySelector(".cha-rapidos")) return !!document.querySelector(".cha-rapidos");

    var e = document.createElement("style");
    e.textContent = CSS;
    document.head.appendChild(e);

    var barra = document.createElement("div");
    barra.className = "cha-rapidos";
    barra.setAttribute("aria-label", "Preguntas rapidas");

    BOTONES.forEach(function(b){
      var bt = document.createElement("button");
      bt.type = "button";
      bt.textContent = b.texto;
      bt.addEventListener("click", function(){
        var ir = document.getElementById("cha-ir");
        if(!ir || ir.disabled) return;
        caja.value = b.pregunta;
        ir.click();
        caja.focus({preventScroll:true});
      });
      barra.appendChild(bt);
    });

    fila.parentNode.insertBefore(barra, fila);
    return true;
  }

  /* El chat se dibuja despues de preguntarle al servidor si sabe hablar,
     asi que se mira unas cuantas veces y luego se deja de mirar. */
  function esperar(){
    if(montar()) return;
    if(++intentos > 40) return;      /* ~20 segundos y paramos */
    setTimeout(esperar, 500);
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", esperar);
  else esperar();
})();
