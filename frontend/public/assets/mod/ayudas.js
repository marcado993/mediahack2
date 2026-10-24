// Module: ayudas. Small things that save a reporter from losing work or scrolling:
// unfinished forms are kept, a long page has a way back to the top.

import { $ } from "./util.js";
import { toast } from "./nav.js";

const calmo = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- drafts: what you typed in a form is still there if you close it by accident
const CAMPOS_FUERA = /Web$/; // the hidden anti-spam field is never stored

function guardarBorrador(form, key) {
  const campos = [...form.querySelectorAll("input[id], textarea[id], select[id]")].filter((c) => !CAMPOS_FUERA.test(c.id) && c.type !== "hidden" && c.type !== "checkbox");
  const leer = () => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch (_) {
      return {};
    }
  };
  const borrador = leer();
  let recuperado = false;
  for (const c of campos) {
    if (borrador[c.id] && !c.value) {
      c.value = borrador[c.id];
      recuperado = true;
    }
  }
  const guardar = () => {
    const d = {};
    for (const c of campos) if (c.value && c.tagName !== "SELECT") d[c.id] = c.value;
    try {
      Object.keys(d).length ? localStorage.setItem(key, JSON.stringify(d)) : localStorage.removeItem(key);
    } catch (_) {}
  };
  form.addEventListener("input", guardar);
  form.addEventListener("reset", () => {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  });
  return recuperado;
}

export function initBorradores() {
  const hubo = [["formSolicitud", "ovade.borrador.solicitud"], ["formRetro", "ovade.borrador.retro"]].map(([id, key]) => $(id) && guardarBorrador($(id), key));
  if (hubo.some(Boolean)) toast("Recuperamos tu mensaje sin enviar. Ábrelo cuando quieras terminarlo.");
}

// ---- back to the top, only when the page is long enough to need it
export function initSubir() {
  const b = document.createElement("button");
  b.type = "button";
  b.id = "btnSubir";
  b.className = "subir noprint";
  b.setAttribute("aria-label", "Volver arriba");
  b.hidden = true;
  b.innerHTML = '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M3 10l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  b.onclick = () => scrollTo({ top: 0, behavior: calmo() ? "auto" : "smooth" });
  document.body.appendChild(b);
  let visible = false;
  addEventListener(
    "scroll",
    () => {
      const ver = scrollY > 900;
      if (ver !== visible) {
        visible = ver;
        b.hidden = !ver;
      }
    },
    { passive: true }
  );
}
