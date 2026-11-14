"""Original newsroom-style theme for the OVADE trailer (no samples, no third-party music).

D minor, 120 BPM: one beat = 0.5 s = 15 video frames. Every scene change of the trailer lands on a
beat (see ESCENAS in src/Trailer.tsx), and gets a brass-like stab and a cymbal swell.
Run:  py -3.13 musica/tema.py   ->  public/tema-ovade.wav
"""
from pathlib import Path

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
TOTAL_BEATS = 96  # 48 s, the length of the video
N = int(SR * TOTAL_BEATS * BEAT) + SR
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)

# scene changes, in beats (frames / 15)
CORTES = [8, 14, 22, 31, 41, 50, 58, 67, 74, 82, 86]
MONTAJE = [82 + k * (10 / 15) for k in range(7)]  # one word every 10 frames


def hz(nota):
    return 440.0 * 2 ** ((nota - 69) / 12)


def t_(dur):
    return np.arange(int(SR * dur)) / SR


def poner(señal, seg, gan=1.0, pan=0.0):
    i = int(seg * SR)
    if i >= N:
        return
    s = señal[: N - i] * gan
    L[i : i + len(s)] += s * (1 - max(0, pan))
    R[i : i + len(s)] += s * (1 + min(0, pan))


def sierra(f, dur, armonicos=14, brillo=1.0):
    t = t_(dur)
    out = np.zeros_like(t)
    for n in range(1, armonicos + 1):
        if f * n > 16000:
            break
        out += np.sin(2 * np.pi * f * n * t) / n * (brillo ** (n - 1))
    return out


def env(dur, a=0.005, d=0.2, sus=0.0, rel=0.05):
    n = int(SR * dur)
    t = np.arange(n) / SR
    e = np.where(t < a, t / a, sus + (1 - sus) * np.exp(-(t - a) / d))
    cola = int(SR * rel)
    if cola and n > cola:
        e[-cola:] *= np.linspace(1, 0, cola)
    return e


def timbal(f0=70, dur=1.2, gan=1.0):
    t = t_(dur)
    f = f0 * (1 + 0.8 * np.exp(-t * 18))
    fase = 2 * np.pi * np.cumsum(f) / SR
    golpe = np.sin(fase) * np.exp(-t * 3.2)
    ruido = rng.standard_normal(len(t)) * np.exp(-t * 40) * 0.25
    return (golpe + ruido) * gan


def bombo(dur=0.4):
    t = t_(dur)
    f = 55 * (1 + 2.5 * np.exp(-t * 35))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def caja(dur=0.25):
    t = t_(dur)
    ruido = rng.standard_normal(len(t))
    ruido = np.convolve(ruido, [1, -0.6], "same")
    return (ruido * np.exp(-t * 22) * 0.55 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4)


def tic(dur=0.03, f=3200):
    t = t_(dur)
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 220)


def platillo(dur=1.8):
    t = t_(dur)
    r = rng.standard_normal(len(t))
    r = r - np.convolve(r, np.ones(6) / 6, "same")  # keep the highs
    return r * np.exp(-t * 2.2) * 0.35


def subida(dur):
    """Noise swell that rises into a cut."""
    t = t_(dur)
    r = rng.standard_normal(len(t))
    r = r - np.convolve(r, np.ones(4) / 4, "same")
    return r * (t / dur) ** 2.5 * 0.4


def acorde_metal(notas, dur=0.9, gan=0.5):
    out = np.zeros(int(SR * dur))
    for k, n in enumerate(notas):
        v = sierra(hz(n) * (1 + 0.002 * (k - 1)), dur, 18, 0.93)
        out += v
    return out * env(dur, a=0.012, d=0.22, sus=0.0, rel=0.1) * gan / len(notas)


def pad(notas, dur, gan=0.18):
    out = np.zeros(int(SR * dur))
    for n in notas:
        for det in (-0.004, 0.004):
            out += sierra(hz(n) * (1 + det), dur, 6, 0.7)
    a = np.minimum(1, t_(dur) / 0.25)
    return out * a * env(dur, a=0.001, d=99, sus=1, rel=0.3) * gan / (2 * len(notas))


def pulso(nota, dur=BEAT / 4, gan=0.22):
    return sierra(hz(nota), dur, 10, 0.8) * env(dur, a=0.002, d=0.05, rel=0.01) * gan


