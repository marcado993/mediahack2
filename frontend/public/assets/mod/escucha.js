// Module: escucha. Part of the app.js split into native ES modules (no build step).

import { esc, vacioFlecha } from "../ui.js";
import { E } from "./estado.js";
import { provinceKey } from "./util.js";
import { tipHide, tipMove, tipShow } from "./tooltip.js";
import { getTendencias, safeUrl } from "./kit.js";

export const vacioEscucha = () => vacioFlecha({ donde: "tend", titulo: "Toca una provincia", texto: "Verás los temas y actores más mencionados en X y medios sobre ese territorio." });

// The sources this search really reads (see backend/app/routers/trends.py): outlets' RSS and X.
// Facebook, Instagram and TikTok are not queried here, so they are not shown as "loading".
const FUENTES = [
  { id: "medios", nombre: "Medios de comunicación", ic: "📰", es: (s) => !/^X\b/.test(s || "") },
  { id: "x", nombre: "X (Twitter)", ic: "𝕏", es: (s) => /^X\b/.test(s || "") },
];
const g = () => window.gsap;
const conMovimiento = () => !!g() && !matchMedia("(prefers-reduced-motion: reduce)").matches;
let pedido = 0;

/** "Searching" state: each source with a moving bar and a seconds counter. Returns a stop function. */
function mostrarBusqueda(box, province) {
  box.innerHTML = `<div class="esc-busca" role="status" aria-live="polite">
    <p class="esc-busca-t">Buscando de qué se habla en <b>${esc(province)}</b></p>
    <ul class="esc-fuentes">${FUENTES.map(
      (f) => `<li data-f="${f.id}"><span class="ef-ic" aria-hidden="true">${f.ic}</span><span class="ef-n">${f.nombre}</span>
        <span class="ef-bar" aria-hidden="true"><i></i></span><span class="ef-e">Buscando…</span></li>`,
    ).join("")}</ul>
    <p class="esc-busca-s"><span class="ef-seg">0 s</span> · suele tardar hasta 20 segundos</p>
  </div>`;
  const t0 = Date.now();
  const reloj = setInterval(() => {
    const seg = box.querySelector(".ef-seg");
    if (seg) seg.textContent = `${Math.round((Date.now() - t0) / 1000)} s`;
  }, 1000);
  let tweens = [];
  if (conMovimiento()) {
    box.classList.add("esc-gsap");
    g().from(box.querySelectorAll(".esc-fuentes li"), { opacity: 0, x: -16, stagger: 0.12, duration: 0.35 });
    // an indeterminate sweep: honest about not knowing how far along the search is
    tweens = [...box.querySelectorAll(".ef-bar i")].map((barra, i) =>
      g().fromTo(barra, { xPercent: -110 }, { xPercent: 260, duration: 1.15, ease: "power1.inOut", repeat: -1, delay: i * 0.25 }),
    );
  }
  return () => {
    clearInterval(reloj);
    tweens.forEach((t) => t.kill());
  };
}

const contar = (posts) => FUENTES.map((f) => posts.filter((p) => f.es(p.source)).length);
const anchoDe = (n, cuentas) => `${Math.max(n ? 8 : 0, (n / Math.max(1, ...cuentas)) * 100)}%`;
const etiqueta = (n) => (n ? `${n} ${n === 1 ? "publicación" : "publicaciones"}` : "Sin resultados");

/** The per-source summary that stays above the topics, built from the counts (never from a running animation). */
function resumenFuentes(cuentas) {
  return `<ul class="esc-fuentes">${FUENTES.map(
    (f, i) => `<li class="${cuentas[i] ? "ok" : "vacio"}"><span class="ef-ic" aria-hidden="true">${f.ic}</span><span class="ef-n">${f.nombre}</span>
      <span class="ef-bar" aria-hidden="true"><i style="transform:none;width:${anchoDe(cuentas[i], cuentas)}"></i></span><span class="ef-e">${etiqueta(cuentas[i])}</span></li>`,
  ).join("")}</ul>`;
}

