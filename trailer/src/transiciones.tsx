// Eleven scene changes, one per cut, each in the language of a newsroom. Every one is a Remotion
// TransitionPresentation driven by presentationProgress (0..1), so it is deterministic. They all
// end on the cut, which sits on one of the song's strong accents.
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { C, T } from "./base";

type P = TransitionPresentationComponentProps<Record<string, never>>;
const hacer = (component: React.FC<P>) => (): TransitionPresentation<Record<string, never>> => ({ component, props: {} });
const ease = (p: number) => Easing.bezier(0.7, 0, 0.2, 1)(p);
const arriba = (z: number) => ({ zIndex: z }) as React.CSSProperties;

/** 1. Red iris: a red disc grows from the centre over the old scene, then opens onto the new one. */
const IrisRojo: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const r1 = interpolate(p, [0, 0.55], [0, 120], { extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const r2 = interpolate(p, [0.45, 1], [0, 120], { extrapolateLeft: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.rojo, clipPath: `circle(${r1}% at 50% 50%)` }} />
      <AbsoluteFill style={{ clipPath: `circle(${r2}% at 50% 50%)` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 2. Through the dot: the camera dives into the red dot of the logo and comes out in the app. */
const ZoomAtraves: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  const e = ease(p);
  if (presentationDirection === "exiting") {
    // the dot of the mark sits a little left of centre in the logo scene
    return (
      <AbsoluteFill style={{ ...arriba(2), transform: `scale(${1 + e * 14})`, transformOrigin: "30.5% 50%", opacity: p < 0.75 ? 1 : 1 - (p - 0.75) * 4 }}>{children}</AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ transform: `scale(${0.7 + 0.3 * e})`, filter: `blur(${(1 - e) * 14}px)` }}>{children}</AbsoluteFill>;
};

/** 3. Match cut into focus: the old scene keeps diving and blurs out; the new one pulls focus. */
const Enfoque: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  const e = ease(p);
  if (presentationDirection === "exiting") {
    return <AbsoluteFill style={{ transform: `scale(${1 + 0.6 * e})`, filter: `blur(${e * 24}px)`, opacity: 1 - e }}>{children}</AbsoluteFill>;
  }
  return <AbsoluteFill style={{ transform: `scale(${1.12 - 0.12 * e})`, filter: `blur(${(1 - e) * 24}px)`, opacity: e }}>{children}</AbsoluteFill>;
};

/** 4. Hard hit for the drop: white flash, the new scene punches in from a little bigger. */
const GolpeSeco: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  if (presentationDirection === "exiting") {
    return <AbsoluteFill style={{ transform: `scale(${1 + p * 0.5})`, filter: `brightness(${1 + p * 2})` }}>{children}</AbsoluteFill>;
  }
  const visible = p > 0.5;
  const q = (p - 0.5) * 2;
  return (
    <AbsoluteFill>
      {visible && <AbsoluteFill style={{ transform: `scale(${1.25 - 0.25 * Easing.out(Easing.cubic)(q)})` }}>{children}</AbsoluteFill>}
      <AbsoluteFill style={{ background: "#fff", opacity: p < 0.5 ? p * 2 : 1 - q }} />
    </AbsoluteFill>
  );
};

/** 5. Live signal: a few frames of broken broadcast (shifted bands, colour split, scan lines). */
const Senal: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  const g = Math.sin(p * Math.PI); // glitch amount, strongest in the middle
  const salto = (k: number) => Math.sin(p * 97 + k * 13) * 60 * g;
  const capa = (
    <AbsoluteFill style={{ transform: `translateX(${salto(1)}px) skewX(${salto(2) / 12}deg)`, filter: `drop-shadow(${10 * g}px 0 0 rgba(255,0,60,.7)) drop-shadow(${-10 * g}px 0 0 rgba(0,220,255,.7))` }}>{children}</AbsoluteFill>
  );
  if (presentationDirection === "exiting") return p < 0.5 ? capa : null;
  return (
    <AbsoluteFill>
      {p >= 0.5 && capa}
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 2px, transparent 2px 5px)", opacity: g }} />
      {[0, 1, 2].map((k) => (
        <div key={k} style={{ position: "absolute", left: 0, right: 0, top: `${(Math.abs(Math.sin(p * 31 + k * 7)) * 90).toFixed(1)}%`, height: 10 + k * 14, background: k === 1 ? C.rojo : "#fff", opacity: 0.55 * g, transform: `translateX(${salto(k + 3)}px)` }} />
      ))}
    </AbsoluteFill>
  );
};

/** 6. Diagonal split: the old scene breaks into two sheets that fly apart (anticipates "versus"). */
const Diagonal: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  if (presentationDirection === "entering") return <AbsoluteFill style={{ transform: `scale(${1.08 - 0.08 * ease(p)})` }}>{children}</AbsoluteFill>;
  // before the cut starts the old scene is whole (no seam, no red bar)
  if (p <= 0.001) return <AbsoluteFill>{children}</AbsoluteFill>;
  const e = Easing.in(Easing.cubic)(p) * 110;
  return (
    <AbsoluteFill style={arriba(2)}>
      <AbsoluteFill style={{ clipPath: "polygon(0 0, 62% 0, 38% 100%, 0 100%)", transform: `translate(${-e}%, ${-e * 0.3}%)` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ clipPath: "polygon(62% 0, 100% 0, 100% 100%, 38% 100%)", transform: `translate(${e}%, ${e * 0.3}%)` }}>{children}</AbsoluteFill>
      <div style={{ position: "absolute", left: "37%", top: "-10%", width: 22, height: "120%", background: C.rojo, transform: "rotate(13.5deg)", opacity: 1 - p }} />
    </AbsoluteFill>
  );
};

