// Module: seguimiento. The provinces and topics a reporter follows, kept in this
// browser. It is not an account: it is the same list every time they come back.

const KEY = "ovade.sigo.v1";
const MAX_TEMAS = 8;

function leer() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { provincias: Array.isArray(d.provincias) ? d.provincias : [], temas: Array.isArray(d.temas) ? d.temas : [] };
  } catch (_) {
    return { provincias: [], temas: [] };
  }
}

function guardar(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch (_) {}
}

export const sigue = (provincia) => leer().provincias.includes(provincia);
export const provinciasQueSigo = () => leer().provincias;
export const temasQueSigo = () => leer().temas;

/** Toggle; returns the new state. */
export function alternarProvincia(provincia) {
  const d = leer();
  const on = d.provincias.includes(provincia);
  d.provincias = on ? d.provincias.filter((p) => p !== provincia) : [...d.provincias, provincia];
  guardar(d);
  return !on;
}

export function agregarTema(texto) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const d = leer();
  if (!t || d.temas.length >= MAX_TEMAS || d.temas.some((x) => x.toLowerCase() === t.toLowerCase())) return false;
  d.temas.push(t);
  guardar(d);
  return true;
}

export function quitarTema(texto) {
  const d = leer();
  d.temas = d.temas.filter((x) => x !== texto);
  guardar(d);
}

export const LIMITE_TEMAS = MAX_TEMAS;
