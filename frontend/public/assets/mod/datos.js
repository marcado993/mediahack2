// Module: datos. Part of the app.js split into native ES modules (no build step).

import { qualityBadge } from "../ui.js";
import { E } from "./estado.js";
import { provinceKey } from "./util.js";

export const enc = encodeURIComponent;

export const NAME_ALIASES = { "santo domingo": "santo domingo de los tsachilas" };

// Sequential single-hue ramp: light = fewer conditions for disinformation,
// dark = more. No traffic-light colours, nothing that shouts or stigmatises. RES (resilience) reads the
// opposite direction, so it gets the ramp reversed rather than the value
// inverted, which keeps the legend gradient itself green-first for RES too.
// Green -> yellow -> orange -> red: low to high. Lightness falls from yellow to dark red,
// so the order still reads for people who confuse red and green; the ranking numbers and
// the legend always travel with the colour.
export const RAMP = [
  [120, 200, 130],
  [170, 214, 120],
  [245, 224, 110],
  [243, 174, 70],
  [232, 120, 52],
  [200, 55, 45],
  [140, 25, 28],
];

// Layers where higher is better (capacity to verify, digital skills) read the other way round
export const GREEN = [...RAMP].reverse();

// ---------------------------------------------------------------------
// The six territorial profiles keep one fixed colour in every view. They sit
// outside the green-to-red range of the index on purpose, so a profile is
// never mistaken for a level of vulnerability.
// ---------------------------------------------------------------------
export const PERFILES = [
  { nombre: "Exclusión digital con carencia estructural", plano: "Poca conexión y muchas carencias", corto: "Poca conexión, carencias", color: "#693875" },
  { nombre: "Alta exposición con capacidad de filtro", plano: "Muy conectada y con capacidad de verificar", corto: "Conectada, verifica", color: "#40bf84" },
  { nombre: "Exposición alta sobre base estructural sólida", plano: "Muy conectada, con buena base social", corto: "Conectada, base sólida", color: "#bf9540" },
  { nombre: "Hiperexposición con baja resiliencia", plano: "Saturada de redes y sin herramientas de contraste", corto: "Saturada de redes", color: "#914650" },
  { nombre: "Carencia estructural y déficit de resiliencia", plano: "Muchas carencias y poca capacidad de contrastar", corto: "Carencias, poco contraste", color: "#4c29ae" },
  { nombre: "Perfil intermedio", plano: "Perfil intermedio", corto: "Intermedio", color: "#7d8a9c" },
];

export const perfilInfo = (nombre) => PERFILES.find((p) => p.nombre === nombre);

export const perfilPlano = (nombre) => perfilInfo(nombre)?.plano ?? nombre;

export const perfilColor = (nombre) => perfilInfo(nombre)?.color ?? "#cbd5e1";

// Cases the team found sitting close to the border between two profiles.
const PERFIL_LIMITE = ["pastaza", "bolivar", "el oro", "cotopaxi"];

export const esLimite = (provincia) => PERFIL_LIMITE.includes(provinceKey(provincia));

// ---------------------------------------------------------------------
// How firm is each figure? Census = complete count. Official surveys with a
// provincial sample = medium. Weak or imputed samples = low. The Latinobarómetro
// cut-offs are the working criterion and still pending confirmation against the
// microdata, so they live in one place.
// ---------------------------------------------------------------------
export const MUESTRA_DEBIL = 50;

const MUESTRA_ALTA = 100;

function solidez(source, nLb) {
  const s = source || "";
  if (/Censo/i.test(s)) return { nivel: "alta", texto: "Conteo completo del Censo: sin error muestral." };
  if (/TIC/i.test(s)) return { nivel: "baja", texto: "Encuesta nacional: no es representativa por provincia." };
  if (/ENEMDU/i.test(s)) return { nivel: "media", texto: "Encuesta oficial con representatividad provincial." };
  if (/Latinobar/i.test(s) || /IVD/i.test(s)) {
    if (nLb === 0) return { nivel: "baja", texto: "Provincia sin muestra propia: se usa el valor nacional." };
    if (nLb != null && nLb < MUESTRA_DEBIL) return { nivel: "baja", texto: `Muestra provincial débil: ${nLb} casos.` };
    return { nivel: "media", texto: nLb != null ? `Muestra provincial de ${nLb} casos.` : "Encuesta de opinión." };
  }
  return null;
}

export function solBadge(source) {
  const sol = solidez(source, E.SOL_NLB);
  return sol ? qualityBadge({ dataSourceQuality: sol.nivel, detail: sol.texto }) : "";
}

