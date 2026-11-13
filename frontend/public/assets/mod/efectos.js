// Motion, with GSAP. One orchestrated moment (the note arriving in order, the score
// counting up, the marker sliding to its place) and small answers to what the person
// just did. Nothing decorative.
//
// GSAP is a plain script (assets/vendor/gsap.min.js). If it is missing, or the person
// asked for less motion, every function here falls back to the CSS version or does
// nothing: the page is complete without it, and numbers always end on their real value.

import { countUp, stagger } from "../estados.js";

const g = () => window.gsap;
const calmo = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const activo = () => !!g() && !calmo();
const fmtNum = (v, d = 1) => v.toLocaleString("es-EC", { minimumFractionDigits: d, maximumFractionDigits: d });

export function initEfectos() {
  if (!g()) return;
  g().defaults({ ease: "power3.out", duration: 0.45 });
  // GSAP now drives the motion that CSS used to: switch the CSS versions off
  document.documentElement.classList.add("gsap");
  // every dialog opens with the same short rise
  const abrir = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function () {
    abrir.call(this);
    if (activo()) g().fromTo(this, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.22, clearProps: "opacity,transform" });
  };
}

// A view comes in when you switch to it.
export function entradaVista(vista) {
  if (!vista || !activo()) return;
  g().killTweensOf(vista);
  g().fromTo(vista, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.28, clearProps: "opacity,transform" });
  requestAnimationFrame(() => aparecerAlBajar(vista));
}

// The note arrives block by block; the score counts to its value and the marker
// slides to where the province sits among the 24.
export function entradaKit(caja, indice) {
  if (!caja) return;
  const cifra = caja.querySelector(".kit-main .big");
  if (!activo()) {
    stagger(caja);
    if (cifra && indice != null) countUp(cifra, indice);
    return;
  }
  g().killTweensOf(caja.children);
  const llegada = g().from(caja.children, { opacity: 0, y: 16, duration: 0.5, stagger: 0.07, clearProps: "opacity,transform" });
  setTimeout(() => llegada.progress(1), 2000); // same guarantee: the sheet always ends fully visible
  titular(caja.querySelector(".prov-title"));
  requestAnimationFrame(() => aparecerAlBajar(caja));
  if (cifra && indice != null) {
    const final = fmtNum(indice);
    const o = { v: 0 };
    cifra.setAttribute("aria-label", final);
    g().to(o, {
      v: indice,
      duration: 0.9,
      delay: 0.15,
      onUpdate: () => (cifra.textContent = fmtNum(o.v)),
      onComplete: () => (cifra.textContent = final),
    });
    setTimeout(() => (cifra.textContent = final), 1800); // whatever happens, the real value is on screen
  }
  const marca = caja.querySelector(".esc-mark");
  if (marca) g().from(marca, { left: "0%", duration: 0.9, delay: 0.25 });
  const pais = caja.querySelector(".esc-pais");
  if (pais) g().from(pais, { opacity: 0, duration: 0.4, delay: 0.7, clearProps: "opacity" });
  const pill = caja.querySelector(".kit-main .pill");
  if (pill) g().from(pill, { scale: 0.6, duration: 0.5, delay: 0.3, ease: "back.out(2.4)", clearProps: "transform" });
}

// Maps and lists draw themselves in the first time they appear.
export function revelar(elementos, { desde = "start", cuanto = 0.5 } = {}) {
  if (!activo() || !elementos || !elementos.length) return;
  g().from(elementos, { opacity: 0, duration: 0.4, stagger: { amount: cuanto, from: desde }, clearProps: "opacity" });
}

// A button that just did its job acknowledges it.
export function pop(boton) {
  if (!activo() || !boton) return;
  g().fromTo(boton, { scale: 0.92 }, { scale: 1, duration: 0.5, ease: "back.out(3)", clearProps: "transform" });
}

/* ---------------------------------------------------------------------
   Newsroom moments. Short (under a second), once per thing, and only when
   GSAP is there and the person did not ask for less motion.
   --------------------------------------------------------------------- */

/** Wraps each word of a heading so it can rise like a front-page headline. Keeps the text for screen readers. */
function palabras(el) {
  if (!el || el.dataset.palabras) return el ? [...el.querySelectorAll(".fx-p > span")] : [];
  el.dataset.palabras = "1";
  el.setAttribute("aria-label", el.textContent.trim());
  const nodos = [...el.childNodes];
  el.textContent = "";
  for (const n of nodos) {
    const texto = n.textContent;
    for (const trozo of texto.split(/(\s+)/)) {
      if (!trozo) continue;
      if (/^\s+$/.test(trozo)) {
        el.append(" ");
        continue;
      }
      const caja = document.createElement("span");
      caja.className = "fx-p";
      caja.setAttribute("aria-hidden", "true");
      const dentro = document.createElement("span");
      dentro.textContent = trozo;
      caja.append(dentro);
      el.append(caja);
    }
  }
  return [...el.querySelectorAll(".fx-p > span")];
}

