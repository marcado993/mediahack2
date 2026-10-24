// Module: inicio. Part of the app.js split into native ES modules (no build step).

import { getJSON } from "../api.js";
import { flag } from "../tenant.js";
import { skTable } from "../estados.js";
import { MARGEN_GENERAL, esc, fmt, ICON, provinceFlags, scoreRange, vacioFlecha } from "../ui.js";
import { E } from "./estado.js";
import { $, provinceKey } from "./util.js";
import { DECISIONES, RAMP, RECIENTES_KEY, SIN_RESULTADOS, enc, esLimite, perfilColor, perfilPlano } from "./datos.js";
import { col, indicatorRange, inkFor } from "./color.js";
import { applyRoute, copiarBtn, errorBox, navigate, toast } from "./nav.js";
import { tipHide, tipMove, tipShow } from "./tooltip.js";
import { byKey, paintMap } from "./mapa.js";
import { citaDeRegistro, driversHTML, goToPerfil, reliability } from "./kit.js";
import { compareText, deltaTableHTML } from "./comparar.js";
import { entradaKit } from "./efectos.js";
import { LIMITE_TEMAS, agregarTema, provinciasQueSigo, quitarTema, temasQueSigo } from "./seguimiento.js";

// ---------------------------------------------------------------------
// Map selection: tap a province and its essentials appear beside the map,
// without leaving it. The full profile is one more click away.
// ---------------------------------------------------------------------
// The press-kit button always says whose quote it will copy.
function syncKit(p) {
  const b = $("btnCitaMapa");
  b.dataset.label = p ? `Copiar cita de ${p.provincia}` : "Copiar cita";
  b.textContent = b.dataset.label;
  $("kitNota").textContent = p
    ? `Incluye fuente${p.n_lb != null && p.n_lb < 50 ? " y la precaución editorial de esta provincia" : ""}. Pega directo en tu nota.`
    : "Elige una provincia en el mapa para copiar su cita lista para prensa.";
}

export function renderPeek() {
  const box = $("peek");
  const p = E.mapSel ? byKey()[E.mapSel] : null;
  syncKit(p);
  if (!p) {
    box.innerHTML = vacioFlecha({ titulo: "Toca una provincia", texto: "En el mapa o en el ranking. Aquí verás lo esencial, sin salir del mapa." });
    return;
  }
  const conf = reliability(p.n_lb);
  const bg = col("IVEI", p.IVEI);
  box.innerHTML = `
  <div class="peek-top">
   <div><h2>${esc(p.provincia)}</h2>
    <p class="peek-sub"><span class="pdot" style="background:${perfilColor(p.perfil)}"></span>${esc(perfilPlano(p.perfil))}</p></div>
   <div class="peek-num"><span class="big">${fmt(p.IVEI)}</span><span class="pill" style="background:${bg};color:${inkFor(bg)}">${esc(p.nivel)}</span>${scoreRange({})}</div>
  </div>
  <p class="note" style="margin:6px 0 10px">Puesto ${Math.round(p.rank)} de 24 (1 = la más vulnerable) · promedio del país ${fmt(E.MAPA.nacional.IVEI)}</p>
  <div class="ptags">${provinceFlags({ isImputed: p.n_lb === 0, isBorderlineCase: esLimite(p.provincia) })}</div>
  <h3>Lo que más pesa</h3>
  ${driversHTML(p)}
  ${conf ? `<p style="margin:10px 0 0"><span class="conf ${conf.cls}">${esc(conf.label)}</span></p>` : ""}
  <div class="peek-actions">
   <button class="btn" type="button" id="peekPerfil">Preparar nota sobre ${esc(p.provincia)}</button>
   ${flag("cita_lista") ? `<button class="btn gh" type="button" id="peekCita">Copiar cita</button>` : ""}
   <button class="linkbtn" type="button" id="peekCerrar">Quitar selección</button>
  </div>`;
  $("peekCerrar").onclick = () => {
    E.mapSel = null;
    paintMap();
  };
  $("peekPerfil").onclick = () => goToPerfil(p.provincia);
  if ($("peekCita")) $("peekCita").onclick = (e) => copiarBtn(e.currentTarget, citaDeRegistro(p), "cita_resumen");
}

export function selectProvince(name) {
  E.mapSel = provinceKey(name);
  paintMap();
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("peek").scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
}

