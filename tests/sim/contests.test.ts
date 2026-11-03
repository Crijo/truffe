import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { canEnter, contestRewards, placeOf, rivalScores, settleContest } from '../../src/sim/contests';
import { startDisc, stepDisc, throwDisc, type DiscRun } from '../../src/sim/contest/disc';
import { AGILITY_COURSE, aimAgility, startAgility, stepAgility, type AgilityRun } from '../../src/sim/contest/agility';
import { orderObedience, startObedience, stepObedience } from '../../src/sim/contest/obedience';
import { reduce, type GameState } from '../../src/sim/game';
import type { Dog, SaveGame } from '../../src/sim/state';
import { startWithDog } from './fixtures';

const T0 = Date.UTC(2026, 10, 3, 13, 0);
const TZ = -60;
const C = BALANCE.contests;

const dogOf = (s: { save: SaveGame }): Dog => {
  const d = s.save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};
const edit = (s: GameState, f: (d: Dog) => Dog): GameState => ({ ...s, save: { ...s.save, dogs: s.save.dogs.map(f) } });
/** Un chien qui a tout visité et connaît « Assis » et « Couché ». */
const ready = (s: GameState): GameState =>
  edit(s, (d) => ({
    ...d,
    visited: { park: true, gym: true, market: true },
    tricks: (['sit', 'down'] as const).map((id) => ({ trickId: id, repetitions: 5, learned: true, mastery: 1, command: { label: id } })),
  }));

describe('F-CON-7 : inscription refusée, avec une raison', () => {
  it('un chiot affamé ou très sale ne peut pas s’inscrire', () => {
    const d = dogOf(ready(startWithDog(T0, TZ)));
    expect(canEnter({ ...d, needs: { ...d.needs, hunger: 10 } }, 'obedience')).toEqual({ ok: false, reason: 'hungry' });
    expect(canEnter({ ...d, needs: { ...d.needs, cleanliness: 12 } }, 'obedience')).toEqual({ ok: false, reason: 'dirty' });
    expect(canEnter({ ...d, needs: { ...d.needs, hunger: 20, cleanliness: 20 } }, 'obedience')).toEqual({ ok: true });
  });

  it('le disque s’ouvre après une visite au parc, l’agilité après une visite au gymnase', () => {
    const d = dogOf(startWithDog(T0, TZ));
    expect(canEnter(d, 'disc')).toEqual({ ok: false, reason: 'notVisited' });
    expect(canEnter(d, 'agility')).toEqual({ ok: false, reason: 'notVisited' });
    expect(canEnter({ ...d, visited: { ...d.visited, park: true } }, 'disc')).toEqual({ ok: true });
    expect(canEnter({ ...d, visited: { ...d.visited, gym: true } }, 'agility')).toEqual({ ok: true });
  });

  it('l’obéissance demande au moins un tour appris', () => {
    const d = dogOf(startWithDog(T0, TZ));
    expect(canEnter(d, 'obedience')).toEqual({ ok: false, reason: 'noTricks' });
  });

  it('chaque raison a sa phrase', async () => {
    const { CONTEST } = await import('../../src/data/strings');
    for (const r of ['hungry', 'dirty', 'notVisited', 'noTricks'] as const) expect(CONTEST.refusal(r, 'disc', 'Truffe').length).toBeGreaterThan(10);
  });
});

describe('Classement et rivaux', () => {
  it('les rivaux sont tirés d’une graine, et meilleurs dans les classes hautes', () => {
    expect(rivalScores(7, 'disc', 0)).toEqual(rivalScores(7, 'disc', 0));
    expect(rivalScores(7, 'disc', 0)).toHaveLength(C.rivals);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    let low = 0;
    let high = 0;
    for (let seed = 1; seed <= 40; seed++) {
      low += avg(rivalScores(seed, 'disc', 0));
      high += avg(rivalScores(seed, 'disc', 4));
    }
    expect(high).toBeGreaterThan(low * 2);
  });

  it('agilité : le temps le plus court gagne ; ailleurs, le score le plus haut', () => {
    expect(placeOf('agility', 30, [40, 50, 60, 70, 80])).toBe(1);
    expect(placeOf('agility', 55, [40, 50, 60, 70, 80])).toBe(3);
    expect(placeOf('disc', 55, [40, 50, 60, 70, 80])).toBe(4);
    expect(placeOf('obedience', 90, [40, 50, 60, 70, 80])).toBe(1);
  });
});

