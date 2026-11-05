"""
Synthesizes the round timer sounds (assets/sounds/*.wav). Generated here, no
third-party recordings: released as CC0 (see assets/sounds/LICENSE.md).

  python3 scripts/sounds/generate.py

bell.wav        boxing-ring bell, one strike (round starts)
bell-triple.wav three strikes (round ends)
clapper.wav     three wooden knocks (warning before the end)
silence.wav     1 s of silence (looped to keep the audio session alive in the background)
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parents[2] / "assets" / "sounds"

# Inharmonic partials of a struck metal bell: (frequency ratio, amplitude, decay seconds).
BELL_F0 = 820.0
BELL_PARTIALS = [(1.0, 1.0, 1.6), (2.32, 0.55, 1.1), (4.25, 0.32, 0.7), (6.63, 0.18, 0.45), (9.38, 0.09, 0.3)]


def bell_strike(seconds: float) -> list[float]:
    n = int(seconds * RATE)
    rng = random.Random(7)
    out = []
    for i in range(n):
        t = i / RATE
        v = sum(a * math.exp(-t / d) * math.sin(2 * math.pi * BELL_F0 * r * t) for r, a, d in BELL_PARTIALS)
        # Hammer: a few ms of noise at the attack.
        if t < 0.006:
            v += (rng.random() * 2 - 1) * 0.6 * (1 - t / 0.006)
        out.append(v)
    return out


def knock(seconds: float) -> list[float]:
    n = int(seconds * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        env = math.exp(-t / 0.018)
        out.append(env * (0.8 * math.sin(2 * math.pi * 1250 * t) + 0.45 * math.sin(2 * math.pi * 2630 * t)))
    return out


def mix(parts: list[tuple[float, list[float]]], seconds: float) -> list[float]:
    buf = [0.0] * int(seconds * RATE)
    for offset, samples in parts:
        start = int(offset * RATE)
        for i, v in enumerate(samples):
            if start + i < len(buf):
                buf[start + i] += v
    return buf


def write(name: str, samples: list[float], peak: float = 0.89) -> None:
    top = max((abs(v) for v in samples), default=0) or 1.0
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(v / top * peak * 32767)) for v in samples))
    print("wrote", OUT / name)


if __name__ == "__main__":
    strike = bell_strike(2.2)
    write("bell.wav", strike)
    write("bell-triple.wav", mix([(0.0, strike), (0.45, strike), (0.9, strike)], 3.1))
    k = knock(0.12)
    write("clapper.wav", mix([(0.0, k), (0.2, k), (0.4, k)], 0.6))
    with wave.open(str(OUT / "silence.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"\x00\x00" * RATE)
    print("wrote", OUT / "silence.wav")
