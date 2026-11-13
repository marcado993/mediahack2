// Access by licence. The key is checked by the backend (/api/licencia), never in this file, and the
// backend decides when a licence ends. This browser keeps only a session token and the licence's end
// date, so the gate can close before the first paint (app/layout.js) and again when the time comes.
//
// On every load the token is checked again: a licence that was suspended or expired closes the site
// on the next visit, whatever is stored here.
(function () {
  "use strict";

  var LLAVE = "ovade.licencia";

  // Bridge while the production backend has no /api/licencia yet (it answers 404): the provisional
  // key, same SHA-256 and same end date the backend seeds (backend/app/licencias.py). Once the backend
  // is updated, the server answers and this branch is never used again. Remove it after that.
  var PUENTE = {
    hash: "00a16e1724d577adf9f1cafa65c5beb1d5404bde8a2cca5095865fa8101a6503",
    medio: "Acceso provisional del equipo",
    vence: "2026-11-13T23:59:59-05:00",
    vence_texto: "13 de noviembre de 2026 a las 23:59",
  };
  function sha256(texto) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("sin-crypto"));
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
    });
  }
  function porPuente(valor) {
    return sha256(valor).then(function (h) {
      if (h !== PUENTE.hash) return { ok: false, estado: 401, cuerpo: { detail: "Esa clave no es correcta. Revisa mayúsculas y guiones." } };
      if (Date.parse(PUENTE.vence) <= Date.now()) return { ok: false, estado: 403, cuerpo: { detail: "La licencia de " + PUENTE.medio + " venció el " + PUENTE.vence_texto + ". Pide al equipo de OVADE que la renueve." } };
      return { ok: true, estado: 200, cuerpo: { ficha: "puente", medio: PUENTE.medio, vence: PUENTE.vence, vence_texto: PUENTE.vence_texto } };
    });
  }
  var raiz = document.documentElement;

  // Same rule as assets/api.js (this file is a plain script, it cannot import it).
  var API = (function () {
    try {
      var u = new URL(new URLSearchParams(location.search).get("api") || "");
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || /\.apiprueba\.online$/.test(u.hostname)) return u.origin;
    } catch (e) {}
    if (window.MEDIAHACK_API_BASE) return window.MEDIAHACK_API_BASE;
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return "http://localhost:8000";
    return "https://mediahack-api.apiprueba.online";
  })();

  function leer() {
    try {
      return JSON.parse(localStorage.getItem(LLAVE) || "null");
    } catch (e) {
      return null;
    }
  }
  function guardar(v) {
    try {
      v ? localStorage.setItem(LLAVE, JSON.stringify(v)) : localStorage.removeItem(LLAVE);
      localStorage.removeItem("ovade.acceso"); // the old hard-coded key, no longer used
    } catch (e) {}
  }

  function pedir(ruta, opciones) {
    return fetch(API + "/api/licencia" + ruta, opciones).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (cuerpo) {
        return { ok: r.ok, estado: r.status, cuerpo: cuerpo };
      });
    });
  }

  var puerta, form, campo, aviso, boton, hermanos, temporizador;

  /* ---- closing and opening ---- */
  function guardia(e) {
    if (raiz.dataset.acceso !== "bloqueado" || !puerta) return;
    if (!puerta.contains(e.target) || e.key === "Escape") {
      e.stopImmediatePropagation();
      if (!puerta.contains(e.target)) { e.preventDefault(); campo.focus(); }
    }
  }

  function cerrar(texto) {
    raiz.dataset.acceso = "bloqueado";
    if (!puerta) return;
    puerta.classList.remove("pt-sale");
    hermanos.forEach(function (el) { el.setAttribute("inert", ""); });
    if (texto) {
      aviso.textContent = texto;
      aviso.dataset.tono = "info";
    }
    campo.focus();
  }

  function abrir(sesion) {
    hermanos.forEach(function (el) { el.removeAttribute("inert"); });
    puerta.classList.add("pt-sale");
    setTimeout(function () {
      raiz.removeAttribute("data-acceso");
      var main = document.getElementById("main");
      if (main && puerta.contains(document.activeElement)) main.focus({ preventScroll: true });
    }, 260);
    programarCierre(sesion);
    avisoPorVencer(sesion);
  }

  /** Closes the site by itself at the licence's end, even if the page stays open. */
  function programarCierre(sesion) {
    clearTimeout(temporizador);
    var falta = Date.parse(sesion.vence) - Date.now();
    if (!(falta > 0)) return;
    temporizador = setTimeout(function () {
      guardar(null);
      cerrar("Tu licencia venció el " + sesion.vence_texto + ". Pide al equipo que la renueve.");
    }, Math.min(falta, 2147483000));
  }

  /** A quiet notice when less than a day is left, so the end never comes as a surprise. */
  function avisoPorVencer(sesion) {
    var falta = Date.parse(sesion.vence) - Date.now();
    var viejo = document.getElementById("licAviso");
    if (viejo) viejo.remove();
    if (!(falta > 0) || falta > 24 * 3600 * 1000) return;
    var p = document.createElement("p");
    p.id = "licAviso";
    p.className = "lic-aviso";
    p.setAttribute("role", "status");
    p.textContent = "Tu acceso de " + sesion.medio + " vence el " + sesion.vence_texto + ".";
    var cerrarAviso = document.createElement("button");
    cerrarAviso.type = "button";
    cerrarAviso.textContent = "Entendido";
    cerrarAviso.onclick = function () { p.remove(); };
    p.appendChild(cerrarAviso);
    document.body.appendChild(p);
  }

  function mostrarError(texto) {
    aviso.textContent = texto;
    aviso.dataset.tono = "error";
    campo.setAttribute("aria-invalid", "true");
    puerta.classList.remove("pt-error");
    void puerta.offsetWidth; // restart the shake
    puerta.classList.add("pt-error");
    campo.select();
  }

  /* ---- start ---- */
  function iniciar() {
    puerta = document.getElementById("puerta");
    if (!puerta) { raiz.removeAttribute("data-acceso"); return; }
    form = puerta.querySelector("form");
    campo = document.getElementById("puertaClave");
    aviso = document.getElementById("puertaAviso");
    boton = form.querySelector("button[type=submit]");
    hermanos = Array.prototype.filter.call(puerta.parentNode.children, function (el) { return el !== puerta; });
    document.addEventListener("keydown", guardia, true);

    var ver = document.getElementById("puertaVer");
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
      if (!valor) { mostrarError("Escribe la clave de licencia."); return; }
      boton.disabled = true;
      boton.textContent = "Comprobando…";
      pedir("/entrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave: valor }) })
        .then(function (r) {
          return r.estado === 404 ? porPuente(valor) : r; // backend not updated yet
        })
        .then(function (r) {
          if (!r.ok) return mostrarError(r.cuerpo.detail || "No se pudo comprobar la clave. Vuelve a intentar.");
          var c = r.cuerpo;
          var sesion = { ficha: c.ficha, medio: c.medio, vence: c.vence, vence_texto: c.vence_texto };
          guardar(sesion);
          campo.value = "";
          abrir(sesion);
        })
        .catch(function () {
          mostrarError("No hay conexión con el servidor. Revisa tu internet y vuelve a intentar.");
        })
        .then(function () {
          boton.disabled = false;
          boton.textContent = "Ingresar";
        });
    });

    var sesion = leer();
    if (raiz.dataset.acceso === "bloqueado" || !sesion || !sesion.ficha) {
      if (sesion && sesion.vence_texto && Date.parse(sesion.vence) <= Date.now()) {
        guardar(null);
        cerrar("Tu licencia venció el " + sesion.vence_texto + ". Pide al equipo que la renueve.");
      } else cerrar();
      return;
    }
    // The page opened with a stored session: check it with the server in the background.
    hermanos.forEach(function (el) { el.removeAttribute("inert"); });
    programarCierre(sesion);
    avisoPorVencer(sesion);
    pedir("", { headers: { Authorization: "Bearer " + sesion.ficha } })
      .then(function (r) {
        // backend not updated yet: a bridge session lasts until its end date (programarCierre handles it)
        if (r.estado === 404 && sesion.ficha === "puente") return;
        if (r.ok) {
          var c = r.cuerpo;
          var nueva = { ficha: sesion.ficha, medio: c.medio, vence: c.vence, vence_texto: c.vence_texto };
          guardar(nueva); // the team may have extended or shortened the licence
          programarCierre(nueva);
          avisoPorVencer(nueva);
        } else if (r.estado === 401 || r.estado === 403) {
          guardar(null);
          cerrar(r.cuerpo.detail || "Tu acceso se cerró. Escribe de nuevo la clave de licencia.");
        }
        // other answers (server down): keep the site open until the stored end date
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
