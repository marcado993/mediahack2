// Module: nota. "Ideas para tu noticia": a story recommender in three steps.
//   1. ¿De qué provincia?   2. ¿Qué estás cubriendo?   3. Recomendaciones
// The answer changes with what the reporter covers: where to start, what people are talking about
// today (Escucha digital), how to reach people, the number that backs it and what not to claim.
// Every sentence comes from the province data; nothing is sent anywhere.

import { getJSON } from "../api.js";
import { ICON, esc, fmt } from "../ui.js";
import { E } from "./estado.js";
import { $, normalize, provinceKey } from "./util.js";
import { col } from "./color.js";
import { enc } from "./datos.js";
import { byKey } from "./mapa.js";
import { navigate, toast, viewEnabled } from "./nav.js";
import { getTendencias, piezasNota, safeUrl } from "./kit.js";
import { recientes, recordarReciente, sugerir } from "./inicio.js";

const PASOS = ["Provincia", "Qué cubres", "Recomendaciones"];

// What the reporter can be covering. The words are the newsroom's, not the index's.
const TIPOS = [
  { id: "rumor", titulo: "Un rumor o video que está circulando", sub: "Quieres saber si vale la pena verificarlo aquí y cómo desmentirlo.", ic: "warn" },
  { id: "campana", titulo: "La campaña y la elección", sub: "Contexto para una nota sobre candidatos, votación o clima político.", ic: "pen" },
  { id: "informa", titulo: "Cómo se informa la gente aquí", sub: "Por qué redes, con qué conexión y con qué capacidad de contrastar.", ic: "wifi" },
  { id: "fondo", titulo: "Un reportaje de fondo", sub: "Todos los ángulos y datos de la provincia, para una pieza larga.", ic: "book" },
];

const st = { paso: 1, provincia: "", tipo: "", piezas: null, pedido: 0 };
let dlg = null;

/* ------------------------------------------------------------------ helpers */
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const pct = (v) => `${fmt(v, 0)} %`;
const sobre = (x) => x.valor != null && x.nacional != null && x.valor > x.nacional;

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (_) {
    const t = Object.assign(document.createElement("textarea"), { value: texto });
    t.style.cssText = "position:fixed;opacity:0";
    document.body.append(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_) {}
    t.remove();
    return ok;
  }
}

async function copiarEn(boton, texto) {
  if (!(await copiar(texto))) return void toast("No se pudo copiar. Selecciona el texto y cópialo con Ctrl+C.");
  const antes = boton.innerHTML;
  boton.textContent = "Copiado ✓";
  boton.classList.add("done");
  setTimeout(() => {
    if (!boton.isConnected) return;
    boton.innerHTML = antes;
    boton.classList.remove("done");
  }, 1600);
}

/* ------------------------------------------------------------------ the recommendations */
/**
 * Builds the advice for one province and one kind of story. Each block is
 * { titulo, items: [{ b, t }] } for advice, or { citas: [{ texto, fuente }] } for quotable numbers.
 */
