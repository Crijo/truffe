import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';
import { createStarterDog } from '../../src/sim/dog';
import { applyOffline } from '../../src/sim/offline';
import type { Dog } from '../../src/sim/state';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TZ = -60;
/** Mardi 3 novembre 2026, 14 h à Paris. */
const T0 = Date.UTC(2026, 10, 3, 13, 0);

const dog = (over: Partial<Dog['needs']> = {}, affection = 50): Dog => {
  const d = createStarterDog(createRng(1));
  return { ...d, affection, needs: { ...d.needs, ...over } };
};

describe('Calcul hors ligne (offline.ts)', () => {
  it('absence de 1 heure : les taux du tableau, énergie au repos', () => {
    const d = applyOffline(dog({ energy: 50 }), T0, T0 + HOUR, TZ);
    expect(d.needs.hunger).toBeCloseTo(76);
    expect(d.needs.thirst).toBeCloseTo(74);
    expect(d.needs.cleanliness).toBeCloseTo(88.5);
    expect(d.needs.energy).toBeCloseTo(70);
    expect(d.affection).toBe(50);
  });

  it('absence de 3 jours : faim, soif et propreté ne descendent pas sous 5', () => {
    const d = applyOffline(dog(), T0, T0 + 3 * DAY, TZ);
    expect(d.needs.hunger).toBe(5);
    expect(d.needs.thirst).toBe(5);
    expect(d.needs.cleanliness).toBe(5); // 90 − 1,5 × 72 < 5
    expect(applyOffline(dog(), T0, T0 + DAY, TZ).needs.cleanliness).toBeCloseTo(90 - 1.5 * 24);
    expect(d.needs.energy).toBe(100);
  });

  it('absence de 30 jours : seules les 72 dernières heures comptent', () => {
    const d30 = applyOffline(dog(), T0, T0 + 30 * DAY, TZ);
    const d3 = applyOffline(dog(), T0, T0 + 72 * HOUR, TZ);
    expect(d30.needs).toEqual(d3.needs);
    for (const k of ['hunger', 'thirst', 'cleanliness'] as const) expect(d30.needs[k]).toBeGreaterThanOrEqual(5);
  });

  it('affection : −1 par jour d’absence, plancher à 20', () => {
    expect(applyOffline(dog({}, 50), T0, T0 + 2 * DAY, TZ).affection).toBe(48);
    expect(applyOffline(dog({}, 21), T0, T0 + 30 * DAY, TZ).affection).toBe(20);
    expect(applyOffline(dog({}, 15), T0, T0 + 30 * DAY, TZ).affection).toBe(15);
  });

  it('changement de jour : la nuit passée compte pour un jour', () => {
    const evening = Date.UTC(2026, 10, 3, 21, 0); // 22 h
    const morning = Date.UTC(2026, 10, 4, 7, 0); // 8 h le lendemain
    expect(applyOffline(dog({}, 50), evening, morning, TZ).affection).toBe(49);
    expect(applyOffline(dog({}, 50), T0, T0 + 3 * HOUR, TZ).affection).toBe(50);
  });

  it('une jauge déjà sous 5 en jeu n’est pas relevée', () => {
    expect(applyOffline(dog({ hunger: 2 }), T0, T0 + HOUR, TZ).needs.hunger).toBe(2);
  });

  it('une horloge qui recule ne change rien', () => {
    const before = dog({ hunger: 30 }, 40);
    expect(applyOffline(before, T0, T0 - 5 * DAY, TZ)).toEqual(before);
  });
});
