// Module: fichadoc. Part of the app.js split into native ES modules (no build step).

import { getJSON } from "../api.js";
import { fmt } from "../ui.js";
import { E } from "./estado.js";
import { toast } from "./nav.js";
import { CORTE_FRASE } from "./datos.js";

async function fetchAllPerfiles() {
  if (E.ALL_PERFILES_CACHE) return E.ALL_PERFILES_CACHE;
  E.ALL_PERFILES_CACHE = await Promise.all(E.PROVINCIAS.map((p) => getJSON(`/api/segmentadores/perfil/${encodeURIComponent(p)}`)));
  return E.ALL_PERFILES_CACHE;
}

function rankAmong(all, provincia, valueFn, direction) {
  if (!direction) return "—";
  const items = all.map((p) => ({ provincia: p.provincia, v: valueFn(p) })).filter((x) => x.v != null);
  items.sort((a, b) => (direction === -1 ? a.v - b.v : b.v - a.v));
  const idx = items.findIndex((x) => x.provincia === provincia);
  return idx === -1 ? "—" : `${idx + 1}/${items.length}`;
}

function fichaRow(label, valor, nacional, puesto, unit, source, decimals = 1) {
  const uSuffix = unit ? ` ${unit}` : "";
  return `<tr><td>${label}</td><td class="n"><b>${fmt(valor, decimals)}</b>${uSuffix}</td>
   <td class="n">${nacional != null ? fmt(nacional, decimals) : "s/d"}</td><td class="n">${puesto}</td>
   <td class="s">${source || ""}</td></tr>`;
}

function metaRow(m, all, provincia) {
  return fichaRow(m.label, m.valor, m.nacional, rankAmong(all, provincia, (p) => findMetaValue(p, m.key), m.direction), m.unit, m.source);
}

// meta-wrapped fields live at different nesting depths across the
// response; search the handful of arrays/objects that carry them by key.
function findMetaValue(perfil, key) {
  const pools = [perfil.demografia.edades, perfil.demografia.etnias, perfil.digital.acceso, perfil.digital.brecha, perfil.resiliencia.componentes, perfil.presion_coyuntural.componentes, perfil.socioeconomico, [perfil.resiliencia.escolaridad, perfil.dieta_informativa.usa_redes, perfil.dieta_informativa.n_plataformas, perfil.dieta_informativa.mensajeria, perfil.dieta_informativa.conciencia]];
  for (const pool of pools) {
    const hit = pool.find((m) => m && m.key === key);
    if (hit) return hit.valor;
  }
  return null;
}