/** 7. Whip pan: both scenes rush sideways with motion blur. */
const Paneo: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  const e = ease(p);
  const blur = Math.sin(p * Math.PI) * 22;
  const x = presentationDirection === "exiting" ? -e * 100 : (1 - e) * 100;
  return <AbsoluteFill style={{ transform: `translateX(${x}%)`, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>;
};

/** 8. Spinning front page: the new scene spins in like a newspaper in an old film and stops dead. */
const PortadaGira: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  if (presentationDirection === "exiting") return <AbsoluteFill style={{ filter: `brightness(${1 - p * 0.6})` }}>{children}</AbsoluteFill>;
  const e = Easing.out(Easing.cubic)(p);
  return (
    <AbsoluteFill style={{ transform: `rotate(${(1 - e) * -720}deg) scale(${0.05 + 0.95 * e})`, boxShadow: "0 40px 120px rgba(0,0,0,.6)" }}>{children}</AbsoluteFill>
  );
};

/** 9. "VERIFICADO" stamp: a red stamp slams down over the screen and lifts off the new scene. */
const SelloVerificado: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const cae = interpolate(p, [0, 0.45], [3.2, 1], { extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
  const sube = interpolate(p, [0.6, 1], [1, 1.6], { extrapolateLeft: "clamp", easing: Easing.in(Easing.cubic) });
  const opac = interpolate(p, [0, 0.12, 0.6, 1], [0, 1, 1, 0]);
  return (
    <AbsoluteFill>
      {p >= 0.5 && <AbsoluteFill>{children}</AbsoluteFill>}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: opac }}>
        <div style={{ transform: `rotate(-9deg) scale(${p < 0.6 ? cae : sube})`, border: `22px solid ${C.rojo}`, outline: `6px solid ${C.rojo}`, outlineOffset: 10, padding: "30px 80px", fontFamily: T, fontSize: 230, color: C.rojo, background: "rgba(255,255,255,.92)", letterSpacing: 8, filter: "url(#tinta)" }}>
          VERIFICADO
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 10. Torn paper: the new page is pulled in from the right with a ragged edge and its shadow. */
const PapelRasgado: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  if (presentationDirection === "exiting") return <AbsoluteFill style={{ transform: `translateX(${-ease(p) * 12}%)` }}>{children}</AbsoluteFill>;
  const borde = (1 - ease(p)) * 112 - 6;
  const dientes = 26;
  const pts: string[] = [];
  for (let i = 0; i <= dientes; i++) {
    const y = (i / dientes) * 100;
    const j = (i % 2 ? 2.4 : -1.2) + Math.sin(i * 2.7) * 1.4;
    pts.push(`${(borde + j).toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return (
    <AbsoluteFill style={{ filter: "drop-shadow(-14px 0 18px rgba(0,0,0,.45))" }}>
      <AbsoluteFill style={{ clipPath: `polygon(${pts.join(",")}, 100% 100%, 100% 0)` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 11. Closing iris: the old scene closes into a circle toward the centre, where the mark waits. */
const IrisCierra: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  if (presentationDirection === "entering") return <AbsoluteFill>{children}</AbsoluteFill>;
  const r = (1 - Easing.in(Easing.cubic)(p)) * 120;
  return (
    <AbsoluteFill style={arriba(2)}>
      <AbsoluteFill style={{ clipPath: `circle(${r}% at 50% 42%)` }}>{children}</AbsoluteFill>
      <div style={{ position: "absolute", left: "50%", top: "42%", width: `${r * 2}vmax`, height: `${r * 2}vmax`, marginLeft: `${-r}vmax`, marginTop: `${-r}vmax`, borderRadius: "50%", border: `10px solid ${C.rojo}`, opacity: p }} />
    </AbsoluteFill>
  );
};

/** Hard cut on the beat: the old scene stays whole until the last frame of the overlap. Used when
 *  the new scene brings its own entrance (the split screen of "Comparar"). */
const Corte: React.FC<P> = ({ children, presentationDirection, presentationProgress: p }) => {
  if (presentationDirection === "exiting") return <AbsoluteFill style={arriba(2)}>{p < 0.98 ? children : null}</AbsoluteFill>;
  return <AbsoluteFill>{children}</AbsoluteFill>;
};

/** One per cut, in order: hook→logo, logo→app, app→map, map→ideas (the drop), ideas→listening,
 *  listening→compare, compare→chat, chat→citation, citation→web, web→montage, montage→close. */
export const TRANSICIONES = [
  hacer(IrisRojo),
  hacer(ZoomAtraves),
  hacer(Enfoque),
  hacer(GolpeSeco),
  hacer(Senal),
  hacer(Corte), // listening → compare: the split screen itself is the entrance
  hacer(Paneo),
  hacer(PortadaGira),
  hacer(SelloVerificado),
  hacer(PapelRasgado),
  hacer(IrisCierra),
];
