// Provisional access gate: one shared key, checked in the browser only.
// It keeps casual visitors out while the site is in testing; it is NOT security
// (anyone who reads this file can get past it). Remove the <script> and the
// inline check in app/layout.js, plus #puerta in app/cuerpo.html, to open the site.
//
// The key is never stored in clear: we keep only its SHA-256 and compare hashes.
// Changing the key = replacing CLAVE_SHA256 (printf '%s' 'nueva' | sha256sum).
(function () {
  "use strict";

  var CLAVE_SHA256 = "00a16e1724d577adf9f1cafa65c5beb1d5404bde8a2cca5095865fa8101a6503";
  var LLAVE = "ovade.acceso";
  var raiz = document.documentElement;

  function guardar(valor) {
    try { localStorage.setItem(LLAVE, valor); } catch (e) {
      try { sessionStorage.setItem(LLAVE, valor); } catch (e2) { /* private mode: lasts this page only */ }
    }
  }

  function hex(buffer) {
    var b = new Uint8Array(buffer), s = "";
    for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? "0" : "") + b[i].toString(16);
    return s;
  }

  function sha256(texto) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("sin-crypto"));
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)).then(hex);
  }

  function iniciar() {
    if (raiz.dataset.acceso !== "bloqueado") return;
    var puerta = document.getElementById("puerta");
    if (!puerta) { raiz.removeAttribute("data-acceso"); return; }

    var form = puerta.querySelector("form");
    var campo = document.getElementById("puertaClave");
    var aviso = document.getElementById("puertaAviso");
    var ver = document.getElementById("puertaVer");
    var boton = form.querySelector("button[type=submit]");

    // Everything except the gate is out of reach (keyboard, screen readers, clicks).
    var hermanos = Array.prototype.filter.call(puerta.parentNode.children, function (el) { return el !== puerta; });
    hermanos.forEach(function (el) { el.setAttribute("inert", ""); });

    // The app listens for / , Ctrl+K and Esc on the whole page: keep them inside the gate.
    function guardia(e) {
      if (raiz.dataset.acceso !== "bloqueado") return;
      if (!puerta.contains(e.target) || e.key === "Escape") {
        e.stopImmediatePropagation();
        if (!puerta.contains(e.target)) { e.preventDefault(); campo.focus(); }
      }
    }
    document.addEventListener("keydown", guardia, true);

    function mostrarError(texto) {
      aviso.textContent = texto;
      campo.setAttribute("aria-invalid", "true");
      puerta.classList.remove("pt-error");
      void puerta.offsetWidth; // restart the shake
      puerta.classList.add("pt-error");
      campo.select();
    }

    ver.addEventListener("click", function () {
      var oculto = campo.type === "password";
      campo.type = oculto ? "text" : "password";
      ver.setAttribute("aria-pressed", String(oculto));
      ver.textContent = oculto ? "Ocultar" : "Mostrar";
      campo.focus();
    });

    campo.addEventListener("input", function () {
      if (aviso.textContent) { aviso.textContent = ""; campo.removeAttribute("aria-invalid"); }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var valor = campo.value.trim();
      if (!valor) { mostrarError("Escribe la clave de acceso."); return; }
      boton.disabled = true;
      boton.textContent = "Comprobando…";
      sha256(valor).then(function (h) {
        if (h !== CLAVE_SHA256) {
          mostrarError("Esa clave no es correcta. Revisa mayúsculas y guiones.");
          return;
        }
        guardar(h);
        hermanos.forEach(function (el) { el.removeAttribute("inert"); });
        document.removeEventListener("keydown", guardia, true);
        puerta.classList.add("pt-sale");
        setTimeout(function () {
          raiz.removeAttribute("data-acceso");
          var main = document.getElementById("main");
          if (main) main.focus({ preventScroll: true });
        }, 260);
      }).catch(function () {
        mostrarError("Este navegador no pudo comprobar la clave. Abre el sitio con https o en otro navegador.");
      }).then(function () {
        boton.disabled = false;
        boton.textContent = "Ingresar";
      });
    });

    campo.focus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