// ---------------------------------------------------------------------
// Navigation: every screen has a shareable address (#perfil/Guayas,
// #mapas/EXP, #comparar/Guayas/Pichincha) and the back button works.
// A view the outlet switched off falls back to the map instead of 404ing.
// ---------------------------------------------------------------------
export const VIEW_FLAG = {
  mapas: "vista_mapas",
  perfil: "vista_perfil",
  comparar: "vista_comparar",
  datos: "vista_datos",
  fuentes: "vista_fuentes",
  asistente: "vista_conversacion",
  meto: "vista_metodologia",
};

// Methodology, open data and sources: one section reached from the header
// button and the footer, with its own small navigation.
export const DATOS_VIEWS = ["meto", "datos", "fuentes"];

export const DATOS_LABEL = { meto: "Metodología y límites", datos: "Datos abiertos", fuentes: "Fuentes oficiales" };

export const CAPA_FLAG = { EXCLUSION: "capa_mecanismos", HIPEREXP: "capa_mecanismos", HABDIG: "capa_habilidades" };

// Plain language first. `tec` is the name the methodology uses; it only
// appears in the glossary, never as the label a journalist has to decode.
export const FACTORES = {
  IVEI: { que: "Resume los cuatro factores: qué tan fértil es el terreno para que la desinformación llegue y prospere.", lectura: "Más alto = terreno más fértil.", lg: ["menos vulnerable", "más vulnerable"], tec: "Índice de Vulnerabilidad Electoral Integrada (IVEI)" },
  EST: { que: "Pobreza, ruralidad, poca escolaridad y desconfianza en las instituciones: lo que deja a la gente sin respaldo para contrastar.", lectura: "Más alto = más carencias.", lg: ["menos carencias", "más carencias"], tec: "Vulnerabilidad estructural" },
  EXP: { que: "Cuánta gente se informa por redes y mensajería (Facebook, WhatsApp, TikTok), donde el contenido circula sin filtro editorial.", lectura: "Más alto = más gente expuesta.", lg: ["menos dependencia", "más dependencia"], tec: "Exposición informativa" },
  RES: { que: "Escolaridad, variedad de fuentes y conciencia de que circula información falsa.", lectura: "Más alto = más herramientas para verificar (mejor).", lg: ["menos capacidad", "más capacidad"], tec: "Resiliencia informativa" },
  PRE: { que: "Miedo al delito, percepción de fraude, narcotráfico y corrupción: el ambiente que hace más creíbles los rumores en una elección.", lectura: "Más alto = ambiente más tenso.", lg: ["más calmo", "más tenso"], tec: "Presión coyuntural" },
  EXCLUSION: { que: "Quién queda fuera de internet o sin habilidades digitales y depende del rumor y el boca a boca.", lectura: "Más alto = más gente sin conexión.", lg: ["menos gente sin conexión", "más gente sin conexión"], tec: "Exclusión digital" },
  HIPEREXP: { que: "Quién vive pegado a redes de circulación rápida y con poca capacidad de contrastar.", lectura: "Más alto = más saturación.", lg: ["menos saturación", "más saturación"], tec: "Hiperexposición digital" },
  HABDIG: { que: "Competencias digitales que la propia persona dice tener (MINTEL 2023, participación voluntaria: no representa a toda la provincia).", lectura: "Más alto = más competencia (mejor).", lg: ["menos competencia", "más competencia"] },
  PERFIL: { que: "Cada provincia pertenece a uno de seis tipos, según qué factor predomina. Los colores son fijos en todo el sitio y no indican nivel de vulnerabilidad.", lectura: "", lg: ["", ""] },
};

const BREVE = {
  IVEI: "Qué tan fértil es el terreno para la desinformación.",
  EST: "Pobreza, ruralidad, poca escuela y desconfianza.",
  EXP: "Cuánta gente se informa por redes y WhatsApp.",
  RES: "Escolaridad, fuentes variadas y conciencia del riesgo.",
  PRE: "Miedo, fraude percibido, narco y corrupción.",
  EXCLUSION: "Quién queda fuera de internet.",
  HIPEREXP: "Quién vive pegado a redes, sin filtro.",
  HABDIG: "Habilidades digitales que la gente dice tener.",
  PERFIL: "Seis tipos de provincia. Los colores no indican nivel.",
};

export const CAPA_DESC = Object.fromEntries(Object.keys(FACTORES).map((k) => [k, `${BREVE[k]} ${FACTORES[k].lectura}`.trim()]));

export const CAPA_LG = Object.fromEntries(Object.entries(FACTORES).map(([k, f]) => [k, f.lg]));

