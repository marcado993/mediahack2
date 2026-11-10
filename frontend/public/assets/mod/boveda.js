// Module: boveda. The vault view. Everything happens in this browser: files, notes, names and the
// password never reach the server. Keys live only in memory while the vault is open and are dropped
// on lock, when leaving the view, and after 5 minutes without activity.

import { ICON, esc } from "../ui.js";
import { $ } from "./util.js";
import * as A from "./boveda-almacen.js";
import * as C from "./boveda-cripto.js";

const INACTIVIDAD_MS = 5 * 60_000;
const MAX_ARCHIVO = 25 * 1024 * 1024;

let sesion = null;
let temporizador = 0;
let visible = false;

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
    if (visible) mostrarBoveda();
  }, INACTIVIDAD_MS);
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
      <label class="fld"><span>Contraseña</span><input id="p1" type="password" autocomplete="new-password" required></label>
      <label class="fld"><span>Repite la contraseña</span><input id="p2" type="password" autocomplete="new-password" required></label>
      <p class="bov-ayuda" id="fuerza" aria-live="polite"></p>
      <button class="btn" type="submit">${ICON.lock}Crear mi bóveda</button>
      <div id="msg"></div>
    </form>
    <h3 class="bov-sep">¿Ya tienes una?</h3>
    <p class="bov-ayuda">Importa un archivo <code>.boveda</code> que exportaste antes (también sirve el de Periodismo Seguro).</p>
    <label class="btn gh" for="importar">${ICON.download}Importar bóveda</label>
    <input id="importar" type="file" accept=".boveda,application/json" class="sr">
    <div id="msgImportar"></div>`;
  $("p1").addEventListener("input", (e) => ($("fuerza").textContent = e.target.value ? `Fortaleza: ${FORT[C.fortaleza(e.target.value)]}` : ""));
  importador(false);
  $("crear").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("msg");
    const clave = $("p1").value;
    if (clave !== $("p2").value) return void (msg.innerHTML = aviso("error", "Las contraseñas no coinciden."));
    if (C.fortaleza(clave) === "debil") return void (msg.innerHTML = aviso("error", "Esa contraseña es débil. Usa al menos 12 caracteres y varias palabras."));
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
    ${cabecera("Bóveda bloqueada")}
    <form id="abrir" class="bov-form">
      <label class="fld"><span>Contraseña</span><input id="p" type="password" autocomplete="current-password" required></label>
      <button class="btn" type="submit">${ICON.lock}Desbloquear</button>
      <div id="msg"></div>
    </form>
    <div class="bov-acciones">
      <label class="btn gh" for="importar">Importar otra bóveda</label>
      <input id="importar" type="file" accept=".boveda,application/json" class="sr">
      <button class="btn gh peligro" type="button" id="borrar">Borrar bóveda</button>
    </div>
    <div id="msgImportar"></div>`;
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
      $("msg").innerHTML = aviso("error", "Contraseña incorrecta.");
    }
  });
  const borrar = $("borrar");
  borrar.addEventListener("click", async () => {
    if (borrar.dataset.seguro !== "1") {
      borrar.dataset.seguro = "1";
      borrar.textContent = "Confirmar: borrar todo para siempre";
      return;
    }
    await A.borrarTodo();
    bloquearBoveda();
    mostrarBoveda();
  });
}

