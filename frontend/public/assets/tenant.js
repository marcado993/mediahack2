// White-label layer. Resolves which medio is looking at the site (?medio=slug,
// or the hostname for outlets with their own domain), applies its brand to the
// chrome and exposes its feature flags. Brand only ever touches the chrome:
// the data colour ramp, methodology and data credits are not themable.

import { getJSON } from "./api.js";

const FLAG_KEYS = [
  "vista_mapas", "vista_perfil", "vista_comparar", "vista_datos", "vista_fuentes", "vista_conversacion", "vista_metodologia",
  "capa_mecanismos", "capa_habilidades", "grafico_dispersion", "inicio_guiado", "buscador_provincia", "guia_reportero", "cita_lista", "solicitar_informacion", "ficha_descargable", "retroalimentacion",
];
// If the backend is unreachable the site still has to open: everything on, house brand.
const FALLBACK = {
  slug: "default",
  nombre: "Observatorio",
  titulo: "Observatorio de Vulnerabilidad ante la Desinformación Electoral",
  lema: "Índice OVADE 2024 · 24 provincias + Galápagos · Censo 2022, ENEMDU 2024 y Latinobarómetro 2024",
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
    const el = (tag, cls, texto) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (texto) e.textContent = texto;
      return e;
    };
    const btn = (texto, datos) => {
      const b = el("button", "linkbtn", texto);
      b.type = "button";
      Object.assign(b.dataset, datos);
      return b;
    };
    const col = (titulo, hijos) => {
      const c = el("div", "pie-col");
      c.append(el("h3", "pie-h", titulo));
      const ul = el("ul", "pie-lista");
      hijos.forEach((h) => {
        const li = el("li");
        li.append(h);
        ul.append(li);
      });
      c.append(ul);
      return c;
    };

    const grid = el("div", "pie-grid");
    const quees = el("div", "pie-col pie-quees");
    quees.append(
      el("h3", "pie-h", "OVADE"),
      el("p", "", "Muestra dónde la desinformación electoral encuentra más terreno en las 24 provincias de Ecuador. Son datos abiertos; el índice describe territorios, no personas, medios ni candidatos.")
    );
    if (cfg.pie) quees.append(el("p", "pie-brand", cfg.pie));
    if (/^https?:\/\//.test(cfg.sitio_url || "")) {
      const a = el("a", "pie-ext", `Volver a ${cfg.nombre}`);
      a.href = cfg.sitio_url;
      a.rel = "noopener";
      quees.append(a);
    }
    grid.append(quees);
    // Methodology, open data and sources are reference material: reachable from every page.
    grid.append(col("Sobre los datos", [btn("Cómo empezar", { ruta: "perfil" }), btn("Metodología y límites", { ir: "meto" }), btn("Fuentes oficiales", { ir: "fuentes" }), btn("Datos abiertos", { ir: "datos" })]));
    const ayuda = [btn("Chat con colegas", { ruta: "chat" }), btn("Bóveda segura", { ruta: "boveda" })];
    if (cfg.flags.solicitar_informacion !== false) ayuda.push(btn("Solicitar información al observatorio", { solicitar: "" }));
    if (cfg.flags.retroalimentacion !== false) ayuda.push(btn("Cuéntanos qué necesita tu medio", { retro: "" }));
    grid.append(col("Herramientas y contacto", ayuda));
    foot.append(grid);
    // Not editable on purpose: whoever publishes the map, the data keeps its credit.
    foot.append(
      el(
        "p",
        "pie-datos",
        "Datos y metodología: Observatorio de Vulnerabilidad ante la Desinformación Electoral. Fuentes: Censo 2022 y ENEMDU 2024 (INEC), Latinobarómetro 2024, MINTEL 2023. Datos con corte a la última publicación de cada fuente, sujetos a actualización. La resolución provincial es una salvaguarda deliberada: ninguna vista ni descarga baja de provincia. Uso ético: los datos son abiertos y se usan para proteger y fortalecer la democracia. El chat y la bóveda piden una cuenta: solo un seudónimo y una contraseña, sin correo. El chat es temporal: los mensajes se borran a los 30 minutos. La bóveda cifra en tu navegador: nada de lo que guardas sale de tu equipo."
      )
    );
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
