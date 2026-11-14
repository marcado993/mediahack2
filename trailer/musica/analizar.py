"""Beat map of a song for the trailer: tempo, beats, bars, kick/snare hits and the most energetic
stretch of the right length. Writes musica/mapa.json and out/espectrograma.png.
Run:  py -3.13 musica/analizar.py   (needs musica/cancion.wav, mono 22050 Hz)
"""
import json
import wave
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
SR = 22050
LARGO = 48.0  # seconds of the trailer

with wave.open(str(AQUI / "cancion.wav")) as w:
    x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float) / 32768

HOP, NFFT = 512, 2048
fps_o = SR / HOP
ventana = np.hanning(NFFT)
n = 1 + (len(x) - NFFT) // HOP
S = np.abs(np.stack([np.fft.rfft(x[i * HOP : i * HOP + NFFT] * ventana) for i in range(n)]))  # frames x bins
freqs = np.fft.rfftfreq(NFFT, 1 / SR)
logS = np.log1p(S * 10)


def flujo(lo, hi):
    b = (freqs >= lo) & (freqs < hi)
    d = np.diff(logS[:, b], axis=0)
    o = np.maximum(d, 0).sum(1)
    o = np.concatenate([[0], o])
    o -= np.convolve(o, np.ones(16) / 16, "same")  # local mean removed
    return np.maximum(o, 0)


onset = flujo(30, 11000)
bombo = flujo(30, 150)
caja = flujo(1500, 6000)

# ---- tempo: autocorrelation of the onset envelope, 75-180 BPM, with a mild bias toward ~120
ac = np.correlate(onset - onset.mean(), onset - onset.mean(), "full")[len(onset) - 1 :]
lags = np.arange(len(ac))
bpm_de = lambda lag: 60 * fps_o / lag
cand = [(ac[l] * np.exp(-0.5 * (np.log2(bpm_de(l) / 120) / 0.9) ** 2), l) for l in range(int(60 * fps_o / 180), int(60 * fps_o / 75))]
lag = max(cand)[1]
# refine with parabolic interpolation
a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
lag_f = lag + 0.5 * (a - c) / (a - 2 * b + c)
bpm = bpm_de(lag_f)
periodo = 60 / bpm

# ---- beat phase: the offset whose comb of beats collects the most onset energy
t_o = np.arange(len(onset)) / fps_o
mejor = None
for fase in np.arange(0, periodo, 0.005):
    ts = np.arange(fase, t_o[-1], periodo)
    idx = np.clip(np.round(ts * fps_o).astype(int), 0, len(onset) - 1)
    puntaje = onset[idx].sum()
    if mejor is None or puntaje > mejor[0]:
        mejor = (puntaje, fase)
fase = mejor[1]
beats = np.arange(fase, t_o[-1], periodo)

# downbeat: the beat (mod 4) with the strongest kick
idx = np.clip(np.round(beats * fps_o).astype(int), 0, len(bombo) - 1)
fuerza_k = [bombo[idx[k::4]].mean() for k in range(4)]
d0 = int(np.argmax(fuerza_k))
compases = beats[d0::4]

