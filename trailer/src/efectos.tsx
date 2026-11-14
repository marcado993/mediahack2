// Newsroom effects used inside the scenes. Each one takes the local second at which it hits
// (chosen from the song's instruments by the scene) and animates from the current frame.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { B, C, L, PROV, T, coma } from "./base";

const useT = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return f / fps;
};
const prog = (t: number, a: number, d: number, e: (x: number) => number = Easing.out(Easing.cubic)) =>
  e(Math.max(0, Math.min(1, (t - a) / d)));

/** SVG filter for an inked, slightly rough edge (stamps). Render once per video. */
export const FiltroTinta: React.FC = () => (
  <svg width="0" height="0" style={{ position: "absolute" }}>
    <filter id="tinta">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="ruido" />
      <feDisplacementMap in="SourceGraphic" in2="ruido" scale="5" />
    </filter>
  </svg>
);

/** Yellow highlighter swept under the text from left to right, starting at `at`. */
export const Marcador: React.FC<{ at: number; dur?: number; children: React.ReactNode; color?: string }> = ({ at, dur = 0.35, children, color = C.marcador }) => {
  const p = prog(useT(), at, dur, Easing.inOut(Easing.quad));
  return (
    <span style={{ backgroundImage: `linear-gradient(${color}, ${color})`, backgroundRepeat: "no-repeat", backgroundPosition: "0 88%", backgroundSize: `${p * 100}% 42%`, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>
      {children}
    </span>
  );
};

/** Redaction bar over a piece of data; it is pulled away at `revela` to show what was under it. */
export const Censura: React.FC<{ revela: number; children: React.ReactNode }> = ({ revela, children }) => {
  const t = useT();
  const p = prog(t, revela, 0.22, Easing.in(Easing.cubic));
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ opacity: p > 0 ? 1 : 0 }}>{children}</span>
      <span style={{ position: "absolute", left: -6, right: -6, top: "8%", bottom: "4%", background: "#0b0f16", transformOrigin: "right center", transform: `scaleX(${1 - p})` }} />
    </span>
  );
};

/** Rubber stamp: falls turning, hits, stays with an inked edge. */
export const SelloTinta: React.FC<{ at: number; texto: string; rot?: number; size?: number; color?: string; style?: React.CSSProperties }> = ({ at, texto, rot = -10, size = 64, color = C.rojo, style }) => {
  const t = useT();
  if (t < at - 0.12) return null;
  const p = prog(t, at - 0.12, 0.12, Easing.in(Easing.quad));
  const rebote = t > at ? Math.exp(-(t - at) * 14) * Math.sin((t - at) * 40) * 0.04 : 0;
  return (
    <div style={{ position: "absolute", zIndex: 30, transform: `rotate(${rot + (1 - p) * -18}deg) scale(${2.6 - 1.6 * p + rebote})`, opacity: Math.min(1, p * 1.6), ...style }}>
      <div style={{ border: `${size * 0.09}px solid ${color}`, outline: `${size * 0.035}px solid ${color}`, outlineOffset: size * 0.08, padding: `${size * 0.12}px ${size * 0.35}px`, fontFamily: T, fontSize: size, color, letterSpacing: size * 0.05, lineHeight: 1, background: "rgba(255,255,255,.75)", filter: "url(#tinta)", whiteSpace: "nowrap" }}>
        {texto}
      </div>
    </div>
  );
};

/** TV lower third: navy band with a red tab, slides in from the left. */
export const Zocalo: React.FC<{ at: number; etiqueta: string; titulo: string; dato: string; style?: React.CSSProperties }> = ({ at, etiqueta, titulo, dato, style }) => {
  const t = useT();
  const a = prog(t, at, 0.3, Easing.out(Easing.exp));
  const b = prog(t, at + 0.12, 0.35, Easing.out(Easing.exp));
  if (t < at) return null;
  return (
    <div style={{ position: "absolute", left: 0, bottom: 70, zIndex: 35, fontFamily: B, ...style }}>
      <div style={{ display: "flex", alignItems: "stretch", clipPath: `inset(0 ${(1 - a) * 100}% 0 0)` }}>
        <div style={{ background: C.rojo, color: "#fff", fontFamily: T, fontSize: 30, padding: "14px 22px", display: "flex", alignItems: "center" }}>{etiqueta}</div>
        <div style={{ background: C.linea, color: "#fff", padding: "10px 30px 10px 24px", borderTop: `4px solid ${C.amarillo}` }}>
          <div style={{ fontFamily: T, fontSize: 40, lineHeight: 1.05 }}>{titulo}</div>
          <div style={{ fontSize: 22, fontWeight: 700, opacity: b, transform: `translateY(${(1 - b) * 10}px)` }}>{dato}</div>
        </div>
      </div>
    </div>
  );
};

