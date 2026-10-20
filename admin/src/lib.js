export const DEFAULT_TITULO = "Observatorio de Vulnerabilidad ante la Desinformación Electoral";
export const DEFAULT_LEMA = "IVEI 2024 · 24 provincias + Galápagos · Censo 2022, ENEMDU 2024 y Latinobarómetro 2024";
export const INK = "#131a24";

export const newTenant = (nombre) => ({
  nombre,
  titulo: DEFAULT_TITULO,
  lema: "",
  color: "#1b3a5c",
  logo: "",
  logo_placa: false,
  fuente_titulos: "sans",
  sitio_url: "",
  pie: "",
  dominios: [],
  publicado: true,
  flags: {},
});

export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

// ---- colour maths (same rule the public site uses to pick its text colour) ----
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (c) => {
  const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
export const onColor = (hex) => (contrast(hex, "#ffffff") >= contrast(hex, INK) ? "#ffffff" : INK);
export const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);

// ---- flags ----
export function resolvedFlags(registry, overrides) {
  return Object.fromEntries(registry.map((f) => [f.key, f.locked ? true : (overrides[f.key] ?? f.default)]));
}

// Same shape the public /api/tenant-config returns, built from unsaved edits.
export function toPublic(slug, d, registry) {
  return {
    slug,
    nombre: d.nombre || "Medio",
    titulo: d.titulo || DEFAULT_TITULO,
    lema: d.lema || DEFAULT_LEMA,
    color: isHex(d.color) ? d.color : "#1b3a5c",
    logo: d.logo,
    logo_placa: d.logo_placa,
    fuente_titulos: d.fuente_titulos,
    sitio_url: d.sitio_url,
    pie: d.pie,
    flags: resolvedFlags(registry, d.flags),
  };
}

export const payload = (d) => ({
  nombre: d.nombre,
  titulo: d.titulo,
  lema: d.lema,
  color: d.color,
  logo: d.logo,
  logo_placa: d.logo_placa,
  fuente_titulos: d.fuente_titulos,
  sitio_url: d.sitio_url,
  pie: d.pie,
  dominios: d.dominios,
  publicado: d.publicado,
  flags: d.flags,
});