# ---- energy per beat (RMS), to find the most energetic 44 s starting on a bar
rms = np.sqrt(np.convolve(x**2, np.ones(SR // 10) / (SR // 10), "same"))
energia = lambda t0, t1: rms[int(t0 * SR) : int(t1 * SR)].mean()
opciones = [(energia(t, t + LARGO), t) for t in compases if t + LARGO < len(x) / SR - 1]
# prefer a stretch that also starts right after a quieter moment (a section change)
puntuadas = []
for e, t in opciones:
    antes = energia(max(0, t - 4 * periodo), t)
    puntuadas.append((e + 0.25 * max(0, e - antes), t))
inicio = max(puntuadas)[1]

# ---- second pass, inside the chosen stretch only: a phase fitted to the whole song can sit between
# the hits here (tempo drift, intros, edits). Refit the phase on this stretch, then start the stretch
# exactly on the strongest attack near its start (a drop or a section entry), or on INICIO if given.
import os

def fase_en(t0, t1):
    mejor = None
    for f in np.arange(0, periodo, 0.004):
        ts = np.arange(t0 + f, t1, periodo)
        idx = np.clip(np.round(ts * fps_o).astype(int), 0, len(onset) - 1)
        p = onset[idx].sum()
        if mejor is None or p > mejor[0]:
            mejor = (p, t0 + f)
    return mejor[1]

if os.getenv("INICIO"):
    inicio = float(os.getenv("INICIO"))
else:
    # strongest attack (whole band + energy jump) within 2 s of the energy-chosen start
    i0, i1 = int(max(0, inicio - 2) * fps_o), int((inicio + 2) * fps_o)
    salto = np.array([max(0.0, energia(t_o[i], t_o[i] + 0.2) - energia(t_o[i] - 0.4, t_o[i] - 0.05)) for i in range(i0, i1)])
    puntaje = onset[i0:i1] / (onset[i0:i1].max() + 1e-9) + salto / (salto.max() + 1e-9)
    inicio = float(t_o[i0 + int(np.argmax(puntaje))])
ancla = fase_en(inicio - 0.5 * periodo, inicio + LARGO)
# beats of the stretch: the refitted grid, shifted so that one beat falls exactly on `inicio`
k = round((inicio - ancla) / periodo)
desfase = inicio - (ancla + k * periodo)
if abs(desfase) < 0.12:  # the attack is on the grid: keep the grid, start on that beat
    inicio = ancla + k * periodo
beats = np.arange(inicio - 8 * periodo, inicio + LARGO + periodo, periodo)
idx = np.clip(np.round(beats * fps_o).astype(int), 0, len(bombo) - 1)
fuerza_k = [bombo[idx[j::4]].mean() for j in range(4)]
d0 = int(np.argmax(fuerza_k))
compases = beats[d0::4]

# ---- strong hits inside the chosen stretch
def picos(env, t0, t1, umbral_pct=92, sep=0.18):
    i0, i1 = int(t0 * fps_o), int(t1 * fps_o)
    seg = env[i0:i1]
    u = np.percentile(seg, umbral_pct)
    out, ultimo = [], -9
    for i in range(1, len(seg) - 1):
        if seg[i] > u and seg[i] >= seg[i - 1] and seg[i] >= seg[i + 1] and (i - ultimo) / fps_o > sep:
            out.append(round((i0 + i) / fps_o - t0, 3))
            ultimo = i
    return out

rel = lambda arr: [round(t - inicio, 3) for t in arr if inicio <= t < inicio + LARGO]
mapa = {
    "bpm": round(bpm, 2),
    "periodo": round(periodo, 4),
    "inicio": round(inicio, 3),
    "largo": LARGO,
    "beats": rel(beats),
    "compases": rel(compases),
    "bombos": picos(bombo, inicio, inicio + LARGO),
    "cajas": picos(caja, inicio, inicio + LARGO),
}

# ---- accents: how hard each beat of the stretch hits (whole band + kick + snare + energy jump),
# 0..1. The trailer puts its impact moments (cuts, clicks, reveals) on the strongest ones,
# not on every beat.
def golpe(env, t, ancho=3):
    i = int(round(t * fps_o))
    return env[max(0, i - ancho) : i + ancho + 1].max()

fuerzas = []
for t in [x + inicio for x in mapa["beats"]]:
    salto = max(0.0, energia(t, t + 0.15) - energia(t - 0.3, t - 0.05))
    fuerzas.append(golpe(onset, t) / onset.max() + 0.6 * golpe(bombo, t) / bombo.max() + 0.6 * golpe(caja, t) / caja.max() + 8 * salto)
fuerzas = np.array(fuerzas)
mapa["acentos"] = [round(float(x), 3) for x in fuerzas / fuerzas.max()]
(AQUI / "mapa.json").write_text(json.dumps(mapa, indent=1))
print(f"BPM {bpm:.1f} · tramo desde {int(inicio // 60)}:{inicio % 60:04.1f} · {len(mapa['beats'])} beats, {len(mapa['compases'])} compases")

# ---- spectrogram with the chosen stretch and the beat grid
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(16, 8), gridspec_kw={"height_ratios": [2, 1]})
banda = freqs < 8000
ax1.imshow(logS[:, banda].T, origin="lower", aspect="auto", extent=[0, t_o[-1], 0, 8000], cmap="magma")
ax1.axvspan(inicio, inicio + LARGO, color="#ffc20e", alpha=0.18)
ax1.set_title(f"Espectrograma completo · {bpm:.1f} BPM · tramo elegido (amarillo) {int(inicio // 60)}:{inicio % 60:04.1f}–{int((inicio + LARGO) // 60)}:{(inicio + LARGO) % 60:04.1f}")
ax1.set_ylabel("Hz")
i0, i1 = int(inicio * fps_o), int((inicio + LARGO) * fps_o)
tt = t_o[i0:i1] - inicio
ax2.plot(tt, onset[i0:i1] / onset[i0:i1].max(), color="#1b2a41", lw=0.8)
for t in mapa["compases"]:
    ax2.axvline(t, color="#d8132b", lw=1.2)
for t in mapa["beats"]:
    ax2.axvline(t, color="#d8132b", lw=0.3, alpha=0.5)
ax2.set_xlim(0, LARGO)
ax2.set_title("Tramo del tráiler: golpes (líneas finas) y compases (líneas gruesas)")
ax2.set_xlabel("segundos del tráiler")
fig.tight_layout()
(AQUI.parent / "out").mkdir(exist_ok=True)
fig.savefig(AQUI.parent / "out" / "espectrograma.png", dpi=90)
