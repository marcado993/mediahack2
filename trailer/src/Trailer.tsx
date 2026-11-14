// OVADE launch trailer: 1920x1080, 30 fps, 48 s.
// Startup-launch style: the app inside a browser window that flies in in 3D, camera pushes,
// pop-out cards, kinetic Anton titles. Motion is GSAP timelines scrubbed frame by frame
// (a paused timeline seeked to frame / fps), so every render is deterministic.
// Identity of the site: navy ink, Anton titles, red call to action, yellow stamp, gate-like
// boxes with a hard offset shadow, dot paper. Map and scores are the real ones.
import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Easing, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import mapa from "../musica/mapa.json";
import { B, C, INST_CANCION, INST_ORIGINAL, InicioEscena, L, PATHS, PROV, RAMP, Ritmo, T, TRANS, colorDe, coma, golpeDe, puntos, useB, useMusica, useStagger, useTL } from "./base";
import { TRANSICIONES } from "./transiciones";
import { Censura, EnVivo, FiltroTinta, Lupa, Marcador, Objetivos, Odometro, SelloTinta, Ticker, Trama, Zocalo, escritoEnPlatillos } from "./efectos";

// ---------------------------------------------------------------- fonts
const useFuentes = () => {
  const [h] = useState(() => delayRender("fuentes"));
  useEffect(() => {
    const f = [
      new FontFace("Anton", `url(${staticFile("anton.woff2")})`),
      new FontFace("Public Sans", `url(${staticFile("public-sans.woff2")})`, { weight: "100 900" }),
      new FontFace("Source Serif 4", `url(${staticFile("source-serif-4.woff2")})`, { weight: "200 900" }),
    ];
    Promise.all(f.map((x) => x.load().then((y) => document.fonts.add(y)))).then(
      () => continueRender(h),
      () => continueRender(h),
    );
  }, [h]);
};

// ---------------------------------------------------------------- pieces of the identity

const Marca: React.FC<{ size: number; giro?: number; dibuja?: number; color?: string }> = ({ size, giro = 0, dibuja = 1, color = "#fff" }) => (
  <svg viewBox="0 0 68 68" width={size} height={size} style={{ overflow: "visible" }}>
    <circle cx="34" cy="34" r="31" fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${140 * dibuja} ${195 - 140 * dibuja}`} transform={`rotate(${-58 + giro} 34 34)`} />
    <circle cx="34" cy="34" r="19" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${85 * dibuja} ${120 - 85 * dibuja}`} transform={`rotate(${122 - giro * 1.6} 34 34)`} />
    <circle cx="34" cy="34" r={7 * Math.min(1, dibuja * 1.4)} fill={C.rojo} />
  </svg>
);

const Sello: React.FC<{ children: React.ReactNode; s?: number; size?: number }> = ({ children, s = 1, size = 30 }) => (
  <div
    style={{
      display: "inline-block",
      background: C.amarillo,
      color: C.linea,
      fontFamily: T,
      fontSize: size,
      letterSpacing: 1,
      padding: "6px 24px 4px 16px",
      clipPath: `polygon(0 0,${100 * s}% 0,${94 * s}% 100%,0 100%)`,
    }}
  >
    {children}
  </div>
);

/** Headline typed in, like a reporter at the keyboard. It starts when a sung phrase comes in (if
 *  one starts near `at`), and the letters fall in short bursts on the cymbal hits, so the typing
 *  plays with the hi-hats. A red block caret leads and blinks when done; `resalta` gets a yellow
 *  highlighter when the phrase ends (or when the typing ends). */
const Titular: React.FC<{ texto: string; at?: number; size?: number; color?: string; each?: number; ancho?: number; cps?: number; resalta?: string }> = ({
  texto,
  at = 0.15,
  size = 104,
  color = C.linea,
  ancho = 760,
  resalta,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const m = useMusica();
  const frase = m.frase(at - 0.05, at + 0.6);
  const desde = frase ? frase[0] : at;
  const fin = desde + Math.max(1.1, texto.length / 24);
  const escrito = t < desde ? "" : escritoEnPlatillos(texto, desde, m.platillos(desde), fin, t);
  const n = escrito.length;
  const listo = n >= texto.length;
  const visible = t < desde ? false : !listo || Math.floor((t * fps) / 9) % 2 === 0;
  const finEscritura = desde + 0.02 + (fin - desde);
  const marcaEn = frase ? Math.max(Math.min(frase[1], fin + 0.8), finEscritura) : finEscritura + 0.1;
  let cuerpo: React.ReactNode = escrito;
  if (resalta && listo) {
    const i = texto.toUpperCase().indexOf(resalta.toUpperCase());
    if (i >= 0) {
      cuerpo = (
        <>
          {texto.slice(0, i)}
          <Marcador at={marcaEn}>{texto.slice(i, i + resalta.length)}</Marcador>
          {texto.slice(i + resalta.length)}
        </>
      );
    }
  }
  return (
    <div style={{ fontFamily: T, fontSize: size, lineHeight: 1.12, color, textTransform: "uppercase", maxWidth: ancho, minHeight: size * 1.12 }}>
      {cuerpo}
      <span style={{ display: "inline-block", width: size * 0.42, height: size * 0.86, marginLeft: size * 0.06, verticalAlign: "-0.06em", background: C.rojo, opacity: visible ? 1 : 0 }} />
    </div>
  );
};

/** Mouse pointer that travels between points and clicks. `ruta`: [second, x, y]; `clics`: seconds.
 *  On a click the arrow dips and a ring spreads from its tip. */
const Puntero: React.FC<{ ruta: [number, number, number][]; clics: number[]; escala?: number }> = ({ ruta, clics, escala = 1 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  if (t < ruta[0][0] - 0.25) return null;
  let x = ruta[0][1];
  let y = ruta[0][2];
  for (let i = 0; i < ruta.length - 1; i++) {
    const [t0, x0, y0] = ruta[i];
    const [t1, x1, y1] = ruta[i + 1];
    if (t >= t0 && t <= t1) {
      const p = interpolate(t, [t0, t1], [0, 1], { easing: Easing.bezier(0.65, 0, 0.2, 1) });
      x = x0 + (x1 - x0) * p;
      y = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 40; // a slight arc, like a hand
    } else if (t > t1) {
      x = x1;
      y = y1;
    }
  }
  const aparece = interpolate(t, [ruta[0][0] - 0.25, ruta[0][0]], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ultimo = clics.filter((c) => c <= t).pop();
  const dt = ultimo == null ? 9 : t - ultimo;
  const baja = dt < 0.14 ? 1 - Math.abs(dt - 0.07) / 0.07 : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 40, opacity: aparece, pointerEvents: "none", transform: `scale(${escala})`, transformOrigin: "0 0" }}>
      {dt < 0.6 && <i style={{ position: "absolute", left: -30, top: -30, width: 60, height: 60, borderRadius: "50%", border: `4px solid ${C.rojo}`, opacity: 1 - dt / 0.6, transform: `scale(${0.3 + dt * 3})` }} />}
      <svg width="46" height="56" viewBox="0 0 23 28" style={{ transform: `scale(${1 - 0.18 * baja})`, transformOrigin: "0 0", filter: "drop-shadow(3px 4px 0 rgba(27,42,65,.35))" }}>
        <path d="M1 1 L1 22 L6.5 17 L10.5 26 L14 24.5 L10 15.8 L17.5 15.8 Z" fill="#fff" stroke={C.linea} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------- the app, inside a browser window
const TABS = ["Preparar mi nota", "Escucha digital", "Chat", "Bóveda", "Mapa del país", "Comparar provincias"];

const Navegador: React.FC<{ tab: number; children: React.ReactNode; w?: number; h?: number }> = ({ tab, children, w = 1180, h = 820 }) => (
  <div style={{ width: w, height: h, borderRadius: 14, overflow: "hidden", background: C.papel, border: `3px solid ${C.linea}`, boxShadow: `14px 14px 0 ${C.linea}, 0 60px 120px rgba(0,0,0,.45)`, display: "flex", flexDirection: "column", fontFamily: B }}>
    <div style={{ height: 46, background: "#e4e8ef", display: "flex", alignItems: "center", gap: 10, padding: "0 18px", flex: "none" }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <i key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />
      ))}
      <div style={{ marginLeft: 22, flex: 1, maxWidth: 560, height: 28, borderRadius: 8, background: "#fff", fontSize: 17, color: C.suave, display: "flex", alignItems: "center", padding: "0 14px" }}>🔒 ovade.lat</div>
    </div>
    <div style={{ background: C.linea, color: "#fff", padding: "14px 26px 0", flex: "none", borderBottom: `5px solid ${C.rojo}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Marca size={34} />
        <div style={{ fontFamily: T, fontSize: 17, lineHeight: 1.1, border: "2px solid #fff", padding: "3px 10px", transform: "skewX(-8deg)" }}>
          OBSERVATORIO DE VULNERABILIDAD
          <br />
          ANTE LA DESINFORMACIÓN ELECTORAL
        </div>
      </div>
      <div style={{ display: "flex", gap: 26, marginTop: 12, fontSize: 17, fontWeight: 800 }}>
        {TABS.map((t, i) => (
          <span key={t} style={{ padding: "8px 2px 10px", borderBottom: i === tab ? `5px solid #fff` : "5px solid transparent", opacity: i === tab ? 1 : 0.75 }}>
            {t}
          </span>
        ))}
      </div>
    </div>
    <div style={{ flex: 1, position: "relative", ...puntos("#1b2a4117"), overflow: "hidden" }}>{children}</div>
  </div>
);

