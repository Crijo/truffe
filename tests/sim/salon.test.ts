import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { reduce, type GameState } from '../../src/sim/game';
import type { PuppyMind } from '../../src/sim/behavior';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 5, 13, 0);
const R = BALANCE.puppy.roam;

function advance(s: GameState, ms: number, each?: (s: GameState) => void): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) {
    s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
    if (each && t % 1000 === 0) each(s);
  }
  return s;
}
function adoptOne(s: GameState, name: string): GameState {
  s = reduce({ ...s, save: { ...s.save, coins: s.save.coins + 5000 } }, { type: 'kennel/open', breedId: 'beagle' });
  return reduce(s, { type: 'adopt', index: 0, name, now: s.save.lastSeenAt, tzOffsetMin: TZ });
}
/** Trois chiots reposés, pas affamés, qui ont déjà joué ensemble (on regarde leurs promenades). */
function trio(): GameState {
  let s = startWithDog(T0, TZ);
  s = adoptOne(s, 'Biscotte');
  s = adoptOne(s, 'Pistache');
  return { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, needs: { ...d.needs, hunger: 90, thirst: 90, fun: 90, energy: 60 } })) } };
}

describe('D-89 : un salon plus grand, où les chiots se dispersent', () => {
  it('trois chiots ne restent pas collés : ils s’écartent et explorent toute la pièce', () => {
    const s = trio();
    let close = 0;
    let samples = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    advance(s, 5 * 60_000, (st) => {
      const minds = st.save.homeDogIds.map((id) => st.minds[id]);
      samples++;
      for (let i = 0; i < minds.length; i++) {
        const a = minds[i];
        if (!a) continue;
        minX = Math.min(minX, a.pos.x);
        maxX = Math.max(maxX, a.pos.x);
        for (let j = i + 1; j < minds.length; j++) {
          const b = minds[j];
          // Jouer ou dormir ensemble, c'est voulu (F-VIE-4), se croiser en marchant aussi :
          // on compte deux chiots arrêtés l'un contre l'autre.
          const busy = (m: PuppyMind): boolean => m.activity === 'play' || m.activity === 'sleep' || m.target !== null;
          if (b && !busy(a) && !busy(b) && Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) < BALANCE.family.personalSpace) close++;
        }
      }
    });
    // Trois paires : presque jamais arrêtés collés.
    expect(close / (samples * 3)).toBeLessThan(0.03);
    expect(maxX - minX).toBeGreaterThan(2.2);
    expect(minX).toBeGreaterThanOrEqual(R.minX - 1e-9);
    expect(maxX).toBeLessThanOrEqual(R.maxX + 1e-9);
  });

  it('appelé, le chiot vient devant la partie du salon que le joueur regarde', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'view/pan', x: 1.2 });
    expect(s.viewX).toBeCloseTo(1.2);
    s = reduce(s, { type: 'call' });
    s = advance(s, 10_000);
    const m = s.minds[s.save.homeDogIds[0] ?? ''];
    expect(m?.pos.x ?? 0).toBeGreaterThan(1);
  });

  it('la vue reste dans le salon', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'view/pan', x: 9 });
    expect(s.viewX).toBe(R.maxView);
    s = reduce(s, { type: 'view/pan', x: -9 });
    expect(s.viewX).toBe(-R.maxView);
  });
});
