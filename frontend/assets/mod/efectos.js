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
  g().from(caja.children, { opacity: 0, y: 16, duration: 0.5, stagger: 0.07, clearProps: "opacity,transform" });
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