export const PERFIL_CAPA = { codigo: "PERFIL", nombre: "Tipos de provincia", color: "#5b6b7f" };

// Only the provinces with enough on-map room to fit a label without
// crowding a small neighbor - same set as the reference observatory.
export const LABEL_PROVINCES = ["pichincha", "guayas", "manabi", "esmeraldas", "orellana", "sucumbios", "morona santiago", "loja"];

export const ETNIA_COLOR = {
  et_mestizo: "#4a6fa5",
  et_indigena: "#c4823a",
  et_montubio: "#5b9e79",
  et_afro: "#8c5aa8",
  et_blanco: "#98a5b5",
  et_otro: "#c9d2dc",
};

// One attribution for every copied text (sentence, paragraph, map quote, bullet).
export const FUENTE_OVADE = "Fuente: Observatorio de Vulnerabilidad ante la Desinformación Electoral.";

// What weighs most on a province: the two dimensions that sit furthest on the
// wrong side of the national average (for resilience, "wrong" means lower).
// Derived from the same numbers the map shows, never written by hand.
export const DRIVER_MIN = 3;

const PERFIL_SECCIONES = [
  ["esencial", "Lo esencial"],
  ["reportear", "Para reportear"],
  ["diagnostico", "Por qué tiene este nivel"],
  ["digital", "Perfil digital"],
  ["dieta", "Dieta informativa"],
  ["resiliencia", "Contraste y clima"],
  ["contexto", "Contexto social"],
];

// ---------------------------------------------------------------------
// "Qué puedes afirmar" vs "qué NO": one block, used on the home screen and
// in every province kit (where it also carries province-specific lines).
// ---------------------------------------------------------------------
export const SI_APOYA = [
  ["Priorizar verificaciones", "un rumor pesa más en una provincia vulnerable."],
  ["Elegir el canal", "sin conexión: radio local. Saturación de redes: plataformas y fuentes con credibilidad."],
  ["Revisar cómo se calcula", "todo es abierto."],
];

export const NO_APOYA = [
  "Decir si un contenido es verdadero o falso.",
  "Hablar de radio, TV o chats privados.",
  "Describir personas, candidatos o medios.",
  "Comparar con otros países o años sin anclaje.",
  "Bajar a cantón o parroquia: es deliberado.",
];

// Whether the reporter keeps "Investigar a fondo" open: a per-browser
// preference, so the deep-research user doesn't have to unfold it every time.
export const AFONDO_KEY = "ovade.afondo";

// ---------------------------------------------------------------------
// "Qué se está diciendo": the digital-listening summary inside the sheet.
// The index describes the terrain; this shows what is circulating now. They
// stay visibly separate: the conversation never enters any index.
// ---------------------------------------------------------------------
export const TEND_CACHE = new Map();

export const TEND_TTL = 5 * 60 * 1000;

// ---------------------------------------------------------------------
// Metodología: lo que el índice mide, qué tan firme es cada cifra y para qué
// decisión periodística sirve (y para cuál no).
// ---------------------------------------------------------------------
export const CORTE_FRASE = "Datos con corte a la última publicación de cada fuente (Censo 2022, ENEMDU 2024, Latinobarómetro 2024, MINTEL 2023), sujetos a actualización.";

export const SEIS_PREGUNTAS = [
  ["¿De dónde viene?", "Fuente, año, cobertura y fecha de corte.", "Censo 2022, ENEMDU 2024, módulo TIC 2024, Latinobarómetro 2024 y MINTEL 2023."],
  ["¿Por qué entra?", "Qué parte de la vulnerabilidad representa.", "Dos formas de llegar a la desinformación: quedar sin conexión (exclusión digital) o vivir saturado de redes (hiperexposición)."],
  ["¿Qué se transforma?", "Pasos desde el dato crudo hasta el puntaje.", "Suavizado bayesiano, posestratificación, normalización mín–máx y agregación geométrica."],
  ["¿Qué significa?", "Cómo leer un puntaje alto o bajo.", "Es un índice relativo entre provincias, no un nivel absoluto de desinformación."],
  ["¿Qué puede fallar?", "Riesgos y límites.", "Muestras débiles, valores imputados en cuatro provincias y una dieta informativa medida solo en su parte digital. Margen orientativo del índice: de ±5 a ±7 puntos."],
  ["¿Qué lo valida?", "Pruebas que respaldan el dato.", "Correlación de 0,92 con la ENEMDU y prueba de ruido de ±2 puntos. El orden de las provincias es estable sin el modulador (ρ = 0,99). Las pruebas de pesos, de variables débiles y de fuente alternativa están en curso."],
];

