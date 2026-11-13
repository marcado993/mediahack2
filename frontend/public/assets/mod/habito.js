// Module: habito. Reasons for a reporter to come back every day, built only from things that help
// the job: a new quotable finding each day, one tap back to the last province, and a private record
// of their own streak and week (citations copied, story ideas prepared). Everything stays in this
// browser; nothing is sent anywhere, and there is no ranking against other people.

import { esc, fmt } from "../ui.js";
import { E } from "./estado.js";
import { $ } from "./util.js";
import { RECIENTES_KEY, enc } from "./datos.js";
import { copiarBtn } from "./nav.js";

const KEY = "ovade.habito.v1";
const FUENTE = "Fuente: Observatorio de Vulnerabilidad ante la Desinformación Electoral (OVADE).";
const NOMBRE = { EST: "las carencias de base", EXP: "la dependencia de redes", PRE: "el clima electoral", RES: "la poca capacidad de contrastar información" };

/* ---- dates in Ecuador time (UTC-5, no daylight saving) ---- */
const hoyEc = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const diaNum = (iso) => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
function semanaDe(iso) {
  const d = new Date(iso + "T00:00:00Z");
  const lunes = new Date(d);
  lunes.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return lunes.toISOString().slice(0, 10);
}

function leer() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { dias: Array.isArray(d.dias) ? d.dias : [], semana: d.semana || "", citas: d.citas | 0, ideas: d.ideas | 0 };
  } catch (_) {
    return { dias: [], semana: "", citas: 0, ideas: 0 };
  }
}
function guardar(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch (_) {}
}

/** Marks today as a day of use, and counts a copied citation or a prepared idea. */
export function registrarUso(tipo = "visita") {
  const d = leer();
  const hoy = hoyEc();
  if (!d.dias.includes(hoy)) d.dias = [...d.dias, hoy].slice(-90);
  const sem = semanaDe(hoy);
  if (d.semana !== sem) Object.assign(d, { semana: sem, citas: 0, ideas: 0 });
  if (tipo === "cita") d.citas++;
  if (tipo === "idea") d.ideas++;
  guardar(d);
  if (tipo !== "visita") pintarYo();
}

/** Consecutive days of use ending today. */
function racha(dias) {
  const set = new Set(dias.map(diaNum));
  let n = 0;
  for (let k = diaNum(hoyEc()); set.has(k); k--) n++;
  return n;
}

/** One finding per day, the same for everyone that day, cycling through provinces and kinds of finding. */
function datoDelDia() {
  const provs = [...(E.MAPA?.provincias ?? [])].filter((p) => p.IVEI != null).sort((a, b) => a.provincia.localeCompare(b.provincia, "es"));
  if (!provs.length) return null;
  const nac = E.MAPA.nacional;
  const k = diaNum(hoyEc());
  const p = provs[(k * 7) % provs.length]; // 7 and 24 share no factor: every province comes round in 24 days
  const tipo = k % 3;
  if (tipo === 1) {
    const peso = ["EST", "EXP", "PRE", "RES"]
      .filter((f) => p[f] != null && nac[f] != null)
      .map((f) => ({ f, d: (f === "RES" ? -1 : 1) * (p[f] - nac[f]) }))
      .sort((a, b) => b.d - a.d)[0];
    if (peso && peso.d > 0)
      return {
        p: p.provincia,
        texto:
          peso.f === "RES"
            ? `En ${p.provincia} lo que más pesa es ${NOMBRE.RES}: su capacidad de contrastar marca ${fmt(p.RES)} sobre 100, por debajo de ${fmt(nac.RES)} del promedio del país.`
            : `En ${p.provincia} lo que más pesa es ${NOMBRE[peso.f]}: ${fmt(p[peso.f])} puntos sobre 100, frente a ${fmt(nac[peso.f])} del promedio del país.`,
      };
  }
  if (tipo === 2 && p.EXCLUSION != null && p.HIPEREXP != null) {
    const sin = p.EXCLUSION - nac.EXCLUSION;
    const sat = p.HIPEREXP - nac.HIPEREXP;
    const via = sin >= sat ? `la gente sin conexión (${fmt(p.EXCLUSION)} frente a ${fmt(nac.EXCLUSION)} del país)` : `la saturación de redes (${fmt(p.HIPEREXP)} frente a ${fmt(nac.HIPEREXP)} del país)`;
    return { p: p.provincia, texto: `En ${p.provincia}, la desinformación llega sobre todo por ${via}.` };
  }
  return { p: p.provincia, texto: `${p.provincia} ocupa el puesto ${p.rank} de 24 en vulnerabilidad ante la desinformación electoral, con ${fmt(p.IVEI)} puntos sobre 100 (promedio del país: ${fmt(nac.IVEI)}).` };
}

function ultimaProvincia() {
  try {
    const r = JSON.parse(localStorage.getItem(RECIENTES_KEY) || "[]");
    return r.find((p) => E.PROVINCIAS.includes(p)) || "";
  } catch (_) {
    return "";
  }
}

function lineaYo() {
  const d = leer();
  const n = racha(d.dias);
  const sem = d.semana === semanaDe(hoyEc()) ? d : { citas: 0, ideas: 0 };
  const partes = [n > 1 ? `<b>${n} días seguidos</b> usando OVADE` : `<b>Hoy empieza tu racha</b>`];
  const hechos = [
    sem.citas ? `${sem.citas} ${sem.citas === 1 ? "cita copiada" : "citas copiadas"}` : "",
    sem.ideas ? `${sem.ideas} ${sem.ideas === 1 ? "idea preparada" : "ideas preparadas"}` : "",
  ].filter(Boolean);
  if (hechos.length) partes.push(`esta semana: ${hechos.join(" y ")}`);
  const ult = ultimaProvincia();
  return `<span class="hoy-racha">${partes.join(" · ")}</span>${ult ? `<button type="button" class="linkbtn hoy-volver" data-ruta="perfil/${enc(ult)}">Seguir con ${esc(ult)} →</button>` : ""}`;
}

function pintarYo() {
  const el = $("hoyYo");
  if (el) el.innerHTML = lineaYo();
}

/** Paints "Hoy en OVADE" on the start screen. Needs the map data. */
export function renderHoy() {
  const caja = $("hoyOvade");
  if (!caja || !E.MAPA) return;
  const dato = datoDelDia();
  const fecha = new Date(hoyEc() + "T12:00:00Z").toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  caja.innerHTML = `
   <div class="hoy-cab"><h3 class="hero-h">Hoy en OVADE</h3><span class="hoy-fecha">${esc(fecha)}</span></div>
   ${
     dato
       ? `<div class="hoy-dato">
       <p class="hoy-k">Dato del día · ${esc(dato.p)}</p>
       <p class="hoy-x">${esc(dato.texto)}</p>
       <div class="hoy-acc"><button type="button" class="copybtn" id="hoyCopiar">Copiar con fuente</button><button type="button" class="linkbtn" data-ruta="perfil/${enc(dato.p)}">Ver la ficha de ${esc(dato.p)} →</button></div>
       <p class="hoy-nota">Mañana, otra provincia y otro hallazgo.</p>
      </div>`
       : ""
   }
   <p class="hoy-yo" id="hoyYo" aria-live="polite">${lineaYo()}</p>`;
  if (dato) $("hoyCopiar").onclick = (e) => copiarBtn(e.currentTarget, `${dato.texto} ${FUENTE}`, "dato_del_dia");
}