/** The front page: header, tabs, the "DATOS" strip, the stamp and the headline, in under a second. */
export function portada() {
  if (!activo()) return;
  const tl = g().timeline({ defaults: { ease: "expo.out", duration: 0.45 } });
  const titulo = document.getElementById("brandTitle");
  if (titulo) tl.from(titulo, { opacity: 0, scale: 0.92, duration: 0.35, clearProps: "opacity,transform" }, 0);
  const marca = document.getElementById("brandMark");
  if (marca) tl.from(marca, { rotation: -180, opacity: 0, duration: 0.6, clearProps: "opacity" }, 0);
  const tabs = document.querySelectorAll("header nav .tabs > button:not([hidden])");
  if (tabs.length) tl.from(tabs, { y: -8, opacity: 0, stagger: 0.035, duration: 0.3, clearProps: "opacity,transform" }, 0.08);
  const cut = document.querySelector(".cut .wrap");
  if (cut) tl.from(cut, { clipPath: "inset(0 100% 0 0)", duration: 0.55, ease: "power2.inOut", clearProps: "clipPath" }, 0.15);
  const hero = document.getElementById("heroInicio");
  if (hero && hero.offsetParent) {
    const sello = hero.querySelector(".hero-sello");
    if (sello) tl.from(sello, { scale: 1.7, rotation: -10, opacity: 0, duration: 0.32, ease: "back.out(2.2)", clearProps: "all" }, 0.25);
    const ws = palabras(hero.querySelector("#heroTit"));
    if (ws.length) tl.from(ws, { yPercent: 110, duration: 0.5, stagger: 0.06, clearProps: "transform" }, 0.32);
    const resto = hero.querySelectorAll(".hero-p, .hero-no");
    if (resto.length) tl.from(resto, { opacity: 0, y: 8, stagger: 0.06, duration: 0.35, clearProps: "opacity,transform" }, 0.5);
    const cta = hero.querySelector(".hero-cta");
    if (cta) tl.from(cta, { opacity: 0, y: 14, duration: 0.4, clearProps: "opacity,transform" }, 0.58);
    const tools = hero.querySelectorAll(".hero-acc .hero-btn");
    if (tools.length) tl.from(tools, { opacity: 0, x: 14, stagger: 0.05, duration: 0.3, clearProps: "opacity,transform" }, 0.62);
  }
  // whatever happens, everything ends visible
  setTimeout(() => tl.progress(1), 2500);
}

/** The province name lands like a poster headline. */
export function titular(el) {
  if (!el || !activo()) return;
  g().fromTo(
    el,
    { opacity: 0, scale: 1.18, skewX: -8, rotation: -1.2, textShadow: "0px 0px 0 #d8132b" },
    { opacity: 1, scale: 1, skewX: 0, rotation: -1.2, textShadow: "4px 4px 0 #d8132b", duration: 0.42, ease: "power4.out", clearProps: "opacity,transform,textShadow" },
  );
}

/** A new map layer paints in from west to east, like a news map. */
export function barridoMapa(paths) {
  if (!activo() || !paths.length) return;
  const orden = [...paths].sort((a, b) => a.getBBox().x - b.getBBox().x);
  g().killTweensOf(orden);
  g().fromTo(orden, { opacity: 0.15 }, { opacity: 1, duration: 0.35, stagger: { amount: 0.45 }, ease: "power2.out", clearProps: "opacity" });
}

/** Cards below the fold rise once when they reach the screen. Cards already visible are left alone. */
let vigia = null;
export function aparecerAlBajar(raiz) {
  if (!activo() || !raiz || !("IntersectionObserver" in window)) return;
  vigia ??= new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        vigia.unobserve(e.target);
        const t = g().from(e.target, { opacity: 0, y: 22, duration: 0.45, ease: "power3.out", clearProps: "opacity,transform" });
        setTimeout(() => t.progress(1), 1200); // a throttled or background tab never leaves a card half visible
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  for (const c of raiz.querySelectorAll(".card, details.a-fondo, .fcard, .caso")) {
    if (c.dataset.fxVisto || c.closest(".card") !== c && c.closest(".card")) continue; // nested blocks move with their card
    c.dataset.fxVisto = "1";
    if (c.getBoundingClientRect().top > innerHeight) vigia.observe(c);
  }
}
