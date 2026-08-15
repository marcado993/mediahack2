// Observatorio de Vulnerabilidad Electoral - Ecuador
// Plain HTML/CSS/JS, no build step. Fetches everything from the FastAPI
// backend (app/routers/segmentadores.py, ask.py, origin.py, contrast.py,
// trends.py) - nothing here is static/embedded data except the precomputed
// province map paths (assets/ecuador_paths.json), generated once from the
// project's own GeoJSON so the shipped page needs no mapping library.

const API_BASE = (() => {
  if (window.MEDIAHACK_API_BASE) return window.MEDIAHACK_API_BASE;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return "http://localhost:8000";
  // Backend is a systemd service on the Oracle Cloud box, reachable through
  // a Cloudflare Tunnel hostname - not the Vercel deploy's own domain.
  return "https://mediahack-api.apiprueba.online";
})();

async function api(path, opts) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}
function getJSON(path) {
  return api(path);
}
function postJSON(path, body) {
  return api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
const NAME_ALIASES = { "santo domingo": "santo domingo de los tsachilas" };
function provinceKey(name) {
  const stripped = normalize(name);
  return NAME_ALIASES[stripped] || stripped;
}

function fmt(v, decimals = 1) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString("es-EC", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtInt(v) {
  if (v == null) return "—";
  return Math.round(v).toLocaleString("es-EC");
}

// Green-to-red diverging ramp, same stops as the reference observatory -
// green is good (low vulnerability), red is bad. RES (resilience) reads the
// opposite direction, so it gets the ramp reversed rather than the value
// inverted, which keeps the legend gradient itself green-first for RES too.
const RAMP = [
  [26, 120, 74],
  [122, 184, 110],
  [214, 228, 140],
  [250, 214, 124],
  [236, 150, 86],
  [186, 55, 52],
];
const GREEN = [...RAMP].reverse();

function rampColor(t, arr = RAMP) {
  t = Math.max(0, Math.min(1, t)) * (arr.length - 1);
  const i = Math.min(Math.floor(t), arr.length - 2);
  const f = t - i;
  const a = arr[i],
    b = arr[i + 1];
  return `rgb(${a.map((c, j) => Math.round(c + (b[j] - c) * f)).join(",")})`;
}
function scaleFor(key) {
  return key === "RES" ? GREEN : RAMP;
}

// Each indicator is colored against the *observed* range across the 24
// provinces (min-max), not a fixed 0-100 scale - matches the reference and
// reads better since most indicators here don't actually span 0-100.
function indicatorRange(key) {
  const vals = (MAPA?.provincias ?? []).map((p) => p[key]).filter((v) => v != null);
  if (!vals.length) return { lo: 0, hi: 100 };
  return { lo: Math.min(...vals), hi: Math.max(...vals) };
}
function col(key, value) {
  if (value == null) return "#cbd5e1";
  const { lo, hi } = indicatorRange(key);
  return rampColor((value - lo) / (hi - lo || 1), scaleFor(key));
}

// ---------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------
document.querySelectorAll("nav button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((x) => x.classList.remove("on"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("on"));
    b.classList.add("on");
    document.getElementById("v-" + b.dataset.v).classList.add("on");
  });
});

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
let MAPA = null; // /api/segmentadores/mapa response
let PATHS = null; // precomputed SVG paths
let PROVINCIAS = []; // list of province names
let capa = "IVEI";
let mapSel = null;

const tip = document.getElementById("tip");
function tipShow(x, y, html) {
  tip.innerHTML = html;
  tip.style.opacity = 1;
  tipMove(x, y);
}
function tipMove(x, y) {
  const w = tip.offsetWidth,
    h = tip.offsetHeight;
  tip.style.left = Math.min(x + 15, innerWidth - w - 10) + "px";
  tip.style.top = Math.max(8, Math.min(y - h - 12, innerHeight - h - 8)) + "px";
}
function tipHide() {
  tip.style.opacity = 0;
}

// ---------------------------------------------------------------------
// Mapas
// ---------------------------------------------------------------------
function byKey() {
  const idx = {};
  for (const p of MAPA.provincias) idx[provinceKey(p.provincia)] = p;
  return idx;
}

function renderCapas() {
  const box = document.getElementById("capas");
  box.innerHTML = "";
  for (const c of MAPA.capas) {
    const b = document.createElement("button");
    b.className = "chip" + (c.codigo === capa ? " on" : "");
    b.textContent = c.nombre;
    if (c.codigo === capa) b.style.background = c.color;
    b.onclick = () => {
      capa = c.codigo;
      renderCapas();
      paintMap();
    };
    box.appendChild(b);
  }
}

