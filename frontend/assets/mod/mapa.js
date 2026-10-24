// Module: mapa. Part of the app.js split into native ES modules (no build step).

import { getJSON } from "../api.js";
import { flag } from "../tenant.js";
import { esc, fmt, fmtInt, importedTag, borderlineTag } from "../ui.js";
import { E } from "./estado.js";
import { $, provinceKey } from "./util.js";
import { col, inkFor, isPositiveKey, scaleFor } from "./color.js";
import { CAPA_DESC, CAPA_FLAG, CAPA_LG, FACTORES, LABEL_PROVINCES, PERFILES, PERFIL_CAPA, esLimite, perfilColor, perfilInfo, perfilPlano } from "./datos.js";
import { navigate } from "./nav.js";
import { tipHide, tipMove, tipShow } from "./tooltip.js";
import { goToPerfil } from "./kit.js";
import { renderPeek, selectProvince } from "./inicio.js";
import { openFicha } from "./descargas.js";

// ---------------------------------------------------------------------
// Mapas
// ---------------------------------------------------------------------
export function byKey() {
  const idx = {};
  for (const p of E.MAPA.provincias) idx[provinceKey(p.provincia)] = p;
  return idx;
}

export const capaEnabled = (c) => !CAPA_FLAG[c.codigo] || flag(CAPA_FLAG[c.codigo]);

export function renderCapas() {
  const box = document.getElementById("capas");
  const MAIN = ["IVEI", "EST", "EXP", "RES", "PRE"];
  const EXTRA = ["EXCLUSION", "HIPEREXP", "HABDIG", "PERFIL"];
  const byCode = Object.fromEntries(capasAll().filter(capaEnabled).map((c) => [c.codigo, c]));
  const expandido = true;
  const chip = (code) => {
    const c = byCode[code];
    if (!c) return "";
    const on = code === E.capa;
    const label = code === "IVEI" ? "Todos" : c.nombre;
    const tag = ["EST", "EXP", "RES", "PRE"].includes(code) ? `<span class="fcode">${code}</span>` : "";
    const help = FACTORES[code] ? `<button type="button" class="fhelp" data-ficha="${code}" aria-label="Cómo leer ${esc(label)}: qué mide y qué variables usa" title="Qué mide y qué variables usa">?</button>` : "";
    return `<span class="fchip${on ? " on" : ""}"><button type="button" class="fbtn" data-capa="${code}" aria-pressed="${on}" title="${esc(CAPA_DESC[code] ?? "")}">${esc(label)}${tag}</button>${help}</span>`;
  };
  box.innerHTML =
    MAIN.map(chip).join("") +
    `<span class="chip-sep" aria-hidden="true"></span>` +
    EXTRA.map(chip).join("");
  box.querySelectorAll("[data-capa]").forEach((b) => (b.onclick = () => navigate(`mapas/${b.dataset.capa}`, { replace: true })));
  box.querySelectorAll("[data-ficha]").forEach((b) => (b.onclick = () => openFicha(b.dataset.ficha)));
}

function valueFor(key) {
  const rec = byKey()[key];
  if (!rec) return null;
  return rec[E.capa];
}

export const factorNombre = (k) => capasAll().find((c) => c.codigo === k)?.nombre ?? k;

export function puestoFactor(k, provincia) {
  const dir = k === "RES" ? 1 : -1; // worst first: low resilience, high everything else
  const arr = E.MAPA.provincias.filter((p) => p[k] != null).sort((a, b) => dir * (a[k] - b[k]));
  const i = arr.findIndex((p) => p.provincia === provincia);
  return i < 0 ? null : { n: i + 1, de: arr.length };
}

export const capasAll = () => [...E.MAPA.capas, PERFIL_CAPA];

function capaValueText(p) {
  return E.capa === "PERFIL" ? `<b>${esc(perfilInfo(p.perfil)?.corto ?? p.perfil)}</b>` : `<b>${fmt(p[E.capa])}</b>`;
}