function recomendar(p, tipo) {
  const prov = p.provincia;
  const top = p.plataformas.slice(0, 3);
  const redes = top.map(([n, v]) => `${n} (${pct(v)})`).join(", ");
  const masVulnerable = p.puesto <= 8;
  const porque = p.pesan.length
    ? `En ${prov} pesan más ${p.pesan.map((d) => `${d.nombre} (${fmt(d.valor)} puntos frente a ${fmt(d.nacional)} del promedio del país)`).join(" y ")}.`
    : "";
  const climaTxt = sobre(p.clima) ? `El clima electoral de ${prov} está sobre el promedio del país (${fmt(p.clima.valor)} frente a ${fmt(p.clima.nacional)}): pesan la desconfianza en el voto, el temor al delito y la victimización.` : "";
  const plataformasTxt = top.length ? `Entre quienes usan redes en ${prov}, ${top.map(([n, v]) => `${pct(v)} usa ${n}`).join(", ")}.` : "";
  const recs = p.recomendaciones.map((r) => ({ b: r.titulo, t: r.texto }));
  const llegar = [];
  if (top.length) llegar.push({ b: tipo === "rumor" ? "Desmiéntelo donde circula" : "Dónde está la gente", t: `Las redes más usadas aquí son ${redes}.` });
  if (sobre(p.sinConexion)) llegar.push({ b: "Hay gente sin conexión", t: `Lo que no está en internet llega por radio local, boca a boca y aliados del territorio. ${prov} está sobre el promedio en exclusión digital (${fmt(p.sinConexion.valor)} frente a ${fmt(p.sinConexion.nacional)}).` });
  if (sobre(p.saturacion)) llegar.push({ b: "Hay saturación de redes", t: `Responde en las mismas plataformas y con voces que la gente ya sigue. ${prov} está sobre el promedio en saturación de redes (${fmt(p.saturacion.valor)} frente a ${fmt(p.saturacion.nacional)}).` });
  if (!sobre(p.sinConexion) && !sobre(p.saturacion)) llegar.push({ b: "Combina canales", t: p.canal });

  const citaPrincipal = { texto: p.principal, fuente: p.fuente };
  const citaPorque = porque ? [{ texto: porque, fuente: p.fuente }] : [];
  const dato = (v) => p.datos.filter((d) => v.includes(d.variable)).map((d) => ({ texto: d.texto, fuente: d.fuente }));
  const citaPlataformas = plataformasTxt ? [{ texto: plataformasTxt, fuente: "Latinobarómetro 2024" }] : [];

  if (tipo === "rumor") {
    const empezar = [
      masVulnerable
        ? { b: "Prioriza la verificación", t: `${prov} está en el puesto ${p.puesto} de 24: aquí un rumor encuentra más terreno que en la mayoría de provincias.` }
        : { b: "Mide el alcance antes de amplificarlo", t: `${prov} está en el puesto ${p.puesto} de 24, fuera de las más vulnerables. Si el rumor casi no circula, desmentirlo en grande puede darle la visibilidad que no tenía.` },
    ];
    if (climaTxt) empezar.push({ b: "Si toca fraude o seguridad, ojo", t: climaTxt });
    if (recs[0]) empezar.push(recs[0]);
    return { empezar, llegar, citas: [citaPrincipal, ...citaPorque, ...dato(["Usó internet"])] };
  }
  if (tipo === "campana") {
    const empezar = [];
    if (porque) empezar.push({ b: "El ángulo", t: porque });
    if (climaTxt) empezar.push({ b: "El clima de la elección", t: climaTxt });
    empezar.push(...recs);
    if (!empezar.length) empezar.push({ b: "El ángulo", t: `${prov} está en el puesto ${p.puesto} de 24, con vulnerabilidad ${p.nivel}: ningún factor se aleja mucho del promedio del país.` });
    return { empezar, llegar, citas: [citaPrincipal, ...citaPorque, ...(climaTxt ? [{ texto: climaTxt, fuente: p.fuente }] : [])] };
  }
  if (tipo === "informa") {
    const empezar = [{ b: "Qué tipo de provincia es", t: `${p.tipo}.` }];
    if (sobre(p.sinConexion)) empezar.push({ b: "Una parte queda fuera de internet", t: `La exclusión digital de ${prov} supera el promedio del país (${fmt(p.sinConexion.valor)} frente a ${fmt(p.sinConexion.nacional)}).` });
    if (sobre(p.saturacion)) empezar.push({ b: "Mucha vida en redes", t: `La saturación de redes de ${prov} supera el promedio del país (${fmt(p.saturacion.valor)} frente a ${fmt(p.saturacion.nacional)}).` });
    return { empezar, llegar, citas: [...citaPlataformas, ...dato(["Usó internet", "Analfabetismo digital", "rural"])] };
  }
  // fondo: everything, in reading order
  const empezar = [...(porque ? [{ b: "Lo que explica su nivel", t: porque }] : []), { b: "Qué tipo de provincia es", t: `${p.tipo}.` }, ...recs];
  if (climaTxt) empezar.push({ b: "El clima de la elección", t: climaTxt });
  return { empezar, llegar, citas: [citaPrincipal, ...citaPorque, ...citaPlataformas, ...p.datos.map((d) => ({ texto: d.texto, fuente: d.fuente }))] };
}

