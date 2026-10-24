// Module: kit. Part of the app.js split into native ES modules (no build step).

import { getJSON } from "../api.js";
import { flag } from "../tenant.js";
import { skLines } from "../estados.js";
import { entradaKit } from "./efectos.js";
import { esc, fmt, fmtInt, ICON, provinceFlags, scoreRange } from "../ui.js";
import { E } from "./estado.js";
import { $, provinceKey } from "./util.js";
import { AFONDO_KEY, DRIVER_MIN, ETNIA_COLOR, FACTORES, FUENTE_OVADE, NO_APOYA, SI_APOYA, TEND_CACHE, TEND_TTL, enc, esLimite, perfilColor, perfilPlano, solBadge } from "./datos.js";
import { col, inkFor } from "./color.js";
import { copiarBtn, errorBox, navigate, viewEnabled } from "./nav.js";
import { byKey, factorNombre, puestoFactor } from "./mapa.js";
import { downloadFicha } from "./fichadoc.js";
import { paintTendMap, runTendencias } from "./escucha.js";
import { gl } from "./metodologia.js";
import { escalaHTML, recordarReciente, renderProvLista, skeletonKit } from "./inicio.js";
import { openFicha } from "./descargas.js";

// ---------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------
export function dimRow(label, value, nacional, color, unit = "") {
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
  ${m.source ? `<div class="srcline">${m.source}${solBadge(m.source)}</div>` : ""}</div>`;
}

// What the index can and cannot support in a story. Static on purpose: this
// is editorial guidance about the method, not a result, so it must read the
// same for every province and every outlet.
export function reliability(n) {
  if (n == null) return null;
  if (n === 0) return { cls: "lo", label: "Sin muestra propia", detail: "Su opinión es el promedio del país." };
  if (n < 50) return { cls: "lo", label: `Muestra pequeña (n = ${n})`, detail: "Cifras de opinión orientativas." };
  if (n < 100) return { cls: "mid", label: `Muestra media (n = ${n})`, detail: "Cifras de opinión con margen amplio." };
  return { cls: "hi", label: `Muestra suficiente (n = ${n})`, detail: "" };
}

// Editorial warning for provinces whose opinion data is imputed or comes from a
// tiny sample. Shown on screen and appended to everything the reporter copies.
function precaucion(nLb, provincia) {
  const conf = reliability(nLb);
  if (!conf || conf.cls !== "lo") return null;
  return nLb === 0
    ? `${provincia} no tiene muestra propia en el Latinobarómetro: sus cifras de opinión son el promedio del país y no deben citarse como datos locales.`
    : `La muestra de ${provincia} en el Latinobarómetro es pequeña (n = ${nLb}): sus cifras de opinión son orientativas, no exactas.`;
}

function citaTexto({ provincia, indice, nivel, puesto, nacional, nLb }) {
  const aviso = precaucion(nLb, provincia);
  return (
    `${provincia} obtiene ${fmt(indice)} sobre 100 en el Índice de Vulnerabilidad Electoral Integrada (IVEI), ` +
    `de vulnerabilidad ${(nivel || "").toLowerCase()}: puesto ${puesto} de 24 provincias (1 = la más vulnerable), con un promedio nacional de ${fmt(nacional)}. ` +
    `${FUENTE_OVADE.slice(0, -1)}, con datos del Censo 2022 y la ENEMDU 2024 (INEC) y el Latinobarómetro 2024. ` +
    `El índice describe condiciones del territorio, no el comportamiento de sus habitantes.` +
    (aviso ? ` Precaución editorial: ${aviso}` : "")
  );
}

// Short sentence for the reporter in a hurry; same source line, same warning.
function fraseCorta({ provincia, indice, puesto, nLb }) {
  const aviso = precaucion(nLb, provincia);
  return `${provincia}: puesto ${puesto} de 24 en vulnerabilidad electoral (IVEI ${fmt(indice)} de 100). ${FUENTE_OVADE}` + (aviso ? ` Precaución editorial: ${aviso}` : "");
}

const buildCita = (d) => citaTexto({ provincia: d.provincia, indice: d.ivei.indice, nivel: d.ivei.nivel, puesto: d.ivei.puesto, nacional: d.ivei.nacional, nLb: d.n_lb });

export const citaDeRegistro = (p) => citaTexto({ provincia: p.provincia, indice: p.IVEI, nivel: p.nivel, puesto: p.rank, nacional: E.MAPA.nacional.IVEI, nLb: p.n_lb });

function drivers(rec) {
  const nac = E.MAPA.nacional;
  const titulo = (k) => (k === "RES" ? "Poca capacidad de contrastar" : factorNombre(k));
  return ["EST", "EXP", "PRE", "RES"]
    .filter((k) => rec[k] != null && nac[k] != null)
    .map((k) => ({
      k,
      delta: (k === "RES" ? -1 : 1) * (rec[k] - nac[k]),
      html: `<b>${titulo(k)}</b> ${fmt(rec[k])} <span class="pais">país ${fmt(nac[k])}</span>`,
      plain: `${titulo(k)}: ${fmt(rec[k])} frente a ${fmt(nac[k])} del promedio del país.`,
    }))
    .filter((x) => x.delta >= DRIVER_MIN)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2);
}

export const driversHTML = (rec) => {
  const d = drivers(rec);
  return d.length
    ? `<ul class="drivers">${d.map((x) => `<li>${x.html}</li>`).join("")}</ul>`
    : `<p class="note" style="margin:0">Ningún factor se aleja del promedio del país.</p>`;
};

function reporterGuide(d) {
  const conf = reliability(d.n_lb);
  const si = [
    `${d.provincia} ocupa el puesto ${d.ivei.puesto} de 24 en el IVEI 2024.`,
    `Sus condiciones (carencias de base, dependencia de redes, capacidad de contrastar y clima electoral) la ubican en el nivel de vulnerabilidad ${(d.ivei.nivel || "").toLowerCase()}.`,
    `Comparar con el promedio nacional (${fmt(d.ivei.nacional)}) o con otra provincia, nombrando la fuente de cada indicador.`,
  ];
  const no = [
    "Que sus habitantes «creen más desinformación» o «son más manipulables»: el índice mide condiciones del territorio, no creencias.",
    "Que ahí «circula más» desinformación: la desinformación observada no entra a ningún índice.",
    "Afirmar algo sobre candidatos, partidos o medios concretos: el índice no los evalúa.",
  ];
  if (conf && conf.cls !== "hi") no.splice(2, 0, "Presentar como exactas las cifras de opinión de esta provincia: " + conf.detail.charAt(0).toLowerCase() + conf.detail.slice(1));
  return { si, no };
}

// Collapsible detail block: the essentials stay short, the evidence is one click away.
const detalle = (id, titulo, sub, cuerpo) =>
  `<section class="card sec-open" id="sec-${id}"><div class="sec-h"><h2>${titulo}</h2><span class="sub-s">${sub}</span></div>${cuerpo}</section>`;

function factorRow(d, provincia) {
  const f = FACTORES[d.codigo] ?? {};
  const pst = puestoFactor(d.codigo, provincia);
  const pct = d.valor == null ? 0 : Math.max(2, Math.min(100, d.valor));
  const nx = d.nacional == null ? "" : `<div class="nx" style="left:${Math.min(100, d.nacional)}%"></div>`;
  return `<div class="frow"><div class="fq"><b>${esc(d.nombre)}</b><span>${esc(f.que || "")}</span></div>
   <div class="tr"><div class="fl" style="width:${pct}%;background:${d.color}"></div>${nx}</div>
   <div class="fv"><b>${fmt(d.valor)}</b><small>${pst ? `puesto ${pst.n} de ${pst.de}` : ""}</small></div></div>`;
}

function decisionBlock({ extraSi = [], extraNo = [] } = {}) {
  const si = [...extraSi.map((t) => `<li>${esc(t)}</li>`), ...SI_APOYA.map(([t, d]) => `<li><b>${esc(t)}:</b> ${esc(d)}</li>`)];
  const no = [...extraNo.map((t) => `<li>${esc(t)}</li>`), ...NO_APOYA.map((t) => `<li>${esc(t)}</li>`)];
  return `<div class="decide">
   <div class="d-si"><h3>${ICON.check}Qué puedes afirmar</h3><ul>${si.join("")}</ul></div>
   <div class="d-no"><h3>${ICON.cross}Qué NO debes afirmar</h3><ul>${no.join("")}</ul></div>
  </div>`;
}

// Same thresholds the backend uses for its own recommendations.
function canalSugerido(rec) {
  const ex = rec.EXCLUSION ?? 0;
  const hi = rec.HIPEREXP ?? 0;
  if (ex > 60 && hi > 60) return "Combina canales: hay gente sin conexión y saturación de redes.";
  if (ex > 60) return "Radio local y aliados: pesa la gente sin conexión.";
  if (hi > 60) return "Redes y fuentes con credibilidad: pesa la saturación.";
  return "Ningún mecanismo domina: combina radio y redes.";
}

function metaOf(data, key) {
  const pools = [data.demografia.edades, data.demografia.etnias, data.digital.acceso, data.digital.brecha, data.resiliencia.componentes, data.presion_coyuntural.componentes, data.socioeconomico, [data.resiliencia.escolaridad, data.dieta_informativa.usa_redes, data.dieta_informativa.n_plataformas, data.dieta_informativa.mensajeria, data.dieta_informativa.conciencia]];
  for (const pool of pools) {
    const hit = pool.find((m) => m && m.key === key);
    if (hit) return hit;
  }
  return null;
}

// A handful of numbers a journalist can quote, each already a sentence with its source.
function datosClave(data) {
  const prov = data.provincia;
  const out = [];
  const add = (m, frase) => {
    if (m && m.valor != null) out.push({ ...frase(m), source: m.source });
  };
  add(metaOf(data, "uso_internet"), (m) => ({ texto: `En ${prov}, ${fmt(m.valor)} % de las personas de 5 años y más usó internet (promedio del país: ${fmt(m.nacional)} %).`, corto: `<b>Usó internet</b> ${fmt(m.valor)} % <span class="pais">país ${fmt(m.nacional)} %</span>` }));
  add(metaOf(data, "analf_digital"), (m) => ({ texto: `El analfabetismo digital en ${prov} es de ${fmt(m.valor)} % (país: ${fmt(m.nacional)} %).`, corto: `<b>Analfabetismo digital</b> ${fmt(m.valor)} % <span class="pais">país ${fmt(m.nacional)} %</span>` }));
  add(metaOf(data, "pobreza_ingresos"), (m) => ({ texto: `La pobreza por ingresos en ${prov} es de ${fmt(m.valor)} % (país: ${fmt(m.nacional)} %).`, corto: `<b>Pobreza por ingresos</b> ${fmt(m.valor)} % <span class="pais">país ${fmt(m.nacional)} %</span>` }));
  if (data.identificacion.pct_rural != null) {
    out.push({ texto: `El ${fmt(data.identificacion.pct_rural)} % de la población de ${prov} vive en el área rural (país: ${fmt(E.MAPA.nacional.pct_rural)} %).`, corto: `<b>Vive en área rural</b> ${fmt(data.identificacion.pct_rural)} % <span class="pais">país ${fmt(E.MAPA.nacional.pct_rural)} %</span>`, source: "Censo 2022 (INEC)" });
  }
  return out;
}

// One sentence is enough here; the rest of the profile description is in the full data.
const primeraFrase = (t) => (String(t || "").match(/^.*?[.!?](?=\s|$)/) || [t || ""])[0];

export function renderPerfil(data) {
  E.PERFIL_DATA = data;
  E.SOL_NLB = data.n_lb;
  const target = $("perfil");
  const rec = byKey()[provinceKey(data.provincia)] ?? {};
  const isImputed = data.n_lb === 0;
  const isBorderlineCase = esLimite(data.provincia);
  const conf = reliability(data.n_lb);
  const nivelColor = col("IVEI", data.ivei.indice);
  const cita = buildCita(data);
  const plat = Object.entries(data.dieta_informativa.plataformas)
    .filter(([, v]) => v != null && v > 2)
    .sort((a, b) => b[1] - a[1]);

  // quotable lines: short on screen, a full sentence with its source when copied
  const angulos = [
    ...drivers(rec).map((d) => ({ html: d.html, copia: `${d.plain} ${FUENTE_OVADE}` })),
    ...datosClave(data).map((c) => ({ html: `${c.corto}${solBadge(c.source)}`, copia: `${c.texto} Fuente: ${c.source}.` })),
  ].slice(0, 5);
  const frase = fraseCorta({ provincia: data.provincia, indice: data.ivei.indice, puesto: data.ivei.puesto, nLb: data.n_lb });
  const aviso = precaucion(data.n_lb, data.provincia);
  const pesan = drivers(rec).map((d) => (d.k === "RES" ? "poca capacidad de contrastar" : factorNombre(d.k).toLowerCase()));
  const titular = `${data.provincia}: vulnerabilidad ${(data.ivei.nivel || "").toLowerCase()} (${fmt(data.ivei.indice)}/100), puesto ${data.ivei.puesto} de 24${pesan.length ? `; pesan más ${pesan.join(" y ")}` : ""}.`;
  const extraNo = [];
  if (isImputed) extraNo.push(`Presentar como propias las cifras de opinión de ${data.provincia}: son el promedio del país.`);
  else if (conf && conf.cls === "lo") extraNo.push(`Dar como exactas las cifras de opinión de ${data.provincia}: ${conf.detail.charAt(0).toLowerCase()}${conf.detail.slice(1)}`);
  if (isBorderlineCase) extraNo.push(`Tratar el tipo de provincia de ${data.provincia} como una etiqueta fija: es un caso limítrofe.`);

  const diagnostico = `<div style="font-size:13.5px;color:#26313f;max-width:78ch">${data.diagnostico.map((p) => `<p style="margin:0 0 9px">${esc(p)}</p>`).join("")}</div>`;

  const digital = `
   <div class="grid g4" style="gap:10px;margin-bottom:14px">${data.digital.acceso.map((m) => metric(m)).join("")}</div>
   <div class="grid g2">
    <div><h3>Brecha interna</h3>${hbars(data.digital.brecha.map((m) => [m.label, m.valor, m.nacional]), "#1d6a96", 100)}</div>
    <div><h3>Dos formas de llegar a la desinformación</h3>
     ${hbars([["Sin conexión", data.digital.mecanismo.exclusion, data.digital.mecanismo.nacional_exclusion], ["Saturación de redes", data.digital.mecanismo.hiperexposicion, data.digital.mecanismo.nacional_hiperexposicion]], "#b3541e", 100)}
     <p class="note">${esc(data.digital.mecanismo.nota)}</p></div>
   </div>`;

  const dieta = `
   <h3 style="margin-top:2px">Plataformas digitales utilizadas · % de la población conectada</h3>
   ${plat.length ? hbars(plat, "#2f7d52", 100) : "<p class='note'>Sin datos.</p>"}
   <div class="grid g4" style="gap:10px;margin-top:14px">
    ${metric(data.dieta_informativa.usa_redes)}${metric({ ...data.dieta_informativa.n_plataformas, unit: "" })}${metric(data.dieta_informativa.mensajeria)}${metric(data.dieta_informativa.conciencia)}
   </div>
   <div class="warn">${esc(data.dieta_informativa.advertencia)}</div>`;

  const resiliencia = `
  <div class="grid g2">
   <div><h3>Herramientas para contrastar</h3>
    ${hbars([["Escolaridad (años)", data.resiliencia.escolaridad.valor, data.resiliencia.escolaridad.nacional]], "#2f7d52", 20)}
    ${hbars(data.resiliencia.componentes.map((m) => [m.label, m.valor, m.nacional]), "#2f7d52", 100)}
    <p class="note">${esc(data.resiliencia.nota)}</p></div>
   <div><h3>Clima electoral · se actualiza en cada elección</h3>
    ${hbars(data.presion_coyuntural.componentes.map((m) => [m.label, m.valor, m.nacional]), "#7a4a9e", 100)}
    <p class="note">${esc(data.presion_coyuntural.nota)}</p></div>
  </div>`;

  const contexto = `
  <div class="grid g2" style="margin-bottom:16px">
   <div><h3>Estructura por edad</h3>${hbars(data.demografia.edades.map((e) => [e.label, e.valor, e.nacional]), "#4a6fa5", 40)}
    <p class="note">Barras: provincia. Marca vertical: promedio nacional. Censo 2022.</p></div>
   <div><h3>Autoadscripción étnica</h3>${stackChart(data.demografia.etnias)}<p class="note">Censo de Población y Vivienda 2022 (INEC).</p></div>
  </div>
  <h3>Condiciones socioeconómicas y educativas</h3>
  <div class="grid g4" style="gap:10px">${data.socioeconomico.map((m) => metric(m)).join("")}</div>`;

  const showGuide = flag("guia_reportero");
  const cuidado = [];
  if (conf) cuidado.push(`<span class="conf ${conf.cls}">${esc(conf.label)}</span>`);
  if (isImputed) cuidado.push("<span>Su opinión es el promedio del país.</span>");
  if (isBorderlineCase) cuidado.push("<span>Su perfil puede cambiar con ajustes menores.</span>");
  const conEscucha = viewEnabled("asistente");
  // Quick-note mode: only what a reporter on deadline needs is open; the
  // evidence is folded under "Investigar a fondo" and remembered per browser.
  const chips = [
    ["esencial", "Resumen"],
    ...(showGuide ? [["angulos", "Datos para tu nota"]] : []),
    ...(conEscucha ? [["escucha", "Qué se dice"]] : []),
    ...(showGuide ? [["decidir", "Qué afirmar"]] : []),
    ["afondo", "Investigar a fondo"],
  ];
  const segunda = [
    conEscucha ? `<section class="card" id="sec-escucha" aria-live="polite"></section>` : "",
    showGuide ? `<section class="card" id="sec-decidir"><h2>Qué puedes y qué no afirmar</h2>${decisionBlock({ extraSi: [`Para ${data.provincia}: ${canalSugerido(rec)}`], extraNo })}</section>` : "",
  ].filter(Boolean);

  target.innerHTML = `
  <div class="kit-head">
   <h2 class="prov-title">${esc(data.provincia)}</h2>
   ${provinceFlags({ isImputed, isBorderlineCase, compact: true })}
  </div>
  <div class="idx noprint" role="navigation" aria-label="Ir a una sección">${chips.map(([id, l]) => `<button type="button" data-sec="${id}">${l}</button>`).join("")}</div>

  <div class="kit-grid">
   <section class="card kit-main" id="sec-esencial">
    <h3 class="ess-titular">${esc(titular)}</h3>
    ${aviso ? `<div class="precaucion" role="note"><span class="pc-h">${ICON.warn}Precaución editorial</span><p>${esc(aviso)} ${data.n_lb === 0 ? gl("imputado", "¿Qué es un valor imputado?") : ""}</p></div>` : ""}
    ${
      flag("cita_lista")
        ? `<div class="copiar">
       <div class="cita-act"><button class="btn" id="btnCita" type="button">Copiar párrafo para tu nota</button><button class="btn gh" id="btnFrase" type="button">Copiar frase corta</button></div>
       <p class="frase" id="fraseTexto">${esc(frase)}</p>
       <details class="ver"><summary>Ver el párrafo completo que se copia</summary><blockquote id="citaTexto">${esc(cita)}</blockquote></details>
      </div>`
        : ""
    }
    <div class="km-top">
     <div class="km-num">
      <span class="big">${fmt(data.ivei.indice)}</span>
      <span class="pill" style="background:${nivelColor};color:${inkFor(nivelColor)}">${esc(data.ivei.nivel)}</span>
      ${scoreRange({ confidenceRange: data.ivei.rango ?? null })}
     </div>
     <div class="km-txt">
      <p class="ess-lead"><b>Puesto ${data.ivei.puesto} de 24</b> <span class="pais">1 = la más vulnerable · país ${fmt(data.ivei.nacional)}</span></p>
      <p class="ess-tipo"><span class="pdot" style="background:${perfilColor(data.perfil_territorial.tipo)}"></span><b>${esc(perfilPlano(data.perfil_territorial.tipo))}</b></p>
      <p class="note" style="margin:0">${esc(primeraFrase(data.perfil_territorial.descripcion))}</p>
     </div>
    </div>
    ${escalaHTML(data.ivei.indice, data.ivei.nacional, data.provincia)}
    <p class="km-conf">${cuidado.join(" ")} <button type="button" class="linkbtn noprint" id="btnSolidez">¿Qué tan firme?</button></p>
    <p class="gl-row noprint">¿Qué significa? ${gl("ivei", "IVEI")} ${gl("imputado", "valor imputado")} ${gl("factor", "factor")}</p>
   </section>

   ${
     showGuide
       ? `<section class="card" id="sec-angulos">
    <div class="sec-h"><h2>Datos para tu nota</h2><button type="button" class="copybtn noprint" id="btnTodo">Copiar todo</button></div>
    <ul class="angulos">${angulos.map((a) => `<li><div>${a.html}</div><button type="button" class="copybtn noprint" data-copy="${esc(a.copia)}">Copiar</button></li>`).join("")}</ul>
   </section>`
       : ""
   }
  </div>

  ${segunda.length ? `<div class="grid ${segunda.length > 1 ? "g2" : ""}" style="margin-top:16px">${segunda.join("")}</div>` : ""}

  <div class="kit-actions noprint">
   ${flag("ficha_descargable") ? `<button class="btn gh" type="button" id="btnFicha">Descargar ficha</button>` : ""}
   <label class="sr" for="essComparar">Comparar con otra provincia</label>
   <select id="essComparar" ${flag("vista_comparar") ? "" : "hidden"}><option value="">Comparar con…</option>${E.PROVINCIAS.filter((p) => p !== data.provincia).map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}</select>
   <button class="btn gh" type="button" id="btnVerMapa">Ver en el mapa</button>
   <button class="btn gh" type="button" id="btnEnlace">Copiar enlace</button>
   ${flag("solicitar_informacion") ? `<button class="btn gh" type="button" data-solicitar>Pedir más información</button>` : ""}
  </div>

  <details class="a-fondo" id="sec-afondo"${aFondoAbierto() ? " open" : ""}>
  <summary><span class="af-t">Investigar a fondo</span><span class="af-s">Qué explica este nivel, ideas para cubrirla, perfil digital, dieta informativa y contexto social de ${esc(data.provincia)}</span></summary>
  ${showGuide ? `<section class="card" id="sec-ideas" style="margin-bottom:16px"><h2>Ideas para cubrirla</h2>${data.recomendaciones_periodismo.map((r) => `<div class="rec"><b>${esc(r.titulo)}</b><p>${esc(r.texto)}</p></div>`).join("")}</section>` : ""}
  <section class="card sec-open" id="sec-factores" style="margin-bottom:16px">
   <div class="sec-h"><h2>Qué explica este nivel</h2><span class="sub-s">Cuatro factores, de 0 a 100. La marca vertical es el promedio del país.</span></div>
   <div class="frows">${data.dimensiones.map((d) => factorRow(d, data.provincia)).join("")}</div>
  </section>
  ${detalle("diagnostico", "Por qué tiene este nivel", "Lo que dicen los datos", diagnostico)}
  ${detalle("digital", "Perfil digital", "Acceso, uso y capacidades", digital)}
  ${detalle("dieta", "Dieta informativa", "Qué plataformas usa la gente conectada", dieta)}
  ${detalle("resiliencia", "Capacidad de contrastar y clima electoral", "Educación, fuentes y ambiente", resiliencia)}
  ${detalle("contexto", "Contexto social", "Edad, etnia, pobreza y educación", contexto)}
  </details>`;

  target.querySelectorAll(".idx [data-sec]").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.sec === "afondo") $("sec-afondo").open = true;
      $("sec-" + b.dataset.sec)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    };
  });
  $("sec-afondo").addEventListener("toggle", (e) => recordarAFondo(e.target.open));
  if (conEscucha) renderEscuchaFicha(data.provincia);
  target.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copiarBtn(b, b.dataset.copy, "datos_nota")));
  if ($("btnFrase")) $("btnFrase").onclick = (e) => copiarBtn(e.currentTarget, frase, "frase_ficha");
  if ($("btnCita")) $("btnCita").onclick = (e) => copiarBtn(e.currentTarget, cita, "cita_ficha");
  if ($("btnTodo")) $("btnTodo").onclick = (e) => copiarBtn(e.currentTarget, angulos.map((a) => `• ${a.copia}`).join("\n"), "datos_nota");
  if ($("btnEnlace")) $("btnEnlace").onclick = (e) => copiarBtn(e.currentTarget, location.href);
  $("btnSolidez").onclick = () => openFicha("IVEI", data.provincia);
  if ($("btnFicha")) $("btnFicha").onclick = () => downloadFicha(data.provincia);
  if ($("essComparar"))
    $("essComparar").onchange = (e) => {
      if (e.target.value) navigate(`comparar/${enc(data.provincia)}/${enc(e.target.value)}`);
    };
  $("btnVerMapa").onclick = () => {
    E.mapSel = provinceKey(data.provincia);
    navigate(`mapas/${E.capa}`);
    requestAnimationFrame(() => $("peek")?.scrollIntoView({ block: "nearest" }));
  };
}

function aFondoAbierto() {
  try {
    return localStorage.getItem(AFONDO_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function recordarAFondo(abierto) {
  try {
    localStorage.setItem(AFONDO_KEY, abierto ? "1" : "0");
  } catch (_) {}
}

export function getTendencias(province) {
  const hit = TEND_CACHE.get(province);
  if (hit && Date.now() - hit.t < TEND_TTL) return hit.p;
  const p = getJSON(`/api/trends?province=${encodeURIComponent(province)}`);
  TEND_CACHE.set(province, { t: Date.now(), p });
  p.catch(() => TEND_CACHE.delete(province));
  return p;
}

export const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

const fechaCorta = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });
};

function irAEscucha(provincia) {
  E.tendSel = provinceKey(provincia);
  navigate("asistente");
  paintTendMap();
  $("tendProvLabel").textContent = provincia;
  runTendencias(provincia);
}

async function renderEscuchaFicha(provincia) {
  const box = $("sec-escucha");
  if (!box) return;
  const head = `<div class="sec-h"><h2>Qué se está diciendo en ${esc(provincia)}</h2><span class="esc-tag">Escucha digital · contexto</span></div>`;
  box.innerHTML = `${head}<p class="note" style="margin-bottom:6px">Leyendo X y medios sobre ${esc(provincia)}…</p>${skLines(3)}`;
  let res;
  try {
    res = await getTendencias(provincia);
  } catch (_) {
    if (E.perfilActual !== provincia) return;
    box.innerHTML = `${head}<p class="note">No pudimos leer la conversación en este momento. El resto de la ficha no depende de esto.</p><button type="button" class="linkbtn" id="escReintentar">Reintentar</button>`;
    $("escReintentar").onclick = () => renderEscuchaFicha(provincia);
    return;
  }
  if (E.perfilActual !== provincia) return;
  const terminos = [...(res.actores || []).map((t) => ({ ...t, actor: true })), ...(res.temas || [])].slice(0, 4);
  const vistos = new Set();
  const posts = terminos
    .flatMap((t) => t.samples || [])
    .filter((s) => safeUrl(s.link) && !vistos.has(s.link) && vistos.add(s.link))
    .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")))
    .slice(0, 2);
  const mas = `<button type="button" class="linkbtn" id="escMas">Ver toda la conversación en Escucha digital</button>`;
  if (!terminos.length) {
    // the backend note can be technical (expired X session); the reporter only needs the outcome
    box.innerHTML = `${head}<p class="note">No encontramos conversación política reciente sobre ${esc(provincia)} en X ni en medios. Puede ser falta de cobertura o una pausa en la lectura de X: vuelve a intentarlo más tarde.</p>${mas}`;
  } else {
    box.innerHTML = `${head}
     <p class="esc-lead">Lo que más se repite en ${res.total_analizados} publicaciones recientes de X y medios:</p>
     <div class="trend-chip-row">${terminos.map((t) => `<span class="trend-chip${t.actor ? " actor" : ""}">${esc(t.term)}<span class="count">${t.count}</span></span>`).join("")}</div>
     ${posts.length ? `<ul class="esc-posts">${posts.map((s) => `<li><a href="${esc(safeUrl(s.link))}" target="_blank" rel="noopener noreferrer">${esc(String(s.title || "").replace(/\s+/g, " ").slice(0, 180))}${String(s.title || "").length > 180 ? "…" : ""}</a><span class="esc-meta">${esc(s.user || s.source || "")}${s.published ? ` · ${esc(fechaCorta(s.published))}` : ""}</span></li>`).join("")}</ul>` : ""}
     <p class="caveat">Muestra pequeña de publicaciones: pista para reportear, no dato citable. No entra a ningún índice.</p>
     ${mas}`;
  }
  // the sheet may have been replaced while the request was in flight
  const btnMas = $("escMas");
  if (btnMas) btnMas.onclick = () => irAEscucha(provincia);
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

export async function loadPerfil(provincia) {
  E.perfilActual = provincia;
  const box = document.getElementById("perfil");
  renderProvLista();
  box.innerHTML = skeletonKit(provincia);
  try {
    const data = await getJSON(`/api/segmentadores/perfil/${encodeURIComponent(provincia)}`);
    if (provincia !== E.perfilActual) return;
    recordarReciente(provincia);
    renderPerfil(data);
    renderProvLista();
    entradaKit(box, data.ivei.indice);
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (innerWidth < 900) requestAnimationFrame(() => box.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" }));
  } catch (e) {
    errorBox(box, `No se pudo cargar la nota de ${provincia}.`, () => loadPerfil(provincia));
  }
}

// Used by clicks from other tabs (map, ranking, scatter, datos) - those
// should actually switch to the Perfil tab. The initial preload on page
// load must NOT do this, or the site opens on Perfil instead of Mapas.
export function goToPerfil(provincia) {
  navigate(`perfil/${enc(provincia)}`);
}
