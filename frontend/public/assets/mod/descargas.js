// Module: descargas. Part of the app.js split into native ES modules (no build step).

import { getJSON } from "../api.js";
import { conBusy } from "../estados.js";
import { esc } from "../ui.js";
import { E } from "./estado.js";
import { $ } from "./util.js";
import { isPositiveKey, scaleFor } from "./color.js";
import { pedirAcuerdo, NOTA_DESCARGA } from "./etica.js";
import { CALCULO_CAPA, CAPA_DESC, CORTE_FRASE, CAPA_LG, FACTORES, FALLA_FACTOR, FUENTE_VAR, PERFILES, VARIABLES_CAPA } from "./datos.js";
import { copiarBtn, navigate, toast } from "./nav.js";
import { byKey, capasAll, factorNombre } from "./mapa.js";
import { citaDeRegistro, reliability } from "./kit.js";

function variablesHTML(code) {
  if (code === "IVEI" || code === "PERFIL") {
    return `<ul class="fv-list">${["EST", "EXP", "RES", "PRE"]
      .map((k) => `<li><button type="button" class="linkbtn" data-ficha="${k}">${esc(factorNombre(k))}</button> <span class="fv-n">${VARIABLES_CAPA[k].length} variables</span></li>`)
      .join("")}</ul>`;
  }
  const vars = VARIABLES_CAPA[code] ?? [];
  const fuentes = [...new Set(vars.map(([, f]) => f))];
  return `<ul class="fv-list">${vars.map(([v, f]) => `<li><span class="fdot" style="background:${FUENTE_VAR[f][1]}"></span>${esc(v)} <span class="fv-n">${FUENTE_VAR[f][0]}</span></li>`).join("")}</ul>
   <p class="fv-pie">${vars.length} ${vars.length === 1 ? "variable" : "variables"} · ${fuentes.map((f) => FUENTE_VAR[f][0]).join(", ")}${fuentes.includes("L") ? ". Las del Latinobarómetro son de encuesta con muestras pequeñas por provincia." : "."}</p>`;
}

export function openFicha(code, provincia) {
  const f = FACTORES[code] ?? {};
  const nombre = code === "IVEI" ? "Nivel de vulnerabilidad (todos los factores)" : factorNombre(code);
  const [lo, hi] = f.lg ?? ["", ""];
  const lectura =
    code === "PERFIL"
      ? "Los colores son tipos, no niveles: ninguno es «mejor» que otro. Sirven para agrupar provincias que llegan a la desinformación por caminos parecidos."
      : `${f.lectura} ${isPositiveKey(code) ? "Rojo" : "Verde"} = ${lo}; ${isPositiveKey(code) ? "verde" : "rojo"} = ${hi}. Compara provincias entre sí: no es un nivel absoluto, y describe el territorio, no a sus habitantes.`;
  $("fichaTitulo").textContent = `Cómo leer: ${nombre}`;
  const conf = provincia ? reliability(E.PERFIL_DATA?.provincia === provincia ? E.PERFIL_DATA.n_lb : null) : null;
  $("fichaSub").textContent = conf ? `Para ${provincia}: ${conf.label.toLowerCase()}${conf.detail ? `. ${conf.detail}` : ""}` : "Lo que mide este mapa, con qué datos y cómo citarlo bien.";
  const bloques = [
    ["Qué mide", `<p>${esc(f.que ?? "")}</p>`],
    [code === "IVEI" || code === "PERFIL" ? "Qué factores usa" : "Qué variables usa", variablesHTML(code)],
    ["Cómo se calcula", `<p>${esc(CALCULO_CAPA[code] ?? "")}</p>`],
    ["Qué significa", `<p>${esc(lectura)}</p>`],
    ["Qué puede fallar", `<p>${esc(FALLA_FACTOR[code] ?? "")}</p>`],
  ];
  if (code === "IVEI") bloques.push(["Qué lo valida", "<p>Correlación de 0,92 con la ENEMDU, prueba de ruido de ±2 puntos y orden estable sin el modulador (ρ = 0,99). Las pruebas de pesos, de variables débiles y de fuente alternativa están en curso.</p>"]);
  $("fichaCuerpo").innerHTML = bloques.map(([q, a]) => `<li><b>${esc(q)}</b>${a}</li>`).join("");
  $("fichaCuerpo").querySelectorAll("[data-ficha]").forEach((b) => (b.onclick = () => openFicha(b.dataset.ficha)));
  const dlg = $("dlgFicha");
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}

// ---------------------------------------------------------------------
// Map actions: press quote, SVG / PNG of the map, open data as CSV
// ---------------------------------------------------------------------
function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function descargarCSV() {
  if (!(await pedirAcuerdo())) return;
  try {
    const t = E.TABLA_DATA ?? (E.TABLA_DATA = await getJSON("/api/segmentadores/tabla"));
    const head = ["Puesto", "Provincia", "Nivel", ...t.columnas.map((c) => `${c.label} (${c.unit})`)];
    const rows = t.filas.map((f) => [f.rank != null ? Math.round(f.rank) : "", f.provincia, f.nivel, ...t.columnas.map((c) => f[c.key] ?? "")]);
    rows.push(["", "Promedio del país", "", ...t.columnas.map((c) => t.nacional[c.key] ?? "")]);
    rows.push([], ["", "Nota: " + CORTE_FRASE], ["", "Nota: " + NOTA_DESCARGA]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
    descargar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "OVADE_datos_provincias.csv");
    toast("Datos descargados. Cita la fuente: Observatorio OVADE.");
  } catch (e) {
    toast("No se pudieron descargar los datos. Revisa tu conexión e inténtalo de nuevo.");
  }
}