/** Feature scene: kinetic title on the left, the app in 3D on the right, a camera push over it all. */
const Funcion: React.FC<{
  n: string;
  sello: string;
  titulo: string;
  texto: React.ReactNode;
  tab: number;
  children: React.ReactNode;
  flotante?: React.ReactNode;
  golpes?: number[]; // extra impact moments of the scene, in local seconds (clicks, reveals)
  cartaEn?: number; // local second on which the floating card hits
  resalta?: string; // words of the title that get the highlighter
  encima?: React.ReactNode; // newsroom overlays drawn over the whole frame (lower third, stamps…)
  detalle?: { a: number; b: number; x: number; y: number; zoom: number }; // camera goes to a detail and back
  disposicion?: "derecha" | "izquierda" | "centro"; // where the app sits; scenes alternate it
}> = ({ n, sello, titulo, texto, tab, children, flotante, golpes = [], cartaEn, resalta, encima, detalle, disposicion = "derecha" }) => {
  const centro = disposicion === "centro";
  const izq = disposicion === "izquierda";
  const giro = izq ? -1 : 1; // mirror the 3D turn when the app is on the left
  const VW = centro ? 1240 : 1100;
  const VH = centro ? 780 : 800;
  const b = useB();
  const f = useCurrentFrame();
  const m = useMusica();
  // the card hits on a strong kick near beat 4
  const carta = cartaEn ?? m.proximo("bombo", b(4) - 0.1, 0.4, 0.5);
  const impactos = [...golpes, ...(flotante ? [carta] : [])];
  // how deep the slow push goes follows the bass of the bar (set once per scene, not per beat)
  const hondo = 0.04 + 0.08 * m.bajo();
  const v = useTL({ ry: centro ? 0 : -38, rx: centro ? 45 : 14, z: -500, y: centro ? 420 : 260, o: 0, cam: 1 + hondo, sello: 0, txt: 0, flota: 0, deriva: 0, det: 0 }, (tl, o) => {
    tl.to(o, { cam: 1, duration: 5, ease: "none" }, 0);
    if (detalle) {
      tl.to(o, { det: 1, duration: 0.5, ease: "power3.inOut" }, detalle.a);
      tl.to(o, { det: 0, duration: 0.6, ease: "power3.inOut" }, detalle.b);
    }
    tl.to(o, { ry: centro ? 0 : -14, rx: centro ? 2 : 4, z: 0, y: 0, o: 1, duration: 0.8, ease: "expo.out" }, b(0) - 0.05);
    tl.to(o, { deriva: 1, duration: 5, ease: "sine.inOut" }, b(1));
    tl.to(o, { sello: 1, duration: 0.35, ease: "power3.out" }, b(0));
    tl.to(o, { txt: 1, duration: 0.6, ease: "power2.out" }, b(1.6));
    tl.to(o, { flota: 1, duration: 0.45, ease: "back.out(2.2)" }, carta - 0.04);
  });
  const dz = detalle ? 1 + (detalle.zoom - 1) * v.det : 1;
  return (
    <AbsoluteFill style={{ background: C.papel, ...puntos("#1b2a411c"), overflow: "hidden", fontFamily: B, color: C.tinta }}>
      <AbsoluteFill style={{ transform: `scale(${v.cam * dz})`, transformOrigin: detalle ? `${detalle.x}px ${detalle.y}px` : "50% 50%" }}>
       <AbsoluteFill style={golpeDe(f / 30, impactos)}>
        {/* a big faint number behind, for depth */}
        <div style={{ position: "absolute", [izq ? "left" : "right"]: -40, bottom: -150, fontFamily: T, fontSize: 620, color: "#1b2a410d", lineHeight: 1 }}>{n}</div>
        <div
          style={
            centro
              ? { position: "absolute", left: 0, right: 0, top: 46, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }
              : { position: "absolute", left: izq ? 1210 : 100, top: 110, width: 640 }
          }
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: centro ? 6 : 14 }}>
            <span style={{ fontFamily: T, fontSize: 34, color: C.rojo, opacity: v.sello }}>{n}</span>
            <Sello s={v.sello}>{sello}</Sello>
          </div>
          <Titular texto={titulo} size={centro ? 74 : 92} ancho={centro ? 1700 : 640} at={b(0) + 0.1} resalta={resalta} />
          {!centro && <div style={{ marginTop: 26, fontSize: 32, lineHeight: 1.42, color: C.suave, opacity: v.txt, transform: `translateY(${(1 - v.txt) * 24}px)` }}>{texto}</div>}
        </div>
        <div style={{ position: "absolute", left: centro ? (1920 - VW) / 2 : izq ? 60 : 760, top: centro ? 250 : 120, perspective: 2200 }}>
          <div
            style={{
              transformStyle: "preserve-3d",
              transform: `translate3d(0, ${v.y - v.deriva * 14}px, ${v.z}px) rotateY(${(v.ry + v.deriva * 4) * giro}deg) rotateX(${v.rx}deg)`,
              opacity: v.o,
              transformOrigin: centro ? "center top" : izq ? "right center" : "left center",
            }}
          >
            <Navegador tab={tab} w={VW} h={VH}>
              {children}
            </Navegador>
            {flotante && (
              <div style={{ position: "absolute", [izq ? "right" : "left"]: -90, bottom: 70, transform: `translateZ(${120 * v.flota}px) scale(${0.6 + 0.4 * v.flota})`, opacity: v.flota, transformOrigin: izq ? "right bottom" : "left bottom" }}>
                {flotante}
              </div>
            )}
          </div>
        </div>
       </AbsoluteFill>
      </AbsoluteFill>
      {encima}
    </AbsoluteFill>
  );
};

const Tarjeta: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: C.papel, border: `4px solid ${C.linea}`, borderRadius: 4, boxShadow: `8px 8px 0 ${C.linea}, 0 30px 60px rgba(0,0,0,.25)`, padding: "18px 24px", fontFamily: B, ...style }}>{children}</div>
);

