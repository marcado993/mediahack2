// Module: diccionario. Where each number comes from: the inventory of sources (with the
// year it is cut at and how solid it is) and one entry per variable that feeds the index.
// Everything here is derived from VARIABLES_CAPA / FUENTE_VAR, so it cannot drift from
// the layers the map actually draws.

import { esc } from "../ui.js";
import { $ } from "./util.js";
import { CORTE_FRASE, FUENTE_VAR, MUESTRA_DEBIL, VARIABLES_CAPA } from "./datos.js";

const pips = (n) => `<span class="sol ${n}"><span class="pips" aria-hidden="true"><i></i><i></i><i></i></span>Fuente ${{ alta: "sólida", media: "media", baja: "débil" }[n]}</span>`;

// "corte" is the year of the census or survey: the exact publication date of each base
// is confirmed with the source, so it is not shown as if it were known.
export const FUENTES_INV = [
  { k: "C", nombre: "Censo de Población y Vivienda 2022", org: "INEC", corte: "2022", solidez: ["alta"], como: "Conteo completo de la población: no tiene error muestral.", falla: "Refleja la situación de 2022." },
  { k: "E", nombre: "ENEMDU 2024", org: "INEC", corte: "2024", solidez: ["media"], como: "Encuesta oficial anual, representativa a nivel provincial.", falla: "Es una encuesta: tiene error muestral." },
  { k: "T", nombre: "ENEMDU-TIC 2024", org: "INEC", corte: "2024", solidez: ["baja"], como: "Módulo de uso de TIC de la encuesta oficial. Solo representa al país, no a cada provincia.", falla: "El dato provincial no es confiable por sí solo." },
  {
    k: "L",
    nombre: "Latinobarómetro 2024",
    org: "Corporación Latinobarómetro",
    corte: "2024",
    solidez: ["media", "baja"],
    como: `Encuesta de opinión con 1.200 casos en todo el país. Es media si la provincia tiene ${MUESTRA_DEBIL} casos o más, y débil si tiene menos. Las provincias sin casos reciben el valor del país.`,
    falla: "Muestras pequeñas por provincia; cuatro provincias sin muestra propia.",
  },
  { k: "M", nombre: "MINTEL 2023", org: "MINTEL", corte: "2023", solidez: ["baja"], como: "Encuesta de participación voluntaria (428 personas). No representa a la provincia.", falla: "Siete provincias sin respuestas y varias con menos de 10." },
];

const FUENTE = Object.fromEntries(FUENTES_INV.map((f) => [f.k, f]));
const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// name -> { fuentes: [k], donde: [factor names] }
const NOMBRE_CAPA = { EST: "Carencias de base", EXP: "Dependencia de redes", RES: "Capacidad de contrastar", PRE: "Clima electoral", EXCLUSION: "Sin conexión (aparte del índice)", HIPEREXP: "Saturación de redes (aparte del índice)", HABDIG: "Habilidades digitales (aparte del índice)" };
const DIC = (() => {
  const m = new Map();
  for (const [capa, vars] of Object.entries(VARIABLES_CAPA)) {
    for (const [nombre, k] of vars) {
      const e = m.get(nombre) ?? { nombre, fuentes: new Set(), capas: [] };
      e.fuentes.add(k);
      if (!e.capas.includes(capa)) e.capas.push(capa);
      m.set(nombre, e);
    }
  }
  return m;
})();

export const variableInfo = (nombre) => DIC.get(String(nombre ?? "").trim()) ?? null;

function dondeEntra(e) {
  const nombres = e.capas.map((c) => NOMBRE_CAPA[c]).filter(Boolean);
  return nombres.length ? nombres.join(", ") : "Solo describe; no entra a ningún índice.";
}

