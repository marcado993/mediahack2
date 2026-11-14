"""Separates the instruments of the trailer's stretch of the song and lists their events, so each
family of effects follows its own instrument (see src/musica.ts):

  bombo      percussive 30-150 Hz      hard hits: cuts, stamps, magnifier, "VS"
  caja       percussive 1.5-6 kHz      reveals and clicks
  platillos  percussive 6-11 kHz       the pace of typing, the ticker
  voz        harmonic 300 Hz-3 kHz     phrases: when text starts and when the marker underlines
  bajo       harmonic 40-250 Hz        slow depth of camera moves (one value per bar)

Harmonic/percussive separation by median filtering (HPSS): a median along time keeps what is
sustained (voice, bass, chords), a median along frequency keeps what is a short broadband hit
(drums). Run after analizar.py:  py -3.13 musica/instrumentos.py
Adds "inst" to musica/mapa.json and writes out/instrumentos.png.
"""
import json
import wave
from pathlib import Path

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

AQUI = Path(__file__).resolve().parent
SR = 22050
mapa = json.loads((AQUI / "mapa.json").read_text())
inicio, largo, P = mapa["inicio"], mapa["largo"], mapa["periodo"]

with wave.open(str(AQUI / "cancion.wav")) as w:
    x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
x = x[int(inicio * SR) : int((inicio + largo) * SR)]

HOP, NFFT = 256, 2048
fps = SR / HOP
win = np.hanning(NFFT).astype(np.float32)
n = 1 + (len(x) - NFFT) // HOP
S = np.abs(np.stack([np.fft.rfft(x[i * HOP : i * HOP + NFFT] * win) for i in range(n)])).astype(np.float32)
freqs = np.fft.rfftfreq(NFFT, 1 / SR)
t = np.arange(n) / fps + NFFT / 2 / SR


