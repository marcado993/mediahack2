// Observatorio de Vulnerabilidad Electoral - Ecuador
// Plain HTML/CSS/JS, no build step. Fetches everything from the FastAPI
// backend (app/routers/segmentadores.py, ask.py, origin.py, contrast.py,
// trends.py) - nothing here is static/embedded data except the precomputed
// province map paths (assets/ecuador_paths.json), generated once from the
// project's own GeoJSON so the shipped page needs no mapping library.

import { API_BASE, getJSON, postJSON } from "./api.js";
import { loadTenant, flag, onTenant, tenant } from "./tenant.js";
import { esc, fmt, fmtInt, ICON, qualityBadge, importedTag, borderlineTag, provinceFlags, scoreRange } from "./ui.js";

const $ = (id) => document.getElementById(id);
const enc = encodeURIComponent;

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
const NAME_ALIASES = { "santo domingo": "santo domingo de los tsachilas" };
function provinceKey(name) {
  const stripped = normalize(name);
  return NAME_ALIASES[stripped] || stripped;
}

// Sequential single-hue ramp: light = fewer conditions for disinformation,
// dark = more. No traffic-light colours, nothing that shouts or stigmatises. RES (resilience) reads the
// opposite direction, so it gets the ramp reversed rather than the value
// inverted, which keeps the legend gradient itself green-first for RES too.
const RAMP = [
  [232, 239, 248],
  [194, 211, 234],
  [149, 177, 216],
  [99, 138, 193],
  [54, 96, 158],
  [16, 50, 104],
];
const GREEN = [...RAMP].reverse();

function rampColor(t, arr = RAMP) {
  t = Math.max(0, Math.min(1, t)) * (arr.length - 1);
  const i = Math.min(Math.floor(t), arr.length - 2);
  const f = t - i;
  const a = arr[i],
    b = arr[i + 1];
  return `rgb(${a.map((c, j) => Math.round(c + (b[j] - c) * f)).join(",")})`;
}
// RES and HABDIG both read "higher = better" (more resilient / more
// digitally competent), the opposite of every other layer here - they get
// the ramp reversed rather than inverting the value, so their own legend
// gradient starts green too.
function isPositiveKey(key) {
  return key === "RES" || key === "HABDIG";
}
function scaleFor(key) {
  return isPositiveKey(key) ? GREEN : RAMP;
}

// Each indicator is colored against the *observed* range across the 24
// provinces (min-max), not a fixed 0-100 scale - matches the reference and
// reads better since most indicators here don't actually span 0-100.
function indicatorRange(key) {
  const vals = (MAPA?.provincias ?? []).map((p) => p[key]).filter((v) => v != null);
  if (!vals.length) return { lo: 0, hi: 100 };
  return { lo: Math.min(...vals), hi: Math.max(...vals) };
}
function col(key, value) {
  if (value == null) return "#cbd5e1";
  const { lo, hi } = indicatorRange(key);
  return rampColor((value - lo) / (hi - lo || 1), scaleFor(key));
}

// ---------------------------------------------------------------------
// Readable text on any fill: the ramp passes through pale yellow, where
// white labels fail contrast, so every coloured badge picks its own ink.
// ---------------------------------------------------------------------
function inkFor(color) {
  let rgb = null;
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color || "");
  if (m) rgb = [+m[1], +m[2], +m[3]];
  else if (/^#[0-9a-f]{6}$/i.test(color || "")) {
    const n = parseInt(color.slice(1), 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  if (!rgb) return "#131a24";
  const [r, g, b] = rgb.map((c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.06 ? "#ffffff" : "#131a24";
}

// ---------------------------------------------------------------------
// The six territorial profiles keep one fixed colour in every view. They sit
// outside the green-to-red range of the index on purpose, so a profile is
// never mistaken for a level of vulnerability.
// ---------------------------------------------------------------------
const PERFILES = [
  { nombre: "Exclusión digital con carencia estructural", plano: "Poca conexión y muchas carencias", corto: "Poca conexión, carencias", color: "#693875" },
  { nombre: "Alta exposición con capacidad de filtro", plano: "Muy conectada y con capacidad de verificar", corto: "Conectada, verifica", color: "#40bf84" },
  { nombre: "Exposición alta sobre base estructural sólida", plano: "Muy conectada, con buena base social", corto: "Conectada, base sólida", color: "#bf9540" },
  { nombre: "Hiperexposición con baja resiliencia", plano: "Saturada de redes y sin herramientas de contraste", corto: "Saturada de redes", color: "#914650" },
  { nombre: "Carencia estructural y déficit de resiliencia", plano: "Muchas carencias y poca capacidad de contrastar", corto: "Carencias, poco contraste", color: "#4c29ae" },
  { nombre: "Perfil intermedio", plano: "Perfil intermedio", corto: "Intermedio", color: "#7d8a9c" },
];
const perfilInfo = (nombre) => PERFILES.find((p) => p.nombre === nombre);
const perfilPlano = (nombre) => perfilInfo(nombre)?.plano ?? nombre;
const perfilColor = (nombre) => perfilInfo(nombre)?.color ?? "#cbd5e1";
// Cases the team found sitting close to the border between two profiles.
const PERFIL_LIMITE = ["pastaza", "bolivar", "el oro", "cotopaxi"];
const esLimite = (provincia) => PERFIL_LIMITE.includes(provinceKey(provincia));

// ---------------------------------------------------------------------
// How firm is each figure? Census = complete count. Official surveys with a
// provincial sample = medium. Weak or imputed samples = low. The Latinobarómetro
// cut-offs are the working criterion and still pending confirmation against the
// microdata, so they live in one place.
// ---------------------------------------------------------------------
const MUESTRA_DEBIL = 50;
const MUESTRA_ALTA = 100;
let SOL_NLB = null; // Latinobarómetro cases in the province being rendered

function solidez(source, nLb) {
  const s = source || "";
  if (/Censo/i.test(s)) return { nivel: "alta", texto: "Conteo completo del Censo: sin error muestral." };
  if (/TIC/i.test(s)) return { nivel: "baja", texto: "Encuesta nacional: no es representativa por provincia." };
  if (/ENEMDU/i.test(s)) return { nivel: "media", texto: "Encuesta oficial con representatividad provincial." };
  if (/Latinobar/i.test(s) || /IVD/i.test(s)) {
    if (nLb === 0) return { nivel: "baja", texto: "Provincia sin muestra propia: se usa el valor nacional." };
    if (nLb != null && nLb < MUESTRA_DEBIL) return { nivel: "baja", texto: `Muestra provincial débil: ${nLb} casos.` };
    return { nivel: "media", texto: nLb != null ? `Muestra provincial de ${nLb} casos.` : "Encuesta de opinión." };
  }
  return null;
}
function solBadge(source) {
  const sol = solidez(source, SOL_NLB);
  return sol ? qualityBadge({ dataSourceQuality: sol.nivel, detail: sol.texto }) : "";
}

// ---------------------------------------------------------------------
// Navigation: every screen has a shareable address (#perfil/Guayas,
// #mapas/EXP, #comparar/Guayas/Pichincha) and the back button works.
// A view the outlet switched off falls back to the map instead of 404ing.
// ---------------------------------------------------------------------
const VIEW_FLAG = {
  mapas: "vista_mapas",
  perfil: "vista_perfil",
  comparar: "vista_comparar",
  datos: "vista_datos",
  fuentes: "vista_fuentes",
  asistente: "vista_conversacion",
  meto: "vista_metodologia",
};
let currentView = "perfil";
const viewEnabled = (v) => v in VIEW_FLAG && flag(VIEW_FLAG[v]);

function showView(v) {
  if (!viewEnabled(v)) v = "perfil";
  currentView = v;
  document.querySelectorAll("nav button").forEach((b) => {
    const on = b.dataset.v === v;
    b.classList.toggle("on", on);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("on", el.id === "v-" + v));
  $("btnMas")?.classList.toggle("on", !!document.querySelector("#menuMas button.on"));
}

function pathFor(v) {
  if (v === "mapas") return `mapas/${capa}`;
  if (v === "perfil") return perfilActual ? `perfil/${enc(perfilActual)}` : "perfil";
  if (v === "comparar") return `comparar/${enc($("cmpA").value)}/${enc($("cmpB").value)}`;
  return v;
}

function navigate(path, { replace = false } = {}) {
  const before = currentView;
  history[replace ? "replaceState" : "pushState"](null, "", location.pathname + location.search + "#" + path);
  applyRoute();
  if (before !== currentView) window.scrollTo(0, 0);
}

function applyRoute() {
  let parts = [];
  try {
    parts = location.hash.slice(1).split("/").map(decodeURIComponent);
  } catch (_) {}
  const [v = "perfil", a, b] = parts;
  showView(v);
  if (currentView === "mapas" && a && MAPA && capasAll().some((c) => c.codigo === a && capaEnabled(c)) && a !== capa) {
    capa = a;
    renderCapas();
    paintMap();
  }
  if (currentView === "perfil" && a && PROVINCIAS.length) {
    const p = PROVINCIAS.find((x) => provinceKey(x) === provinceKey(a));
    if (p && p !== perfilActual) loadPerfil(p);
  }
  if (currentView === "comparar" && a && b && PROVINCIAS.length) {
    const pa = PROVINCIAS.find((x) => provinceKey(x) === provinceKey(a));
    const pb = PROVINCIAS.find((x) => provinceKey(x) === provinceKey(b));
    if (pa && pb && ($("cmpA").value !== pa || $("cmpB").value !== pb)) {
      $("cmpA").value = pa;
      $("cmpB").value = pb;
      renderCmp();
    }
  }
}
addEventListener("popstate", applyRoute);

const tabs = () => [...document.querySelectorAll("nav > button:not([hidden])")];
function cerrarMas() {
  $("menuMas").hidden = true;
  $("btnMas").setAttribute("aria-expanded", "false");
}
function abrirMas() {
  const btn = $("btnMas");
  const menu = $("menuMas");
  menu.hidden = false;
  const r = btn.getBoundingClientRect();
  menu.style.top = `${r.bottom + 4}px`;
  menu.style.left = `${Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8))}px`;
  btn.setAttribute("aria-expanded", "true");
  menu.querySelector("button:not([hidden])")?.focus();
}
document.querySelectorAll("nav button[data-v]").forEach((b) => {
  b.addEventListener("click", () => {
    cerrarMas();
    navigate(pathFor(b.dataset.v));
  });
});
$("btnMas").addEventListener("click", () => ($("menuMas").hidden ? abrirMas() : cerrarMas()));
document.addEventListener("click", (e) => {
  if (!e.target.closest("#menuMas, #btnMas")) cerrarMas();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("menuMas").hidden) {
    cerrarMas();
    $("btnMas").focus();
  }
});
document.querySelectorAll("nav > button").forEach((b) => {
  b.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const list = tabs();
    list[(list.indexOf(b) + step + list.length) % list.length].focus();
    e.preventDefault();
  });
});

// Small, non-blocking feedback instead of alert(): says what happened and
// disappears on its own.
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 3200);
}
// Copy with feedback where the eyes already are: the button says "Copiado".
async function copiarBtn(btn, texto) {
  const ok = await copyText(texto);
  if (!ok) return toast("No se pudo copiar. Selecciona el texto y cópialo a mano.");
  const prev = btn.dataset.label || btn.textContent;
  btn.dataset.label = prev;
  btn.textContent = "Copiado ✓";
  btn.classList.add("done");
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    btn.textContent = prev;
    btn.classList.remove("done");
  }, 1600);
}

