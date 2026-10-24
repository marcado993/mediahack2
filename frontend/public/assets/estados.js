// Loading, slow-connection and offline states shared by every view.
// The rule for each one: say what is happening, say what still works, offer the next step.

const $ = (id) => document.getElementById(id);
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- skeletons: grey blocks with the shape of what is coming ----
const W = [100, 92, 64, 80];
export const skLines = (n = 3) => `<div class="sk-wrap" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<div class="sk-b" style="width:${W[i % W.length]}%"></div>`).join("")}</div>`;
export const skTable = (rows = 6) =>
  `<div class="sk-wrap" aria-hidden="true">${Array.from({ length: rows }, () => `<div class="sk-row"><div class="sk-b" style="width:34%"></div><div class="sk-b" style="width:14%"></div><div class="sk-b" style="width:14%"></div><div class="sk-b" style="width:14%"></div></div>`).join("")}</div>`;

// ---- connection: a slow request or no network at all ----
export function initEstadosRed() {
  const pill = $("netbar");
  let pendientes = 0;
  let lento = false;
  let timer;
  let ocultar;
  const decir = (texto, tono = "info", ms = 0) => {
    clearTimeout(ocultar);
    pill.textContent = texto;
    pill.dataset.tone = tono;
    pill.hidden = false;
    if (ms) ocultar = setTimeout(() => (pill.hidden = true), ms);
  };
  const quitar = () => {
    clearTimeout(ocultar);
    pill.hidden = true;
  };
  addEventListener("ovade:busy", () => {
    pendientes++;
    if (pendientes === 1) {
      lento = false;
      timer = setTimeout(() => {
        lento = true;
        decir("Esto está tardando más de lo normal. El servidor puede estar despertando: seguimos intentando.", "warn");
      }, 4500);
    }
  });
  addEventListener("ovade:idle", () => {
    pendientes = Math.max(0, pendientes - 1);
    if (!pendientes) {
      clearTimeout(timer);
      if (lento) {
        lento = false;
        quitar();
      }
    }
  });
  const sinRed = () => decir("Sin conexión a internet. Lo que ya cargó sigue disponible y copiar funciona.", "warn");
  addEventListener("offline", sinRed);
  addEventListener("online", () => decir("Conexión recuperada.", "ok", 2600));
  if (!navigator.onLine) sinRed();
}

// ---- a button that is working says so, and cannot be pressed twice ----
export async function conBusy(el, texto, fn) {
  if (!el) return fn();
  const antes = el.innerHTML;
  el.classList.add("is-busy");
  el.setAttribute("aria-busy", "true");
  if ("disabled" in el) el.disabled = true;
  el.innerHTML = `<span class="btn-spin" aria-hidden="true"></span>${texto}`;
  try {
    // shown for at least a moment: a flash of "Preparando…" reads as a glitch
    const [res] = await Promise.all([fn(), espera(450)]);
    return res;
  } finally {
    el.classList.remove("is-busy");
    el.removeAttribute("aria-busy");
    if ("disabled" in el) el.disabled = false;
    el.innerHTML = antes;
  }
}

// ---- the one signature motion: the score counts up to its real value ----
// The element already holds the final text, so a hidden tab or a stalled frame
// can never leave a wrong number on screen.
export function countUp(el, hasta, decimales = 1, ms = 700) {
  if (!el || calm() || !Number.isFinite(hasta)) return;
  const f = (v) => v.toLocaleString("es-EC", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const final = f(hasta);
  el.setAttribute("aria-label", final);
  const t0 = performance.now();
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = f(hasta * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(paso);
    else el.textContent = final;
  };
  requestAnimationFrame(paso);
  setTimeout(() => (el.textContent = final), ms + 400);
}

// ---- blocks of a freshly rendered page come in one after another ----
export function stagger(contenedor) {
  [...contenedor.children].forEach((hijo, i) => hijo.style.setProperty("--i", Math.min(i, 7)));
}
