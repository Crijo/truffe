import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { migrate } from '../../src/save/migrations';
import { reduce, type GameState } from '../../src/sim/game';
import { tickNeeds } from '../../src/sim/needs';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 5, 13, 0);
const C = BALANCE.chores;
const HOUR = 3_600_000;

function advance(s: GameState, ms: number): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
  return s;
}
const dirt = (s: GameState) => s.save.dirt;
/** Un salon avec quelques taches posées à la main. */
function dirty(n: number): GameState {
  const s = startWithDog(T0, TZ);
  const spots = Array.from({ length: n }, (_, i) => ({ id: `d${i}`, kind: 'fur' as const, pos: { x: -0.5 + i * 0.2, z: 0.6 }, size: 1, at: T0 }));
  return { ...s, save: { ...s.save, dirt: spots } };
}
function scrubAll(s: GameState): GameState {
  for (const d of dirt(s)) for (let px = 0; px < C.scrubPx; px += 20) s = reduce(s, { type: 'chores/scrub', dirtId: d.id, px: 20 });
  return s;
}

describe('D-91 : le salon se salit', () => {
  it('une partie neuve commence avec un salon propre', () => {
    expect(dirt(startWithDog(T0, TZ))).toEqual([]);
  });

  it('une promenade finie ramène des traces de pattes, venues de la porte', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'walk/start', route: ['2-5', '2-4', '2-3'], now: s.save.lastSeenAt });
    s = reduce(s, { type: 'walk/finish' });
    s = reduce(s, { type: 'walk/close' });
    const paws = dirt(s).filter((d) => d.kind === 'paw');
    expect(paws.length).toBeGreaterThanOrEqual(C.walkPaws);
    expect(Math.max(...paws.map((p) => p.pos.x))).toBeGreaterThan(1);
  });

  it('avec le temps, des poils s’accumulent, jamais plus de taches que le maximum', () => {
    let s = startWithDog(T0, TZ);
    // En jeu : un pas de temps après 4 h (une absence de 4 h compte pareil, D-91).
    s = advance({ ...s, save: { ...s.save, dirtClockAt: s.save.lastSeenAt - C.furEveryMs } }, 200);
    expect(dirt(s).some((d) => d.kind === 'fur')).toBe(true);
    s = reduce(s, { type: 'session/resume', now: s.save.lastSeenAt + 30 * 24 * HOUR, tzOffsetMin: TZ });
    expect(dirt(s).length).toBe(C.maxSpots);
  });

  it('un salon très sale salit le pelage plus vite', () => {
    const n = { hunger: 80, thirst: 80, cleanliness: 80, energy: 80, fun: 80 };
    const clean = tickNeeds(n, HOUR, false);
    const messy = tickNeeds(n, HOUR, false, true);
    expect(80 - messy.cleanliness).toBeCloseTo((80 - clean.cleanliness) * C.dirtyRoomDecay);
  });
});

describe('D-91 : mini-jeu du ménage', () => {
  it('frotter une tache à l’éponge l’efface', () => {
    let s = reduce(dirty(2), { type: 'chores/start' });
    expect(s.chores).not.toBeNull();
    s = reduce(s, { type: 'chores/scrub', dirtId: 'd0', px: C.scrubPx / 2 });
    expect(dirt(s).find((d) => d.id === 'd0')?.size).toBeCloseTo(0.5);
    s = reduce(s, { type: 'chores/scrub', dirtId: 'd0', px: C.scrubPx / 2 });
    expect(dirt(s).map((d) => d.id)).toEqual(['d1']);
    expect(s.chores?.cleaned).toBe(1);
  });

  it('sans ménage commencé, frotter ne fait rien', () => {
    const s = reduce(dirty(1), { type: 'chores/scrub', dirtId: 'd0', px: C.scrubPx });
    expect(dirt(s)).toHaveLength(1);
  });

  it('tout nettoyer à temps : points par tache, bonus, et XP du joueur', () => {
    let s = reduce(dirty(4), { type: 'chores/start' });
    const pts = s.save.masterPoints;
    const xp = s.save.xp;
    s = scrubAll(s);
    s = reduce(s, { type: 'chores/end' });
    expect(s.chores).toBeNull();
    expect(s.choresResult).toEqual({ cleaned: 4, points: 4 * C.pointsPerSpot + C.bonus, bonus: true });
    expect(s.save.masterPoints).toBe(pts + 4 * C.pointsPerSpot + C.bonus);
    expect(s.save.xp).toBe(xp + 4 * BALANCE.levels.player.chores);
  });

  it('trop lent : pas de bonus, mais chaque tache compte', () => {
    let s = reduce(dirty(2), { type: 'chores/start' });
    s = advance(s, C.limitMs + 1000);
    s = scrubAll(s);
    s = reduce(s, { type: 'chores/end' });
    expect(s.choresResult).toEqual({ cleaned: 2, points: 2 * C.pointsPerSpot, bonus: false });
  });

  it('migration v8 → v9 : salon propre', () => {
    const s = startWithDog(T0, TZ);
    const old: Record<string, unknown> = { ...s.save, version: 8 };
    delete old.dirt;
    delete old.dirtClockAt;
    const m = migrate(JSON.parse(JSON.stringify(old)));
    expect(m.dirt).toEqual([]);
    expect(m.dirtClockAt).toBe(s.save.lastSeenAt);
  });
});