function recientes() {
  try {
    return JSON.parse(localStorage.getItem(RECIENTES_KEY) || "[]").filter((p) => E.PROVINCIAS.includes(p));
  } catch (_) {
    return [];
  }
}

export function recordarReciente(p) {
  try {
    localStorage.setItem(RECIENTES_KEY, JSON.stringify([p, ...recientes().filter((x) => x !== p)].slice(0, 4)));
  } catch (_) {}
}

function provItem(p) {
  const r = byKey()[provinceKey(p)] ?? {};
  const marks = (r.n_lb === 0 ? `<span class="pl-ic is-warn" title="Valor imputado">${ICON.warn}</span>` : "") + (esLimite(p) ? `<span class="pl-ic is-pin" title="Caso limítrofe">${ICON.pin}</span>` : "");
  return `<button type="button" role="listitem" class="pl-item${p === E.perfilActual ? " on" : ""}" data-p="${esc(p)}"><span class="dot" style="background:${col("IVEI", r.IVEI)}"></span><span class="pl-n">${esc(p)}</span>${marks}<span class="pl-r" title="Puesto entre 24 (1 = la más vulnerable)">${Math.round(r.rank)}</span></button>`;
}

// Closest province names for a typo ("guallas", "pichinca"): edit distance on
// the accent-free keys, so the reporter never hits a dead end.
function sugerir(texto, max = 3) {
  const q = provinceKey((texto || "").trim());
  if (!q) return [];
  const dist = (a, b) => {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  };
  return E.PROVINCIAS.map((p) => {
    const k = provinceKey(p);
    return { p, d: Math.min(dist(q, k), dist(q, k.slice(0, q.length + 1))) };
  })
    .filter((x) => x.d <= Math.max(2, Math.floor(q.length / 3)))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((x) => x.p);
}

export function renderProvLista() {
  paintSel();
  const q = provinceKey($("provFiltro").value.trim());
  const rec = recientes();
  $("provRecientes").innerHTML = rec.length && !q ? `<span class="pl-h">Recientes</span>${rec.map(provItem).join("")}<span class="pl-h">Todas</span>` : "";
  const list = [...E.PROVINCIAS].sort((a, b) => a.localeCompare(b, "es")).filter((p) => !q || provinceKey(p).includes(q));
  if (list.length) {
    $("provLista").innerHTML = list.map(provItem).join("");
    return;
  }
  const raw = $("provFiltro").value.trim();
  const sug = sugerir(raw);
  $("provLista").innerHTML =
    `<p class="note sin-res"><b>No encontramos «${esc(raw)}».</b> ${sug.length ? "¿Quisiste decir…?" : SIN_RESULTADOS}</p>` +
    sug.map(provItem).join("") +
    `<button type="button" class="linkbtn" id="btnLimpiarFiltro">Ver todas las provincias</button>`;
  $("btnLimpiarFiltro").onclick = () => {
    $("provFiltro").value = "";
    renderProvLista();
    $("provFiltro").focus();
  };
}

export function initProvLista() {
  drawSelMap($("map-sel"), E.PATHS.mainland);
  drawSelMap($("map-sel-gal"), E.PATHS.galapagos);
  const filtro = $("provFiltro");
  filtro.oninput = renderProvLista;
  filtro.onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const first = $("provLista").querySelector(".pl-item");
    if (first) goToPerfil(first.dataset.p);
  };
  const pick = (e) => {
    const b = e.target.closest(".pl-item");
    if (b) goToPerfil(b.dataset.p);
  };
  $("provLista").onclick = pick;
  $("provRecientes").onclick = pick;
  $("btnInicio").onclick = () => {
    history.pushState(null, "", location.pathname + location.search + "#perfil");
    applyRoute();
  };
  renderProvLista();
}

// Nothing chosen yet: the two other tasks, open, plus what the index can and cannot back.
// What the index backs and what it does not, one decision per row: readable at any width.
function criterioLista() {
  return `<ul class="criterio">${DECISIONES.map(([d, si, no]) => {
    const apoya = !/^No\b/.test(si);
    return `<li><b>${esc(d)}</b>${apoya ? `<p class="c-si">${ICON.check}<span>${esc(si)}</span></p>` : si !== "No." ? `<p class="c-nota">${esc(si)}</p>` : ""}<p class="c-no">${ICON.cross}<span>${esc(no)}</span></p></li>`;
  }).join("")}</ul>`;
}