// An error that says what failed and offers the next step.
function errorBox(target, msg, retry) {
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

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
let MAPA = null; // /api/segmentadores/mapa response
let PATHS = null; // precomputed SVG paths
let PROVINCIAS = []; // list of province names
let capa = "IVEI";
let mapSel = null;
let perfilActual = null;
let PERFIL_DATA = null;

const tip = document.getElementById("tip");
function tipShow(x, y, html) {
  tip.innerHTML = html;
  tip.style.opacity = 1;
  tipMove(x, y);
}
function tipMove(x, y) {
  const w = tip.offsetWidth,
    h = tip.offsetHeight;
  tip.style.left = Math.min(x + 15, innerWidth - w - 10) + "px";
  tip.style.top = Math.max(8, Math.min(y - h - 12, innerHeight - h - 8)) + "px";
}
function tipHide() {
  tip.style.opacity = 0;
}

// ---------------------------------------------------------------------
// Mapas
// ---------------------------------------------------------------------
function byKey() {
  const idx = {};
  for (const p of MAPA.provincias) idx[provinceKey(p.provincia)] = p;
  return idx;
}

const CAPA_FLAG = { EXCLUSION: "capa_mecanismos", HIPEREXP: "capa_mecanismos", HABDIG: "capa_habilidades" };
const capaEnabled = (c) => !CAPA_FLAG[c.codigo] || flag(CAPA_FLAG[c.codigo]);

let masCapas = false;
function renderCapas() {
  const box = document.getElementById("capas");
  const MAIN = ["IVEI", "EST", "EXP", "RES", "PRE"];
  const EXTRA = ["EXCLUSION", "HIPEREXP", "HABDIG", "PERFIL"];
  const byCode = Object.fromEntries(capasAll().filter(capaEnabled).map((c) => [c.codigo, c]));
  const expandido = masCapas || EXTRA.includes(capa);
  const chip = (code) => {
    const c = byCode[code];
    if (!c) return "";
    const on = code === capa;
    const label = code === "IVEI" ? "Todos" : c.nombre;
    const tag = ["EST", "EXP", "RES", "PRE"].includes(code) ? `<span class="fcode">${code}</span>` : "";
    const help = FACTORES[code] && code !== "HABDIG" && code !== "PERFIL" && !EXTRA.includes(code) ? `<button type="button" class="fhelp" data-ficha="${code}" aria-label="Ficha rápida: ${esc(c.nombre)}">?</button>` : "";
    return `<span class="fchip${on ? " on" : ""}"><button type="button" class="fbtn" data-capa="${code}" aria-pressed="${on}" title="${esc(CAPA_DESC[code] ?? "")}">${esc(label)}${tag}</button>${help}</span>`;
  };
  box.innerHTML =
    MAIN.map(chip).join("") +
    `<button type="button" class="linkbtn fmore" id="btnMasCapas" aria-expanded="${expandido}">${expandido ? "Menos capas" : "Más capas"}</button>` +
    (expandido ? `<span class="chip-sep" aria-hidden="true"></span>${EXTRA.map(chip).join("")}` : "");
  box.querySelectorAll("[data-capa]").forEach((b) => (b.onclick = () => navigate(`mapas/${b.dataset.capa}`, { replace: true })));
  box.querySelectorAll("[data-ficha]").forEach((b) => (b.onclick = () => openFicha(b.dataset.ficha)));
  $("btnMasCapas").onclick = () => {
    masCapas = !expandido;
    renderCapas();
  };
}

function valueFor(key) {
  const rec = byKey()[key];
  if (!rec) return null;
  return rec[capa];
}

// Plain language first. `tec` is the name the methodology uses; it only
// appears in the glossary, never as the label a journalist has to decode.
const FACTORES = {
  IVEI: { que: "Resume los cuatro factores: qué tan fértil es el terreno para que la desinformación llegue y prospere.", lectura: "Más alto = terreno más fértil.", lg: ["menos vulnerable", "más vulnerable"], tec: "Índice de Vulnerabilidad Electoral Integrada (IVEI)" },
  EST: { que: "Pobreza, ruralidad, poca escolaridad y desconfianza en las instituciones: lo que deja a la gente sin respaldo para contrastar.", lectura: "Más alto = más carencias.", lg: ["menos carencias", "más carencias"], tec: "Vulnerabilidad estructural" },
  EXP: { que: "Cuánta gente se informa por redes y mensajería (Facebook, WhatsApp, TikTok), donde el contenido circula sin filtro editorial.", lectura: "Más alto = más gente expuesta.", lg: ["menos dependencia", "más dependencia"], tec: "Exposición informativa" },
  RES: { que: "Escolaridad, variedad de fuentes y conciencia de que circula información falsa.", lectura: "Más alto = más herramientas para verificar (mejor).", lg: ["menos capacidad", "más capacidad"], tec: "Resiliencia informativa" },
  PRE: { que: "Miedo al delito, percepción de fraude, narcotráfico y corrupción: el ambiente que hace más creíbles los rumores en una elección.", lectura: "Más alto = ambiente más tenso.", lg: ["más calmo", "más tenso"], tec: "Presión coyuntural" },
  EXCLUSION: { que: "Quién queda fuera de internet o sin habilidades digitales y depende del rumor y el boca a boca.", lectura: "Más alto = más gente sin conexión.", lg: ["menos gente sin conexión", "más gente sin conexión"], tec: "Exclusión digital" },
  HIPEREXP: { que: "Quién vive pegado a redes de circulación rápida y con poca capacidad de contrastar.", lectura: "Más alto = más saturación.", lg: ["menos saturación", "más saturación"], tec: "Hiperexposición digital" },
  HABDIG: { que: "Competencias digitales que la propia persona dice tener (MINTEL 2023, participación voluntaria: no representa a toda la provincia).", lectura: "Más alto = más competencia (mejor).", lg: ["menos competencia", "más competencia"] },
  PERFIL: { que: "Cada provincia pertenece a uno de seis tipos, según qué factor predomina. Los colores son fijos en todo el sitio y no indican nivel de vulnerabilidad.", lectura: "", lg: ["", ""] },
};
const BREVE = {
  IVEI: "Qué tan fértil es el terreno para la desinformación.",
  EST: "Pobreza, ruralidad, poca escuela y desconfianza.",
  EXP: "Cuánta gente se informa por redes y WhatsApp.",
  RES: "Escolaridad, fuentes variadas y conciencia del riesgo.",
  PRE: "Miedo, fraude percibido, narco y corrupción.",
  EXCLUSION: "Quién queda fuera de internet.",
  HIPEREXP: "Quién vive pegado a redes, sin filtro.",
  HABDIG: "Habilidades digitales que la gente dice tener.",
  PERFIL: "Seis tipos de provincia. Los colores no indican nivel.",
};
const CAPA_DESC = Object.fromEntries(Object.keys(FACTORES).map((k) => [k, `${BREVE[k]} ${FACTORES[k].lectura}`.trim()]));
const CAPA_LG = Object.fromEntries(Object.entries(FACTORES).map(([k, f]) => [k, f.lg]));
const factorNombre = (k) => capasAll().find((c) => c.codigo === k)?.nombre ?? k;
function puestoFactor(k, provincia) {
  const dir = k === "RES" ? 1 : -1; // worst first: low resilience, high everything else
  const arr = MAPA.provincias.filter((p) => p[k] != null).sort((a, b) => dir * (a[k] - b[k]));
  const i = arr.findIndex((p) => p.provincia === provincia);
  return i < 0 ? null : { n: i + 1, de: arr.length };
}

const PERFIL_CAPA = { codigo: "PERFIL", nombre: "Tipos de provincia", color: "#5b6b7f" };
const capasAll = () => [...MAPA.capas, PERFIL_CAPA];

function capaValueText(p) {
  return capa === "PERFIL" ? `<b>${esc(perfilInfo(p.perfil)?.corto ?? p.perfil)}</b>` : `<b>${fmt(p[capa])}</b>`;
}

function paintMap() {
  const idx = byKey();
  if (!capasAll().some((c) => c.codigo === capa && capaEnabled(c))) capa = "IVEI";
  const active = capasAll().find((c) => c.codigo === capa);
  const isPerfil = capa === "PERFIL";
  document.getElementById("capaTit").textContent = active.nombre;
  document.getElementById("capaDesc").textContent = CAPA_DESC[capa] ?? "Mayor valor = mayor vulnerabilidad.";
  const [lgA, lgB] = CAPA_LG[capa] ?? ["menor", "mayor"];
  document.getElementById("lgA").textContent = lgA;
  document.getElementById("lgB").textContent = lgB;
  if (!isPerfil) document.getElementById("lgBar").style.background = "linear-gradient(90deg," + scaleFor(capa).map(([r, g, b]) => `rgb(${r},${g},${b})`).join(",") + ")";
  $("lgWrap").hidden = isPerfil;
  const cat = $("lgCat");
  cat.hidden = !isPerfil;
  if (isPerfil) {
    cat.innerHTML = PERFILES.map((pf) => {
      const n = MAPA.provincias.filter((p) => p.perfil === pf.nombre).length;
      return `<li title="Nombre técnico: ${esc(pf.nombre)}"><span class="sw" style="background:${pf.color}"></span><span>${esc(pf.plano)}</span><b>${n}</b></li>`;
    }).join("");
  }
  $("lgImp").hidden = capa === "HABDIG";

  document.querySelectorAll(".pv").forEach((el) => {
    const key = el.dataset.k;
    const rec = idx[key];
    el.setAttribute("fill", isPerfil ? perfilColor(rec?.perfil) : col(capa, valueFor(key)));
    el.classList.toggle("sel", key === mapSel);
    el.classList.toggle("imp", rec?.n_lb === 0 && capa !== "HABDIG");
  });

  // Nulls (no data for this layer) always sink to the bottom of the
  // ranking, regardless of which direction the layer sorts in.
  const rows = [...MAPA.provincias].sort((a, b) => {
    if (isPerfil) return PERFILES.findIndex((x) => x.nombre === a.perfil) - PERFILES.findIndex((x) => x.nombre === b.perfil) || b.IVEI - a.IVEI;
    if (a[capa] == null) return 1;
    if (b[capa] == null) return -1;
    return isPositiveKey(capa) ? a[capa] - b[capa] : b[capa] - a[capa];
  });
  document.getElementById("rk").innerHTML = rows
    .map((p, i) => {
      const key = provinceKey(p.provincia);
      const v = p[capa];
      let tag = "";
      if (capa === "HABDIG") {
        tag = v == null ? ' <span class="tag">sin encuestas</span>' : p.HABDIG_n < 10 ? ' <span class="tag">muestra chica</span>' : "";
      } else if (p.n_lb === 0) {
        tag = " " + importedTag({ compact: true });
      }
      if (esLimite(p.provincia)) tag += " " + borderlineTag({ compact: true });
      const bg = isPerfil ? perfilColor(p.perfil) : col(capa, v);
      return `<tr data-k="${key}" class="${key === mapSel ? "sel" : ""}">
      <td style="width:26px"><span class="rk" style="background:${bg};color:${inkFor(bg)}">${i + 1}</span></td>
      <td>${p.provincia}${tag}</td>
      <td class="num">${isPerfil ? `<span class="pshort">${esc(perfilInfo(p.perfil)?.corto ?? "")}</span>` : `<b>${fmt(v)}</b>`}</td></tr>`;
    })
    .join("");
  document.querySelectorAll("#rk tr").forEach((r) => {
    r.tabIndex = 0;
    r.setAttribute("role", "button");
    r.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        r.click();
      }
    };
    r.onclick = () => selectProvince(byKey()[r.dataset.k].provincia);
    r.onmouseenter = (e) => {
      const p = byKey()[r.dataset.k];
      tipShow(
        e.clientX,
        e.clientY,
        `<b>${p.provincia}</b><br>${active.nombre}: ${capaValueText(p)}<br>
        <span class="r">IVEI</span> ${fmt(p.IVEI)} · <span class="r">Puesto</span> ${p.rank}/24<br>
        ${fmtInt(p.poblacion)} hab.${p.n_lb === 0 ? '<br><span class="r">Sin muestra propia: valor nacional imputado</span>' : ""}`
      );
    };
    r.onmousemove = (e) => tipMove(e.clientX, e.clientY);
    r.onmouseleave = tipHide;
  });
  renderPeek();
}

function drawMapSVG(svgEl, pathsMap, scaleX = 1, scaleY = 1) {
  svgEl.innerHTML = "";
  for (const [key, d] of Object.entries(pathsMap)) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "pv");
    path.dataset.k = key;
    path.setAttribute("role", "button");
    path.setAttribute("tabindex", "0");
    const idx = byKey();
    const p = idx[key];
    path.setAttribute("aria-label", p ? `${p.provincia}: ver resumen` : key);
    path.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && p) {
        e.preventDefault();
        selectProvince(p.provincia);
      }
    });
    path.addEventListener("mouseenter", (e) => {
      if (p) {
        tipShow(
          e.clientX,
          e.clientY,
          `<b>${p.provincia}</b><br>${capasAll().find((c) => c.codigo === capa).nombre}: ${capaValueText(p)}<br>
          Puesto ${p.rank}/24 · ${p.nivel}${p.n_lb === 0 ? '<br><span class="r">Sin muestra propia: valor nacional</span>' : ""}`
        );
      }
    });
    path.addEventListener("mousemove", (e) => tipMove(e.clientX, e.clientY));
    path.addEventListener("mouseleave", tipHide);
    path.addEventListener("click", () => {
      if (p) selectProvince(p.provincia);
    });
    path.addEventListener("dblclick", () => {
      if (p) goToPerfil(p.provincia);
    });
    svgEl.appendChild(path);
  }
}

// Only the provinces with enough on-map room to fit a label without
// crowding a small neighbor - same set as the reference observatory.
const LABEL_PROVINCES = ["pichincha", "guayas", "manabi", "esmeraldas", "orellana", "sucumbios", "morona santiago", "loja"];

function drawLabels(svgEl) {
  const idx = byKey();
  for (const key of LABEL_PROVINCES) {
    const c = PATHS.centroids[key];
    const p = idx[key];
    if (!c || !p) continue;
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", c[0]);
    t.setAttribute("y", c[1] + 3);
    t.setAttribute("class", "lbl");
    t.textContent = p.provincia;
    svgEl.appendChild(t);
  }
}

async function initMapas() {
  [MAPA, PATHS] = await Promise.all([getJSON("/api/segmentadores/mapa"), fetch("/assets/ecuador_paths.json").then((r) => r.json())]);
  PROVINCIAS = MAPA.provincias.map((p) => p.provincia);
  renderCapas();
  drawMapSVG(document.getElementById("map"), PATHS.mainland);
  drawMapSVG(document.getElementById("map-gal"), PATHS.galapagos);
  drawLabels(document.getElementById("map"));
  paintMap();
  renderScatter();
}

// Exclusión digital x hiperexposición digital: two independent digital-
// vulnerability mechanisms - a province can be high in one, the other,
// both, or neither. Plain hand-drawn SVG, same as the reference chart.
function renderScatter() {
  const sv = document.getElementById("scatter");
  const provincias = MAPA.provincias;
  const W = 700,
    H = 420,
    m = { l: 56, r: 16, t: 14, b: 44 };
  const X = (v) => m.l + (v / 100) * (W - m.l - m.r);
  const Y = (v) => H - m.b - (v / 100) * (H - m.t - m.b);
  const mx = provincias.reduce((a, p) => a + p.EXCLUSION, 0) / provincias.length;
  const my = provincias.reduce((a, p) => a + p.HIPEREXP, 0) / provincias.length;

  let s = `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="#fbfcfd" stroke="#e6ebf0"/>`;
  [0, 25, 50, 75, 100].forEach((v) => {
    s += `<line x1="${X(v)}" y1="${m.t}" x2="${X(v)}" y2="${H - m.b}" stroke="#eef2f6"/><line x1="${m.l}" y1="${Y(v)}" x2="${W - m.r}" y2="${Y(v)}" stroke="#eef2f6"/>
    <text x="${X(v)}" y="${H - m.b + 15}" font-size="11" fill="#5f6b7d" text-anchor="middle">${v}</text>
    <text x="${m.l - 8}" y="${Y(v) + 3}" font-size="11" fill="#5f6b7d" text-anchor="end">${v}</text>`;
  });
  s += `<line x1="${X(mx)}" y1="${m.t}" x2="${X(mx)}" y2="${H - m.b}" stroke="#b9c4d0" stroke-dasharray="4 3"/><line x1="${m.l}" y1="${Y(my)}" x2="${W - m.r}" y2="${Y(my)}" stroke="#b9c4d0" stroke-dasharray="4 3"/>`;
  const quad = [
    ["Más saturadas de redes", X(mx) - 8, Y(my) - 8, "end"],
    ["Ambos problemas", X(mx) + 8, Y(my) - 8, "start"],
    ["Ninguno destaca", X(mx) - 8, Y(my) + 18, "end"],
    ["Más sin conexión", X(mx) + 8, Y(my) + 18, "start"],
  ];
  quad.forEach(([t, x, y, a]) => {
    s += `<text x="${x}" y="${y}" font-size="11" fill="#5f6b7d" text-anchor="${a}" font-weight="600">${t}</text>`;
  });
  for (const p of provincias) {
    const r = 4 + Math.sqrt(p.poblacion) / 450;
    s += `<circle cx="${X(p.EXCLUSION)}" cy="${Y(p.HIPEREXP)}" r="${r}" fill="${col("IVEI", p.IVEI)}" stroke="#fff" stroke-width="1.2" data-k="${provinceKey(p.provincia)}" tabindex="0" role="button" aria-label="${esc(p.provincia)}: sin conexión ${fmt(p.EXCLUSION)}, saturación de redes ${fmt(p.HIPEREXP)}" style="cursor:pointer"/>`;
  }
  provincias
    .filter((p) => p.poblacion > 380000 || p.EXCLUSION > 68 || p.HIPEREXP > 74)
    .forEach((p) => {
      s += `<text x="${X(p.EXCLUSION)}" y="${Y(p.HIPEREXP) - 9}" font-size="11" fill="#2b3647" text-anchor="middle" font-weight="600">${p.provincia}</text>`;
    });
  s += `<text x="${(W + m.l) / 2}" y="${H - 6}" font-size="11" fill="#657388" text-anchor="middle" font-weight="600">Más gente sin conexión →</text>
  <text transform="translate(15,${(H - m.b + m.t) / 2}) rotate(-90)" font-size="11" fill="#657388" text-anchor="middle" font-weight="600">Más saturación de redes →</text>`;
  sv.innerHTML = s;

  const idx = byKey();
  sv.querySelectorAll("circle[data-k]").forEach((c) => {
    const p = idx[c.dataset.k];
    if (!p) return;
    c.addEventListener("mouseenter", (e) => {
      tipShow(e.clientX, e.clientY, `<b>${p.provincia}</b><br>Sin conexión <b>${fmt(p.EXCLUSION)}</b><br>Saturación de redes <b>${fmt(p.HIPEREXP)}</b><br><span class="r">${perfilPlano(p.perfil)}</span>`);
    });
    c.addEventListener("mousemove", (e) => tipMove(e.clientX, e.clientY));
    c.addEventListener("mouseleave", tipHide);
    c.addEventListener("click", () => selectProvince(p.provincia));
    c.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectProvince(p.provincia);
      }
    });
  });
}