export const DECISIONES = [
  ["Dónde priorizar una verificación", "Sí. Si un contenido circula en una provincia con perfil vulnerable, sube de prioridad.", "No dice si el contenido es falso."],
  ["Por qué canal llegar", "Sí. Donde hay mucha gente sin conexión, hacen falta radio y aliados locales; donde hay saturación de redes, hacen falta redes y fuentes con credibilidad.", "No mide radio, televisión ni la conversación familiar."],
  ["A quién culpar o señalar", "No.", "El índice describe territorios, no personas."],
  ["Comparar con otro país o año", "No, sin fijar anclajes.", "Es un índice relativo."],
  ["Segmentar audiencias por debajo de la provincia", "No.", "La resolución provincial es una salvaguarda deliberada."],
];

export const GLOSARIO = [
  ["Nivel de vulnerabilidad", "IVEI", "Cuántos factores del territorio facilitan que la desinformación llegue y prospere, de 0 a 100. No mide a las personas ni cuánta desinformación circula."],
  ["Carencias de base", "vulnerabilidad estructural", FACTORES.EST.que],
  ["Dependencia de redes", "exposición informativa", FACTORES.EXP.que],
  ["Capacidad de contrastar", "resiliencia informativa", FACTORES.RES.que],
  ["Clima electoral", "presión coyuntural", FACTORES.PRE.que],
  ["Sin conexión", "exclusión digital", FACTORES.EXCLUSION.que],
  ["Saturación de redes", "hiperexposición digital", FACTORES.HIPEREXP.que],
  ["Puesto", "", "Lugar entre las 24 provincias. El puesto 1 es la más vulnerable."],
  ["Promedio del país", "valor nacional", "Referencia para saber si una cifra está por encima o por debajo de lo habitual."],
  ["Valor imputado", "", "Cuando una provincia no tiene encuestados, se usa el promedio del país en su lugar. En el mapa se marca con borde punteado."],
  ["Fuente sólida, media o débil", "solidez", "Qué tan firme es una cifra según cómo se midió: conteo completo (sólida), encuesta con muestra suficiente (media) o muestra débil (débil)."],
];

// Inline glossary: a short definition one tap away, without leaving the sheet.
export const GL_TERMS = {
  ivei: ["IVEI", "Índice de Vulnerabilidad Electoral Integrada. Va de 0 a 100 y dice qué tan fértil es el territorio para que la desinformación llegue y prospere. Describe territorios, no personas."],
  imputado: ["Valor imputado", GLOSARIO.find(([t]) => t === "Valor imputado")[2]],
  factor: ["Factor", "Cada uno de los cuatro bloques que forman el índice: carencias de base, dependencia de redes, capacidad de contrastar y clima electoral."],
};

// ---------------------------------------------------------------------
// Retroalimentación del medio: a one-tap «¿Te sirvió?» after copying, and a
// short form where the newsroom says what it needs. Both are tagged with the
// outlet (tenant) so each white-label client's needs can be read apart.
// ---------------------------------------------------------------------
export const OPINA_KEY = "ovade.opina";

export const MOTIVOS_RETRO = [
  ["falto_dato", "Faltó un dato"],
  ["dificil_entender", "Difícil de entender"],
  ["no_sirve_nota", "No encaja en mi nota"],
  ["error_dato", "Creo que hay un error"],
  ["otro", "Otro motivo"],
];

// ---------------------------------------------------------------------
// Home: the province list is always in view (left); the note kit, or the
// start pane when nothing is chosen, fills the right. Nothing is folded away.
// ---------------------------------------------------------------------
// Recently covered provinces: a journalist usually returns to the same few.
export const RECIENTES_KEY = "ovade_recientes";

export const SIN_RESULTADOS = "Prueba con el nombre oficial, como «Azuay» o «Santo Domingo de los Tsáchilas», o toca la provincia en el mapa.";

// ---------------------------------------------------------------------
// Help for each map layer: what it measures, which variables it uses (with
// their source), how it is built and how to read it. Mirrors the variable
// dictionary in "Fuentes oficiales" (08_diccionario_de_variables.csv).
// ---------------------------------------------------------------------
export const FUENTE_VAR = {
  C: ["Censo 2022", "#2a78d6"],
  E: ["ENEMDU 2024", "#eda100"],
  L: ["Latinobarómetro 2024", "#d03b3b"],
  T: ["ENEMDU-TIC 2024", "#1baf7a"],
  M: ["MINTEL 2023", "#7a4aa0"],
};

