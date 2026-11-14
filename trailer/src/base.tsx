// Shared pieces of the trailer: identity, data, GSAP scrubbing, the beat clock and the music hook.
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import gsap from "gsap";
import datos from "./datos.json";
import mapa from "../musica/mapa.json";

export const C = {
  papel: "#ffffff",
  tinta: "#12161c",
  suave: "#394150",
  regla: "#cdd5e0",
  linea: "#1b2a41",
  noche: "#0f1826",
  rojo: "#d8132b",
  amarillo: "#ffc20e",
  marcador: "#ffd60a",
  gris: "#eef0f4",
  mapa: "#e9eef6",
  azulA: "#1f5fa8",
  naranjaB: "#e07b1a",
};
export const T = "Anton, Impact, sans-serif";
export const B = "'Public Sans', system-ui, sans-serif";
export const L = "'Source Serif 4', Georgia, serif";
export const RAMP = ["rgb(26,150,65)", "rgb(166,217,106)", "rgb(255,255,191)", "rgb(253,174,97)", "rgb(215,25,28)"];

export type Prov = { nombre: string; ivei: number; puesto: number; nivel: string; dims: number[] };
export const PROV = datos.prov as Record<string, Prov>;
export const PATHS = datos.paths as unknown as {
  width: number;
  height: number;
  insetSize: number;
  mainland: Record<string, string>;
  galapagos: Record<string, string>;
  centroids: Record<string, [number, number]>;
};
const vals = Object.values(PROV).map((p) => p.ivei);
const LO = Math.min(...vals);
const HI = Math.max(...vals);
export const colorDe = (v: number) => RAMP[Math.max(0, Math.min(4, Math.floor(((v - LO) / (HI - LO)) * 5)))];
export const coma = (n: number) => n.toFixed(1).replace(".", ",");
export const puntos = (color: string) => ({ backgroundImage: `radial-gradient(${color} 1.6px, transparent 1.7px)`, backgroundSize: "26px 26px" });

export const TRANS = 12; // frames each scene change overlaps; the change ends on the cut

// ---------------------------------------------------------------- GSAP, scrubbed by Remotion
type V = Record<string, number>;
/** Builds a paused GSAP timeline once; every frame seeks it and returns the tweened values. */
export function useTL<K extends string>(init: Record<K, number>, build: (tl: gsap.core.Timeline, v: Record<K, number>) => void): Record<K, number> {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = useMemo(() => {
    const v = { ...init };
    const tl = gsap.timeline({ paused: true });
    build(tl, v);
    return { tl, v };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  m.tl.seek(f / fps, false);
  return m.v;
}
/** One value per item, staggered: [0..1] each. */
export function useStagger(n: number, at: number, each: number, dur = 0.6, ease = "expo.out"): number[] {
  const init = Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 0])) as V;
  const v = useTL(init, (tl, o) => {
    for (let i = 0; i < n; i++) tl.to(o, { [`k${i}`]: 1, duration: dur, ease }, at + i * each);
  });
  return Array.from({ length: n }, (_, i) => v[`k${i}`]);
}

/** One-off hit for a click or a reveal: decaying shake + small zoom (separate CSS properties so it
 *  composes with an element's own transform). */
export const golpeDe = (t: number, momentos: number[], fuerza = 1) => {
  let k = 0;
  for (const m of momentos) if (t >= m) k = Math.max(k, Math.exp(-(t - m) * 12));
  k *= fuerza;
  return { scale: `${1 + 0.02 * k}`, translate: `${Math.sin(t * 90) * 7 * k}px ${Math.cos(t * 70) * 4 * k}px` } as React.CSSProperties;
};

// ---------------------------------------------------------------- the song, by instrument
export type Instrumentos = {
  bombo: [number, number][]; // [second, strength 0..1]
  caja: [number, number][];
  platillos: number[];
  voz: [number, number][]; // phrases [start, end]
  bajo: [number, number][]; // [bar start, level 0..1]
};
export type RitmoT = { gancho: number[]; cada: number; periodo: number; inst: Instrumentos };

/** Same lists for the original track, known by construction (musica/tema.py, 120 BPM). */
export const INST_ORIGINAL: Instrumentos = (() => {
  const bombo: [number, number][] = [0.15, 0.77, 1.39, 2.35].map((s) => [s, 1]);
  const caja: [number, number][] = [];
  for (let b = 8; b < 92; b++) {
    if (b % 4 === 0 || b % 4 === 2) bombo.push([b * 0.5, b % 4 === 0 ? 1 : 0.7]);
    if (b >= 14 && (b % 4 === 1 || b % 4 === 3)) caja.push([b * 0.5, 0.8]);
  }
  const platillos = Array.from({ length: 192 }, (_, i) => i * 0.25);
  return { bombo, caja, platillos, voz: [], bajo: [[0, 0.7]] };
})();
export const INST_CANCION = (mapa as unknown as { inst: Instrumentos }).inst;

export const Ritmo = React.createContext<RitmoT>({ gancho: [0.15, 0.77, 1.39, 2.35], cada: 10, periodo: 0.5, inst: INST_ORIGINAL });
/** Second (in the whole video) at which the current scene starts. */
export const InicioEscena = React.createContext(0);

/** b(k): local second of beat k in the current scene. A scene's change ends on its first beat
 *  (TRANS frames in), so beat 0 is at TRANS / 30. */
export const useB = () => {
  const { periodo } = React.useContext(Ritmo);
  return (k: number) => TRANS / 30 + k * periodo;
};

/** The song's instruments in this scene's local time, with helpers to ask for "the next snare
 *  after X" or "the voice phrase that starts around X". */
export const useMusica = () => {
  const { inst } = React.useContext(Ritmo);
  const t0 = React.useContext(InicioEscena);
  const loc = (s: number) => s - t0;
  const golpes = (nombre: "bombo" | "caja") => inst[nombre].map(([s, f]) => [loc(s), f] as [number, number]);
  return {
    /** next hit of an instrument at or after `desde` (within `ventana` s), else `desde` itself */
    proximo(nombre: "bombo" | "caja", desde: number, ventana = 0.45, minFuerza = 0) {
      const g = golpes(nombre).find(([s, f]) => s >= desde - 0.02 && s <= desde + ventana && f >= minFuerza);
      return g ? g[0] : desde;
    },
    /** the strongest hit of an instrument inside [a, b], else the middle */
    fuerte(nombre: "bombo" | "caja", a: number, b: number) {
      const g = golpes(nombre).filter(([s]) => s >= a && s <= b).sort((x, y) => y[1] - x[1])[0];
      return g ? g[0] : (a + b) / 2;
    },
    /** cymbal hits (local seconds) after `desde` */
    platillos(desde: number) {
      return inst.platillos.map(loc).filter((s) => s >= desde);
    },
    /** voice phrase starting in [a, b] -> [start, end] local, or null */
    frase(a: number, b: number): [number, number] | null {
      const p = inst.voz.map(([x, y]) => [loc(x), loc(y)] as [number, number]).find(([x]) => x >= a && x <= b);
      return p ?? null;
    },
    /** bass level of the bar in which the scene starts (0..1): sets how deep slow moves go */
    bajo() {
      const prev = inst.bajo.filter(([s]) => s <= t0 + 0.5).pop();
      return prev ? prev[1] : 0.7;
    },
  };
};