// ---------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------
function dimRow(label, value, nacional, color, unit = "") {
  const pct = value == null ? 0 : Math.max(2, Math.min(100, value));
  const nx = nacional == null ? "" : `<div class="nx" style="left:${Math.min(100, nacional)}%"></div>`;
  return `<div class="dimrow"><div class="nm">${label}</div>
    <div class="tr"><div class="fl" style="width:${pct}%;background:${color}"></div>${nx}</div>
    <div class="vl">${fmt(value)}${unit}</div></div>`;
}
function hbars(items, color, maxv) {
  const mx = maxv || Math.max(...items.map((i) => i[1] ?? 0), 1);
  return items
    .map(([lab, v, nv]) => {
      const w = v == null ? 0 : Math.max(1.5, (v / mx) * 100);
      const nx = nv != null ? `<div class="nx" style="left:${(nv / mx) * 100}%"></div>` : "";
      return `<div class="dimrow"><div class="nm">${lab}</div>
      <div class="tr"><div class="fl" style="width:${w}%;background:${color}"></div>${nx}</div>
      <div class="vl">${fmt(v)}</div></div>`;
    })
    .join("");
}
function metric(m, opts = {}) {
  const { absolute = false } = opts;
  if (absolute) {
    return `<div class="metric"><div class="k">${m.label}</div>
    <div class="v">${fmtInt(m.valor)}</div>
    ${m.nacional != null ? `<div class="c"><span>Total país ${fmtInt(m.nacional)}</span></div>` : ""}</div>`;
  }
  let cmp = "",
    cls = "eq";
  if (m.valor != null && m.nacional != null) {
    const d = m.valor - m.nacional;
    cls = m.direction === 1 ? (d > 1 ? "up" : d < -1 ? "dn" : "eq") : m.direction === -1 ? (d > 1 ? "dn" : d < -1 ? "up" : "eq") : "eq";
    cmp = (d >= 0 ? "+" : "−") + fmt(Math.abs(d)) + (m.unit === "%" ? " pp" : "");
  }
  return `<div class="metric"><div class="k">${m.label}</div>
  <div class="v">${fmt(m.valor, m.unit === "índice" ? 2 : 1)}<small>${m.unit ? " " + m.unit : ""}</small></div>
  ${m.nacional != null ? `<div class="c"><span>Nacional ${fmt(m.nacional)}</span><span class="cmp ${cls}">${cmp}</span></div>` : ""}
  ${m.source ? `<div class="srcline">${m.source}${solBadge(m.source)}</div>` : ""}</div>`;
}

const ETNIA_COLOR = {
  et_mestizo: "#4a6fa5",
  et_indigena: "#c4823a",
  et_montubio: "#5b9e79",
  et_afro: "#8c5aa8",
  et_blanco: "#98a5b5",
  et_otro: "#c9d2dc",
};

// What the index can and cannot support in a story. Static on purpose: this
// is editorial guidance about the method, not a result, so it must read the
// same for every province and every outlet.
function reliability(n) {
  if (n == null) return null;
  if (n === 0) return { cls: "lo", label: "Sin muestra propia", detail: "Su opinión es el promedio del país." };
  if (n < 50) return { cls: "lo", label: `Muestra pequeña (n = ${n})`, detail: "Cifras de opinión orientativas." };
  if (n < 100) return { cls: "mid", label: `Muestra media (n = ${n})`, detail: "Cifras de opinión con margen amplio." };
  return { cls: "hi", label: `Muestra suficiente (n = ${n})`, detail: "" };
}

function citaTexto({ provincia, indice, nivel, puesto, nacional, nLb }) {
  const conf = reliability(nLb);
  const nota = conf && conf.cls === "lo" ? ` Nota: ${conf.detail.charAt(0).toLowerCase()}${conf.detail.slice(1)}` : "";
  return (
    `${provincia} obtiene ${fmt(indice)} sobre 100 en el Índice de Vulnerabilidad Electoral Integrada (IVEI), ` +
    `de vulnerabilidad ${(nivel || "").toLowerCase()}: puesto ${puesto} de 24 provincias (1 = la más vulnerable), con un promedio nacional de ${fmt(nacional)}. ` +
    `Fuente: Observatorio de Vulnerabilidad ante la Desinformación Electoral, con datos del Censo 2022 y la ENEMDU 2024 (INEC) y el Latinobarómetro 2024. ` +
    `El índice describe condiciones del territorio, no el comportamiento de sus habitantes.${nota}`
  );
}
const buildCita = (d) => citaTexto({ provincia: d.provincia, indice: d.ivei.indice, nivel: d.ivei.nivel, puesto: d.ivei.puesto, nacional: d.ivei.nacional, nLb: d.n_lb });
const citaDeRegistro = (p) => citaTexto({ provincia: p.provincia, indice: p.IVEI, nivel: p.nivel, puesto: p.rank, nacional: MAPA.nacional.IVEI, nLb: p.n_lb });

// What weighs most on a province: the two dimensions that sit furthest on the
// wrong side of the national average (for resilience, "wrong" means lower).
// Derived from the same numbers the map shows, never written by hand.
const DRIVER_MIN = 3;
function drivers(rec) {
  const nac = MAPA.nacional;
  const titulo = (k) => (k === "RES" ? "Poca capacidad de contrastar" : factorNombre(k));
  return ["EST", "EXP", "PRE", "RES"]
    .filter((k) => rec[k] != null && nac[k] != null)
    .map((k) => ({
      k,
      delta: (k === "RES" ? -1 : 1) * (rec[k] - nac[k]),
      html: `<b>${titulo(k)}</b> ${fmt(rec[k])} <span class="pais">país ${fmt(nac[k])}</span>`,
      plain: `${titulo(k)}: ${fmt(rec[k])} frente a ${fmt(nac[k])} del promedio del país.`,
    }))
    .filter((x) => x.delta >= DRIVER_MIN)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2);
}
const driversHTML = (rec) => {
  const d = drivers(rec);
  return d.length
    ? `<ul class="drivers">${d.map((x) => `<li>${x.html}</li>`).join("")}</ul>`
    : `<p class="note" style="margin:0">Ningún factor se aleja del promedio del país.</p>`;
};

function reporterGuide(d) {
  const conf = reliability(d.n_lb);
  const si = [
    `${d.provincia} ocupa el puesto ${d.ivei.puesto} de 24 en el IVEI 2024.`,
    `Sus condiciones (carencias de base, dependencia de redes, capacidad de contrastar y clima electoral) la ubican en el nivel de vulnerabilidad ${(d.ivei.nivel || "").toLowerCase()}.`,
    `Comparar con el promedio nacional (${fmt(d.ivei.nacional)}) o con otra provincia, nombrando la fuente de cada indicador.`,
  ];
  const no = [
    "Que sus habitantes «creen más desinformación» o «son más manipulables»: el índice mide condiciones del territorio, no creencias.",
    "Que ahí «circula más» desinformación: la desinformación observada no entra a ningún índice.",
    "Afirmar algo sobre candidatos, partidos o medios concretos: el índice no los evalúa.",
  ];
  if (conf && conf.cls !== "hi") no.splice(2, 0, "Presentar como exactas las cifras de opinión de esta provincia: " + conf.detail.charAt(0).toLowerCase() + conf.detail.slice(1));
  return { si, no };
}

const PERFIL_SECCIONES = [
  ["esencial", "Lo esencial"],
  ["reportear", "Para reportear"],
  ["diagnostico", "Por qué tiene este nivel"],
  ["digital", "Perfil digital"],
  ["dieta", "Dieta informativa"],
  ["resiliencia", "Contraste y clima"],
  ["contexto", "Contexto social"],
];

// Collapsible detail block: the essentials stay short, the evidence is one click away.
const detalle = (id, titulo, sub, cuerpo, open = false) =>
  `<details class="card sec" id="sec-${id}"${open ? " open" : ""}><summary><h2>${titulo}</h2><span class="sub-s">${sub}</span></summary><div class="sec-body">${cuerpo}</div></details>`;

function factorRow(d, provincia) {
  const f = FACTORES[d.codigo] ?? {};
  const pst = puestoFactor(d.codigo, provincia);
  const pct = d.valor == null ? 0 : Math.max(2, Math.min(100, d.valor));
  const nx = d.nacional == null ? "" : `<div class="nx" style="left:${Math.min(100, d.nacional)}%"></div>`;
  return `<div class="frow"><div class="fq"><b>${esc(d.nombre)}</b><span>${esc(f.que || "")}</span></div>
   <div class="tr"><div class="fl" style="width:${pct}%;background:${d.color}"></div>${nx}</div>
   <div class="fv"><b>${fmt(d.valor)}</b><small>${pst ? `puesto ${pst.n} de ${pst.de}` : ""}</small></div></div>`;
}

// ---------------------------------------------------------------------
// "Qué puedes afirmar" vs "qué NO": one block, used on the home screen and
// in every province kit (where it also carries province-specific lines).
// ---------------------------------------------------------------------
const SI_APOYA = [
  ["Priorizar verificaciones", "un rumor pesa más en una provincia vulnerable."],
  ["Elegir el canal", "sin conexión: radio local. Saturación de redes: plataformas y fuentes con credibilidad."],
  ["Revisar cómo se calcula", "todo es abierto."],
];
const NO_APOYA = [
  "Decir si un contenido es verdadero o falso.",
  "Hablar de radio, TV o chats privados.",
  "Describir personas, candidatos o medios.",
  "Comparar con otros países o años sin anclaje.",
  "Bajar a cantón o parroquia: es deliberado.",
];
function decisionBlock({ extraSi = [], extraNo = [] } = {}) {
  const si = [...extraSi.map((t) => `<li>${esc(t)}</li>`), ...SI_APOYA.map(([t, d]) => `<li><b>${esc(t)}:</b> ${esc(d)}</li>`)];
  const no = [...extraNo.map((t) => `<li>${esc(t)}</li>`), ...NO_APOYA.map((t) => `<li>${esc(t)}</li>`)];
  return `<div class="decide">
   <div class="d-si"><h3>${ICON.check}Qué puedes afirmar</h3><ul>${si.join("")}</ul></div>
   <div class="d-no"><h3>${ICON.cross}Qué NO debes afirmar</h3><ul>${no.join("")}</ul></div>
  </div>`;
}

// Same thresholds the backend uses for its own recommendations.
function canalSugerido(rec) {
  const ex = rec.EXCLUSION ?? 0;
  const hi = rec.HIPEREXP ?? 0;
  if (ex > 60 && hi > 60) return "Combina canales: hay gente sin conexión y saturación de redes.";
  if (ex > 60) return "Radio local y aliados: pesa la gente sin conexión.";
  if (hi > 60) return "Redes y fuentes con credibilidad: pesa la saturación.";
  return "Ningún mecanismo domina: combina radio y redes.";
}

function metaOf(data, key) {
  const pools = [data.demografia.edades, data.demografia.etnias, data.digital.acceso, data.digital.brecha, data.resiliencia.componentes, data.presion_coyuntural.componentes, data.socioeconomico, [data.resiliencia.escolaridad, data.dieta_informativa.usa_redes, data.dieta_informativa.n_plataformas, data.dieta_informativa.mensajeria, data.dieta_informativa.conciencia]];
  for (const pool of pools) {
    const hit = pool.find((m) => m && m.key === key);
    if (hit) return hit;
  }
  return null;
}
// A handful of numbers a journalist can quote, each already a sentence with its source.
function datosClave(data) {
  const prov = data.provincia;
  const out = [];
  const add = (m, frase) => {
    if (m && m.valor != null) out.push({ ...frase(m), source: m.source });
  };
  add(metaOf(data, "uso_internet"), (m) => ({ texto: `En ${prov}, ${fmt(m.valor)} % de las personas de 5 años y más usó internet (promedio del país: ${fmt(m.nacional)} %).`, corto: `<b>Usó internet</b> ${fmt(m.valor)} % <span class="pais">país ${fmt(m.nacional)} %</span>` }));
  add(metaOf(data, "analf_digital"), (m) => ({ texto: `El analfabetismo digital en ${prov} es de ${fmt(m.valor)} % (país: ${fmt(m.nacional)} %).`, corto: `<b>Analfabetismo digital</b> ${fmt(m.valor)} % <span class="pais">país ${fmt(m.nacional)} %</span>` }));
  add(metaOf(data, "pobreza_ingresos"), (m) => ({ texto: `La pobreza por ingresos en ${prov} es de ${fmt(m.valor)} % (país: ${fmt(m.nacional)} %).`, corto: `<b>Pobreza por ingresos</b> ${fmt(m.valor)} % <span class="pais">país ${fmt(m.nacional)} %</span>` }));
  if (data.identificacion.pct_rural != null) {
    out.push({ texto: `El ${fmt(data.identificacion.pct_rural)} % de la población de ${prov} vive en el área rural (país: ${fmt(MAPA.nacional.pct_rural)} %).`, corto: `<b>Vive en área rural</b> ${fmt(data.identificacion.pct_rural)} % <span class="pais">país ${fmt(MAPA.nacional.pct_rural)} %</span>`, source: "Censo 2022 (INEC)" });
  }
  return out;
}

