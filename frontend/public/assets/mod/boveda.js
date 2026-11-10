// Module: boveda. The vault view. Everything happens in this browser: files, notes, names and the
// password never reach the server. Keys live only in memory while the vault is open and are dropped
// on lock, when leaving the view, and after 5 minutes without activity (typing or clicking counts).
// Opening the view needs an account (mod/cuenta.js); the vault password is a second, separate secret.

import { ICON, esc } from "../ui.js";
import { $ } from "./util.js";
import * as A from "./boveda-almacen.js";
import * as C from "./boveda-cripto.js";
import { barraCuenta, puertaCuenta, sesion as sesionCuenta } from "./cuenta.js";

const INACTIVIDAD_MS = 5 * 60_000;
const MAX_ARCHIVO = 25 * 1024 * 1024;

let sesion = null;
let temporizador = 0;
let visible = false;
let escuchando = false;
let avisoBloqueo = ""; // why the vault is showing as locked, said once

const raiz = () => $("boveda");

export function bloquearBoveda() {
  sesion = null; // the keys are gone: without the password there is no way back in
  clearTimeout(temporizador);
}

/** Leaving the view locks the vault. */
export function cerrarBoveda() {
  visible = false;
  bloquearBoveda();
}

function vigilar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    bloquearBoveda();
    avisoBloqueo = "Se bloqueó sola tras 5 minutos sin actividad. Tus archivos siguen aquí, cifrados.";
    if (visible) mostrarBoveda();
  }, INACTIVIDAD_MS);
}

/** Wired once: any typing or click inside the open vault restarts the 5-minute clock, so a long note is never lost. */
function escuchar() {
  if (escuchando) return;
  escuchando = true;
  for (const tipo of ["input", "keydown", "pointerdown"]) raiz().addEventListener(tipo, () => sesion && vigilar(), { passive: true });
  raiz().addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    const form = ev.target.closest("form[data-plegable]");
    if (form) plegar(form);
  });
  addEventListener("ovade:cuenta", () => {
    if (!visible) return;
    bloquearBoveda();
    mostrarBoveda();
  });
}

/** Closes an inline form (new note, change password) and gives focus back to the button that opened it. */
function plegar(form) {
  form.hidden = true;
  form.reset();
  $(form.dataset.plegable)?.focus();
}

/** Adds a "Ver / Ocultar" button to every password field in the view: a typo here cannot be recovered from. */
function ojos() {
  raiz().querySelectorAll('.bov-form input[type="password"]').forEach((campo) => {
    if (campo.closest(".cta-clave")) return;
    const caja = document.createElement("span");
    caja.className = "cta-clave";
    campo.replaceWith(caja);
    const boton = Object.assign(document.createElement("button"), { type: "button", className: "btn gh cta-ver", textContent: "Ver" });
    boton.setAttribute("aria-pressed", "false");
    boton.setAttribute("aria-label", "Mostrar la contraseña");
    boton.addEventListener("click", () => {
      const ver = campo.type === "password";
      campo.type = ver ? "text" : "password";
      boton.textContent = ver ? "Ocultar" : "Ver";
      boton.setAttribute("aria-pressed", String(ver));
      boton.setAttribute("aria-label", ver ? "Ocultar la contraseña" : "Mostrar la contraseña");
    });
    caja.append(campo, boton);
  });
}

/** A destructive button asks twice; the second step expires, so a stray click later does not delete anything. */
function pedirConfirmacion(boton, textoConfirmar) {
  if (boton.dataset.seguro === "1") return true;
  const original = boton.innerHTML;
  boton.dataset.seguro = "1";
  boton.textContent = textoConfirmar;
  setTimeout(() => {
    if (!boton.isConnected) return;
    boton.dataset.seguro = "";
    boton.innerHTML = original;
  }, 6000);
  return false;
}

const pieCuenta = '<div class="cta-barra bov-cuenta" id="bovCuenta"></div>';
function alPintar() {
  ojos();
  barraCuenta($("bovCuenta"));
}

const tam = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const fecha = (ms) => new Date(ms).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
const FORT = { debil: "Débil: usa al menos 12 caracteres y varias palabras", aceptable: "Aceptable", fuerte: "Fuerte" };
const aviso = (tipo, texto) => `<p class="bov-nota ${tipo}" role="${tipo === "error" ? "alert" : "status"}">${esc(texto)}</p>`;

