// Module: nav. Part of the app.js split into native ES modules (no build step).

import { flag } from "../tenant.js";
import { esc } from "../ui.js";
import { E } from "./estado.js";
import { $, provinceKey } from "./util.js";
import { DATOS_LABEL, DATOS_VIEWS, VIEW_FLAG, enc } from "./datos.js";
import { capaEnabled, capasAll, paintMap, renderCapas } from "./mapa.js";
import { loadPerfil } from "./kit.js";
import { renderCmp } from "./comparar.js";
import { pedirOpinion } from "./formularios.js";
import { renderInicio } from "./inicio.js";
import { entradaVista, pop } from "./efectos.js";

export const viewEnabled = (v) => v in VIEW_FLAG && flag(VIEW_FLAG[v]);

export function showView(v) {
  if (!viewEnabled(v)) v = "perfil";
  const cambio = v !== E.currentView;
  if (cambio) pulsoBarra();
  E.currentView = v;
  document.querySelectorAll("header nav button").forEach((b) => {
    const on = b.dataset.v === v;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  // "Sobre los datos" lives outside the main tabs: it is consulted, not worked in
  $("btnSobreDatos").classList.toggle("on", DATOS_VIEWS.includes(v));
  document.querySelectorAll(".datos-nav [data-ir]").forEach((b) => b.setAttribute("aria-current", b.dataset.ir === v ? "page" : "false"));
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("on", el.id === "v-" + v));
  if (cambio) entradaVista($("v-" + v));
}

export function initDatosNav() {
  for (const v of DATOS_VIEWS) {
    const nav = document.createElement("div");
    nav.className = "datos-nav noprint";
    nav.setAttribute("role", "navigation");
    nav.setAttribute("aria-label", "Sobre los datos");
    nav.innerHTML = `<div class="dn-top"><p class="dn-k">Sobre los datos</p><button type="button" class="linkbtn" data-ir="perfil">← Volver a preparar mi nota</button></div>
     <p class="dn-sub">De dónde sale cada cifra, cómo se calcula y qué no puede afirmar.</p>
     <div class="dn-tabs">${DATOS_VIEWS.map((x) => `<button type="button" data-ir="${x}">${DATOS_LABEL[x]}</button>`).join("")}</div>`;
    $("v-" + v).prepend(nav);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ir]");
    if (b) navigate(pathFor(b.dataset.ir));
    const r = e.target.closest("[data-ruta]");
    if (r) navigate(r.dataset.ruta);
  });
}

export function pathFor(v) {
  if (v === "mapas") return `mapas/${E.capa}`;
  if (v === "perfil") return E.perfilActual ? `perfil/${enc(E.perfilActual)}` : "perfil";
  if (v === "comparar") return `comparar/${enc($("cmpA").value)}/${enc($("cmpB").value)}`;
  return v;
}

export function navigate(path, { replace = false } = {}) {
  const before = E.currentView;
  history[replace ? "replaceState" : "pushState"](null, "", location.pathname + location.search + "#" + path);
  applyRoute();
  if (before !== E.currentView) window.scrollTo(0, 0);
}

export function applyRoute() {
  let parts = [];
  try {
    parts = location.hash.slice(1).split("/").map(decodeURIComponent);
  } catch (_) {}
  const [v = "perfil", a, b] = parts;
  showView(v);
  if (E.currentView === "mapas" && a && E.MAPA && capasAll().some((c) => c.codigo === a && capaEnabled(c)) && a !== E.capa) {
    E.capa = a;
    renderCapas();
    paintMap();
  }
  if (E.currentView === "perfil" && a && E.PROVINCIAS.length) {
    const p = E.PROVINCIAS.find((x) => provinceKey(x) === provinceKey(a));
    if (p && p !== E.perfilActual) loadPerfil(p);
  }
  if (E.currentView === "perfil" && !a && E.PROVINCIAS.length && (E.perfilActual || $("perfil").querySelector(".sk") || !$("perfil").innerHTML.trim())) renderInicio();
  if (E.currentView === "comparar" && a && b && E.PROVINCIAS.length) {
    const pa = E.PROVINCIAS.find((x) => provinceKey(x) === provinceKey(a));
    const pb = E.PROVINCIAS.find((x) => provinceKey(x) === provinceKey(b));
    if (pa && pb && ($("cmpA").value !== pa || $("cmpB").value !== pb)) {
      $("cmpA").value = pa;
      $("cmpB").value = pb;
      renderCmp();
    }
  }
}

export const tabs = () => [...document.querySelectorAll("nav > button:not([hidden])")];

export function barraOn() {
  const b = $("progress");
  clearTimeout(E.barTimer);
  b.classList.remove("done");
  b.classList.add("on");
}

export function barraOff() {
  const b = $("progress");
  b.classList.add("done");
  E.barTimer = setTimeout(() => b.classList.remove("on", "done"), 450);
}

function pulsoBarra() {
  if (E.enVuelo) return;
  barraOn();
  setTimeout(() => !E.enVuelo && barraOff(), 220);
}

export function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(E.toastTimer);
  E.toastTimer = setTimeout(() => t.classList.remove("on"), 3200);
}

// Copy with feedback where the eyes already are: the button says "Copiado".
// `contexto` marks copies worth asking about («¿Te sirvió?»), e.g. a quote.
export async function copiarBtn(btn, texto, contexto) {
  const ok = await copyText(texto);
  if (!ok) return toast("No se pudo copiar. Selecciona el texto y cópialo a mano.");
  if (contexto) pedirOpinion(contexto);
  const prev = btn.dataset.label || btn.textContent;
  btn.dataset.label = prev;
  btn.textContent = "Copiado ✓";
  btn.classList.add("done");
  pop(btn);
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    btn.textContent = prev;
    btn.classList.remove("done");
  }, 1600);
}

// An error that says what failed and offers the next step.
export function errorBox(target, msg, retry) {
  target.innerHTML = `<div class="err" role="alert"><span>${esc(msg)}</span><button class="btn gh" type="button">Reintentar</button></div>`;
  target.querySelector("button").onclick = retry;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_) {}
    ta.remove();
    return ok;
  }
}
