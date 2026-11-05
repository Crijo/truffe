import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { reduce, type GameAction, type GameState } from '../../src/sim/game';
import type { Gesture } from '../../src/sim/behavior';
import { startWithDog } from './fixtures';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TZ = -60;
/** 14 h à Paris. */
const T0 = Date.UTC(2026, 10, 3, 13, 0);
/** 23 h à Paris. */
const NIGHT = Date.UTC(2026, 10, 3, 22, 0);
const C = BALANCE.care;

const start = (now = T0): GameState => startWithDog(now, TZ);
const dog = (s: GameState) => {
  const d = s.save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};
const mind = (s: GameState) => {
  const m = s.minds[dog(s).id];
  if (!m) throw new Error('aucun esprit');
  return m;
};
function withNeeds(s: GameState, needs: Partial<GameState['save']['dogs'][number]['needs']>): GameState {
  return { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, needs: { ...d.needs, ...needs } })) } };
}
function advance(s: GameState, ms: number): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
  return s;
}
const act = (s: GameState, a: GameAction) => reduce(s, a);
const gesture = (s: GameState, g: Gesture) => reduce(s, { type: 'gesture', gesture: g });
function scrub(s: GameState, tool: 'soap' | 'shower' | 'dryer' | 'brush', px: number): GameState {
  for (let d = 0; d < px; d += 20) {
    s = gesture(s, { kind: 'scrub', tool, distancePx: 20 });
    s = advance(s, 20);
  }
  return s;
}

describe('F-SOIN-1 : gamelles', () => {
  it('croquettes et eau peuvent être servies ensemble, côte à côte', () => {
    let s = start();
    s = act(s, { type: 'care/bowl', kind: 'food', at: null });
    s = act(s, { type: 'care/bowl', kind: 'water', at: null });
    expect(s.bowls.map((b) => b.kind).sort()).toEqual(['food', 'water']);
    const [a, b] = s.bowls;
    expect(Math.hypot((a?.pos.x ?? 0) - (b?.pos.x ?? 0), (a?.pos.z ?? 0) - (b?.pos.z ?? 0))).toBeGreaterThan(C.bowlGap - 1e-9);
  });

  it('une gamelle posée sur l’autre est décalée à côté', () => {
    let s = start();
    s = act(s, { type: 'care/bowl', kind: 'food', at: { x: 0.1, z: 0.7 } });
    s = act(s, { type: 'care/bowl', kind: 'water', at: { x: 0.12, z: 0.7 } });
    const [a, b] = s.bowls;
    expect(s.bowls).toHaveLength(2);
    expect(Math.hypot((a?.pos.x ?? 0) - (b?.pos.x ?? 0), (a?.pos.z ?? 0) - (b?.pos.z ?? 0))).toBeGreaterThan(C.bowlGap - 1e-9);
  });

  it('le chiot affamé vient manger : faim +40', () => {
    let s = withNeeds(start(), { hunger: 30 });
    s = act(s, { type: 'care/bowl', kind: 'food', at: { x: 0.4, z: 0.7 } });
    expect(s.bowls).toHaveLength(1);
    s = advance(s, 500);
    expect(mind(s).activity).toBe('eat');
    s = advance(s, 8000);
    expect(dog(s).needs.hunger).toBeCloseTo(30 + BALANCE.needs.meal, 0);
    expect(s.bowls).toHaveLength(0);
  });

  it('le chiot assoiffé vient boire : soif +50', () => {
    let s = withNeeds(start(), { thirst: 20 });
    s = act(s, { type: 'care/bowl', kind: 'water', at: { x: -0.3, z: 0.6 } });
    s = advance(s, 9000);
    expect(dog(s).needs.thirst).toBeCloseTo(20 + BALANCE.needs.water, 0);
  });

  it('affamé et assoiffé : il vide une gamelle, puis va à l’autre', () => {
    let s = withNeeds(start(), { hunger: 10, thirst: 8 });
    s = act(s, { type: 'care/bowl', kind: 'food', at: { x: 0.7, z: 0.5 } });
    s = act(s, { type: 'care/bowl', kind: 'water', at: { x: -0.7, z: 0.5 } });
    s = advance(s, 20_000);
    expect(s.bowls).toHaveLength(0);
    expect(dog(s).needs.hunger).toBeGreaterThan(45);
    expect(dog(s).needs.thirst).toBeGreaterThan(55);
  });

  it('sans besoin, il ne mange pas et la gamelle reste', () => {
    let s = withNeeds(start(), { hunger: 95 });
    s = act(s, { type: 'care/bowl', kind: 'food', at: { x: 0.4, z: 0.7 } });
    s = advance(s, 8000);
    expect(mind(s).activity).not.toBe('eat');
    expect(s.bowls).toHaveLength(1);
    expect(dog(s).needs.hunger).toBeLessThanOrEqual(95);
  });

  it('le score de « manger » vaut 100 − jauge', () => {
    let s = withNeeds(start(), { hunger: 30 });
    s = act(s, { type: 'care/bowl', kind: 'food', at: { x: 0.4, z: 0.7 } });
    expect(mind(s).lastScores.eat).toBe(70);
  });

  it('une seule gamelle de chaque sorte : la nouvelle remplace l’ancienne', () => {
    let s = act(start(), { type: 'care/bowl', kind: 'food', at: { x: 0.4, z: 0.7 } });
    s = act(s, { type: 'care/bowl', kind: 'food', at: { x: -0.4, z: 0.7 } });
    s = act(s, { type: 'care/bowl', kind: 'water', at: { x: 0, z: 0.5 } });
    expect(s.bowls.map((b) => b.kind).sort()).toEqual(['food', 'water']);
    expect(s.bowls.find((b) => b.kind === 'food')?.pos.x).toBeCloseTo(-0.4);
  });
});