function descargar(nombre, bytes, tipo = "application/octet-stream") {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Opens the vault view: create, unlock or show, depending on what this browser has. */
export async function mostrarBoveda() {
  visible = true;
  escuchar();
  if (!sesionCuenta()) {
    bloquearBoveda();
    return puertaCuenta(raiz(), "boveda", mostrarBoveda);
  }
  const cab = await A.leerCabecera();
  if (!cab) return vistaCrear();
  if (!sesion) return vistaBloqueada(cab);
  return vistaAbierta(cab);
}

const cabecera = (titulo, extra = "") => `<div class="bov-cab"><span class="bov-ic" aria-hidden="true">${ICON.lock}</span><div><h2 id="bovTitulo">${titulo}</h2>${extra}</div></div>`;

function importador(existe) {
  $("importar")?.addEventListener("change", async (ev) => {
    const archivo = ev.target.files[0];
    if (!archivo) return;
    const msg = $("msgImportar");
    if (existe && !confirm("Importar reemplaza la bóveda que hay en este navegador. ¿Continuar?")) {
      ev.target.value = "";
      return;
    }
    try {
      const { cabecera: cab, objetos } = C.desempaquetar(await archivo.text());
      await A.reemplazar(cab, objetos);
      bloquearBoveda();
      mostrarBoveda();
    } catch {
      msg.innerHTML = aviso("error", "Ese archivo no es una bóveda válida.");
    }
  });
}

/* ---- create ---- */
function vistaCrear() {
  raiz().innerHTML = `
    ${cabecera("Bóveda segura", '<p class="bov-sub">Guarda aquí tus notas, contactos y documentos del reporteo, cifrados en este equipo.</p>')}
    <ul class="bov-claves">
      <li>${ICON.check}<span>Se cifran en tu navegador. <b>Nada se envía a ningún servidor</b>, ni siquiera a OVADE.</span></li>
      <li>${ICON.check}<span>Sin tu contraseña nadie puede leerlos.</span></li>
      <li>${ICON.warn}<span>Si la olvidas, <b>no hay forma de recuperarlos</b>. Si borras los datos del navegador, también se pierden: exporta una copia.</span></li>
    </ul>
    <form id="crear" class="bov-form" novalidate>
      <p class="bov-ayuda"><b>Paso 2 de 2.</b> Ya entraste con tu cuenta. Ahora elige la contraseña de la bóveda: es distinta a la de tu cuenta a propósito, porque esta cifra tus archivos y nunca sale de este equipo.</p>
      <label class="fld"><span>Contraseña de la bóveda</span><input id="p1" type="password" autocomplete="new-password" required aria-describedby="fuerza"></label>
      <p class="bov-ayuda" id="fuerza" aria-live="polite">Al menos 12 caracteres. Varias palabras seguidas funcionan bien.</p>
      <label class="fld"><span>Repite la contraseña</span><input id="p2" type="password" autocomplete="new-password" required aria-describedby="coincide"></label>
      <p class="bov-ayuda" id="coincide" aria-live="polite"></p>
      <button class="btn" type="submit">${ICON.lock}Crear mi bóveda</button>
      <div id="msg"></div>
    </form>
    <h3 class="bov-sep">¿Ya tienes una?</h3>
    <p class="bov-ayuda">Importa un archivo <code>.boveda</code> que exportaste antes (también sirve el de Periodismo Seguro).</p>
    <label class="btn gh" for="importar">${ICON.download}Importar bóveda</label>
    <input id="importar" type="file" accept=".boveda,application/json" class="sr">
    <div id="msgImportar"></div>
    ${pieCuenta}`;
  alPintar();
  const coincide = () => {
    const a = $("p1").value;
    const b = $("p2").value;
    $("coincide").textContent = !b ? "" : a === b ? "Las dos coinciden." : "Todavía no coinciden.";
  };
  $("p1").addEventListener("input", (e) => {
    $("fuerza").textContent = e.target.value ? `Fortaleza: ${FORT[C.fortaleza(e.target.value)]}` : "Al menos 12 caracteres. Varias palabras seguidas funcionan bien.";
    coincide();
  });
  $("p2").addEventListener("input", coincide);
  importador(false);
  $("crear").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("msg");
    const clave = $("p1").value;
    if (C.fortaleza(clave) === "debil") {
      msg.innerHTML = aviso("error", "Esa contraseña es débil. Usa al menos 12 caracteres y varias palabras.");
      return void $("p1").focus();
    }
    if (clave !== $("p2").value) {
      msg.innerHTML = aviso("error", "Las dos contraseñas no coinciden. Pulsa «Ver» para compararlas.");
      return void $("p2").focus();
    }
    const boton = ev.target.querySelector("button");
    boton.disabled = true;
    msg.innerHTML = aviso("info", "Preparando la bóveda… tarda un momento a propósito, para frenar a quien intente adivinar la contraseña.");
    try {
      const { cabecera: cab, sesion: nueva } = await C.crearBoveda(clave);
      await A.guardarCabecera(cab);
      sesion = nueva;
      vigilar();
      mostrarBoveda();
    } catch {
      boton.disabled = false;
      msg.innerHTML = aviso("error", "No se pudo crear la bóveda en este navegador.");
    }
  });
}

