/* IMMO IA · el vídeo de la casa dentro de la conversación.
   NO hay galería ni escaparate: las casas son un archivo interno.
   Cuando la IA decide enseñar una, escribe una marca [CASA:id] en su respuesta.
   Este archivo la ve, la borra del texto, y abre el vídeo en la misma pantalla.

   Va SUELTO: no toca charla.js. Se carga después de charla.js.
   Si la IA se inventa un id que no está en casas.json, no se abre nada. */
(function(){
  "use strict";

  var casas = [];
  var listo = false;
  var pendiente = null;   /* marca que llego antes de cargar el archivo */

  /* ---------------- el archivo interno ---------------- */
  fetch("casas.json", {cache:"no-store"})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ casas = (d && Array.isArray(d.casas)) ? d.casas : []; })
    .catch(function(){ casas = []; })
    .then(function(){
      listo = true;
      barrer();
      if(pendiente){ var c = buscar(pendiente); pendiente = null; if(c) abrir(c); }
    });

  function buscar(id){
    var q = String(id||"").trim().toLowerCase();
    for(var i=0;i<casas.length;i++){
      if(String(casas[i].id||"").trim().toLowerCase() === q) return casas[i];
    }
    return null;
  }

  /* ---------------- estilos ---------------- */
  var CSS = ""
  + "#casa-visor{position:fixed;z-index:60;background:#0D1310;box-shadow:0 20px 60px -12px rgba(0,0,0,.6)}"
  + "#casa-visor.grande{inset:0;display:flex;flex-direction:column}"
  + "#casa-visor.peque{right:16px;bottom:16px;width:min(340px,calc(100vw - 32px));border-radius:14px;overflow:hidden}"
  + "#casa-visor .marco{position:relative;width:100%;aspect-ratio:16/9;background:#000}"
  + "#casa-visor.grande .marco{flex:1;aspect-ratio:auto;min-height:0}"
  + "#casa-visor iframe,#casa-visor video{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}"
  + "#casa-visor .barra{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#141A16;color:#EDEAE1}"
  + "#casa-visor .tit{flex:1;min-width:0;font-size:14.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
  + "#casa-visor .barra button{flex:0 0 auto;padding:8px 12px;border:1px solid #33403A;border-radius:9px;background:transparent;color:#EDEAE1;font:inherit;font-size:14px;font-weight:600;cursor:pointer}"
  + "#casa-visor .barra button:hover{background:#1E2721}"
  + "#casa-visor .barra button:focus-visible{outline:2px solid #8FC3A8;outline-offset:2px}"
  + "#casa-visor .pie{padding:13px 16px 18px;background:#141A16;color:#C9CFC9;font-size:15px;line-height:1.5}"
  + "#casa-visor.peque .pie{display:none}"
  + "#casa-fondo{position:fixed;inset:0;background:rgba(8,12,10,.72);z-index:59}"
  + "[hidden]{display:none !important}"
  + "@media(max-width:520px){#casa-visor.peque{right:10px;left:10px;bottom:10px;width:auto}}";

  var puesto = false;
  function estilos(){
    if(puesto) return;
    var e = document.createElement("style");
    e.textContent = CSS;
    document.head.appendChild(e);
    puesto = true;
  }

  /* ---------------- el reproductor ---------------- */
  var visor = null, fondo = null;

  function montar(){
    if(visor) return;
    estilos();
    fondo = document.createElement("div");
    fondo.id = "casa-fondo"; fondo.hidden = true;
    document.body.appendChild(fondo);

    visor = document.createElement("div");
    visor.id = "casa-visor"; visor.className = "grande"; visor.hidden = true;
    visor.setAttribute("aria-label", "Vídeo de la vivienda");
    visor.innerHTML = '<div class="marco"></div>'
      + '<div class="barra"><span class="tit"></span>'
      + '<button type="button" data-a="peque">Minimizar</button>'
      + '<button type="button" data-a="grande" hidden>Ampliar</button>'
      + '<button type="button" data-a="cerrar">Cerrar</button></div>'
      + '<div class="pie"></div>';
    document.body.appendChild(visor);

    visor.addEventListener("click", function(ev){
      var b = ev.target.closest("button[data-a]");
      if(!b) return;
      var a = b.getAttribute("data-a");
      if(a === "cerrar") cerrar(); else modo(a);
    });
    fondo.addEventListener("click", function(){ modo("peque"); });
    document.addEventListener("keydown", function(ev){
      if(ev.key !== "Escape" || !visor || visor.hidden) return;
      if(visor.classList.contains("grande")) modo("peque"); else cerrar();
    });
  }

  function modo(cual){
    if(!visor) return;
    var g = (cual === "grande");
    visor.classList.toggle("grande", g);
    visor.classList.toggle("peque", !g);
    fondo.hidden = !g;
    visor.querySelector('[data-a="peque"]').hidden  = !g;
    visor.querySelector('[data-a="grande"]').hidden = g;
    document.body.style.overflow = g ? "hidden" : "";
  }

  function cerrar(){
    if(!visor) return;
    visor.hidden = true;
    fondo.hidden = true;
    visor.querySelector(".marco").innerHTML = "";   /* corta el sonido */
    document.body.style.overflow = "";
  }

  function deYoutube(u){
    var m = u.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }
  function deVimeo(u){
    var m = u.match(/vimeo\.com\/(?:video\/)?(\d{5,})/);
    return m ? m[1] : null;
  }

  function abrir(c){
    montar();
    var u = String(c.video || "");
    if(!u) return;
    var marco = visor.querySelector(".marco");
    marco.innerHTML = "";
    var y = deYoutube(u), v = deVimeo(u), el;
    if(y){
      el = document.createElement("iframe");
      el.src = "https://www.youtube-nocookie.com/embed/" + y + "?rel=0&modestbranding=1&autoplay=1";
      el.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen";
      el.allowFullscreen = true;
    } else if(v){
      el = document.createElement("iframe");
      el.src = "https://player.vimeo.com/video/" + v + "?dnt=1&autoplay=1";
      el.allow = "autoplay; fullscreen; picture-in-picture";
      el.allowFullscreen = true;
    } else {
      el = document.createElement("video");
      el.src = u; el.controls = true; el.autoplay = true; el.playsInline = true;
    }
    el.title = c.titulo || "Vivienda";
    marco.appendChild(el);

    visor.querySelector(".tit").textContent = c.titulo || "Vivienda";
    var precio = (Number(c.precio)||0).toLocaleString("es-ES",{maximumFractionDigits:0}) + " €";
    visor.querySelector(".pie").textContent =
      [c.zona, (c.habitaciones ? c.habitaciones + " hab" : ""), (c.metros ? c.metros + " m²" : ""),
       precio + (c.tipo === "alquiler" ? " al mes" : "")].filter(Boolean).join(" · ");

    modo("grande");
    visor.hidden = false;
  }

  /* ---------------- ver la marca en lo que dice la IA ---------------- */
  /* Tolerante a proposito: da igual mayusculas, espacios, o que escriba
     [CASA: ej-1], [casa:ej-1] o [CASA : ej-1]. Cuantas menos formas de
     fallar tenga la marca, mejor. */
  var MARCA = /\[\s*casa\s*:\s*([A-Za-z0-9_-]{1,40})\s*\]/gi;

  function limpiarYAbrir(nodo){
    var t = nodo.textContent;
    if(!t || t.toLowerCase().indexOf("[casa") < 0) return;   /* filtro rapido, ya tolerante */
    var ids = [], m;
    MARCA.lastIndex = 0;
    while((m = MARCA.exec(t)) !== null) ids.push(m[1]);
    if(!ids.length) return;

    /* la marca no se le ensena a nadie */
    nodo.textContent = t.replace(MARCA, "").replace(/\s{2,}/g, " ").trim();

    var id = ids[ids.length - 1];
    if(!listo){ pendiente = id; return; }   /* aun no ha cargado: se guarda */
    var c = buscar(id);
    if(c) abrir(c);                    /* si el id no existe, no pasa nada */
  }

  function barrer(){
    var hilo = document.getElementById("cha-hilo");
    if(!hilo) return;
    Array.prototype.forEach.call(hilo.querySelectorAll(".cha-ella"), limpiarYAbrir);
  }

  /* El hilo se repinta entero cada vez, asi que se vigila el contenedor. */
  var intentos = 0;
  function vigilar(){
    var hilo = document.getElementById("cha-hilo");
    if(!hilo){
      if(++intentos > 40) return;       /* ~20 segundos y paramos */
      return setTimeout(vigilar, 500);
    }
    barrer();
    new MutationObserver(function(){ barrer(); })
      .observe(hilo, {childList:true, subtree:true, characterData:true});
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", vigilar);
  else vigilar();
})();
