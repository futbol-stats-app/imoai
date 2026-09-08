/* IMMO IA · el cuadro de conversacion.
   Se dibuja solo si el servidor sabe contestar. Si no, no aparece nada. */
(function(){
var API = (typeof CONFIG === "object" && CONFIG && CONFIG.api) ? String(CONFIG.api).replace(/\/$/, "") : "";
var CODIGO = "leire2026";
var historia = [];
var pensando = false;
if(!API) return;

var CSS = ".cha{border:1px solid var(--linea,#D8D1BE);border-radius:12px;background:var(--tarjeta,#fff);padding:16px 16px 14px;margin:0 0 18px}"
+ ".cha-tit{font-weight:700;color:var(--marca,#13342A);margin:0 0 3px;font-size:16px}"
+ ".cha-sub{margin:0 0 12px;font-size:13.5px;color:var(--tinta-2,#635C4B)}"
+ ".cha-hilo{display:flex;flex-direction:column;gap:9px;margin-bottom:12px}"
+ ".cha-m{max-width:88%;padding:9px 12px;border-radius:12px;font-size:15px;line-height:1.5;white-space:pre-wrap}"
+ ".cha-yo{align-self:flex-end;background:var(--marca,#13342A);color:#fff;border-bottom-right-radius:4px}"
+ ".cha-ella{align-self:flex-start;background:#EDF1EE;color:#1B231F;border-bottom-left-radius:4px}"
+ ".cha-mal{align-self:flex-start;background:#FBEDE4;color:#7A3B12;border:1px solid #E3BFA0}"
+ ".cha-fila{display:flex;gap:8px;align-items:flex-end}"
+ ".cha-fila textarea{flex:1;min-height:44px;max-height:130px;resize:vertical;padding:10px 12px;font:inherit;font-size:15px;border:1px solid var(--linea,#D8D1BE);border-radius:9px;background:#fff;color:inherit}"
+ ".cha-fila button{flex:0 0 auto;padding:11px 18px;font:inherit;font-weight:600;font-size:15px;border:0;border-radius:9px;background:var(--marca,#13342A);color:#fff;cursor:pointer}"
+ ".cha-fila button[disabled]{opacity:.5;cursor:default}"
+ ".cha-pie{margin:9px 0 0;font-size:12.5px;color:var(--tinta-2,#635C4B)}";

function esc(s){ var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function pintar(){
var h = document.getElementById("cha-hilo");
if(!h) return;
h.innerHTML = historia.map(function(m){
var c = m.papel === "yo" ? "cha-yo" : (m.papel === "mal" ? "cha-mal" : "cha-ella");
return '<div class="cha-m ' + c + '">' + esc(m.texto) + "</div>";
}).join("");
}

async function mandar(){
var caja = document.getElementById("cha-txt");
var boton = document.getElementById("cha-ir");
if(!caja || pensando) return;
var dicho = caja.value.trim();
if(!dicho) return;
historia.push({papel:"yo", texto:dicho});
caja.value = "";
pensando = true;
boton.disabled = true;
boton.textContent = "...";
historia.push({papel:"ella", texto:"Pensando"});
pintar();
var r, d;
try{
r = await fetch(API + "/hablar", {
method:"POST",
headers:{"content-type":"application/json"},
body: JSON.stringify({codigo: CODIGO, mensajes: historia.filter(function(m){ return m.papel === "yo" || (m.papel === "ella" && m.texto !== "Pensando"); })})
});
d = await r.json();
}catch(e){ d = null; }
historia.pop();
if(d && d.respuesta){ historia.push({papel:"ella", texto:d.respuesta}); }
else if(d && d.error){ historia.push({papel:"mal", texto:d.error}); }
else { historia.push({papel:"mal", texto:"No he podido contestar. Intentalo otra vez."}); }
pensando = false;
boton.disabled = false;
boton.textContent = "Enviar";
pintar();
caja.focus();
}

function montar(){
var ancla = document.querySelector(".asis");
if(!ancla || document.getElementById("cha-hilo")) return;
var e = document.createElement("style");
e.textContent = CSS;
document.head.appendChild(e);
var caja = document.createElement("div");
caja.className = "cha";
caja.innerHTML = '<p class="cha-tit">Habla con la IA</p>'
+ '<p class="cha-sub">Preguntale lo que quieras sobre alquilar, comprar o reformar. Te contesta ella.</p>'
+ '<div class="cha-hilo" id="cha-hilo"></div>'
+ '<div class="cha-fila">'
+ '<textarea id="cha-txt" rows="2" placeholder="Ej.: quiero alquilar en Tenerife, por donde empiezo?" aria-label="Escribele a la IA"></textarea>'
+ '<button type="button" id="cha-ir">Enviar</button>'
+ '</div>'
+ '<p class="cha-pie">Los importes y los plazos no los da ella: los da la calculadora de aqui abajo, con la norma oficial al lado.</p>';
ancla.parentNode.insertBefore(caja, ancla);
historia.push({papel:"ella", texto:"Hola. Cuentame que estas buscando: alquilar, comprar o reformar. Y si quieres, en que zona."});
pintar();
document.getElementById("cha-ir").addEventListener("click", mandar);
document.getElementById("cha-txt").addEventListener("keydown", function(ev){
if(ev.key === "Enter" && !ev.shiftKey){ ev.preventDefault(); mandar(); }
});
var cara = document.getElementById("ia-bola");
if(cara){
var nueva = cara.cloneNode(true);
cara.parentNode.replaceChild(nueva, cara);
nueva.setAttribute("aria-label", "Hablar con la IA");
nueva.title = "Toca para hablar con la IA";
nueva.addEventListener("click", function(){
var q = document.getElementById("cha-txt");
if(!q) return;
q.scrollIntoView({behavior:"smooth", block:"center"});
setTimeout(function(){ q.focus({preventScroll:true}); }, 420);
});
}
}

var LLAVE = "immoia.sabehablar.v1";

async function preguntarleAlServidor(){
try{
var r = await fetch(API + "/hablar", {
method:"POST",
headers:{"content-type":"application/json"},
body: JSON.stringify({codigo: CODIGO, mensajes:[{papel:"yo", texto:"hola"}]})
});
var d = await r.json();
return !!(d && typeof d.respuesta === "string" && d.respuesta.trim());
}catch(e){ return false; }
}

async function arrancar(){
var guardado = null;
try{ guardado = sessionStorage.getItem(LLAVE); }catch(e){}
if(guardado === "no") return;
if(guardado === "si"){ montar(); return; }
var puede = await preguntarleAlServidor();
try{ sessionStorage.setItem(LLAVE, puede ? "si" : "no"); }catch(e){}
if(puede) montar();
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
else arrancar();
})();
