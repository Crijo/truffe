import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { TRACE_SHAPES, type Pt } from '../../src/data/traceShapes';
import { TRICK_IDS } from '../../src/data/tricks';
import { orderObedience, startObedience } from '../../src/sim/contest/obedience';
import { traceScore } from '../../src/sim/trace';
import { startWithDog } from './fixtures';

const T = BALANCE.trace;
const shift = (line: Pt[], dx: number, dy: number): Pt[] => line.map((p) => ({ x: p.x + dx, y: p.y + dy }));

describe('D-79 : dessins à retracer en concours', () => {
  it('un dessin par tour, d’un seul trait, dans le carré', () => {
    for (const id of TRICK_IDS) {
      const s = TRACE_SHAPES[id];
      expect(s.length, id).toBeGreaterThanOrEqual(2);
      for (const p of s) {
        expect(p.x, id).toBeGreaterThanOrEqual(0);
        expect(p.x, id).toBeLessThanOrEqual(1);
        expect(p.y, id).toBeGreaterThanOrEqual(0);
        expect(p.y, id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gribouiller partout ou tracer un autre dessin ne suffit pas, en moyenne', () => {
    const scribble: Pt[] = Array.from({ length: 41 }, (_, i) => ({ x: i % 2 === 0 ? 0.05 : 0.95, y: 0.05 + (0.9 * i) / 40 }));
    for (const id of TRICK_IDS) {
      expect(traceScore(TRACE_SHAPES[id], scribble), id).toBeLessThan(T.minScore);
      const others = TRICK_IDS.filter((o) => o !== id).map((o) => traceScore(TRACE_SHAPES[id], TRACE_SHAPES[o]));
      expect(others.reduce((x, y) => x + y, 0) / others.length, id).toBeLessThan(T.minScore);
      expect(traceScore(TRACE_SHAPES[id], TRACE_SHAPES[id]), id).toBe(1);
    }
  });

  it('retracer exactement : 1 ; dans l’autre sens aussi ; un peu à côté : moins ; à moitié : refusé', () => {
    const g = TRACE_SHAPES.spin;
    expect(traceScore(g, g)).toBe(1);
    expect(traceScore(g, [...g].reverse())).toBe(1);
    const off = traceScore(g, shift(g, 0.07, 0.03));
    expect(off).toBeLessThan(1);
    expect(off).toBeGreaterThanOrEqual(T.minScore);
    expect(traceScore(g, g.slice(0, Math.floor(g.length / 2)))).toBeLessThan(T.minScore);
    expect(traceScore(g, [{ x: 0.5, y: 0.5 }])).toBe(0);
  });

  it('un ordre bien retracé rapporte un bonus de précision', () => {
    const s = startWithDog(Date.UTC(2026, 10, 4, 13), -60);
    const learned = { trickId: 'sit' as const, repetitions: 5, learned: true, mastery: 1, command: { label: 'Assis' } };
    const d0 = s.save.dogs[0];
    if (!d0) throw new Error('aucun chien');
    const dog = { ...d0, affection: 100, traits: { docility: 1, energy: 0.5, boldness: 0.5 }, tricks: [learned] };
    const run = startObedience(dog, 0, 7);
    const plain = orderObedience(run, 'sit');
    const traced = orderObedience(run, 'sit', 1);
    expect(plain.results[0]?.ok).toBe(true);
    expect(traced.score - plain.score).toBe(BALANCE.contests.obedience.traceBonus);
    expect(orderObedience(run, 'sit', 0.5).score - plain.score).toBe(Math.round(BALANCE.contests.obedience.traceBonus * 0.5));
  });
});