// What a reporter can do here, as three tasks they can start with one tap.
const TAREAS = [
  ["Encuentra por qué Bolívar es vulnerable", "perfil/" + enc("Bolívar")],
  ["Compara Guayas y Pichincha", "comparar/" + enc("Guayas") + "/" + enc("Pichincha")],
  ["Revisa qué tan firme es una cifra", "meto"],
];

function guiaHTML() {
  return `<section class="card guia" aria-labelledby="guiaTit"><h2 id="guiaTit">Empieza por aquí</h2>
   <p class="guia-lee">El puntaje va de 0 a 100: más alto, más vulnerable. Compara provincias entre sí y puede variar ${esc(MARGEN_GENERAL)}.</p>
   <ul class="guia-tareas">${TAREAS.map(([t, ruta]) => `<li><button type="button" class="btn gh" data-ruta="${esc(ruta)}">${esc(t)}</button><span class="ptag ej">Ejemplo</span></li>`).join("")}</ul>
  </section>`;
}

function siguiendoHTML() {
  const provs = provinciasQueSigo();
  const temas = temasQueSigo();
  const vacio = !provs.length && !temas.length;
  return `<section class="card sigo" aria-labelledby="sigoTit"><h2 id="sigoTit">Lo que sigues</h2>
   ${vacio ? `<p class="note" style="margin:4px 0 10px">Aún no sigues nada. Abre una provincia y pulsa «Seguir esta provincia», o escribe un tema.</p>` : ""}
   <div class="sigo-chips">${provs.map((p) => `<a class="chip" href="#perfil/${enc(p)}">${esc(p)}</a>`).join("")}${temas
     .map((t) => `<span class="chip tema">${esc(t)}<button type="button" class="chip-x" data-quitar="${esc(t)}" aria-label="Dejar de seguir ${esc(t)}">×</button></span>`)
     .join("")}</div>
   <form class="sigo-form" id="formTema"><label class="sr" for="temaNuevo">Tema o narrativa que sigues</label>
    <input id="temaNuevo" type="text" maxlength="60" placeholder="Un tema o narrativa, por ejemplo: fraude" autocomplete="off"${temas.length >= LIMITE_TEMAS ? " disabled" : ""}>
    <button class="btn gh" type="submit"${temas.length >= LIMITE_TEMAS ? " disabled" : ""}>Seguir tema</button></form>
   <p class="note" style="margin:8px 0 0">Se guarda en este navegador.</p>
  </section>`;
}

function bindInicio() {
  const raiz = $("perfil");
  raiz.querySelectorAll("[data-quitar]").forEach((b) => (b.onclick = () => {
      const t = b.dataset.quitar;
      quitarTema(t);
      refrescarSigo();
      toast(`Dejaste de seguir «${t}».`, { texto: "Deshacer", fn: () => (agregarTema(t), refrescarSigo()) });
    }));
  const f = $("formTema");
  if (f) f.onsubmit = (e) => (e.preventDefault(), agregarTema($("temaNuevo").value), refrescarSigo());
}

function refrescarSigo() {
  const caja = document.querySelector("#perfil .sigo");
  if (!caja) return;
  caja.outerHTML = siguiendoHTML();
  bindInicio();
  $("temaNuevo")?.focus();
}

export function renderInicio() {
  E.perfilActual = null;
  E.PERFIL_DATA = null;
  const tareas = flag("inicio_guiado");
  $("perfil").innerHTML = `
  <section class="card inicio-main"><h2>¿Sobre qué provincia escribes?</h2>
   <p class="inicio-lead"><b>Elige tu provincia</b> y te llevas una frase lista para tu nota, con su fuente y su advertencia.</p></section>
  <div class="grid g2" style="margin-top:16px">${guiaHTML()}${siguiendoHTML()}</div>
  ${
    tareas
      ? `<div class="grid g2" style="margin-top:16px">
   <section class="card"><h2>Comparo dos territorios</h2><div style="margin-top:10px">${modCmpHTML()}</div></section>
   <section class="card"><h2>¿Para qué sirve este dato?</h2><div style="margin-top:10px">${criterioLista()}</div></section>
  </div>`
      : ""
  }`;
  entradaKit($("perfil"));
  bindInicio();
  if (tareas) modCmpBind();
  renderProvLista();
}