function renderPerfil(data) {
  PERFIL_DATA = data;
  SOL_NLB = data.n_lb;
  const target = $("perfil");
  const rec = byKey()[provinceKey(data.provincia)] ?? {};
  const isImputed = data.n_lb === 0;
  const isBorderlineCase = esLimite(data.provincia);
  const conf = reliability(data.n_lb);
  const nivelColor = col("IVEI", data.ivei.indice);
  const cita = buildCita(data);
  const plat = Object.entries(data.dieta_informativa.plataformas)
    .filter(([, v]) => v != null && v > 2)
    .sort((a, b) => b[1] - a[1]);

  // quotable lines: short on screen, a full sentence with its source when copied
  const FUENTE_OVADE = "Fuente: Observatorio de Vulnerabilidad ante la Desinformación Electoral.";
  const angulos = [
    ...drivers(rec).map((d) => ({ html: d.html, copia: `${d.plain} ${FUENTE_OVADE}` })),
    ...datosClave(data).map((c) => ({ html: `${c.corto}${solBadge(c.source)}`, copia: `${c.texto} Fuente: ${c.source}.` })),
  ].slice(0, 5);
  const frase = `${data.provincia}: puesto ${data.ivei.puesto} de 24 en vulnerabilidad electoral (IVEI ${fmt(data.ivei.indice)} de 100). Fuente: OVADE.`;
  const extraNo = [];
  if (isImputed) extraNo.push(`Presentar como propias las cifras de opinión de ${data.provincia}: son el promedio del país.`);
  else if (conf && conf.cls === "lo") extraNo.push(`Dar como exactas las cifras de opinión de ${data.provincia}: ${conf.detail.charAt(0).toLowerCase()}${conf.detail.slice(1)}`);
  if (isBorderlineCase) extraNo.push(`Tratar el tipo de provincia de ${data.provincia} como una etiqueta fija: es un caso limítrofe.`);

  const diagnostico = `<div style="font-size:13.5px;color:#26313f;max-width:78ch">${data.diagnostico.map((p) => `<p style="margin:0 0 9px">${esc(p)}</p>`).join("")}</div>`;

  const digital = `
   <div class="grid g4" style="gap:10px;margin-bottom:14px">${data.digital.acceso.map((m) => metric(m)).join("")}</div>
   <div class="grid g2">
    <div><h3>Brecha interna</h3>${hbars(data.digital.brecha.map((m) => [m.label, m.valor, m.nacional]), "#1d6a96", 100)}</div>
    <div><h3>Dos formas de llegar a la desinformación</h3>
     ${hbars([["Sin conexión", data.digital.mecanismo.exclusion, data.digital.mecanismo.nacional_exclusion], ["Saturación de redes", data.digital.mecanismo.hiperexposicion, data.digital.mecanismo.nacional_hiperexposicion]], "#b3541e", 100)}
     <p class="note">${esc(data.digital.mecanismo.nota)}</p></div>
   </div>`;

  const dieta = `
   <h3 style="margin-top:2px">Plataformas digitales utilizadas · % de la población conectada</h3>
   ${plat.length ? hbars(plat, "#2f7d52", 100) : "<p class='note'>Sin datos.</p>"}
   <div class="grid g4" style="gap:10px;margin-top:14px">
    ${metric(data.dieta_informativa.usa_redes)}${metric({ ...data.dieta_informativa.n_plataformas, unit: "" })}${metric(data.dieta_informativa.mensajeria)}${metric(data.dieta_informativa.conciencia)}
   </div>
   <div class="warn">${esc(data.dieta_informativa.advertencia)}</div>`;

  const resiliencia = `
  <div class="grid g2">
   <div><h3>Herramientas para contrastar</h3>
    ${hbars([["Escolaridad (años)", data.resiliencia.escolaridad.valor, data.resiliencia.escolaridad.nacional]], "#2f7d52", 20)}
    ${hbars(data.resiliencia.componentes.map((m) => [m.label, m.valor, m.nacional]), "#2f7d52", 100)}
    <p class="note">${esc(data.resiliencia.nota)}</p></div>
   <div><h3>Clima electoral · se actualiza en cada elección</h3>
    ${hbars(data.presion_coyuntural.componentes.map((m) => [m.label, m.valor, m.nacional]), "#7a4a9e", 100)}
    <p class="note">${esc(data.presion_coyuntural.nota)}</p></div>
  </div>`;

  const contexto = `
  <div class="grid g2" style="margin-bottom:16px">
   <div><h3>Estructura por edad</h3>${hbars(data.demografia.edades.map((e) => [e.label, e.valor, e.nacional]), "#4a6fa5", 40)}
    <p class="note">Barras: provincia. Marca vertical: promedio nacional. Censo 2022.</p></div>
   <div><h3>Autoadscripción étnica</h3>${stackChart(data.demografia.etnias)}<p class="note">Censo de Población y Vivienda 2022 (INEC).</p></div>
  </div>
  <h3>Condiciones socioeconómicas y educativas</h3>
  <div class="grid g4" style="gap:10px">${data.socioeconomico.map((m) => metric(m)).join("")}</div>`;

  const showGuide = flag("guia_reportero");
  const cuidado = [];
  if (conf) cuidado.push(`<span class="conf ${conf.cls}">${esc(conf.label)}</span>`);
  if (isImputed) cuidado.push("<span>Su opinión es el promedio del país.</span>");
  if (isBorderlineCase) cuidado.push("<span>Su perfil puede cambiar con ajustes menores.</span>");

  target.innerHTML = `
  <div class="kit-head">
   <h2 class="prov-title">${esc(data.provincia)}</h2>
   ${provinceFlags({ isImputed, isBorderlineCase, compact: true })}
  </div>

  <section class="card kit-main" id="sec-esencial">
   <div class="km-top">
    <div class="km-num">
     <span class="big">${fmt(data.ivei.indice)}</span>
     <span class="pill" style="background:${nivelColor};color:${inkFor(nivelColor)}">${esc(data.ivei.nivel)}</span>
     ${scoreRange({ confidenceRange: data.ivei.rango ?? null })}
    </div>
    <div class="km-txt">
     <p class="ess-lead"><b>Puesto ${data.ivei.puesto} de 24</b> <span class="pais">1 = la más vulnerable · país ${fmt(data.ivei.nacional)}</span></p>
     <p class="ess-tipo"><span class="pdot" style="background:${perfilColor(data.perfil_territorial.tipo)}"></span><b>${esc(perfilPlano(data.perfil_territorial.tipo))}</b></p>
    </div>
   </div>
   ${
     flag("cita_lista")
       ? `<div class="copiar">
      <p class="frase" id="fraseTexto">${esc(frase)}</p>
      <div class="cita-act"><button class="btn" id="btnFrase" type="button">Copiar frase</button><button class="btn gh" id="btnCita" type="button">Copiar párrafo completo</button></div>
      <details class="ver"><summary>Ver el párrafo completo</summary><blockquote id="citaTexto">${esc(cita)}</blockquote></details>
     </div>`
       : ""
   }
   <p class="km-conf">${cuidado.join(" ")} <button type="button" class="linkbtn noprint" id="btnSolidez">¿Qué tan firme?</button></p>
  </section>

  ${
    showGuide
      ? `<section class="card" id="sec-angulos" style="margin-top:16px">
   <div class="sec-h"><h2>Para citar</h2><button type="button" class="copybtn noprint" id="btnTodo">Copiar todo</button></div>
   <ul class="angulos">${angulos.map((a) => `<li><div>${a.html}</div><button type="button" class="copybtn noprint" data-copy="${esc(a.copia)}">Copiar</button></li>`).join("")}</ul>
   <details class="ver"><summary>Ideas para cubrirla</summary>${data.recomendaciones_periodismo.map((r) => `<div class="rec"><b>${esc(r.titulo)}</b><p>${esc(r.texto)}</p></div>`).join("")}</details>
   <details class="ver" id="sec-decidir"><summary>Qué puedes y qué no afirmar</summary>${decisionBlock({ extraSi: [`Para ${data.provincia}: ${canalSugerido(rec)}`], extraNo })}</details>
  </section>`
      : ""
  }

  <div class="kit-actions noprint">
   ${flag("ficha_descargable") ? `<button class="btn gh" type="button" id="btnFicha">Descargar ficha</button>` : ""}
   <label class="sr" for="essComparar">Comparar con otra provincia</label>
   <select id="essComparar" ${flag("vista_comparar") ? "" : "hidden"}><option value="">Comparar con…</option>${PROVINCIAS.filter((p) => p !== data.provincia).map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}</select>
   <button class="btn gh" type="button" id="btnVerMapa">Ver en el mapa</button>
   <button class="btn gh" type="button" id="btnEnlace">Copiar enlace</button>
   ${flag("solicitar_informacion") ? `<button class="btn gh" type="button" data-solicitar>Pedir más información</button>` : ""}
  </div>

  <details class="card sec" id="sec-todo" style="margin-top:16px">
   <summary><h2>Todos los datos de ${esc(data.provincia)}</h2><span class="sub-s">Factores, diagnóstico, perfil digital</span></summary>
   <div class="sec-body">
    <p class="note" style="margin:0 0 14px">${esc(data.perfil_territorial.descripcion)}</p>
    <div id="sec-resumen" style="margin-bottom:16px">
     <h3>Los cuatro factores</h3>
     <div class="frows">${data.dimensiones.map((d) => factorRow(d, data.provincia)).join("")}</div>
    </div>
    ${detalle("diagnostico", "Por qué tiene este nivel", "Lo que dicen los datos", diagnostico, true)}
    ${detalle("digital", "Perfil digital", "Acceso, uso y capacidades", digital)}
    ${detalle("dieta", `Dieta informativa`, "Qué plataformas usa la gente conectada", dieta)}
    ${detalle("resiliencia", "Capacidad de contrastar y clima electoral", "Educación, fuentes y ambiente", resiliencia)}
    ${detalle("contexto", "Contexto social", "Edad, etnia, pobreza y educación", contexto)}
   </div>
  </details>`;

  target.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copiarBtn(b, b.dataset.copy)));
  if ($("btnFrase")) $("btnFrase").onclick = (e) => copiarBtn(e.currentTarget, frase);
  if ($("btnCita")) $("btnCita").onclick = (e) => copiarBtn(e.currentTarget, cita);
  if ($("btnTodo")) $("btnTodo").onclick = (e) => copiarBtn(e.currentTarget, angulos.map((a) => `• ${a.copia}`).join("\n"));
  if ($("btnEnlace")) $("btnEnlace").onclick = (e) => copiarBtn(e.currentTarget, location.href);
  if ($("btnSolidez"))
    $("btnSolidez").onclick = () => {
      navigate("meto");
      requestAnimationFrame(() => $("solidez")?.scrollIntoView());
    };
  if ($("btnFicha")) $("btnFicha").onclick = () => downloadFicha(data.provincia);
  if ($("essComparar"))
    $("essComparar").onchange = (e) => {
      if (e.target.value) navigate(`comparar/${enc(data.provincia)}/${enc(e.target.value)}`);
    };
  $("btnVerMapa").onclick = () => {
    mapSel = provinceKey(data.provincia);
    navigate(`mapas/${capa}`);
    requestAnimationFrame(() => $("peek")?.scrollIntoView({ block: "nearest" }));
  };
}

// printing the kit should show everything, not only the open sections
addEventListener("beforeprint", () => document.querySelectorAll("details.sec").forEach((d) => (d.open = true)));

function dataOr(list, key) {
  return list.find((x) => x.key === key) || { label: key, valor: null, nacional: null, unit: "%", direction: 1 };
}

function stackChart(etnias) {
  const items = etnias.filter((e) => (e.valor ?? 0) > 0.5);
  const bars = items.map((e) => `<div style="width:${e.valor}%;background:${ETNIA_COLOR[e.key]}" title="${e.label}: ${fmt(e.valor)}%">${e.valor > 9 ? fmt(e.valor, 0) + "%" : ""}</div>`).join("");
  const legend = etnias
    .filter((e) => (e.valor ?? 0) > 0.4)
    .map((e) => `<span class="sw" style="background:${ETNIA_COLOR[e.key]}"></span>${e.label} ${fmt(e.valor)}%&nbsp;&nbsp;`)
    .join("");
  return `<div class="stack">${bars}</div><div style="font-size:10.5px;color:var(--mut);margin-top:6px;line-height:1.7">${legend}</div>`;
}

async function loadPerfil(provincia) {
  perfilActual = provincia;
  const box = document.getElementById("perfil");
  $("modulos").classList.add("compact");
  setMod(null);
  $("sinoGlobal").hidden = true;
  box.innerHTML = `<div class="asis-loading"><span class="tend-spinner"></span> Armando tu nota sobre ${esc(provincia)}…</div>`;
  try {
    const data = await getJSON(`/api/segmentadores/perfil/${encodeURIComponent(provincia)}`);
    if (provincia !== perfilActual) return;
    recordarReciente(provincia);
    renderPerfil(data);
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => box.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" }));
  } catch (e) {
    errorBox(box, `No se pudo cargar la nota de ${provincia}.`, () => loadPerfil(provincia));
  }
}

// Used by clicks from other tabs (map, ranking, scatter, datos) - those
// should actually switch to the Perfil tab. The initial preload on page
// load must NOT do this, or the site opens on Perfil instead of Mapas.
function goToPerfil(provincia) {
  navigate(`perfil/${enc(provincia)}`);
}

