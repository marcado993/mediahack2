// Module: chat. Temporary, anonymous chat rooms inside OVADE: one general room and one per province.
// Messages live 30 minutes on the server's memory and are never stored. Each connection gets a
// temporary name from the server. Text is always inserted as text (never as HTML).

import { API_BASE } from "../api.js";
import { ICON } from "../ui.js";
import { E } from "./estado.js";
import { $ } from "./util.js";

const slug = (t) =>
  String(t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const salaDe = (provincia) => slug(provincia);

const COLORES = ["#1a5fb4", "#a8327d", "#0e8a96", "#6b3fa0", "#b15c00", "#1b6e1b", "#c1121f", "#3d5a80"];
const color = (nombre) => COLORES[[...nombre].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length];
const hora = (ts) => new Date(ts * 1000).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

let ws = null;
let sala = "general";
let yo = "";
let maximo = 280;
let abierto = false; // the view is on screen
let intento = 0;
let timerPing = 0;
let timerReconectar = 0;
let timerSalas = 0;
let listo = false;

const nombreGuardado = () => {
  try {
    return sessionStorage.getItem("ovade.chat.nombre") || "";
  } catch (_) {
    return "";
  }
};
const guardarNombre = (n) => {
  try {
    sessionStorage.setItem("ovade.chat.nombre", n);
  } catch (_) {}
};

const urlWs = (id) => {
  const n = nombreGuardado();
  return `${API_BASE.replace(/^http/, "ws")}/ws/chat/${id}${n ? `?n=${encodeURIComponent(n)}` : ""}`;
};

function estado(texto, tono = "info") {
  const e = $("chatEstado");
  e.textContent = texto;
  e.dataset.tono = tono;
}

function cercaDelFinal(log) {
  return log.scrollHeight - log.scrollTop - log.clientHeight < 90;
}

function lineaMensaje(m) {
  const li = document.createElement("li");
  li.className = "chat-msg" + (m.n === yo ? " mia" : "");
  const cab = document.createElement("div");
  cab.className = "chat-meta";
  const nom = document.createElement("b");
  nom.textContent = m.n === yo ? `${m.n} (tú)` : m.n;
  nom.style.color = color(m.n);
  const h = document.createElement("time");
  h.textContent = hora(m.ts);
  cab.append(nom, h);
  const txt = document.createElement("p");
  txt.textContent = m.x;
  li.append(cab, txt);
  return li;
}

function lineaSistema(texto) {
  const li = document.createElement("li");
  li.className = "chat-sys";
  li.textContent = texto;
  return li;
}

function pintarVacio() {
  const log = $("chatLog");
  if (log.querySelector(".chat-msg") || log.querySelector(".chat-vacio")) return;
  const li = document.createElement("li");
  li.className = "chat-vacio";
  li.innerHTML = `<span>${ICON.chat}</span><p><b>Aún no hay mensajes en esta sala.</b><br>Escribe el primero abajo.</p>`;
  log.prepend(li);
}

function agregar(m) {
  const log = $("chatLog");
  log.querySelector(".chat-vacio")?.remove();
  const abajo = cercaDelFinal(log);
  log.append(lineaMensaje(m));
  while (log.children.length > 200) log.firstChild.remove();
  if (abajo || m.n === yo) log.scrollTop = log.scrollHeight;
  else $("chatNuevos").hidden = false;
}

function aviso(texto) {
  const log = $("chatLog");
  log.append(lineaSistema(texto));
  log.scrollTop = log.scrollHeight;
}

function enLinea(n) {
  $("chatN").textContent = n === 1 ? "1 persona en la sala" : `${n} personas en la sala`;
}

function poblarSalas(conteos = []) {
  const sel = $("chatSala");
  const cuenta = Object.fromEntries(conteos.map((s) => [s.id, s.en_linea]));
  const opciones = [["general", "General"], ...E.PROVINCIAS.map((p) => [slug(p), p])];
  const actual = sala;
  sel.innerHTML = opciones.map(([id, nombre]) => `<option value="${id}">${nombre}${cuenta[id] ? ` · ${cuenta[id]} en línea` : ""}</option>`).join("");
  sel.value = actual;
}

async function refrescarSalas() {
  try {
    const r = await fetch(`${API_BASE}/api/chat/salas`);
    if (r.ok) poblarSalas((await r.json()).salas);
  } catch (_) {}
}

function limpiarTimers() {
  clearInterval(timerPing);
  clearTimeout(timerReconectar);
}

function cerrarSocket() {
  limpiarTimers();
  if (ws) {
    ws.onclose = ws.onmessage = ws.onerror = ws.onopen = null;
    try {
      ws.close();
    } catch (_) {}
    ws = null;
  }
}

function conectar(id) {
  cerrarSocket();
  sala = id;
  $("chatSala").value = id;
  $("chatTitulo").textContent = id === "general" ? "Sala general" : `Sala de ${$("chatSala").selectedOptions[0]?.textContent.split(" · ")[0] ?? id}`;
  $("chatLog").replaceChildren();
  $("chatNuevos").hidden = true;
  $("chatEnviar").disabled = true;
  $("chatTexto").disabled = true;
  estado("Conectando…", "info");
  let socket;
  try {
    socket = new WebSocket(urlWs(id));
  } catch (_) {
    estado("No se pudo conectar", "error");
    return;
  }
  ws = socket;
  socket.onopen = () => {
    intento = 0;
    clearInterval(timerPing);
    timerPing = setInterval(() => socket.readyState === 1 && socket.send(JSON.stringify({ t: "ping" })), 25000);
  };
  socket.onmessage = (ev) => {
    let d;
    try {
      d = JSON.parse(ev.data);
    } catch (_) {
      return;
    }
    if (d.t === "hola") {
      yo = d.yo;
      maximo = d.max || 280;
      guardarNombre(yo);
      $("chatYo").textContent = yo;
      $("chatTexto").maxLength = maximo;
      $("chatTtl").textContent = d.ttl;
      enLinea(d.n);
      estado("En línea", "ok");
      $("chatEnviar").disabled = false;
      $("chatTexto").disabled = false;
      const log = $("chatLog");
      log.replaceChildren(...(d.hist || []).map(lineaMensaje));
      if (!d.hist?.length) pintarVacio();
      log.scrollTop = log.scrollHeight;
    } else if (d.t === "msg") agregar(d);
    else if (d.t === "n") enLinea(d.n);
    else if (d.t === "aviso") aviso(d.x);
    else if (d.t === "error") {
      estado(d.x, "error");
      aviso(d.x);
      intento = 99; // do not retry a refusal
    }
  };
  socket.onclose = () => {
    if (!abierto || socket !== ws) return;
    $("chatEnviar").disabled = true;
    $("chatTexto").disabled = true;
    if (intento >= 99) return;
    estado("Sin conexión. Reintentando…", "warn");
    const espera = Math.min(15000, 1000 * 2 ** intento++);
    timerReconectar = setTimeout(() => abierto && conectar(sala), espera);
  };
}

function iniciarUna() {
  if (listo) return;
  listo = true;
  $("chatSala").onchange = (e) => {
    location.hash = e.target.value === "general" ? "#chat" : `#chat/${e.target.value}`;
  };
  $("chatForm").onsubmit = (e) => {
    e.preventDefault();
    const campo = $("chatTexto");
    const texto = campo.value.trim();
    if (!texto || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ t: "msg", x: texto }));
    campo.value = "";
    $("chatCuenta").textContent = `0/${maximo}`;
    campo.focus();
  };
  $("chatTexto").oninput = (e) => ($("chatCuenta").textContent = `${e.target.value.length}/${maximo}`);
  $("chatNuevos").onclick = () => {
    const log = $("chatLog");
    log.scrollTop = log.scrollHeight;
    $("chatNuevos").hidden = true;
  };
  $("chatLog").addEventListener("scroll", () => cercaDelFinal($("chatLog")) && ($("chatNuevos").hidden = true), { passive: true });
  $("chatIcono").innerHTML = ICON.chat;
}

/** Opens the chat view. `arg` is a room id or a province name from the address (#chat/Bolívar). */
export function abrirChat(arg) {
  iniciarUna();
  abierto = true;
  const id = arg ? slug(arg) : "general";
  const valida = id === "general" || E.PROVINCIAS.some((p) => slug(p) === id);
  const destino = valida ? id : "general";
  if (!$("chatSala").options.length) poblarSalas();
  if (!ws || sala !== destino) conectar(destino);
  clearInterval(timerSalas);
  refrescarSalas();
  timerSalas = setInterval(refrescarSalas, 30000);
}

/** Leaves the chat view: the connection is dropped (the room keeps its own recent messages). */
export function cerrarChat() {
  if (!abierto) return;
  abierto = false;
  cerrarSocket();
  clearInterval(timerSalas);
  intento = 0;
}
