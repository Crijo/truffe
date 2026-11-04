import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { reduce, type GameState } from '../../src/sim/game';
import { xpToNext } from '../../src/sim/levels';
import { repsNeeded } from '../../src/sim/tricks';
import { workshopOpen, workshopSequence, WORKSHOP_TRICKS } from '../../src/sim/workshop';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 4, 13, 0);
const W = BALANCE.workshop;

const dog = (s: GameState) => {
  const d = s.save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};
/** XP totale pour atteindre ce niveau. */
const xpFor = (level: number): number => Array.from({ length: level - 1 }, (_, i) => xpToNext(i + 1)).reduce((a, b) => a + b, 0);
const atLevel = (s: GameState, level: number): GameState => ({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, xp: xpFor(level) })) } });
const done = (s: GameState, trickId: (typeof WORKSHOP_TRICKS)[number]) => reduce(s, { type: 'workshop/done', trickId });

describe('D-80 : atelier des tours avancés, ouvert par le niveau du chiot', () => {
  it('les 4 tours combinés, chacun à un niveau du chiot', () => {
    expect([...WORKSHOP_TRICKS].sort()).toEqual(['dance', 'flip', 'handstand', 'playdead']);
    const s = startWithDog(T0, TZ);
    for (const t of WORKSHOP_TRICKS) {
      expect(workshopOpen(dog(atLevel(s, W.levels[t] - 1)), t)).toBe(false);
      expect(workshopOpen(dog(atLevel(s, W.levels[t])), t)).toBe(true);
    }
  });

  it('la suite à mémoriser : des mouvements de base, sans deux fois le même de suite, et reproductible', () => {
    const a = workshopSequence(42, 6);
    expect(a).toHaveLength(6);
    expect(workshopSequence(42, 6)).toEqual(a);
    for (const m of a) expect(W.pads).toContain(m);
    for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
  });

  it('chaque atelier réussi compte comme une répétition ; assez de répétitions et le tour est appris', () => {
    let s = atLevel(startWithDog(T0, TZ), W.levels.flip);
    const need = repsNeeded(dog(s).traits, dog(s).affection);
    for (let i = 1; i < need; i++) {
      s = done(s, 'flip');
      expect(dog(s).tricks.find((t) => t.trickId === 'flip')?.repetitions).toBe(i);
    }
    expect(dog(s).tricks.find((t) => t.trickId === 'flip')?.learned).toBe(false);
    const xp = s.save.xp;
    s = done(s, 'flip');
    expect(dog(s).tricks.find((t) => t.trickId === 'flip')?.learned).toBe(true);
    expect(s.save.xp).toBeGreaterThan(xp);
  });

  it('tour déjà appris : l’atelier fait monter sa maîtrise', () => {
    let s = atLevel(startWithDog(T0, TZ), W.levels.dance);
    const learned = { trickId: 'dance' as const, repetitions: 5, learned: true, mastery: 0.2, command: { label: 'Danse' } };
    s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, tricks: [learned] })) } };
    s = done(s, 'dance');
    expect(dog(s).tricks[0]?.mastery).toBeCloseTo(0.2 + BALANCE.obedience.masteryStep, 5);
  });

  it('niveau trop bas, ou plus de place pour un tour : rien ne se passe', () => {
    const low = startWithDog(T0, TZ);
    expect(done(low, 'flip')).toBe(low);
    let s = atLevel(startWithDog(T0, TZ), W.levels.flip);
    const id = dog(s).id;
    s = { ...s, save: { ...s.save, day: { ...s.save.day, perDog: { [id]: { masterPoints: 0, caresses: 0, newTricks: BALANCE.training.newPerDay, prizeContests: 0 } } } } };
    expect(dog(done(s, 'flip')).tricks).toEqual([]);
  });
});
