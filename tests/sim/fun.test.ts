import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { migrate } from '../../src/save/migrations';
import { reduce, type GameState } from '../../src/sim/game';
import { awardXp } from '../../src/sim/levels';
import { isUrgent, needLevel, tickNeeds } from '../../src/sim/needs';
import { applyOffline } from '../../src/sim/offline';
import { SAVE_VERSION } from '../../src/sim/state';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 5, 13, 0);
const HOUR = 3_600_000;
const N = BALANCE.needs;

const dog = (s: GameState) => {
  const d = s.save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};
const withFun = (s: GameState, fun: number): GameState => ({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, needs: { ...d.needs, fun } })) } });

describe('D-82 : besoin « Amusement »', () => {
  it('un chiot adopté commence bien amusé', () => {
    expect(dog(startWithDog(T0, TZ)).needs.fun).toBe(BALANCE.start.fun);
  });

  it('l’amusement baisse quand le chiot est éveillé, pas quand il dort', () => {
    const full = { hunger: 100, thirst: 100, cleanliness: 100, energy: 100, fun: 100 };
    expect(tickNeeds(full, HOUR, false).fun).toBeCloseTo(100 - N.perHour.fun);
    expect(tickNeeds(full, HOUR, true).fun).toBe(100);
  });

  it('hors ligne, il baisse plus lentement et pas sous le plancher', () => {
    const d = { ...dog(startWithDog(T0, TZ)), needs: { hunger: 100, thirst: 100, cleanliness: 100, energy: 100, fun: 100 } };
    expect(applyOffline(d, T0, T0 + 2 * HOUR, TZ).needs.fun).toBeCloseTo(100 - 2 * N.perHour.funOffline);
    expect(applyOffline(d, T0, T0 + 70 * HOUR, TZ).needs.fun).toBe(N.offline.floor);
  });

  it('les mots, et un chiot qui s’ennuie beaucoup compte comme un besoin urgent', () => {
    const [a, b, c] = N.words.fun;
    expect(needLevel('fun', a)).toBe('excellent');
    expect(needLevel('fun', b)).toBe('normal');
    expect(needLevel('fun', c)).toBe('watch');
    expect(needLevel('fun', c - 1)).toBe('urgent');
    expect(isUrgent({ hunger: 100, thirst: 100, cleanliness: 100, fun: c - 1 })).toBe(true);
  });

  it('lancer un jouet amuse les chiots de la maison', () => {
    let s = withFun(startWithDog(T0, TZ), 30);
    s = reduce(s, { type: 'toy/hold', kind: 'ball', at: { x: 0, z: 0.8 } });
    const id = s.toys[0]?.id ?? '';
    s = reduce(s, { type: 'toy/throw', toyId: id, vx: 0.5, vz: -1 });
    expect(dog(s).needs.fun).toBe(30 + N.fun.throw);
  });

  it('promenade, dressage et caresses amusent ; nourrir non', () => {
    const s = withFun(startWithDog(T0, TZ), 20);
    const id = dog(s).id;
    expect(awardXp(s.save, id, 'walk').dogs[0]?.needs.fun).toBe(20 + N.fun.gain.walk);
    expect(awardXp(s.save, id, 'trickRepeat').dogs[0]?.needs.fun).toBe(20 + N.fun.gain.trickRepeat);
    expect(awardXp(s.save, id, 'caress').dogs[0]?.needs.fun).toBe(20 + N.fun.gain.caress);
    expect(awardXp(s.save, id, 'meal').dogs[0]?.needs.fun).toBe(20);
    expect(N.fun.gain.walk).toBeGreaterThan(N.fun.gain.caress);
  });

  it('les caresses amusent même quand l’XP des soins est plafonnée', () => {
    const s = withFun(startWithDog(T0, TZ), 20);
    const id = dog(s).id;
    let save = s.save;
    for (let i = 0; i < 200; i++) save = awardXp(save, id, 'caress');
    expect(save.dogs[0]?.needs.fun).toBe(100);
  });

  it('migration v7 → v8 : les chiots existants reçoivent la jauge', () => {
    const s = startWithDog(T0, TZ);
    const old = { ...s.save, version: 7, dogs: s.save.dogs.map((d) => ({ ...d, needs: { hunger: d.needs.hunger, thirst: d.needs.thirst, cleanliness: d.needs.cleanliness, energy: d.needs.energy } })) };
    const m = migrate(JSON.parse(JSON.stringify(old)));
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.dogs[0]?.needs.fun).toBe(BALANCE.start.fun);
  });
});