/** The same advice as plain text, to paste into the newsroom chat or a planning doc. */
function guiaTexto(p, tipo, r) {
  const t = TIPOS.find((x) => x.id === tipo);
  const lista = (items) => items.map((i) => `- ${i.b}: ${i.t}`).join("\n");
  return [
    `IDEAS PARA TU NOTICIA · ${p.provincia} · ${t.titulo}`,
    `\nPOR DÓNDE EMPEZAR\n${lista(r.empezar)}`,
    `\nCÓMO LLEGAR A LA GENTE\n${lista(r.llegar)}`,
    `\nDATOS PARA CITAR\n${r.citas.map((c) => `- ${c.texto} (Fuente: ${c.fuente})`).join("\n")}`,
    p.aviso ? `\nPRECAUCIÓN\n- ${p.aviso}` : "",
    `\nNO AFIRMES\n${p.noAfirmar.map((x) => `- ${x}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ shell */
function crearDialogo() {
  dlg = document.createElement("dialog");
  dlg.id = "dlgNota";
  dlg.className = "nota-dlg";
  dlg.setAttribute("aria-labelledby", "notaTit");
  dlg.innerHTML = `
   <div class="nota-top">
    <p class="nota-sello">Ideas para tu noticia</p>
    <button type="button" class="linkbtn nota-x" data-nota="cerrar" aria-label="Cerrar">Cerrar ✕</button>
   </div>
   <ol class="nota-pasos" aria-label="Pasos"></ol>
   <div class="nota-cuerpo" id="notaCuerpo"></div>
   <div class="nota-pie" id="notaPie"></div>`;
  document.body.append(dlg);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) return cerrar(); // click on the backdrop
    const b = e.target.closest("[data-nota]");
    if (!b) return;
    const accion = b.dataset.nota;
    if (accion === "cerrar") cerrar();
    if (accion === "atras") ir(st.paso - 1);
    if (accion === "paso") ir(Number(b.dataset.n));
  });
  dlg.addEventListener("close", () => document.documentElement.classList.remove("nota-abierta"));
}

function pintarPasos() {
  dlg.querySelector(".nota-pasos").innerHTML = PASOS.map((t, i) => {
    const n = i + 1;
    const estado = n < st.paso ? "hecho" : n === st.paso ? "ahora" : "luego";
    const etiqueta = `<span class="np-n" aria-hidden="true">${n < st.paso ? "✓" : n}</span><span class="np-t">${t}</span>`;
    return `<li class="np ${estado}"${n === st.paso ? ' aria-current="step"' : ""}>${n < st.paso ? `<button type="button" data-nota="paso" data-n="${n}" aria-label="Volver al paso ${n}: ${t}">${etiqueta}</button>` : etiqueta}</li>`;
  }).join("");
}

const pie = (html) => ($("notaPie").innerHTML = html);

function ir(n) {
  if (n < 1 || (n >= 2 && !st.provincia) || (n === 3 && !st.tipo)) return;
  st.paso = n;
  pintarPasos();
  const cuerpo = $("notaCuerpo");
  if (n === 1) paso1(cuerpo);
  if (n === 2) paso2(cuerpo);
  if (n === 3) paso3(cuerpo);
  if (!reduceMotion()) {
    cuerpo.classList.remove("entra");
    void cuerpo.offsetWidth;
    cuerpo.classList.add("entra");
  }
  cuerpo.scrollTop = 0;
}

/* ------------------------------------------------------------------ step 1: province */
function botonProv(p) {
  const r = byKey()[provinceKey(p)] ?? {};
  return `<button type="button" class="nota-prov" data-prov="${esc(p)}"><span class="dot" style="background:${col("IVEI", r.IVEI)}" aria-hidden="true"></span>${esc(p)}</button>`;
}

