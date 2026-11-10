// Module: cuenta. The account that opens the chat and the vault: a pseudonym and a password, no e-mail.
// The server keeps the pseudonym and a scrypt hash; this browser keeps the session token. By default
// the token lives in sessionStorage (gone when the tab closes); "keep me signed in" moves it to
// localStorage. The password is never stored here.

import { API_BASE } from "../api.js";
import { ICON, esc } from "../ui.js";

const CLAVE = "ovade.cuenta";
const MIN_CLAVE = 10;
const SEUDONIMO_OK = /^[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ][0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ _.\-]{1,18}[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]$/;
const SIN_RED = "No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentar: no se perdió nada de lo que escribiste.";

let memoria = null; // fallback when the browser blocks storage (private mode with strict settings)

function leer() {
  for (const almacen of ["sessionStorage", "localStorage"]) {
    try {
      const d = JSON.parse(window[almacen].getItem(CLAVE) || "null");
      if (d && typeof d.ficha === "string" && typeof d.seudonimo === "string") return d;
    } catch (_) {}
  }
  return memoria;
}

function escribir(datos, recordar) {
  memoria = datos;
  for (const almacen of ["sessionStorage", "localStorage"]) {
    try {
      window[almacen].removeItem(CLAVE);
    } catch (_) {}
  }
  if (!datos) return;
  try {
    window[recordar ? "localStorage" : "sessionStorage"].setItem(CLAVE, JSON.stringify(datos));
  } catch (_) {}
}

/** The open session ({ficha, seudonimo}) or null. */
export const sesion = () => leer();

const avisar = () => dispatchEvent(new Event("ovade:cuenta"));

async function pedir(ruta, { cuerpo, conSesion = false } = {}) {
  const cabeceras = { "Content-Type": "application/json" };
  if (conSesion && sesion()) cabeceras.Authorization = `Bearer ${sesion().ficha}`;
  let res;
  try {
    res = await fetch(`${API_BASE}/api/cuenta${ruta}`, { method: "POST", headers: cabeceras, body: JSON.stringify(cuerpo ?? {}) });
  } catch (_) {
    throw Object.assign(new Error(SIN_RED), { campo: "" });
  }
  if (res.ok) return res.status === 204 ? null : res.json();
  let detalle = {};
  try {
    detalle = await res.json();
  } catch (_) {}
  const texto = typeof detalle.detail === "string" ? detalle.detail : res.status === 404 ? "El servidor todavía no tiene activadas las cuentas. Avisa al equipo de OVADE." : "El servidor no pudo atender la solicitud. Vuelve a intentar en un momento.";
  throw Object.assign(new Error(texto), { campo: detalle.campo || "", estado: res.status });
}

/** Signs out here and on the server. The vault's contents stay on this device, still encrypted. */
export async function cerrarSesion() {
  const habia = sesion();
  if (habia) pedir("/salir", { conSesion: true }).catch(() => {}); // best effort: the local token is dropped either way
  escribir(null);
  avisar();
}

/** The server said the token is no longer valid (expired, or signed out elsewhere). */
export function sesionVencida() {
  escribir(null);
  avisar();
}

async function borrarCuenta(clave) {
  await pedir("/borrar", { cuerpo: { clave }, conSesion: true });
  escribir(null);
  avisar();
}

/* ---------------------------------------------------------------------
   "Signed in as …" strip, shown at the bottom of the chat and the vault.
   --------------------------------------------------------------------- */