# D minor progression, one chord per bar: Dm  Bb  F  C
ACORDES = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]]
ARPEGIO = [[62, 65, 69, 74], [58, 62, 65, 70], [60, 65, 69, 72], [60, 64, 67, 72]]
BAJO = [38, 34, 41, 36]

seg = lambda beat: beat * BEAT

# ---- intro (beats 0-8): clock ticking, low drone, a timpani on each word of the hook
for k in range(16):
    poner(tic(f=3200 if k % 2 == 0 else 2600), seg(k / 2), 0.35, pan=0.3 if k % 2 else -0.3)
poner(pad([38, 45], seg(8), 0.22), 0)
for s in (0.15, 0.77, 1.39):
    poner(timbal(62, 1.0), s, 0.7)
poner(timbal(55, 1.6), 2.35, 0.95)
poner(acorde_metal([50, 57, 62, 65], 1.2, 0.55), 2.35)
poner(subida(seg(2)), seg(6), 0.8)

# ---- groove (beat 8 to 84)
FIN_GROOVE = 92
for beat in range(8, FIN_GROOVE):
    bar = (beat // 4) % 4
    b = beat % 4
    poner(bombo(), seg(beat), 0.9 if b in (0, 2) else 0.0)
    if beat >= 14 and b in (1, 3):
        poner(caja(), seg(beat), 0.45)
    for k in range(2):
        poner(tic(0.02, 7000), seg(beat + k / 2), 0.12, pan=0.4)
    for k in range(4):
        n = ARPEGIO[bar][k if beat % 2 == 0 else 3 - k]
        poner(pulso(n), seg(beat + k / 4), 0.9 if k == 0 else 0.6, pan=-0.25 if k % 2 else 0.25)
    if b == 0:
        poner(pad(ACORDES[bar], seg(4)), seg(beat))
    if b in (0, 2):
        poner(sierra(hz(BAJO[bar]), BEAT * 0.9, 8, 0.6) * env(BEAT * 0.9, a=0.004, d=0.25, sus=0.3, rel=0.05), seg(beat), 0.35)

# ---- scene changes: stab + cymbal; a swell rising into each one
for c in CORTES:
    bar = (c // 4) % 4
    notas = [n + 12 for n in ACORDES[bar]] + [ACORDES[bar][0] + 24]
    poner(acorde_metal(notas, 0.8, 0.5), seg(c))
    poner(platillo(), seg(c), 0.8)
    poner(subida(seg(1)), seg(c - 1), 0.45)

# logo: the big hit
poner(timbal(48, 2.5), seg(8), 1.0)
poner(acorde_metal([38, 50, 57, 62, 65], 2.0, 0.7), seg(8))

# montage: a hit on every word
for i, m in enumerate(MONTAJE):
    poner(timbal(70 - i * 2, 0.5), seg(m), 0.6)
    poner(acorde_metal([62 + (i % 3) * 2, 69], 0.3, 0.35), seg(m))

# close: last hit, held chord, fade
poner(timbal(45, 3.0), seg(86), 1.0)
poner(acorde_metal([38, 50, 57, 62, 65, 69], 3.0, 0.75), seg(86))
poner(pad([38, 50, 53, 57], seg(10), 0.25), seg(86))
poner(timbal(45, 3.0), seg(92), 0.9)
poner(acorde_metal([38, 50, 57, 62], 3.0, 0.6), seg(92))
poner(platillo(3.0), seg(92), 0.9)


# ---- a little room: short reverb by convolution with decaying noise
def sala(x, dur=1.1, mezcla=0.18):
    ir = rng.standard_normal(int(SR * dur)) * np.exp(-np.arange(int(SR * dur)) / SR * 4.5)
    n = len(x) + len(ir)
    m = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]
    y /= np.max(np.abs(y)) + 1e-9
    return x + y * mezcla * np.max(np.abs(x))


L, R = sala(L), sala(R)
largo = int(SR * TOTAL_BEATS * BEAT)
L, R = L[:largo], R[:largo]
cola = int(SR * 2.5)
L[-cola:] *= np.linspace(1, 0, cola)
R[-cola:] *= np.linspace(1, 0, cola)
pico = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = np.tanh(L / pico * 1.4) * 0.89, np.tanh(R / pico * 1.4) * 0.89  # gentle saturation and headroom

estereo = (np.stack([L, R], axis=1) * 32767).astype("<i2")
salida = Path(__file__).resolve().parents[1] / "public" / "tema-ovade.wav"
import wave

with wave.open(str(salida), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(estereo.tobytes())
print(salida, f"{largo / SR:.1f} s")