// A bare "46,4 de 100" means nothing; a bar shows where the province sits among all 24.
export function escalaHTML(valor, nacional, provincia) {
  const { lo, hi } = indicatorRange("IVEI");
  const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo || 1)) * 100));
  const grad = `linear-gradient(90deg,${RAMP.map(([r, g, b]) => `rgb(${r},${g},${b})`).join(",")})`;
  return `<div class="escala" role="img" aria-label="${esc(provincia)}: ${fmt(valor)}. Promedio del país: ${fmt(nacional)}. Va de ${fmt(lo)} a ${fmt(hi)}">
   <div class="esc-bar" style="background:${grad}"><span class="esc-pais" style="left:${pos(nacional)}%"></span><span class="esc-mark" style="left:${pos(valor)}%"></span></div>
   <div class="esc-lab"><span>${fmt(lo)} · la menos vulnerable</span><span>la más vulnerable · ${fmt(hi)}</span></div>
   <p class="esc-key"><span class="mk"></span>${esc(provincia)} ${fmt(valor)} <span class="mk pais"></span>promedio del país ${fmt(nacional)}</p>
  </div>`;
}

// Map used to choose a province: tap the territory, as you would on a paper map.
function drawSelMap(svgEl, pathsMap) {
  svgEl.innerHTML = "";
  for (const [key, d] of Object.entries(pathsMap)) {
    const p = byKey()[key];
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "pvs");
    path.dataset.k = key;
    path.setAttribute("role", "button");
    path.setAttribute("tabindex", "0");
    path.setAttribute("aria-label", p ? `${p.provincia}: abrir la nota` : key);
    path.setAttribute("fill", col("IVEI", p?.IVEI));
    path.addEventListener("mouseenter", (e) => p && tipShow(e.clientX, e.clientY, `<b>${esc(p.provincia)}</b><br>Vulnerabilidad ${esc((p.nivel || "").toLowerCase())} · puesto ${Math.round(p.rank)} de 24<br>Puede variar ${esc(MARGEN_GENERAL)}`));
    path.addEventListener("mousemove", (e) => tipMove(e.clientX, e.clientY));
    path.addEventListener("mouseleave", tipHide);
    path.addEventListener("click", () => p && goToPerfil(p.provincia));
    path.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && p) {
        e.preventDefault();
        goToPerfil(p.provincia);
      }
    });
    svgEl.appendChild(path);
  }
}

function paintSel() {
  const act = E.perfilActual ? provinceKey(E.perfilActual) : "";
  document.querySelectorAll(".pvs").forEach((el) => el.classList.toggle("sel", el.dataset.k === act));
}

export function skeletonKit(nombre) {
  return `<div class="kit-head"><h2 class="prov-title">${esc(nombre)}</h2></div>
  <div class="kit-grid"><section class="card sk"><div class="sk-b" style="width:42%;height:54px"></div><div class="sk-b" style="width:70%"></div><div class="sk-b" style="width:55%"></div><div class="sk-b" style="width:100%;height:46px;margin-top:14px"></div><div class="sk-b" style="width:48%;height:40px"></div></section>
  <section class="card sk"><div class="sk-b" style="width:36%;height:22px"></div><div class="sk-b" style="width:100%"></div><div class="sk-b" style="width:100%"></div><div class="sk-b" style="width:100%"></div><div class="sk-b" style="width:100%"></div></section></div>`;
}

function modCmpHTML() {
  const opts = (sel) => E.PROVINCIAS.map((p) => `<option value="${esc(p)}"${p === sel ? " selected" : ""}>${esc(p)}</option>`).join("");
  const a = E.perfilActual || E.PROVINCIAS[0];
  const b = E.PROVINCIAS.find((p) => p !== a) || a;
  return `<div class="cmp-pick">
   <label class="sr" for="mcA">Territorio A</label><select id="mcA">${opts(a)}</select>
   <span>frente a</span>
   <label class="sr" for="mcB">Territorio B</label><select id="mcB">${opts(b)}</select>
  </div>
  <div id="cmpMini" aria-live="polite"></div>`;
}

function modCmpBind() {
  $("mcA").onchange = renderCmpMini;
  $("mcB").onchange = renderCmpMini;
  renderCmpMini();
}

