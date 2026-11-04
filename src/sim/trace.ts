/**
 * D-79 : précision d'un tracé retracé par-dessus un dessin (0 à 1).
 * Les deux sont dans le même carré de 0 à 1 ; le sens du trait ne compte pas.
 */
import { BALANCE } from '../data/balance';
import type { Pt } from '../data/traceShapes';

const T = BALANCE.trace;

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + k * dx), p.y - (a.y + k * dy));
}

function distToLine(p: Pt, line: readonly Pt[]): number {
  if (line.length === 1 && line[0]) return Math.hypot(p.x - line[0].x, p.y - line[0].y);
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    if (a && b) best = Math.min(best, distToSegment(p, a, b));
  }
  return best;
}

/** Points régulièrement espacés le long d'une ligne brisée. */
export function resample(line: readonly Pt[], n: number): Pt[] {
  if (line.length === 0) return [];
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] ?? { x: 0, y: 0 };
    const b = line[i + 1] ?? a;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    seg.push(d);
    total += d;
  }
  const first = line[0] ?? { x: 0, y: 0 };
  if (total === 0) return Array.from({ length: n }, () => ({ ...first }));
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    let want = (total * k) / (n - 1);
    let i = 0;
    while (i < seg.length - 1 && want > (seg[i] ?? 0)) want -= seg[i++] ?? 0;
    const a = line[i] ?? first;
    const b = line[i + 1] ?? a;
    const s = seg[i] ?? 0;
    const t = s === 0 ? 0 : Math.min(1, want / s);
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/**
 * Précision : le tracé reste près du dessin (justesse) et passe partout sur le dessin (couverture).
 * La plus faible des deux l'emporte.
 */
export function traceScore(guide: readonly Pt[], drawn: readonly Pt[]): number {
  if (drawn.length < 2 || guide.length < 2) return 0;
  const g = resample(guide, T.samples);
  const d = resample(drawn, T.samples);
  const near = (dist: number): number => (dist <= T.near ? 1 : Math.max(0, 1 - (dist - T.near) / T.falloff));
  const accuracy = d.reduce((a, p) => a + near(distToLine(p, guide)), 0) / d.length;
  const coverage = g.reduce((a, p) => a + (distToLine(p, drawn) <= T.cover ? 1 : 0), 0) / g.length;
  return Math.round(Math.min(accuracy, coverage) * 100) / 100;
}