/* ---- open ---- */
async function vistaAbierta(cab) {
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
    <form id="formNota" class="bov-form bov-nota-form" hidden>
      <label class="fld"><span>Título</span><input id="notaTitulo" maxlength="80" autocomplete="off"></label>
      <label class="fld"><span>Nota</span><textarea id="notaTexto" rows="6" maxlength="20000"></textarea></label>
      <button class="btn" type="submit">Guardar cifrada</button>
    </form>
    <div id="msg"></div>
    <ul id="lista" class="bov-lista">${items.length ? "" : `<li class="bov-vacio">${ICON.lock}<p><b>Todavía no hay nada.</b><br>Añade un archivo o escribe una nota.</p></li>`}</ul>
    <h3 class="bov-sep">Opciones</h3>
    <div class="bov-acciones">
      <button class="btn gh" type="button" id="exportar">${ICON.download}Exportar bóveda</button>
      <button class="btn gh" type="button" id="cambiar">Cambiar contraseña</button>
    </div>
    <form id="formClave" class="bov-form" hidden>
      <label class="fld"><span>Contraseña actual</span><input id="cActual" type="password" autocomplete="current-password"></label>
      <label class="fld"><span>Contraseña nueva</span><input id="cNueva" type="password" autocomplete="new-password"></label>
      <button class="btn" type="submit">Cambiar</button>
    </form>
    <p class="bov-ayuda">Exportar guarda un archivo <code>.boveda</code> que sigue cifrado: es tu copia de seguridad, o sirve para abrirla en otro navegador. Los tamaños de los archivos no se ocultan.</p>`;

  const lista = $("lista");
  for (const item of items) {
    const esNota = item.tipo === "nota";
    const li = document.createElement("li");
    li.className = "bov-item";
    li.innerHTML = `<div class="bov-item-t"><p class="bov-nombre">${esc(item.nombre)}</p><p class="bov-meta">${esNota ? "Nota" : "Archivo"} · ${tam(item.tam)} · ${fecha(item.creado ?? 0)}</p></div>
      <div class="bov-item-a"><button class="btn gh" type="button" data-accion="${esNota ? "ver" : "bajar"}">${esNota ? "Ver" : ICON.download + "Descargar"}</button><button class="btn gh peligro" type="button" data-accion="borrar">Borrar</button></div>
      <div class="bov-ver" data-nota hidden></div>`;
    lista.append(li);
    li.addEventListener("click", async (ev) => {
      const boton = ev.target.closest("button[data-accion]");
      if (!boton) return;
      vigilar();
      const accion = boton.dataset.accion;
      try {
        if (accion === "borrar") {
          if (boton.dataset.seguro !== "1") {
            boton.dataset.seguro = "1";
            boton.textContent = "Confirmar";
            return;
          }
          await A.borrarObjeto(item.id);
          return vistaAbierta(cab);
        }
        const datos = await C.descifrarArchivo(sesion, await A.leerDatos(item.id));
        if (accion === "bajar") descargar(item.nombre, datos);
        else {
          const caja = li.querySelector("[data-nota]");
          caja.hidden = !caja.hidden;
          caja.replaceChildren(Object.assign(document.createElement("pre"), { textContent: new TextDecoder().decode(datos) }));
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
    await vistaAbierta(cab);
    if (fallos) $("msg").innerHTML = aviso("error", `${fallos} no se pudo guardar. Cada archivo puede pesar hasta 25 MB.`);
  });

  $("nuevaNota").addEventListener("click", () => {
    $("formNota").hidden = false;
    $("notaTitulo").focus();
  });
  $("formNota").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    vigilar();
    const texto = $("notaTexto").value;
    if (!texto.trim()) return void ($("msg").innerHTML = aviso("error", "Escribe algo en la nota."));
    await guardar($("notaTitulo").value.trim() || "Nota sin título", "nota", new TextEncoder().encode(texto));
    vistaAbierta(cab);
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
    const msg = $("msg");
    const nueva = $("cNueva").value;
    if (C.fortaleza(nueva) === "debil") return void (msg.innerHTML = aviso("error", "La contraseña nueva es débil. Usa al menos 12 caracteres y varias palabras."));
    msg.innerHTML = aviso("info", "Cambiando…");
    try {
      await A.guardarCabecera(await C.cambiarContrasena(cab, $("cActual").value, nueva));
      msg.innerHTML = aviso("ok", "Contraseña cambiada. Tus archivos no se tocaron.");
      $("formClave").hidden = true;
      ev.target.reset();
    } catch {
      msg.innerHTML = aviso("error", "La contraseña actual no es correcta.");
    }
  });
}