function valueFor(key) {
  const rec = byKey()[key];
  if (!rec) return null;
  return rec[capa];
}

function paintMap() {
  const idx = byKey();
  const active = MAPA.capas.find((c) => c.codigo === capa);
  document.getElementById("capaTit").textContent = active.nombre;
  document.getElementById("capaDesc").textContent =
    capa === "RES" ? "Mayor valor = mayor capacidad de contraste (más resiliente)." : "Mayor valor = mayor vulnerabilidad.";
  document.getElementById("lgA").textContent = capa === "RES" ? "menor resiliencia" : "menor";
  document.getElementById("lgB").textContent = capa === "RES" ? "mayor resiliencia" : "mayor";
  document.getElementById("lgBar").style.background = "linear-gradient(90deg," + scaleFor(capa).map(([r, g, b]) => `rgb(${r},${g},${b})`).join(",") + ")";

  document.querySelectorAll(".pv").forEach((el) => {
    const key = el.dataset.k;
    const v = valueFor(key);
    el.setAttribute("fill", col(capa, v));
    el.classList.toggle("sel", key === mapSel);
  });

  const rows = [...MAPA.provincias].sort((a, b) => (capa === "RES" ? a[capa] - b[capa] : b[capa] - a[capa]));
  document.getElementById("rk").innerHTML = rows
    .map((p, i) => {
      const key = provinceKey(p.provincia);
      const v = p[capa];
      return `<tr data-k="${key}" class="${key === mapSel ? "sel" : ""}">
      <td style="width:26px"><span class="rk" style="background:${col(capa, v)}">${i + 1}</span></td>
      <td>${p.provincia}${p.n_lb === 0 ? ' <span class="tag">sin muestra LB</span>' : ""}</td>
      <td class="num"><b>${fmt(v)}</b></td></tr>`;
    })
    .join("");
  document.querySelectorAll("#rk tr").forEach((r) => {
    r.onclick = () => {
      const p = byKey()[r.dataset.k];
      goToPerfil(p.provincia);
    };
    r.onmouseenter = (e) => {
      const p = byKey()[r.dataset.k];
      tipShow(
        e.clientX,
        e.clientY,
        `<b>${p.provincia}</b><br>${active.nombre}: <b>${fmt(p[capa])}</b><br>
        <span class="r">IVEI</span> ${fmt(p.IVEI)} · <span class="r">Puesto</span> ${p.rank}/24<br>
        ${fmtInt(p.poblacion)} hab.`
      );
    };
    r.onmousemove = (e) => tipMove(e.clientX, e.clientY);
    r.onmouseleave = tipHide;
  });
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
    path.addEventListener("mouseenter", (e) => {
      if (p) {
        tipShow(
          e.clientX,
          e.clientY,
          `<b>${p.provincia}</b><br>${MAPA.capas.find((c) => c.codigo === capa).nombre}: <b>${fmt(p[capa])}</b><br>
          Puesto ${p.rank}/24 · ${p.nivel}`
        );
      }
    });
    path.addEventListener("mousemove", (e) => tipMove(e.clientX, e.clientY));
    path.addEventListener("mouseleave", tipHide);
    path.addEventListener("click", () => {
      if (p) goToPerfil(p.provincia);
    });
    svgEl.appendChild(path);
  }
}

async function initMapas() {
  [MAPA, PATHS] = await Promise.all([getJSON("/api/segmentadores/mapa"), fetch("/assets/ecuador_paths.json").then((r) => r.json())]);
  renderCapas();
  drawMapSVG(document.getElementById("map"), PATHS.mainland);
  drawMapSVG(document.getElementById("map-gal"), PATHS.galapagos);
  paintMap();
  renderScatter();
}