/* ---- locked ---- */
function vistaBloqueada(cab) {
  raiz().innerHTML = `
    ${cabecera("Bóveda bloqueada", '<p class="bov-sub">Tus notas y archivos están en este equipo, cifrados. Escribe la contraseña de la bóveda (no la de tu cuenta).</p>')}
    ${avisoBloqueo ? aviso("info", avisoBloqueo) : ""}
    <form id="abrir" class="bov-form">
      <label class="fld"><span>Contraseña de la bóveda</span><input id="p" type="password" autocomplete="current-password" required></label>
      <button class="btn" type="submit">${ICON.lock}Desbloquear</button>
      <div id="msg"></div>
    </form>
    <div class="bov-acciones">
      <label class="btn gh" for="importar">Importar otra bóveda</label>
      <input id="importar" type="file" accept=".boveda,application/json" class="sr">
      <button class="btn gh peligro" type="button" id="borrar">Borrar bóveda</button>
    </div>
    <p class="bov-ayuda">¿Olvidaste la contraseña? No se puede recuperar. Puedes importar una copia que hayas exportado, o borrar esta bóveda y empezar otra.</p>
    <div id="msgImportar"></div>
    ${pieCuenta}`;
  avisoBloqueo = "";
  alPintar();
  $("p").focus();
  importador(true);
  $("abrir").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const boton = ev.target.querySelector("button");
    boton.disabled = true;
    $("msg").innerHTML = aviso("info", "Comprobando…");
    try {
      sesion = await C.abrirBoveda(cab, $("p").value);
      vigilar();
      mostrarBoveda();
    } catch {
      boton.disabled = false;
      $("msg").innerHTML = aviso("error", "Esa no es la contraseña de esta bóveda. Revisa mayúsculas y que no sea la de tu cuenta.");
      $("p").select();
    }
  });
  const borrar = $("borrar");
  borrar.addEventListener("click", async () => {
    if (!pedirConfirmacion(borrar, "Confirmar: borrar todo para siempre")) return;
    await A.borrarTodo();
    bloquearBoveda();
    mostrarBoveda();
  });
}