// ---------------------------------------------------------------- 1. hook
const Gancho: React.FC = () => {
  const palabras = ["ELECCIONES.", "RUMORES.", "VIDEOS QUE VUELAN."];
  const { gancho: g0 } = React.useContext(Ritmo);
  const m = useMusica();
  // each word slams on the kick nearest its beat (bombo), the question on a strong one
  const gancho = g0.map((s, i) => m.proximo("bombo", s - 0.1, 0.25, i === 3 ? 0.5 : 0));
  const v = useTL({ w0: 0, w1: 0, w2: 0, flash: 0, q: 0, sacude: 0, apaga: 1 }, (tl, o) => {
    palabras.forEach((_, i) => {
      tl.fromTo(o, { [`w${i}`]: 0 }, { [`w${i}`]: 1, duration: 0.45, ease: "expo.out" }, gancho[i]);
      tl.fromTo(o, { flash: 1 }, { flash: 0, duration: 0.25, ease: "power2.out" }, gancho[i]);
    });
    tl.to(o, { apaga: 0.18, duration: 0.4 }, gancho[3] - 0.15);
    tl.to(o, { q: 1, duration: 0.55, ease: "power3.out" }, gancho[3] - 0.5);
    tl.fromTo(o, { sacude: 1 }, { sacude: 0, duration: 0.5, ease: "power2.out" }, gancho[3] + 0.05);
  });
  const f = useCurrentFrame();
  const temblor = v.sacude * Math.sin(f * 2.3) * 10;
  return (
    <AbsoluteFill style={{ background: C.noche, ...puntos("#ffffff10"), justifyContent: "center", paddingLeft: 140, color: "#fff", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: C.rojo, opacity: v.flash * 0.35 }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 16, background: C.rojo }} />
      {palabras.map((t, i) => {
        const k = (v as Record<string, number>)[`w${i}`];
        return (
          <div key={t} style={{ fontFamily: T, fontSize: 132, lineHeight: 1.05, opacity: Math.min(1, k * 2) * v.apaga, transform: `scale(${2.4 - 1.4 * k})`, transformOrigin: "left center", filter: `blur(${(1 - k) * 14}px)` }}>
            {t}
          </div>
        );
      })}
      <div style={{ marginTop: 40, transform: `translateX(${temblor}px) rotate(${(1 - v.q) * -540}deg) scale(${0.1 + 0.9 * v.q})`, transformOrigin: "30% 50%", opacity: Math.min(1, v.q * 3) }}>
        <div style={{ display: "inline-block", background: C.papel, color: C.linea, padding: "14px 28px", border: `6px solid ${C.amarillo}`, boxShadow: `10px 10px 0 ${C.rojo}` }}>
          <div style={{ fontFamily: B, fontWeight: 900, fontSize: 22, letterSpacing: 4, borderBottom: `3px solid ${C.linea}`, marginBottom: 6 }}>EDICIÓN ELECTORAL · ECUADOR</div>
          <div style={{ fontFamily: T, fontSize: 96, lineHeight: 1.04 }}>¿DÓNDE PRENDE MÁS</div>
          <div style={{ fontFamily: T, fontSize: 96, lineHeight: 1.04 }}>LA DESINFORMACIÓN?</div>
        </div>
      </div>
      <Trama />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 2. logo
const Logo: React.FC = () => {
  const letras = "OVADE".split("");
  const b = useB();
  const { periodo } = React.useContext(Ritmo);
  const m0 = useMusica();
  const v = useTL({ dib: 0, giro: -200, esc: 0.4, sub: 0, sombra: 0, zoom: 1 }, (tl, o) => {
    tl.to(o, { dib: 1, giro: 0, esc: 1, duration: 1.0, ease: "expo.out" }, b(0) - 0.05);
    tl.to(o, { sombra: 1, duration: 0.2, ease: "power3.out" }, m0.fuerte("bombo", b(1.5), b(2.5)) + 0.08);
    tl.to(o, { sub: 1, duration: 0.5, ease: "power3.out" }, m0.proximo("caja", b(2.6), 0.4));
    tl.to(o, { zoom: 1.06, duration: 3, ease: "none" }, 0);
  });
  const m = useMusica();
  const golpe = m.fuerte("bombo", b(1.5), b(2.5));
  const k = useStagger(letras.length, golpe - 0.04, 0.012, 0.32, "back.out(2.6)");
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.linea, alignItems: "center", justifyContent: "center", color: "#fff", overflow: "hidden" }}>
      {/* rings that ripple out from the mark */}
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", border: "3px solid #ffffff", opacity: Math.max(0, 0.35 - v.dib * 0.1 * (i + 1)) * v.dib, transform: `scale(${1 + v.dib * (i + 1) * 1.6})`, left: 360, top: 390 }} />
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 56, transform: `scale(${v.zoom})`, ...golpeDe(f / 30, [golpe]) }}>
        <div style={{ transform: `scale(${v.esc})` }}>
          <Marca size={280} giro={v.giro} dibuja={v.dib} />
        </div>
        <div>
          <div style={{ display: "flex", fontFamily: T, fontSize: 250, lineHeight: 0.92, letterSpacing: 6 }}>
            {letras.map((l, i) => (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingTop: 20 }}>
                <span style={{ display: "inline-block", transform: `translateY(${(1 - k[i]) * 105}%)`, textShadow: `${9 * v.sombra}px ${9 * v.sombra}px 0 ${C.rojo}` }}>{l}</span>
              </span>
            ))}
          </div>
          <div style={{ marginTop: 18, opacity: v.sub, transform: `translateY(${(1 - v.sub) * 20}px)` }}>
            <Sello size={34}>OBSERVATORIO DE DATOS ABIERTOS · ECUADOR</Sello>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 3. the app appears
const Presenta: React.FC = () => {
  const b = useB();
  const { periodo } = React.useContext(Ritmo);
  const v = useTL({ rx: 58, z: -1400, y: 500, o: 0, rot: -10, cam: 1, txt: 0, foco: 0 }, (tl, o) => {
    tl.to(o, { o: 1, duration: 0.2 }, b(0) - 0.15);
    tl.to(o, { rx: 0, z: 0, y: 0, rot: 0, duration: 1.2, ease: "expo.out" }, b(0) - 0.15);
    tl.to(o, { txt: 1, duration: 0.6, ease: "power2.out" }, b(0.5));
    tl.to(o, { cam: 1.55, foco: 1, duration: periodo * 1.5, ease: "power3.inOut" }, b(4) + 0.1);
  });
  const m = useMusica();
  const clic = m.proximo("caja", b(4) - 0.15, 0.4);
  const btn = useTL({ p: 0 }, (tl, o) => tl.to(o, { p: 1, duration: 0.07, yoyo: true, repeat: 1 }, clic - 0.03));
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, #24385a 0%, ${C.noche} 70%)`, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 70, width: "100%", textAlign: "center", fontFamily: T, fontSize: 64, color: "#fff", opacity: v.txt * (1 - v.foco), transform: `translateY(${(1 - v.txt) * -30}px)` }}>
        UNA HERRAMIENTA PARA <span style={{ color: C.amarillo }}>SALAS DE REDACCIÓN</span>
      </div>
      <AbsoluteFill style={{ perspective: 2400, alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `translateY(${60 + v.y}px) translateZ(${v.z}px) rotateX(${v.rx}deg) rotateZ(${v.rot}deg) scale(${v.cam})`, transformOrigin: "30% 62%", opacity: v.o, transformStyle: "preserve-3d", ...golpeDe(f / 30, [clic]) }}>
          <Navegador tab={0} w={1400} h={800}>
            <div style={{ position: "absolute", inset: "26px 30px", background: C.papel, border: `4px solid ${C.linea}`, boxShadow: `8px 8px 0 ${C.linea}`, padding: "26px 34px" }}>
              <Sello size={22}>OBSERVATORIO DE DATOS ABIERTOS</Sello>
              <div style={{ fontFamily: T, fontSize: 84, color: C.tinta, margin: "8px 0 6px" }}>¿Qué es OVADE?</div>
              <div style={{ fontSize: 24, lineHeight: 1.45, maxWidth: 900 }}>
                Un mapa de Ecuador que muestra <b>dónde la desinformación electoral encuentra más terreno</b>. Junta datos oficiales de las 24 provincias en un puntaje de 0 a 100.
              </div>
              <div style={{ display: "inline-block", marginTop: 22, background: C.rojo, color: "#fff", border: `4px solid ${C.linea}`, boxShadow: `${6 - btn.p * 4}px ${6 - btn.p * 4}px 0 ${C.linea}`, transform: `translate(${btn.p * 4}px, ${btn.p * 4}px)`, padding: "14px 26px" }}>
                <div style={{ fontFamily: T, fontSize: 40 }}>IDEAS PARA TU NOTICIA →</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>¿Qué estás cubriendo hoy? Eliges provincia y tema.</div>
              </div>
              <Objetivos puntos={[{ at: clic, x: 330, y: 335 }]} desde={1} />
              <Puntero ruta={[[b(1.2), 900, 420], [clic - 0.08, 330, 335]]} clics={[clic]} />
              <div style={{ display: "flex", gap: 14, marginTop: 26 }}>
                {["Escucha digital", "Chat con colegas", "Bóveda segura", "Mapa del país", "Comparar provincias"].map((t) => (
                  <span key={t} style={{ border: `2px solid ${C.linea}`, padding: "10px 16px", fontSize: 19, fontWeight: 800 }}>{t}</span>
                ))}
              </div>
            </div>
          </Navegador>
        </div>
      </AbsoluteFill>
      <Trama opacidad={0.05} />
      <Ticker at={b(0.8)} pasos={m.platillos(b(0.8))} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 4. map (the app's sweep)
const Mapa: React.FC = () => {
  const claves = Object.keys(PATHS.mainland);
  const cx = (k: string) => PATHS.centroids[k]?.[0] ?? 0;
  const xs = claves.map(cx);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const b = useB();
  const v = useTL({ barre: 0, gal: 0, cuenta: 0 }, (tl, o) => {
    tl.to(o, { barre: 1, duration: b(2) - b(0.3), ease: "power2.inOut" }, b(0.3));
    tl.to(o, { gal: 1, duration: 0.15 }, b(2));
    tl.to(o, { cuenta: 24, duration: b(2) - b(0.3), ease: "power2.out" }, b(0.3));
  });
  const top = PROV["sucumbios"];
  const m = useMusica();
  const lupaEn = m.proximo("bombo", b(2.2), 0.4);
  // map drawn inside the window's content area (1100 x ~649): svg 98% high, 300 px from the left
  const ALTO = 649;
  const esc = (ALTO * 0.98) / PATHS.height;
  const [scx, scy] = PATHS.centroids["sucumbios"];
  const dibujo = (
    <svg viewBox={`0 0 ${PATHS.width} ${PATHS.height}`} style={{ position: "absolute", left: 300, top: 6, height: ALTO * 0.98 }}>
      {claves.map((k) => {
        const t = (cx(k) - x0) / (x1 - x0);
        const on = v.barre * 1.25 - t * 1.0 > 0.15;
        return <path key={k} d={PATHS.mainland[k]} fill={on ? colorDe(PROV[k].ivei) : C.mapa} stroke={C.linea} strokeWidth={k === "sucumbios" && v.gal > 0.5 ? 4 : 1.2} />;
      })}
      <g transform="translate(6,6)" opacity={v.gal}>
        <rect width={PATHS.insetSize} height={PATHS.insetSize} fill="none" stroke={C.linea} strokeDasharray="4 3" />
        {Object.values(PATHS.galapagos).map((d, i) => (
          <path key={i} d={d} fill={colorDe(PROV["galapagos"].ivei)} stroke={C.linea} strokeWidth={0.8} />
        ))}
      </g>
      {v.barre > 0 && v.barre < 1 && <rect x={x0 - 60 + (x1 - x0 + 160) * v.barre} y={0} width={6} height={PATHS.height} fill={C.rojo} />}
    </svg>
  );
  return (
    <Funcion
      n="01"
      sello="MAPA DEL PAÍS"
      golpes={[lupaEn]}
      disposicion="izquierda"
      resalta="24 provincias"
      titulo="24 provincias en un puntaje de 0 a 100"
      tab={4}
      texto={
        <>
          Datos oficiales de <b style={{ color: C.tinta }}>INEC, Latinobarómetro y MINTEL</b>: dónde el terreno es más fértil para la desinformación.
        </>
      }
      flotante={
        <Tarjeta>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.rojo }}>N.º 1 DE 24</div>
          <div style={{ fontFamily: T, fontSize: 60, color: C.linea, lineHeight: 1.1 }}>{top.nombre.toUpperCase()}</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {coma(top.ivei)} / 100 · {top.nivel}
          </div>
        </Tarjeta>
      }
    >
      <div style={{ position: "absolute", left: 30, top: 24, display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: T, fontSize: 86, color: C.rojo, lineHeight: 1 }}>{Math.round(v.cuenta)}</span>
        <span style={{ fontFamily: T, fontSize: 30, color: C.linea }}>PROVINCIAS</span>
      </div>
      <div style={{ position: "absolute", left: 30, bottom: 30, display: "flex" }}>
        {RAMP.map((c) => (
          <div key={c} style={{ width: 58, height: 18, background: c, border: `2px solid ${C.linea}` }} />
        ))}
      </div>
      <Lupa at={lupaEn} x={300 + scx * esc} y={6 + scy * esc} r={115} zoom={2.2} ancho={1100} alto={ALTO} contenido={dibujo} />
      <Objetivos puntos={[{ at: lupaEn, x: 300 + scx * esc, y: 6 + scy * esc }]} r={60} desde={2} />
    </Funcion>
  );
};

