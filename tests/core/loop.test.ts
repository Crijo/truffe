import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../../src/core/loop';
import { BALANCE } from '../../src/data/balance';

describe('Boucle à pas fixe (Temps et sauvegarde)', () => {
  it('avance la simulation par pas de 100 ms', () => {
    expect(BALANCE.time.simStepMs).toBe(100);
    const steps: number[] = [];
    const s = new FixedStepper(100, 10, (dt) => steps.push(dt));
    s.advance(250);
    expect(steps).toEqual([100, 100]);
    s.advance(60);
    expect(steps).toEqual([100, 100, 100]);
  });

  it('fait autant de pas quelle que soit la cadence d’affichage', () => {
    let at60 = 0;
    let at30 = 0;
    const a = new FixedStepper(100, 10, () => at60++);
    const b = new FixedStepper(100, 10, () => at30++);
    for (let i = 0; i < 60; i++) a.advance(1000 / 60);
    for (let i = 0; i < 30; i++) b.advance(1000 / 30);
    expect(at60).toBe(at30);
  });

  it('limite le rattrapage après une longue pause (le calcul hors ligne prend le relais)', () => {
    let n = 0;
    const s = new FixedStepper(100, 10, () => n++);
    s.advance(60_000);
    expect(n).toBe(10);
    s.advance(100);
    expect(n).toBe(11);
  });

  it('ignore un temps négatif', () => {
    let n = 0;
    const s = new FixedStepper(100, 10, () => n++);
    s.advance(-500);
    s.advance(100);
    expect(n).toBe(1);
  });

  it('expose l’interpolation entre deux pas pour le rendu', () => {
    const s = new FixedStepper(100, 10, () => undefined);
    s.advance(150);
    expect(s.alpha).toBeCloseTo(0.5);
  });
});