/** One entry of the dictionary, in the same dialog as the map-layer sheets. */
export function openVariable(nombre) {
  const e = variableInfo(nombre);
  if (!e) return;
  const fuentes = [...e.fuentes].map((k) => FUENTE[k]).filter(Boolean);
  const bloques = [
    ["De dónde viene", `<p>${fuentes.map((f) => `<b>${esc(f.nombre)}</b> (${esc(f.org)}), corte ${esc(f.corte)}`).join("; ")}.</p>`],
    ["Dónde entra en el índice", `<p>${esc(dondeEntra(e))}</p>`],
    ["Qué tan firme es", fuentes.map((f) => `<p>${f.solidez.map(pips).join(" ")} ${esc(f.como)}</p>`).join("")],
    ["Qué puede fallar", fuentes.map((f) => `<p>${esc(f.falla)}</p>`).join("")],
  ];
  $("fichaTitulo").textContent = `Qué es: ${e.nombre}`;
  $("fichaSub").textContent = "Entrada del diccionario de variables que alimentan el índice.";
  $("fichaCuerpo").innerHTML =
    bloques.map(([q, a]) => `<li><b>${esc(q)}</b>${a}</li>`).join("") +
    `<li><button type="button" class="linkbtn" data-ir="fuentes">Ver todas las variables en Fuentes oficiales</button></li>`;
  $("fichaCuerpo").querySelector("[data-ir]").onclick = () => {
    $("dlgFicha").close();
    location.hash = "#fuentes";
    requestAnimationFrame(() => $(`var-${slug(e.nombre)}`)?.scrollIntoView({ block: "center" }));
  };
  const dlg = $("dlgFicha");
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}

/** Small "Qué es" link next to a variable, when the dictionary knows it. */
export const enlaceVariable = (nombre) => (variableInfo(nombre) ? `<button type="button" class="linkbtn qes noprint" data-var="${esc(variableInfo(nombre).nombre)}">Qué es</button>` : "");

export function bindVariables(root) {
  root.querySelectorAll("[data-var]").forEach((b) => (b.onclick = () => openVariable(b.dataset.var)));
}

const fila = (celdas) => `<tr>${celdas.map((c, i) => `<td${i === 0 ? ' style="font-weight:650"' : ""}>${c}</td>`).join("")}</tr>`;

/** Inventory of the five bases and the dictionary of variables, for "Fuentes oficiales". */
export function renderInventario() {
  const host = $("inventario");
  if (!host) return;
  const vars = [...DIC.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  host.innerHTML = `
  <div class="card" style="margin-bottom:16px" id="inv-fuentes">
   <h2>Las cinco bases, con su corte y qué tan sólidas son</h2>
   <p class="fintro" style="margin-bottom:12px">Antes de citar una cifra, mira de qué base sale y cuándo se midió.</p>
   <div style="overflow-x:auto"><table class="ftab"><thead><tr><th>Base</th><th>Corte</th><th>Solidez</th><th>Cómo se mide</th></tr></thead><tbody>
   ${FUENTES_INV.map((f) => fila([`${esc(f.nombre)}<div class="srcline">${esc(f.org)}</div>`, esc(f.corte), f.solidez.map(pips).join("<br>"), esc(f.como)])).join("")}
   </tbody></table></div>
   <p class="fnote">${esc(CORTE_FRASE)} El corte es el año de cada censo o encuesta; la fecha exacta de publicación se está confirmando con cada fuente. El umbral de ${MUESTRA_DEBIL} casos para llamar «débil» a una muestra es un criterio de trabajo que se confirma con los microdatos.</p>
  </div>
  <div class="card" style="margin-bottom:16px" id="inv-variables">
   <h2>Variables que alimentan el índice</h2>
   <p class="fintro" style="margin-bottom:12px">Cada variable con su base y el factor donde entra. Desde la ficha de una provincia, «Qué es» te trae aquí.</p>
   <div style="overflow-x:auto"><table class="ftab"><thead><tr><th>Variable</th><th>Base</th><th>Dónde entra</th></tr></thead><tbody>
   ${vars.map((e) => `<tr id="var-${slug(e.nombre)}"><td style="font-weight:650">${esc(e.nombre)}</td><td>${[...e.fuentes].map((k) => `<span class="fdot" style="background:${FUENTE_VAR[k][1]}"></span>${esc(FUENTE_VAR[k][0])}`).join("<br>")}</td><td>${esc(dondeEntra(e))}</td></tr>`).join("")}
   </tbody></table></div>
  </div>`;
}
