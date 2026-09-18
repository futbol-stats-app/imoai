/* =========================================================
   IMMO IA - leer.js  v1.0
   Leer expedientes: la secretaria abre el papel y lo lee.

   Que hace:
     - Arrastras un PDF (o un .txt) encima del chat, o le das
       al boton "Traer un expediente".
     - Saca el texto de dentro del PDF, en la propia pagina.
     - Se lo pasa a la secretaria como si se lo hubieras
       escrito tu.

   Sin librerias de fuera. Si se cae internet, sigue leyendo.

   Lo que NO hace, y lo dice claro:
     - Un PDF que sea una foto escaneada no tiene letras
       dentro, solo una imagen. Eso avisa de que no puede.
   ========================================================= */

(function () {
  "use strict";

  var TOPE = 12000;   /* caracteres que se le pasan a la secretaria */

  /* ---------------- 1. pinta ---------------- */

  var CSS =
    ".lee-fila{display:flex;align-items:center;gap:9px;margin:8px 0 0;flex-wrap:wrap}" +
    ".lee-fila button{padding:7px 13px;font:inherit;font-size:14px;font-weight:600;" +
      "border:1px solid #D8D1BE;border-radius:9px;background:#fff;color:#13342A;cursor:pointer}" +
    ".lee-fila button:hover{background:#EDF1EE}" +
    ".lee-nota{font-size:13.5px;color:#635C4B}" +
    ".lee-encima{outline:3px dashed #13342A;outline-offset:5px;border-radius:12px}" +
    ".lee-aviso{margin:9px 0 0;padding:10px 12px;border-radius:9px;font-size:14px;" +
      "background:#EDF1EE;border:1px solid #CBD9D0;color:#1B231F}" +
    ".lee-mal{background:#FBEEEA;border-color:#E7C9BE}";

  function pintar() {
    if (document.getElementById("lee-css")) return;
    var e = document.createElement("style");
    e.id = "lee-css";
    e.textContent = CSS;
    document.head.appendChild(e);
  }

  /* ------ 2. leer por dentro el PDF (probado contra
     reportlab, LibreOffice, Word, Chrome y wkhtmltopdf) ------ */

  function comoLatin1(bytes) {
      var s = "", trozo = 0x8000;
      for (var i = 0; i < bytes.length; i += trozo) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + trozo));
      }
      return s;
    }

    async function inflar(bytes) {
      if (typeof DecompressionStream === "undefined") return null;
      var modos = ["deflate", "deflate-raw"];
      for (var i = 0; i < modos.length; i++) {
        try {
          var ds = new DecompressionStream(modos[i]);
          var flujo = new Blob([bytes]).stream().pipeThrough(ds);
          var salida = await new Response(flujo).arrayBuffer();
          if (salida && salida.byteLength) return new Uint8Array(salida);
        } catch (e) { }
      }
      return null;
    }

    /* ASCII85: lo usa reportlab y algun generador antiguo */
    function desAscii85(bytes) {
      var s = comoLatin1(bytes).replace(/\s/g, "");
      if (s.substr(0, 2) === "<~") s = s.substring(2);
      var fin = s.indexOf("~>");
      if (fin >= 0) s = s.substring(0, fin);
      var fuera = [], grupo = [], i;
      for (i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        if (c === "z" && !grupo.length) { fuera.push(0, 0, 0, 0); continue; }
        var n = s.charCodeAt(i) - 33;
        if (n < 0 || n > 84) continue;
        grupo.push(n);
        if (grupo.length === 5) {
          var v = 0;
          for (var k = 0; k < 5; k++) v = v * 85 + grupo[k];
          fuera.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
          grupo = [];
        }
      }
      if (grupo.length > 1) {
        var faltan = 5 - grupo.length;
        for (var q = 0; q < faltan; q++) grupo.push(84);
        var w = 0;
        for (var r = 0; r < 5; r++) w = w * 85 + grupo[r];
        var todos = [(w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255];
        for (var z = 0; z < 4 - faltan; z++) fuera.push(todos[z]);
      }
      return new Uint8Array(fuera);
    }

    function desAsciiHex(bytes) {
      var s = comoLatin1(bytes).replace(/[^0-9A-Fa-f]/g, "");
      if (s.length % 2) s += "0";
      var f = [];
      for (var i = 0; i < s.length; i += 2) f.push(parseInt(s.substr(i, 2), 16));
      return new Uint8Array(f);
    }

    /* ---- 1. trocear el fichero en objetos ---- */

    function objetosDelPdf(crudo, bytes) {
      var mapa = {};
      var re = /(\d+)\s+(\d+)\s+obj\b/g, m;
      while ((m = re.exec(crudo)) !== null) {
        var num = parseInt(m[1], 10);
        var desde = re.lastIndex;
        var fin = crudo.indexOf("endobj", desde);
        if (fin < 0) fin = crudo.length;

        var cuerpo = crudo.substring(desde, fin);
        var reg = { dict: cuerpo, flujo: null, flate: false };

        var s = cuerpo.indexOf("stream");
        if (s >= 0) {
          reg.dict = cuerpo.substring(0, s);
          var ini = desde + s + 6;
          if (crudo.charCodeAt(ini) === 13) ini++;
          if (crudo.charCodeAt(ini) === 10) ini++;
          var e = crudo.indexOf("endstream", ini);
          if (e > 0) {
            var f = e;
            if (crudo.charCodeAt(f - 1) === 10) f--;
            if (crudo.charCodeAt(f - 1) === 13) f--;
            reg.flujo = bytes.subarray(ini, f);
            /* los filtros van en orden: hay que deshacerlos igual */
            var mf = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(reg.dict);
            reg.filtros = [];
            if (mf) {
              var nn = mf[1].match(/\/([A-Za-z0-9]+)/g) || [];
              for (var w = 0; w < nn.length; w++) reg.filtros.push(nn[w].substring(1));
            }
            reg.flate = /FlateDecode/.test(reg.dict);
          }
        }
        mapa[num] = reg;
      }
      return mapa;
    }

    async function flujoDe(mapa, num) {
      var o = mapa[num];
      if (!o || !o.flujo) return null;
      var datos = o.flujo;
      var filtros = o.filtros && o.filtros.length ? o.filtros : (o.flate ? ["FlateDecode"] : []);
      for (var i = 0; i < filtros.length; i++) {
        var f = filtros[i];
        if (f === "FlateDecode") {
          datos = await inflar(datos);
          if (!datos) return null;
        } else if (f === "ASCII85Decode") {
          datos = desAscii85(datos);
        } else if (f === "ASCIIHexDecode") {
          datos = desAsciiHex(datos);
        } else if (f === "DCTDecode" || f === "JPXDecode" ||
                   f === "CCITTFaxDecode" || f === "JBIG2Decode") {
          return null;                      /* es una imagen: no hay letras */
        }
        /* LZWDecode y otros: no los sabemos deshacer, se deja como esta */
      }
      return datos;
    }

    /* ---- 2. leer diccionarios a lo basto pero seguro ---- */

    /* saca el trozo << ... >> que sigue a una clave */
    function subDic(dict, clave) {
      var i = dict.indexOf(clave);
      if (i < 0) return null;
      var j = dict.indexOf("<<", i);
      var ref = /^\s*(\d+)\s+\d+\s+R/.exec(dict.substring(i + clave.length));
      if (ref && (j < 0 || dict.substring(i + clave.length, j).trim().length)) {
        return { ref: parseInt(ref[1], 10) };
      }
      if (j < 0) return null;
      var hondo = 0, k = j;
      while (k < dict.length) {
        if (dict.substr(k, 2) === "<<") { hondo++; k += 2; continue; }
        if (dict.substr(k, 2) === ">>") { hondo--; k += 2; if (!hondo) break; continue; }
        k++;
      }
      return { texto: dict.substring(j, k) };
    }

    function refsDe(txt) {
      var fuera = [], re = /(\d+)\s+\d+\s+R/g, m;
      while ((m = re.exec(txt)) !== null) fuera.push(parseInt(m[1], 10));
      return fuera;
    }

    /* /F1 12 0 R  /F2 13 0 R  ->  {F1:12, F2:13} */
    function fuentesDe(txt) {
      var fuera = {}, re = /\/([A-Za-z0-9_.+-]+)\s+(\d+)\s+\d+\s+R/g, m;
      while ((m = re.exec(txt)) !== null) fuera[m[1]] = parseInt(m[2], 10);
      return fuera;
    }

    /* ---- 3. la tabla de letras de cada fuente (ToUnicode) ---- */

    function deHexPuro(h) {
      var s = "";
      for (var i = 0; i + 1 < h.length; i += 2) s += String.fromCharCode(parseInt(h.substr(i, 2), 16));
      return s;
    }
    function utf16be(h) {
      var s = "";
      for (var i = 0; i + 3 < h.length + 1; i += 4) {
        var n = parseInt(h.substr(i, 4), 16);
        if (!isNaN(n)) s += String.fromCharCode(n);
      }
      return s;
    }

    function leerCMap(texto) {
      var tabla = {}, anchoCodigo = 2;

      var rc = /beginbfchar([\s\S]*?)endbfchar/g, m;
      while ((m = rc.exec(texto)) !== null) {
        var par = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g, p;
        while ((p = par.exec(m[1])) !== null) {
          if (p[1].length <= 2) anchoCodigo = 1;
          tabla[parseInt(p[1], 16)] = utf16be(p[2]);
        }
      }

      var rr = /beginbfrange([\s\S]*?)endbfrange/g, r;
      while ((r = rr.exec(texto)) !== null) {
        var cuerpo = r[1];

        /* <a> <b> <destino> */
        var t1 = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g, a;
        while ((a = t1.exec(cuerpo)) !== null) {
          if (a[1].length <= 2) anchoCodigo = 1;
          var d = parseInt(a[1], 16), h = parseInt(a[2], 16);
          var base = utf16be(a[3]);
          if (h - d > 65535) continue;
          for (var c = d; c <= h; c++) {
            if (base.length === 1) tabla[c] = String.fromCharCode(base.charCodeAt(0) + (c - d));
            else tabla[c] = base;
          }
        }

        /* <a> <b> [ <x> <y> ... ] */
        var t2 = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g, b;
        while ((b = t2.exec(cuerpo)) !== null) {
          if (b[1].length <= 2) anchoCodigo = 1;
          var desde = parseInt(b[1], 16);
          var lista = b[3].match(/<([0-9A-Fa-f]+)>/g) || [];
          for (var i = 0; i < lista.length; i++) {
            tabla[desde + i] = utf16be(lista[i].replace(/[<>]/g, ""));
          }
        }
      }

      var cuantos = 0;
      for (var k in tabla) { cuantos++; if (cuantos > 3) break; }
      return cuantos ? { tabla: tabla, ancho: anchoCodigo } : null;
    }

    /* ---- 4. las letras del contenido ---- */

    var WINANSI = {
      128:"\u20AC",130:"\u201A",131:"\u0192",132:"\u201E",133:"\u2026",134:"\u2020",
      135:"\u2021",136:"\u02C6",137:"\u2030",138:"\u0160",139:"\u2039",140:"\u0152",
      142:"\u017D",145:"\u2018",146:"\u2019",147:"\u201C",148:"\u201D",149:"\u2022",
      150:"\u2013",151:"\u2014",152:"\u02DC",153:"\u2122",154:"\u0161",155:"\u203A",
      156:"\u0153",158:"\u017E",159:"\u0178"
    };
    function deWinAnsi(s) {
      var f = "";
      for (var i = 0; i < s.length; i++) {
        var n = s.charCodeAt(i);
        f += (n >= 128 && n <= 159 && WINANSI[n]) ? WINANSI[n] : String.fromCharCode(n);
      }
      return f;
    }

    function deEscape(s) {
      var f = "";
      for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        if (c !== "\\") { f += c; continue; }
        var d = s.charAt(++i);
        if (d === "n" || d === "r") f += "\n";
        else if (d === "t") f += "\t";
        else if (d === "b" || d === "f") f += " ";
        else if (d === "(" || d === ")" || d === "\\") f += d;
        else if (d >= "0" && d <= "7") {
          var oct = d;
          while (oct.length < 3) {
            var e = s.charAt(i + 1);
            if (e >= "0" && e <= "7") { oct += e; i++; } else break;
          }
          f += String.fromCharCode(parseInt(oct, 8));
        } else if (d === "\n") { }
        else f += d;
      }
      return f;
    }

    /* aplica la tabla de la fuente, si la hay */
    function traducir(cadena, cmap) {
      if (!cmap) return deWinAnsi(cadena);
      var f = "";
      if (cmap.ancho === 2) {
        for (var i = 0; i + 1 < cadena.length; i += 2) {
          var c = (cadena.charCodeAt(i) << 8) | cadena.charCodeAt(i + 1);
          f += (cmap.tabla[c] !== undefined) ? cmap.tabla[c] : "";
        }
        if (cadena.length % 2) {
          var u = cadena.charCodeAt(cadena.length - 1);
          if (cmap.tabla[u] !== undefined) f += cmap.tabla[u];
        }
      } else {
        for (var j = 0; j < cadena.length; j++) {
          var n = cadena.charCodeAt(j);
          f += (cmap.tabla[n] !== undefined) ? cmap.tabla[n] : String.fromCharCode(n);
        }
      }
      return f;
    }

    function letrasDelContenido(txt, cmaps) {
      var fuera = "", pendienteSalto = false, activa = null;
      var i = 0, n = txt.length;

      function suelta(s) {
        if (!s) return;
        if (pendienteSalto) { fuera += "\n"; pendienteSalto = false; }
        fuera += s;
      }

      while (i < n) {
        var c = txt.charAt(i);

        /* que fuente esta puesta:  /F1 11 Tf  */
        if (c === "/") {
          var mf = /^\/([A-Za-z0-9_.+-]+)\s+[\d.]+\s+Tf/.exec(txt.substring(i, i + 60));
          if (mf) { activa = cmaps[mf[1]] || null; i += mf[0].length; continue; }
        }

        if (c === "(") {
          var j = i + 1, hondo = 1, dentro = "";
          while (j < n) {
            var d = txt.charAt(j);
            if (d === "\\") { dentro += d + txt.charAt(j + 1); j += 2; continue; }
            if (d === "(") hondo++;
            if (d === ")") { hondo--; if (!hondo) break; }
            dentro += d; j++;
          }
          suelta(traducir(deEscape(dentro), activa));
          i = j + 1; continue;
        }

        /* << ... >> es un diccionario, no texto: saltarlo entero.
           Si no, cosas como <</MCID 0>> se leian como letras. */
        if (txt.substr(i, 2) === "<<") {
          var hondoD = 0, z = i;
          while (z < n) {
            if (txt.substr(z, 2) === "<<") { hondoD++; z += 2; continue; }
            if (txt.substr(z, 2) === ">>") { hondoD--; z += 2; if (!hondoD) break; continue; }
            z++;
          }
          i = z; continue;
        }

        if (c === "<") {
          var k = txt.indexOf(">", i);
          if (k < 0) break;
          var hx = txt.substring(i + 1, k).replace(/[^0-9A-Fa-f]/g, "");
          if (hx.length % 2) hx += "0";
          suelta(traducir(deHexPuro(hx), activa));
          i = k + 1; continue;
        }

        var dos = txt.substr(i, 2);

        /* Td mueve el cursor. Solo es renglon nuevo si baja de
           verdad; si el desplazamiento vertical es 0, sigue en la
           misma linea. Sin esto, los PDF que colocan letra a letra
           salian con un espacio entre cada letra. */
        if (dos === "Td" || dos === "TD") {
          var antes = txt.substring(Math.max(0, i - 40), i);
          var mv = /(-?[\d.]+)\s+(-?[\d.]+)\s*$/.exec(antes);
          if (!mv || parseFloat(mv[2]) !== 0) pendienteSalto = true;
          i += 2; continue;
        }
        if (dos === "T*") { pendienteSalto = true; i += 2; continue; }
        if (dos === "ET") { pendienteSalto = true; i += 2; continue; }
        i++;
      }
      return fuera;
    }

    /* ---- 5. juntarlo todo ---- */

    async function textoDelPdf(buffer) {
      var bytes = new Uint8Array(buffer);
      var crudo = comoLatin1(bytes);
      if (crudo.indexOf("%PDF") !== 0) throw new Error("no es un pdf");
      if (/\/Encrypt\s+\d+\s+\d+\s+R/.test(crudo)) {
        var err = new Error("con contrasenia"); err.motivo = "clave"; throw err;
      }

      var mapa = objetosDelPdf(crudo, bytes);

      /* objetos escondidos dentro de flujos comprimidos (ObjStm) */
      for (var num in mapa) {
        if (!/\/Type\s*\/ObjStm/.test(mapa[num].dict)) continue;
        var dentro = await flujoDe(mapa, num);
        if (!dentro) continue;
        var t = comoLatin1(dentro);
        var mN = /\/N\s+(\d+)/.exec(mapa[num].dict);
        var mP = /\/First\s+(\d+)/.exec(mapa[num].dict);
        if (!mN || !mP) continue;
        var cab = t.substring(0, parseInt(mP[1], 10)).trim().split(/\s+/);
        for (var q = 0; q < parseInt(mN[1], 10); q++) {
          var id = parseInt(cab[q * 2], 10);
          var off = parseInt(cab[q * 2 + 1], 10);
          var sig = (q + 1 < parseInt(mN[1], 10)) ? parseInt(cab[q * 2 + 3], 10) : (t.length - parseInt(mP[1], 10));
          if (isNaN(id) || isNaN(off)) continue;
          if (!mapa[id]) {
            mapa[id] = {
              dict: t.substr(parseInt(mP[1], 10) + off, sig - off),
              flujo: null, flate: false
            };
          }
        }
      }

      /* paginas */
      var paginas = [];
      for (var p in mapa) {
        if (/\/Type\s*\/Page\b/.test(mapa[p].dict)) paginas.push(parseInt(p, 10));
      }
      paginas.sort(function (a, b) { return a - b; });
      if (!paginas.length) return "";

      var partes = [];
      for (var x = 0; x < paginas.length; x++) {
        var pag = mapa[paginas[x]];

        /* recursos -> fuentes -> tablas de letras */
        var cmaps = {};
        var rec = subDic(pag.dict, "/Resources");
        var recTexto = null;
        if (rec && rec.texto) recTexto = rec.texto;
        else if (rec && rec.ref && mapa[rec.ref]) recTexto = mapa[rec.ref].dict;
        if (recTexto) {
          var fo = subDic(recTexto, "/Font");
          var foTexto = null;
          if (fo && fo.texto) foTexto = fo.texto;
          else if (fo && fo.ref && mapa[fo.ref]) foTexto = mapa[fo.ref].dict;
          if (foTexto) {
            var lista = fuentesDe(foTexto);
            for (var nombre in lista) {
              var fdef = mapa[lista[nombre]];
              if (!fdef) continue;
              var mtu = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(fdef.dict);
              if (!mtu) continue;
              var cm = await flujoDe(mapa, parseInt(mtu[1], 10));
              if (!cm) continue;
              var leido = leerCMap(comoLatin1(cm));
              if (leido) cmaps[nombre] = leido;
            }
          }
        }

        /* contenido */
        var cont = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(pag.dict);
        var ids = [];
        if (cont) ids = [parseInt(cont[1], 10)];
        else {
          var arr = /\/Contents\s*\[([^\]]*)\]/.exec(pag.dict);
          if (arr) ids = refsDe(arr[1]);
        }

        var junto = "";
        for (var y = 0; y < ids.length; y++) {
          var cb = await flujoDe(mapa, ids[y]);
          if (cb) junto += comoLatin1(cb) + "\n";
        }
        if (!junto) continue;

        var letras = letrasDelContenido(junto, cmaps);
        if (letras && letras.replace(/\s/g, "").length > 1) partes.push(letras);
      }

      return arreglarUtf8(partes.join("\n\n"));
    }

    /* Algunos PDF guardan la tabla de letras en UTF-8. Si no se
       deshace, las tildes salen como "\u00C3\u00B3" en vez de "o" acentuada. */
    /* al reves de WinAnsi: devuelve el byte que habia detras */
    var ALREVES = {};
    (function () { for (var n in WINANSI) ALREVES[WINANSI[n]] = parseInt(n, 10); })();
    function aByte(ch) {
      if (ALREVES[ch] !== undefined) return ALREVES[ch];
      var n = ch.charCodeAt(0);
      return n < 256 ? n : -1;
    }

    function arreglarUtf8(s) {
      ALREVES["\u200B"] = 0xAD;     /* guion blando: algunos lo ponen asi */

      /* Se prueba en una copia: se deshace WinAnsi para ver los
         bytes tal cual venian. Si NO resulta que era UTF-8, se
         devuelve el texto original sin tocar. Sin esto se perdia
         el simbolo del euro, que en WinAnsi es el byte 0x80. */
      var t = s.replace(/[\u2000-\u21FF\u0152\u0153\u0160\u0161\u017D\u017E\u0178\u0192\u02C6\u02DC]/g,
        function (ch) {
          var b = aByte(ch);
          return b >= 0 ? String.fromCharCode(b) : ch;
        });
      if (!/[\u00C2-\u00DF][\u0080-\u00BF]|[\u00E0-\u00EF][\u0080-\u00BF]{2}/.test(t)) return s;
      s = t;
      /* se arregla trozo a trozo: si una secuencia no es valida se
         deja como esta, en vez de estropear el resto del papel */
      return s.replace(
        /[\u00E0-\u00EF][\u0080-\u00BF]{2}|[\u00C2-\u00DF][\u0080-\u00BF]/g,
        function (t) {
          try {
            var b = new Uint8Array(t.length);
            for (var i = 0; i < t.length; i++) b[i] = t.charCodeAt(i);
            return new TextDecoder("utf-8", { fatal: true }).decode(b);
          } catch (e) { return t; }
        }
      );
    }

  function aseado(t) {
    return String(t || "")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /* ---------------- 6. pasarselo a la secretaria ---------------- */

  function caja()  { return document.getElementById("cha-txt"); }
  function envia() { return document.getElementById("cha-ir"); }

  function mandar(nombre, texto) {
    var c = caja(), b = envia();
    if (!c || !b) return false;
    var cuerpo = texto;
    var cortado = false;
    if (cuerpo.length > TOPE) { cuerpo = cuerpo.slice(0, TOPE); cortado = true; }
    c.value =
      "Te paso un expediente que se llama \"" + nombre + "\". " +
      "Léelo y dime lo que veas: qué papel es, de quién, fechas y plazos, " +
      "y sobre todo lo que falte o me pueda dar un disgusto." +
      (cortado ? " (Es largo: te paso el principio.)" : "") +
      "\n\n----- lo que pone el papel -----\n" + cuerpo;
    b.click();
    return true;
  }

  /* ---------------- 7. avisos ---------------- */

  var avisoAhora = null;
  function avisar(txt, mal) {
    var sitio = document.getElementById("lee-sitio");
    if (!sitio) return;
    if (!avisoAhora) {
      avisoAhora = document.createElement("div");
      sitio.appendChild(avisoAhora);
    }
    avisoAhora.className = "lee-aviso" + (mal ? " lee-mal" : "");
    avisoAhora.textContent = txt;
  }
  function quitarAviso() {
    if (avisoAhora && avisoAhora.parentNode) avisoAhora.parentNode.removeChild(avisoAhora);
    avisoAhora = null;
  }

  /* ---------------- 8. abrir un fichero ---------------- */

  async function abrir(fichero) {
    if (!fichero) return;
    var nombre = fichero.name || "expediente";
    var esPdf = /\.pdf$/i.test(nombre) || fichero.type === "application/pdf";
    var esTxt = /\.(txt|md|csv)$/i.test(nombre) || /^text\//.test(fichero.type || "");

    if (!esPdf && !esTxt) {
      avisar("De momento solo se leen PDF y ficheros de texto. " +
             "Si es un Word, guárdalo como PDF y te lo leo.", true);
      return;
    }

    avisar("Abriendo " + nombre + "...");

    try {
      var texto;
      if (esTxt) {
        texto = aseado(await fichero.text());
      } else {
        texto = aseado(await textoDelPdf(await fichero.arrayBuffer()));
      }

      if (!texto || texto.replace(/\s/g, "").length < 25) {
        avisar("Este PDF no lleva letras dentro: es una foto de un papel " +
               "escaneado. Yo solo puedo leer los que tienen texto. " +
               "Si tienes el original en Word o en PDF de verdad, pásamelo.", true);
        return;
      }

      if (mandar(nombre, texto)) {
        avisar("Leído: " + nombre + " (" + texto.length.toLocaleString("es-ES") +
               " letras). Se lo estoy pasando.");
        setTimeout(quitarAviso, 5000);
      } else {
        avisar("He leído el papel pero no encuentro el sitio donde escribirle.", true);
      }
    } catch (e) {
      if (e && e.motivo === "clave") {
        avisar("Ese PDF está protegido con contraseña y no puedo abrirlo.", true);
      } else {
        avisar("No he podido leer ese fichero. Si lo tienes en Word, " +
               "guárdalo como PDF y prueba otra vez.", true);
      }
    }
  }

  /* ---------------- 9. montarlo en la pagina ---------------- */

  var intentos = 0;
  function montar() {
    var c = caja();
    /* si en 30 segundos no hay chat en esta pagina, es que
       leer.js no pinta nada aqui: se calla y no gasta mas */
    if (!c) { if (++intentos < 42) setTimeout(montar, 700); return; }
    if (document.getElementById("lee-fila")) return;

    pintar();

    var fila = document.createElement("div");
    fila.className = "lee-fila";
    fila.id = "lee-fila";

    var oculto = document.createElement("input");
    oculto.type = "file";
    oculto.accept = ".pdf,.txt,.md,.csv,application/pdf,text/plain";
    oculto.style.display = "none";
    oculto.addEventListener("change", function () {
      if (oculto.files && oculto.files[0]) abrir(oculto.files[0]);
      oculto.value = "";
    });

    var boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = "Traer un expediente";
    boton.addEventListener("click", function (ev) { ev.preventDefault(); oculto.click(); });

    var nota = document.createElement("span");
    nota.className = "lee-nota";
    nota.textContent = "o arrastra aquí el PDF";

    var sitio = document.createElement("div");
    sitio.id = "lee-sitio";

    fila.appendChild(boton);
    fila.appendChild(nota);
    fila.appendChild(oculto);

    var donde = c.parentNode;
    donde.insertBefore(fila, c.nextSibling);
    donde.insertBefore(sitio, fila.nextSibling);

    /* arrastrar y soltar encima del chat */
    var zona = document.getElementById("cha-hilo") || donde;
    ["dragenter", "dragover"].forEach(function (n) {
      zona.addEventListener(n, function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        zona.classList.add("lee-encima");
      });
    });
    ["dragleave", "drop"].forEach(function (n) {
      zona.addEventListener(n, function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        zona.classList.remove("lee-encima");
      });
    });
    zona.addEventListener("drop", function (ev) {
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) abrir(f);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar);
  else montar();

  window.IMMOIA_LEER = {
    version: "1.0",
    textoDelPdf: textoDelPdf,
    abrir: abrir,
    montar: montar
  };
})();