// Exclusión digital x hiperexposición digital: two independent digital-
// vulnerability mechanisms - a province can be high in one, the other,
// both, or neither. Plain hand-drawn SVG, same as the reference chart.
function renderScatter() {
  const sv = document.getElementById("scatter");
  const provincias = MAPA.provincias;
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
    <text x="${X(v)}" y="${H - m.b + 15}" font-size="10" fill="#8b98a9" text-anchor="middle">${v}</text>
    <text x="${m.l - 8}" y="${Y(v) + 3}" font-size="10" fill="#8b98a9" text-anchor="end">${v}</text>`;
  });
  s += `<line x1="${X(mx)}" y1="${m.t}" x2="${X(mx)}" y2="${H - m.b}" stroke="#b9c4d0" stroke-dasharray="4 3"/><line x1="${m.l}" y1="${Y(my)}" x2="${W - m.r}" y2="${Y(my)}" stroke="#b9c4d0" stroke-dasharray="4 3"/>`;
  const quad = [
    ["Hiperexposición dominante", X(mx) - 8, Y(my) - 8, "end"],
    ["Doble mecanismo", X(mx) + 8, Y(my) - 8, "start"],
    ["Riesgo digital bajo", X(mx) - 8, Y(my) + 18, "end"],
    ["Exclusión dominante", X(mx) + 8, Y(my) + 18, "start"],
  ];
  quad.forEach(([t, x, y, a]) => {
    s += `<text x="${x}" y="${y}" font-size="9.5" fill="#a6b2c0" text-anchor="${a}" font-weight="600">${t}</text>`;
  });
  for (const p of provincias) {
    const r = 4 + Math.sqrt(p.poblacion) / 450;
    s += `<circle cx="${X(p.EXCLUSION)}" cy="${Y(p.HIPEREXP)}" r="${r}" fill="${col("IVEI", p.IVEI)}" stroke="#fff" stroke-width="1.2" data-k="${provinceKey(p.provincia)}" style="cursor:pointer"/>`;
  }
  provincias
    .filter((p) => p.poblacion > 380000 || p.EXCLUSION > 68 || p.HIPEREXP > 74)
    .forEach((p) => {
      s += `<text x="${X(p.EXCLUSION)}" y="${Y(p.HIPEREXP) - 9}" font-size="9.5" fill="#3c4a5c" text-anchor="middle" font-weight="600">${p.provincia}</text>`;
    });
  s += `<text x="${(W + m.l) / 2}" y="${H - 6}" font-size="11" fill="#657388" text-anchor="middle" font-weight="600">Índice de exclusión digital →</text>
  <text transform="translate(15,${(H - m.b + m.t) / 2}) rotate(-90)" font-size="11" fill="#657388" text-anchor="middle" font-weight="600">Índice de hiperexposición digital →</text>`;
  sv.innerHTML = s;

  const idx = byKey();
  sv.querySelectorAll("circle[data-k]").forEach((c) => {
    const p = idx[c.dataset.k];
    if (!p) return;
    c.addEventListener("mouseenter", (e) => {
      tipShow(e.clientX, e.clientY, `<b>${p.provincia}</b><br>Exclusión digital <b>${fmt(p.EXCLUSION)}</b><br>Hiperexposición <b>${fmt(p.HIPEREXP)}</b><br><span class="r">${p.perfil}</span>`);
    });
    c.addEventListener("mousemove", (e) => tipMove(e.clientX, e.clientY));
    c.addEventListener("mouseleave", tipHide);
    c.addEventListener("click", () => goToPerfil(p.provincia));
  });
}

// ---------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------
function dimRow(label, value, nacional, color, unit = "") {
  const pct = value == null ? 0 : Math.max(2, Math.min(100, value));
  const nx = nacional == null ? "" : `<div class="nx" style="left:${Math.min(100, nacional)}%"></div>`;
  return `<div class="dimrow"><div class="nm">${label}</div>
    <div class="tr"><div class="fl" style="width:${pct}%;background:${color}"></div>${nx}</div>
    <div class="vl">${fmt(value)}${unit}</div></div>`;
}
function hbars(items, color, maxv) {
  const mx = maxv || Math.max(...items.map((i) => i[1] ?? 0), 1);
  return items
    .map(([lab, v, nv]) => {
      const w = v == null ? 0 : Math.max(1.5, (v / mx) * 100);
      const nx = nv != null ? `<div class="nx" style="left:${(nv / mx) * 100}%"></div>` : "";
      return `<div class="dimrow"><div class="nm">${lab}</div>
      <div class="tr"><div class="fl" style="width:${w}%;background:${color}"></div>${nx}</div>
      <div class="vl">${fmt(v)}</div></div>`;
    })
    .join("");
}
function metric(m, opts = {}) {
  const { absolute = false } = opts;
  if (absolute) {
    return `<div class="metric"><div class="k">${m.label}</div>
    <div class="v">${fmtInt(m.valor)}</div>
    ${m.nacional != null ? `<div class="c"><span>Total país ${fmtInt(m.nacional)}</span></div>` : ""}</div>`;
  }
  let cmp = "",
    cls = "eq";
  if (m.valor != null && m.nacional != null) {
    const d = m.valor - m.nacional;
    cls = m.direction === 1 ? (d > 1 ? "up" : d < -1 ? "dn" : "eq") : m.direction === -1 ? (d > 1 ? "dn" : d < -1 ? "up" : "eq") : "eq";
    cmp = (d >= 0 ? "+" : "−") + fmt(Math.abs(d)) + (m.unit === "%" ? " pp" : "");
  }
  return `<div class="metric"><div class="k">${m.label}</div>
  <div class="v">${fmt(m.valor, m.unit === "índice" ? 2 : 1)}<small>${m.unit ? " " + m.unit : ""}</small></div>
  ${m.nacional != null ? `<div class="c"><span>Nacional ${fmt(m.nacional)}</span><span class="cmp ${cls}">${cmp}</span></div>` : ""}
  ${m.source ? `<div class="srcline">${m.source}</div>` : ""}</div>`;
}

const ETNIA_COLOR = {
  et_mestizo: "#4a6fa5",
  et_indigena: "#c4823a",
  et_montubio: "#5b9e79",
  et_afro: "#8c5aa8",
  et_blanco: "#98a5b5",
  et_otro: "#c9d2dc",
};

function renderPerfil(data) {
  const target = document.getElementById("perfil");
  const plat = Object.entries(data.dieta_informativa.plataformas)
    .filter(([, v]) => v != null && v > 2)
    .sort((a, b) => b[1] - a[1]);

  target.innerHTML = `
  <div class="grid g2" style="margin-bottom:16px">
   <div class="card">
    <h3>Vulnerabilidad electoral integrada</h3>
    <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
     <div class="big" style="color:${col("IVEI", data.ivei.indice)}">${fmt(data.ivei.indice)}</div>
     <div><span class="pill" style="background:${col("IVEI", data.ivei.indice)}">${data.ivei.nivel}</span>
      <div style="font-size:12px;color:var(--mut);margin-top:4px">Puesto ${data.ivei.puesto} de 24 ·
       promedio nacional ${fmt(data.ivei.nacional)}</div></div>
    </div>
    <div style="margin-top:16px">${data.dimensiones.map((d) => dimRow(d.nombre, d.valor, d.nacional, d.color)).join("")}</div>
    <p class="note">La marca vertical indica el promedio nacional de cada dimensión.</p>
   </div>
   <div class="card">
    <h3>Perfil territorial</h3>
    <h2 style="font-size:16.5px;margin-bottom:6px">${data.perfil_territorial.tipo}</h2>
    <p style="font-size:13.5px;color:#39465a;margin:0 0 14px">${data.perfil_territorial.descripcion}</p>
    <div class="grid g2" style="gap:10px">
     ${metric({ label: "Población", valor: data.identificacion.poblacion, nacional: null }, { absolute: true })}
     ${metric({ label: "Densidad (hab/km²)", valor: data.identificacion.densidad, nacional: null }, { absolute: true })}
     ${metric({ label: "Población rural", valor: data.identificacion.pct_rural, unit: "%", direction: 1 })}
     ${metric(dataOr(data.demografia.edades, "pct_65"))}
    </div>
   </div>
  </div>

  <div class="card" style="margin-bottom:16px">
   <h2>Diagnóstico territorial</h2>
   <h3 style="margin-top:2px">¿Por qué esta provincia presenta este nivel?</h3>
   <div style="font-size:13.5px;color:#26313f;max-width:78ch">${data.diagnostico.map((p) => `<p style="margin:0 0 9px">${p}</p>`).join("")}</div>
  </div>

  <div class="grid g2" style="margin-bottom:16px">
   <div class="card"><h3>Estructura por edad</h3>
    ${hbars(
      data.demografia.edades.map((e) => [e.label, e.valor, e.nacional]),
      "#4a6fa5",
      40
    )}
    <p class="note">Barras: provincia. Marca vertical: promedio nacional. Censo 2022.</p></div>
   <div class="card"><h3>Autoadscripción étnica</h3>
    ${stackChart(data.demografia.etnias)}
    <p class="note">Censo de Población y Vivienda 2022 (INEC).</p></div>
  </div>

  <div class="card" style="margin-bottom:16px">
   <h2>Perfil digital</h2><h3 style="margin-top:2px">Acceso, uso y capacidades</h3>
   <div class="grid g4" style="gap:10px;margin-bottom:14px">
    ${data.digital.acceso.map((m) => metric(m)).join("")}
   </div>
   <div class="grid g2">
    <div><h3>Brecha interna</h3>
     ${hbars(
       data.digital.brecha.map((m) => [m.label, m.valor, m.nacional]),
       "#1d6a96",
       100
     )}</div>
    <div><h3>Mecanismo predominante</h3>
     ${hbars(
       [
         ["Exclusión digital", data.digital.mecanismo.exclusion, data.digital.mecanismo.nacional_exclusion],
         ["Hiperexposición digital", data.digital.mecanismo.hiperexposicion, data.digital.mecanismo.nacional_hiperexposicion],
       ],
       "#b3541e",
       100
     )}
     <p class="note">${data.digital.mecanismo.nota}</p></div>
   </div>
  </div>

  <div class="card" style="margin-bottom:16px">
   <h2>Dieta informativa de ${data.provincia}</h2>
   <h3 style="margin-top:2px">Plataformas digitales utilizadas · % de la población conectada</h3>
   ${plat.length ? hbars(plat, "#2f7d52", 100) : "<p class='note'>Sin datos.</p>"}
   <div class="grid g4" style="gap:10px;margin-top:14px">
    ${metric(data.dieta_informativa.usa_redes)}
    ${metric({ ...data.dieta_informativa.n_plataformas, unit: "" })}
    ${metric(data.dieta_informativa.mensajeria)}
    ${metric(data.dieta_informativa.conciencia)}
   </div>
   <div class="warn">${data.dieta_informativa.advertencia}</div>
  </div>

  <div class="grid g2" style="margin-bottom:16px">
   <div class="card"><h2>Resiliencia informativa</h2>
    <h3 style="margin-top:2px">Capacidades de detección y contraste</h3>
    ${hbars([["Escolaridad (años)", data.resiliencia.escolaridad.valor, data.resiliencia.escolaridad.nacional]], "#2f7d52", 20)}
    ${hbars(
      data.resiliencia.componentes.map((m) => [m.label, m.valor, m.nacional]),
      "#2f7d52",
      100
    )}
    <p class="note">${data.resiliencia.nota}</p></div>
   <div class="card"><h2>Presión coyuntural</h2>
    <h3 style="margin-top:2px">Capa dinámica, actualizable ante cada elección</h3>
    ${hbars(
      data.presion_coyuntural.componentes.map((m) => [m.label, m.valor, m.nacional]),
      "#7a4a9e",
      100
    )}
    <p class="note">${data.presion_coyuntural.nota}</p></div>
  </div>

  <div class="card" style="margin-bottom:16px">
   <h2>Condiciones socioeconómicas y educativas</h2>
   <div class="grid g4" style="gap:10px;margin-top:10px">
    ${data.socioeconomico.map((m) => metric(m)).join("")}
   </div>
  </div>

  <div class="card">
   <h2>¿Qué debería considerar quien informa en ${data.provincia}?</h2>
   <h3 style="margin-top:2px">Derivado de los indicadores de la provincia - no es una evaluación de personas ni candidatos</h3>
   ${data.recomendaciones_periodismo
     .map(
       (r) => `<div style="margin-bottom:13px"><b style="font-size:13.5px">${r.titulo}</b>
    <p style="font-size:13.5px;color:#39465a;margin:3px 0 0;max-width:82ch">${r.texto}</p></div>`
     )
     .join("")}
  </div>`;
}

function dataOr(list, key) {
  return list.find((x) => x.key === key) || { label: key, valor: null, nacional: null, unit: "%", direction: 1 };
}

function stackChart(etnias) {
  const items = etnias.filter((e) => (e.valor ?? 0) > 0.5);
  const bars = items.map((e) => `<div style="width:${e.valor}%;background:${ETNIA_COLOR[e.key]}" title="${e.label}: ${fmt(e.valor)}%">${e.valor > 9 ? fmt(e.valor, 0) + "%" : ""}</div>`).join("");
  const legend = etnias
    .filter((e) => (e.valor ?? 0) > 0.4)
    .map((e) => `<span class="sw" style="background:${ETNIA_COLOR[e.key]}"></span>${e.label} ${fmt(e.valor)}%&nbsp;&nbsp;`)
    .join("");
  return `<div class="stack">${bars}</div><div style="font-size:10.5px;color:var(--mut);margin-top:6px;line-height:1.7">${legend}</div>`;
}

async function loadPerfil(provincia) {
  document.getElementById("selProv").value = provincia;
  document.getElementById("perfil").innerHTML = `<p class="note">Cargando…</p>`;
  const data = await getJSON(`/api/segmentadores/perfil/${encodeURIComponent(provincia)}`);
  renderPerfil(data);
}

// Used by clicks from other tabs (map, ranking, scatter, datos) - those
// should actually switch to the Perfil tab. The initial preload on page
// load must NOT do this, or the site opens on Perfil instead of Mapas.
async function goToPerfil(provincia) {
  document.querySelector('nav button[data-v="perfil"]').click();
  await loadPerfil(provincia);
}

function initPerfilSelect() {
  const sel = document.getElementById("selProv");
  sel.innerHTML = PROVINCIAS.map((p) => `<option value="${p}">${p}</option>`).join("");
  sel.onchange = () => loadPerfil(sel.value);
  if (PROVINCIAS.length) loadPerfil(PROVINCIAS[0]);
}

// ---------------------------------------------------------------------
// Comparar
// ---------------------------------------------------------------------
function initComparar() {
  const a = document.getElementById("cmpA"),
    b = document.getElementById("cmpB");
  a.innerHTML = b.innerHTML = PROVINCIAS.map((p) => `<option value="${p}">${p}</option>`).join("");
  a.value = PROVINCIAS[0];
  b.value = PROVINCIAS[1] || PROVINCIAS[0];
  a.onchange = renderCmp;
  b.onchange = renderCmp;
  renderCmp();
}

async function renderCmp() {
  const a = document.getElementById("cmpA").value,
    b = document.getElementById("cmpB").value;
  const target = document.getElementById("comparar");
  target.innerHTML = `<p class="note">Comparando…</p>`;
  const data = await getJSON(`/api/segmentadores/comparar?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);

  const rows = data.indicadores
    .map((row) => {
      let cls = "eq";
      if (row.diferencia != null) {
        cls = row.direction === 1 ? (row.diferencia > 0 ? "up" : row.diferencia < 0 ? "dn" : "eq") : row.direction === -1 ? (row.diferencia > 0 ? "dn" : row.diferencia < 0 ? "up" : "eq") : "eq";
      }
      return `<tr><td>${row.label}<div class="srcline">${row.source} · ${row.unit}</div></td>
      <td class="num"><b>${fmt(row.a)}</b></td><td class="num"><b>${fmt(row.b)}</b></td>
      <td class="num ${cls}">${row.diferencia == null ? "" : (row.diferencia >= 0 ? "+" : "−") + fmt(Math.abs(row.diferencia))}</td>
      <td class="num" style="color:var(--mut)">${fmt(row.nacional)}</td>
      <td style="color:var(--mut);font-size:11.5px">${row.unit}</td></tr>`;
    })
    .join("");

  target.innerHTML = `
  <div class="grid g2" style="margin-bottom:16px">
   ${[data.a, data.b]
     .map(
       (p) => `<div class="card"><h3>${p.provincia}</h3>
    <div style="display:flex;align-items:baseline;gap:10px"><div class="big"
     style="color:${col("IVEI", p.ivei)};font-size:34px">${fmt(p.ivei)}</div>
     <span class="pill" style="background:${col("IVEI", p.ivei)}">${p.nivel}</span></div>
    <div style="margin-top:12px">${p.dimensiones.map((d) => dimRow(d.nombre, d.valor, null, d.color)).join("")}</div>
    <p class="note"><b>${p.perfil}.</b> ${p.perfil_desc}</p></div>`
     )
     .join("")}
  </div>
  <div class="card"><h3>Indicador por indicador</h3><div style="overflow:auto;max-height:600px">
  <table><thead><tr><th>Indicador</th><th class="num">${data.a.provincia}</th>
  <th class="num">${data.b.provincia}</th><th class="num">Dif.</th><th class="num">Nacional</th>
  <th>Unidad</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

// ---------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------
let TABLA_DATA = null;
let sortKey = "rank",
  sortDir = 1;

async function initDatos() {
  TABLA_DATA = await getJSON("/api/segmentadores/tabla");
  document.getElementById("buscarDatos").oninput = renderTabla;
  renderTabla();
}

function renderTabla() {
  const search = normalize(document.getElementById("buscarDatos").value);
  const filas = TABLA_DATA.filas
    .filter((f) => normalize(f.provincia).includes(search))
    .slice()
    .sort((a, b) => {
      const va = a[sortKey],
        vb = b[sortKey];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string") return sortDir * va.localeCompare(vb);
      return sortDir * (va - vb);
    });

  const headCols = TABLA_DATA.columnas.map((c) => `<th class="num" data-k="${c.key}" title="${c.label} (${c.unit})">${c.key}</th>`).join("");
  const bodyRows = filas
    .map(
      (f) => `<tr data-p="${f.provincia}"><td>${f.rank != null ? Math.round(f.rank) : "—"}</td><td>${f.provincia}</td><td>${f.nivel}</td>
    ${TABLA_DATA.columnas.map((c) => `<td class="num">${f[c.key] != null ? fmt(f[c.key]) : "—"}</td>`).join("")}</tr>`
    )
    .join("");
  const footCols = TABLA_DATA.columnas.map((c) => `<td class="num">${TABLA_DATA.nacional[c.key] != null ? fmt(TABLA_DATA.nacional[c.key]) : "—"}</td>`).join("");

  document.getElementById("tabla").innerHTML = `
  <thead><tr><th data-k="rank">#</th><th data-k="provincia">Provincia</th><th data-k="nivel">Nivel</th>${headCols}</tr></thead>
  <tbody>${bodyRows}</tbody>
  <tfoot><tr style="font-weight:700;background:#f7f9fb"><td colspan="3">Nacional</td>${footCols}</tr></tfoot>`;

  document.querySelectorAll("#tabla th").forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.k;
      sortDir = sortKey === k ? -sortDir : 1;
      sortKey = k;
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
async function initMeto() {
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

// ---------------------------------------------------------------------
// Asistente (Escucha / Origen / Contraste) + Temas más hablados
// ---------------------------------------------------------------------
const MODES = [
  { key: "escucha", label: "Escucha", placeholder: "¿De qué habla el alcalde de Quito? / ¿Por qué la gente está brava por…?" },
  { key: "origen", label: "Origen", placeholder: "Pega la afirmación o el titular a rastrear…" },
  { key: "contraste", label: "Contraste", placeholder: "Pega la propuesta de un candidato a contrastar…" },
];
let asisMode = "escucha";

function renderAsisModos() {
  const box = document.getElementById("asisModos");
  box.innerHTML = MODES.map((m) => `<button class="chip${m.key === asisMode ? " on" : ""}" data-m="${m.key}" style="${m.key === asisMode ? "background:var(--acc);border-color:var(--acc);color:#fff" : ""}">${m.label}</button>`).join("");
  document.getElementById("asisInput").placeholder = MODES.find((m) => m.key === asisMode).placeholder;
  box.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      asisMode = b.dataset.m;
      renderAsisModos();
    };
  });
}

