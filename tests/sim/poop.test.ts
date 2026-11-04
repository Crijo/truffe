import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { migrate } from '../../src/save/migrations';
import { createNewGame, reduce, type GameState } from '../../src/sim/game';
import { SAVE_VERSION } from '../../src/sim/state';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 4, 11, 0);
const H = 3_600_000;
const P = BALANCE.home.poop;

const resume = (s: GameState, at: number): GameState => reduce(s, { type: 'session/resume', now: at, tzOffsetMin: TZ });
function advance(s: GameState, ms: number): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
  return s;
}

describe('Besoins dans la maison (D-74)', () => {
  it('pas de besoin tant que le délai n’est pas passé', () => {
    const s = resume(startWithDog(T0, TZ), T0 + P.intervalMs - H);
    expect(s.save.poops).toEqual([]);
  });

  it('après le délai, le chiot fait ses besoins au salon (en jeu ou pendant l’absence)', () => {
    const away = resume(startWithDog(T0, TZ), T0 + P.intervalMs + H);
    expect(away.save.poops).toHaveLength(1);
    expect(away.save.poops[0]?.dogId).toBe(away.save.dogs[0]?.id);
    let s = startWithDog(T0, TZ);
    s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, lastReliefAt: T0 - P.intervalMs + 2000 })) } };
    s = advance(s, 3000);
    expect(s.save.poops).toHaveLength(1);
    expect(s.minds[s.save.dogs[0]?.id ?? '']?.events.map((e) => e.type)).toContain('sniffGround');
  });

  it('au plus trois à la fois', () => {
    let s = startWithDog(T0, TZ);
    for (let i = 1; i <= 6; i++) s = resume(s, T0 + i * (P.intervalMs + H));
    expect(s.save.poops.length).toBeLessThanOrEqual(P.max);
  });

  it('ramasser : +5 points, et ça disparaît', () => {
    let s = resume(startWithDog(T0, TZ), T0 + P.intervalMs + H);
    const id = s.save.poops[0]?.id ?? '';
    const before = s.save.masterPoints;
    s = reduce(s, { type: 'poop/pickup', poopId: id });
    expect(s.save.poops).toEqual([]);
    expect(s.save.masterPoints).toBe(before + P.pickupPoints);
  });

  it('oublier de ramasser : −5 une seule fois, et les mouches arrivent', () => {
    let s = startWithDog(T0, TZ);
    s = { ...s, save: { ...s.save, masterPoints: 100 } };
    s = resume(s, T0 + P.intervalMs + H);
    s = resume(s, s.save.lastSeenAt + P.forgetMs + 1000);
    expect(s.save.poops.some((p) => p.forgotten)).toBe(true);
    expect(s.save.masterPoints).toBe(100 + P.forgetPoints);
    s = resume(s, s.save.lastSeenAt + P.forgetMs);
    expect(s.save.masterPoints).toBe(100 + P.forgetPoints);
  });

  it('une promenade terminée remet le délai à zéro', () => {
    let s = startWithDog(T0, TZ);
    s = { ...s, save: { ...s.save, lastSeenAt: T0 + 3 * H } };
    s = reduce(s, { type: 'walk/start', route: ['2-5', '2-4'], now: s.save.lastSeenAt });
    s = advance(s, 120_000);
    expect(s.walk?.finished).toBe(true);
    expect(s.save.dogs[0]?.lastReliefAt).toBeGreaterThanOrEqual(T0 + 3 * H);
  });

  it('migration v5 → v6', () => {
    const g = createNewGame(1000, 1);
    const v5: Record<string, unknown> = { ...g, version: 5, dogs: [{ id: 'x', lastSeen: 1 }] };
    delete v5.poops;
    const out = migrate(v5);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.poops).toEqual([]);
    expect(out.dogs[0]?.lastReliefAt).toBe(g.lastSeenAt);
  });
});