// ---------------------------------------------------------------------
// Ficha provincial (standalone downloadable report, one per province)
// ---------------------------------------------------------------------
// Every "puesto" (rank) below is computed live from the other 23
// provinces' own perfil data - never hardcoded, never estimated - using
// each field's own direction (1 = higher is more vulnerable, -1 = higher
// is better, 0 = no defined direction, shown as "—" rather than guessing
// which way to sort it.
let ALL_PERFILES_CACHE = null;
async function fetchAllPerfiles() {
  if (ALL_PERFILES_CACHE) return ALL_PERFILES_CACHE;
  ALL_PERFILES_CACHE = await Promise.all(PROVINCIAS.map((p) => getJSON(`/api/segmentadores/perfil/${encodeURIComponent(p)}`)));
  return ALL_PERFILES_CACHE;
}

function rankAmong(all, provincia, valueFn, direction) {
  if (!direction) return "—";
  const items = all.map((p) => ({ provincia: p.provincia, v: valueFn(p) })).filter((x) => x.v != null);
  items.sort((a, b) => (direction === -1 ? a.v - b.v : b.v - a.v));
  const idx = items.findIndex((x) => x.provincia === provincia);
  return idx === -1 ? "—" : `${idx + 1}/${items.length}`;
}

function fichaRow(label, valor, nacional, puesto, unit, source, decimals = 1) {
  const uSuffix = unit ? ` ${unit}` : "";
  return `<tr><td>${label}</td><td class="n"><b>${fmt(valor, decimals)}</b>${uSuffix}</td>
   <td class="n">${nacional != null ? fmt(nacional, decimals) : "s/d"}</td><td class="n">${puesto}</td>
   <td class="s">${source || ""}</td></tr>`;
}
function metaRow(m, all, provincia) {
  return fichaRow(m.label, m.valor, m.nacional, rankAmong(all, provincia, (p) => findMetaValue(p, m.key), m.direction), m.unit, m.source);
}
// meta-wrapped fields live at different nesting depths across the
// response; search the handful of arrays/objects that carry them by key.
function findMetaValue(perfil, key) {
  const pools = [perfil.demografia.edades, perfil.demografia.etnias, perfil.digital.acceso, perfil.digital.brecha, perfil.resiliencia.componentes, perfil.presion_coyuntural.componentes, perfil.socioeconomico, [perfil.resiliencia.escolaridad, perfil.dieta_informativa.usa_redes, perfil.dieta_informativa.n_plataformas, perfil.dieta_informativa.mensajeria, perfil.dieta_informativa.conciencia]];
  for (const pool of pools) {
    const hit = pool.find((m) => m && m.key === key);
    if (hit) return hit.valor;
  }
  return null;
}

function buildFichaHTML(data, all, nacIdent) {
  const pct = (v, total) => (v != null && total ? fmt((100 * v) / total, 1) + "%" : "—");
  const fecha = new Date().toLocaleDateString("es-EC");

  const seccionA = `
  <h2>A. Identificación territorial</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto / % país</th><th>Fuente</th></tr></thead><tbody>
  <tr><td>Provincia</td><td class="n"><b>${data.provincia}</b></td><td class="n">—</td><td class="n">—</td><td class="s">—</td></tr>
  ${fichaRow("Población total", data.identificacion.poblacion, nacIdent.poblacion, pct(data.identificacion.poblacion, nacIdent.poblacion), "hab.", "Censo de Población y Vivienda 2022 (INEC)", 0)}
  ${fichaRow("Población de 16 años y más", data.identificacion.poblacion_16mas, nacIdent.poblacion_16mas, pct(data.identificacion.poblacion_16mas, nacIdent.poblacion_16mas), "hab.", "CPV 2022 (INEC)", 0)}
  ${fichaRow("Superficie", data.identificacion.superficie_km2, nacIdent.superficie_km2, pct(data.identificacion.superficie_km2, nacIdent.superficie_km2), "km²", "geoBoundaries ADM1 (cálculo propio)", 0)}
  ${fichaRow("Densidad poblacional", data.identificacion.densidad, nacIdent.densidad, rankAmong(all, data.provincia, (p) => p.identificacion.densidad, 1), "hab/km²", "CPV 2022 · superficie ADM1")}
  ${fichaRow("Población urbana", data.identificacion.pct_urbano, nacIdent.pct_urbano, rankAmong(all, data.provincia, (p) => p.identificacion.pct_urbano, 1), "%", "CPV 2022 (INEC)")}
  ${fichaRow("Población rural", data.identificacion.pct_rural, nacIdent.pct_rural, rankAmong(all, data.provincia, (p) => p.identificacion.pct_rural, 1), "%", "CPV 2022 (INEC)")}
  </tbody></table>

  <div class="hero"><div style="display:flex;align-items:baseline;gap:14px">
  <div class="big">${fmt(data.ivei.indice)}</div><div><b>Vulnerabilidad ${(data.ivei.nivel || "").toLowerCase()}</b> ·
  puesto ${data.ivei.puesto} de 24 · promedio nacional ${fmt(data.ivei.nacional)}<br>
  <span class="note">${data.perfil_territorial.tipo}</span></div></div></div>`;

  const dimDir = { EST: 1, EXP: 1, RES: -1, PRE: 1 };
  const dimDesc = {
    EST: "Condiciones materiales, educativas y de acceso digital de base que aumentan la susceptibilidad.",
    EXP: "Contacto de la población con el ecosistema digital y las plataformas de circulación rápida.",
    RES: "Capacidades para detectar, contrastar y resistir información engañosa.",
    PRE: "Circunstancias temporales que pueden intensificar el riesgo en período electoral.",
  };
  const seccionB = `
  <h2>B. Índice de vulnerabilidad</h2>
  <table><thead><tr><th>Factor</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Composición</th></tr></thead><tbody>
  ${data.dimensiones
    .map((d) => fichaRow(d.nombre, d.valor, d.nacional, rankAmong(all, data.provincia, (p) => (p.dimensiones.find((x) => x.codigo === d.codigo) || {}).valor, dimDir[d.codigo]), "", dimDesc[d.codigo]))
    .join("")}
  <tr><td><b>Índice integrado (IVEI)</b></td><td class="n"><b>${fmt(data.ivei.indice)}</b></td>
  <td class="n">${fmt(data.ivei.nacional)}</td><td class="n">${data.ivei.puesto}/24</td>
  <td class="s">Combina carencias de base × dependencia de redes × falta de capacidad de contrastar; el clima electoral lo ajusta hasta ±7,5%</td></tr>
  ${(() => {
    const ivd = data.socioeconomico.find((m) => m.key === "ivd_original");
    return ivd ? metaRow(ivd, all, data.provincia) : "";
  })()}
  </tbody></table>`;

  const seccionC = `
  <h2>C. Perfil sociodemográfico</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${data.demografia.edades.map((m) => metaRow(m, all, data.provincia)).join("")}
  ${data.demografia.etnias.map((m) => metaRow(m, all, data.provincia)).join("")}
  ${data.socioeconomico.filter((m) => m.key !== "ivd_original").map((m) => metaRow(m, all, data.provincia)).join("")}
  </tbody></table>`;

  const seccionD = `
  <h2>D. Perfil digital</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${data.digital.acceso.map((m) => metaRow(m, all, data.provincia)).join("")}
  ${data.digital.brecha.map((m) => metaRow(m, all, data.provincia)).join("")}
  ${fichaRow("Sin conexión", data.digital.mecanismo.exclusion, data.digital.mecanismo.nacional_exclusion, rankAmong(all, data.provincia, (p) => p.digital.mecanismo.exclusion, 1), "0-100", "Elaboración propia")}
  ${fichaRow("Saturación de redes", data.digital.mecanismo.hiperexposicion, data.digital.mecanismo.nacional_hiperexposicion, rankAmong(all, data.provincia, (p) => p.digital.mecanismo.hiperexposicion, 1), "0-100", "Elaboración propia")}
  </tbody></table>
  <p class="note">${data.digital.mecanismo.nota}</p>`;

  const plat = Object.entries(data.dieta_informativa.plataformas || {}).filter(([, v]) => v != null);
  const seccionE = `
  <h2>E. Dieta informativa</h2>
  <table><thead><tr><th>Plataforma</th><th class="n">${data.provincia}</th><th class="n">Nacional</th></tr></thead><tbody>
  ${plat.map(([nombre]) => `<tr><td>${nombre}</td><td class="n"><b>${fmt(data.dieta_informativa.plataformas[nombre])}</b> %</td><td class="n">s/d</td></tr>`).join("")}
  </tbody></table>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${[data.dieta_informativa.usa_redes, data.dieta_informativa.n_plataformas, data.dieta_informativa.mensajeria, data.dieta_informativa.conciencia].map((m) => metaRow(m, all, data.provincia)).join("")}
  </tbody></table>
  <p class="note">${data.dieta_informativa.advertencia}</p>`;

  const seccionF = `
  <h2>F. Capacidad de contrastar</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${metaRow(data.resiliencia.escolaridad, all, data.provincia)}
  ${data.resiliencia.componentes.map((m) => metaRow(m, all, data.provincia)).join("")}
  </tbody></table>
  <p class="note">${data.resiliencia.nota}</p>`;

  const seccionG = `
  <h2>G. Clima electoral</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${data.presion_coyuntural.componentes.map((m) => metaRow(m, all, data.provincia)).join("")}
  </tbody></table>
  <p class="note">${data.presion_coyuntural.nota}</p>`;

  const seccionH = `
  <h2>H. Diagnóstico territorial</h2>
  ${data.diagnostico.map((p) => `<p style="margin:0 0 9px">${p}</p>`).join("")}`;

  const seccionI = `
  <h2>I. ¿Qué debería considerar un periodista o comunicador en ${data.provincia}?</h2>
  ${data.recomendaciones_periodismo.map((r) => `<h3>${r.titulo}</h3><p>${r.texto}</p>`).join("")}`;

  const metodologia = `
  <h2>Nota metodológica</h2>
  <p class="note">Todos los indicadores provienen de fuentes oficiales: Censo de Población y Vivienda 2022 (INEC),
  ENEMDU 2024 y su módulo TIC (INEC), y Latinobarómetro 2024. Los indicadores derivados del Latinobarómetro tienen
  muestras provinciales pequeñas y se suavizan hacia la media nacional; las provincias sin muestra propia reciben
  el valor nacional imputado. Los "puestos" de esta ficha se calculan en el momento de generarla, comparando esta
  provincia contra las otras 23 en el mismo indicador - un puesto 1 siempre corresponde al valor que más contribuye
  a la vulnerabilidad en ese indicador específico, no necesariamente al valor más alto en términos absolutos.
  ${data.n_lb != null ? `Casos Latinobarómetro en esta provincia: ${data.n_lb}. ` : ""}Este documento se generó
  automáticamente y no constituye una evaluación de personas, medios ni candidatos.</p>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Ficha provincial — ${data.provincia}</title><style>
body{font:13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#131a24;
 max-width:860px;margin:26px auto;padding:0 22px}
h1{font-size:21px;margin:0 0 3px;color:#1b3a5c}h2{font-size:14px;margin:22px 0 7px;color:#1b3a5c;
 border-bottom:2px solid #1b3a5c;padding-bottom:3px}
h3{font-size:12.5px;margin:14px 0 4px}
.sub{color:#657388;font-size:12px;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px}
th{text-align:left;background:#1b3a5c;color:#fff;padding:5px 7px;font-size:10.5px;font-weight:600}
td{padding:4px 7px;border-bottom:1px solid #eef1f5}
tr:nth-child(even) td{background:#f7f9fb}
.n{text-align:right;font-variant-numeric:tabular-nums}
.s{color:#8b98a9;font-size:10px}
.hero{background:#f2f6fa;border:1px solid #dde5ee;border-radius:9px;padding:14px 16px;margin:12px 0}
.big{font-size:34px;font-weight:700;color:#1b3a5c;line-height:1}
p{max-width:82ch}.note{font-size:11px;color:#657388}
@media print{body{margin:0}h2{page-break-after:avoid}table{page-break-inside:avoid}}
</style></head><body>
<h1>Ficha provincial de vulnerabilidad electoral — ${data.provincia}</h1>
<p class="sub">Observatorio de Vulnerabilidad ante la Desinformación Electoral · Ecuador ·
Censo 2022, ENEMDU 2024 y Latinobarómetro 2024 · generada el ${fecha}<br>${CORTE_FRASE}</p>
${seccionA}${seccionB}${seccionC}${seccionD}${seccionE}${seccionF}${seccionG}${seccionH}${seccionI}${metodologia}
</body></html>`;
}

