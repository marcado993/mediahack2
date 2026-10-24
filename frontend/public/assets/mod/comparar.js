// Module: comparar. Part of the app.js split into native ES modules (no build step).

import { getJSON } from "../api.js";
import { skTable } from "../estados.js";
import { ICON, esc, fmt, provinceFlags, scoreRange } from "../ui.js";
import { E } from "./estado.js";
import { $ } from "./util.js";
import { enc, esLimite, perfilColor, perfilPlano } from "./datos.js";
import { col, inkFor } from "./color.js";
import { copiarBtn, errorBox, navigate } from "./nav.js";
import { dimRow } from "./kit.js";
import { bindVariables, enlaceVariable } from "./diccionario.js";
import { textoRangoPuesto } from "./sensibilidad.js";

// ---------------------------------------------------------------------
// Comparar
// ---------------------------------------------------------------------
export function initComparar() {
  const a = document.getElementById("cmpA"),
    b = document.getElementById("cmpB");
  a.innerHTML = b.innerHTML = E.PROVINCIAS.map((p) => `<option value="${p}">${p}</option>`).join("");
  a.value = E.PROVINCIAS[0];
  b.value = E.PROVINCIAS[1] || E.PROVINCIAS[0];
  const sync = () => {
    navigate(`comparar/${enc(a.value)}/${enc(b.value)}`, { replace: true });
    renderCmp();
  };
  a.onchange = sync;
  b.onchange = sync;
  renderCmp();
}

// ---------------------------------------------------------------------
// Comparing two territories: the verdict first, the evidence after
// ---------------------------------------------------------------------
export function deltaTableHTML(d) {
  const { a, b } = d;
  const rows = [["Nivel de vulnerabilidad", a.ivei, b.ivei, 1], ...a.dimensiones.map((x, i) => [x.nombre, x.valor, b.dimensiones[i].valor, x.codigo === "RES" ? -1 : 1])];
  return `<div style="overflow-x:auto"><table class="delta"><thead><tr><th>Factor</th><th class="num">${esc(a.provincia)}</th><th class="num">${esc(b.provincia)}</th><th class="num">Diferencia</th></tr></thead><tbody>${rows
    .map(([label, va, vb, dir]) => {
      const diff = va == null || vb == null ? null : va - vb;
      const peor = diff == null ? "" : Math.abs(diff) < 2 ? "eq" : dir * diff > 0 ? "up" : "dn";
      const txt = diff == null ? "—" : `${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))}`;
      return `<tr><td>${esc(label)}</td><td class="num"><b>${fmt(va)}</b></td><td class="num"><b>${fmt(vb)}</b></td><td class="num ${peor}">${txt}</td></tr>`;
    })
    .join("")}</tbody></table></div>
    <p class="note">Rojo: ${esc(a.provincia)} está peor que ${esc(b.provincia)}. Verde: mejor. Gris: menos de 2 puntos de diferencia.</p>`;
}

export function compareText(d) {
  const { a, b } = d;
  const diff = a.ivei - b.ivei;
  const [mas, menos] = diff >= 0 ? [a, b] : [b, a];
  const frase =
    Math.abs(diff) < 2
      ? `${a.provincia} y ${b.provincia} tienen un nivel de vulnerabilidad casi igual (${fmt(a.ivei)} y ${fmt(b.ivei)}).`
      : `${mas.provincia} tiene más vulnerabilidad electoral que ${menos.provincia}: ${fmt(mas.ivei)} frente a ${fmt(menos.ivei)} (${fmt(Math.abs(diff))} puntos más).`;
  const top = a.dimensiones
    .map((x, i) => ({ nombre: x.nombre, va: x.valor, vb: b.dimensiones[i].valor }))
    .filter((x) => x.va != null && x.vb != null)
    .sort((p, q) => Math.abs(q.va - q.vb) - Math.abs(p.va - p.vb))[0];
  const detalle = top ? `Lo que más los separa: ${top.nombre} (${a.provincia} ${fmt(top.va)}, ${b.provincia} ${fmt(top.vb)}).` : "";
  const copia = `${frase} ${detalle} Fuente: Observatorio de Vulnerabilidad ante la Desinformación Electoral (IVEI 2024). El índice describe territorios, no personas.`.replace(/\s+/g, " ");
  return { frase, detalle, copia };
}

// n_lb of a province, from the map data already loaded (0 = no sample of its own)
const nLb = (provincia) => E.MAPA?.provincias.find((p) => p.provincia === provincia)?.n_lb;