function buildFichaHTML(data, all, nacIdent) {
  const pct = (v, total) => (v != null && total ? fmt((100 * v) / total, 1) + "%" : "—");
  const fecha = new Date().toLocaleDateString("es-EC");

  const seccionA = `
  <h2>A. Identificación territorial</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto / % país</th><th>Fuente</th></tr></thead><tbody>
  <tr><td>Provincia</td><td class="n"><b>${data.provincia}</b></td><td class="n">—</td><td class="n">—</td><td class="s">—</td></tr>
  ${fichaRow("Población total", data.identificacion.poblacion, nacIdent.poblacion, pct(data.identificacion.poblacion, nacIdent.poblacion), "hab.", "Censo de Población y Vivienda 2022 (INEC)", 0)}
  ${fichaRow("Población de 16 años y más", data.identificacion.poblacion_16mas, nacIdent.poblacion_16mas, pct(data.identificacion.poblacion_16mas, nacIdent.poblacion_16mas), "hab.", "CPV 2022 (INEC)", 0)}
  ${fichaRow("Superficie", data.identificacion.superficie_km2, nacIdent.superficie_km2, pct(data.identificacion.superficie_km2, nacIdent.superficie_km2), "km²", "geoBoundaries ADM1 (cálculo propio)", 0)}
  ${fichaRow("Densidad poblacional", data.identificacion.densidad, nacIdent.densidad, rankAmong(all, data.provincia, (p) => p.identificacion.densidad, 1), "hab/km²", "CPV 2022 · superficie ADM1")}
  ${fichaRow("Población urbana", data.identificacion.pct_urbano, nacIdent.pct_urbano, rankAmong(all, data.provincia, (p) => p.identificacion.pct_urbano, 1), "%", "CPV 2022 (INEC)")}
  ${fichaRow("Población rural", data.identificacion.pct_rural, nacIdent.pct_rural, rankAmong(all, data.provincia, (p) => p.identificacion.pct_rural, 1), "%", "CPV 2022 (INEC)")}
  </tbody></table>

  <div class="hero"><div style="display:flex;align-items:baseline;gap:14px">
  <div class="big">${fmt(data.ivei.indice)}</div><div><b>Vulnerabilidad ${(data.ivei.nivel || "").toLowerCase()}</b> ·
  puesto ${data.ivei.puesto} de 24 · promedio nacional ${fmt(data.ivei.nacional)}<br>
  <span class="note">${data.perfil_territorial.tipo}</span></div></div></div>`;

  const dimDir = { EST: 1, EXP: 1, RES: -1, PRE: 1 };
  const dimDesc = {
    EST: "Condiciones materiales, educativas y de acceso digital de base que aumentan la susceptibilidad.",
    EXP: "Contacto de la población con el ecosistema digital y las plataformas de circulación rápida.",
    RES: "Capacidades para detectar, contrastar y resistir información engañosa.",
    PRE: "Circunstancias temporales que pueden intensificar el riesgo en período electoral.",
  };
  const seccionB = `
  <h2>B. Índice de vulnerabilidad</h2>
  <table><thead><tr><th>Factor</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Composición</th></tr></thead><tbody>
  ${data.dimensiones
    .map((d) => fichaRow(d.nombre, d.valor, d.nacional, rankAmong(all, data.provincia, (p) => (p.dimensiones.find((x) => x.codigo === d.codigo) || {}).valor, dimDir[d.codigo]), "", dimDesc[d.codigo]))
    .join("")}
  <tr><td><b>Índice integrado (IVEI)</b></td><td class="n"><b>${fmt(data.ivei.indice)}</b></td>
  <td class="n">${fmt(data.ivei.nacional)}</td><td class="n">${data.ivei.puesto}/24</td>
  <td class="s">Combina carencias de base × dependencia de redes × falta de capacidad de contrastar; el clima electoral lo ajusta hasta ±7,5%</td></tr>
  ${(() => {
    const ivd = data.socioeconomico.find((m) => m.key === "ivd_original");
    return ivd ? metaRow(ivd, all, data.provincia) : "";
  })()}
  </tbody></table>`;

  const seccionC = `
  <h2>C. Perfil sociodemográfico</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${data.demografia.edades.map((m) => metaRow(m, all, data.provincia)).join("")}
  ${data.demografia.etnias.map((m) => metaRow(m, all, data.provincia)).join("")}
  ${data.socioeconomico.filter((m) => m.key !== "ivd_original").map((m) => metaRow(m, all, data.provincia)).join("")}
  </tbody></table>`;

  const seccionD = `
  <h2>D. Perfil digital</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${data.digital.acceso.map((m) => metaRow(m, all, data.provincia)).join("")}
  ${data.digital.brecha.map((m) => metaRow(m, all, data.provincia)).join("")}
  ${fichaRow("Sin conexión", data.digital.mecanismo.exclusion, data.digital.mecanismo.nacional_exclusion, rankAmong(all, data.provincia, (p) => p.digital.mecanismo.exclusion, 1), "0-100", "Elaboración propia")}
  ${fichaRow("Saturación de redes", data.digital.mecanismo.hiperexposicion, data.digital.mecanismo.nacional_hiperexposicion, rankAmong(all, data.provincia, (p) => p.digital.mecanismo.hiperexposicion, 1), "0-100", "Elaboración propia")}
  </tbody></table>
  <p class="note">${data.digital.mecanismo.nota}</p>`;

  const plat = Object.entries(data.dieta_informativa.plataformas || {}).filter(([, v]) => v != null);
  const seccionE = `
  <h2>E. Dieta informativa</h2>
  <table><thead><tr><th>Plataforma</th><th class="n">${data.provincia}</th><th class="n">Nacional</th></tr></thead><tbody>
  ${plat.map(([nombre]) => `<tr><td>${nombre}</td><td class="n"><b>${fmt(data.dieta_informativa.plataformas[nombre])}</b> %</td><td class="n">s/d</td></tr>`).join("")}
  </tbody></table>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${[data.dieta_informativa.usa_redes, data.dieta_informativa.n_plataformas, data.dieta_informativa.mensajeria, data.dieta_informativa.conciencia].map((m) => metaRow(m, all, data.provincia)).join("")}
  </tbody></table>
  <p class="note">${data.dieta_informativa.advertencia}</p>`;

  const seccionF = `
  <h2>F. Capacidad de contrastar</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${metaRow(data.resiliencia.escolaridad, all, data.provincia)}
  ${data.resiliencia.componentes.map((m) => metaRow(m, all, data.provincia)).join("")}
  </tbody></table>
  <p class="note">${data.resiliencia.nota}</p>`;

  const seccionG = `
  <h2>G. Clima electoral</h2>
  <table><thead><tr><th>Indicador</th><th class="n">${data.provincia}</th><th class="n">Nacional</th><th class="n">Puesto</th><th>Fuente</th></tr></thead><tbody>
  ${data.presion_coyuntural.componentes.map((m) => metaRow(m, all, data.provincia)).join("")}
  </tbody></table>
  <p class="note">${data.presion_coyuntural.nota}</p>`;

  const seccionH = `
  <h2>H. Diagnóstico territorial</h2>
  ${data.diagnostico.map((p) => `<p style="margin:0 0 9px">${p}</p>`).join("")}`;

  const seccionI = `
  <h2>I. ¿Qué debería considerar un periodista o comunicador en ${data.provincia}?</h2>
  ${data.recomendaciones_periodismo.map((r) => `<h3>${r.titulo}</h3><p>${r.texto}</p>`).join("")}`;

  const metodologia = `
  <h2>Nota metodológica</h2>
  <p class="note">Todos los indicadores provienen de fuentes oficiales: Censo de Población y Vivienda 2022 (INEC),
  ENEMDU 2024 y su módulo TIC (INEC), y Latinobarómetro 2024. Los indicadores derivados del Latinobarómetro tienen
  muestras provinciales pequeñas y se suavizan hacia la media nacional; las provincias sin muestra propia reciben
  el valor nacional imputado. Los "puestos" de esta ficha se calculan en el momento de generarla, comparando esta
  provincia contra las otras 23 en el mismo indicador - un puesto 1 siempre corresponde al valor que más contribuye
  a la vulnerabilidad en ese indicador específico, no necesariamente al valor más alto en términos absolutos.
  ${data.n_lb != null ? `Casos Latinobarómetro en esta provincia: ${data.n_lb}. ` : ""}Este documento se generó
  automáticamente y no constituye una evaluación de personas, medios ni candidatos.</p>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Ficha provincial — ${data.provincia}</title><style>
body{font:13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#131a24;
 max-width:860px;margin:26px auto;padding:0 22px}
h1{font-size:21px;margin:0 0 3px;color:#1b3a5c}h2{font-size:14px;margin:22px 0 7px;color:#1b3a5c;
 border-bottom:2px solid #1b3a5c;padding-bottom:3px}
h3{font-size:12.5px;margin:14px 0 4px}
.sub{color:#657388;font-size:12px;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px}
th{text-align:left;background:#1b3a5c;color:#fff;padding:5px 7px;font-size:10.5px;font-weight:600}
td{padding:4px 7px;border-bottom:1px solid #eef1f5}
tr:nth-child(even) td{background:#f7f9fb}
.n{text-align:right;font-variant-numeric:tabular-nums}
.s{color:#8b98a9;font-size:10px}
.hero{background:#f2f6fa;border:1px solid #dde5ee;border-radius:9px;padding:14px 16px;margin:12px 0}
.big{font-size:34px;font-weight:700;color:#1b3a5c;line-height:1}
p{max-width:82ch}.note{font-size:11px;color:#657388}
@media print{body{margin:0}h2{page-break-after:avoid}table{page-break-inside:avoid}}
</style></head><body>
<h1>Ficha provincial de vulnerabilidad electoral — ${data.provincia}</h1>
<p class="sub">Observatorio de Vulnerabilidad ante la Desinformación Electoral · Ecuador ·
Censo 2022, ENEMDU 2024 y Latinobarómetro 2024 · generada el ${fecha}<br>${CORTE_FRASE}</p>
${seccionA}${seccionB}${seccionC}${seccionD}${seccionE}${seccionF}${seccionG}${seccionH}${seccionI}${metodologia}
</body></html>`;
}

export async function downloadFicha(provincia) {
  if (!provincia) return;
  const btn = document.getElementById("btnFicha");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generando…";
  try {
    const [data, all] = await Promise.all([getJSON(`/api/segmentadores/perfil/${encodeURIComponent(provincia)}`), fetchAllPerfiles()]);
    const html = buildFichaHTML(data, all, E.MAPA.nacional);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ficha_${provincia.replace(/\s+/g, "_")}_vulnerabilidad_electoral.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast("No se pudo generar la ficha. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
