// Entry point. Part of the app.js split into native ES modules (no build step).

import { loadTenant, onTenant } from "./tenant.js";
import { initEstadosRed } from "./estados.js";
import { initEfectos, revelar } from "./mod/efectos.js";
import { E } from "./mod/estado.js";
import { $ } from "./mod/util.js";
import { applyRoute, barraOff, barraOn, errorBox, initDatosNav, navigate, pathFor, tabs } from "./mod/nav.js";
import { initMapas } from "./mod/mapa.js";
import { initComparar } from "./mod/comparar.js";
import { initDatos, initMeto } from "./mod/paginas.js";
import { initAsistente } from "./mod/escucha.js";
import { initAtajos, initGlosario, renderMetodoExtra } from "./mod/metodologia.js";
import { initRetro, initSolicitud } from "./mod/formularios.js";
import { initPalette, initProvLista } from "./mod/inicio.js";
import { initExtras, initMapTools } from "./mod/descargas.js";
import { applyFlags } from "./mod/flags.js";
import { renderInventario } from "./mod/diccionario.js";
import { initBorradores, initSubir } from "./mod/ayudas.js";

addEventListener("popstate", applyRoute);

document.querySelectorAll("nav button[data-v]").forEach((b) => {
  b.addEventListener("click", () => navigate(pathFor(b.dataset.v)));
});

// "Comparar provincias" is easy to miss: its tab pulses until it is used once
const tabCmp = document.querySelector('nav button[data-v="comparar"]');
const vioComparar = () => {
  try {
    return localStorage.getItem("ovade.vioComparar") === "1";
  } catch (_) {
    return false;
  }
};
if (tabCmp && !vioComparar()) {
  tabCmp.classList.add("nuevo");
  tabCmp.addEventListener("click", () => {
    tabCmp.classList.remove("nuevo");
    try {
      localStorage.setItem("ovade.vioComparar", "1");
    } catch (_) {}
  });
}

document.querySelectorAll("nav > button").forEach((b) => {
  b.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const list = tabs();
    list[(list.indexOf(b) + step + list.length) % list.length].focus();
    e.preventDefault();
  });
});

addEventListener("ovade:busy", () => {
  E.enVuelo++;
  barraOn();
});

addEventListener("ovade:idle", () => {
  E.enVuelo = Math.max(0, E.enVuelo - 1);
  if (!E.enVuelo) barraOff();
});

// printing the kit should show everything, not only the open sections
addEventListener("beforeprint", () => document.querySelectorAll("details.sec, details.a-fondo, details.ver").forEach((d) => (d.open = true)));

onTenant(applyFlags);

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
(async function init() {
  initEfectos();
  initEstadosRed();
  const tenantReady = loadTenant();
  try {
    await initMapas();
    initProvLista();
    revelar(document.querySelectorAll("#map-sel .pvs"), { desde: "random", cuanto: 0.6 });
    revelar(document.querySelectorAll("#provLista .pl-item"), { cuanto: 0.35 });
    document.querySelectorAll("[data-loading]").forEach((e) => e.removeAttribute("data-loading"));
    $("provLista")?.removeAttribute("aria-busy");
    initComparar();
    initDatos();
    initMeto();
    initAsistente();
    initPalette();
    initSolicitud();
    initRetro();
    initBorradores();
    initSubir();
    initDatosNav();
    initExtras();
    initMapTools();
    initAtajos(initGlosario());
    renderMetodoExtra();
    renderInventario();
    await tenantReady;
    applyFlags();
    applyRoute();
  } catch (e) {
    // nothing drew: replace the grey placeholders by what happened and the next step
    document.querySelectorAll("[data-loading]").forEach((x) => x.removeAttribute("data-loading"));
    $("provLista").innerHTML = "";
    errorBox($("perfil"), "No pudimos cargar los datos del observatorio. Puede ser tu conexión o que el servidor esté despertando.", () => location.reload());
  }
})();
