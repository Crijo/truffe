/**
 * Empreinte vocale (SPEC, Reconnaissance vocale) : 13 coefficients MFCC par fenêtre
 * de 25 ms, avec un pas de 10 ms. Tout est calculé sur l'appareil ; aucun son n'est envoyé.
 */
import { BALANCE } from '../../data/balance';

const V = BALANCE.voice;

/** FFT complexe en place (radix 2), longueur puissance de 2. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = (re[b] ?? 0) * cr - (im[b] ?? 0) * ci;
        const xi = (re[b] ?? 0) * ci + (im[b] ?? 0) * cr;
        re[b] = (re[a] ?? 0) - xr;
        im[b] = (im[a] ?? 0) - xi;
        re[a] = (re[a] ?? 0) + xr;
        im[a] = (im[a] ?? 0) + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

const mel = (hz: number): number => 2595 * Math.log10(1 + hz / 700);
const hzOf = (m: number): number => 700 * (10 ** (m / 2595) - 1);

const banks = new Map<string, Float64Array[]>();
/** Banc de filtres triangulaires sur l'échelle des mels. */
function filterbank(nfft: number, sr: number): Float64Array[] {
  const key = `${nfft}-${sr}`;
  const cached = banks.get(key);
  if (cached) return cached;
  const bins = nfft / 2 + 1;
  const hi = Math.min(V.maxHz, sr / 2);
  const lo = mel(V.minHz);
  const pts = Array.from({ length: V.melFilters + 2 }, (_, i) => hzOf(lo + ((mel(hi) - lo) * i) / (V.melFilters + 1)));
  const bin = pts.map((f) => (f * nfft) / sr);
  const out: Float64Array[] = [];
  for (let m = 1; m <= V.melFilters; m++) {
    const f = new Float64Array(bins);
    const a = bin[m - 1] ?? 0;
    const b = bin[m] ?? 0;
    const c = bin[m + 1] ?? 0;
    for (let k = 0; k < bins; k++) {
      if (k > a && k <= b) f[k] = (k - a) / (b - a || 1);
      else if (k > b && k < c) f[k] = (c - k) / (c - b || 1);
    }
    out.push(f);
  }
  banks.set(key, out);
  return out;
}

/** Coefficients MFCC bruts, une ligne par trame. */
export function mfcc(x: Float32Array, sr: number): number[][] {
  const frame = Math.round((sr * V.frameMs) / 1000);
  const hop = Math.round((sr * V.hopMs) / 1000);
  let nfft = 1;
  while (nfft < frame) nfft <<= 1;
  const fb = filterbank(nfft, sr);
  const win = Float64Array.from({ length: frame }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frame - 1)));
  const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = (x[i] ?? 0) - V.preEmphasis * (i > 0 ? (x[i - 1] ?? 0) : 0);
  const M = V.melFilters;
  const out: number[][] = [];
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  const logE = new Float64Array(M);
  for (let start = 0; start + frame <= y.length; start += hop) {
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < frame; i++) re[i] = (y[start + i] ?? 0) * (win[i] ?? 0);
    fft(re, im);
    for (let m = 0; m < M; m++) {
      const f = fb[m];
      let e = 0;
      if (f) for (let k = 0; k < f.length; k++) if (f[k]) e += (f[k] ?? 0) * (((re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2) / nfft);
      logE[m] = Math.log(Math.max(e, 1e-10));
    }
    const row: number[] = [];
    for (let n = 0; n < V.coeffs; n++) {
      let c = 0;
      for (let m = 0; m < M; m++) c += (logE[m] ?? 0) * Math.cos((Math.PI * n * (m + 0.5)) / M);
      row.push(c * Math.sqrt((n === 0 ? 1 : 2) / M));
    }
    out.push(row);
  }
  return out;
}

/** Garde la parole : le volume dépasse le seuil de parole (SPEC, étape 1). */
export function trimSilence(x: Float32Array, sr: number): Float32Array | null {
  const step = Math.round(sr / 100);
  const rms: number[] = [];
  for (let i = 0; i + step <= x.length; i += step) {
    let s = 0;
    for (let k = i; k < i + step; k++) s += (x[k] ?? 0) ** 2;
    rms.push(Math.sqrt(s / step));
  }
  const peak = Math.max(0, ...rms);
  if (peak < 0.005) return null;
  const thr = Math.max(peak * V.speechRatio, 0.003);
  const first = rms.findIndex((r) => r >= thr);
  let last = rms.length - 1;
  while (last > first && (rms[last] ?? 0) < thr) last--;
  const a = Math.max(0, first - 3) * step;
  const b = Math.min(x.length, (last + 4) * step);
  if (((b - a) / sr) * 1000 < V.minSpeechMs) return null;
  return x.slice(a, b);
}

/**
 * Empreinte d'un enregistrement : parole seule, MFCC, moyenne retirée
 * (le timbre du micro et le volume comptent moins). Null s'il n'y a pas de parole.
 */
export function features(x: Float32Array, sr: number): number[][] | null {
  const speech = trimSilence(x, sr);
  if (!speech) return null;
  const m = mfcc(speech, sr);
  if (m.length < 5) return null;
  const mean = new Array<number>(V.coeffs).fill(0);
  for (const row of m) row.forEach((v, i) => (mean[i] = (mean[i] ?? 0) + v / m.length));
  return m.map((row) => row.map((v, i) => Math.round((v - (mean[i] ?? 0)) * 100) / 100));
}
