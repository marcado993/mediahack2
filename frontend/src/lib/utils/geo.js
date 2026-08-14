// Normalizes province names so the GeoJSON (from a third-party boundaries
// repo) and the backend (Latinobarometro REG codes) can be joined even
// though they don't spell every province identically - e.g. the GeoJSON
// has "Santo Domingo", the backend has "Santo Domingo de los Tsáchilas".
const ALIASES = {
  "santo domingo": "santo domingo de los tsachilas",
};

export function provinceKey(name) {
  if (!name) return "";
  const stripped = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip accents
  return ALIASES[stripped] || stripped;
}

// The current GeoJSON source (dpa_despro property) spells every province in
// ALL CAPS without accents ("CANAR", "GUAYAS"...) - fine for matching via
// provinceKey(), but wrong for anything shown to the user. Map explicitly
// rather than attempting automatic Spanish title-casing (which gets "de los
// Tsáchilas" wrong).
const DISPLAY_NAMES = {
  azuay: "Azuay",
  bolivar: "Bolívar",
  canar: "Cañar",
  carchi: "Carchi",
  chimborazo: "Chimborazo",
  cotopaxi: "Cotopaxi",
  "el oro": "El Oro",
  esmeraldas: "Esmeraldas",
  galapagos: "Galápagos",
  guayas: "Guayas",
  imbabura: "Imbabura",
  loja: "Loja",
  "los rios": "Los Ríos",
  manabi: "Manabí",
  "morona santiago": "Morona Santiago",
  napo: "Napo",
  orellana: "Orellana",
  pastaza: "Pastaza",
  pichincha: "Pichincha",
  "santa elena": "Santa Elena",
  "santo domingo de los tsachilas": "Santo Domingo de los Tsáchilas",
  sucumbios: "Sucumbíos",
  tungurahua: "Tungurahua",
  "zamora chinchipe": "Zamora Chinchipe",
};

export function displayName(rawName) {
  if (!rawName) return rawName;
  const key = rawName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return DISPLAY_NAMES[key] ?? rawName;
}
