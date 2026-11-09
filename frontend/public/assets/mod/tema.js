// Module: tema. Light / dark. The first visit follows the system; the choice is remembered.
// `?tema=oscuro` (or claro) forces it for the page, handy to share or to test.

import { ICON } from "../ui.js";

const KEY = "ovade.tema";
const guardado = () => {
  try {
    return localStorage.getItem(KEY);
  } catch (_) {
    return null;
  }
};

export const temaActual = () => (document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro");

function pintarBoton() {
  const b = document.getElementById("btnTema");
  if (!b) return;
  const oscuro = temaActual() === "oscuro";
  b.setAttribute("aria-pressed", String(oscuro));
  b.setAttribute("aria-label", oscuro ? "Modo claro" : "Modo oscuro");
  b.title = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  b.innerHTML = oscuro ? ICON.sun : ICON.moon;
}

function aplicar(t) {
  document.documentElement.dataset.tema = t;
  document.documentElement.style.colorScheme = t === "oscuro" ? "dark" : "light";
  pintarBoton();
}

export function initTema() {
  const url = new URLSearchParams(location.search).get("tema");
  const sistema = () => (matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro");
  aplicar(url === "oscuro" || url === "claro" ? url : guardado() || sistema());

  const b = document.createElement("button");
  b.type = "button";
  b.id = "btnTema";
  b.className = "btn-tema";
  b.onclick = () => {
    const nuevo = temaActual() === "oscuro" ? "claro" : "oscuro";
    try {
      localStorage.setItem(KEY, nuevo);
    } catch (_) {}
    aplicar(nuevo);
  };
  const donde = document.getElementById("btnSobreDatos");
  if (donde) donde.before(b);
  else document.querySelector(".brand-row")?.append(b);
  pintarBoton();

  // follow the system while the person has not chosen
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (!guardado() && !url) aplicar(sistema());
  });
}