// ---------------------------------------------------------------- 5. story ideas
const Ideas: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const b = useB();
  const { periodo } = React.useContext(Ritmo);
  const m = useMusica();
  const clic1 = m.proximo("caja", b(2) - 0.15, 0.4);
  const clic2 = m.proximo("caja", b(4) - 0.15, 0.4);
  const zocalo = m.proximo("caja", clic2 + 0.5, 0.5);
  const paso = t < clic1 + 0.06 ? 1 : t < clic2 + 0.06 ? 2 : 3;
  const tipos = useStagger(3, clic1 + 0.08, 0.06, 0.3, "power3.out");
  const recs = useStagger(3, clic2 + 0.08, 0.12, 0.4, "power3.out");
  const provs = ["Sucumbíos", "Bolívar", "Chimborazo", "Cotopaxi", "Cañar", "Los Ríos", "Imbabura", "Carchi", "Manabí"];
  const cajas = [
    ["Por dónde empezar", "Bolívar es 2.ª de 24: un rumor aquí encuentra terreno. Verifica primero."],
    ["Por dónde llegar a la gente", "Por qué redes se informa la gente y con qué conexión."],
    ["Qué no afirmar", "El índice no prueba que aquí circule más desinformación."],
  ];
  const escrito = escritoEnPlatillos("Bolívar", b(0.3), m.platillos(b(0.3)), b(1.6), t);
  return (
    <Funcion
      n="02"
      sello="IDEAS PARA TU NOTICIA"
      golpes={[clic1, clic2]}
      cartaEn={m.proximo("bombo", b(6) - 0.1, 0.4)}
      resalta="el ángulo"
      disposicion="centro"
      detalle={{ a: 0, b: clic1 - 0.3, x: 960, y: 600, zoom: 1.75 }}
      encima={<Zocalo at={zocalo} etiqueta="BOLÍVAR" titulo="2.ª DE 24 PROVINCIAS" dato={`${coma(PROV["bolivar"].ivei)} sobre 100 · INEC, Latinobarómetro, MINTEL`} />}
      titulo="Eliges provincia y tema. Te da el ángulo."
      tab={0}
      texto={
        <>
          En <b style={{ color: C.tinta }}>tres pasos</b>: por dónde empezar, de qué se habla hoy, por dónde llegar y <b style={{ color: C.tinta }}>datos con su fuente</b>.
        </>
      }
      flotante={
        <Tarjeta style={{ display: "flex", gap: 12, padding: "14px 18px" }}>
          <span style={{ border: `2px solid ${C.linea}`, borderRadius: 999, padding: "4px 14px", fontSize: 22, fontWeight: 800 }}>Datos estructurales · 2022–2024</span>
          <span style={{ border: `2px solid ${C.rojo}`, color: C.rojo, borderRadius: 999, padding: "4px 14px", fontSize: 22, fontWeight: 800 }}>Conversación reciente</span>
        </Tarjeta>
      }
    >
      <Objetivos puntos={[{ at: clic1, x: 619, y: 300 }, { at: clic2, x: 360, y: 234 }]} desde={3} />
      <Puntero ruta={[[b(0.9), 1000, 600], [clic1 - 0.08, 619, 300], [clic1 + 0.35, 619, 300], [clic2 - 0.08, 360, 234]]} clics={[clic1, clic2]} />
      <div style={{ position: "absolute", inset: "22px 26px", background: C.papel, border: `4px solid ${C.linea}`, padding: "22px 28px" }}>
        <div style={{ display: "flex", gap: 26, marginBottom: 20 }}>
          {["Provincia", "Qué cubres", "Recomendaciones"].map((x, i) => {
            const on = paso === i + 1;
            const hecho = paso > i + 1;
            return (
              <div key={x} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 800, color: on || hecho ? C.linea : "#8a93a3" }}>
                <span style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", background: on ? C.rojo : hecho ? C.linea : C.gris, color: on || hecho ? "#fff" : C.suave }}>{hecho ? "✓" : i + 1}</span>
                {x}
              </div>
            );
          })}
        </div>
        {paso === 1 && (
          <>
            <div style={{ fontFamily: T, fontSize: 48, color: C.linea }}>¿DE QUÉ PROVINCIA ES TU NOTICIA?</div>
            <div style={{ marginTop: 14, border: `3px solid ${C.linea}`, padding: "12px 16px", fontSize: 26, color: escrito ? C.tinta : C.suave }}>
              🔍 {escrito || "Escribe el nombre o tócala"}
              <span style={{ opacity: f % 14 < 7 ? 1 : 0 }}>|</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
              {provs.map((p) => {
                const el = p === "Bolívar" && escrito === "Bolívar";
                return (
                  <div key={p} style={{ border: `3px solid ${C.linea}`, padding: "14px 16px", fontSize: 24, fontWeight: 700, background: el ? C.linea : C.papel, color: el ? "#fff" : C.tinta, opacity: escrito && !el && escrito.length > 2 ? 0.25 : 1 }}>
                    {p}
                  </div>
                );
              })}
            </div>
          </>
        )}
        {paso === 2 && (
          <>
            <div style={{ fontFamily: T, fontSize: 48, color: C.linea }}>¿QUÉ ESTÁS CUBRIENDO EN BOLÍVAR?</div>
            {["Un rumor o video que está circulando", "La campaña y la elección", "Cómo se informa la gente aquí"].map((x, i) => {
              const el = i === 0 && t > clic2 - 0.03;
              return (
                <div key={x} style={{ marginTop: 16, border: `3px solid ${C.linea}`, padding: "18px 22px", fontSize: 27, fontWeight: 800, opacity: tipos[i], transform: `translateX(${(1 - tipos[i]) * 60}px) ${el ? "scale(1.03)" : ""}`, background: el ? C.rojo : C.papel, color: el ? "#fff" : C.tinta, boxShadow: el ? `6px 6px 0 ${C.linea}` : "none" }}>
                  {x} →
                </div>
              );
            })}
          </>
        )}
        {paso === 3 &&
          cajas.map(([h, x], i) => (
            <div key={h} style={{ marginBottom: 16, border: `3px solid ${C.linea}`, opacity: recs[i], transform: `translateY(${(1 - recs[i]) * 40}px) scale(${0.9 + 0.1 * recs[i]})` }}>
              <div style={{ fontSize: 22, fontWeight: 800, padding: "8px 16px", borderBottom: `3px solid ${C.linea}`, color: C.linea }}>{h}</div>
              <div style={{ fontFamily: L, fontSize: 27, padding: "12px 16px", lineHeight: 1.35 }}>{x}</div>
            </div>
          ))}
      </div>
    </Funcion>
  );
};