def mediana(A, k, eje):
    """Median filter of width k along one axis, in chunks to keep memory low."""
    pad = [(0, 0), (0, 0)]
    pad[eje] = (k // 2, k // 2)
    Ap = np.pad(A, pad, mode="edge")
    out = np.empty_like(A)
    paso = 256
    if eje == 0:
        for j in range(0, A.shape[1], paso):
            out[:, j : j + paso] = np.median(sliding_window_view(Ap[:, j : j + paso], k, axis=0), axis=-1)
    else:
        for i in range(0, A.shape[0], paso):
            out[i : i + paso] = np.median(sliding_window_view(Ap[i : i + paso], k, axis=1), axis=-1)
    return out


H = mediana(S, 31, 0)  # sustained in time
Pm = mediana(S, 31, 1)  # broadband in frequency
mascara_p = Pm**2 / (H**2 + Pm**2 + 1e-9)
perc = S * mascara_p
arm = S * (1 - mascara_p)


def banda(M, lo, hi):
    b = (freqs >= lo) & (freqs < hi)
    return M[:, b]


def flujo(M):
    L = np.log1p(M * 20)
    d = np.maximum(np.diff(L, axis=0), 0).sum(1)
    d = np.concatenate([[0], d])
    d -= np.convolve(d, np.ones(24) / 24, "same")
    return np.maximum(d, 0)


def picos(env, pct, sep):
    u = np.percentile(env, pct)
    out, ultimo = [], -1e9
    for i in range(1, len(env) - 1):
        if env[i] > u and env[i] >= env[i - 1] and env[i] >= env[i + 1]:
            if t[i] - ultimo < sep:
                if out and env[i] > out[-1][1]:
                    out[-1] = (t[i], env[i])
                    ultimo = t[i]
                continue
            out.append((t[i], env[i]))
            ultimo = t[i]
    m = max((v for _, v in out), default=1)
    return [[round(float(a), 3), round(float(v / m), 3)] for a, v in out]


bombo = picos(flujo(banda(perc, 30, 150)), 90, 0.2)
caja = picos(flujo(banda(perc, 1500, 6000)), 90, 0.2)
platillos = [a for a, _ in picos(flujo(banda(perc, 6000, 11000)), 75, 0.09)]

# bass: harmonic low energy, one value per bar (no per-beat movement)
e_bajo = banda(arm, 40, 250).sum(1)
compases = mapa["compases"] + [largo]
bajo = []
for a, b in zip(compases[:-1], compases[1:]):
    sel = (t >= a) & (t < b)
    bajo.append([round(a, 3), float(e_bajo[sel].mean()) if sel.any() else 0.0])
mx = max(v for _, v in bajo) or 1
bajo = [[a, round(v / mx, 3)] for a, v in bajo]

# voice / melody phrases: harmonic mid energy, smoothed, with hysteresis
e_voz = banda(arm, 300, 3000).sum(1)
k = int(0.25 * fps)
e_voz = np.convolve(e_voz, np.ones(k) / k, "same")
alto, bajo_u = np.percentile(e_voz, 60), np.percentile(e_voz, 42)
frases, dentro, a0 = [], False, 0.0
for i, v in enumerate(e_voz):
    if not dentro and v > alto:
        dentro, a0 = True, t[i]
    elif dentro and v < bajo_u:
        dentro = False
        frases.append([a0, t[i]])
if dentro:
    frases.append([a0, t[-1]])
unidas = []
for a, b in frases:
    if unidas and a - unidas[-1][1] < 0.3:
        unidas[-1][1] = b
    elif b - a >= 0.6:
        unidas.append([a, b])
frases = [[round(float(a), 3), round(float(b), 3)] for a, b in unidas]

# sections: big moves of the total energy (smoothed over 2 s)
e_tot = S.sum(1)
k2 = int(2 * fps)
suave = np.convolve(e_tot, np.ones(k2) / k2, "same")
d = np.gradient(suave)
secciones = []
for i in range(k2, len(d) - k2, int(fps)):
    if abs(d[i]) > np.percentile(np.abs(d), 97):
        secciones.append([round(float(t[i]), 2), 1 if d[i] > 0 else -1])

mapa["inst"] = {"bombo": bombo, "caja": caja, "platillos": platillos, "voz": frases, "bajo": bajo, "secciones": secciones}
(AQUI / "mapa.json").write_text(json.dumps(mapa, indent=1))
print(f"bombo {len(bombo)} · caja {len(caja)} · platillos {len(platillos)} · frases de voz {len(frases)} · secciones {len(secciones)}")
print("frases:", frases)

# ---- picture: each separated band with its events
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

filas = [
    ("Bombo (percusivo 30-150 Hz)", banda(perc, 30, 150), [a for a, _ in bombo], "#d8132b"),
    ("Caja (percusivo 1,5-6 kHz)", banda(perc, 1500, 6000), [a for a, _ in caja], "#ffc20e"),
    ("Platillos (percusivo 6-11 kHz)", banda(perc, 6000, 11000), platillos, "#7fd1ff"),
    ("Voz y melodía (armónico 300 Hz-3 kHz)", banda(arm, 300, 3000), None, "#ffffff"),
    ("Bajo (armónico 40-250 Hz)", banda(arm, 40, 250), None, "#a6d96a"),
]
fig, axs = plt.subplots(len(filas), 1, figsize=(18, 13), sharex=True)
for ax, (nombre, M, ev, col) in zip(axs, filas):
    ax.imshow(np.log1p(M.T * 20), origin="lower", aspect="auto", extent=[t[0], t[-1], 0, 1], cmap="magma")
    ax.set_yticks([])
    ax.set_title(nombre, loc="left", fontsize=11)
    if ev is not None:
        for a in ev:
            ax.axvline(a, color=col, lw=0.8 if col != "#7fd1ff" else 0.4)
for a, b in frases:
    axs[3].axvspan(a, b, color="#ffffff", alpha=0.18)
for a, v in bajo:
    axs[4].hlines(v, a, a + 4 * P, color="#a6d96a", lw=3)
axs[-1].set_xlabel("segundos del tráiler")
fig.tight_layout()
fig.savefig(AQUI.parent / "out" / "instrumentos.png", dpi=80)
