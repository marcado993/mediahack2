// Module: color. Part of the app.js split into native ES modules (no build step).

import { E } from "./estado.js";
import { GREEN, RAMP } from "./datos.js";

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
export function isPositiveKey(key) {
  return key === "RES" || key === "HABDIG";
}

export function scaleFor(key) {
  return isPositiveKey(key) ? GREEN : RAMP;
}

// Each indicator is colored against the *observed* range across the 24
// provinces (min-max), not a fixed 0-100 scale - matches the reference and
// reads better since most indicators here don't actually span 0-100.
export function indicatorRange(key) {
  const vals = (E.MAPA?.provincias ?? []).map((p) => p[key]).filter((v) => v != null);
  if (!vals.length) return { lo: 0, hi: 100 };
  return { lo: Math.min(...vals), hi: Math.max(...vals) };
}

export function col(key, value) {
  if (value == null) return "#cbd5e1";
  const { lo, hi } = indicatorRange(key);
  return rampColor((value - lo) / (hi - lo || 1), scaleFor(key));
}

// ---------------------------------------------------------------------
// Readable text on any fill: the ramp passes through pale yellow, where
// white labels fail contrast, so every coloured badge picks its own ink.
// ---------------------------------------------------------------------
export function inkFor(color) {
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