describe('F-CON-4 et SPEC, Gains : récompenses', () => {
  it('Débutant : 50 / 30 / 20 points et 300 / 150 / 75 pièces', () => {
    expect(contestRewards(0, 1)).toEqual({ points: 50, coins: 300 });
    expect(contestRewards(0, 2)).toEqual({ points: 30, coins: 150 });
    expect(contestRewards(0, 3)).toEqual({ points: 20, coins: 75 });
  });

  it('multiplicateurs ×1 / ×2 / ×3 / ×5 / ×8 et ×1 / ×2 / ×4 / ×7 / ×12', () => {
    expect([0, 1, 2, 3, 4].map((c) => contestRewards(c as 0, 1).points)).toEqual([50, 100, 150, 250, 400]);
    expect([0, 1, 2, 3, 4].map((c) => contestRewards(c as 0, 1).coins)).toEqual([300, 600, 1200, 2100, 3600]);
  });

  it('F-CON-5 : hors du podium, quelques points et aucune pièce', () => {
    expect(contestRewards(2, 4)).toEqual({ points: C.consolationPoints, coins: 0 });
  });
});

describe('F-CON-4 à F-CON-6 : classes et limite par jour', () => {
  const win = (save: SaveGame, contest: 'disc' | 'agility' | 'obedience', good: boolean, seed = 3) =>
    settleContest(save, dogOf({ save }).id, contest, good ? (contest === 'agility' ? 1 : 10_000) : contest === 'agility' ? 10_000 : 0, seed, T0, true);

  it('une première place : coupe, pièces, points (hors plafond) et classe supérieure', () => {
    const s = ready(startWithDog(T0, TZ));
    const { save, result } = win(s.save, 'disc', true);
    expect(result.place).toBe(1);
    expect(result.classUp).toBe(true);
    expect(dogOf({ save }).contestClass.disc).toBe(1);
    expect(dogOf({ save }).trophies).toEqual([{ contestId: 'disc', contestClass: 0, place: 1, at: T0 }]);
    expect(save.coins).toBe(s.save.coins + 300);
    expect(save.masterPoints).toBe(s.save.masterPoints + 50);
    expect(save.day.perDog[dogOf(s).id]?.prizeContests).toBe(1);
    expect(save.day.perDog[dogOf(s).id]?.masterPoints ?? 0).toBe(0);
  });

  it('deux podiums sans victoire font aussi monter de classe', () => {
    const s = ready(startWithDog(T0, TZ));
    const id = dogOf(s).id;
    // Score entre le 2e et le 3e rival : 3e place.
    const third = (save: SaveGame, seed: number) => {
      const r = [...rivalScores(seed, 'obedience', 0)].sort((a, b) => b - a);
      return settleContest(save, id, 'obedience', ((r[1] ?? 0) + (r[2] ?? 0)) / 2, seed, T0, true);
    };
    const a = third(s.save, 11);
    expect(a.result.place).toBe(3);
    expect(a.result.classUp).toBe(false);
    const b = third(a.save, 12);
    expect(b.result.place).toBe(3);
    expect(b.result.classUp).toBe(true);
    expect(dogOf(b).contestClass.obedience).toBe(1);
  });

  it('F-CON-5 : un échec ne fait pas descendre et rapporte quelques points', () => {
    let s = ready(startWithDog(T0, TZ));
    s = edit(s, (d) => ({ ...d, contestClass: { ...d.contestClass, agility: 2 } }));
    const { save, result } = win(s.save, 'agility', false);
    expect(result.place).toBe(C.rivals + 1);
    expect(dogOf({ save }).contestClass.agility).toBe(2);
    expect(save.masterPoints).toBe(s.save.masterPoints + C.consolationPoints);
    expect(save.coins).toBe(s.save.coins);
  });

  it('Champion est la classe la plus haute', () => {
    let s = ready(startWithDog(T0, TZ));
    s = edit(s, (d) => ({ ...d, contestClass: { ...d.contestClass, disc: 4 } }));
    const { save, result } = win(s.save, 'disc', true);
    expect(result.classUp).toBe(false);
    expect(dogOf({ save }).contestClass.disc).toBe(4);
  });

  it('sans prix (après 3 concours du jour) : classement, mais ni gain ni coupe ni montée', () => {
    const s = ready(startWithDog(T0, TZ));
    const id = dogOf(s).id;
    const { save, result } = settleContest(s.save, id, 'disc', 10_000, 3, T0, false);
    expect(result.place).toBe(1);
    expect(result.prize).toBe(false);
    expect(save.coins).toBe(s.save.coins);
    expect(save.masterPoints).toBe(s.save.masterPoints);
    expect(dogOf({ save }).trophies).toEqual([]);
    expect(dogOf({ save }).contestClass.disc).toBe(0);
  });
});