function paso1(cuerpo) {
  const rec = recientes();
  cuerpo.innerHTML = `
   <h2 id="notaTit" class="nota-h">¿De qué provincia es tu noticia?</h2>
   <p class="nota-sub">Escribe el nombre o tócala en la lista. No importan tildes ni errores.</p>
   <label class="sr" for="notaBuscar">Buscar provincia</label>
   <input id="notaBuscar" class="nota-buscar" type="search" placeholder="Ej. Guayas, Pichincha, Manabí…" autocomplete="off" spellcheck="false" enterkeyhint="go">
   <p class="nota-ayuda" id="notaAyudaBuscar" aria-live="polite"></p>
   ${rec.length ? `<p class="nota-mini">Las que miraste hace poco</p><div class="nota-provs nota-recientes">${rec.map(botonProv).join("")}</div><p class="nota-mini">Todas</p>` : ""}
   <div class="nota-provs" id="notaProvs">${E.PROVINCIAS.map(botonProv).join("")}</div>`;
  pie(`<span class="nota-pie-t">Paso 1 de 3 · después nos cuentas qué estás cubriendo</span>`);
  const campo = $("notaBuscar");
  const lista = $("notaProvs");
  campo.addEventListener("input", () => {
    const q = normalize(campo.value.trim());
    let visibles = 0;
    lista.querySelectorAll("[data-prov]").forEach((b) => {
      const si = !q || normalize(b.dataset.prov).includes(q);
      b.hidden = !si;
      if (si) visibles++;
    });
    cuerpo.querySelector(".nota-recientes")?.toggleAttribute("hidden", !!q);
    cuerpo.querySelectorAll(".nota-mini").forEach((m) => (m.hidden = !!q));
    const ayuda = $("notaAyudaBuscar");
    if (q && !visibles) {
      const s = sugerir(campo.value, 3);
      ayuda.innerHTML = s.length
        ? `No hay una provincia con ese nombre. ¿Quisiste decir ${s.map((p) => `<button type="button" class="linkbtn" data-prov="${esc(p)}">${esc(p)}</button>`).join(", ")}?`
        : "No hay una provincia con ese nombre. Prueba con las primeras letras.";
    } else ayuda.textContent = q && visibles === 1 ? "Pulsa Enter para elegirla." : "";
  });
  campo.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const primera = lista.querySelector("[data-prov]:not([hidden])") || $("notaAyudaBuscar").querySelector("[data-prov]");
    if (primera) elegirProvincia(primera.dataset.prov);
  });
  cuerpo.addEventListener("click", (e) => {
    const b = e.target.closest("[data-prov]");
    if (b) elegirProvincia(b.dataset.prov);
  });
  setTimeout(() => campo.focus(), 30);
}

function elegirProvincia(p) {
  if (st.provincia !== p) {
    st.provincia = p;
    st.piezas = null;
  }
  recordarReciente(p);
  ir(st.tipo ? 3 : 2);
}

/* ------------------------------------------------------------------ step 2: kind of story */
function paso2(cuerpo) {
  cuerpo.innerHTML = `
   <h2 id="notaTit" class="nota-h">¿Qué estás cubriendo en ${esc(st.provincia)}?</h2>
   <p class="nota-sub">Elige lo más parecido. Según eso te damos el ángulo, los datos y por dónde llegar.</p>
   <div class="nota-tipos" role="list">${TIPOS.map(
     (t) => `<button type="button" role="listitem" class="nota-tipo${st.tipo === t.id ? " on" : ""}" data-tipo="${t.id}">
      <span class="hero-ic" aria-hidden="true">${ICON[t.ic]}</span><span class="nt-t"><b>${t.titulo}</b><small>${t.sub}</small></span><span class="nt-ir" aria-hidden="true">→</span></button>`,
   ).join("")}</div>`;
  pie(`<button type="button" class="btn gh" data-nota="atras">← Cambiar provincia</button><span class="nota-pie-t">Paso 2 de 3</span>`);
  cuerpo.querySelectorAll("[data-tipo]").forEach((b) =>
    b.addEventListener("click", () => {
      st.tipo = b.dataset.tipo;
      ir(3);
    }),
  );
  (cuerpo.querySelector(".nota-tipo.on") || cuerpo.querySelector(".nota-tipo"))?.focus();
}

