import { describe, expect, it } from 'vitest';
import { NEED_WORDS } from '../../src/data/strings';
import { isNight, isUrgent, needLevel, tickNeeds } from '../../src/sim/needs';

const HOUR = 3_600_000;
const full = { hunger: 80, thirst: 80, cleanliness: 90, energy: 100, fun: 80 };

describe('Jauges en jeu (SPEC, Jauges)', () => {
  it('faim −4/h, soif −6/h, propreté −1,5/h, énergie −15/h éveillé', () => {
    const n = tickNeeds(full, HOUR, false);
    expect(n.hunger).toBeCloseTo(76);
    expect(n.thirst).toBeCloseTo(74);
    expect(n.cleanliness).toBeCloseTo(88.5);
    expect(n.energy).toBeCloseTo(85);
  });

  it('énergie +20/h en dormant', () => {
    expect(tickNeeds({ ...full, energy: 40 }, HOUR, true).energy).toBeCloseTo(60);
  });

  it('s’accumule pas à pas comme en une fois', () => {
    let n = full;
    for (let i = 0; i < 36_000; i++) n = tickNeeds(n, 100, false);
    expect(n.hunger).toBeCloseTo(76, 5);
  });

  it('reste entre 0 et 100', () => {
    const n = tickNeeds({ hunger: 1, thirst: 1, cleanliness: 1, energy: 99, fun: 1 }, 10 * HOUR, true);
    expect(n.hunger).toBe(0);
    expect(n.thirst).toBe(0);
    expect(n.cleanliness).toBe(0);
    expect(n.energy).toBe(100);
  });
});

describe('F-SOIN-4 : mots de la fiche, jamais de pourcentage', () => {
  it('seuils de la faim et de la soif : 75, 40, 15', () => {
    expect(needLevel('hunger', 75)).toBe('excellent');
    expect(needLevel('hunger', 74.9)).toBe('normal');
    expect(needLevel('hunger', 40)).toBe('normal');
    expect(needLevel('thirst', 39)).toBe('watch');
    expect(needLevel('thirst', 15)).toBe('watch');
    expect(needLevel('thirst', 14)).toBe('urgent');
  });

  it('seuils du pelage : 90, 40, 15', () => {
    expect(needLevel('cleanliness', 90)).toBe('excellent');
    expect(needLevel('cleanliness', 89)).toBe('normal');
    expect(needLevel('cleanliness', 39)).toBe('watch');
    expect(needLevel('cleanliness', 14)).toBe('urgent');
  });

  it('les mots de la spec', () => {
    expect(NEED_WORDS.hunger.excellent).toBe('Repu');
    expect(NEED_WORDS.hunger.watch).toBe('A faim');
    expect(NEED_WORDS.hunger.urgent).toBe('Affamé');
    expect(NEED_WORDS.thirst.excellent).toBe('Désaltéré');
    expect(NEED_WORDS.thirst.watch).toBe('A soif');
    expect(NEED_WORDS.thirst.urgent).toBe('Assoiffé');
    expect(NEED_WORDS.cleanliness.excellent).toBe('Superbe');
    expect(NEED_WORDS.cleanliness.watch).toBe('Sale');
    expect(NEED_WORDS.cleanliness.urgent).toBe('Très sale');
    for (const kind of Object.values(NEED_WORDS)) for (const w of Object.values(kind)) expect(w).not.toMatch(/\d|%/);
  });

  it('un besoin urgent : faim, soif ou pelage sous 15', () => {
    expect(isUrgent(full)).toBe(false);
    expect(isUrgent({ ...full, thirst: 10 })).toBe(true);
    expect(isUrgent({ ...full, cleanliness: 10 })).toBe(true);
  });
});

describe('F-VIE-1 : la nuit, de 22 h à 7 h, heure locale', () => {
  const TZ = -60; // Paris en hiver
  const at = (h: number, m = 0) => Date.UTC(2026, 10, 3, h - 1, m);
  it('suit l’heure locale', () => {
    expect(isNight(at(21, 59), TZ)).toBe(false);
    expect(isNight(at(22), TZ)).toBe(true);
    expect(isNight(at(3), TZ)).toBe(true);
    expect(isNight(at(6, 59), TZ)).toBe(true);
    expect(isNight(at(7), TZ)).toBe(false);
    expect(isNight(at(14), TZ)).toBe(false);
  });
});