describe('F-SOIN-2, D-88 : bain en quatre étapes', () => {
  const steps = (s: GameState) => mind(s).events.filter((e) => e.type === 'bathStep').length;

  it('mouiller, savonner, rincer, sécher au sèche-cheveux : propreté à 100, un signal à chaque étape', () => {
    let s = withNeeds(start(), { cleanliness: 30 });
    s = gesture(s, { kind: 'groomStart' });
    expect(mind(s).activity).toBe('groom');
    expect(mind(s).bath.stage).toBe('wet');
    s = scrub(s, 'shower', C.wetPx);
    expect(mind(s).bath.wet).toBe(1);
    expect(mind(s).bath.stage).toBe('soap');
    expect(steps(s)).toBe(1);
    s = scrub(s, 'soap', C.soapPx);
    expect(mind(s).bath.foam).toBe(1);
    expect(mind(s).bath.stage).toBe('rinse');
    s = scrub(s, 'shower', C.rinsePx);
    expect(mind(s).bath.foam).toBe(0);
    expect(mind(s).bath.stage).toBe('dry');
    expect(mind(s).events.map((e) => e.type)).toContain('shake');
    expect(dog(s).needs.cleanliness).toBeLessThan(100);
    s = scrub(s, 'dryer', C.dryPx);
    expect(mind(s).bath.stage).toBe('done');
    expect(steps(s)).toBe(4);
    expect(dog(s).needs.cleanliness).toBeCloseTo(100, 2);
  });

  it('chaque étape attend la précédente : savonner un chiot sec ne mousse pas', () => {
    let s = withNeeds(start(), { cleanliness: 30 });
    s = gesture(s, { kind: 'groomStart' });
    s = scrub(s, 'soap', C.soapPx);
    expect(mind(s).bath.foam).toBe(0);
    s = scrub(s, 'dryer', C.dryPx);
    expect(mind(s).bath.stage).toBe('wet');
    expect(dog(s).needs.cleanliness).toBeLessThan(31);
  });

  it('sécher sans avoir rincé ne lave pas', () => {
    let s = withNeeds(start(), { cleanliness: 30 });
    s = gesture(s, { kind: 'groomStart' });
    s = scrub(s, 'shower', C.wetPx);
    s = scrub(s, 'soap', C.soapPx);
    s = scrub(s, 'dryer', C.dryPx);
    expect(mind(s).bath.foam).toBe(1);
    expect(dog(s).needs.cleanliness).toBeLessThan(31);
  });

  it('le chiot reste debout, en place, pendant le bain', () => {
    let s = gesture(start(), { kind: 'groomStart' });
    const pos = { ...mind(s).pos };
    s = advance(s, 30_000);
    expect(mind(s).pos).toEqual(pos);
    expect(mind(s).posture).toBe('stand');
    s = gesture(s, { kind: 'groomEnd' });
    expect(mind(s).activity).not.toBe('groom');
  });
});