// ---------------------------------------------------------------- 6. listening
const Escucha: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const fuentes = [
    { n: "Medios de comunicación", ic: "📰", total: 38 },
    { n: "X (Twitter)", ic: "𝕏", total: 21 },
  ];
  const b = useB();
  const { periodo } = React.useContext(Ritmo);
  const m = useMusica();
  const llegan = m.proximo("bombo", b(2) - 0.1, 0.4);
  const listo = t > llegan;
  const llena = useTL({ a: 0 }, (tl, o) => tl.to(o, { a: 1, duration: 0.5, ease: "expo.out" }, llegan));
  const acerca = m.proximo("caja", b(3.6), 0.4);
  const temas = [
    ["elecciones", 24],
    ["CNE", 17],
    ["consulta popular", 14],
    ["debate", 11],
    ["seguridad", 9],
    ["votación", 8],
    ["alcaldía", 6],
  ] as const;
  const chips = useStagger(temas.length, llegan + 0.1, 0.07, 0.35, "back.out(2)");
  return (
    <Funcion
      n="03"
      sello="ESCUCHA DIGITAL"
      golpes={[llegan]}
      resalta="hoy"
      detalle={{ a: acerca, b: acerca + 1.1, x: 1180, y: 520, zoom: 1.45 }}
      encima={<EnVivo at={b(0.3)} style={{ right: 70, top: 60 }} />}
      titulo="De qué se habla hoy en cada provincia"
      tab={1}
      texto={
        <>
          Lee <b style={{ color: C.tinta }}>medios y X</b> y te muestra lo que más se repite, con enlace a cada publicación.
        </>
      }
      flotante={
        <Tarjeta style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: T, fontSize: 44, color: C.linea }}>59</span>
          <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>
            publicaciones leídas
            <br />
            <span style={{ color: C.rojo }}>pista para reportear</span>
          </span>
        </Tarjeta>
      }
    >
      <div style={{ position: "absolute", inset: "22px 26px", background: C.papel, border: `4px solid ${C.linea}`, padding: "26px 30px" }}>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 22 }}>{listo ? "Manabí · consultado hoy a las 09:41" : <>Buscando de qué se habla en <b>Manabí</b>…</>}</div>
        {fuentes.map((x, i) => {
          const barrido = ((t * 95 + i * 40) % 160) - 40;
          return (
            <div key={x.n} style={{ display: "grid", gridTemplateColumns: "44px 300px 1fr 220px", alignItems: "center", gap: 14, marginBottom: 18, fontSize: 25, fontWeight: 700 }}>
              <span style={{ fontSize: 30 }}>{x.ic}</span>
              <span>{x.n}</span>
              <span style={{ height: 20, background: C.gris, border: `2px solid ${C.linea}`, position: "relative", overflow: "hidden" }}>
                {listo ? <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${llena.a * (x.total / 38) * 100}%`, background: C.linea }} /> : <i style={{ position: "absolute", top: 0, bottom: 0, left: `${barrido}%`, width: "35%", background: C.rojo }} />}
              </span>
              <span style={{ color: listo ? C.tinta : C.suave }}>{listo ? `${x.total} publicaciones` : `Buscando… ${Math.floor(t)} s`}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 30 }}>
          {temas.map(([x, n], i) => (
            <span key={x} style={{ display: "inline-flex", alignItems: "center", gap: 10, border: `3px solid ${C.linea}`, padding: "10px 16px", fontSize: 28, fontWeight: 800, opacity: Math.min(1, chips[i] * 2), transform: `scale(${0.3 + 0.7 * chips[i]})`, background: i === 0 ? C.linea : C.papel, color: i === 0 ? "#fff" : C.tinta }}>
              {x}
              <span style={{ background: i === 0 ? C.amarillo : C.gris, color: C.linea, padding: "0 10px", fontSize: 22 }}>{n}</span>
            </span>
          ))}
        </div>
        <div style={{ position: "absolute", right: 30, bottom: 24, fontSize: 19, color: C.suave, opacity: chips[6] }}>Conversación reciente, no un dato del índice. Temas de ejemplo.</div>
      </div>
    </Funcion>
  );
};

// ---------------------------------------------------------------- 7. compare
const Comparar: React.FC = () => {
  const a = PROV["guayas"];
  const b = PROV["pichincha"];
  const dims = ["Carencias de base", "Dependencia de redes", "Capacidad de contrastar", "Clima electoral"];
  const bt = useB();
  const { periodo } = React.useContext(Ritmo);
  const m = useMusica();
  // The cut lands on a kick: the two halves are already there and SLAM shut on it (the cut into this
  // scene is a hard cut, the split is the entrance). "VS" hits the next strong kick; the split opens
  // on a snare at least ~1.4 s later so it can be read; the card hits the strong kick after that.
  const corte = bt(0);
  const vs = m.proximo("bombo", corte + 0.6, 0.5, 0.45);
  const abre = m.proximo("caja", Math.max(vs + 1.4, corte + 2.2), 0.45);
  const carta = m.proximo("bombo", abre + 0.5, 0.5, 0.5);
  const barras = useStagger(4, abre + 0.1, 0.08, 0.5, "expo.out");
  const d = useTL({ entra: 0, sale: 0, vs: 0 }, (tl, o) => {
    tl.to(o, { entra: 1, duration: 0.12, ease: "power4.out" }, corte - 0.02);
    tl.to(o, { vs: 1, duration: 0.22, ease: "back.out(3)" }, vs - 0.04);
    tl.to(o, { sale: 1, duration: 0.32, ease: "power3.in" }, abre - 0.3);
  });
  const f = useCurrentFrame();
  const t = f / 30;
  const mitad = (p: typeof a, i: number) => (
    <div style={{ position: "absolute", top: 0, bottom: 0, width: "50%", left: i ? "50%" : 0, background: i ? C.naranjaB : C.azulA, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", transform: `translateX(${(i ? 1 : -1) * ((1 - d.entra) * 14 + d.sale * 100)}%)` }}>
      <div style={{ fontFamily: T, fontSize: 130, lineHeight: 1 }}>{p.nombre.toUpperCase()}</div>
      <div style={{ fontFamily: B, fontSize: 34, fontWeight: 800, opacity: 0.9 }}>{p.nivel} · puesto {p.puesto} de 24</div>
    </div>
  );
  const dividida = d.sale < 1 && (
    <AbsoluteFill style={{ zIndex: 40, background: t < abre - 0.3 ? C.linea : "transparent", ...golpeDe(t, [corte, vs], 1.5) }}>
      {mitad(a, 0)}
      {mitad(b, 1)}
      <Objetivos puntos={[{ at: vs, x: 960, y: 540 }]} r={120} claro desde={5} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 220, height: 220, marginLeft: -110, marginTop: -110, borderRadius: "50%", background: C.amarillo, border: `10px solid ${C.linea}`, display: "grid", placeItems: "center", fontFamily: T, fontSize: 110, color: C.linea, transform: `scale(${d.vs * (1 - d.sale)}) rotate(${(1 - d.vs) * -40}deg)` }}>VS</div>
    </AbsoluteFill>
  );
  return (
    <Funcion
      n="04"
      sello="COMPARAR PROVINCIAS"
      golpes={[abre]}
      cartaEn={carta}
      disposicion="centro"
      resalta="frente a frente"
      encima={dividida}
      titulo="Dos territorios, frente a frente"
      tab={5}
      texto={
        <>
          La diferencia en cada factor y <b style={{ color: C.tinta }}>una frase lista para copiar</b> en tu nota.
        </>
      }
      flotante={
        <Tarjeta style={{ maxWidth: 620, borderLeft: `12px solid ${C.rojo}` }}>
          <div style={{ fontFamily: L, fontSize: 28, lineHeight: 1.35 }}>
            Guayas tiene más vulnerabilidad electoral que Pichincha: {coma(a.ivei)} frente a {coma(b.ivei)}.
          </div>
        </Tarjeta>
      }
    >
      <div style={{ position: "absolute", inset: "22px 26px", background: C.papel, border: `4px solid ${C.linea}`, padding: "24px 30px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
          {[a, b].map((p, i) => (
            <div key={p.nombre} style={{ borderTop: `10px solid ${i ? C.naranjaB : C.azulA}`, paddingTop: 12 }}>
              <div style={{ fontFamily: T, fontSize: 48, color: C.linea }}>{p.nombre.toUpperCase()}</div>
              <Odometro valor={p.ivei} at={abre + 0.05} dur={0.9} size={104} />
              <span style={{ display: "inline-block", marginTop: 8, padding: "4px 14px", background: colorDe(p.ivei), border: `2px solid ${C.linea}`, fontSize: 22, fontWeight: 800 }}>{p.nivel}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 30 }}>
          {dims.map((d, i) => (
            <div key={d} style={{ display: "grid", gridTemplateColumns: "300px 1fr", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <span style={{ fontSize: 23, fontWeight: 700 }}>{d}</span>
              <div style={{ display: "grid", gap: 5 }}>
                <i style={{ height: 16, width: `${a.dims[i] * barras[i] * 0.95}%`, background: C.azulA }} />
                <i style={{ height: 16, width: `${b.dims[i] * barras[i] * 0.95}%`, background: C.naranjaB }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Funcion>
  );
};

// ---------------------------------------------------------------- 8. chat + vault
const ChatBoveda: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const msgs = [
    { yo: false, quien: "Redacción Manta", t: "¿Alguien vio el video del recinto en Portoviejo?" },
    { yo: true, quien: "Tú", t: "Lo verificamos con el CNE. Subo el audio a la bóveda." },
    { yo: false, quien: "Redacción Quito", t: "Les paso el contacto de la fuente." },
  ];
  const b = useB();
  const { periodo } = React.useContext(Ritmo);
  const m = useStagger(3, b(0.4), b(2) - b(1.2), 0.3, "back.out(1.8)");
  const archivos = ["audio_fuente.m4a", "acta_recinto.pdf", "capturas.zip"];
  const prog = useStagger(3, b(0.6), 0.35, b(4) - b(1.6), "power1.inOut");
  const mu = useMusica();
  const sello = mu.proximo("bombo", b(4) - 0.1, 0.4, 0.4);
  const candado = t > sello - 0.03;
  const acerca = mu.proximo("caja", b(1.8), 0.4);
  return (
    <Funcion
      n="05"
      sello="CHAT Y BÓVEDA"
      golpes={[sello]}
      cartaEn={sello}
      resalta="pruebas"
      disposicion="izquierda"
      detalle={{ a: acerca, b: acerca + 1.2, x: 470, y: 430, zoom: 1.4 }}
      encima={<SelloTinta at={sello} texto="CIFRADO" rot={-8} size={70} style={{ left: 760, top: 240 }} />}
      titulo="Coordina con colegas. Guarda tus pruebas."
      tab={2}
      texto={
        <>
          Salas por provincia y una bóveda que <b style={{ color: C.tinta }}>cifra en tu navegador</b>: el servidor nunca ve el contenido.
        </>
      }
      flotante={
        <Tarjeta style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={C.linea} strokeWidth="2.2">
            <rect x="4" y="11" width="16" height="10" rx="1" fill={C.amarillo} />
            <path d={candado ? "M8 11V7a4 4 0 0 1 8 0v4" : "M8 11V7a4 4 0 0 1 8 0"} />
          </svg>
          <span style={{ fontFamily: T, fontSize: 40, color: C.linea }}>{candado ? "3 ARCHIVOS CIFRADOS" : "CIFRANDO…"}</span>
        </Tarjeta>
      }
    >
      <div style={{ position: "absolute", inset: "22px 26px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 }}>
        <div style={{ background: C.papel, border: `4px solid ${C.linea}`, padding: 20 }}>
          <div style={{ fontFamily: T, fontSize: 30, color: C.linea, marginBottom: 12 }}>SALA MANABÍ</div>
          {msgs.map((x, i) => (
            <div key={i} style={{ display: "flex", justifyContent: x.yo ? "flex-end" : "flex-start", marginBottom: 12, opacity: m[i], transform: `translateY(${(1 - m[i]) * 30}px) scale(${0.85 + 0.15 * m[i]})`, transformOrigin: x.yo ? "right bottom" : "left bottom" }}>
              <div style={{ maxWidth: 420, padding: "10px 14px", border: `3px solid ${C.linea}`, background: x.yo ? C.linea : C.papel, color: x.yo ? "#fff" : C.tinta }}>
                <div style={{ fontSize: 17, fontWeight: 800, opacity: 0.75 }}>{x.quien}</div>
                <div style={{ fontSize: 22, lineHeight: 1.3 }}>{x.t}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: C.papel, border: `4px solid ${C.linea}`, padding: 20 }}>
          <div style={{ fontFamily: T, fontSize: 30, color: C.linea, marginBottom: 12 }}>BÓVEDA SEGURA</div>
          {archivos.map((a, i) => (
            <div key={a} style={{ border: `3px solid ${C.linea}`, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 21, fontWeight: 700 }}>
                <span>{a}</span>
                <span style={{ color: prog[i] >= 0.999 ? "rgb(26,150,65)" : C.suave }}>{prog[i] >= 0.999 ? "Cifrado ✓" : prog[i] > 0 ? "Cifrando…" : "En espera"}</span>
              </div>
              <div style={{ height: 10, background: C.gris, marginTop: 8 }}>
                <div style={{ height: "100%", width: `${prog[i] * 100}%`, background: C.linea }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Funcion>
  );
};

// ---------------------------------------------------------------- 9. ready-to-paste citation
const Cita: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const texto = `Según OVADE, Bolívar ocupa el puesto 2 de 24 en vulnerabilidad ante la desinformación electoral (${coma(PROV["bolivar"].ivei)} sobre 100). Fuente: INEC, Latinobarómetro y MINTEL, con corte a su última publicación; alcance provincial.`;
  const b = useB();
  const { periodo } = React.useContext(Ritmo);
  const m = useMusica();
  const revela = m.proximo("caja", b(3.1), 0.4);
  const clicT = m.proximo("caja", b(4) - 0.15, 0.4);
  const sello = m.proximo("bombo", clicT + 0.35, 0.5);
  const golpe = golpeDe(t, [revela, clicT, sello]);
  const v = useTL({ clic: 0, toast: 0, cam: 1.25 }, (tl, o) => {
    tl.to(o, { cam: 1, duration: 0.8, ease: "expo.out" }, b(0) - 0.05);
    tl.to(o, { clic: 1, duration: 0.07, yoyo: true, repeat: 1 }, clicT - 0.03);
    tl.to(o, { toast: 1, duration: 0.35, ease: "back.out(2.6)" }, clicT);
  });
  const escrito = escritoEnPlatillos(texto, b(0.5), m.platillos(b(0.5)), b(3), t);
  const n = escrito.length;
  const cifra = `(${coma(PROV["bolivar"].ivei)} sobre 100)`;
  const iCifra = texto.indexOf(cifra);
  const cuerpo =
    n <= iCifra ? (
      escrito
    ) : (
      <>
        {texto.slice(0, iCifra)}
        <Censura revela={revela}>
          <Marcador at={revela + 0.15}>{cifra}</Marcador>
        </Censura>
        {texto.slice(iCifra + cifra.length, n)}
      </>
    );
  return (
    <AbsoluteFill style={{ background: C.papel, ...puntos("#1b2a411c"), overflow: "hidden", fontFamily: B, color: C.tinta }}>
      <AbsoluteFill style={{ transform: `scale(${v.cam})`, ...golpe }}>
        <Objetivos puntos={[{ at: clicT, x: 300, y: 885 }]} r={52} desde={6} />
        <Puntero ruta={[[b(2.6), 1500, 980], [clicT - 0.08, 300, 875]]} clics={[clicT]} />
        <div style={{ position: "absolute", left: 110, top: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <span style={{ fontFamily: T, fontSize: 34, color: C.rojo }}>06</span>
            <Sello>CITA EN 1 CLIC</Sello>
          </div>
          <Titular texto="Copia y pega en tu nota, con fuente" size={92} ancho={1500} at={b(0) + 0.1} resalta="con fuente" />
        </div>
        <div style={{ position: "absolute", left: 110, right: 120, top: 420, background: C.papel, border: `5px solid ${C.linea}`, boxShadow: `12px 12px 0 ${C.linea}`, padding: "34px 40px", fontFamily: L, fontSize: 42, lineHeight: 1.45, minHeight: 260 }}>
          {cuerpo}
          <span style={{ opacity: f % 16 < 8 && n < texto.length ? 1 : 0 }}>▍</span>
        </div>
        <div style={{ position: "absolute", left: 110, top: 840, display: "flex", alignItems: "center", gap: 34 }}>
          <div style={{ fontFamily: T, fontSize: 44, background: C.rojo, color: "#fff", padding: "14px 36px", border: `4px solid ${C.linea}`, boxShadow: `${7 - 5 * v.clic}px ${7 - 5 * v.clic}px 0 ${C.linea}`, transform: `translate(${5 * v.clic}px, ${5 * v.clic}px)`, position: "relative" }}>
            COPIAR CITA
            {/* touch ripple, as in the app */}
            {t > clicT && t < clicT + 0.8 && <i style={{ position: "absolute", left: "50%", top: "50%", width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: "50%", border: "4px solid #fff", opacity: 1 - (t - clicT) / 0.8, transform: `scale(${1 + (t - clicT) * 9})` }} />}
          </div>
          <div style={{ opacity: v.toast, transform: `translateY(${(1 - v.toast) * 30}px) scale(${0.7 + 0.3 * v.toast})`, background: C.linea, color: "#fff", padding: "16px 28px", fontSize: 32, fontWeight: 800, boxShadow: `6px 6px 0 ${C.rojo}` }}>✓ Copiado: pégalo en tu nota</div>
        </div>
        <SelloTinta at={sello} texto="CON FUENTE" rot={-12} size={80} style={{ right: 150, top: 330 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 9b. web and phone
/** The phone version of the start screen, drawn at phone size (390 x 844). */
const Celular: React.FC<{ toque: number }> = ({ toque }) => (
  <div style={{ width: 390, height: 844, borderRadius: 54, background: "#0b0f16", padding: 14, boxShadow: `12px 12px 0 ${C.linea}, 0 50px 100px rgba(0,0,0,.5)`, border: "3px solid #2a3446" }}>
    <div style={{ width: "100%", height: "100%", borderRadius: 42, overflow: "hidden", background: C.papel, position: "relative", fontFamily: B, ...puntos("#1b2a4117") }}>
      <div style={{ position: "absolute", top: 10, left: "50%", width: 110, height: 30, marginLeft: -55, borderRadius: 20, background: "#0b0f16", zIndex: 2 }} />
      <div style={{ background: C.linea, color: "#fff", padding: "54px 16px 0", borderBottom: `4px solid ${C.rojo}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Marca size={26} />
          <span style={{ fontFamily: T, fontSize: 22, letterSpacing: 1 }}>OVADE</span>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 13, fontWeight: 800 }}>
          {["Mi nota", "Escucha", "Chat", "Bóveda", "Mapa"].map((x, i) => (
            <span key={x} style={{ padding: "6px 0 8px", borderBottom: i === 0 ? "4px solid #fff" : "4px solid transparent", opacity: i === 0 ? 1 : 0.75 }}>{x}</span>
          ))}
        </div>
      </div>
      <div style={{ margin: 14, background: C.papel, border: `3px solid ${C.linea}`, boxShadow: `5px 5px 0 ${C.linea}`, padding: 16 }}>
        <Sello size={14}>DATOS ABIERTOS</Sello>
        <div style={{ fontFamily: T, fontSize: 40, lineHeight: 1.1, margin: "6px 0" }}>¿Qué es OVADE?</div>
        <div style={{ fontSize: 15, lineHeight: 1.4 }}>
          Un mapa de Ecuador que muestra <b>dónde la desinformación electoral encuentra más terreno</b>.
        </div>
        <div style={{ marginTop: 14, background: C.rojo, color: "#fff", border: `3px solid ${C.linea}`, boxShadow: `${4 - 3 * toque}px ${4 - 3 * toque}px 0 ${C.linea}`, transform: `translate(${3 * toque}px, ${3 * toque}px)`, padding: "10px 12px" }}>
          <div style={{ fontFamily: T, fontSize: 24 }}>IDEAS PARA TU NOTICIA →</div>
        </div>
      </div>
      <div style={{ margin: "0 14px", background: C.papel, border: `3px solid ${C.linea}`, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.rojo }}>DATO DEL DÍA · BOLÍVAR</div>
        <div style={{ fontFamily: L, fontSize: 16, lineHeight: 1.35, marginTop: 4 }}>2.ª de 24 provincias en vulnerabilidad: {coma(PROV["bolivar"].ivei)} sobre 100.</div>
      </div>
      <svg viewBox={`0 0 ${PATHS.width} ${PATHS.height}`} style={{ position: "absolute", left: 60, bottom: 10, width: 270 }}>
        {Object.keys(PATHS.mainland).map((k) => (
          <path key={k} d={PATHS.mainland[k]} fill={colorDe(PROV[k].ivei)} stroke={C.linea} strokeWidth={1.4} />
        ))}
      </svg>
    </div>
  </div>
);

const WebYCelular: React.FC = () => {
  const b = useB();
  const { periodo } = React.useContext(Ritmo);
  // web lands with the cut, the title is typed, the phone lands on a kick, chips on the next strong one
  const m = useMusica();
  const celEn = m.proximo("bombo", b(2) - 0.1, 0.4, 0.4);
  const chipsEn = m.proximo("bombo", b(4) - 0.1, 0.4, 0.4);
  const toqueEn = m.proximo("caja", b(5), 0.45);
  const v = useTL({ web: 0, cel: 0, chip0: 0, chip1: 0, toque: 0, cam: 1.06 }, (tl, o) => {
    tl.to(o, { cam: 1, duration: 4, ease: "none" }, 0);
    tl.to(o, { web: 1, duration: 0.7, ease: "expo.out" }, b(0) - 0.05);
    tl.to(o, { cel: 1, duration: 0.3, ease: "power3.in" }, celEn - 0.3);
    tl.to(o, { chip0: 1, duration: 0.3, ease: "back.out(2.6)" }, chipsEn - 0.03);
    tl.to(o, { chip1: 1, duration: 0.4, ease: "power3.out" }, chipsEn + 0.3);
    tl.to(o, { toque: 1, duration: 0.07, yoyo: true, repeat: 1 }, toqueEn - 0.03);
  });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 60% 45%, #24385a 0%, ${C.noche} 72%)`, overflow: "hidden", fontFamily: B }}>
      <div style={{ position: "absolute", inset: 0, ...puntos("#ffffff0e") }} />
      <AbsoluteFill style={{ transform: `scale(${v.cam})`, ...golpeDe(useCurrentFrame() / 30, [celEn, chipsEn]) }}>
        <div style={{ position: "absolute", left: 100, top: 90, width: 700 }}>
          <Titular texto="En la web y en tu celular" size={110} color="#fff" ancho={700} at={b(0) + 0.1} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18, marginTop: 34 }}>
            <div style={{ opacity: v.chip0, transform: `scale(${0.5 + 0.5 * v.chip0})`, transformOrigin: "left center" }}>
              <Sello size={36}>SIN INSTALAR NADA</Sello>
            </div>
            <div style={{ opacity: v.chip1, transform: `translateX(${(1 - v.chip1) * -40}px)`, fontFamily: T, fontSize: 64, color: "#fff", textShadow: `5px 5px 0 ${C.rojo}` }}>OVADE.LAT</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 780, top: 170, perspective: 2200 }}>
          <div style={{ transform: `translate3d(${(1 - v.web) * 500}px, 0, ${(1 - v.web) * -600}px) rotateY(${-16 + (1 - v.web) * -30}deg)`, opacity: Math.min(1, v.web * 2), transformOrigin: "left center", filter: `blur(${v.cel * 3}px) brightness(${1 - v.cel * 0.25})` }}>
            <Navegador tab={4} w={980} h={640}>
              <svg viewBox={`0 0 ${PATHS.width} ${PATHS.height}`} style={{ position: "absolute", left: 280, top: 10, height: "96%" }}>
                {Object.keys(PATHS.mainland).map((k) => (
                  <path key={k} d={PATHS.mainland[k]} fill={colorDe(PROV[k].ivei)} stroke={C.linea} strokeWidth={1.2} />
                ))}
              </svg>
              <div style={{ position: "absolute", left: 26, top: 22, fontFamily: T, fontSize: 70, color: C.rojo }}>
                24 <span style={{ fontSize: 28, color: C.linea }}>PROVINCIAS</span>
              </div>
            </Navegador>
          </div>
        </div>
        <Objetivos puntos={[{ at: celEn, x: 1580, y: 560 }, { at: toqueEn, x: 1585, y: 470 }]} r={44} claro desde={7} />
        <div style={{ position: "absolute", left: 1400, top: 150, transform: `translateY(${(1 - v.cel) * 900}px) rotate(${(1 - v.cel) * 18 - 4}deg) scale(0.92)`, transformOrigin: "center bottom" }}>
          <Celular toque={v.toque} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 10. fast montage