function sourceLine(a) {
  return `<a class="asis-source" href="${a.link}" target="_blank" rel="noopener noreferrer">${a.title}<div class="src-meta">${a.source || ""}</div></a>`;
}

async function runAsistente() {
  const q = document.getElementById("asisInput").value.trim();
  const result = document.getElementById("asisResult");
  if (!q) return;
  const province = document.getElementById("asisProv").value || null;
  result.innerHTML = `<div class="asis-loading">Buscando en fuentes ecuatorianas…</div>`;
  document.getElementById("asisRun").disabled = true;
  try {
    if (asisMode === "escucha") {
      const res = await postJSON("/api/ask", { question: q, province });
      const groups = Object.entries(res.by_source || {}).filter(([, v]) => v.length);
      result.innerHTML = `
      <div class="asis-answer">${res.answer}</div>
      ${groups
        .map(
          ([name, items]) => `<h4 style="font-size:12px;margin:14px 0 6px;color:var(--acc)">${name}</h4>
        <div class="asis-sources">${items.map(sourceLine).join("")}</div>`
        )
        .join("")}`;
    } else if (asisMode === "origen") {
      const res = await getJSON(`/api/origin?claim=${encodeURIComponent(q)}`);
      result.innerHTML = `
      <p class="note">${res.advertencia}</p>
      <div class="asis-chain">
      ${res.cadena
        .map(
          (n) => `<div class="asis-chain-item">
        <div class="t">${n.kind} · +${n.horas_desde_primera}h</div>
        <a class="asis-source" href="${n.link}" target="_blank" rel="noopener noreferrer">${n.title}<div class="src-meta">${n.source}</div></a>
      </div>`
        )
        .join("")}
      </div>
      ${res.sin_fecha.length ? `<h4 style="font-size:12px;margin:14px 0 6px;color:var(--acc)">Sin fecha utilizable (${res.sin_fecha.length})</h4><div class="asis-sources">${res.sin_fecha.map(sourceLine).join("")}</div>` : ""}
      <p class="note">Total encontrado: ${res.total_encontrado}</p>`;
    } else {
      const res = await postJSON("/api/contrast", { proposal: q, province });
      result.innerHTML = `
      <p class="asis-answer">${res.hallazgo}</p>
      <p class="note">${res.con_referencia_a_costo} de ${res.total} mencionan costo/financiamiento · ${res.con_referencia_legal} mencionan marco legal.</p>
      <h4 style="font-size:12px;margin:14px 0 6px;color:var(--acc)">Preguntas sugeridas</h4>
      <ul style="margin:0;padding-left:18px">${res.preguntas_sugeridas.map((p) => `<li style="font-size:12.5px;color:var(--ink);margin-bottom:4px">${p}</li>`).join("")}</ul>
      <h4 style="font-size:12px;margin:14px 0 6px;color:var(--acc)">Evidencia (${res.evidencia.length})</h4>
      <div class="asis-sources">${res.evidencia
        .map(
          (a) => `<a class="asis-source" href="${a.link}" target="_blank" rel="noopener noreferrer">${a.title}
        <div class="src-meta">${a.source || ""}${a.menciona_costo ? " · menciona costo" : ""}${a.menciona_marco_legal ? " · menciona marco legal" : ""}</div></a>`
        )
        .join("")}</div>
      <div class="warn">${res.advertencia}</div>`;
    }
  } catch (e) {
    result.innerHTML = `<div class="asis-loading">No se pudo completar la búsqueda. Intenta de nuevo.</div>`;
  } finally {
    document.getElementById("asisRun").disabled = false;
  }
}