describe('F-SOIN-3 : brosse', () => {
  it('fait briller le pelage et gagne au plus 15 de propreté par séance', () => {
    let s = withNeeds(start(), { cleanliness: 50 });
    s = scrub(s, 'brush', 3000);
    expect(dog(s).needs.cleanliness).toBeCloseTo(50 + C.brushMaxPerSession, 0);
    expect(mind(s).shineUntil).toBeGreaterThan(mind(s).t);
  });

  it('une nouvelle séance après une pause d’une minute', () => {
    let s = withNeeds(start(), { cleanliness: 30 });
    s = scrub(s, 'brush', 3000);
    s = advance(s, C.brushSessionGapMs + 1000);
    s = scrub(s, 'brush', 3000);
    expect(dog(s).needs.cleanliness).toBeGreaterThan(30 + C.brushMaxPerSession);
  });

  it('le brossage plaît comme une caresse', () => {
    const s = scrub(start(), 'brush', 100);
    expect(mind(s).mood).toBe('content');
  });
});

describe('F-SOIN-5 et D-03 : bouderie due à un besoin urgent', () => {
  it('pas avant 2 minutes de session, puis il boude', () => {
    let s = withNeeds(start(), { hunger: 8 });
    s = advance(s, 60_000);
    expect(mind(s).mood).not.toBe('sulky');
    s = advance(s, 70_000);
    expect(mind(s).activity).toBe('sulk');
  });

  it('nourri, il cesse de bouder', () => {
    let s = withNeeds(start(), { hunger: 8 });
    s = advance(s, 130_000);
    s = act(s, { type: 'care/bowl', kind: 'food', at: { x: 0.2, z: 0.7 } });
    s = advance(s, 9000);
    expect(dog(s).needs.hunger).toBeGreaterThan(40);
    s = advance(s, 3000);
    expect(mind(s).mood).not.toBe('sulky');
  });

  it('ne fugue jamais et ne perd rien de définitif', () => {
    let s = withNeeds(start(), { hunger: 0, thirst: 0, cleanliness: 0 });
    s = advance(s, 10 * 60_000);
    expect(s.save.dogs).toHaveLength(1);
    expect(s.save.homeDogIds).toHaveLength(1);
  });
});

describe('F-VIE-1 : sommeil', () => {
  it('la nuit, laissé tranquille, il s’endort', () => {
    let s = start(NIGHT);
    s = advance(s, 40_000);
    expect(mind(s).activity).toBe('sleep');
    expect(mind(s).mood).toBe('asleep');
    expect(mind(s).attentive).toBe(false);
  });

  it('le jour, avec de l’énergie, il ne dort pas', () => {
    let s = start(T0);
    s = advance(s, 60_000);
    expect(mind(s).activity).not.toBe('sleep');
  });

  it('le jour, épuisé, il dort', () => {
    let s = withNeeds(start(T0), { energy: 15 });
    s = advance(s, 40_000);
    expect(mind(s).activity).toBe('sleep');
  });

  it('dormir rend de l’énergie (+20/h)', () => {
    let s = withNeeds(start(NIGHT), { energy: 30 });
    s = advance(s, 40_000);
    const e0 = dog(s).needs.energy;
    s = advance(s, 6 * 60_000);
    expect(dog(s).needs.energy).toBeCloseTo(e0 + 2, 1);
  });

  it('le toucher le réveille, sans pénalité', () => {
    let s = start(NIGHT);
    s = advance(s, 40_000);
    const affection = dog(s).affection;
    s = gesture(s, { kind: 'touch', part: 'head' });
    expect(mind(s).activity).not.toBe('sleep');
    expect(mind(s).events.map((e) => e.type)).toContain('yawn');
    expect(dog(s).affection).toBe(affection);
  });

  it('l’appeler le réveille aussi', () => {
    let s = start(NIGHT);
    s = advance(s, 40_000);
    s = gesture(s, { kind: 'tap', at: null });
    expect(mind(s).activity).not.toBe('sleep');
  });

  it('une main présentée ne le réveille pas', () => {
    let s = start(NIGHT);
    s = advance(s, 40_000);
    s = gesture(s, { kind: 'present' });
    s = advance(s, 1000);
    expect(mind(s).activity).toBe('sleep');
  });

  it('réveillé la nuit, il se rendort une fois laissé seul', () => {
    let s = start(NIGHT);
    s = advance(s, 40_000);
    s = gesture(s, { kind: 'touch', part: 'head' });
    s = advance(s, 30_000);
    expect(mind(s).activity).not.toBe('sleep');
    s = advance(s, 60_000);
    expect(mind(s).activity).toBe('sleep');
  });
});