describe('F-CON-1 : disque', () => {
  const run = (fn: (r: DiscRun) => DiscRun, r: DiscRun, ms: number): DiscRun => {
    let x = r;
    for (let t = 0; t < ms; t += 100) x = fn(stepDisc(x, 100));
    return x;
  };
  const traits = { docility: 0.5, energy: 0.6, boldness: 0.5 };

  it('dure une minute', () => {
    let r = startDisc(traits, 80);
    r = run((x) => x, r, 59_000);
    expect(r.finished).toBe(false);
    r = run((x) => x, r, 1100);
    expect(r.finished).toBe(true);
  });

  it('un lancer doux est attrapé en l’air ; un lancer très fort retombe au sol et rapporte moins par mètre', () => {
    const soft = run((x) => x, throwDisc(startDisc(traits, 80), 0, 0.5), 8000);
    expect(soft.catches[0]?.air).toBe(true);
    const hard = run((x) => x, throwDisc(startDisc(traits, 80), 0, 1.6), 9000);
    expect(hard.catches[0]?.air).toBe(false);
    const perM = (c: { points: number; meters: number }) => c.points / c.meters;
    expect(perM(soft.catches[0] ?? { points: 0, meters: 1 })).toBeGreaterThan(perM(hard.catches[0] ?? { points: 0, meters: 1 }));
  });

  it('on ne relance qu’une fois le disque rapporté', () => {
    let r = throwDisc(startDisc(traits, 80), 0, 0.6);
    const flying = r.disc.state;
    r = throwDisc(r, 0, 0.6);
    expect(flying).toBe('flying');
    expect(r.throws).toBe(1);
    r = run((x) => x, r, 9000);
    expect(r.disc.state).toBe('hand');
    expect(throwDisc(r, 0, 0.6).throws).toBe(2);
  });

  it('un disque sorti du terrain ne rapporte rien', () => {
    const r = run((x) => x, throwDisc(startDisc(traits, 80), 1.5, 0.3), 9000);
    expect(r.catches[0]?.points ?? 0).toBe(0);
  });

  it('un joueur appliqué gagne en Débutant', () => {
    let r = startDisc(traits, 80);
    r = run((x) => (x.disc.state === 'hand' ? throwDisc(x, 0.03, 0.5) : x), r, 61_000);
    expect(r.finished).toBe(true);
    expect(placeOf('disc', r.score, rivalScores(5, 'disc', 0))).toBe(1);
  });
});

describe('F-CON-2 : agilité', () => {
  /** Le doigt guide le chiot vers chaque point du parcours, dans l'ordre. */
  const guide = (r: AgilityRun): AgilityRun => {
    const target = r.course[r.next]?.points[r.sub];
    return aimAgility(r, target ? { x: target.x, y: target.y } : null);
  };
  const play = (r0: AgilityRun, steer: (r: AgilityRun) => AgilityRun, ms: number) => {
    let r = r0;
    for (let t = 0; t < ms && !r.finished; t += 100) r = stepAgility(steer(r), 100);
    return r;
  };
  const traits = { docility: 0.5, energy: 0.6, boldness: 0.5 };

  it('le parcours a des haies, un tunnel, un slalom et une balançoire', () => {
    const kinds = new Set(AGILITY_COURSE.map((o) => o.kind));
    expect(kinds).toEqual(new Set(['hurdle', 'tunnel', 'slalom', 'seesaw', 'finish']));
  });

  it('guidé au doigt, le chiot finit sans pénalité et gagne en Débutant', () => {
    const r = play(startAgility(traits, 80), guide, 120_000);
    expect(r.finished).toBe(true);
    expect(r.penalties).toBe(0);
    expect(placeOf('agility', r.score, rivalScores(5, 'agility', 0))).toBe(1);
  });

  it('sans doigt, le chiot attend', () => {
    const r = play(startAgility(traits, 80), (x) => x, 5000);
    expect(r.dog).toEqual(startAgility(traits, 80).dog);
  });

  it('sauter un obstacle coûte une pénalité', () => {
    // Le joueur file droit vers la ligne d'arrivée après la première haie.
    const r0 = play(startAgility(traits, 80), guide, 120_000);
    let skipped = startAgility(traits, 80);
    skipped = play(skipped, (x) => {
      if (x.next === 0) return guide(x);
      const finish = AGILITY_COURSE[AGILITY_COURSE.length - 1]?.points[0];
      return aimAgility(x, finish ? { x: finish.x, y: finish.y } : null);
    }, 120_000);
    expect(skipped.finished).toBe(true);
    expect(skipped.penalties).toBeGreaterThan(0);
    expect(skipped.score).toBe(skipped.timeMs / 1000 + skipped.penalties * BALANCE.contests.agility.penaltyS);
    expect(r0.penalties).toBe(0);
  });

  it('au bout de 2 minutes, le parcours s’arrête avec les obstacles restants en pénalité', () => {
    const r = play(startAgility(traits, 80), (x) => x, 121_000);
    expect(r.finished).toBe(true);
    expect(r.penalties).toBe(AGILITY_COURSE.length);
  });
});

