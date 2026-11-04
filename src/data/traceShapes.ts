/**
 * D-79 : un dessin à retracer par tour, pour les ordres du concours d'obéissance.
 * Un seul trait par dessin, dans un carré de 0 à 1 (y vers le bas). Formes créées pour Truffe.
 */
import type { TrickId } from './tricks';

export type Pt = { x: number; y: number };

const arc = (cx: number, cy: number, r: number, from: number, to: number, n = 24): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
const P = (...xy: number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) out.push({ x: xy[i] ?? 0, y: xy[i + 1] ?? 0 });
  return out;
};
const wave = (n: number, amp: number): Pt[] => Array.from({ length: 33 }, (_, i) => ({ x: 0.12 + (0.76 * i) / 32, y: 0.5 + amp * Math.sin((i / 32) * n * Math.PI * 2) }));
const star = (): Pt[] => Array.from({ length: 6 }, (_, i) => {
  const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
  return { x: 0.5 + 0.38 * Math.cos(a), y: 0.53 + 0.38 * Math.sin(a) };
});

export const TRACE_SHAPES: Record<TrickId, Pt[]> = {
  sit: P(0.5, 0.15, 0.5, 0.85),
  down: P(0.15, 0.5, 0.85, 0.5),
  roll: [...arc(0.5, 0.32, 0.18, Math.PI, Math.PI * 2.5, 18), ...arc(0.5, 0.68, 0.18, -Math.PI / 2, Math.PI / 2 - Math.PI * 1.5, 18)],
  paw: P(0.3, 0.15, 0.3, 0.85, 0.78, 0.85),
  beg: P(0.2, 0.8, 0.5, 0.2, 0.8, 0.8),
  jump: arc(0.5, 0.72, 0.36, Math.PI, Math.PI * 2),
  spin: arc(0.5, 0.5, 0.34, -Math.PI / 2, Math.PI * 1.5, 32),
  howl: wave(1.5, 0.18),
  dig: P(0.2, 0.2, 0.5, 0.8, 0.8, 0.2),
  sniff: P(0.2, 0.2, 0.8, 0.2, 0.2, 0.8, 0.8, 0.8),
  bark: P(0.3, 0.25, 0.7, 0.25, 0.7, 0.5, 0.45, 0.5, 0.45, 0.85),
  scratch: P(0.12, 0.25, 0.31, 0.78, 0.5, 0.35, 0.69, 0.78, 0.88, 0.25),
  flip: [...P(0.15, 0.8, 0.45, 0.8), ...arc(0.5, 0.5, 0.3, Math.PI / 2, Math.PI / 2 - Math.PI * 2, 28).slice(1), ...P(0.85, 0.8)],
  handstand: P(0.2, 0.85, 0.2, 0.15, 0.8, 0.85, 0.8, 0.15),
  playdead: P(0.15, 0.85, 0.15, 0.6, 0.4, 0.6, 0.4, 0.35, 0.65, 0.35, 0.65, 0.12, 0.88, 0.12),
  dance: star(),
};
