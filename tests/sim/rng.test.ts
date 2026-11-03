import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

describe('Rng à graine', () => {
  it('produit la même suite pour la même graine', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('produit des suites différentes pour des graines différentes', () => {
    const a = createRng(1);
    const b = createRng(2);
    const sa = Array.from({ length: 10 }, () => a.next());
    const sb = Array.from({ length: 10 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it('reste dans [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range(a, b) reste dans [a, b) et pick choisit un élément', () => {
    const r = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = r.range(-0.1, 0.1);
      expect(v).toBeGreaterThanOrEqual(-0.1);
      expect(v).toBeLessThan(0.1);
    }
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
  });

  it('reprend exactement là où il s’est arrêté', () => {
    const a = createRng(99);
    a.next();
    a.next();
    const b = createRng(0);
    b.setState(a.getState());
    expect(b.next()).toBe(a.next());
  });
});
