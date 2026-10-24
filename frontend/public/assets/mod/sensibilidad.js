// Module: sensibilidad. How stable each province's position is.
//
// This is the noise scenario only: every score may move up to ±RUIDO points (the noise
// test documented in the methodology). The table of weights from 10 % to 20 %, removing
// weak variables and an alternative source is still being prepared, and says so.

import { esc, fmt } from "../ui.js";
import { E } from "./estado.js";
import { enc, esLimite, perfilColor, perfilPlano } from "./datos.js";

export const RUIDO = 2;

/** Best and worst position a province can hold if every score moves up to ±RUIDO. */
export function rangoPuesto(provincia) {
  const lista = (E.MAPA?.provincias ?? []).filter((p) => p.IVEI != null);
  const yo = lista.find((p) => p.provincia === provincia);
  if (!yo) return null;
  const otros = lista.filter((p) => p !== yo);
  const mejor = 1 + otros.filter((p) => p.IVEI - RUIDO > yo.IVEI + RUIDO).length;
  const peor = 1 + otros.filter((p) => p.IVEI + RUIDO > yo.IVEI - RUIDO).length;
  return { puesto: Math.round(yo.rank), mejor, peor };
}

export function textoRangoPuesto(provincia) {
  const r = rangoPuesto(provincia);
  if (!r) return "";
  return r.mejor === r.peor ? `Con ±${RUIDO} puntos de ruido, su puesto no cambia.` : `Con ±${RUIDO} puntos de ruido, su puesto puede ir del ${r.mejor} al ${r.peor}.`;
}

/** Same idea in a few words, for the line next to the position. */
export function rangoPuestoCorto(provincia) {
  const r = rangoPuesto(provincia);
  if (!r || r.mejor === r.peor) return "";
  return `con ±${RUIDO} puntos de ruido, del ${r.mejor} al ${r.peor}`;
}

export function sensibilidadHTML() {
  const filas = [...(E.MAPA?.provincias ?? [])].filter((p) => p.IVEI != null).sort((a, b) => a.rank - b.rank);
  if (!filas.length) return "";
  const cuerpo = filas
    .map((p) => {
      const r = rangoPuesto(p.provincia);
      const rango = r.mejor === r.peor ? "No cambia" : `${r.mejor} a ${r.peor}`;
      const amplio = r.peor - r.mejor >= 4;
      return `<tr><td style="font-weight:650"><a href="#perfil/${enc(p.provincia)}">${esc(p.provincia)}</a></td>
       <td class="num">${r.puesto}</td><td class="num">${fmt(p.IVEI)}</td>
       <td class="num">${rango}${amplio ? ' <span class="amp">amplio</span>' : ""}</td>
       <td><span class="pdot" style="background:${perfilColor(p.perfil)}"></span>${esc(perfilPlano(p.perfil))}</td>
       <td>${esLimite(p.provincia) ? '<span class="ptag pin">Puede cambiar</span>' : "Se mantiene"}</td></tr>`;
    })
    .join("");
  return `<div style="overflow:auto;max-height:560px"><table class="ftab sens"><thead><tr><th>Provincia</th><th class="num">Puesto</th><th class="num">Puntaje</th><th class="num">Puesto posible</th><th>Perfil</th><th>¿Cambia de perfil?</th></tr></thead><tbody>${cuerpo}</tbody></table></div>`;
}