const MONTAJE: [string, string, string][] = [
  ["MAPA", C.linea, "#fff"],
  ["IDEAS", C.rojo, "#fff"],
  ["ESCUCHA", C.amarillo, C.linea],
  ["COMPARA", C.linea, C.amarillo],
  ["CHAT", "#fff", C.linea],
  ["BÓVEDA", C.rojo, "#fff"],
  ["CITA", C.linea, "#fff"],
];
const Montaje: React.FC = () => {
  const f = useCurrentFrame();
  const { cada } = React.useContext(Ritmo);
  const i = Math.min(MONTAJE.length - 1, Math.floor(f / cada));
  const local = f - i * cada;
  const [w, bg, fg] = MONTAJE[i];
  const s = 1.35 - Math.min(1, local / 5) * 0.35;
  return (
    <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, ...puntos(fg === "#fff" ? "#ffffff18" : "#1b2a4120") }} />
      <div style={{ fontFamily: T, fontSize: 340, color: fg, transform: `scale(${s}) skewX(-6deg)`, letterSpacing: 6 }}>{w}</div>
      <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 12 }}>
        {MONTAJE.map((_, k) => (
          <i key={k} style={{ width: 54, height: 8, background: fg, opacity: k <= i ? 1 : 0.25 }} />
        ))}
      </div>
      <Ticker at={0} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- 11. close
