// White-label layer. Resolves which medio is looking at the site (?medio=slug,
// or the hostname for outlets with their own domain), applies its brand to the
// chrome and exposes its feature flags. Brand only ever touches the chrome:
// the data colour ramp, methodology and data credits are not themable.

import { getJSON } from "./api.js";

const FLAG_KEYS = [
  "vista_mapas", "vista_perfil", "vista_comparar", "vista_datos", "vista_fuentes", "vista_conversacion", "vista_metodologia",
  "capa_mecanismos", "capa_habilidades", "grafico_dispersion", "inicio_guiado", "buscador_provincia", "guia_reportero", "cita_lista", "solicitar_informacion", "ficha_descargable",
];
// If the backend is unreachable the site still has to open: everything on, house brand.
const FALLBACK = {
  slug: "default",
  nombre: "Observatorio",
  titulo: "Observatorio de Vulnerabilidad ante la Desinformación Electoral",
  lema: "IVEI 2024 · 24 provincias + Galápagos · Censo 2022, ENEMDU 2024 y Latinobarómetro 2024",
  color: "#1b3a5c",
  logo: "",
  logo_placa: false,
  fuente_titulos: "sans",
  sitio_url: "",
  pie: "",
  flags: Object.fromEntries(FLAG_KEYS.map((k) => [k, true])),
};

let current = FALLBACK;
const listeners = [];

export const tenant = () => current;
export const flag = (key) => current.flags[key] !== false;
export const onTenant = (fn) => listeners.push(fn);
export const isPreview = new URLSearchParams(location.search).get("preview") === "1";

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance([r, g, b]) {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
// Text colour that stays readable on the brand colour, whatever it is.
export function onColor(hex) {
  const L = luminance(hexToRgb(hex));
  return (1.05) / (L + 0.05) >= (L + 0.05) / 0.06 ?"#ffffff" : "#131a24";
}
const mixWithWhite = (hex, t) => `rgb(${hexToRgb(hex).map((c) => Math.round(c * t + 255 * (1 - t))).join(",")})`;

const safeLogo = (src) => (typeof src === "string" && (src.startsWith("https://") || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(src)) ? src : "");

function paintBrand(cfg) {
  const root = document.documentElement.style;
  const color = /^#[0-9a-f]{6}$/i.test(cfg.color) ? cfg.color : FALLBACK.color;
  root.setProperty("--acc", color);
  root.setProperty("--acc-soft", mixWithWhite(color, 0.09));
  root.setProperty("--on-acc", onColor(color));
  root.setProperty("--display", cfg.fuente_titulos === "serif" ? '"Source Serif 4", Georgia, serif' : '"Inter", system-ui, sans-serif');

  document.title = cfg.titulo;
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set("brandTitle", cfg.titulo);
  // the fixed cut-off notice stays; a custom tagline from the outlet is appended to it
  set("brandSub", cfg.lema && cfg.lema !== FALLBACK.lema ? cfg.lema : "");

  const logo = safeLogo(cfg.logo);
  const mark = document.getElementById("brandMark");
  const img = document.getElementById("brandLogo");
  if (mark && img) {
    mark.hidden = !!logo;
    img.hidden = !logo;
    if (logo) img.src = logo;
    img.alt = logo ? `Logo de ${cfg.nombre}` : "";
    img.classList.toggle("placa", !!cfg.logo_placa);
  }

  const foot = document.querySelector("#pie .wrap");
  if (foot) {
    foot.replaceChildren();
    const line = document.createElement("p");
    line.className = "pie-brand";
    if (cfg.pie) line.append(cfg.pie + " ");
    if (/^https?:\/\//.test(cfg.sitio_url || "")) {
      const a = document.createElement("a");
      a.href = cfg.sitio_url;
      a.rel = "noopener";
      a.textContent = `Volver a ${cfg.nombre}`;
      line.append(a);
    }
    if (line.childNodes.length) foot.append(line);
    // Not editable on purpose: whoever publishes the map, the data keeps its credit.
    const credit = document.createElement("p");
    credit.className = "pie-datos";
    credit.textContent = "Datos y metodología: Observatorio de Vulnerabilidad ante la Desinformación Electoral. Fuentes: Censo 2022 y ENEMDU 2024 (INEC), Latinobarómetro 2024, MINTEL 2023. Datos con corte a la última publicación de cada fuente, sujetos a actualización. El índice describe territorios, no personas, medios ni candidatos.";
    foot.append(credit);
    // Methodology, open data and sources are reference material: reachable from
    // every page footer instead of crowding the main tabs.
    const datos = document.createElement("p");
    datos.className = "pie-datos-links";
    datos.append("Sobre los datos: ");
    [["meto", "Metodología y límites"], ["datos", "Datos abiertos"], ["fuentes", "Fuentes oficiales"]].forEach(([v, t], i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "linkbtn";
      b.dataset.ir = v;
      b.textContent = t;
      if (i) datos.append(" · ");
      datos.append(b);
    });
    foot.append(datos);
    if (cfg.flags.solicitar_informacion !== false) {
      const ask = document.createElement("p");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "linkbtn";
      btn.dataset.solicitar = "";
      btn.textContent = "Solicitar información al observatorio";
      ask.append(btn);
      foot.append(ask);
    }
  }
}

export function applyTenant(cfg) {
  current = { ...FALLBACK, ...cfg, flags: { ...FALLBACK.flags, ...(cfg.flags || {}) } };
  paintBrand(current);
  listeners.forEach((fn) => fn(current));
}

export async function loadTenant() {
  const medio = new URLSearchParams(location.search).get("medio") || "";
  try {
    const cfg = await getJSON(`/api/tenant-config?medio=${encodeURIComponent(medio)}&host=${encodeURIComponent(location.hostname)}`);
    applyTenant(cfg);
  } catch (_) {
    applyTenant(FALLBACK);
  }
  // The admin panel (a separate app) embeds this page and pushes unsaved edits
  // so editors see them live. It only reacts to the origin named in ?admin=,
  // and only when the page was opened as a preview.
  const adminOrigin = (() => {
    try {
      return new URL(new URLSearchParams(location.search).get("admin") || "").origin;
    } catch (_) {
      return "";
    }
  })();
  if (isPreview && adminOrigin && window.parent !== window) {
    window.addEventListener("message", (e) => {
      if (e.origin !== adminOrigin || e.source !== window.parent || e.data?.type !== "preview-tenant" || !e.data.config) return;
      applyTenant(e.data.config);
    });
    window.parent.postMessage({ type: "preview-ready" }, adminOrigin);
  }
}
