import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { reduce, type GameState } from '../../src/sim/game';
import { stepBonus } from '../../src/sim/walk';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 3, 13, 0);
const S = BALANCE.walk.steps;

function advance(s: GameState, ms: number): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
  return s;
}
function walkAll(s: GameState, steps: number): GameState {
  for (let i = 0; i < 3000 && s.walk && !s.walk.finished; i++) {
    if (i < steps) s = reduce(s, { type: 'walk/steps', count: 1 });
    if (s.walk?.poop && !s.walk.poop.picked) s = reduce(s, { type: 'walk/pickup' });
    if (s.walk?.pause?.kind === 'place') s = reduce(s, { type: 'walk/continue' });
    s = advance(s, 100);
  }
  return s;
}
const route = ['2-5', '2-4', '2-3', '2-2', '3-2'];

describe('D-81 : les vrais pas du joueur, en bonus de la promenade', () => {
  it('le bonus suit les pas, plafonné', () => {
    expect(stepBonus(0)).toEqual({ points: 0, xp: 0 });
    expect(stepBonus(S.perPoint - 1).points).toBe(0);
    expect(stepBonus(S.perPoint * 3).points).toBe(3);
    expect(stepBonus(1_000_000).points).toBe(S.maxPoints);
    expect(stepBonus(1_000_000).xp).toBe(S.maxXp);
  });

  it('les pas comptés pendant la promenade s’ajoutent aux gains', () => {
    const start = (st: GameState) => reduce(st, { type: 'walk/start', route, now: st.save.lastSeenAt });
    const still = walkAll(start(startWithDog(T0, TZ)), 0);
    const walked = walkAll(start(startWithDog(T0, TZ)), S.perPoint * 4);
    expect(walked.walk?.steps).toBe(S.perPoint * 4);
    expect(walked.save.masterPoints - still.save.masterPoints).toBe(stepBonus(S.perPoint * 4).points);
    expect(walked.save.xp).toBeGreaterThan(still.save.xp);
  });

  it('hors promenade, les pas ne comptent pas', () => {
    const s = startWithDog(T0, TZ);
    expect(reduce(s, { type: 'walk/steps', count: 30 })).toBe(s);
  });
});