export async function renderCmp() {
  const a = document.getElementById("cmpA").value,
    b = document.getElementById("cmpB").value;
  const target = document.getElementById("comparar");
  if (a === b) {
    target.innerHTML = `<div class="warn" role="status">Elegiste la misma provincia dos veces. Cambia una de las dos para ver las diferencias.</div>`;
    return;
  }
  target.innerHTML = `<p class="note">Comparando ${esc(a)} y ${esc(b)}…</p>${skTable(6)}`;
  let data;
  try {
    data = await getJSON(`/api/segmentadores/comparar?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  } catch (e) {
    return errorBox(target, "No se pudo hacer la comparación.", renderCmp);
  }
  const { frase, detalle, copia } = compareText(data);

  const rows = data.indicadores
    .map((row) => {
      let cls = "eq";
      if (row.diferencia != null) {
        cls = row.direction === 1 ? (row.diferencia > 0 ? "up" : row.diferencia < 0 ? "dn" : "eq") : row.direction === -1 ? (row.diferencia > 0 ? "dn" : row.diferencia < 0 ? "up" : "eq") : "eq";
      }
      return `<tr><td>${row.label}${enlaceVariable(row.label)}<div class="srcline">${row.source} · ${row.unit}</div></td>
      <td class="num"><b>${fmt(row.a)}</b></td><td class="num"><b>${fmt(row.b)}</b></td>
      <td class="num ${cls}">${row.diferencia == null ? "" : (row.diferencia >= 0 ? "+" : "−") + fmt(Math.abs(row.diferencia))}</td>
      <td class="num" style="color:var(--mut)">${fmt(row.nacional)}</td>
      <td style="color:var(--mut);font-size:11.5px">${row.unit}</td></tr>`;
    })
    .join("");

  target.innerHTML = `
  <section class="card cmp-verdict">
   <h2>${esc(frase)}</h2>
   ${detalle ? `<p class="pais" style="margin:6px 0 0;font-size:14px">${esc(detalle)}</p>` : ""}
   <div class="cita-act" style="margin-top:12px"><button class="btn" id="btnCmpCopia" type="button">Copiar comparación</button><button class="btn gh" id="btnCmpEnlace" type="button">Copiar enlace</button></div>
   <p class="rel-aviso">${ICON.warn}<span><b>Solo entre provincias de Ecuador:</b> el índice es relativo. No lo uses para comparar con otro país ni con otro año sin fijar anclajes.</span></p>
  </section>
  <section class="card" style="margin-top:16px"><h3>Diferencia por factor</h3>${deltaTableHTML(data)}</section>
  <section class="card" style="margin-top:16px"><h2>Las dos provincias lado a lado</h2><div class="grid g2" style="margin-top:10px">
   ${[data.a, data.b]
     .map(
       (p) => `<div><h3>${esc(p.provincia)}</h3>
    <div class="ptags">${provinceFlags({ isImputed: nLb(p.provincia) === 0, isBorderlineCase: esLimite(p.provincia), compact: true })}</div>
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="big" style="font-size:34px">${fmt(p.ivei)}</div>
     <span class="pill" style="background:${col("IVEI", p.ivei)};color:${inkFor(col("IVEI", p.ivei))}">${esc(p.nivel)}</span>${scoreRange({ confidenceRange: p.rango ?? null })}</div>
    <p class="pais" style="margin:4px 0 0;font-size:13px">${esc(textoRangoPuesto(p.provincia))}</p>
    <div style="margin-top:12px">${p.dimensiones.map((d) => dimRow(d.nombre, d.valor, null, d.color)).join("")}</div>
    <p class="note"><span class="pdot" style="background:${perfilColor(p.perfil)}"></span><b>${esc(perfilPlano(p.perfil))}.</b></p></div>`
     )
     .join("")}
  </div></section>
  <section class="card" style="margin-top:16px"><h2>Todos los indicadores</h2><p class="note" style="margin:2px 0 10px">Indicador por indicador, con fuente.</p><div style="overflow:auto;max-height:600px">
  <table><thead><tr><th>Indicador</th><th class="num">${esc(data.a.provincia)}</th>
  <th class="num">${esc(data.b.provincia)}</th><th class="num">Dif.</th><th class="num">País</th>
  <th>Unidad</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  bindVariables(target);
  $("btnCmpCopia").onclick = (e) => copiarBtn(e.currentTarget, copia, "comparacion");
  $("btnCmpEnlace").onclick = (e) => copiarBtn(e.currentTarget, location.href);
}
