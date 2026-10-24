// Module: escucha. Part of the app.js split into native ES modules (no build step).

import { skLines } from "../estados.js";
import { esc, vacioFlecha } from "../ui.js";
import { E } from "./estado.js";
import { provinceKey } from "./util.js";
import { tipHide, tipMove, tipShow } from "./tooltip.js";
import { getTendencias, safeUrl } from "./kit.js";

export const vacioEscucha = () => vacioFlecha({ donde: "tend", titulo: "Toca una provincia", texto: "Verás los temas y actores más mencionados en X y medios sobre ese territorio." });

export async function runTendencias(province) {
  const box = document.getElementById("tendResult");
  if (!province) {
    box.innerHTML = vacioEscucha();
    return;
  }
  box.innerHTML = `<p class="note">Leyendo X y medios sobre ${esc(province)}… puede tardar hasta 20 segundos.</p>${skLines(4)}`;
  try {
    // shared cache with the sheet's "Qué se está diciendo"; post text comes
    // from X and outlets, so every field is escaped and links must be http(s)
    const res = await getTendencias(province);
    if (res.note) {
      box.innerHTML = `<p class="note">${esc(res.note)}</p>`;
      return;
    }
    const all = [...res.actores, ...res.temas];
    box.innerHTML = `
    <p class="note">${res.total_analizados} publicaciones analizadas · X y medios</p>
    <div class="trend-chip-row">${all
      .map((t, i) => `<button class="trend-chip${res.actores.includes(t) ? " actor" : ""}" data-i="${i}">${esc(t.term)}<span class="count">${t.count}</span></button>`)
      .join("")}</div>
    <div id="tendSamples"></div>
    <p class="caveat">Conteo en muestra pequeña — pista para reportear, no dato citable.</p>`;
    box.querySelectorAll(".trend-chip").forEach((chip) => {
      chip.onclick = () => {
        const t = all[Number(chip.dataset.i)];
        E.tendOpenTerm = E.tendOpenTerm === t.term ? null : t.term;
        document.getElementById("tendSamples").innerHTML =
          E.tendOpenTerm == null
            ? ""
            : `<div class="trend-samples">${(all.find((x) => x.term === E.tendOpenTerm)?.samples || [])
                .filter((s) => safeUrl(s.link))
                .map((s) => `<a href="${esc(safeUrl(s.link))}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`)
                .join("")}</div>`;
      };
    });
  } catch (e) {
    box.innerHTML = `<div class="asis-loading">No se pudo leer la conversación.</div>`;
  }
}

function drawTendMapSVG(svgEl, pathsMap) {
  svgEl.innerHTML = "";
  for (const [key, d] of Object.entries(pathsMap)) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "tend-pv");
    path.dataset.k = key;
    path.setAttribute("role", "button");
    path.setAttribute("tabindex", "0");
    const displayName = E.PROVINCIAS.find((p) => provinceKey(p) === key) || key;
    path.addEventListener("mouseenter", (e) => {
      tipShow(e.clientX, e.clientY, `<b>${displayName}</b>`);
    });
    path.addEventListener("mousemove", (e) => tipMove(e.clientX, e.clientY));
    path.addEventListener("mouseleave", tipHide);
    path.addEventListener("click", () => {
      E.tendSel = key;
      paintTendMap();
      document.getElementById("tendProvLabel").textContent = displayName;
      runTendencias(displayName);
      // on a phone the result sits under the map: bring it into view, no scrolling needed
      if (innerWidth <= 760) setTimeout(() => document.getElementById("tendProvLabel").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 30);
    });
    svgEl.appendChild(path);
  }
}

export function paintTendMap() {
  document.querySelectorAll(".tend-pv").forEach((el) => {
    el.classList.toggle("sel", el.dataset.k === E.tendSel);
  });
}

export function initAsistente() {
  document.getElementById("tendResult").innerHTML = vacioEscucha();
  if (E.PATHS) {
    drawTendMapSVG(document.getElementById("tend-map"), E.PATHS.mainland);
    drawTendMapSVG(document.getElementById("tend-map-gal"), E.PATHS.galapagos);
  }
}