/** Fills each source's bar with what it really returned, then resolves with the counts. */
function cerrarBusqueda(box, posts) {
  const cuentas = contar(posts);
  [...box.querySelectorAll(".esc-fuentes li")].forEach((li, i) => {
    const n = cuentas[i];
    li.querySelector(".ef-e").textContent = etiqueta(n);
    li.classList.add(n ? "ok" : "vacio");
    const barra = li.querySelector(".ef-bar i");
    Object.assign(barra.style, { transform: "none", width: anchoDe(n, cuentas) });
    if (conMovimiento()) g().from(barra, { width: "0%", duration: 0.5, delay: i * 0.1 });
  });
  return new Promise((r) => setTimeout(() => r(cuentas), conMovimiento() ? 900 : 0));
}

export async function runTendencias(province) {
  const box = document.getElementById("tendResult");
  if (!province) {
    box.innerHTML = vacioEscucha();
    return;
  }
  const mio = ++pedido; // a newer search (another province) wins over this one
  const parar = mostrarBusqueda(box, province);
  try {
    // shared cache with the sheet's "Qué se está diciendo"; post text comes
    // from X and outlets, so every field is escaped and links must be http(s)
    const res = await getTendencias(province);
    if (mio !== pedido) return parar();
    parar();
    const cuentas = await cerrarBusqueda(box, res.posts || []);
    if (mio !== pedido) return;
    const resumen = resumenFuentes(cuentas);
    if (res.note) {
      box.innerHTML = `${resumen}<p class="note">${esc(res.note)}</p>`;
      return;
    }
    const all = [...res.actores, ...res.temas].sort((a, b) => b.count - a.count);
    box.innerHTML = `
    ${resumen}
    <p class="note">${res.total_analizados} publicaciones analizadas. Lo que más se repite, de más a menos:</p>
    <div class="trend-chip-row">${all
      .map((t, i) => `<button class="trend-chip${res.actores.includes(t) ? " actor" : ""}" data-i="${i}">${esc(t.term)}<span class="count">${t.count}</span></button>`)
      .join("")}</div>
    <div id="tendSamples"></div>
    <p class="caveat">Conteo en muestra pequeña — pista para reportear, no dato citable.</p>`;
    if (conMovimiento()) {
      // the topics build up one by one, most mentioned first
      g().from(box.querySelectorAll(".trend-chip"), { opacity: 0, y: 10, scale: 0.85, stagger: 0.07, duration: 0.32, ease: "back.out(1.6)", clearProps: "all" });
      g().from(box.querySelectorAll(".note, .caveat"), { opacity: 0, duration: 0.3, delay: 0.1 });
    }
    box.querySelectorAll(".trend-chip").forEach((chip) => {
      chip.onclick = () => {
        const t = all[Number(chip.dataset.i)];
        E.tendOpenTerm = E.tendOpenTerm === t.term ? null : t.term;
        const caja = document.getElementById("tendSamples");
        caja.innerHTML =
          E.tendOpenTerm == null
            ? ""
            : `<div class="trend-samples">${(all.find((x) => x.term === E.tendOpenTerm)?.samples || [])
                .filter((s) => safeUrl(s.link))
                .map((s) => `<a href="${esc(safeUrl(s.link))}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`)
                .join("")}</div>`;
        if (conMovimiento() && E.tendOpenTerm) g().from(caja.querySelectorAll("a"), { opacity: 0, y: 6, stagger: 0.06, duration: 0.25 });
      };
    });
  } catch (e) {
    parar();
    if (mio !== pedido) return;
    box.innerHTML = `<div class="asis-loading">No se pudo leer la conversación. Revisa tu conexión y vuelve a tocar la provincia.</div>`;
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
    path.setAttribute("aria-label", `${displayName}: ver de qué se habla`);
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
    // keyboard: Enter or Space does what a tap does
    path.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        path.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
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