describe('F-VIE-3 : retour après une longue absence', () => {
  it('30 jours : besoins bas mais jamais sous 5, et il redevient joyeux en une session', () => {
    let s = advance(start(T0), 1000);
    s = reduce(s, { type: 'session/start', now: T0 + 30 * DAY, tzOffsetMin: TZ });
    const n = dog(s).needs;
    expect(n.hunger).toBeGreaterThanOrEqual(5);
    expect(n.thirst).toBeGreaterThanOrEqual(5);
    expect(n.cleanliness).toBeGreaterThanOrEqual(5);
    expect(n.hunger).toBeLessThan(15);
    expect(mind(s).mood).toBe('happy');
    expect(dog(s).affection).toBeGreaterThanOrEqual(20);

    s = advance(s, 8000);
    s = act(s, { type: 'care/bowl', kind: 'food', at: { x: 0.3, z: 0.7 } });
    s = act(s, { type: 'care/bowl', kind: 'water', at: { x: -0.3, z: 0.7 } });
    s = advance(s, 20_000);
    s = gesture(s, { kind: 'groomStart' });
    s = scrub(s, 'shower', C.wetPx);
    s = scrub(s, 'soap', C.soapPx);
    s = scrub(s, 'shower', C.rinsePx);
    s = scrub(s, 'dryer', C.dryPx);
    s = gesture(s, { kind: 'groomEnd' });
    // D-82 : il s'ennuie aussi ; quelques lancers le divertissent.
    for (let i = 0; i < 3; i++) {
      s = act(s, { type: 'toy/hold', kind: 'ball', at: { x: 0, z: 0.8 } });
      s = act(s, { type: 'toy/throw', toyId: s.toys[0]?.id ?? '', vx: 0.3, vz: -1 });
      s = advance(s, 6000);
    }
    for (let i = 0; i < 4; i++) {
      s = gesture(s, { kind: 'stroke', part: 'head', distancePx: 70 });
      s = advance(s, 2100);
    }
    s = gesture(s, { kind: 'pull', part: 'tail' });
    expect(mind(s).mood).not.toBe('sulky');
    s = advance(s, 150_000);
    expect(mind(s).mood).not.toBe('sulky');
    s = gesture(s, { kind: 'tap', at: null });
    s = gesture(s, { kind: 'tap', at: null });
    s = advance(s, 2500);
    expect(mind(s).mood).toBe('happy');
  });
});

describe('Horloge qui recule', () => {
  it('n’apporte aucun avantage : besoins et affection inchangés', () => {
    let s = withNeeds(start(T0), { hunger: 30 });
    const before = dog(s);
    s = reduce(s, { type: 'session/resume', now: T0 - 2 * DAY, tzOffsetMin: TZ });
    s = reduce(s, { type: 'tick', now: T0 - 2 * DAY + 100, dtMs: 100, tzOffsetMin: TZ });
    expect(dog(s).needs.hunger).toBeCloseTo(before.needs.hunger, 2);
    expect(dog(s).affection).toBe(before.affection);
    expect(s.save.lastSeenAt).toBe(T0);
  });

  it('horloge reculée : le repas pris compte quand même', () => {
    let s = withNeeds(start(T0), { hunger: 30 });
    s = reduce(s, { type: 'session/resume', now: T0 - DAY, tzOffsetMin: TZ });
    s = act(s, { type: 'care/bowl', kind: 'food', at: { x: 0.3, z: 0.7 } });
    let now = T0 - DAY;
    for (let i = 0; i < 100; i++) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
    expect(dog(s).needs.hunger).toBeCloseTo(70, 0);
  });

  it('puis revenir à l’heure juste ne compte pas l’écart comme une absence', () => {
    let s = withNeeds(start(T0), { hunger: 60 });
    s = reduce(s, { type: 'session/resume', now: T0 - DAY, tzOffsetMin: TZ });
    s = reduce(s, { type: 'session/resume', now: T0 + 1000, tzOffsetMin: TZ });
    expect(dog(s).needs.hunger).toBeCloseTo(60, 1);
  });

  it('une veille de l’appareil (saut d’horloge en jeu) compte comme une absence', () => {
    let s = withNeeds(start(T0), { hunger: 60 });
    s = reduce(s, { type: 'tick', now: T0 + 2 * HOUR, dtMs: 100, tzOffsetMin: TZ });
    expect(dog(s).needs.hunger).toBeCloseTo(52, 0);
  });
});