async function renderCmpMini() {
  const a = $("mcA").value;
  const b = $("mcB").value;
  const box = $("cmpMini");
  if (a === b) {
    box.innerHTML = `<p class="note">Elige dos territorios distintos.</p>`;
    return;
  }
  box.innerHTML = `<p class="note">Comparando…</p>${skTable(6)}`;
  try {
    const d = await getJSON(`/api/segmentadores/comparar?a=${enc(a)}&b=${enc(b)}`);
    const { frase, copia } = compareText(d);
    box.innerHTML = `<p class="cmp-frase">${esc(frase)}</p>${deltaTableHTML(d)}
    <div class="cita-act"><button class="btn" id="cmpCopia" type="button">Copiar comparación</button><button class="btn gh" id="cmpFull" type="button">Ver comparación completa</button></div>`;
    $("cmpCopia").onclick = (e) => copiarBtn(e.currentTarget, copia, "comparacion");
    $("cmpFull").onclick = () => navigate(`comparar/${enc(a)}/${enc(b)}`);
  } catch (e) {
    errorBox(box, "No se pudo hacer la comparación.", renderCmpMini);
  }
}

// ---------------------------------------------------------------------
// Command palette: type a province, arrow keys, Enter ("/" or Ctrl+K anywhere)
// ---------------------------------------------------------------------
export function initPalette() {
  const dlg = $("dlgPalette");
  const input = $("palInput");
  const list = $("palList");
  let items = [];
  let idx = 0;
  const render = () => {
    const q = provinceKey(input.value.trim());
    const rec = recientes();
    items = E.PROVINCIAS.filter((p) => !q || provinceKey(p).includes(q)).sort(
      (a, b) => Number(provinceKey(b).startsWith(q)) - Number(provinceKey(a).startsWith(q)) || (q ? 0 : Number(rec.includes(b)) - Number(rec.includes(a))) || a.localeCompare(b, "es")
    );
    // no match: offer the nearest names so Enter still gets the reporter somewhere
    const sinCoincidencia = !items.length;
    const sug = sinCoincidencia ? sugerir(input.value) : [];
    if (sinCoincidencia) items = sug;
    idx = Math.min(idx, Math.max(0, items.length - 1));
    const aviso = sinCoincidencia
      ? `<li class="pal-empty" role="presentation"><b>No encontramos «${esc(input.value)}».</b> ${sug.length ? "¿Quisiste decir…?" : SIN_RESULTADOS}</li>`
      : "";
    list.innerHTML =
      aviso +
      items
        .map((p, i) => {
          const r = byKey()[provinceKey(p)] ?? {};
          return `<li role="option" id="pal-${i}" aria-selected="${i === idx}" data-p="${esc(p)}" class="${i === idx ? "on" : ""}"><span class="dot" style="background:${col("IVEI", r.IVEI)}"></span><b>${esc(p)}</b><span class="pal-meta">Puesto ${Math.round(r.rank)} · ${esc(r.nivel)}</span>${provinceFlags({ isImputed: r.n_lb === 0, isBorderlineCase: esLimite(p), compact: true })}</li>`;
        })
        .join("");
    input.setAttribute("aria-activedescendant", items.length ? `pal-${idx}` : "");
    list.querySelector(".on")?.scrollIntoView({ block: "nearest" });
  };
  const choose = (p) => {
    dlg.close();
    goToPerfil(p);
  };
  const open = () => {
    input.value = "";
    idx = 0;
    render();
    dlg.showModal();
    input.focus();
  };
  $("buscador").onclick = open;
  input.oninput = () => {
    idx = 0;
    render();
  };
  input.onkeydown = (e) => {
    if (e.key === "ArrowDown") idx = Math.min(items.length - 1, idx + 1);
    else if (e.key === "ArrowUp") idx = Math.max(0, idx - 1);
    else if (e.key === "Enter") {
      e.preventDefault();
      if (items[idx]) choose(items[idx]);
      return;
    } else return;
    e.preventDefault();
    render();
  };
  list.onclick = (e) => {
    const li = e.target.closest("li[data-p]");
    if (li) choose(li.dataset.p);
  };
  $("palCerrar").onclick = () => dlg.close();
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    const hotkey = (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k");
    if (hotkey && flag("buscador_provincia") && !document.querySelector("dialog[open]")) {
      e.preventDefault();
      open();
    }
  });
}
