// Module: guia. "Guía rápida": the three operations a newsroom tries first (prepare a story about a
// province, compare two territories, look up a recent narrative), each with a real example and a
// button that takes you there, plus what to check before publishing and where to report a problem.

import { ICON } from "../ui.js";
import { navigate, viewEnabled } from "./nav.js";
import { abrirNota } from "./nota.js";
import { CORTE_FRASE } from "./datos.js";

let dlg = null;

const PASOS = [
  {
    id: "nota",
    ic: "pen",
    titulo: "Preparar una nota sobre una provincia",
    ejemplo: "Te llega un rumor de fraude que circula en Bolívar.",
    como: "Pulsa «Ideas para tu noticia», elige Bolívar y «Un rumor o video que está circulando». Te da por dónde empezar, de qué se habla hoy, por dónde llegar a la gente, datos con su fuente y qué no afirmar.",
    boton: "Probar con una provincia",
    accion: () => abrirNota(),
  },
  {
    id: "comparar",
    ic: "compare",
    titulo: "Comparar dos territorios",
    ejemplo: "Quieres contrastar Guayas con Pichincha antes de una cobertura nacional.",
    como: "En «Comparar provincias» eliges las dos. Ves la diferencia en cada factor y una frase lista para copiar.",
    boton: "Comparar Guayas y Pichincha",
    vista: "comparar",
    accion: () => navigate("comparar/Guayas/Pichincha"),
  },
  {
    id: "escucha",
    ic: "escucha",
    titulo: "Consultar una narrativa reciente",
    ejemplo: "Quieres saber de qué se habla hoy sobre las elecciones en Manabí.",
    como: "En «Escucha digital» tocas la provincia en el mapa. Ves los temas y actores más repetidos en X y medios de los últimos días, con enlaces a las publicaciones originales.",
    boton: "Ir a Escucha digital",
    vista: "asistente",
    accion: () => navigate("asistente"),
  },
];

const VERIFICA = [
  "Cita la fuente y la fecha de corte que acompañan cada dato (vienen incluidas al copiar).",
  "El índice describe condiciones del territorio: no prueba que en una provincia circule más desinformación.",
  "Si la provincia no tiene muestra propia (Galápagos, Napo, Pastaza, Zamora Chinchipe), sus cifras de opinión son el promedio del país.",
  "Escucha digital es una muestra pequeña de X y medios: sirve como pista para reportear, no como dato citable.",
  "El chat no está cifrado de extremo a extremo: no compartas ahí datos de tus fuentes.",
];

function crear() {
  dlg = document.createElement("dialog");
  dlg.id = "dlgGuia";
  dlg.className = "guia-dlg";
  dlg.setAttribute("aria-labelledby", "guiaTit");
  const pasos = PASOS.filter((p) => !p.vista || viewEnabled(p.vista));
  dlg.innerHTML = `
   <div class="guia-top"><p class="nota-sello">Guía rápida</p><button type="button" class="linkbtn" data-guia-cerrar>Cerrar ✕</button></div>
   <div class="guia-cuerpo">
    <h2 id="guiaTit" class="nota-h">Tres pruebas para empezar</h2>
    <p class="nota-sub">Lo que una redacción suele necesitar primero, con un ejemplo de cobertura real. Cada una toma menos de un minuto.</p>
    <ol class="guia-pasos">${pasos
      .map(
        (p, i) => `<li class="guia-paso">
       <span class="guia-n" aria-hidden="true">${i + 1}</span>
       <div><h3>${ICON[p.ic] ?? ""}${p.titulo}</h3>
        <p class="guia-ej"><b>Ejemplo:</b> ${p.ejemplo}</p>
        <p>${p.como}</p>
        <button type="button" class="btn gh" data-guia-paso="${p.id}">${p.boton} →</button></div>
      </li>`,
      )
      .join("")}</ol>
    <section class="guia-verifica"><h3>${ICON.check}Antes de publicar, verifica</h3><ul>${VERIFICA.map((t) => `<li>${t}</li>`).join("")}</ul></section>
    <p class="guia-corte">${CORTE_FRASE} Alcance: provincial, las 24 provincias. Las conversaciones de Escucha digital son de los últimos días.</p>
    <p class="guia-soporte">¿Algo no funcionó o no se entiende? <button type="button" class="linkbtn" data-retro="error">Reportar un error o duda</button>. Lo lee una persona del equipo.</p>
   </div>`;
  document.body.append(dlg);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-guia-cerrar]") || e.target.closest("[data-retro]")) return dlg.close();
    const b = e.target.closest("[data-guia-paso]");
    if (!b) return;
    const paso = PASOS.find((p) => p.id === b.dataset.guiaPaso);
    dlg.close();
    paso?.accion();
  });
}

export function abrirGuia() {
  if (!dlg) crear();
  if (!dlg.open) dlg.showModal();
}

/** Any [data-guia] on the page opens the guide (start screen, footer). */
export function initGuia() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-guia]")) abrirGuia();
  });
}