/* ------------------------------------------------------------------ step 3: recommendations */
async function paso3(cuerpo) {
  const tipo = TIPOS.find((t) => t.id === st.tipo);
  pie(`<button type="button" class="btn gh" data-nota="atras">← Cambiar lo que cubres</button><span class="nota-pie-t">Paso 3 de 3</span>`);
  if (!st.piezas) {
    cuerpo.innerHTML = `<h2 id="notaTit" class="nota-h">Preparando ideas para ${esc(st.provincia)}…</h2><div class="nota-carga" role="status" aria-label="Cargando"><div class="sk-b"></div><div class="sk-b"></div><div class="sk-b" style="width:70%"></div></div>`;
    const pedido = ++st.pedido;
    try {
      const data = E.PERFIL_DATA?.provincia === st.provincia ? E.PERFIL_DATA : await getJSON(`/api/segmentadores/perfil/${encodeURIComponent(st.provincia)}`);
      if (pedido !== st.pedido || st.paso !== 3) return; // the reporter moved on meanwhile
      st.piezas = piezasNota(data);
    } catch (_) {
      if (pedido !== st.pedido) return;
      cuerpo.innerHTML = `<h2 id="notaTit" class="nota-h">No se pudieron traer los datos de ${esc(st.provincia)}</h2>
       <p class="nota-sub">Puede ser la conexión o el servidor. No perdiste nada: vuelve a intentar.</p>
       <button type="button" class="btn" id="notaReintentar">Reintentar</button>`;
      $("notaReintentar").onclick = () => paso3(cuerpo);
      return;
    }
  }
  const p = st.piezas;
  const r = recomendar(p, st.tipo);
  const lista = (items) => `<ul class="nota-recs">${items.map((i) => `<li><b>${esc(i.b)}.</b> ${esc(i.t)}</li>`).join("")}</ul>`;
  const conEscucha = viewEnabled("asistente");
  cuerpo.innerHTML = `
   <h2 id="notaTit" class="nota-h">Ideas para tu noticia en ${esc(p.provincia)}</h2>
   <p class="nota-sub">${esc(tipo.titulo)}. <button type="button" class="linkbtn" data-nota="atras">Cambiar</button></p>
   ${p.aviso ? `<p class="nota-aviso" role="note">${ICON.warn}<span><b>Antes que nada:</b> ${esc(p.aviso)}</span></p>` : ""}
   <section class="nota-bloque"><h3>${ICON.pen}Por dónde empezar</h3>${lista(r.empezar)}</section>
   ${
     conEscucha
       ? `<section class="nota-bloque nota-escucha" aria-live="polite"><h3>${ICON.escucha}${st.tipo === "rumor" ? "¿Ya está circulando? Lo que se repite hoy" : "De qué se habla hoy"}</h3>
       <p class="nota-cargando">Leyendo X y medios sobre ${esc(p.provincia)}… puede tardar unos segundos. Lo demás ya está listo.</p></section>`
       : ""
   }
   <section class="nota-bloque"><h3>${ICON.share}Cómo llegar a la gente</h3>${lista(r.llegar)}</section>
   <section class="nota-bloque"><h3>${ICON.copy}Datos para citar</h3>
    <ul class="nota-citas">${r.citas
      .map((c, i) => `<li><p>${esc(c.texto)}<small>Fuente: ${esc(c.fuente)}</small></p><button type="button" class="copybtn" data-cita="${i}">${ICON.copy}Copiar</button></li>`)
      .join("")}</ul></section>
   <section class="nota-bloque nota-no"><h3>${ICON.cross}No afirmes</h3><ul class="nota-recs">${p.noAfirmar.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`;
  cuerpo.querySelectorAll("[data-cita]").forEach((b) => {
    const c = r.citas[Number(b.dataset.cita)];
    b.onclick = () => copiarEn(b, `${c.texto} Fuente: ${c.fuente}.${p.aviso ? ` Precaución editorial: ${p.aviso}` : ""}`);
  });
  pie(`<button type="button" class="btn gh" data-nota="atras">← Cambiar lo que cubres</button>
    ${viewEnabled("chat") ? `<button type="button" class="btn gh" id="notaChat">${ICON.chat}Contrastar en el chat</button>` : ""}
    <button type="button" class="btn" id="notaGuia">${ICON.copy}Copiar estas ideas</button>`);
  $("notaGuia").onclick = (e) => copiarEn(e.currentTarget, guiaTexto(p, st.tipo, r));
  if ($("notaChat"))
    $("notaChat").onclick = () => {
      cerrar();
      navigate(`chat/${enc(p.provincia)}`);
    };
  if (conEscucha) pintarEscucha(p.provincia);
  cuerpo.querySelector("h3")?.scrollIntoView({ block: "nearest" });
}