const TITULARES = Object.values(PROV)
  .sort((a, b) => a.puesto - b.puesto)
  .map((p) => `${p.nombre.toUpperCase()} ${coma(p.ivei)} · ${p.nivel}`);

/** News crawl along the bottom with the real scores; it steps a little on each cymbal hit. */
export const Ticker: React.FC<{ at: number; pasos?: number[]; oscuro?: boolean }> = ({ at, pasos = [], oscuro = true }) => {
  const t = useT();
  if (t < at) return null;
  const entra = prog(t, at, 0.3);
  const n = pasos.filter((s) => s <= t).length;
  const x = (t - at) * 170 + n * 6;
  const texto = TITULARES.join("     ●     ");
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 58, zIndex: 36, display: "flex", background: oscuro ? "#0b0f16" : C.linea, transform: `translateY(${(1 - entra) * 60}px)`, borderTop: `3px solid ${C.rojo}` }}>
      <div style={{ background: C.rojo, color: "#fff", fontFamily: T, fontSize: 28, padding: "0 22px", display: "flex", alignItems: "center", zIndex: 2 }}>OVADE · 24 PROVINCIAS</div>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", whiteSpace: "nowrap", top: 12, left: 0, transform: `translateX(${-x}px)`, color: "#fff", fontFamily: B, fontWeight: 800, fontSize: 26, letterSpacing: 0.5 }}>
          {texto}     ●     {texto}
        </div>
      </div>
    </div>
  );
};

/** "EN VIVO" badge with a blinking dot. */
export const EnVivo: React.FC<{ at: number; style?: React.CSSProperties }> = ({ at, style }) => {
  const t = useT();
  if (t < at) return null;
  const e = prog(t, at, 0.25, Easing.out(Easing.back(2)));
  const punto = Math.floor((t - at) * 2) % 2 === 0;
  return (
    <div style={{ position: "absolute", zIndex: 30, display: "flex", alignItems: "center", gap: 10, background: C.rojo, color: "#fff", fontFamily: T, fontSize: 30, padding: "6px 16px", transform: `scale(${e})`, transformOrigin: "left center", ...style }}>
      <i style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", opacity: punto ? 1 : 0.25 }} />
      EN VIVO
    </div>
  );
};

/** Magnifying glass that lands on a point of an SVG drawing and enlarges what is under it.
 *  `contenido` is drawn twice: once as is (blurred when the glass is down) and once inside the lens. */
export const Lupa: React.FC<{ at: number; x: number; y: number; r?: number; zoom?: number; ancho: number; alto: number; contenido: React.ReactNode }> = ({ at, x, y, r = 120, zoom = 2.3, ancho, alto, contenido }) => {
  const t = useT();
  const baja = prog(t, at - 0.1, 0.1, Easing.in(Easing.quad));
  const en = t >= at - 0.1;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, filter: `blur(${baja * 3}px) saturate(${1 - baja * 0.5})`, opacity: 1 - baja * 0.25 }}>{contenido}</div>
      {en && (
        <>
          <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", overflow: "hidden", transform: `scale(${0.3 + 0.7 * baja})`, boxShadow: `0 0 0 9px ${C.linea}, 0 0 0 13px #fff, 10px 18px 30px rgba(0,0,0,.4)`, background: "#fff" }}>
            <div style={{ position: "absolute", left: r - x * zoom, top: r - y * zoom, width: ancho, height: alto, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>{contenido}</div>
          </div>
          <div style={{ position: "absolute", left: x + r * 0.62, top: y + r * 0.62, width: 26, height: r * 0.95, background: C.linea, borderRadius: 8, transform: `rotate(-45deg) scale(${baja})`, transformOrigin: "top center" }} />
        </>
      )}
    </div>
  );
};

