import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { reduce, type GameState } from '../../src/sim/game';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 8, 13, 0);

function advance(s: GameState, ms: number): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
  return s;
}
/** Une promenade arrêtée devant le lieu demandé (parc ou gymnase). */
function atPlace(place: 'park' | 'gym'): GameState {
  let s = startWithDog(T0, TZ);
  s = reduce(s, { type: 'walk/start', route: ['2-5', '2-4', '2-3'], now: s.save.lastSeenAt });
  const w = s.walk;
  if (!w) throw new Error('pas de promenade');
  const events = [...w.plan.events, { kind: 'place' as const, at: w.progress, lane: 1, place }];
  return { ...s, walk: { ...w, plan: { ...w.plan, events }, pause: { kind: 'place', until: null, index: events.length - 1 } } };
}
const dog = (s: GameState) => {
  const d = s.save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};

describe('D-103 : entraînement libre au parc (disque) et au gymnase (agilité)', () => {
  it('au parc, on s’entraîne au disque ; au gymnase, à l’agilité ; seulement sur place', () => {
    expect(reduce(startWithDog(T0, TZ), { type: 'practice/start' }).contest).toBeNull();
    const park = reduce(atPlace('park'), { type: 'practice/start' });
    expect(park.contest?.practice).toBe(true);
    expect(park.contest?.run.kind).toBe('disc');
    expect(park.contest?.prize).toBe(false);
    const gym = reduce(atPlace('gym'), { type: 'practice/start' });
    expect(gym.contest?.run.kind).toBe('agility');
  });

  it('un entraînement au disque fini donne un score, un record, de l’XP, mais ni pièces ni points', () => {
    let s = reduce(atPlace('park'), { type: 'practice/start' });
    const coins = s.save.coins;
    const pts = s.save.masterPoints;
    const xp = dog(s).xp;
    for (let i = 0; i < 20 && !s.contest?.practiceResult; i++) {
      s = reduce(s, { type: 'contest/throw', fx: 0.2, fy: 1.2 });
      s = advance(s, 6000);
    }
    const r = s.contest?.practiceResult;
    expect(r).toBeTruthy();
    expect(r?.record).toBe(true);
    expect(dog(s).bests?.disc).toBe(r?.score);
    expect(s.save.coins).toBe(coins);
    expect(s.save.masterPoints).toBe(pts);
    expect(dog(s).xp).toBeGreaterThan(xp);
    // Il ne compte pas comme un concours.
    expect(dog(s).trophies).toHaveLength(0);
  });

  it('un nouvel essai repart de zéro ; « fermer » rend la promenade', () => {
    let s = reduce(atPlace('gym'), { type: 'practice/start' });
    s = reduce(s, { type: 'practice/again' });
    expect(s.contest?.practice).toBe(true);
    expect(s.contest?.run.finished).toBe(false);
    s = reduce(s, { type: 'contest/close' });
    expect(s.contest).toBeNull();
    expect(s.walk?.pause?.kind).toBe('place');
  });

  it('agilité : le meilleur temps est le plus court', () => {
    const s = atPlace('gym');
    const withBest = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, bests: { agility: 1 } })) } };
    expect(BALANCE.practice.better.agility).toBe('lower');
    expect(dog(withBest).bests?.agility).toBe(1);
  });
});