export function barraCuenta(el) {
  const s = sesion();
  if (!el || !s) return;
  el.innerHTML = `<span class="cta-quien">${ICON.check}<span>Sesión iniciada como <b>${esc(s.seudonimo)}</b></span></span>
    <span class="cta-acc"><button type="button" class="linkbtn" data-cta="salir">Cerrar sesión</button>
    <button type="button" class="linkbtn" data-cta="borrar" aria-expanded="false">Borrar mi cuenta</button></span>
    <form class="cta-borrar bov-form" hidden novalidate>
      <p class="bov-nota error" role="note"><b>Esto no se puede deshacer.</b> Se borra tu seudónimo del servidor y queda libre para otra persona. Lo que tengas en la bóveda sigue en este equipo, cifrado.</p>
      <label class="fld"><span>Escribe tu contraseña para confirmar</span><input type="password" name="clave" autocomplete="current-password" required></label>
      <div class="bov-acciones"><button class="btn gh peligro" type="submit">Borrar mi cuenta para siempre</button><button class="btn gh" type="button" data-cta="cancelar">Cancelar</button></div>
      <div class="cta-msg" aria-live="assertive"></div>
    </form>`;
  const form = el.querySelector(".cta-borrar");
  const abrir = (si) => {
    form.hidden = !si;
    el.querySelector('[data-cta="borrar"]').setAttribute("aria-expanded", String(si));
    if (si) form.elements.clave.focus();
    else form.reset();
  };
  el.onclick = (ev) => {
    const b = ev.target.closest("[data-cta]");
    if (!b) return;
    if (b.dataset.cta === "salir") cerrarSesion();
    if (b.dataset.cta === "borrar") abrir(form.hidden);
    if (b.dataset.cta === "cancelar") abrir(false);
  };
  form.onkeydown = (ev) => ev.key === "Escape" && abrir(false);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      await borrarCuenta(form.elements.clave.value);
    } catch (e) {
      boton.disabled = false;
      form.querySelector(".cta-msg").innerHTML = `<p class="bov-nota error">${esc(e.message)}</p>`;
      form.elements.clave.focus();
    }
  };
}

/* ---------------------------------------------------------------------
   The door: create an account or sign in. Rendered inside the view that
   needs it, so the person never loses track of where they were going.
   --------------------------------------------------------------------- */
const DESTINO = {
  chat: { titulo: "Entra para usar el chat", para: "En el chat te verán con tu seudónimo, nunca con tu nombre real." },
  boveda: { titulo: "Entra para abrir la bóveda", para: "La cuenta abre la puerta. Después, la bóveda tiene su propia contraseña, que cifra tus archivos y nunca sale de este equipo." },
};

let modo = "crear"; // remembered while the page is open, so switching views does not reset the choice

/**
 * Renders the account door inside `el`. `destino` is "chat" or "boveda". `alEntrar` runs once signed in.
 * `aviso` is an optional line explaining why the door is showing (for example, the session expired).
 */
