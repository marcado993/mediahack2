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