const Cierre: React.FC = () => {
  const lineas = ["Datos oficiales.", "Hechos para la redacción.", "Listos para citar."];
  const b = useB();
  const m = useMusica();
  const ctaEn = m.proximo("bombo", b(4) - 0.1, 0.45);
  const { periodo } = React.useContext(Ritmo);
  const v = useTL({ s: 0, giro: -90, cta: 0, url: 0 }, (tl, o) => {
    tl.to(o, { s: 1, giro: 0, duration: 0.9, ease: "expo.out" }, b(0) - 0.05);
    tl.to(o, { cta: 1, duration: 0.4, ease: "back.out(2.4)" }, ctaEn - 0.03);
    tl.to(o, { url: 1, duration: 0.3 }, b(4.5));
  });
  const k = useStagger(3, b(0.8), 0.32, 0.4, "power3.out");
  const f = useCurrentFrame();
  const late = 1;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, #24385a 0%, ${C.noche} 72%)`, color: "#fff", alignItems: "center", justifyContent: "center", fontFamily: B, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, ...puntos("#ffffff0e") }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 16, background: C.rojo }} />
      <div style={{ display: "flex", alignItems: "center", gap: 40, transform: `scale(${0.7 + 0.3 * v.s})`, opacity: v.s, ...golpeDe(f / 30, [ctaEn]) }}>
        <Marca size={190} giro={v.giro} />
        <div style={{ fontFamily: T, fontSize: 200, letterSpacing: 5, textShadow: `8px 8px 0 ${C.rojo}` }}>OVADE</div>
      </div>
      <div style={{ display: "flex", gap: 36, marginTop: 26 }}>
        {lineas.map((x, i) => (
          <div key={x} style={{ fontFamily: T, fontSize: 50, opacity: k[i], transform: `translateY(${(1 - k[i]) * 30}px)`, color: i === 2 ? C.amarillo : "#fff", textTransform: "uppercase" }}>
            {i === 2 ? <Marcador at={b(3)} color={C.rojo}>{x}</Marcador> : x}
          </div>
        ))}
      </div>
      <Trama opacidad={0.05} />
      <div style={{ marginTop: 60, display: "flex", alignItems: "center", gap: 34 }}>
        <div style={{ fontFamily: T, fontSize: 46, background: C.rojo, padding: "16px 38px", border: "4px solid #fff", boxShadow: "8px 8px 0 #000", opacity: v.cta, transform: `scale(${(0.5 + 0.5 * v.cta) * late})` }}>PIDE LA LICENCIA PARA TU MEDIO</div>
        <div style={{ fontSize: 38, fontWeight: 700, opacity: v.url }}>ovade.lat</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- timeline
const ORDEN: React.FC[] = [Gancho, Logo, Presenta, Mapa, Ideas, Escucha, Comparar, ChatBoveda, Cita, WebYCelular, Montaje, Cierre];

// Original track (musica/tema.py, 120 BPM): durations are 15 k + TRANS frames, so every cut lands on a beat.
const ORIGINAL = {
  duraciones: [132, 102, 132, 147, 162, 147, 132, 147, 117, 132, 72, 162],
  ritmo: { gancho: [0.15, 0.77, 1.39, 2.35], cada: 10, periodo: 0.5, inst: INST_ORIGINAL },
  audio: "tema-ovade.wav",
};

// Song demo (musica/analizar.py -> musica/mapa.json). The song is not drawn on screen and does not
// pulse the picture: its accents decide WHERE the impact moments go. Each cut is placed on one of
// the strongest beats (mapa.acentos), within the length each scene needs, by a small search that
// maximises the accents hit. Inside a scene, the impact moments (clicks, reveals, cards) sit on
// even beats from the cut, which are the strong ones in this song; everything else moves freely.
const P = mapa.periodo; // seconds per beat
const total = Math.round(mapa.largo * 30);
const MIN = [8, 4, 6, 6, 7, 6, 5, 6, 6, 6, 4]; // beats each scene needs (the close takes the rest, >= 5)
const MAX = [9, 6, 8, 8, 9, 8, 8, 8, 8, 8, 5];
function elegirCortes(): number[] {
  const A = mapa.acentos;
  const fin = Math.floor((mapa.largo - TRANS / 30) / P) - 5; // last cut leaves >= 5 beats for the close
  // mejor[i][pos]: best accent sum with cut i at beat pos
  let prev = new Map<number, { s: number; camino: number[] }>([[0, { s: 0, camino: [] }]]);
  MIN.forEach((mn, i) => {
    const sig = new Map<number, { s: number; camino: number[] }>();
    prev.forEach((v, pos) => {
      for (let d = mn; d <= MAX[i]; d++) {
        const c = pos + d;
        if (c > fin) break;
        const s = v.s + (A[c] ?? 0) + (c % 4 === 0 ? 0.05 : 0); // tie-break toward bar starts
        if (!sig.has(c) || sig.get(c)!.s < s) sig.set(c, { s, camino: [...v.camino, c] });
      }
    });
    prev = sig;
  });
  return [...prev.values()].sort((a, b) => b.s - a.s)[0].camino;
}
const cortes = elegirCortes();
const inicios = [0, ...cortes.map((b) => Math.round(b * P * 30) - TRANS)];
const CANCION = {
  duraciones: inicios.map((s, i) => (i < inicios.length - 1 ? inicios[i + 1] - s + TRANS : total - s)),
  // hook: the three words slam on beats 0, 2, 4 and the question on 6 (the strong ones)
  ritmo: { gancho: [0.05, 2 * P, 4 * P, 6 * P], cada: (P * 30) / 2, periodo: P, inst: INST_CANCION },
  audio: "cancion-demo.wav",
};


/** Landing of every scene: a short, one-off hit when the wipe ends (scale settles, a quick
 *  decaying shake). Only here and on clicks, never as a steady pulse. */
const Aterriza: React.FC<{ children: React.ReactNode; primera: boolean }> = ({ children, primera }) => {
  const f = useCurrentFrame();
  const t = (f - (primera ? 0 : TRANS)) / 30;
  const k = t >= 0 ? Math.exp(-t * 11) : 0;
  return <AbsoluteFill style={{ transform: `scale(${1 + 0.035 * k}) translate(${Math.sin(t * 95) * 9 * k}px, ${Math.cos(t * 80) * 5 * k}px)` }}>{children}</AbsoluteFill>;
};
const duracion = (d: number[]) => d.reduce((s, x) => s + x, 0) - TRANS * (d.length - 1);
export const DURACION = duracion(ORIGINAL.duraciones);
export const DURACION_CANCION = duracion(CANCION.duraciones);

/** Control strip (review only, never published): one row per instrument, a mark on every event
 *  that drives an effect, and the playhead. Lets you check typing on cymbals, stamps on kicks,
 *  reveals on snares, text on voice phrases. */
const Control: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const { inst } = React.useContext(Ritmo);
  const ventana = 4; // seconds shown around the playhead
  const x = (s: number) => `${((s - t) / ventana + 0.5) * 100}%`;
  const fila = (nombre: string, color: string, ev: number[], y: number, cerca: boolean) => (
    <div key={nombre} style={{ position: "absolute", left: 0, right: 0, top: y, height: 24 }}>
      <span style={{ position: "absolute", left: 8, top: 2, fontSize: 16, fontWeight: 800, color, fontFamily: B, zIndex: 2 }}>{nombre}</span>
      {ev.filter((s) => Math.abs(s - t) < ventana / 2).map((s, i) => (
        <i key={i} style={{ position: "absolute", left: x(s), top: 0, width: 4, height: 24, background: color, opacity: Math.abs(s - t) < 0.05 && cerca ? 1 : 0.55 }} />
      ))}
    </div>
  );
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: "rgba(0,0,0,.82)", zIndex: 100 }}>
      {fila("BOMBO", C.rojo, inst.bombo.map(([s]) => s), 8, true)}
      {fila("CAJA", C.amarillo, inst.caja.map(([s]) => s), 36, true)}
      {fila("PLATILLOS", "#7fd1ff", inst.platillos, 64, true)}
      <div style={{ position: "absolute", left: 0, right: 0, top: 92, height: 24 }}>
        <span style={{ position: "absolute", left: 8, top: 2, fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: B, zIndex: 2 }}>VOZ</span>
        {inst.voz.filter(([a, b]) => b > t - ventana / 2 && a < t + ventana / 2).map(([a, b], i) => (
          <i key={i} style={{ position: "absolute", left: x(a), width: `${((b - a) / ventana) * 100}%`, top: 4, height: 16, background: "#fff", opacity: 0.5 }} />
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, color: "#fff", fontFamily: B, fontSize: 18, paddingLeft: 8 }}>t = {t.toFixed(2)} s</div>
      <i style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 3, background: "#fff" }} />
    </div>
  );
};