/** Escucha digital inside the recommendations: the most repeated terms and two recent posts. */
async function pintarEscucha(prov) {
  const caja = $("notaCuerpo").querySelector(".nota-escucha");
  const titulo = caja.querySelector("h3").outerHTML;
  const irEscucha = `<button type="button" class="linkbtn" id="notaVerEscucha">Ver toda la conversación en Escucha digital</button>`;
  let res;
  try {
    res = await getTendencias(prov);
  } catch (_) {
    if (!caja.isConnected) return;
    caja.innerHTML = `${titulo}<p class="nota-cargando">No pudimos leer la conversación ahora. Lo demás no depende de esto.</p><button type="button" class="linkbtn" id="notaReEscucha">Reintentar</button>`;
    $("notaReEscucha").onclick = () => {
      caja.innerHTML = `${titulo}<p class="nota-cargando">Leyendo X y medios…</p>`;
      pintarEscucha(prov);
    };
    return;
  }
  if (!caja.isConnected || st.provincia !== prov) return;
  const terminos = [...(res.actores || []), ...(res.temas || [])].sort((a, b) => b.count - a.count).slice(0, 6);
  const vistos = new Set();
  const posts = terminos
    .flatMap((t) => t.samples || [])
    .filter((s) => safeUrl(s.link) && !vistos.has(s.link) && vistos.add(s.link))
    .sort((a, b) => String(b.published || "").localeCompare(String(a.published || "")))
    .slice(0, 2);
  caja.innerHTML = terminos.length
    ? `${titulo}
     <p class="nota-cargando">Lo que más se repite en ${res.total_analizados} publicaciones recientes de X y medios sobre ${esc(prov)}:</p>
     <div class="trend-chip-row">${terminos.map((t) => `<span class="trend-chip">${esc(t.term)}<span class="count">${t.count}</span></span>`).join("")}</div>
     ${posts.length ? `<ul class="esc-posts">${posts.map((s) => `<li><a href="${esc(safeUrl(s.link))}" target="_blank" rel="noopener noreferrer">${esc(String(s.title || "").replace(/\s+/g, " ").slice(0, 160))}…</a> <small>${esc(s.source || "")}</small></li>`).join("")}</ul>` : ""}
     <p class="nota-pista">Pista para reportear, no dato citable: es una muestra pequeña.</p>${irEscucha}`
    : `${titulo}<p class="nota-cargando">No encontramos conversación política reciente sobre ${esc(prov)} en X ni en medios. Puede ser falta de cobertura: vuelve a mirar más tarde.</p>${irEscucha}`;
  $("notaVerEscucha").onclick = () => {
    cerrar();
    E.tendSel = provinceKey(prov);
    navigate("asistente");
  };
}

/* ------------------------------------------------------------------ public */
function cerrar() {
  dlg?.open && dlg.close();
}

/**
 * Opens the recommender. With a province (from a province sheet) it starts at "¿Qué estás cubriendo?";
 * without one, at the province. Waits for the province list if the page is still loading.
 */
export function abrirNota(provincia = "") {
  if (!dlg) crearDialogo();
  if (provincia && provincia !== st.provincia) {
    st.provincia = provincia;
    st.piezas = null;
  }
  st.tipo = "";
  if (!dlg.open) dlg.showModal();
  document.documentElement.classList.add("nota-abierta");
  const empezar = () => ir(provincia ? 2 : 1);
  if (E.PROVINCIAS.length && E.MAPA) return empezar();
  st.paso = 1;
  pintarPasos();
  $("notaCuerpo").innerHTML = `<h2 id="notaTit" class="nota-h">Cargando las provincias…</h2><div class="nota-carga" role="status"><div class="sk-b"></div><div class="sk-b"></div></div>`;
  pie("");
  const espera = setInterval(() => {
    if (!E.PROVINCIAS.length || !E.MAPA) return;
    clearInterval(espera);
    if (dlg.open) empezar();
  }, 250);
}

/** Wires every [data-abrir-nota] button on the page (the start screen, the province sheet). */
export function initNota() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-abrir-nota]");
    if (b) abrirNota(b.dataset.abrirNota || "");
  });
}
