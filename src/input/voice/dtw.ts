/** Distance DTW entre deux empreintes, normalisée par la longueur (SPEC, étape 3). */
import { BALANCE } from '../../data/balance';

function frameDist(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
  return Math.sqrt(s);
}

export function dtw(a: readonly (readonly number[])[], b: readonly (readonly number[])[], band = BALANCE.voice.band): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Infinity;
  const w = Math.max(Math.abs(n - m), Math.ceil(band * Math.max(n, m)));
  let prev = new Float64Array(m + 1).fill(Infinity);
  let cur = new Float64Array(m + 1).fill(Infinity);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity);
    const lo = Math.max(1, Math.round((i * m) / n) - w);
    const hi = Math.min(m, Math.round((i * m) / n) + w);
    const ai = a[i - 1] ?? [];
    for (let j = lo; j <= hi; j++) {
      const best = Math.min(prev[j] ?? Infinity, cur[j - 1] ?? Infinity, prev[j - 1] ?? Infinity);
      cur[j] = frameDist(ai, b[j - 1] ?? []) + best;
    }
    [prev, cur] = [cur, prev];
  }
  return (prev[m] ?? Infinity) / (n + m);
}
