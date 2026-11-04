import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { obeyProbability, obedienceMalus } from '../../src/sim/obedience';
import { createRng } from '../../src/sim/rng';

const O = BALANCE.obedience;

describe('SPEC, Obéissance (F-DRE-4)', () => {
  it('l’exemple de la spec : chiot têtu, affection 50, maîtrise 0,5 → P = 0,51', () => {
    expect(obeyProbability({ docility: 0.2, affection: 50, mastery: 0.5, malus: 0 })).toBeCloseTo(0.51, 5);
  });

  it('reste bornée entre 0,10 et 0,98', () => {
    expect(obeyProbability({ docility: 0, affection: 0, mastery: 0, malus: 1 })).toBe(O.min);
    expect(obeyProbability({ docility: 1, affection: 100, mastery: 1, malus: 0 })).toBe(O.max);
  });

  it('malus : 0,20 si faim ou soif urgente, 0,15 si énergie sous 20, 0,10 après 5 ordres en moins d’une minute', () => {
    const ok = { hunger: 80, thirst: 80, energy: 80, recentOrders: 0 };
    expect(obedienceMalus(ok)).toBe(0);
    expect(obedienceMalus({ ...ok, hunger: 10 })).toBeCloseTo(0.2);
    expect(obedienceMalus({ ...ok, thirst: 10 })).toBeCloseTo(0.2);
    expect(obedienceMalus({ ...ok, energy: 19 })).toBeCloseTo(0.15);
    expect(obedienceMalus({ ...ok, recentOrders: 5 })).toBeCloseTo(0.1);
    expect(obedienceMalus({ hunger: 10, thirst: 10, energy: 10, recentOrders: 9 })).toBeCloseTo(0.45);
  });
});

describe('Critère du jalon 3 : têtu et sage diffèrent sur 100 ordres', () => {
  const run = (docility: number, seed: number): number => {
    const rng = createRng(seed);
    let ok = 0;
    for (let i = 0; i < 100; i++) if (rng.next() < obeyProbability({ docility, affection: 50, mastery: 0.3, malus: 0 })) ok++;
    return ok;
  };

  it('le sage obéit nettement plus souvent que le têtu', () => {
    const sage = BALANCE.temperaments.sage.docility;
    const tetu = BALANCE.temperaments.tetu.docility;
    for (let seed = 1; seed <= 20; seed++) expect(run(sage, seed) - run(tetu, seed + 1000)).toBeGreaterThan(5);
    let sum = 0;
    for (let seed = 1; seed <= 20; seed++) sum += run(sage, seed) - run(tetu, seed + 1000);
    expect(sum / 20).toBeCloseTo(100 * 0.3 * (sage - tetu), -1);
  });
});

describe('D-75 : note d’obéissance affichée', () => {
  it('monte avec la maîtrise des tours, l’affection et la docilité', async () => {
    const { dogObedience } = await import('../../src/sim/obedience');
    const base = { traits: { docility: 0.5, energy: 0.5, boldness: 0.5 }, affection: 50, tricks: [{ learned: true, mastery: 0 }] };
    const low = dogObedience(base);
    expect(dogObedience({ ...base, tricks: [{ learned: true, mastery: 1 }] })).toBeGreaterThan(low);
    expect(dogObedience({ ...base, affection: 90 })).toBeGreaterThan(low);
    expect(dogObedience({ ...base, tricks: [] })).toBe(0);
    expect(dogObedience({ ...base, tricks: [{ learned: true, mastery: 1 }, { learned: false, mastery: 0 }] })).toBe(dogObedience({ ...base, tricks: [{ learned: true, mastery: 1 }] }));
  });
});
