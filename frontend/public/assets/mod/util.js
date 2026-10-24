// Module: util. Part of the app.js split into native ES modules (no build step).

import { NAME_ALIASES } from "./datos.js";

export const $ = (id) => document.getElementById(id);

export function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function provinceKey(name) {
  const stripped = normalize(name);
  return NAME_ALIASES[stripped] || stripped;
}