let tendOpenTerm = null;
async function runTendencias(province) {
  const box = document.getElementById("tendResult");
  if (!province) {
    box.innerHTML = "";
    return;
  }
  box.innerHTML = `<div class="asis-loading">Leyendo X y medios sobre ${province}. Puede tardar unos segundos…</div>`;
  try {
    const res = await getJSON(`/api/trends?province=${encodeURIComponent(province)}`);
    if (res.note) {
      box.innerHTML = `<p class="note">${res.note}</p>`;
      return;
    }
    const all = [...res.actores, ...res.temas];
    box.innerHTML = `
    <p class="note">${res.total_analizados} publicaciones analizadas · X y medios</p>
    <div class="trend-chip-row">${all
      .map((t, i) => `<button class="trend-chip${res.actores.includes(t) ? " actor" : ""}" data-i="${i}">${t.term}<span class="count">${t.count}</span></button>`)
      .join("")}</div>
    <div id="tendSamples"></div>
    <p class="caveat">Conteo en muestra pequeña — pista para reportear, no dato citable.</p>`;
    box.querySelectorAll(".trend-chip").forEach((chip) => {
      chip.onclick = () => {
        const t = all[Number(chip.dataset.i)];
        tendOpenTerm = tendOpenTerm === t.term ? null : t.term;
        document.getElementById("tendSamples").innerHTML =
          tendOpenTerm == null
            ? ""
            : `<div class="trend-samples">${(all.find((x) => x.term === tendOpenTerm)?.samples || []).map((s) => `<a href="${s.link}" target="_blank" rel="noopener noreferrer">${s.title}</a>`).join("")}</div>`;
      };
    });
  } catch (e) {
    box.innerHTML = `<div class="asis-loading">No se pudo leer la conversación.</div>`;
  }
}

function initAsistente() {
  renderAsisModos();
  document.getElementById("asisRun").onclick = runAsistente;
  document.getElementById("asisProv").innerHTML += PROVINCIAS.map((p) => `<option value="${p}">${p}</option>`).join("");
  document.getElementById("tendProv").innerHTML += PROVINCIAS.map((p) => `<option value="${p}">${p}</option>`).join("");
  document.getElementById("tendProv").onchange = (e) => runTendencias(e.target.value);
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
(async function init() {
  try {
    const provRes = await getJSON("/api/segmentadores/provincias");
    PROVINCIAS = provRes.provincias;
    await initMapas();
    initPerfilSelect();
    initComparar();
    initDatos();
    initMeto();
    initAsistente();
  } catch (e) {
    document.querySelector(".wrap").insertAdjacentHTML("afterbegin", `<div class="warn">No se pudo conectar con el backend (${API_BASE || "sin configurar"}). ${e.message}</div>`);
  }
})();
