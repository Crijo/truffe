import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { CITY_BY_ID, HOME_NODE } from '../../src/data/city';
import { reduce, type GameState } from '../../src/sim/game';
import { extendRoute, maxMeters, neighbors, planWalk, questionPoints, rewardable, routeMeters, streetKind, turnAt, walkGains, type Route } from '../../src/sim/walk';
import { startWithDog } from './fixtures';

const W = BALANCE.walk;
const T0 = Date.UTC(2026, 10, 3, 13, 0);
const TZ = -60;
const MIN = 60_000;

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
/** Trajet maison → nord, puis vers l'est, de `n` rues. */
function route(n: number): Route {
  const path = ['2-5', '2-4', '2-3', '2-2', '3-2', '4-2', '5-2', '5-1', '5-0', '4-0', '3-0'];
  return path.slice(0, n + 1);
}
function walkTo(s: GameState, r: Route): GameState {
  return reduce(s, { type: 'walk/start', route: r, now: s.save.lastSeenAt });
}
/** Marche jusqu'au bout en gardant le chiot dans la voie `lane` et en ramassant tout. */
function walkAll(s: GameState, lane: number | 'follow' = 0, pickup = true): GameState {
  for (let i = 0; i < 3000 && s.walk && !s.walk.finished; i++) {
    const w = s.walk;
    if (lane === 'follow') {
      const next = w.plan.events.find((e, k) => !w.done.includes(k) && (e.kind === 'hidden' || (e.kind === 'question' && e.sub === 'gift')) && e.at > w.progress - 2);
      s = reduce(s, { type: 'walk/leash', lane: next?.lane ?? 0 });
    } else s = reduce(s, { type: 'walk/leash', lane });
    if (pickup && s.walk?.poop && !s.walk.poop.picked) s = reduce(s, { type: 'walk/pickup' });
    if (s.walk?.pause?.kind === 'place') s = reduce(s, { type: 'walk/continue' });
    s = advance(s, 100);
  }
  return s;
}

describe('F-PRO-1 : tracer un trajet sur le plan', () => {
  it('le trajet part de la maison et suit les rues voisines', () => {
    expect(CITY_BY_ID[HOME_NODE]?.place).toBe('home');
    expect(neighbors('0-0').sort()).toEqual(['0-1', '1-0']);
    let r: Route = [HOME_NODE];
    r = extendRoute(r, '2-4', 5);
    expect(r).toEqual(['2-5', '2-4']);
    expect(extendRoute(r, '4-4', 5)).toEqual(r); // pas voisin : refusé
  });

  it('revenir sur ses pas efface la dernière rue', () => {
    let r = extendRoute(extendRoute([HOME_NODE], '2-4', 5), '2-3', 5);
    r = extendRoute(r, '2-4', 5);
    expect(r).toEqual(['2-5', '2-4']);
  });

  it('plafonné par l’endurance : 1 point = 100 m', () => {
    expect(maxMeters(5)).toBe(500);
    let r: Route = [HOME_NODE];
    for (const n of route(10).slice(1)) r = extendRoute(r, n, 5);
    expect(routeMeters(r)).toBe(500);
    const long = [...route(10), '2-0', '1-0', '0-0', '0-1', '0-2', '0-3', '0-4'];
    let r8: Route = [HOME_NODE];
    for (const n of long.slice(1)) r8 = extendRoute(r8, n, 8);
    expect(routeMeters(r8)).toBe(800);
  });
});

describe('F-PRO-2 et F-PRO-4 : lieux et points « ? »', () => {
  it('3 lieux sur le plan : parc, gymnase, brocante', () => {
    const places = Object.values(CITY_BY_ID).map((n) => n.place).filter(Boolean).sort();
    expect(places).toEqual(['gym', 'home', 'market', 'park']);
  });

  it('les points « ? » sont tirés d’une graine : même graine, mêmes points', () => {
    expect(questionPoints(42)).toEqual(questionPoints(42));
    expect(questionPoints(42)).toHaveLength(W.questionPoints);
    expect(questionPoints(42).every((q) => !CITY_BY_ID[q.nodeId]?.place)).toBe(true);
    expect(questionPoints(42)).not.toEqual(questionPoints(43));
  });
});