export const VARIABLES_CAPA = {
  EST: [["Pobreza por NBI (censal)", "C"], ["Población en área rural", "C"], ["Población de 65 años y más", "C"], ["Analfabetismo", "C"], ["Pobreza por ingresos", "E"], ["Pobreza extrema", "E"], ["Pobreza multidimensional", "E"], ["Pobreza por NBI", "E"], ["Coeficiente de Gini", "E"], ["Desconfianza en 9 instituciones", "L"]],
  EXP: [["Usó teléfono celular", "C"], ["Usó internet", "C"], ["Usa alguna red social", "L"], ["Usa Facebook, WhatsApp o TikTok", "L"], ["Uso de internet en 2024", "T"]],
  RES: [["Analfabetismo", "C"], ["Analfabetismo digital", "C"], ["Escolaridad promedio", "C"], ["Confianza interpersonal", "L"], ["Percibe información falsa en los medios", "L"], ["Número de plataformas que usa", "L"]],
  PRE: [["Autoubicación ideológica extrema", "L"], ["Cree que las elecciones son fraudulentas", "L"], ["Fue víctima de un delito en 12 meses", "L"], ["Teme ser víctima de delito violento", "L"], ["Considera muy grave el narcotráfico", "L"], ["Percepción de corrupción", "L"]],
  EXCLUSION: [["Población de 65 años y más", "C"], ["Usó teléfono celular", "C"], ["Usó internet", "C"], ["Analfabetismo", "C"], ["Analfabetismo digital", "C"], ["Población en área rural", "C"]],
  HIPEREXP: [["Usó internet", "C"], ["Percibe información falsa en los medios", "L"], ["Usa Facebook, WhatsApp o TikTok", "L"], ["Usa alguna red social", "L"], ["Usa WhatsApp", "L"]],
  HABDIG: [["Competencias digitales que la persona dice tener (31 preguntas Sí/No)", "M"]],
};

const ESCALA = "Cada variable se lleva a una escala de 0 a 100 entre provincias (la menor = 0, la mayor = 100) y se combinan en un solo valor. Las cifras de encuesta se suavizan antes hacia el promedio del país para que una muestra chica no dispare el resultado.";

export const CALCULO_CAPA = {
  IVEI: "Combina tres factores con una media geométrica: carencias de base, dependencia de redes y la falta de capacidad de contrastar. El clima electoral ajusta el resultado hasta ±7,5 %. Un factor muy bajo no se compensa del todo con otro alto.",
  EST: `${ESCALA} El índice de pobreza de la fase 1 (ENEMDU y desconfianza) pesa 60 %; el resto sale del Censo.`,
  EXP: ESCALA,
  RES: `${ESCALA} En el índice entra al revés: menos capacidad de contrastar suma vulnerabilidad.`,
  PRE: `${ESCALA} No entra como factor completo: solo ajusta el índice hasta ±7,5 %.`,
  EXCLUSION: `${ESCALA} Se calcula aparte del índice y nunca se promedia con él: explica por qué una provincia puntúa como puntúa.`,
  HIPEREXP: `${ESCALA} Se calcula aparte del índice y nunca se promedia con él: explica por qué una provincia puntúa como puntúa.`,
  HABDIG: "Porcentaje de respuestas «Sí» en el bloque de competencias digitales, promediado por provincia. No entra a ningún índice.",
  PERFIL: "Cada provincia se asigna a un tipo según qué factores dominan en ella. No agrega variables nuevas: reordena las que ya están en el mapa.",
};

export const FALLA_FACTOR = {
  IVEI: "Muestras débiles, valores imputados en cuatro provincias y una dieta informativa medida solo en su parte digital. Margen orientativo de ±5 a ±7 puntos.",
  EST: "Mezcla un conteo completo (Censo) con una pregunta de opinión (desconfianza en las instituciones) que depende de muestras pequeñas por provincia.",
  EXP: "Mide solo la dieta digital: las bases no preguntan por televisión, radio, prensa ni conversaciones familiares.",
  RES: "Capta solo la capacidad de contraste digital y educativa. En las cuatro provincias sin muestra propia, la parte de opinión usa el promedio del país.",
  PRE: "Es el factor con datos más frágiles a nivel provincial: viene del Latinobarómetro, con muestras pequeñas.",
  EXCLUSION: "Sale completo del Censo 2022, sin error muestral, pero refleja la situación de hace dos años.",
  HIPEREXP: "Cuatro de sus cinco variables vienen del Latinobarómetro, con muestras pequeñas por provincia.",
  HABDIG: "Encuesta voluntaria de 428 personas: 7 provincias no tienen respuestas y varias tienen menos de 10. No representa a la provincia.",
  PERFIL: "Las provincias marcadas como caso limítrofe pueden cambiar de tipo con ajustes menores del método.",
};