/** Odometer: every digit rolls up into place; the higher digits turn less, like a counter. */
export const Odometro: React.FC<{ valor: number; at: number; dur?: number; size?: number; color?: string }> = ({ valor, at, dur = 0.9, size = 104, color = C.tinta }) => {
  const t = useT();
  const p = prog(t, at, dur, Easing.out(Easing.cubic));
  const texto = coma(valor);
  const alto = size * 1.05;
  return (
    <div style={{ display: "flex", fontFamily: T, fontSize: size, lineHeight: `${alto}px`, height: alto, overflow: "hidden", color }}>
      {texto.split("").map((ch, i) => {
        if (ch === ",") return <span key={i}>,</span>;
        const d = Number(ch);
        const vueltas = 3 - Math.min(2, i); // the units turn more
        const total = vueltas * 10 + d;
        const pos = total * p;
        return (
          <span key={i} style={{ display: "inline-block", height: alto, overflow: "hidden" }}>
            <span style={{ display: "flex", flexDirection: "column", transform: `translateY(${-(pos % 10) * alto - (pos >= total ? 0 : 0)}px)` }}>
              {Array.from({ length: 11 }, (_, k) => (
                <span key={k} style={{ height: alto }}>{k % 10}</span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Fine print-dot screen over dark scenes (newsprint), very subtle. */
export const Trama: React.FC<{ opacidad?: number }> = ({ opacidad = 0.08 }) => (
  <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: "radial-gradient(rgba(255,255,255,1) 0.9px, transparent 1.1px)", backgroundSize: "6px 6px", opacity: opacidad, mixBlendMode: "overlay" }} />
);

/** A pull-quote line typed letter by letter on the cymbal hits (a short burst per hit). */
export const escritoEnPlatillos = (texto: string, desde: number, platillos: number[], fin: number, t: number) => {
  const hits = platillos.filter((s) => s >= desde && s <= fin);
  if (!hits.length) return texto.slice(0, Math.max(0, Math.floor((t - desde) * 26)));
  const porGolpe = Math.ceil(texto.length / hits.length);
  let n = 0;
  for (const h of hits) {
    if (t < h) break;
    n += Math.min(porGolpe, Math.floor((t - h) / 0.018) + 1); // each burst types fast, ~55 letters/s
  }
  return texto.slice(0, Math.min(texto.length, n));
};

/** Rhythm-game targets, newsroom style: before each hit an approach ring closes onto the target
 *  and lands exactly on the hit (a kick or snare of the song); then a clean burst. Consecutive
 *  targets are joined by follow points that appear on the way. Navy and red, numbered. */
export type Objetivo = { at: number; x: number; y: number };
export const Objetivos: React.FC<{ puntos: Objetivo[]; r?: number; claro?: boolean; desde?: number }> = ({ puntos, r = 40, claro = false, desde = 1 }) => {
  const t = useT();
  const APROX = 0.75; // seconds the approach ring takes to close
  const tinta = claro ? "#fff" : C.linea;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 38 }}>
      {/* follow points between consecutive targets */}
      {puntos.slice(1).map((p, i) => {
        const a = puntos[i];
        const ini = Math.max(a.at - 0.1, p.at - APROX - 0.2);
        if (t < ini || t > p.at + 0.1) return null;
        const d = Math.hypot(p.x - a.x, p.y - a.y);
        const n = Math.max(2, Math.floor((d - 2 * r) / 34));
        return Array.from({ length: n }, (_, k) => {
          const f = (k + 1) / (n + 1);
          const aparece = ini + f * 0.3;
          const se = p.at - 0.1 + f * 0.15;
          const o = t < aparece ? 0 : t > se ? Math.max(0, 1 - (t - se) / 0.12) : 1;
          return <i key={`${i}-${k}`} style={{ position: "absolute", left: a.x + (p.x - a.x) * f - 4, top: a.y + (p.y - a.y) * f - 4, width: 8, height: 8, borderRadius: "50%", background: C.rojo, opacity: o * 0.85 }} />;
        });
      })}
      {puntos.map((p, i) => {
        const ini = p.at - APROX;
        if (t < ini || t > p.at + 0.45) return null;
        const pre = Math.min(1, (t - ini) / APROX); // 0 -> 1 as the ring closes
        const post = t > p.at ? (t - p.at) / 0.45 : 0;
        const anillo = r * (1 + 2.2 * (1 - pre));
        const entra = Math.min(1, (t - ini) / 0.18);
        return (
          <div key={i} style={{ position: "absolute", left: p.x, top: p.y, width: 0, height: 0 }}>
            {post === 0 && (
              <i style={{ position: "absolute", left: -anillo, top: -anillo, width: anillo * 2, height: anillo * 2, borderRadius: "50%", border: `4px solid ${C.rojo}`, opacity: entra * 0.9 }} />
            )}
            <div style={{ position: "absolute", left: -r, top: -r, width: 2 * r, height: 2 * r, borderRadius: "50%", border: `5px solid ${tinta}`, background: post ? "transparent" : claro ? "rgba(15,24,38,.35)" : "rgba(255,255,255,.55)", display: "grid", placeItems: "center", fontFamily: T, fontSize: r * 0.9, color: tinta, opacity: (post ? 1 - post : entra) * 0.95, transform: `scale(${post ? 1 + post * 0.6 : 0.85 + 0.15 * entra})` }}>
              {post ? "" : desde + i}
            </div>
            {post > 0 && <i style={{ position: "absolute", left: -r * 1.2, top: -r * 1.2, width: r * 2.4, height: r * 2.4, borderRadius: "50%", border: `3px solid ${C.amarillo}`, opacity: 1 - post, transform: `scale(${1 + post * 1.4})` }} />}
          </div>
        );
      })}
    </div>
  );
};

export { L };