describe('Reproductibilité (critère) : cadeaux, rencontres et besoins', () => {
  it('le même trajet et la même graine donnent les mêmes événements', () => {
    const q = questionPoints(7);
    expect(planWalk(route(10), 7, q)).toEqual(planWalk(route(10), 7, q));
    expect(planWalk(route(10), 7, q)).not.toEqual(planWalk(route(10), 8, q));
  });

  it('un « ? » traversé devient un cadeau ou une rencontre, à sa place', () => {
    const r = route(6);
    const q = [{ nodeId: '2-3', kind: 'gift' as const }, { nodeId: '4-2', kind: 'encounter' as const }];
    const p = planWalk(r, 3, q);
    const gift = p.events.find((e) => e.kind === 'question' && e.sub === 'gift');
    const enc = p.events.find((e) => e.kind === 'question' && e.sub === 'encounter');
    expect(gift?.at).toBe(2 * W.edgeM);
    expect(enc?.at).toBe(5 * W.edgeM);
    expect(gift?.itemId).toBeTruthy();
  });

  it('cadeaux cachés et besoins apparaissent au fil du trajet', () => {
    let hidden = 0;
    let poops = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const p = planWalk(route(10), seed, []);
      hidden += p.events.filter((e) => e.kind === 'hidden').length;
      poops += p.events.filter((e) => e.kind === 'poop').length;
    }
    expect(hidden).toBeGreaterThan(30);
    expect(poops).toBeGreaterThan(15);
  });

  it('un lieu traversé est un arrêt possible', () => {
    const p = planWalk(route(6), 1, []);
    expect(p.events.some((e) => e.kind === 'place' && e.place === 'gym')).toBe(true);
  });
});

describe('F-PRO-3 et F-PRO-5 : la laisse', () => {
  it('tirer la laisse vers un cadeau caché permet de le ramasser ; l’ignorer le fait manquer', () => {
    let seed = 1;
    for (; seed < 50; seed++) if (planWalk(route(10), seed, []).events.some((e) => e.kind === 'hidden')) break;
    const base = { ...startWithDog(T0, TZ), save: { ...startWithDog(T0, TZ).save, rngState: seed } };
    const s0 = walkTo(base, route(10));
    const hidden = s0.walk?.plan.events.filter((e) => e.kind === 'hidden') ?? [];
    expect(hidden.length).toBeGreaterThan(0);
    const good = walkAll(s0, 'follow');
    const lanes = hidden.map((h) => h.lane);
    const away = lanes[0] === 0 ? 1 : 0;
    const bad = walkAll(s0, away);
    const found = (s: GameState) => s.walk?.collected.length ?? 0;
    expect(found(good)).toBeGreaterThan(found(bad));
  });
});

describe('F-PRO-6 : les besoins', () => {
  function withPoop(): GameState {
    let seed = 1;
    for (; seed < 80; seed++) if (planWalk(route(10), seed, []).events.some((e) => e.kind === 'poop')) break;
    const s = startWithDog(T0, TZ);
    return walkTo({ ...s, save: { ...s.save, rngState: seed } }, route(10));
  }

  it('il s’arrête ; ramasser rapporte des points', () => {
    const s = walkAll(withPoop(), 0, true);
    expect(s.walk?.pointsDelta).toBeGreaterThanOrEqual(W.points.pickup);
    expect(s.walk?.log).toContain('pickup');
  });

  it('oublier de ramasser en retire un peu', () => {
    const picked = walkAll(withPoop(), 0, true);
    const forgot = walkAll(withPoop(), 0, false);
    expect(forgot.walk?.log).toContain('forget');
    expect((picked.walk?.pointsDelta ?? 0) - (forgot.walk?.pointsDelta ?? 0)).toBe(W.points.pickup - W.points.forget);
  });
});

describe('F-PRO-7 : gains', () => {
  it('10 points + 1 par 100 m, +1 d’endurance, +3 d’affection', () => {
    expect(walkGains(500)).toEqual({ points: 15, stamina: 1, affection: 3 });
    expect(walkGains(250)).toEqual({ points: 12, stamina: 1, affection: 3 });
  });

  it('une promenade terminée applique les gains, et salit un peu le chiot', () => {
    const s0 = startWithDog(T0, TZ);
    const d0 = dog(s0);
    const s = walkAll(walkTo(s0, route(10)), 0, true);
    expect(s.walk?.finished).toBe(true);
    expect(s.walk?.rewarded).toBe(true);
    const d = dog(s);
    expect(d.stamina).toBe(d0.stamina + 1);
    expect(d.affection).toBe(d0.affection + W.affection);
    expect(d.needs.cleanliness).toBeLessThan(d0.needs.cleanliness + W.cleanliness + 1);
    expect(s.save.masterPoints).toBe(walkGains(500).points + (s.walk?.pointsDelta ?? 0));
  });

  it('une seule promenade avec gains toutes les 30 minutes', () => {
    expect(rewardable(null, T0)).toBe(true);
    expect(rewardable(T0, T0 + 29 * MIN)).toBe(false);
    expect(rewardable(T0, T0 + 30 * MIN)).toBe(true);
    let s = walkAll(walkTo(startWithDog(T0, TZ), route(4)), 0, true);
    const pts = s.save.masterPoints;
    const stamina = dog(s).stamina;
    s = reduce(s, { type: 'walk/close' });
    s = walkAll(walkTo(s, route(4)), 0, true);
    expect(s.walk?.rewarded).toBe(false);
    expect(dog(s).stamina).toBe(stamina);
    expect(s.save.masterPoints).toBe(pts);
    s = reduce(s, { type: 'walk/close' });
    s = reduce(s, { type: 'session/resume', now: s.save.lastSeenAt + 31 * MIN, tzOffsetMin: TZ });
    s = walkAll(walkTo(s, route(4)), 0, true);
    expect(s.walk?.rewarded).toBe(true);
  });

  it('rentrer avant la fin : ni gains ni endurance', () => {
    let s = walkTo(startWithDog(T0, TZ), route(10));
    s = advance(s, 3000);
    s = reduce(s, { type: 'walk/finish' });
    expect(s.walk?.finished).toBe(true);
    expect(s.walk?.rewarded).toBe(false);
    expect(dog(s).stamina).toBe(BALANCE.start.stamina);
  });

  it('les points de maître sont plafonnés à 200 par chiot et par jour', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'debug/points', points: 190 });
    s = walkAll(walkTo(s, route(10)), 0, true);
    expect(s.save.day.perDog[dog(s).id]?.masterPoints).toBe(BALANCE.economy.dailyPointsCap);
    expect(s.save.masterPoints).toBe(BALANCE.economy.dailyPointsCap);
  });

  it('les cadeaux ramassés vont dans le sac et le carnet', () => {
    let seed = 1;
    for (; seed < 50; seed++) if (planWalk(route(10), seed, []).events.some((e) => e.kind === 'hidden')) break;
    const base = startWithDog(T0, TZ);
    const s = walkAll(walkTo({ ...base, save: { ...base.save, rngState: seed } }, route(10)), 'follow');
    const got = s.walk?.collected ?? [];
    expect(got.length).toBeGreaterThan(0);
    for (const id of got) {
      expect(s.save.inventory[id]).toBeGreaterThan(0);
      expect(s.save.discovered.items).toContain(id);
    }
  });
});

