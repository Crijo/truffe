import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { migrate } from '../../src/save/migrations';
import { reduce, type GameState } from '../../src/sim/game';
import { awardXp, levelOf, xpToNext } from '../../src/sim/levels';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 4, 13, 0);
const L = BALANCE.levels;

const dog = (s: GameState) => {
  const d = s.save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};
function advance(s: GameState, ms: number): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
  return s;
}
function withNeeds(s: GameState, needs: Partial<GameState['save']['dogs'][number]['needs']>): GameState {
  return { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, needs: { ...d.needs, ...needs } })) } };
}

describe('D-78 : niveaux du joueur et de chaque chiot', () => {
  it('niveau 1 à 0 XP ; chaque niveau demande un peu plus que le précédent', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: xpToNext(1) });
    expect(xpToNext(2)).toBeGreaterThan(xpToNext(1));
    const two = xpToNext(1);
    expect(levelOf(two - 1).level).toBe(1);
    expect(levelOf(two).level).toBe(2);
    expect(levelOf(two + xpToNext(2)).level).toBe(3);
    expect(levelOf(10_000_000).level).toBe(L.maxLevel);
  });

  it('une partie neuve : joueur et chiot au niveau 1', () => {
    const s = startWithDog(T0, TZ);
    expect(s.save.xp).toBe(0);
    expect(dog(s).xp).toBe(0);
  });

  it('l’XP va au joueur et au chiot', () => {
    const s = startWithDog(T0, TZ);
    const save = awardXp(s.save, dog(s).id, 'walk');
    expect(save.xp).toBe(L.xp.walk);
    expect(save.dogs[0]?.xp).toBe(L.xp.walk);
  });

  it('les soins rapportent un tout petit peu, plafonné par jour ; les activités davantage, sans plafond', () => {
    const s = startWithDog(T0, TZ);
    const id = dog(s).id;
    expect(L.xp.meal).toBeLessThan(L.xp.trickRepeat);
    expect(L.xp.caress).toBeLessThan(L.xp.walk);
    let save = s.save;
    for (let i = 0; i < 200; i++) save = awardXp(save, id, 'caress');
    expect(save.xp).toBe(L.dailyCareXp);
    for (let i = 0; i < 10; i++) save = awardXp(save, id, 'trickRepeat');
    expect(save.xp).toBe(L.dailyCareXp + 10 * L.xp.trickRepeat);
  });

  it('un nouveau niveau du joueur rapporte des pièces', () => {
    const s = startWithDog(T0, TZ);
    const coins = s.save.coins;
    const save = awardXp(s.save, dog(s).id, 'walk', Math.ceil(xpToNext(1) / L.xp.walk));
    expect(levelOf(save.xp).level).toBe(2);
    expect(save.coins).toBe(coins + L.playerLevelCoins * 2);
  });

  it('nourrir un chiot qui a faim rapporte de l’XP', () => {
    let s = withNeeds(startWithDog(T0, TZ), { hunger: 30 });
    s = reduce(s, { type: 'care/bowl', kind: 'food', at: { x: 0.3, z: 0.7 } });
    s = advance(s, 20_000);
    expect(s.bowls).toHaveLength(0);
    expect(dog(s).xp).toBeGreaterThanOrEqual(L.xp.meal);
  });

  it('migration : l’XP de départ reprend les points de maître déjà gagnés', () => {
    const s = startWithDog(T0, TZ);
    const old: Record<string, unknown> = { ...s.save, version: 6, masterPoints: 900 };
    delete old.xp;
    const raw = { ...old, dogs: s.save.dogs.map((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'xp'))) };
    const m = migrate(JSON.parse(JSON.stringify(raw)));
    expect(m.xp).toBe(900);
    expect(m.dogs[0]?.xp).toBe(900);
  });
});