export const Trailer: React.FC<{ cancion?: boolean; control?: boolean }> = ({ cancion = false, control = false }) => {
  useFuentes();
  const f = useCurrentFrame();
  const modo = cancion ? CANCION : ORIGINAL;
  const largo = duracion(modo.duraciones);
  const ESCENAS = ORDEN.map((E, i) => [E, modo.duraciones[i]] as const);
  // second at which each scene starts in the whole video (for the music hook)
  const inicioSeg = modo.duraciones.map((_, i) => (modo.duraciones.slice(0, i).reduce((s, d) => s + d, 0) - TRANS * i) / 30);
  const vol = interpolate(f, [0, 3, largo - 45, largo - 1], [0, 0.9, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Ritmo.Provider value={modo.ritmo}>
    <AbsoluteFill style={{ background: C.linea }}>
      <FiltroTinta />
      <Audio src={staticFile(modo.audio)} volume={vol} />
      <TransitionSeries>
        {ESCENAS.flatMap(([E, d], i) => [
          ...(i ? [<TransitionSeries.Transition key={`t${i}`} presentation={TRANSICIONES[i - 1]()} timing={linearTiming({ durationInFrames: TRANS })} />] : []),
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={d}>
            <InicioEscena.Provider value={inicioSeg[i]}>
              <Aterriza primera={i === 0}>
                <E />
              </Aterriza>
            </InicioEscena.Provider>
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
      {control && <Control />}
    </AbsoluteFill>
    </Ritmo.Provider>
  );
};
