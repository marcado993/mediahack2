// Module: paginas. Part of the app.js split into native ES modules (no build step).

import { getJSON } from "../api.js";
import { skTable } from "../estados.js";
import { esc, fmt } from "../ui.js";
import { E } from "./estado.js";
import { $, normalize } from "./util.js";
import { goToPerfil } from "./kit.js";

export async function initDatos() {
  $("tablaCarga").innerHTML = skTable(10);
  E.TABLA_DATA = await getJSON("/api/segmentadores/tabla");
  $("tablaCarga").remove();
  document.getElementById("buscarDatos").oninput = renderTabla;
  renderTabla();
}

function renderTabla() {
  const search = normalize(document.getElementById("buscarDatos").value);
  const filas = E.TABLA_DATA.filas
    .filter((f) => normalize(f.provincia).includes(search))
    .slice()
    .sort((a, b) => {
      const va = a[E.sortKey],
        vb = b[E.sortKey];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string") return E.sortDir * va.localeCompare(vb);
      return E.sortDir * (va - vb);
    });

  const headCols = E.TABLA_DATA.columnas.map((c) => `<th class="num" data-k="${c.key}" title="${c.key} · ${c.unit}">${c.label}</th>`).join("");
  const bodyRows = filas
    .map(
      (f) => `<tr data-p="${f.provincia}"><td>${f.rank != null ? Math.round(f.rank) : "—"}</td><td>${f.provincia}</td><td>${f.nivel}</td>
    ${E.TABLA_DATA.columnas.map((c) => `<td class="num">${f[c.key] != null ? fmt(f[c.key]) : "—"}</td>`).join("")}</tr>`
    )
    .join("");
  const footCols = E.TABLA_DATA.columnas.map((c) => `<td class="num">${E.TABLA_DATA.nacional[c.key] != null ? fmt(E.TABLA_DATA.nacional[c.key]) : "—"}</td>`).join("");

  document.getElementById("tabla").innerHTML = `
  <thead><tr><th data-k="rank">#</th><th data-k="provincia">Provincia</th><th data-k="nivel">Nivel</th>${headCols}</tr></thead>
  <tbody>${bodyRows || `<tr><td colspan="${3 + E.TABLA_DATA.columnas.length}" class="sin-res">No encontramos «${esc(document.getElementById("buscarDatos").value.trim())}» en la tabla. Revisa la ortografía o prueba con el nombre oficial, como «Azuay» o «Guayas».</td></tr>`}</tbody>
  <tfoot><tr style="font-weight:700;background:#f7f9fb"><td colspan="3">Nacional</td>${footCols}</tr></tfoot>`;

  document.querySelectorAll("#tabla th").forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.k;
      E.sortDir = E.sortKey === k ? -E.sortDir : 1;
      E.sortKey = k;
      renderTabla();
    };
  });
  document.querySelectorAll("#tabla tbody tr").forEach((tr) => {
    tr.onclick = () => goToPerfil(tr.dataset.p);
  });
}

// ---------------------------------------------------------------------
// Metodología
// ---------------------------------------------------------------------
export async function initMeto() {
  const data = await getJSON("/api/segmentadores/metodologia");
  document.getElementById("meto").innerHTML = `
  <h2>Nota metodológica</h2>
  <p>${data.descripcion}</p>
  <h4>Dimensiones</h4>
  <ul>${Object.entries(data.dimensiones)
    .map(([n, t]) => `<li><b>${n}:</b> ${t}</li>`)
    .join("")}</ul>
  <h4>Mecanismos digitales</h4>
  <ul>${Object.entries(data.mecanismos_digitales)
    .map(([n, t]) => `<li><b>${n}:</b> ${t}</li>`)
    .join("")}</ul>
  <h4>Fuentes</h4>
  <ul>${data.fuentes.map((f) => `<li>${f}</li>`).join("")}</ul>
  <p><b>Cobertura:</b> ${data.cobertura}</p>
  <h4>Limitaciones</h4>
  <p>${data.limitaciones}</p>
  <div class="warn">${data.advertencia}</div>`;
}
