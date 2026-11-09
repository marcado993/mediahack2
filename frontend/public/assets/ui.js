// Small presentational components shared by the views. Each one takes explicit
// props (dataSourceQuality, isImputed, isBorderlineCase, confidenceRange) so
// any view can show uncertainty the same way, and returns an HTML string.

export const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function fmt(v, decimals = 1) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString("es-EC", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function fmtInt(v) {
  if (v == null) return "—";
  return Math.round(v).toLocaleString("es-EC");
}

// General margin of the index, as the methodology documents it. A per-province
// interval replaces it as soon as the sensitivity table exists.
export const MARGEN_GENERAL = "±5 a ±7 puntos";

const svg = (body) => `<svg class="ic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">${body}</svg>`;
export const ICON = {
  warn: svg('<path d="M8 1.6 15 14H1L8 1.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.3v3.9M8 12v.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
  pin: svg('<path d="M8 15s5-4.6 5-8.5a5 5 0 0 0-10 0C3 10.4 8 15 8 15z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="6.5" r="1.8" fill="currentColor"/>'),
  check: svg('<path d="M3 8.6l3.2 3L13 4.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  cross: svg('<path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  search: svg('<circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.6 10.6 14 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  mail: svg('<rect x="1.6" y="3" width="12.8" height="10" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 4.4 8 9l6-4.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'),
};

/** The obvious empty state: says what to do and points at where. `donde` = "tend" | "mapa"
 *  picks the breakpoint where the map ends up above the panel and the arrow turns upward. */
export function vacioFlecha({ titulo, texto, donde = "mapa" }) {
  return `<div class="vacio vacio--${donde}" role="status">
   <svg class="vacio-flecha" viewBox="0 0 48 32" width="56" height="38" aria-hidden="true" focusable="false"><path d="M44 16H6M17 5 5.5 16 17 27" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
   <div><p class="vacio-t">${esc(titulo)}</p><p class="vacio-x">${esc(texto)}</p></div>
  </div>`;
}

// More icons for labels and buttons: one stroke weight, no fills, so they add meaning without weight.
const trazo = (d) => svg(`<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</g>`);
Object.assign(ICON, {
  copy: trazo('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.2V3A1.5 1.5 0 0 0 9 1.5H3.5A1.5 1.5 0 0 0 2 3v5.5A1.5 1.5 0 0 0 3.5 10h2"/>'),
  link: trazo('<path d="M6.6 9.4a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8M9.4 6.6a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8"/>'),
  download: trazo('<path d="M8 2v8M4.8 7 8 10.2 11.2 7M2.5 13.5h11"/>'),
  compare: trazo('<path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13"/>'),
  bookmark: trazo('<path d="M4 2.5h8v11L8 10.5l-4 3z"/>'),
  share: trazo('<circle cx="4" cy="8" r="1.8"/><circle cx="12" cy="4" r="1.8"/><circle cx="12" cy="12" r="1.8"/><path d="M5.6 7.1l4.8-2.2M5.6 8.9l4.8 2.2"/>'),
  map: trazo('<path d="M1.8 3.8 5.5 2.5l5 1.3 3.7-1.3v9.7l-3.7 1.3-5-1.3-3.7 1.3z"/><path d="M5.5 2.5v9.7M10.5 3.8v9.7"/>'),
  pen: trazo('<path d="M10.5 2.5l3 3-8 8L2 14l.5-3.5z"/>'),
  chat: trazo('<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>'),
  lock: trazo('<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2"/>'),
  wifi: trazo('<path d="M2 6.2a8 8 0 0 1 12 0M4.2 8.6a5 5 0 0 1 7.6 0M6.4 11a2 2 0 0 1 3.2 0"/><path d="M8 13.4v.1"/>'),
  coin: trazo('<circle cx="8" cy="8" r="5.5"/><path d="M8 4.8v6.4M6.2 6.4h2.9a1.2 1.2 0 0 1 0 2.4H6.9a1.2 1.2 0 0 0 0 2.4h2.9"/>'),
  book: trazo('<path d="M2.5 3.5h4.2A1.3 1.3 0 0 1 8 4.8v8.7a1.3 1.3 0 0 0-1.3-1H2.5zM13.5 3.5H9.3A1.3 1.3 0 0 0 8 4.8v8.7a1.3 1.3 0 0 1 1.3-1h4.2z"/>'),
  home: trazo('<path d="M2 7.5 8 2.5l6 5M3.5 6.8v6.7h9V6.8"/>'),
  info: trazo('<circle cx="8" cy="8" r="6"/><path d="M8 7.2v3.6M8 5.2v.1"/>'),
  moon: trazo('<path d="M13.5 9.5A5.8 5.8 0 0 1 6.5 2.5a5.8 5.8 0 1 0 7 7z"/>'),
  sun: trazo('<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>'),
  escucha: trazo('<path d="M3 6.5v3M6 4.5v7M9 2.5v11M12 5.5v5"/>'),
  ext: trazo('<path d="M9 2.5h4.5V7M13.5 2.5l-6 6M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>'),
});

/** Fills every <span data-ic="name"> under `root` with its icon. */
export function iconosEn(root = document) {
  root.querySelectorAll("[data-ic]").forEach((el) => {
    if (!el.firstChild && ICON[el.dataset.ic]) el.innerHTML = ICON[el.dataset.ic];
  });
}

// The sister project (private chat rooms, encrypted vault). Kept as links: its crypto and server
// are its own, tested code; OVADE does not copy it.
export const PERIODISMO_SEGURO = "https://149-130-170-232.sslip.io";

/** dataSourceQuality: "alta" | "media" | "baja". Three pips + a word: never colour alone. */
export function qualityBadge({ dataSourceQuality, detail = "" }) {
  const palabra = { alta: "sólida", media: "media", baja: "débil" }[dataSourceQuality] ?? dataSourceQuality;
  return `<span class="sol ${dataSourceQuality}" title="${esc(detail)}"><span class="pips" aria-hidden="true"><i></i><i></i><i></i></span>Fuente ${palabra}</span>`;
}

export function importedTag({ compact = false } = {}) {
  return `<span class="ptag warn" title="Esta provincia no tiene muestra propia en el Latinobarómetro: sus datos de opinión usan el promedio del país.">${ICON.warn}${
    compact ? "Valor imputado" : "Valor imputado a partir de promedio nacional (Latinobarómetro)"
  }</span>`;
}

export function borderlineTag({ compact = false } = {}) {
  return `<span class="ptag pin" title="Con pequeños ajustes metodológicos su perfil podría clasificarse en otra categoría.">${ICON.pin}${
    compact ? "Caso limítrofe" : "Caso limítrofe: su perfil territorial es sensible a variaciones menores"
  }</span>`;
}

/** The two provincial warnings, wherever a province name appears. */
export function provinceFlags({ isImputed = false, isBorderlineCase = false, compact = false } = {}) {
  return [isImputed ? importedTag({ compact }) : "", isBorderlineCase ? borderlineTag({ compact }) : ""].filter(Boolean).join(" ");
}

/** A score is never shown bare: it carries either its interval or the general margin.
 *  confidenceRange: { low, high } | null */
export function scoreRange({ confidenceRange = null } = {}) {
  if (confidenceRange && confidenceRange.low != null && confidenceRange.high != null) {
    return `<span class="rango" title="Banda de sensibilidad del puntaje">Rango: ${fmt(confidenceRange.low, 0)} – ${fmt(confidenceRange.high, 0)}</span>`;
  }
  return `<span class="rango" title="Margen general del índice según la metodología. El rango por provincia está en preparación.">Puede variar ${MARGEN_GENERAL}</span>`;
}