export function paintMap() {
  const idx = byKey();
  if (!capasAll().some((c) => c.codigo === E.capa && capaEnabled(c))) E.capa = "IVEI";
  const active = capasAll().find((c) => c.codigo === E.capa);
  const isPerfil = E.capa === "PERFIL";
  document.getElementById("capaTit").textContent = active.nombre;
  document.getElementById("capaDesc").textContent = CAPA_DESC[E.capa] ?? "Mayor valor = mayor vulnerabilidad.";
  const [lgA, lgB] = CAPA_LG[E.capa] ?? ["menor", "mayor"];
  document.getElementById("lgA").textContent = lgA;
  document.getElementById("lgB").textContent = lgB;
  if (!isPerfil) document.getElementById("lgBar").style.background = "linear-gradient(90deg," + scaleFor(E.capa).map(([r, g, b]) => `rgb(${r},${g},${b})`).join(",") + ")";
  $("lgWrap").hidden = isPerfil;
  const cat = $("lgCat");
  cat.hidden = !isPerfil;
  if (isPerfil) {
    cat.innerHTML = PERFILES.map((pf) => {
      const n = E.MAPA.provincias.filter((p) => p.perfil === pf.nombre).length;
      return `<li title="Nombre técnico: ${esc(pf.nombre)}"><span class="sw" style="background:${pf.color}"></span><span>${esc(pf.plano)}</span><b>${n}</b></li>`;
    }).join("");
  }
  $("lgImp").hidden = E.capa === "HABDIG";

  document.querySelectorAll(".pv").forEach((el) => {
    const key = el.dataset.k;
    const rec = idx[key];
    el.setAttribute("fill", isPerfil ? perfilColor(rec?.perfil) : col(E.capa, valueFor(key)));
    el.classList.toggle("sel", key === E.mapSel);
    el.classList.toggle("imp", rec?.n_lb === 0 && E.capa !== "HABDIG");
  });

  // Nulls (no data for this layer) always sink to the bottom of the
  // ranking, regardless of which direction the layer sorts in.
  const rows = [...E.MAPA.provincias].sort((a, b) => {
    if (isPerfil) return PERFILES.findIndex((x) => x.nombre === a.perfil) - PERFILES.findIndex((x) => x.nombre === b.perfil) || b.IVEI - a.IVEI;
    if (a[E.capa] == null) return 1;
    if (b[E.capa] == null) return -1;
    return isPositiveKey(E.capa) ? a[E.capa] - b[E.capa] : b[E.capa] - a[E.capa];
  });
  document.getElementById("rk").innerHTML = rows
    .map((p, i) => {
      const key = provinceKey(p.provincia);
      const v = p[E.capa];
      let tag = "";
      if (E.capa === "HABDIG") {
        tag = v == null ? ' <span class="tag">sin encuestas</span>' : p.HABDIG_n < 10 ? ' <span class="tag">muestra chica</span>' : "";
      } else if (p.n_lb === 0) {
        tag = " " + importedTag({ compact: true });
      }
      if (esLimite(p.provincia)) tag += " " + borderlineTag({ compact: true });
      const bg = isPerfil ? perfilColor(p.perfil) : col(E.capa, v);
      return `<tr data-k="${key}" class="${key === E.mapSel ? "sel" : ""}">
      <td style="width:26px"><span class="rk" style="background:${bg};color:${inkFor(bg)}">${i + 1}</span></td>
      <td>${p.provincia}${tag}</td>
      <td class="num">${isPerfil ? `<span class="pshort">${esc(perfilInfo(p.perfil)?.corto ?? "")}</span>` : `<b>${fmt(v)}</b>`}</td></tr>`;
    })
    .join("");
  document.querySelectorAll("#rk tr").forEach((r) => {
    r.tabIndex = 0;
    r.setAttribute("role", "button");
    r.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        r.click();
      }
    };
    r.onclick = () => selectProvince(byKey()[r.dataset.k].provincia);
    r.onmouseenter = (e) => {
      const p = byKey()[r.dataset.k];
      tipShow(
        e.clientX,
        e.clientY,
        `<b>${p.provincia}</b><br>${active.nombre}: ${capaValueText(p)}<br>
        <span class="r">IVEI</span> ${fmt(p.IVEI)} · <span class="r">Puesto</span> ${p.rank}/24<br>
        ${fmtInt(p.poblacion)} hab.${p.n_lb === 0 ? '<br><span class="r">Sin muestra propia: valor nacional imputado</span>' : ""}`
      );
    };
    r.onmousemove = (e) => tipMove(e.clientX, e.clientY);
    r.onmouseleave = tipHide;
  });
  renderPeek();
}

