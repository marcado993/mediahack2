// Single source of truth for mapping a 0-100 vulnerability value to a tier,
// reused by the map, list, and every stat card so the same number always
// reads the same way everywhere in the app.
//
// Cold-to-warm scale: the first two tiers stay in the blue family (visual
// continuity with the rest of the UI), but ALTO/CRÍTICO break into
// amber/brick-red - the perceptual convention for risk data, so a reader
// spots "danger zone" by color alone before reading a single number. A
// monochromatic blue scale doesn't make CRÍTICO *feel* critical; this does.
const LEVELS = [
  { max: 25, tag: "BAJO", color: "var(--tier-bajo)" },
  { max: 45, tag: "MODERADO", color: "var(--tier-moderado)" },
  { max: 65, tag: "ALTO", color: "var(--tier-alto)" },
  { max: Infinity, tag: "CRÍTICO", color: "var(--tier-critico)" },
];

export function alertLevel(value) {
  if (value == null) return { tag: "SIN DATO", color: "var(--no-data)" };
  return LEVELS.find((l) => value < l.max) ?? LEVELS[LEVELS.length - 1];
}

// Resolved hex (not the CSS var) for contexts that can't use var(), like SVG
// fills computed in JS. Keep in sync with the --tier-* values in app.css.
const LEVEL_HEX = ["#c7d6e8", "#7fa8d4", "#e8a33d", "#b23a2e"];
export function alertLevelHex(value) {
  if (value == null) return "#e4e7eb";
  const idx = LEVELS.findIndex((l) => value < l.max);
  return LEVEL_HEX[idx === -1 ? LEVEL_HEX.length - 1 : idx];
}