describe('F-CON-3 : obéissance', () => {
  const dog = (): Dog => dogOf(ready(startWithDog(T0, TZ)));

  it('un enchaînement imposé, tiré parmi les tours appris, plus long dans les classes hautes', () => {
    const a = startObedience(dog(), 0, 9);
    const b = startObedience(dog(), 3, 9);
    expect(a.orders.length).toBe(5);
    expect(b.orders.length).toBe(8);
    for (const o of a.orders) expect(['sit', 'down']).toContain(o);
  });

  it('un ordre juste et rapide rapporte plus qu’un ordre lent ; un ordre faux ne rapporte rien', () => {
    let fastSum = 0;
    let slowSum = 0;
    let ok = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const fast = startObedience(dog(), 0, seed);
      const f = orderObedience(fast, fast.orders[0] ?? 'sit');
      const slow = stepObedience(startObedience(dog(), 0, seed), 5000);
      const sl = orderObedience(slow, slow.orders[0] ?? 'sit');
      fastSum += f.score;
      slowSum += sl.score;
      if (f.results[0]?.ok) ok++;
      // Même tirage d'obéissance : seul le temps change le score.
      if (f.results[0]?.ok) expect(f.score).toBeGreaterThan(sl.score);
    }
    expect(ok).toBeGreaterThan(20);
    expect(fastSum).toBeGreaterThan(slowSum);
    let wrong = startObedience(dog(), 0, 9);
    wrong = orderObedience(wrong, wrong.orders[0] === 'sit' ? 'down' : 'sit');
    expect(wrong.results[0]).toEqual({ ok: false, points: 0 });
  });

  it('sans ordre, le temps passe et l’épreuve finit', () => {
    let r = startObedience(dog(), 0, 9);
    for (let t = 0; t < 60_000 && !r.finished; t += 100) r = stepObedience(r, 100);
    expect(r.finished).toBe(true);
    expect(r.score).toBe(0);
    expect(r.results).toHaveLength(5);
  });
});

describe('Concours dans la partie', () => {
  it('s’inscrire, jouer, recevoir le bilan', () => {
    let s = ready(startWithDog(T0, TZ));
    s = reduce(s, { type: 'contest/enter', contestId: 'obedience' });
    expect(s.contest?.contestId).toBe('obedience');
    expect(s.contest?.prize).toBe(true);
    for (let i = 0; i < 200 && !s.contest?.result; i++) {
      const run = s.contest?.run;
      if (run?.kind === 'obedience' && !run.waiting) s = reduce(s, { type: 'contest/order', trickId: run.orders[run.index] ?? 'sit' });
      s = reduce(s, { type: 'tick', now: s.save.lastSeenAt + 100, dtMs: 100, tzOffsetMin: TZ });
    }
    expect(s.contest?.result).not.toBeNull();
    expect(s.save.day.perDog[dogOf(s).id]?.prizeContests).toBe(1);
    s = reduce(s, { type: 'contest/close' });
    expect(s.contest).toBeNull();
  });

  it('refusé (F-CON-7) : rien ne commence', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'contest/enter', contestId: 'disc' });
    expect(s.contest).toBeNull();
  });

  it('F-CON-6 : au-delà de 3 concours dans la journée, le concours est pour le plaisir', () => {
    let s = ready(startWithDog(T0, TZ));
    const id = dogOf(s).id;
    s = { ...s, save: { ...s.save, day: { ...s.save.day, perDog: { [id]: { masterPoints: 0, caresses: 0, newTricks: 0, prizeContests: C.prizePerDay } } } } };
    s = reduce(s, { type: 'contest/enter', contestId: 'obedience' });
    expect(s.contest?.prize).toBe(false);
  });

  it('abandonner ne compte pas', () => {
    let s = ready(startWithDog(T0, TZ));
    s = reduce(s, { type: 'contest/enter', contestId: 'obedience' });
    s = reduce(s, { type: 'contest/quit' });
    expect(s.contest).toBeNull();
    expect(s.save.day.perDog[dogOf(s).id]?.prizeContests ?? 0).toBe(0);
  });
});
