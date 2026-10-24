// Module: formularios. Part of the app.js split into native ES modules (no build step).

import { postJSON } from "../api.js";
import { flag, tenant } from "../tenant.js";
import { esc } from "../ui.js";
import { E } from "./estado.js";
import { $ } from "./util.js";
import { byKey } from "./mapa.js";
import { MOTIVOS_RETRO, OPINA_KEY } from "./datos.js";

// ---------------------------------------------------------------------
// Solicitar información al observatorio
// ---------------------------------------------------------------------
export function initSolicitud() {
  const dlg = $("dlgSolicitud");
  const form = $("formSolicitud");
  const sel = $("solProvincia");
  sel.innerHTML = `<option value="">Todo el país</option>` + E.PROVINCIAS.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");

  const open = () => {
    $("solOk").hidden = true;
    form.hidden = false;
    $("solErr").textContent = "";
    sel.value = E.currentView === "perfil" && E.perfilActual ? E.perfilActual : "";
    dlg.showModal();
    $("solNombre").focus();
  };
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-solicitar]")) open();
    if (e.target.closest("[data-cerrar-solicitud]")) dlg.close();
  });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const send = $("solEnviar");
    send.disabled = true;
    send.textContent = "Enviando…";
    $("solErr").textContent = "";
    const v = (id) => $(id).value;
    try {
      await postJSON("/api/solicitudes", {
        nombre: v("solNombre"),
        correo: v("solCorreo"),
        organizacion: v("solOrg"),
        provincia: sel.value,
        necesidad: v("solNecesidad"),
        uso: v("solUso"),
        medio: tenant().slug,
        web: v("solWeb"),
      });
      form.hidden = true;
      form.reset();
      $("solOk").hidden = false;
      $("solCerrarOk").focus();
    } catch (err) {
      $("solErr").textContent = err.status ? err.message : "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.";
    } finally {
      send.disabled = false;
      send.textContent = "Enviar solicitud";
    }
  };
}

// Ask at most once per kind of copy per session, and stop after two dismissals:
// a reporter on deadline must never feel interrogated.
function opinaEstado() {
  try {
    return JSON.parse(sessionStorage.getItem(OPINA_KEY)) || { vistos: [], cerrados: 0 };
  } catch (_) {
    return { vistos: [], cerrados: 0 };
  }
}

function opinaGuardar(st) {
  try {
    sessionStorage.setItem(OPINA_KEY, JSON.stringify(st));
  } catch (_) {}
}

function opinaOcultar(ms = 0) {
  clearTimeout(E.opinaTimer);
  E.opinaTimer = setTimeout(() => ($("opina").hidden = true), ms);
}

async function enviarRetro(datos) {
  return postJSON("/api/retroalimentacion", { medio: tenant().slug, web: "", ...datos });
}

export function pedirOpinion(contexto) {
  if (!flag("retroalimentacion")) return;
  const st = opinaEstado();
  if (st.vistos.includes(contexto) || st.cerrados >= 2) return;
  st.vistos.push(contexto);
  opinaGuardar(st);
  const provincia = E.currentView === "perfil" ? E.perfilActual || "" : E.mapSel ? byKey()[E.mapSel]?.provincia || "" : "";
  const box = $("opina");
  const base = { tipo: "uso", contexto, provincia };
  const gracias = (msg) => {
    box.innerHTML = `<p class="op-q">${msg}</p>`;
    opinaOcultar(2600);
  };
  const fallo = () => gracias("No pudimos enviar tu opinión. Tu texto ya está copiado.");

  box.innerHTML = `<p class="op-q">¿Te sirvió lo que copiaste?</p>
   <div class="op-acts"><button type="button" class="copybtn" data-op="si">Sí</button><button type="button" class="copybtn" data-op="no">No del todo</button>
   <button type="button" class="op-x" data-op="x" aria-label="Cerrar sin responder">×</button></div>`;
  box.hidden = false;
  opinaOcultar(12000);

  box.onmouseenter = box.onfocusin = () => clearTimeout(E.opinaTimer);
  box.onclick = async (e) => {
    const op = e.target.closest("[data-op]")?.dataset.op;
    if (!op) return;
    if (op === "x") {
      st.cerrados++;
      opinaGuardar(st);
      return opinaOcultar();
    }
    if (op === "si") {
      try {
        await enviarRetro({ ...base, util: true });
        gracias("Gracias. Nos ayuda a saber qué sirve en una redacción.");
      } catch (_) {
        fallo();
      }
      return;
    }
    if (op === "no") {
      clearTimeout(E.opinaTimer);
      box.innerHTML = `<p class="op-q">¿Qué faltó?</p>
       <div class="op-mot" role="group" aria-label="Motivo">${MOTIVOS_RETRO.map(([v, l]) => `<button type="button" class="copybtn" aria-pressed="false" data-mot="${v}">${l}</button>`).join("")}</div>
       <label class="sr" for="opCom">Comentario opcional</label>
       <textarea id="opCom" rows="2" maxlength="600" placeholder="Opcional: cuéntanos qué esperabas"></textarea>
       <div class="op-acts"><button type="button" class="btn" data-op="enviar">Enviar</button>${flag("retroalimentacion") ? `<button type="button" class="linkbtn" data-retro>Contarnos más sobre tu medio</button>` : ""}
       <button type="button" class="op-x" data-op="x" aria-label="Cerrar sin responder">×</button></div>`;
      box.querySelectorAll("[data-mot]").forEach(
        (b) =>
          (b.onclick = () => {
            box.querySelectorAll("[data-mot]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          })
      );
      box.querySelector("[data-mot]").focus();
      return;
    }
    if (op === "enviar") {
      const motivo = box.querySelector('[data-mot][aria-pressed="true"]')?.dataset.mot || "";
      try {
        await enviarRetro({ ...base, util: false, motivo, comentario: $("opCom").value.trim() });
        gracias("Gracias. Lo revisamos para mejorar la herramienta.");
      } catch (_) {
        fallo();
      }
    }
  };
}

export function initRetro() {
  const dlg = $("dlgRetro");
  const form = $("formRetro");
  const open = () => {
    $("retOk").hidden = true;
    form.hidden = false;
    $("retErr").textContent = "";
    opinaOcultar();
    dlg.showModal();
    $("retNombre").focus();
  };
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-retro]")) open();
    if (e.target.closest("[data-cerrar-retro]")) dlg.close();
  });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const send = $("retEnviar");
    send.disabled = true;
    send.textContent = "Enviando…";
    $("retErr").textContent = "";
    try {
      await enviarRetro({
        tipo: "medio",
        nombre: $("retNombre").value,
        organizacion: $("retOrg").value,
        rol: $("retRol").value,
        correo: $("retCorreo").value,
        modulos: [...form.querySelectorAll('[name="retMod"]:checked')].map((c) => c.value),
        necesidad: $("retNecesidad").value,
        valoracion: Number(form.querySelector('[name="retVal"]:checked')?.value) || null,
        web: $("retWeb").value,
      });
      form.hidden = true;
      form.reset();
      $("retOk").hidden = false;
      $("retCerrarOk").focus();
    } catch (err) {
      $("retErr").textContent = err.status ? err.message : "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.";
    } finally {
      send.disabled = false;
      send.textContent = "Enviar";
    }
  };
}
