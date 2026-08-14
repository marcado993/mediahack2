// Turns the dominant IVD dimension for a province into a one-line reporting
// angle a journalist can act on immediately - not just "here's the number,"
// but "here's what beat this number points a story toward."
const ANGLES = {
  d1_socioeconomica: {
    tag: "SALUD Y SERVICIOS BÁSICOS",
    text: (p) =>
      `La privación material en ${p} (pobreza, NBI, desigualdad) suele traducirse en menor acceso a servicios de salud y agua potable — vale la pena cruzar este dato con indicadores sanitarios locales antes de escribir.`,
  },
  d2_educativa: {
    tag: "ALFABETIZACIÓN MEDIÁTICA",
    text: (p) =>
      `El rezago educativo en ${p} (analfabetismo, escolaridad, asistencia escolar) se asocia con mayor dificultad para distinguir fuentes confiables — un ángulo posible es la falta de programas de alfabetización mediática en la zona.`,
  },
  d3_desconfianza_institucional: {
    tag: "DESCONFIANZA Y BULOS ELECTORALES",
    text: (p) =>
      `La desconfianza institucional en ${p} es terreno fértil para narrativas de fraude o deslegitimación — antes de la próxima elección vale la pena rastrear qué bulos políticos ya circulan ahí.`,
  },
};

const DIM_KEYS = Object.keys(ANGLES);

export function storyAngle(detail) {
  if (!detail) return null;
  const leading = DIM_KEYS.reduce((a, b) => (detail[b] > detail[a] ? b : a));
  const value = detail[leading];
  if (value == null || value < 45) return null; // only surface a suggestion once it's ALTO or CRÍTICO
  const { tag, text } = ANGLES[leading];
  return { tag, text: text(detail.province), value };
}
