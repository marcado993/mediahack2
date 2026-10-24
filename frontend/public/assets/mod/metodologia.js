// Module: metodologia. Part of the app.js split into native ES modules (no build step).

import { esc } from "../ui.js";
import { E } from "./estado.js";
import { $ } from "./util.js";
import { CORTE_FRASE, DECISIONES, GLOSARIO, GL_TERMS, MUESTRA_DEBIL, SEIS_PREGUNTAS } from "./datos.js";
import { navigate, toast } from "./nav.js";
import { paintMap } from "./mapa.js";

function solidezResumen() {
  const todas = E.MAPA?.provincias ?? [];
  const debiles = todas.filter((p) => p.n_lb < MUESTRA_DEBIL);
  const sinMuestra = todas.filter((p) => p.n_lb === 0).map((p) => p.provincia);
  return { total: todas.length, debiles: debiles.length, sinMuestra };
}

function metodoTabla(cabeceras, filas) {
  return `<div style="overflow-x:auto"><table class="ftab"><thead><tr>${cabeceras.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${filas
    .map((f) => `<tr>${f.map((c, i) => `<td${i === 0 ? ' style="font-weight:650;white-space:nowrap"' : ""}>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

export const gl = (k, label) => `<button type="button" class="gl" data-gl="${k}" aria-expanded="false">${label}</button>`;

export function initGlosario() {
  const tip = Object.assign(document.createElement("div"), { id: "glTip", hidden: true });
  tip.setAttribute("role", "note");
  document.body.appendChild(tip);
  let cur = null;
  const cerrar = () => {
    cur?.setAttribute("aria-expanded", "false");
    cur?.removeAttribute("aria-describedby");
    cur = null;
    tip.hidden = true;
  };
  const abrir = (b) => {
    const [t, d] = GL_TERMS[b.dataset.gl];
    tip.innerHTML = `<b>${esc(t)}</b><p>${esc(d)}</p><button type="button" class="linkbtn" id="glMas">Ver el glosario completo</button>`;
    tip.hidden = false;
    const r = b.getBoundingClientRect();
    const w = Math.min(320, innerWidth - 24);
    tip.style.width = w + "px";
    tip.style.left = Math.max(12, Math.min(r.left, innerWidth - w - 12)) + "px";
    tip.style.top = r.bottom + 6 + "px";
    b.setAttribute("aria-expanded", "true");
    b.setAttribute("aria-describedby", "glTip");
    cur = b;
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".gl");
    if (b) {
      const mismo = b === cur;
      cerrar();
      if (!mismo) abrir(b);
      return;
    }
    if (e.target.closest("#glMas")) {
      cerrar();
      navigate("meto");
      requestAnimationFrame(() => $("glosario")?.scrollIntoView());
      return;
    }
    if (!e.target.closest("#glTip")) cerrar();
  });
  addEventListener("scroll", cerrar, { passive: true });
  return cerrar;
}

// Esc steps back one layer at a time: open help, download menu, search text,
// the selected province on the map, and finally the province sheet.
export function initAtajos(cerrarGl) {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
    if (!$("glTip").hidden) return cerrarGl();
    if ($("dlMenu").open) {
      $("dlMenu").open = false;
      return;
    }
    const a = document.activeElement;
    if (a && a.matches("input[type=text],input[type=search]") && a.value) {
      a.value = "";
      a.dispatchEvent(new Event("input"));
      return;
    }
    if (E.currentView === "mapas" && E.mapSel) {
      E.mapSel = null;
      paintMap();
      toast("Selección quitada.");
    } else if (E.currentView === "perfil" && E.perfilActual) {
      navigate("perfil");
      toast("Volviste al inicio. Con «Atrás» regresas a la provincia.");
    }
  });
}

export function renderMetodoExtra() {
  const r = solidezResumen();
  const nivel = (n, t) => `<span class="sol ${n}"><span class="pips" aria-hidden="true"><i></i><i></i><i></i></span>Fuente ${{ alta: "sólida", media: "media", baja: "débil" }[n]}</span> ${t}`;
  $("metoExtra").innerHTML = `
  <nav class="jump noprint" aria-label="Ir a una sección">
   <button type="button" data-j="decisiones">Qué puedo afirmar</button>
   <button type="button" data-j="solidez">Qué tan firme es</button>
   <button type="button" data-j="glosario">Glosario</button>
   <button type="button" data-j="ficha-indice">Seis preguntas</button>
   <button type="button" data-j="meto">Nota técnica</button>
  </nav>
  <div class="card" id="decisiones" style="margin-bottom:16px">
   <h2>Qué puedes afirmar con el índice y qué no</h2>
   <p class="fintro" style="margin-bottom:12px">El índice dice dónde un mensaje encuentra un terreno más frágil. No reemplaza el criterio editorial.</p>
   ${metodoTabla(["Decisión", "El índice puede apoyarla", "El índice no puede apoyarla"], DECISIONES.map(([d, si, no]) => [d, si, no]))}
  </div>

  <div class="card" id="solidez" style="margin-bottom:16px">
   <h2>Qué tan firme es cada cifra</h2>
   <p class="fintro">Junto a cada dato del perfil provincial aparece una marca de solidez. Depende de cómo se midió el dato, no de si el valor es alto o bajo.</p>
   ${metodoTabla(
     ["Nivel", "Qué significa", "Fuentes"],
     [
       [nivel("alta", ""), "Conteo completo de la población, sin error muestral.", "Censo 2022."],
       [nivel("media", ""), "Encuesta oficial con muestra suficiente para la provincia.", `ENEMDU 2024; Latinobarómetro con ${MUESTRA_DEBIL} casos o más en la provincia.`],
       [nivel("baja", ""), "Muestra débil, valor imputado o encuesta que no representa a la provincia.", `Latinobarómetro con menos de ${MUESTRA_DEBIL} casos o sin muestra propia; ENEMDU-TIC 2024 (solo nacional); MINTEL 2023 (participación voluntaria).`],
     ]
   )}
   <p class="fnote"><b>En este momento:</b> ${r.debiles} de ${r.total} provincias tienen menos de ${MUESTRA_DEBIL} casos del Latinobarómetro. ${
     r.sinMuestra.length ? `${r.sinMuestra.length} no tienen ninguno (${r.sinMuestra.join(", ")}) y reciben el valor nacional; en el mapa se marcan con borde punteado.` : ""
   } El umbral de ${MUESTRA_DEBIL} casos es el criterio de trabajo y se está confirmando con los microdatos.</p>
   <p class="fnote" style="border:0;margin-top:4px;padding-top:0">${CORTE_FRASE}</p>
  </div>

  <div class="card" id="glosario" style="margin-bottom:16px">
   <h2>Glosario: qué significa cada término</h2>
   <p class="fintro" style="margin-bottom:12px">Usamos palabras de redacción. Entre paréntesis está el nombre técnico, por si lo ves en otro documento.</p>
   <dl class="glos">${GLOSARIO.map(([t, tec, d]) => `<dt>${t}${tec ? ` <span>(${tec})</span>` : ""}</dt><dd>${d}</dd>`).join("")}</dl>
  </div>

  <div class="card" id="ficha-indice" style="margin-bottom:16px">
   <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
    <div><h2>Ficha del índice en seis preguntas</h2>
    <p class="fintro" style="margin-bottom:12px">Lo que cualquier periodista puede leer antes de usar el índice.</p></div>
    <button class="btn gh noprint" id="btnFichaMeto" type="button">Descargar ficha metodológica</button>
   </div>
   ${metodoTabla(["Pregunta", "Qué responde", "En OVADE"], SEIS_PREGUNTAS)}
  </div>`;
  $("btnFichaMeto").onclick = downloadFichaMetodologica;
  document.querySelectorAll("[data-j]").forEach((b) => (b.onclick = () => $(b.dataset.j)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })));
}

function downloadFichaMetodologica() {
  const tabla = (cab, filas) =>
    `<table><thead><tr>${cab.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ficha metodológica del índice</title><style>
body{font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#131a24;max-width:860px;margin:26px auto;padding:0 22px}
h1{font-size:22px;color:#1b3a5c;margin:0 0 4px}h2{font-size:15px;color:#1b3a5c;border-bottom:2px solid #1b3a5c;padding-bottom:3px;margin:24px 0 8px}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;background:#1b3a5c;color:#fff;padding:6px 8px}
td{padding:6px 8px;border-bottom:1px solid #dfe5ec;vertical-align:top}td:first-child{font-weight:600;white-space:nowrap}
.n{color:#5f6b7d;font-size:12px}@media print{body{margin:0}table{page-break-inside:avoid}}
</style></head><body>
<h1>Ficha metodológica del índice</h1>
<p class="n">Observatorio de Vulnerabilidad ante la Desinformación Electoral · Ecuador · generada el ${new Date().toLocaleDateString("es-EC")}</p>
<h2>Seis preguntas</h2>${tabla(["Pregunta", "Qué responde", "En OVADE"], SEIS_PREGUNTAS)}
<h2>Qué decisión periodística apoya el índice y cuál no</h2>${tabla(["Decisión", "Puede apoyarla", "No puede apoyarla"], DECISIONES)}
<p class="n">${CORTE_FRASE} El índice describe territorios, no personas, medios ni candidatos.</p>
</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "Ficha_metodologica_OVADE.html" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