/* ---- open ---- */
async function vistaAbierta(cab, hecho = "") {
  const objetos = await A.listar();
  const items = [];
  let danados = 0;
  for (const o of objetos) {
    try {
      items.push({ ...o, ...(await C.descifrarMeta(sesion, o.meta)) });
    } catch {
      danados++;
    }
  }
  items.sort((a, b) => (b.creado ?? 0) - (a.creado ?? 0));

  raiz().innerHTML = `
    <div class="bov-arriba">${cabecera("Tu bóveda", `<p class="bov-sub">${items.length} ${items.length === 1 ? "elemento cifrado" : "elementos cifrados"}. Se bloquea sola a los 5 minutos sin actividad.</p>`)}
      <button class="btn gh" type="button" id="bloquear">${ICON.lock}Bloquear</button></div>
    ${danados ? aviso("error", `${danados} elemento(s) están dañados y no se pueden leer.`) : ""}
    <div class="bov-acciones">
      <label class="btn" for="archivos">${ICON.download}Añadir archivos</label>
      <input id="archivos" type="file" multiple class="sr">
      <button class="btn gh" type="button" id="nuevaNota">${ICON.pen}Nueva nota</button>
    </div>
    <form id="formNota" class="bov-form bov-nota-form" data-plegable="nuevaNota" hidden>
      <label class="fld"><span>Título (opcional)</span><input id="notaTitulo" maxlength="80" autocomplete="off"></label>
      <label class="fld"><span>Nota</span><textarea id="notaTexto" rows="6" maxlength="20000" aria-describedby="notaAyuda"></textarea></label>
      <p class="bov-ayuda" id="notaAyuda">Mientras escribes, la bóveda no se bloquea. Esc cancela.</p>
      <div class="bov-acciones"><button class="btn" type="submit">Guardar cifrada</button><button class="btn gh" type="button" data-cancelar>Cancelar</button></div>
    </form>
    <div id="msg" aria-live="polite">${hecho ? aviso("ok", hecho) : ""}</div>
    <ul id="lista" class="bov-lista">${items.length ? "" : `<li class="bov-vacio">${ICON.lock}<p><b>Todavía no hay nada.</b><br>Añade un archivo o escribe una nota.</p></li>`}</ul>
    <h3 class="bov-sep">Opciones</h3>
    <div class="bov-acciones">
      <button class="btn gh" type="button" id="exportar">${ICON.download}Exportar bóveda</button>
      <button class="btn gh" type="button" id="cambiar">Cambiar contraseña</button>
    </div>
    <form id="formClave" class="bov-form" data-plegable="cambiar" hidden>
      <label class="fld"><span>Contraseña actual de la bóveda</span><input id="cActual" type="password" autocomplete="current-password" required></label>
      <label class="fld"><span>Contraseña nueva</span><input id="cNueva" type="password" autocomplete="new-password" required aria-describedby="cAyuda"></label>
      <p class="bov-ayuda" id="cAyuda">Al menos 12 caracteres. No cambia la contraseña de tu cuenta.</p>
      <div class="bov-acciones"><button class="btn" type="submit">Cambiar contraseña</button><button class="btn gh" type="button" data-cancelar>Cancelar</button></div>
      <div id="msgClave" aria-live="assertive"></div>
    </form>
    <p class="bov-ayuda">Exportar guarda un archivo <code>.boveda</code> que sigue cifrado: es tu copia de seguridad, o sirve para abrirla en otro navegador. Los tamaños de los archivos no se ocultan.</p>
    ${pieCuenta}`;
  alPintar();
  raiz().querySelectorAll("[data-cancelar]").forEach((b) => b.addEventListener("click", () => plegar(b.closest("form"))));

  const lista = $("lista");
  for (const item of items) {
    const esNota = item.tipo === "nota";
    const li = document.createElement("li");
    li.className = "bov-item";
    li.innerHTML = `<div class="bov-item-t"><p class="bov-nombre">${esc(item.nombre)}</p><p class="bov-meta">${esNota ? "Nota" : "Archivo"} · ${tam(item.tam)} · ${fecha(item.creado ?? 0)}</p></div>
      <div class="bov-item-a"><button class="btn gh" type="button" data-accion="${esNota ? "ver" : "bajar"}"${esNota ? ' aria-expanded="false"' : ""}>${esNota ? "Ver" : ICON.download + "Descargar"}</button><button class="btn gh peligro" type="button" data-accion="borrar" aria-label="Borrar ${esc(item.nombre)}">Borrar</button></div>
      <div class="bov-ver" data-nota hidden></div>`;
    lista.append(li);
    li.addEventListener("click", async (ev) => {
      const boton = ev.target.closest("button[data-accion]");
      if (!boton) return;
      vigilar();
      const accion = boton.dataset.accion;
      try {
        if (accion === "borrar") {
          if (!pedirConfirmacion(boton, "¿Seguro? Borrar")) return;
          await A.borrarObjeto(item.id);
          return vistaAbierta(cab, `«${item.nombre}» se borró.`);
        }
        if (accion === "copiar") {
          await navigator.clipboard.writeText(li.querySelector("pre").textContent);
          boton.textContent = "Copiada ✓";
          return void setTimeout(() => boton.isConnected && (boton.textContent = "Copiar nota"), 1800);
        }
        const caja = li.querySelector("[data-nota]");
        if (accion === "ver" && !caja.hidden) {
          caja.hidden = true;
          caja.replaceChildren(); // the decrypted text does not stay in the page once hidden
          boton.textContent = "Ver";
          return void boton.setAttribute("aria-expanded", "false");
        }
        const datos = await C.descifrarArchivo(sesion, await A.leerDatos(item.id));
        if (accion === "bajar") {
          descargar(item.nombre, datos);
          $("msg").innerHTML = aviso("ok", `«${item.nombre}» se descargó descifrado. Esa copia ya no está protegida: bórrala cuando termines.`);
        } else {
          const copiar = Object.assign(document.createElement("button"), { type: "button", className: "btn gh", textContent: "Copiar nota" });
          copiar.dataset.accion = "copiar";
          caja.replaceChildren(Object.assign(document.createElement("pre"), { textContent: new TextDecoder().decode(datos), tabIndex: 0 }), copiar);
          caja.hidden = false;
          boton.textContent = "Ocultar";
          boton.setAttribute("aria-expanded", "true");
        }
      } catch {
        $("msg").innerHTML = aviso("error", "No se pudo leer ese elemento: está dañado o alterado.");
      }
    });
  }

  $("bloquear").addEventListener("click", () => {
    bloquearBoveda();
    mostrarBoveda();
  });

  async function guardar(nombre, tipo, bytes) {
    const meta = await C.cifrarMeta(sesion, { nombre: nombre.slice(0, 120), tipo, creado: Date.now() });
    await A.guardarObjeto({ id: C.nuevoId(), meta, bytes: await C.cifrarArchivo(sesion, bytes) });
  }

  $("archivos").addEventListener("change", async (ev) => {
    vigilar();
    const lote = [...ev.target.files];
    $("msg").innerHTML = aviso("info", `Cifrando ${lote.length} ${lote.length === 1 ? "archivo" : "archivos"}…`);
    let fallos = 0;
    for (const archivo of lote) {
      if (archivo.size > MAX_ARCHIVO) {
        fallos++;
        continue;
      }
      try {
        await guardar(archivo.name, "archivo", new Uint8Array(await archivo.arrayBuffer()));
      } catch {
        fallos++;
      }
    }
    const bien = lote.length - fallos;
    await vistaAbierta(cab, bien ? `${bien} ${bien === 1 ? "archivo guardado y cifrado" : "archivos guardados y cifrados"}. El original sigue en tu equipo sin cifrar: bórralo si es sensible.` : "");
    if (fallos) $("msg").insertAdjacentHTML("beforeend", aviso("error", `${fallos} no se ${fallos === 1 ? "pudo" : "pudieron"} guardar. Cada archivo puede pesar hasta 25 MB.`));
  });

  $("nuevaNota").addEventListener("click", () => {
    $("formNota").hidden = false;
    $("notaTitulo").focus();
  });
  $("formNota").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    vigilar();
    const texto = $("notaTexto").value;
    if (!texto.trim()) {
      $("msg").innerHTML = aviso("error", "La nota está vacía. Escribe algo antes de guardar.");
      return void $("notaTexto").focus();
    }
    try {
      await guardar($("notaTitulo").value.trim() || "Nota sin título", "nota", new TextEncoder().encode(texto));
    } catch {
      return void ($("msg").innerHTML = aviso("error", "No se pudo guardar la nota en este navegador. Tu texto sigue en el formulario: cópialo antes de salir."));
    }
    vistaAbierta(cab, "Nota guardada y cifrada.");
  });

  $("exportar").addEventListener("click", async () => {
    vigilar();
    const todo = [];
    for (const o of await A.listar()) todo.push({ id: o.id, meta: o.meta, datos: await A.leerDatos(o.id) });
    descargar(`boveda-ovade-${new Date().toISOString().slice(0, 10)}.boveda`, new TextEncoder().encode(C.empaquetar(cab, todo)), "application/json");
    $("msg").innerHTML = aviso("ok", "Exportada. El archivo sigue cifrado: guárdalo en un lugar seguro.");
  });

  $("cambiar").addEventListener("click", () => {
    $("formClave").hidden = false;
    $("cActual").focus();
  });
  $("formClave").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("msgClave");
    const nueva = $("cNueva").value;
    if (C.fortaleza(nueva) === "debil") {
      msg.innerHTML = aviso("error", "La contraseña nueva es débil. Usa al menos 12 caracteres y varias palabras.");
      return void $("cNueva").focus();
    }
    msg.innerHTML = aviso("info", "Cambiando…");
    try {
      const nuevaCab = await C.cambiarContrasena(cab, $("cActual").value, nueva);
      await A.guardarCabecera(nuevaCab);
      // repaint with the new header, so an export made right after uses the new password
      vistaAbierta(nuevaCab, "Contraseña de la bóveda cambiada. Tus archivos no se tocaron. Si tenías una copia exportada, sigue abriéndose con la contraseña anterior.");
    } catch {
      msg.innerHTML = aviso("error", "La contraseña actual no es correcta. No se cambió nada.");
      $("cActual").select();
    }
  });
}