describe('Rencontre et lieux pendant la marche', () => {
  it('deux aboiements annoncent une rencontre ; un seul, un cadeau', () => {
    const s0 = startWithDog(T0, TZ);
    const q = [
      { nodeId: '2-3', kind: 'gift' as const },
      { nodeId: '2-2', kind: 'encounter' as const },
    ];
    let s = reduce({ ...s0 }, { type: 'walk/start', route: route(4), now: T0, questions: q });
    const barks: number[] = [];
    for (let i = 0; i < 1500 && s.walk && !s.walk.finished; i++) {
      s = advance(s, 100);
      for (const b of s.walk?.barks ?? []) if (!barks.includes(b.at)) barks.push(b.at);
    }
    const barkEvents = s.walk?.barks ?? [];
    expect(barkEvents.find((b) => b.sub === 'gift')?.count).toBe(1);
    expect(barkEvents.find((b) => b.sub === 'encounter')?.count).toBe(2);
    expect(s.walk?.log).toContain('encounter');
  });

  it('au gymnase, on peut entrer : le lieu est visité', () => {
    let s = walkTo(startWithDog(T0, TZ), route(6));
    for (let i = 0; i < 1500 && s.walk?.pause?.kind !== 'place'; i++) s = advance(s, 100);
    expect(s.walk?.pause?.kind).toBe('place');
    s = reduce(s, { type: 'walk/enter' });
    expect(dog(s).visited.gym).toBe(true);
  });
});

describe('D-92 : une promenade plus vive et moins linéaire', () => {
  it('une rue de 50 m se parcourt en un peu plus de 4 s (12 m/s)', () => {
    expect(W.speedMps).toBe(12);
    let s = walkTo(startWithDog(T0, TZ), route(1));
    // On écarte les arrêts (rencontres, besoins) pour ne mesurer que la marche.
    s = { ...s, walk: s.walk ? { ...s.walk, plan: { ...s.walk.plan, events: [] } } : null };
    s = advance(s, Math.ceil((W.edgeM / W.speedMps) * 1000) + 200);
    expect(s.walk?.progress).toBe(W.edgeM);
  });

  it('chaque rue a son allure : parc près du parc, boutiques près de la brocante, toujours la même', () => {
    expect(streetKind('0-0', '1-0')).toBe('park');
    expect(streetKind('4-0', '4-1')).toBe('shops');
    expect(streetKind('2-4', '2-3')).toBe(streetKind('2-3', '2-4'));
    const kinds = new Set<string>();
    for (const [a, b] of [['2-5', '2-4'], ['2-4', '2-3'], ['2-3', '3-3'], ['3-3', '3-4'], ['1-3', '1-2'], ['3-1', '3-2']]) kinds.add(streetKind(a ?? '', b ?? ''));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('aux carrefours, le trajet tourne à gauche, à droite ou va tout droit', () => {
    const r = route(6);
    // 2-5 → 2-4 → 2-3 → 2-2 (vers le nord), puis 3-2 (vers l’est) : à droite.
    expect(turnAt(r, 1)).toBe('straight');
    expect(turnAt(r, 3)).toBe('right');
    expect(turnAt(['2-5', '2-4', '1-4'], 1)).toBe('left');
    expect(turnAt(r, 0)).toBe(null);
  });
});