async function downloadFicha(provincia) {
  if (!provincia) return;
  const btn = document.getElementById("btnFicha");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando…";
  try {
    const [data, all] = await Promise.all([getJSON(`/api/segmentadores/perfil/${encodeURIComponent(provincia)}`), fetchAllPerfiles()]);
    const html = buildFichaHTML(data, all, MAPA.nacional);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ficha_${provincia.replace(/\s+/g, "_")}_vulnerabilidad_electoral.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast("No se pudo generar la ficha. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ---------------------------------------------------------------------
// Comparar
// ---------------------------------------------------------------------
function initComparar() {
  const a = document.getElementById("cmpA"),
    b = document.getElementById("cmpB");
  a.innerHTML = b.innerHTML = PROVINCIAS.map((p) => `<option value="${p}">${p}</option>`).join("");
  a.value = PROVINCIAS[0];
  b.value = PROVINCIAS[1] || PROVINCIAS[0];
  const sync = () => {
    navigate(`comparar/${enc(a.value)}/${enc(b.value)}`, { replace: true });
    renderCmp();
  };
  a.onchange = sync;
  b.onchange = sync;
  renderCmp();
}

// ---------------------------------------------------------------------
// Comparing two territories: the verdict first, the evidence after
// ---------------------------------------------------------------------
function deltaTableHTML(d) {
  const { a, b } = d;
  const rows = [["Nivel de vulnerabilidad", a.ivei, b.ivei, 1], ...a.dimensiones.map((x, i) => [x.nombre, x.valor, b.dimensiones[i].valor, x.codigo === "RES" ? -1 : 1])];
  return `<div style="overflow-x:auto"><table class="delta"><thead><tr><th>Factor</th><th class="num">${esc(a.provincia)}</th><th class="num">${esc(b.provincia)}</th><th class="num">Diferencia</th></tr></thead><tbody>${rows
    .map(([label, va, vb, dir]) => {
      const diff = va == null || vb == null ? null : va - vb;
      const peor = diff == null ? "" : Math.abs(diff) < 2 ? "eq" : dir * diff > 0 ? "up" : "dn";
      const txt = diff == null ? "—" : `${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))}`;
      return `<tr><td>${esc(label)}</td><td class="num"><b>${fmt(va)}</b></td><td class="num"><b>${fmt(vb)}</b></td><td class="num ${peor}">${txt}</td></tr>`;
    })
    .join("")}</tbody></table></div>
    <p class="note">Rojo: ${esc(a.provincia)} está peor que ${esc(b.provincia)}. Verde: mejor. Gris: menos de 2 puntos de diferencia.</p>`;
}

function compareText(d) {
  const { a, b } = d;
  const diff = a.ivei - b.ivei;
  const [mas, menos] = diff >= 0 ? [a, b] : [b, a];
  const frase =
    Math.abs(diff) < 2
      ? `${a.provincia} y ${b.provincia} tienen un nivel de vulnerabilidad casi igual (${fmt(a.ivei)} y ${fmt(b.ivei)}).`
      : `${mas.provincia} tiene más vulnerabilidad electoral que ${menos.provincia}: ${fmt(mas.ivei)} frente a ${fmt(menos.ivei)} (${fmt(Math.abs(diff))} puntos más).`;
  const top = a.dimensiones
    .map((x, i) => ({ nombre: x.nombre, va: x.valor, vb: b.dimensiones[i].valor }))
    .filter((x) => x.va != null && x.vb != null)
    .sort((p, q) => Math.abs(q.va - q.vb) - Math.abs(p.va - p.vb))[0];
  const detalle = top ? `Lo que más los separa: ${top.nombre} (${a.provincia} ${fmt(top.va)}, ${b.provincia} ${fmt(top.vb)}).` : "";
  const copia = `${frase} ${detalle} Fuente: Observatorio de Vulnerabilidad ante la Desinformación Electoral (IVEI 2024). El índice describe territorios, no personas.`.replace(/\s+/g, " ");
  return { frase, detalle, copia };
}

async function renderCmp() {
  const a = document.getElementById("cmpA").value,
    b = document.getElementById("cmpB").value;
  const target = document.getElementById("comparar");
  if (a === b) {
    target.innerHTML = `<div class="warn" role="status">Elegiste la misma provincia dos veces. Cambia una de las dos para ver las diferencias.</div>`;
    return;
  }
  target.innerHTML = `<div class="asis-loading"><span class="tend-spinner"></span> Comparando ${esc(a)} y ${esc(b)}…</div>`;
  let data;
  try {
    data = await getJSON(`/api/segmentadores/comparar?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  } catch (e) {
    return errorBox(target, "No se pudo hacer la comparación.", renderCmp);
  }
  const { frase, detalle, copia } = compareText(data);

  const rows = data.indicadores
    .map((row) => {
      let cls = "eq";
      if (row.diferencia != null) {
        cls = row.direction === 1 ? (row.diferencia > 0 ? "up" : row.diferencia < 0 ? "dn" : "eq") : row.direction === -1 ? (row.diferencia > 0 ? "dn" : row.diferencia < 0 ? "up" : "eq") : "eq";
      }
      return `<tr><td>${row.label}<div class="srcline">${row.source} · ${row.unit}</div></td>
      <td class="num"><b>${fmt(row.a)}</b></td><td class="num"><b>${fmt(row.b)}</b></td>
      <td class="num ${cls}">${row.diferencia == null ? "" : (row.diferencia >= 0 ? "+" : "−") + fmt(Math.abs(row.diferencia))}</td>
      <td class="num" style="color:var(--mut)">${fmt(row.nacional)}</td>
      <td style="color:var(--mut);font-size:11.5px">${row.unit}</td></tr>`;
    })
    .join("");

  target.innerHTML = `
  <section class="card cmp-verdict">
   <h2>${esc(frase)}</h2>
   ${detalle ? `<p class="pais" style="margin:6px 0 0;font-size:14px">${esc(detalle)}</p>` : ""}
   <div class="cita-act" style="margin-top:12px"><button class="btn" id="btnCmpCopia" type="button">Copiar comparación</button><button class="btn gh" id="btnCmpEnlace" type="button">Copiar enlace</button></div>
  </section>
  <section class="card" style="margin-top:16px"><h3>Diferencia por factor</h3>${deltaTableHTML(data)}</section>
  <details class="card sec" style="margin-top:16px"><summary><h2>Las dos provincias lado a lado</h2></summary><div class="sec-body"><div class="grid g2">
   ${[data.a, data.b]
     .map(
       (p) => `<div><h3>${esc(p.provincia)}</h3>
    <div style="display:flex;align-items:baseline;gap:10px"><div class="big" style="font-size:34px">${fmt(p.ivei)}</div>
     <span class="pill" style="background:${col("IVEI", p.ivei)};color:${inkFor(col("IVEI", p.ivei))}">${esc(p.nivel)}</span></div>
    <div style="margin-top:12px">${p.dimensiones.map((d) => dimRow(d.nombre, d.valor, null, d.color)).join("")}</div>
    <p class="note"><span class="pdot" style="background:${perfilColor(p.perfil)}"></span><b>${esc(perfilPlano(p.perfil))}.</b></p></div>`
     )
     .join("")}
  </div></div></details>
  <details class="card sec" style="margin-top:12px"><summary><h2>Todos los indicadores</h2><span class="sub-s">Indicador por indicador, con fuente</span></summary><div class="sec-body"><div style="overflow:auto;max-height:600px">
  <table><thead><tr><th>Indicador</th><th class="num">${esc(data.a.provincia)}</th>
  <th class="num">${esc(data.b.provincia)}</th><th class="num">Dif.</th><th class="num">País</th>
  <th>Unidad</th></tr></thead><tbody>${rows}</tbody></table></div></div></details>`;
  $("btnCmpCopia").onclick = (e) => copiarBtn(e.currentTarget, copia);
  $("btnCmpEnlace").onclick = (e) => copiarBtn(e.currentTarget, location.href);
}

// ---------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------
let TABLA_DATA = null;
let sortKey = "rank",
  sortDir = 1;

async function initDatos() {
  TABLA_DATA = await getJSON("/api/segmentadores/tabla");
  document.getElementById("buscarDatos").oninput = renderTabla;
  renderTabla();
}

function renderTabla() {
  const search = normalize(document.getElementById("buscarDatos").value);
  const filas = TABLA_DATA.filas
    .filter((f) => normalize(f.provincia).includes(search))
    .slice()
    .sort((a, b) => {
      const va = a[sortKey],
        vb = b[sortKey];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string") return sortDir * va.localeCompare(vb);
      return sortDir * (va - vb);
    });

  const headCols = TABLA_DATA.columnas.map((c) => `<th class="num" data-k="${c.key}" title="${c.key} · ${c.unit}">${c.label}</th>`).join("");
  const bodyRows = filas
    .map(
      (f) => `<tr data-p="${f.provincia}"><td>${f.rank != null ? Math.round(f.rank) : "—"}</td><td>${f.provincia}</td><td>${f.nivel}</td>
    ${TABLA_DATA.columnas.map((c) => `<td class="num">${f[c.key] != null ? fmt(f[c.key]) : "—"}</td>`).join("")}</tr>`
    )
    .join("");
  const footCols = TABLA_DATA.columnas.map((c) => `<td class="num">${TABLA_DATA.nacional[c.key] != null ? fmt(TABLA_DATA.nacional[c.key]) : "—"}</td>`).join("");

  document.getElementById("tabla").innerHTML = `
  <thead><tr><th data-k="rank">#</th><th data-k="provincia">Provincia</th><th data-k="nivel">Nivel</th>${headCols}</tr></thead>
  <tbody>${bodyRows}</tbody>
  <tfoot><tr style="font-weight:700;background:#f7f9fb"><td colspan="3">Nacional</td>${footCols}</tr></tfoot>`;

  document.querySelectorAll("#tabla th").forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.k;
      sortDir = sortKey === k ? -sortDir : 1;
      sortKey = k;
      renderTabla();
    };
  });
  document.querySelectorAll("#tabla tbody tr").forEach((tr) => {
    tr.onclick = () => goToPerfil(tr.dataset.p);
  });
}

// ---------------------------------------------------------------------
// Metodología
// ---------------------------------------------------------------------
async function initMeto() {
  const data = await getJSON("/api/segmentadores/metodologia");
  document.getElementById("meto").innerHTML = `
  <h2>Nota metodológica</h2>
  <p>${data.descripcion}</p>
  <h4>Dimensiones</h4>
  <ul>${Object.entries(data.dimensiones)
    .map(([n, t]) => `<li><b>${n}:</b> ${t}</li>`)
    .join("")}</ul>
  <h4>Mecanismos digitales</h4>
  <ul>${Object.entries(data.mecanismos_digitales)
    .map(([n, t]) => `<li><b>${n}:</b> ${t}</li>`)
    .join("")}</ul>
  <h4>Fuentes</h4>
  <ul>${data.fuentes.map((f) => `<li>${f}</li>`).join("")}</ul>
  <p><b>Cobertura:</b> ${data.cobertura}</p>
  <h4>Limitaciones</h4>
  <p>${data.limitaciones}</p>
  <div class="warn">${data.advertencia}</div>`;
}

// ---------------------------------------------------------------------
// Temas más hablados por provincia
// ---------------------------------------------------------------------
let tendSel = null;
let tendOpenTerm = null;
async function runTendencias(province) {
  const box = document.getElementById("tendResult");
  if (!province) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = `<div class="asis-loading"><span class="tend-spinner"></span> Leyendo X y medios sobre ${province}…</div>`;
  try {
    const res = await getJSON(`/api/trends?province=${encodeURIComponent(province)}`);
    if (res.note) {
      box.innerHTML = `<p class="note">${res.note}</p>`;
      return;
    }
    const all = [...res.actores, ...res.temas];
    box.innerHTML = `
    <p class="note">${res.total_analizados} publicaciones analizadas · X y medios</p>
    <div class="trend-chip-row">${all
      .map((t, i) => `<button class="trend-chip${res.actores.includes(t) ? " actor" : ""}" data-i="${i}">${t.term}<span class="count">${t.count}</span></button>`)
      .join("")}</div>
    <div id="tendSamples"></div>
    <p class="caveat">Conteo en muestra pequeña — pista para reportear, no dato citable.</p>`;
    box.querySelectorAll(".trend-chip").forEach((chip) => {
      chip.onclick = () => {
        const t = all[Number(chip.dataset.i)];
        tendOpenTerm = tendOpenTerm === t.term ? null : t.term;
        document.getElementById("tendSamples").innerHTML =
          tendOpenTerm == null
            ? ""
            : `<div class="trend-samples">${(all.find((x) => x.term === tendOpenTerm)?.samples || []).map((s) => `<a href="${s.link}" target="_blank" rel="noopener noreferrer">${s.title}</a>`).join("")}</div>`;
      };
    });
  } catch (e) {
    box.innerHTML = `<div class="asis-loading">No se pudo leer la conversación.</div>`;
  }
}

function drawTendMapSVG(svgEl, pathsMap) {
  svgEl.innerHTML = "";
  for (const [key, d] of Object.entries(pathsMap)) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "tend-pv");
    path.dataset.k = key;
    path.setAttribute("role", "button");
    path.setAttribute("tabindex", "0");
    const displayName = PROVINCIAS.find((p) => provinceKey(p) === key) || key;
    path.addEventListener("mouseenter", (e) => {
      tipShow(e.clientX, e.clientY, `<b>${displayName}</b>`);
    });
    path.addEventListener("mousemove", (e) => tipMove(e.clientX, e.clientY));
    path.addEventListener("mouseleave", tipHide);
    path.addEventListener("click", () => {
      tendSel = key;
      paintTendMap();
      document.getElementById("tendProvLabel").textContent = displayName;
      runTendencias(displayName);
    });
    svgEl.appendChild(path);
  }
}

function paintTendMap() {
  document.querySelectorAll(".tend-pv").forEach((el) => {
    el.classList.toggle("sel", el.dataset.k === tendSel);
  });
}

function initAsistente() {
  if (PATHS) {
    drawTendMapSVG(document.getElementById("tend-map"), PATHS.mainland);
    drawTendMapSVG(document.getElementById("tend-map-gal"), PATHS.galapagos);
  }
}

// ---------------------------------------------------------------------
// Metodología: lo que el índice mide, qué tan firme es cada cifra y para qué
// decisión periodística sirve (y para cuál no).
// ---------------------------------------------------------------------
const CORTE_FRASE = "Datos con corte a la última publicación de cada fuente (Censo 2022, ENEMDU 2024, Latinobarómetro 2024, MINTEL 2023), sujetos a actualización.";

const SEIS_PREGUNTAS = [
  ["¿De dónde viene?", "Fuente, año, cobertura y fecha de corte.", "Censo 2022, ENEMDU 2024, módulo TIC 2024, Latinobarómetro 2024 y MINTEL 2023."],
  ["¿Por qué entra?", "Qué parte de la vulnerabilidad representa.", "Dos formas de llegar a la desinformación: quedar sin conexión (exclusión digital) o vivir saturado de redes (hiperexposición)."],
  ["¿Qué se transforma?", "Pasos desde el dato crudo hasta el puntaje.", "Suavizado bayesiano, posestratificación, normalización mín–máx y agregación geométrica."],
  ["¿Qué significa?", "Cómo leer un puntaje alto o bajo.", "Es un índice relativo entre provincias, no un nivel absoluto de desinformación."],
  ["¿Qué puede fallar?", "Riesgos y límites.", "Muestras débiles, valores imputados en cuatro provincias y una dieta informativa medida solo en su parte digital. Margen orientativo del índice: de ±5 a ±7 puntos."],
  ["¿Qué lo valida?", "Pruebas que respaldan el dato.", "Correlación de 0,92 con la ENEMDU y prueba de ruido de ±2 puntos. El orden de las provincias es estable sin el modulador (ρ = 0,99). Las pruebas de pesos, de variables débiles y de fuente alternativa están en curso."],
];

const DECISIONES = [
  ["Dónde priorizar una verificación", "Sí. Si un contenido circula en una provincia con perfil vulnerable, sube de prioridad.", "No dice si el contenido es falso."],
  ["Por qué canal llegar", "Sí. Donde hay mucha gente sin conexión, hacen falta radio y aliados locales; donde hay saturación de redes, hacen falta redes y fuentes con credibilidad.", "No mide radio, televisión ni la conversación familiar."],
  ["A quién culpar o señalar", "No.", "El índice describe territorios, no personas."],
  ["Comparar con otro país o año", "No, sin fijar anclajes.", "Es un índice relativo."],
  ["Segmentar audiencias por debajo de la provincia", "No.", "La resolución provincial es una salvaguarda deliberada."],
];

function solidezResumen() {
  const todas = MAPA?.provincias ?? [];
  const debiles = todas.filter((p) => p.n_lb < MUESTRA_DEBIL);
  const sinMuestra = todas.filter((p) => p.n_lb === 0).map((p) => p.provincia);
  return { total: todas.length, debiles: debiles.length, sinMuestra };
}

function metodoTabla(cabeceras, filas) {
  return `<div style="overflow-x:auto"><table class="ftab"><thead><tr>${cabeceras.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${filas
    .map((f) => `<tr>${f.map((c, i) => `<td${i === 0 ? ' style="font-weight:650;white-space:nowrap"' : ""}>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const GLOSARIO = [
  ["Nivel de vulnerabilidad", "IVEI", "Cuántos factores del territorio facilitan que la desinformación llegue y prospere, de 0 a 100. No mide a las personas ni cuánta desinformación circula."],
  ["Carencias de base", "vulnerabilidad estructural", FACTORES.EST.que],
  ["Dependencia de redes", "exposición informativa", FACTORES.EXP.que],
  ["Capacidad de contrastar", "resiliencia informativa", FACTORES.RES.que],
  ["Clima electoral", "presión coyuntural", FACTORES.PRE.que],
  ["Sin conexión", "exclusión digital", FACTORES.EXCLUSION.que],
  ["Saturación de redes", "hiperexposición digital", FACTORES.HIPEREXP.que],
  ["Puesto", "", "Lugar entre las 24 provincias. El puesto 1 es la más vulnerable."],
  ["Promedio del país", "valor nacional", "Referencia para saber si una cifra está por encima o por debajo de lo habitual."],
  ["Valor imputado", "", "Cuando una provincia no tiene encuestados, se usa el promedio del país en su lugar. En el mapa se marca con borde punteado."],
  ["Solidez", "", "Qué tan firme es una cifra según cómo se midió: conteo completo (alta), encuesta con muestra suficiente (media) o muestra débil (baja)."],
];

function renderMetodoExtra() {
  const r = solidezResumen();
  const nivel = (n, t) => `<span class="sol ${n}"><span class="pips" aria-hidden="true"><i></i><i></i><i></i></span>Solidez ${n}</span> ${t}`;
  $("metoExtra").innerHTML = `
  <nav class="jump noprint" aria-label="Ir a una sección">
   <button type="button" data-j="decisiones">Qué puedo afirmar</button>
   <button type="button" data-j="solidez">Qué tan firme es</button>
   <button type="button" data-j="glosario">Glosario</button>
   <button type="button" data-j="ficha-indice">Seis preguntas</button>
   <button type="button" data-j="meto">Nota técnica</button>
  </nav>
  <div class="card" id="decisiones" style="margin-bottom:16px">
   <h2>Qué puedes afirmar con el índice y qué no</h2>
   <p class="fintro" style="margin-bottom:12px">El índice dice dónde un mensaje encuentra un terreno más frágil. No reemplaza el criterio editorial.</p>
   ${metodoTabla(["Decisión", "El índice puede apoyarla", "El índice no puede apoyarla"], DECISIONES.map(([d, si, no]) => [d, si, no]))}
  </div>

  <div class="card" id="solidez" style="margin-bottom:16px">
   <h2>Qué tan firme es cada cifra</h2>
   <p class="fintro">Junto a cada dato del perfil provincial aparece una marca de solidez. Depende de cómo se midió el dato, no de si el valor es alto o bajo.</p>
   ${metodoTabla(
     ["Nivel", "Qué significa", "Fuentes"],
     [
       [nivel("alta", ""), "Conteo completo de la población, sin error muestral.", "Censo 2022."],
       [nivel("media", ""), "Encuesta oficial con muestra suficiente para la provincia.", `ENEMDU 2024; Latinobarómetro con ${MUESTRA_DEBIL} casos o más en la provincia.`],
       [nivel("baja", ""), "Muestra débil, valor imputado o encuesta que no representa a la provincia.", `Latinobarómetro con menos de ${MUESTRA_DEBIL} casos o sin muestra propia; ENEMDU-TIC 2024 (solo nacional); MINTEL 2023 (participación voluntaria).`],
     ]
   )}
   <p class="fnote"><b>En este momento:</b> ${r.debiles} de ${r.total} provincias tienen menos de ${MUESTRA_DEBIL} casos del Latinobarómetro. ${
     r.sinMuestra.length ? `${r.sinMuestra.length} no tienen ninguno (${r.sinMuestra.join(", ")}) y reciben el valor nacional; en el mapa se marcan con borde punteado.` : ""
   } El umbral de ${MUESTRA_DEBIL} casos es el criterio de trabajo y se está confirmando con los microdatos.</p>
   <p class="fnote" style="border:0;margin-top:4px;padding-top:0">${CORTE_FRASE}</p>
  </div>

  <div class="card" id="glosario" style="margin-bottom:16px">
   <h2>Glosario: qué significa cada término</h2>
   <p class="fintro" style="margin-bottom:12px">Usamos palabras de redacción. Entre paréntesis está el nombre técnico, por si lo ves en otro documento.</p>
   <dl class="glos">${GLOSARIO.map(([t, tec, d]) => `<dt>${t}${tec ? ` <span>(${tec})</span>` : ""}</dt><dd>${d}</dd>`).join("")}</dl>
  </div>

  <div class="card" id="ficha-indice" style="margin-bottom:16px">
   <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
    <div><h2>Ficha del índice en seis preguntas</h2>
    <p class="fintro" style="margin-bottom:12px">Lo que cualquier periodista puede leer antes de usar el índice.</p></div>
    <button class="btn gh noprint" id="btnFichaMeto" type="button">Descargar ficha metodológica</button>
   </div>
   ${metodoTabla(["Pregunta", "Qué responde", "En OVADE"], SEIS_PREGUNTAS)}
  </div>`;
  $("btnFichaMeto").onclick = downloadFichaMetodologica;
  document.querySelectorAll("[data-j]").forEach((b) => (b.onclick = () => $(b.dataset.j)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })));
}

function downloadFichaMetodologica() {
  const tabla = (cab, filas) =>
    `<table><thead><tr>${cab.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ficha metodológica del índice</title><style>
body{font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#131a24;max-width:860px;margin:26px auto;padding:0 22px}
h1{font-size:22px;color:#1b3a5c;margin:0 0 4px}h2{font-size:15px;color:#1b3a5c;border-bottom:2px solid #1b3a5c;padding-bottom:3px;margin:24px 0 8px}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;background:#1b3a5c;color:#fff;padding:6px 8px}
td{padding:6px 8px;border-bottom:1px solid #dfe5ec;vertical-align:top}td:first-child{font-weight:600;white-space:nowrap}
.n{color:#5f6b7d;font-size:12px}@media print{body{margin:0}table{page-break-inside:avoid}}
</style></head><body>
<h1>Ficha metodológica del índice</h1>
<p class="n">Observatorio de Vulnerabilidad ante la Desinformación Electoral · Ecuador · generada el ${new Date().toLocaleDateString("es-EC")}</p>
<h2>Seis preguntas</h2>${tabla(["Pregunta", "Qué responde", "En OVADE"], SEIS_PREGUNTAS)}
<h2>Qué decisión periodística apoya el índice y cuál no</h2>${tabla(["Decisión", "Puede apoyarla", "No puede apoyarla"], DECISIONES)}
<p class="n">${CORTE_FRASE} El índice describe territorios, no personas, medios ni candidatos.</p>
</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "Ficha_metodologica_OVADE.html" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------
// Solicitar información al observatorio
// ---------------------------------------------------------------------
function initSolicitud() {
  const dlg = $("dlgSolicitud");
  const form = $("formSolicitud");
  const sel = $("solProvincia");
  sel.innerHTML = `<option value="">Todo el país</option>` + PROVINCIAS.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");

  const open = () => {
    $("solOk").hidden = true;
    form.hidden = false;
    $("solErr").textContent = "";
    sel.value = currentView === "perfil" && perfilActual ? perfilActual : "";
    dlg.showModal();
    $("solNombre").focus();
  };
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-solicitar]")) open();
    if (e.target.closest("[data-cerrar-solicitud]")) dlg.close();
  });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const send = $("solEnviar");
    send.disabled = true;
    send.textContent = "Enviando…";
    $("solErr").textContent = "";
    const v = (id) => $(id).value;
    try {
      await postJSON("/api/solicitudes", {
        nombre: v("solNombre"),
        correo: v("solCorreo"),
        organizacion: v("solOrg"),
        provincia: sel.value,
        necesidad: v("solNecesidad"),
        uso: v("solUso"),
        medio: tenant().slug,
        web: v("solWeb"),
      });
      form.hidden = true;
      form.reset();
      $("solOk").hidden = false;
      $("solCerrarOk").focus();
    } catch (err) {
      $("solErr").textContent = err.status ? err.message : "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.";
    } finally {
      send.disabled = false;
      send.textContent = "Enviar solicitud";
    }
  };
}

// ---------------------------------------------------------------------
// Map selection: tap a province and its essentials appear beside the map,
// without leaving it. The full profile is one more click away.
// ---------------------------------------------------------------------
function renderPeek() {
  const box = $("peek");
  const p = mapSel ? byKey()[mapSel] : null;
  if (!p) {
    box.innerHTML = `<h3>Resumen rápido</h3><p class="note" style="margin:0">Elige una provincia en el mapa o en el ranking y verás aquí lo esencial, sin salir del mapa.</p>`;
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
  <p class="note" style="margin:6px 0 10px">Puesto ${Math.round(p.rank)} de 24 (1 = la más vulnerable) · promedio del país ${fmt(MAPA.nacional.IVEI)}</p>
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
    mapSel = null;
    paintMap();
  };
  $("peekPerfil").onclick = () => goToPerfil(p.provincia);
  if ($("peekCita")) $("peekCita").onclick = (e) => copiarBtn(e.currentTarget, citaDeRegistro(p));
}

function selectProvince(name) {
  mapSel = provinceKey(name);
  paintMap();
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("peek").scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
}

// ---------------------------------------------------------------------
// Home: "¿Qué necesitas hoy?" - three tasks, each a collapsible module
// ---------------------------------------------------------------------
let modActivo = null;
const MODS = {
  prov: { html: modProvHTML, bind: modProvBind },
  cmp: { html: modCmpHTML, bind: modCmpBind },
  crit: { html: modCritHTML, bind: modCritBind },
};

function setMod(name) {
  modActivo = name;
  document.querySelectorAll(".mod-h").forEach((b) => {
    const on = b.dataset.mod === name;
    b.setAttribute("aria-expanded", String(on));
    b.classList.toggle("on", on);
  });
  const panel = $("modPanel");
  panel.hidden = !name;
  if (!name) {
    panel.innerHTML = "";
    return;
  }
  panel.innerHTML = MODS[name].html();
  MODS[name].bind();
}

function initModulos() {
  document.querySelectorAll(".mod-h").forEach((b) => {
    b.onclick = () => setMod(modActivo === b.dataset.mod ? null : b.dataset.mod);
  });
  setMod("prov");
}

// Recently covered provinces: a journalist usually returns to the same few.
const RECIENTES_KEY = "ovade_recientes";
function recientes() {
  try {
    return JSON.parse(localStorage.getItem(RECIENTES_KEY) || "[]").filter((p) => PROVINCIAS.includes(p));
  } catch (_) {
    return [];
  }
}
function recordarReciente(p) {
  try {
    localStorage.setItem(RECIENTES_KEY, JSON.stringify([p, ...recientes().filter((x) => x !== p)].slice(0, 4)));
  } catch (_) {}
}

let provOrden = "az";
function provBtn(p) {
  const r = byKey()[provinceKey(p)] ?? {};
  return `<button type="button" role="listitem" class="prov-btn${p === perfilActual ? " on" : ""}" data-p="${esc(p)}"><span class="dot" style="background:${col("IVEI", r.IVEI)}"></span>${esc(p)}</button>`;
}
function provGridHTML() {
  const list = [...PROVINCIAS].sort(provOrden === "az" ? (a, b) => a.localeCompare(b, "es") : (a, b) => (byKey()[provinceKey(a)]?.rank ?? 99) - (byKey()[provinceKey(b)]?.rank ?? 99));
  return list.map(provBtn).join("");
}
function modProvHTML() {
  const rec = recientes();
  return `<label class="sr" for="modProvInput">Provincia</label>
   <input id="modProvInput" class="mod-input" type="text" placeholder="Escribe una provincia: Pichincha, Guayas…" autocomplete="off" spellcheck="false">
   ${rec.length ? `<div class="recent"><span>Recientes</span>${rec.map(provBtn).join("")}</div>` : ""}
   <div class="grid-head"><span class="pais"><span class="dot" style="background:${rampColor(0.1)}"></span>menos <span class="dot" style="background:${rampColor(0.95)}"></span>más vulnerable</span>
    <div class="seg" role="group" aria-label="Orden"><button type="button" data-ord="az" aria-pressed="${provOrden === "az"}">A–Z</button><button type="button" data-ord="rank" aria-pressed="${provOrden === "rank"}">Más vulnerables primero</button></div></div>
   <div class="prov-grid" id="modProvGrid" role="list">${provGridHTML()}</div>`;
}
function modProvBind() {
  const input = $("modProvInput");
  const grid = $("modProvGrid");
  const filter = () => {
    const q = provinceKey(input.value.trim());
    grid.querySelectorAll(".prov-btn").forEach((b) => (b.hidden = !!q && !provinceKey(b.dataset.p).includes(q)));
  };
  const go = (e) => {
    const b = e.target.closest(".prov-btn");
    if (b) goToPerfil(b.dataset.p);
  };
  grid.onclick = go;
  document.querySelector(".recent")?.addEventListener("click", go);
  input.oninput = filter;
  input.onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const first = [...grid.querySelectorAll(".prov-btn")].find((b) => !b.hidden);
    if (first) goToPerfil(first.dataset.p);
    else toast("No encontré esa provincia. Prueba con menos letras.");
  };
  document.querySelectorAll("[data-ord]").forEach((b) => {
    b.onclick = () => {
      provOrden = b.dataset.ord;
      document.querySelectorAll("[data-ord]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      grid.innerHTML = provGridHTML();
      filter();
    };
  });
}

function modCmpHTML() {
  const opts = (sel) => PROVINCIAS.map((p) => `<option value="${esc(p)}"${p === sel ? " selected" : ""}>${esc(p)}</option>`).join("");
  const a = perfilActual || PROVINCIAS[0];
  const b = PROVINCIAS.find((p) => p !== a) || a;
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
  box.innerHTML = `<div class="asis-loading"><span class="tend-spinner"></span> Comparando…</div>`;
  try {
    const d = await getJSON(`/api/segmentadores/comparar?a=${enc(a)}&b=${enc(b)}`);
    const { frase, copia } = compareText(d);
    box.innerHTML = `<p class="cmp-frase">${esc(frase)}</p>${deltaTableHTML(d)}
    <div class="cita-act"><button class="btn" id="cmpCopia" type="button">Copiar comparación</button><button class="btn gh" id="cmpFull" type="button">Ver comparación completa</button></div>`;
    $("cmpCopia").onclick = (e) => copiarBtn(e.currentTarget, copia);
    $("cmpFull").onclick = () => navigate(`comparar/${enc(a)}/${enc(b)}`);
  } catch (e) {
    errorBox(box, "No se pudo hacer la comparación.", renderCmpMini);
  }
}

function modCritHTML() {
  return `<div class="crit"><div class="crit-list" role="group" aria-label="Decisión editorial">${DECISIONES.map(([d], i) => `<button type="button" class="crit-b" data-i="${i}">${esc(d)}</button>`).join("")}</div>
  <div id="critOut" class="crit-out" aria-live="polite"><p class="note">Elige una decisión editorial para ver si el índice la respalda.</p></div></div>`;
}
function modCritBind() {
  document.querySelectorAll(".crit-b").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".crit-b").forEach((x) => x.classList.toggle("on", x === b));
      const [d, si, no] = DECISIONES[Number(b.dataset.i)];
      const respalda = !/^No\b/.test(si);
      $("critOut").innerHTML = `<div class="verdict ${respalda ? "ok" : "ko"}"><h3>${respalda ? ICON.check + "El índice sí puede apoyar esto" : ICON.cross + "El índice no puede apoyar esto"}</h3>
        <p><b>${esc(d)}.</b> ${esc(respalda ? si : no)}</p>
        ${respalda ? `<p class="lim"><b>Pero ojo:</b> ${esc(no)}</p>` : si !== "No." ? `<p class="lim">${esc(si)}</p>` : ""}</div>`;
    };
  });
}

// ---------------------------------------------------------------------
// Command palette: type a province, arrow keys, Enter ("/" or Ctrl+K anywhere)
// ---------------------------------------------------------------------
function initPalette() {
  const dlg = $("dlgPalette");
  const input = $("palInput");
  const list = $("palList");
  let items = [];
  let idx = 0;
  const render = () => {
    const q = provinceKey(input.value.trim());
    const rec = recientes();
    items = PROVINCIAS.filter((p) => !q || provinceKey(p).includes(q)).sort(
      (a, b) => Number(provinceKey(b).startsWith(q)) - Number(provinceKey(a).startsWith(q)) || (q ? 0 : Number(rec.includes(b)) - Number(rec.includes(a))) || a.localeCompare(b, "es")
    );
    idx = Math.min(idx, Math.max(0, items.length - 1));
    list.innerHTML = items.length
      ? items
          .map((p, i) => {
            const r = byKey()[provinceKey(p)] ?? {};
            return `<li role="option" id="pal-${i}" aria-selected="${i === idx}" data-p="${esc(p)}" class="${i === idx ? "on" : ""}"><span class="dot" style="background:${col("IVEI", r.IVEI)}"></span><b>${esc(p)}</b><span class="pal-meta">Puesto ${Math.round(r.rank)} · ${esc(r.nivel)}</span>${provinceFlags({ isImputed: r.n_lb === 0, isBorderlineCase: esLimite(p), compact: true })}</li>`;
          })
          .join("")
      : `<li class="pal-empty">No encontré «${esc(input.value)}». Prueba con menos letras o con otro nombre.</li>`;
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

// ---------------------------------------------------------------------
// Quick factsheet per factor: the six methodological questions
// ---------------------------------------------------------------------
const FUENTES_FACTOR = {
  IVEI: "27 variables del Censo 2022, la ENEMDU 2024, la ENEMDU-TIC 2024 y el Latinobarómetro 2024.",
  EST: "10 variables: Censo 2022 (4), ENEMDU 2024 (5) y Latinobarómetro 2024 (1).",
  EXP: "5 variables: Censo 2022 (2), Latinobarómetro 2024 (2) y ENEMDU-TIC 2024 (1).",
  RES: "6 variables: Censo 2022 (3) y Latinobarómetro 2024 (3).",
  PRE: "6 variables del Latinobarómetro 2024.",
};
const FALLA_FACTOR = {
  IVEI: "Muestras débiles, valores imputados en cuatro provincias y una dieta informativa medida solo en su parte digital. Margen orientativo de ±5 a ±7 puntos.",
  EST: "Mezcla un conteo completo (Censo) con una pregunta de opinión (desconfianza en las instituciones) que depende de muestras pequeñas por provincia.",
  EXP: "Mide solo la dieta digital: las bases no preguntan por televisión, radio, prensa ni conversaciones familiares.",
  RES: "Capta solo la capacidad de contraste digital y educativa. En las cuatro provincias sin muestra propia, la parte de opinión usa el promedio del país.",
  PRE: "Es el factor con datos más frágiles a nivel provincial: viene del Latinobarómetro, con muestras pequeñas.",
};
function fichaRapida(code) {
  const f = FACTORES[code];
  return [
    ["¿De dónde viene?", FUENTES_FACTOR[code]],
    ["¿Por qué entra?", f.que],
    ["¿Qué se transforma?", "Las encuestas se suavizan hacia el promedio del país, se escalan de 0 a 100 entre provincias y se combinan. Ficha detallada en preparación."],
    ["¿Qué significa?", `${f.lectura} Es un valor relativo entre provincias, no un nivel absoluto.`],
    ["¿Qué puede fallar?", FALLA_FACTOR[code]],
    ["¿Qué lo valida?", "Para el índice completo: correlación de 0,92 con la ENEMDU, prueba de ruido de ±2 puntos y orden estable sin el modulador (ρ = 0,99). Las pruebas de pesos, de variables débiles y de fuente alternativa están en curso."],
  ];
}
function openFicha(code) {
  $("fichaTitulo").textContent = `Ficha rápida: ${code === "IVEI" ? "Todos los factores" : factorNombre(code)}`;
  $("fichaSub").textContent = "Las seis preguntas del índice, aplicadas a este factor.";
  $("fichaCuerpo").innerHTML = fichaRapida(code)
    .map(([q, a]) => `<li><b>${esc(q)}</b><p>${esc(a)}</p></li>`)
    .join("");
  $("dlgFicha").showModal();
}

// ---------------------------------------------------------------------
// Map actions: press quote, SVG / PNG of the map, open data as CSV
// ---------------------------------------------------------------------
function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
async function descargarCSV() {
  try {
    const t = TABLA_DATA ?? (TABLA_DATA = await getJSON("/api/segmentadores/tabla"));
    const head = ["Puesto", "Provincia", "Nivel", ...t.columnas.map((c) => `${c.label} (${c.unit})`)];
    const rows = t.filas.map((f) => [f.rank != null ? Math.round(f.rank) : "", f.provincia, f.nivel, ...t.columnas.map((c) => f[c.key] ?? "")]);
    rows.push(["", "Promedio del país", "", ...t.columnas.map((c) => t.nacional[c.key] ?? "")]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
    descargar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "OVADE_datos_provincias.csv");
    toast("Datos descargados. Cita la fuente: Observatorio OVADE.");
  } catch (e) {
    toast("No se pudieron descargar los datos. Revisa tu conexión e inténtalo de nuevo.");
  }
}

function mapaSVG() {
  const act = capasAll().find((c) => c.codigo === capa);
  const paths = (el) =>
    [...el.querySelectorAll(".pv")]
      .map((p) => {
        const imp = p.classList.contains("imp");
        return `<path d="${p.getAttribute("d")}" fill="${p.getAttribute("fill")}" stroke="${imp ? "#131a24" : "#fff"}" stroke-width="${imp ? 1.3 : 0.9}"${imp ? ' stroke-dasharray="3.5 2.5"' : ""}/>`;
      })
      .join("");
  const labels = [...$("map").querySelectorAll(".lbl")]
    .map((t) => `<text x="${t.getAttribute("x")}" y="${t.getAttribute("y")}" text-anchor="middle" font-size="9" font-weight="700" fill="#131a24" stroke="#fff" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round">${esc(t.textContent)}</text>`)
    .join("");
  let legend;
  if (capa === "PERFIL") {
    legend = PERFILES.map((pf, i) => `<rect x="${16 + (i % 2) * 270}" y="${650 + Math.floor(i / 2) * 15}" width="10" height="10" fill="${pf.color}"/><text x="${32 + (i % 2) * 270}" y="${659 + Math.floor(i / 2) * 15}" font-size="10" fill="#26313f">${esc(pf.plano)}</text>`).join("");
  } else {
    const stops = scaleFor(capa).map(([r, g, b], i, a) => `<stop offset="${i / (a.length - 1)}" stop-color="rgb(${r},${g},${b})"/>`).join("");
    const [lo, hi] = CAPA_LG[capa] ?? ["menor", "mayor"];
    legend = `<defs><linearGradient id="lg">${stops}</linearGradient></defs><rect x="16" y="652" width="240" height="10" rx="3" fill="url(#lg)"/><text x="16" y="678" font-size="10" fill="#26313f">${esc(lo)}</text><text x="256" y="678" font-size="10" text-anchor="end" fill="#26313f">${esc(hi)}</text><text x="276" y="662" font-size="10" fill="#5f6b7d">Borde punteado: valor nacional imputado</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -46 560 748" width="840" height="1122" font-family="Arial, Helvetica, sans-serif">
<rect x="0" y="-46" width="560" height="748" fill="#fff"/>
<text x="16" y="-22" font-size="18" font-weight="700" fill="#131a24">${esc(act.nombre)}</text>
<text x="16" y="-6" font-size="10.5" fill="#5f6b7d">${esc(CAPA_DESC[capa] ?? "").slice(0, 118)}</text>
${paths($("map"))}${labels}
<g transform="translate(14,6)"><rect width="92" height="100" rx="5" fill="#fff" stroke="#d3dbe4"/><text x="6" y="12" font-size="8" font-weight="700" fill="#5f6b7d">GALÁPAGOS</text><g transform="translate(4,14) scale(0.8)">${paths($("map-gal"))}</g></g>
${legend}
<text x="16" y="698" font-size="9" fill="#5f6b7d">Fuente: Observatorio de Vulnerabilidad ante la Desinformación Electoral (OVADE). Censo 2022, ENEMDU 2024, Latinobarómetro 2024, MINTEL 2023.</text>
</svg>`;
}
function descargarSVG() {
  descargar(new Blob([mapaSVG()], { type: "image/svg+xml" }), `OVADE_mapa_${capa}.svg`);
}
async function descargarPNG() {
  const url = URL.createObjectURL(new Blob([mapaSVG()], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise((ok, ko) => {
      img.onload = ok;
      img.onerror = ko;
      img.src = url;
    });
    const c = Object.assign(document.createElement("canvas"), { width: 1680, height: 2244 });
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => descargar(b, `OVADE_mapa_${capa}.png`), "image/png");
  } catch (e) {
    toast("No se pudo generar el PNG. Prueba con el SVG.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
function initMapTools() {
  $("btnSvg").onclick = descargarSVG;
  $("btnPng").onclick = descargarPNG;
  $("btnCsv").onclick = descargarCSV;
  $("btnCitaMapa").onclick = (e) => {
    const p = mapSel ? byKey()[mapSel] : null;
    if (!p) return toast("Elige primero una provincia en el mapa para copiar su cita.");
    copiarBtn(e.currentTarget, citaDeRegistro(p));
  };
}

function initExtras() {
  $("btnGlosario").onclick = () => {
    navigate("meto");
    requestAnimationFrame(() => $("glosario")?.scrollIntoView());
  };
  $("fichaCerrar").onclick = () => $("dlgFicha").close();
  $("dlgFicha").addEventListener("click", (e) => {
    if (e.target === $("dlgFicha")) $("dlgFicha").close();
  });
}

// ---------------------------------------------------------------------
// Feature flags: everything an outlet can switch off is applied here, so
// the same code path serves the first load and the admin's live preview.
// ---------------------------------------------------------------------
function setHidden(id, hidden) {
  const el = $(id);
  if (el) el.hidden = hidden;
}
function applyFlags() {
  document.querySelectorAll("nav button").forEach((b) => (b.hidden = !viewEnabled(b.dataset.v)));
  setHidden("cardScatter", !flag("grafico_dispersion"));
  setHidden("buscador", !flag("buscador_provincia"));
  setHidden("modulos", !flag("inicio_guiado"));
  $("btnMas").hidden = ![...document.querySelectorAll("#menuMas button[data-v]")].some((b) => !b.hidden);
  document.querySelectorAll("[data-solicitar]").forEach((b) => (b.hidden = !flag("solicitar_informacion")));
  if (MAPA) {
    renderCapas();
    paintMap();
  }
  if (PERFIL_DATA) renderPerfil(PERFIL_DATA);
  showView(currentView);
  if (!viewEnabled(currentView)) navigate("perfil", { replace: true });
}
onTenant(applyFlags);

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
(async function init() {
  const tenantReady = loadTenant();
  try {
    await initMapas();
    initModulos();
    initComparar();
    initDatos();
    initMeto();
    initAsistente();
    initPalette();
    initSolicitud();
    initExtras();
    initMapTools();
    renderMetodoExtra();
    $("sinoGlobal").innerHTML = `<details class="card sec" style="margin-bottom:16px"><summary><h2>Antes de escribir: qué puedes y qué no afirmar</h2></summary><div class="sec-body">${decisionBlock()}</div></details>`;
    await tenantReady;
    applyFlags();
    applyRoute();
  } catch (e) {
    document.querySelector(".wrap").insertAdjacentHTML(
      "afterbegin",
      `<div class="err" role="alert"><span>No se pudo conectar con el servidor de datos. ${esc(e.message)}</span><button class="btn gh" type="button" onclick="location.reload()">Reintentar</button></div>`
    );
  }
})();
