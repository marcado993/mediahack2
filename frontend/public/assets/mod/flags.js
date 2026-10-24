// Module: flags. Part of the app.js split into native ES modules (no build step).

import { flag } from "../tenant.js";
import { E } from "./estado.js";
import { $ } from "./util.js";
import { navigate, showView, viewEnabled } from "./nav.js";
import { DATOS_VIEWS } from "./datos.js";
import { paintMap, renderCapas } from "./mapa.js";
import { renderPerfil } from "./kit.js";
import { renderInicio } from "./inicio.js";

// ---------------------------------------------------------------------
// Feature flags: everything an outlet can switch off is applied here, so
// the same code path serves the first load and the admin's live preview.
// ---------------------------------------------------------------------
function setHidden(id, hidden) {
  const el = $(id);
  if (el) el.hidden = hidden;
}

export function applyFlags() {
  document.querySelectorAll("header nav button").forEach((b) => (b.hidden = !viewEnabled(b.dataset.v)));
  document.querySelectorAll("[data-ir]").forEach((b) => (b.hidden = !viewEnabled(b.dataset.ir)));
  const primeraDatos = DATOS_VIEWS.find(viewEnabled);
  $("btnSobreDatos").hidden = !primeraDatos;
  if (primeraDatos) $("btnSobreDatos").dataset.ir = primeraDatos;
  setHidden("cardScatter", !flag("grafico_dispersion"));
  setHidden("buscador", !flag("buscador_provincia"));
  if (!E.perfilActual && $("perfil").querySelector(".inicio-main")) renderInicio();
  document.querySelectorAll("[data-solicitar]").forEach((b) => (b.hidden = !flag("solicitar_informacion")));
  document.querySelectorAll("[data-retro]").forEach((b) => (b.hidden = !flag("retroalimentacion")));
  if (!flag("retroalimentacion")) $("opina").hidden = true;
  if (E.MAPA) {
    renderCapas();
    paintMap();
  }
  if (E.PERFIL_DATA) renderPerfil(E.PERFIL_DATA);
  showView(E.currentView);
  if (!viewEnabled(E.currentView)) navigate("perfil", { replace: true });
}