export function puertaCuenta(el, destino, alEntrar, aviso = "") {
  const d = DESTINO[destino];
  const id = `cta-${destino}`;
  const crear = modo === "crear";
  el.innerHTML = `
    <div class="bov-cab"><span class="bov-ic" aria-hidden="true">${ICON.lock}</span><div><h2 id="${id}-tit">${d.titulo}</h2>
      <p class="bov-sub">Una sola cuenta sirve para el chat y la bóveda. El mapa, las fichas y los datos siguen abiertos sin cuenta.</p></div></div>
    ${aviso ? `<p class="bov-nota" role="status">${esc(aviso)}</p>` : ""}
    <div class="cta-modo" role="group" aria-label="¿Tienes cuenta?">
      <button type="button" data-modo="crear" aria-pressed="${crear}">Crear cuenta</button>
      <button type="button" data-modo="entrar" aria-pressed="${!crear}">Ya tengo cuenta</button>
    </div>
    <form class="bov-form cta-form" novalidate aria-labelledby="${id}-tit">
      <label class="fld"><span>Seudónimo</span>
        <input name="seudonimo" type="text" maxlength="20" autocomplete="username" autocapitalize="off" spellcheck="false" required aria-describedby="${id}-s-ayuda ${id}-s-err">
      </label>
      <p class="bov-ayuda" id="${id}-s-ayuda">${crear ? "De 3 a 20 caracteres. " + d.para + " No pedimos correo ni datos personales." : "El que elegiste al crear la cuenta. No importan mayúsculas ni tildes."}</p>
      <p class="cta-err" id="${id}-s-err" role="alert" hidden></p>
      <label class="fld"><span>Contraseña</span>
        <span class="cta-clave"><input name="clave" type="password" autocomplete="${crear ? "new-password" : "current-password"}" required aria-describedby="${id}-c-ayuda ${id}-c-err">
        <button type="button" class="btn gh cta-ver" aria-pressed="false" aria-label="Mostrar la contraseña">Ver</button></span>
      </label>
      <p class="bov-ayuda" id="${id}-c-ayuda" aria-live="polite">${crear ? `Al menos ${MIN_CLAVE} caracteres. Una frase de varias palabras es fácil de recordar y difícil de adivinar.` : ""}</p>
      <p class="cta-err" id="${id}-c-err" role="alert" hidden></p>
      ${crear ? `<p class="bov-nota cta-ojo" role="note">${ICON.warn}<span><b>Anótala en un lugar seguro.</b> Como no pedimos correo, no hay forma de recuperarla: si la olvidas, tendrás que crear otra cuenta.</span></p>` : ""}
      <label class="cta-check"><input type="checkbox" name="recordar"><span>Mantener la sesión abierta en este equipo <small>No lo marques si el computador es compartido.</small></span></label>
      <button class="btn" type="submit">${crear ? "Crear cuenta y entrar" : "Entrar"}</button>
      <div class="cta-msg" role="alert"></div>
    </form>
    ${crear ? "" : `<p class="bov-ayuda">¿Olvidaste la contraseña? No se puede recuperar porque no guardamos tu correo. Puedes <button type="button" class="linkbtn" data-modo="crear">crear una cuenta nueva</button> con otro seudónimo.</p>`}`;

  const form = el.querySelector(".cta-form");
  const campo = (n) => form.elements[n];
  const error = (n, texto) => {
    const p = el.querySelector(`#${id}-${n[0]}-err`);
    p.textContent = texto;
    p.hidden = !texto;
    campo(n).setAttribute("aria-invalid", String(!!texto));
  };

  el.querySelectorAll("[data-modo]").forEach((b) =>
    b.addEventListener("click", () => {
      const escrito = campo("seudonimo").value; // switching tabs keeps what was typed
      modo = b.dataset.modo;
      puertaCuenta(el, destino, alEntrar);
      el.querySelector('[name="seudonimo"]').value = escrito;
      el.querySelector(`[data-modo="${modo}"]`).focus();
    }),
  );

  const ver = el.querySelector(".cta-ver");
  ver.addEventListener("click", () => {
    const visible = campo("clave").type === "password";
    campo("clave").type = visible ? "text" : "password";
    ver.textContent = visible ? "Ocultar" : "Ver";
    ver.setAttribute("aria-pressed", String(visible));
    ver.setAttribute("aria-label", visible ? "Ocultar la contraseña" : "Mostrar la contraseña");
  });

  if (crear) {
    campo("clave").addEventListener("input", (e) => {
      const n = e.target.value.length;
      el.querySelector(`#${id}-c-ayuda`).textContent = !n
        ? `Al menos ${MIN_CLAVE} caracteres. Una frase de varias palabras es fácil de recordar y difícil de adivinar.`
        : n < MIN_CLAVE
          ? `Te faltan ${MIN_CLAVE - n} ${MIN_CLAVE - n === 1 ? "carácter" : "caracteres"}.`
          : "Longitud suficiente.";
      if (n >= MIN_CLAVE) error("clave", "");
    });
  }
  campo("seudonimo").addEventListener("input", () => error("seudonimo", ""));

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const seudonimo = campo("seudonimo").value.trim().replace(/\s+/g, " ");
    const clave = campo("clave").value;
    const msg = form.querySelector(".cta-msg");
    msg.textContent = "";
    // check here first: the answer is instant and names the field to fix
    let mal = "";
    if (!seudonimo) mal = "Escribe tu seudónimo.";
    else if (crear && !SEUDONIMO_OK.test(seudonimo)) mal = "Usa de 3 a 20 caracteres: letras, números, espacios, guiones o puntos.";
    error("seudonimo", mal);
    let malClave = "";
    if (!clave) malClave = "Escribe tu contraseña.";
    else if (crear && clave.length < MIN_CLAVE) malClave = `La contraseña debe tener al menos ${MIN_CLAVE} caracteres. Llevas ${clave.length}.`;
    error("clave", malClave);
    if (mal || malClave) return void campo(mal ? "seudonimo" : "clave").focus();

    const boton = form.querySelector('button[type="submit"]');
    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = crear ? "Creando tu cuenta…" : "Comprobando…";
    try {
      const r = await pedir(crear ? "/registro" : "/entrar", { cuerpo: { seudonimo, clave } });
      escribir({ ficha: r.ficha, seudonimo: r.seudonimo }, campo("recordar").checked);
      avisar();
      alEntrar();
    } catch (e) {
      boton.disabled = false;
      boton.textContent = texto;
      if (e.campo === "seudonimo" || e.campo === "clave") {
        error(e.campo, e.message);
        campo(e.campo).focus();
      } else {
        msg.innerHTML = `<p class="bov-nota error">${esc(e.message)}</p>`;
        if (e.estado === 401) campo("clave").select();
      }
    }
  });

  // do not steal focus on the first paint of the page; do it when the person just navigated here
  if (document.activeElement && document.activeElement !== document.body) campo("seudonimo").focus({ preventScroll: true });
}
