// Original background music for the promo videos, synthesised in code (no
// samples, nothing that can get a copyright claim). An upbeat, light groove:
//   hook      chords + hats (the beat kicks in on the pain line)
//   steps     full groove, a soft "pop" as each step appears
//   result    a bright chime
//   end card  last chord rings out
// `cues` are the scene-change times (seconds); `variant` picks the key so
// consecutive days don't sound the same.
import { writeFile } from "node:fs/promises";

const SR = 44100;
const BPM = 104;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const KEYS = [
  { root: 60, chords: [[0, "M"], [7, "M"], [9, "m"], [5, "M"]] },  // C G Am F
  { root: 62, chords: [[0, "M"], [-5, "M"], [-3, "m"], [-7, "M"]] }, // D A Bm G
  { root: 57, chords: [[0, "m"], [-4, "M"], [3, "M"], [-2, "M"]] },  // Am F C G
  { root: 65, chords: [[0, "M"], [-3, "m"], [-7, "M"], [-5, "M"]] }, // F Dm Bb C
];
const triad = (q) => (q === "m" ? [0, 3, 7] : [0, 4, 7]);
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1; }

export async function writeMusic(file, { duration, beatFrom = 3, pops = [], chimeAt = null, variant = 0 }) {
  const n = Math.ceil(duration * SR);
  const out = new Float32Array(n);
  const key = KEYS[variant % KEYS.length];
  const noise = rng(1234 + variant);
  const add = (start, len, fn, gain = 1) => {
    const a = Math.max(0, Math.floor(start * SR)), b = Math.min(n, Math.floor((start + len) * SR));
    for (let i = a; i < b; i++) out[i] += gain * fn((i - a) / SR);
  };
  const env = (t, atk, len, rel) => (t < atk ? t / atk : t > len - rel ? Math.max(0, (len - t) / rel) : 1);

  const bars = Math.ceil(duration / BAR) + 1;
  for (let b = 0; b < bars; b++) {
    const start = b * BAR;
    const [off, q] = key.chords[b % key.chords.length];
    const len = BAR + 0.15;
    for (const m of triad(q).map((x) => key.root + off + x)) {
      const f = midi(m);
      add(start, len, (t) => env(t, 0.08, len, 0.4) * (Math.sin(2 * Math.PI * f * t) + 0.45 * Math.sin(2 * Math.PI * f * 1.004 * t) + 0.2 * Math.sin(2 * Math.PI * f * 2 * t)), 0.026);
    }
    // Plucked arpeggio on the off-beats for a bright, "productive" feel.
    triad(q).concat([12, 7]).forEach((x, k) => {
      const f = midi(key.root + off + 12 + x);
      add(start + (k * 2 + 1) * (BEAT / 2), 0.4, (t) => Math.exp(-9 * t) * Math.sin(2 * Math.PI * f * t), 0.035);
    });
    const fb = midi(key.root + off - 24);
    for (const beat of [0, 1.5, 2, 3.5]) {
      const st = start + beat * BEAT;
      if (st < beatFrom) continue;
      add(st, BEAT * 1.2, (t) => Math.exp(-3 * t) * (Math.sin(2 * Math.PI * fb * t) + 0.3 * Math.sin(2 * Math.PI * 2 * fb * t)), 0.11);
    }
  }

  const eighths = Math.ceil(duration / (BEAT / 2));
  for (let s = 0; s < eighths; s++) {
    const st = s * (BEAT / 2);
    add(st, 0.05, (t) => Math.exp(-80 * t) * noise(), s % 2 ? 0.05 : 0.035);
    if (st < beatFrom || st > duration - 2) continue;
    const k = s % 8;
    if (k === 0 || k === 3 || k === 4) add(st, 0.3, (t) => Math.exp(-10 * t) * Math.sin(2 * Math.PI * (50 + 70 * Math.exp(-30 * t)) * t), 0.32);
    if (k === 2 || k === 6) add(st, 0.18, (t) => Math.exp(-20 * t) * (0.7 * noise() + 0.3 * Math.sin(2 * Math.PI * 200 * t)), 0.13);
  }

  for (const p of pops) add(p, 0.12, (t) => Math.exp(-40 * t) * Math.sin(2 * Math.PI * (880 + 600 * Math.exp(-30 * t)) * t), 0.16);
  if (chimeAt != null) {
    const [off, q] = key.chords[0];
    triad(q).concat([12]).forEach((x, k) => {
      const f = midi(key.root + off + 12 + x);
      add(chimeAt + k * 0.05, 2, (t) => Math.exp(-2.4 * t) * Math.sin(2 * Math.PI * f * t), 0.1);
    });
  }

  // Loudness ~-15 dB RMS, soft limiter, peaks at -1 dB, short fades.
  let sum = 0;
  for (let i = 0; i < n; i++) sum += out[i] * out[i];
  const gain = 10 ** (-15 / 20) / (Math.sqrt(sum / n) || 1e-9);
  let peak = 0;
  for (let i = 0; i < n; i++) { out[i] = Math.tanh(out[i] * gain); peak = Math.max(peak, Math.abs(out[i])); }
  const scale = peak > 0 ? Math.min(1, 0.89 / peak) : 1;
  const fadeOut = Math.floor(0.8 * SR);
  for (let i = 0; i < n; i++) {
    let v = out[i] * scale;
    if (i > n - fadeOut) v *= (n - i) / fadeOut;
    if (i < 0.05 * SR) v *= i / (0.05 * SR);
    out[i] = v;
  }

  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
  await writeFile(file, buf);
  return file;
}