function drawMapSVG(svgEl, pathsMap, scaleX = 1, scaleY = 1) {
  svgEl.innerHTML = "";
  for (const [key, d] of Object.entries(pathsMap)) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "pv");
    path.dataset.k = key;
    path.setAttribute("role", "button");
    path.setAttribute("tabindex", "0");
    const idx = byKey();
    const p = idx[key];
    path.setAttribute("aria-label", p ? `${p.provincia}: ver resumen` : key);
    path.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && p) {
        e.preventDefault();
        selectProvince(p.provincia);
      }
    });
    path.addEventListener("mouseenter", (e) => {
      if (p) {
        tipShow(
          e.clientX,
          e.clientY,
          `<b>${p.provincia}</b><br>${capasAll().find((c) => c.codigo === E.capa).nombre}: ${capaValueText(p)}<br>
          Puesto ${p.rank}/24 · ${p.nivel}${p.n_lb === 0 ? '<br><span class="r">Sin muestra propia: valor nacional</span>' : ""}`
        );
      }
    });
    path.addEventListener("mousemove", (e) => tipMove(e.clientX, e.clientY));
    path.addEventListener("mouseleave", tipHide);
    path.addEventListener("click", () => {
      if (p) selectProvince(p.provincia);
    });
    path.addEventListener("dblclick", () => {
      if (p) goToPerfil(p.provincia);
    });
    svgEl.appendChild(path);
  }
}

function drawLabels(svgEl) {
  const idx = byKey();
  for (const key of LABEL_PROVINCES) {
    const c = E.PATHS.centroids[key];
    const p = idx[key];
    if (!c || !p) continue;
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", c[0]);
    t.setAttribute("y", c[1] + 3);
    t.setAttribute("class", "lbl");
    t.textContent = p.provincia;
    svgEl.appendChild(t);
  }
}

export async function initMapas() {
  [E.MAPA, E.PATHS] = await Promise.all([getJSON("/api/segmentadores/mapa"), fetch("/assets/ecuador_paths.json").then((r) => r.json())]);
  E.PROVINCIAS = E.MAPA.provincias.map((p) => p.provincia);
  renderCapas();
  drawMapSVG(document.getElementById("map"), E.PATHS.mainland);
  drawMapSVG(document.getElementById("map-gal"), E.PATHS.galapagos);
  drawLabels(document.getElementById("map"));
  paintMap();
  renderScatter();
}

