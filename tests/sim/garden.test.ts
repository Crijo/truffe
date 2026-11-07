import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { FINDABLE } from '../../src/data/items';
import { migrate } from '../../src/save/migrations';
import { reduce, type GameState } from '../../src/sim/game';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 7, 13, 0);
const G = BALANCE.garden;
const DAY = 24 * 3_600_000;

function advance(s: GameState, ms: number): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
  return s;
}
const mind = (s: GameState) => {
  const m = s.minds[s.save.homeDogIds[0] ?? ''];
  if (!m) throw new Error('aucun chiot');
  return m;
};
const garden = (s: GameState) => reduce(s, { type: 'place/go', place: 'garden' });

describe('D-98 : le jardin', () => {
  it('on y va et on en revient ; gamelles et jouets restent à la maison', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'care/bowl', kind: 'water', at: null });
    s = reduce(s, { type: 'toy/hold', kind: 'ball', at: { x: 0, z: 0.8 } });
    s = reduce(s, { type: 'toy/release', toyId: s.toys[0]?.id ?? '' });
    s = garden(s);
    expect(s.place).toBe('garden');
    expect(s.bowls).toHaveLength(0);
    expect(s.toys).toHaveLength(0);
    expect(s.viewX).toBe(0);
    s = reduce(s, { type: 'place/go', place: 'home' });
    expect(s.place).toBe('home');
  });

  it('chaque jour, quelques petits tas de terre à creuser, les mêmes toute la journée', () => {
    let s = garden(startWithDog(T0, TZ));
    const spots = s.save.garden.spots;
    expect(spots).toHaveLength(G.spots);
    s = garden(reduce(s, { type: 'place/go', place: 'home' }));
    expect(s.save.garden.spots).toEqual(spots);
    s = reduce(s, { type: 'session/resume', now: s.save.lastSeenAt + DAY, tzOffsetMin: TZ });
    s = garden(reduce(s, { type: 'place/go', place: 'home' }));
    expect(s.save.garden.spots.map((p) => p.id)).not.toEqual(spots.map((p) => p.id));
  });

  it('toucher un tas : le chiot y court, creuse, et trouve parfois un trésor', () => {
    let s = garden(startWithDog(T0, TZ));
    const spot = s.save.garden.spots.find((p) => p.item) ?? s.save.garden.spots[0];
    if (!spot) throw new Error('aucun tas');
    s = { ...s, save: { ...s.save, garden: { ...s.save.garden, spots: s.save.garden.spots.map((p) => (p.id === spot.id ? { ...p, item: FINDABLE[0] ?? null } : p)) } } };
    const item = FINDABLE[0] ?? '';
    const before = s.save.inventory[item] ?? 0;
    s = reduce(s, { type: 'garden/dig', spotId: spot.id });
    expect(mind(s).activity).toBe('dig');
    let near = Infinity;
    for (let i = 0; i < 120 && !s.save.garden.spots.find((p) => p.id === spot.id)?.dug; i++) {
      s = advance(s, 100);
      near = Math.hypot(mind(s).pos.x - spot.pos.x, mind(s).pos.z - spot.pos.z);
    }
    const after = s.save.garden.spots.find((p) => p.id === spot.id);
    expect(after?.dug).toBe(true);
    expect(s.save.inventory[item]).toBe(before + 1);
    expect(s.lastDig?.itemId).toBe(item);
    // Il a creusé sur place.
    expect(near).toBeLessThan(0.2);
    // Un tas creusé ne se recreuse pas.
    const again = reduce(s, { type: 'garden/dig', spotId: spot.id });
    expect(mind(again).activity).not.toBe('dig');
  });

  it('au salon, on ne creuse pas', () => {
    let s = garden(startWithDog(T0, TZ));
    const id = s.save.garden.spots[0]?.id ?? '';
    s = reduce(s, { type: 'place/go', place: 'home' });
    s = reduce(s, { type: 'garden/dig', spotId: id });
    expect(mind(s).activity).not.toBe('dig');
  });

  it('au jardin, il fait ses besoins dehors : rien à ramasser au salon', () => {
    let s = garden(startWithDog(T0, TZ));
    s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, lastReliefAt: s.save.lastSeenAt - BALANCE.home.poop.intervalMs - 1000 })) } };
    s = advance(s, 1000);
    expect(s.save.poops).toHaveLength(0);
    expect(s.save.dogs[0]?.lastReliefAt).toBeGreaterThan(T0 - 1000);
  });

  it('migration v9 → v10 : pas encore de tas', () => {
    const s = startWithDog(T0, TZ);
    const old: Record<string, unknown> = { ...s.save, version: 9 };
    delete old.garden;
    expect(migrate(JSON.parse(JSON.stringify(old))).garden).toEqual({ dayKey: '', spots: [] });
  });
});