function mapaSVG() {
  const act = capasAll().find((c) => c.codigo === E.capa);
  const paths = (el) =>
    [...el.querySelectorAll(".pv")]
      .map((p) => {
        const imp = p.classList.contains("imp");
        return `<path d="${p.getAttribute("d")}" fill="${p.getAttribute("fill")}" stroke="${imp ? "#131a24" : "#fff"}" stroke-width="${imp ? 1.3 : 0.9}"${imp ? ' stroke-dasharray="3.5 2.5"' : ""}/>`;
      })
      .join("");
  const labels = [...$("map").querySelectorAll(".lbl")]
    .map((t) => `<text x="${t.getAttribute("x")}" y="${t.getAttribute("y")}" text-anchor="middle" font-size="9" font-weight="700" fill="#131a24" stroke="#fff" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round">${esc(t.textContent)}</text>`)
    .join("");
  let legend;
  if (E.capa === "PERFIL") {
    legend = PERFILES.map((pf, i) => `<rect x="${16 + (i % 2) * 270}" y="${650 + Math.floor(i / 2) * 15}" width="10" height="10" fill="${pf.color}"/><text x="${32 + (i % 2) * 270}" y="${659 + Math.floor(i / 2) * 15}" font-size="10" fill="#26313f">${esc(pf.plano)}</text>`).join("");
  } else {
    const stops = scaleFor(E.capa).map(([r, g, b], i, a) => `<stop offset="${i / (a.length - 1)}" stop-color="rgb(${r},${g},${b})"/>`).join("");
    const [lo, hi] = CAPA_LG[E.capa] ?? ["menor", "mayor"];
    legend = `<defs><linearGradient id="lg">${stops}</linearGradient></defs><rect x="16" y="652" width="240" height="10" rx="3" fill="url(#lg)"/><text x="16" y="678" font-size="10" fill="#26313f">${esc(lo)}</text><text x="256" y="678" font-size="10" text-anchor="end" fill="#26313f">${esc(hi)}</text><text x="276" y="662" font-size="10" fill="#5f6b7d">Borde punteado: valor nacional imputado</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -46 560 748" width="840" height="1122" font-family="Arial, Helvetica, sans-serif">
<rect x="0" y="-46" width="560" height="748" fill="#fff"/>
<text x="16" y="-22" font-size="18" font-weight="700" fill="#131a24">${esc(act.nombre)}</text>
<text x="16" y="-6" font-size="10.5" fill="#5f6b7d">${esc(CAPA_DESC[E.capa] ?? "").slice(0, 118)}</text>
${paths($("map"))}${labels}
<g transform="translate(14,6)"><rect width="92" height="100" rx="5" fill="#fff" stroke="#d3dbe4"/><text x="6" y="12" font-size="8" font-weight="700" fill="#5f6b7d">GALÁPAGOS</text><g transform="translate(4,14) scale(0.8)">${paths($("map-gal"))}</g></g>
${legend}
<text x="16" y="698" font-size="9" fill="#5f6b7d">Fuente: Observatorio de Vulnerabilidad ante la Desinformación Electoral (OVADE). Censo 2022, ENEMDU 2024, Latinobarómetro 2024, MINTEL 2023.</text>
</svg>`;
}

function descargarSVG() {
  descargar(new Blob([mapaSVG()], { type: "image/svg+xml" }), `OVADE_mapa_${E.capa}.svg`);
}

async function descargarPNG() {
  const url = URL.createObjectURL(new Blob([mapaSVG()], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise((ok, ko) => {
      img.onload = ok;
      img.onerror = ko;
      img.src = url;
    });
    const c = Object.assign(document.createElement("canvas"), { width: 1680, height: 2244 });
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      descargar(b, `OVADE_mapa_${E.capa}.png`);
      toast("Mapa en PNG descargado. Cita la fuente: Observatorio OVADE.");
    }, "image/png");
  } catch (e) {
    toast("No se pudo generar el PNG. Prueba con el SVG.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function initMapTools() {
  // downloads live in a menu: close it once a choice is made, and say what happened
  const tras = (fn) => (e) => {
    $("dlMenu").open = false;
    return conBusy($("dlMenu").querySelector("summary"), "Preparando…", () => fn(e));
  };
  $("btnSvg").onclick = tras(() => {
    descargarSVG();
    toast("Mapa en SVG descargado. Cita la fuente: Observatorio OVADE.");
  });
  $("btnPng").onclick = tras(descargarPNG);
  $("btnLeerCapa").onclick = () => openFicha(E.capa);
  $("btnCsv").onclick = tras(descargarCSV);
  if ($("btnCsvDatos")) $("btnCsvDatos").onclick = (e) => conBusy(e.currentTarget, "Preparando…", descargarCSV);
  $("btnCitaMapa").onclick = (e) => {
    const p = E.mapSel ? byKey()[E.mapSel] : null;
    if (!p) return toast("Elige primero una provincia en el mapa para copiar su cita.");
    copiarBtn(e.currentTarget, citaDeRegistro(p), "cita_mapa");
  };
}

export function initExtras() {
  $("btnGlosario").onclick = () => {
    navigate("meto");
    requestAnimationFrame(() => $("glosario")?.scrollIntoView());
  };
  $("fichaCerrar").onclick = () => $("dlgFicha").close();
  $("dlgFicha").addEventListener("click", (e) => {
    if (e.target === $("dlgFicha")) $("dlgFicha").close();
  });
}