// Exclusión digital x hiperexposición digital: two independent digital-
// vulnerability mechanisms - a province can be high in one, the other,
// both, or neither. Plain hand-drawn SVG, same as the reference chart.
function renderScatter() {
  const sv = document.getElementById("scatter");
  const provincias = E.MAPA.provincias;
  const W = 700,
    H = 420,
    m = { l: 56, r: 16, t: 14, b: 44 };
  const X = (v) => m.l + (v / 100) * (W - m.l - m.r);
  const Y = (v) => H - m.b - (v / 100) * (H - m.t - m.b);
  const mx = provincias.reduce((a, p) => a + p.EXCLUSION, 0) / provincias.length;
  const my = provincias.reduce((a, p) => a + p.HIPEREXP, 0) / provincias.length;

  let s = `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="#fbfcfd" stroke="#e6ebf0"/>`;
  [0, 25, 50, 75, 100].forEach((v) => {
    s += `<line x1="${X(v)}" y1="${m.t}" x2="${X(v)}" y2="${H - m.b}" stroke="#eef2f6"/><line x1="${m.l}" y1="${Y(v)}" x2="${W - m.r}" y2="${Y(v)}" stroke="#eef2f6"/>
    <text x="${X(v)}" y="${H - m.b + 15}" font-size="11" fill="#5f6b7d" text-anchor="middle">${v}</text>
    <text x="${m.l - 8}" y="${Y(v) + 3}" font-size="11" fill="#5f6b7d" text-anchor="end">${v}</text>`;
  });
  s += `<line x1="${X(mx)}" y1="${m.t}" x2="${X(mx)}" y2="${H - m.b}" stroke="#b9c4d0" stroke-dasharray="4 3"/><line x1="${m.l}" y1="${Y(my)}" x2="${W - m.r}" y2="${Y(my)}" stroke="#b9c4d0" stroke-dasharray="4 3"/>`;
  const quad = [
    ["Más saturadas de redes", X(mx) - 8, Y(my) - 8, "end"],
    ["Ambos problemas", X(mx) + 8, Y(my) - 8, "start"],
    ["Ninguno destaca", X(mx) - 8, Y(my) + 18, "end"],
    ["Más sin conexión", X(mx) + 8, Y(my) + 18, "start"],
  ];
  quad.forEach(([t, x, y, a]) => {
    s += `<text x="${x}" y="${y}" font-size="11" fill="#5f6b7d" text-anchor="${a}" font-weight="600">${t}</text>`;
  });
  for (const p of provincias) {
    const r = 4 + Math.sqrt(p.poblacion) / 450;
    s += `<circle cx="${X(p.EXCLUSION)}" cy="${Y(p.HIPEREXP)}" r="${r}" fill="${col("IVEI", p.IVEI)}" stroke="#fff" stroke-width="1.2" data-k="${provinceKey(p.provincia)}" tabindex="0" role="button" aria-label="${esc(p.provincia)}: sin conexión ${fmt(p.EXCLUSION)}, saturación de redes ${fmt(p.HIPEREXP)}" style="cursor:pointer"/>`;
  }
  provincias
    .filter((p) => p.poblacion > 380000 || p.EXCLUSION > 68 || p.HIPEREXP > 74)
    .forEach((p) => {
      s += `<text x="${X(p.EXCLUSION)}" y="${Y(p.HIPEREXP) - 9}" font-size="11" fill="#2b3647" text-anchor="middle" font-weight="600">${p.provincia}</text>`;
    });
  s += `<text x="${(W + m.l) / 2}" y="${H - 6}" font-size="11" fill="#657388" text-anchor="middle" font-weight="600">Más gente sin conexión →</text>
  <text transform="translate(15,${(H - m.b + m.t) / 2}) rotate(-90)" font-size="11" fill="#657388" text-anchor="middle" font-weight="600">Más saturación de redes →</text>`;
  sv.innerHTML = s;

  const idx = byKey();
  sv.querySelectorAll("circle[data-k]").forEach((c) => {
    const p = idx[c.dataset.k];
    if (!p) return;
    c.addEventListener("mouseenter", (e) => {
      tipShow(e.clientX, e.clientY, `<b>${p.provincia}</b><br>Sin conexión <b>${fmt(p.EXCLUSION)}</b><br>Saturación de redes <b>${fmt(p.HIPEREXP)}</b><br><span class="r">${perfilPlano(p.perfil)}</span>`);
    });
    c.addEventListener("mousemove", (e) => tipMove(e.clientX, e.clientY));
    c.addEventListener("mouseleave", tipHide);
    c.addEventListener("click", () => selectProvince(p.provincia));
    c.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectProvince(p.provincia);
      }
    });
  });
}
