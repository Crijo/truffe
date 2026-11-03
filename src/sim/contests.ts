/** Concours (F-CON) : inscription, rivaux, classement, récompenses et classes. */
import { BALANCE } from '../data/balance';
import { awardPoints } from './economy';
import { createRng } from './rng';
import type { ContestClass, ContestId, Dog, DogId, SaveGame } from './state';

const C = BALANCE.contests;
const URGENT = BALANCE.needs.words.hunger[2];

export type EntryRefusal = 'hungry' | 'dirty' | 'notVisited' | 'noTricks';
export type EntryCheck = { ok: true } | { ok: false; reason: EntryRefusal };

/** F-CON-7, et l'accès après une visite au lieu d'entraînement (D-56). */
export function canEnter(dog: Dog, contest: ContestId): EntryCheck {
  if (dog.needs.hunger < URGENT) return { ok: false, reason: 'hungry' };
  if (dog.needs.cleanliness < URGENT) return { ok: false, reason: 'dirty' };
  if (contest === 'disc' && !dog.visited.park) return { ok: false, reason: 'notVisited' };
  if (contest === 'agility' && !dog.visited.gym) return { ok: false, reason: 'notVisited' };
  if (contest === 'obedience' && !dog.tricks.some((t) => t.learned)) return { ok: false, reason: 'noTricks' };
  return { ok: true };
}

/** Les 5 rivaux d'une épreuve, tirés de la graine selon la classe. */
export function rivalScores(seed: number, contest: ContestId, cls: ContestClass): number[] {
  const R = C.rivalScores[contest];
  const mean = R.mean[cls] ?? R.mean[0] ?? 0;
  const rng = createRng((seed ^ (cls * 7919) ^ contest.length * 104729) >>> 0);
  return Array.from({ length: C.rivals }, () => Math.round(mean * (1 + rng.range(-R.spread, R.spread)) * 10) / 10);
}

const lowerIsBetter = (c: ContestId): boolean => c === 'agility';

/** Place de 1 à 6 : à égalité, le joueur passe devant. */
export function placeOf(contest: ContestId, score: number, rivals: readonly number[]): number {
  const better = rivals.filter((r) => (lowerIsBetter(contest) ? r < score : r > score)).length;
  return better + 1;
}

/** SPEC, Gains : podium selon la classe ; sinon quelques points (F-CON-5). */
export function contestRewards(cls: ContestClass, place: number): { points: number; coins: number } {
  const i = place - 1;
  const p = C.points[i];
  const k = C.coins[i];
  if (p === undefined || k === undefined) return { points: C.consolationPoints, coins: 0 };
  return { points: p * (C.pointsMult[cls] ?? 1), coins: k * (C.coinsMult[cls] ?? 1) };
}

export interface ContestResult {
  contestId: ContestId;
  contestClass: ContestClass;
  score: number;
  rivals: number[];
  place: number;
  prize: boolean;
  points: number;
  coins: number;
  classUp: boolean;
}

/** Podiums déjà obtenus dans cette épreuve et cette classe. */
function podiumsAt(dog: Dog, contest: ContestId, cls: ContestClass): number {
  return dog.trophies.filter((t) => t.contestId === contest && t.contestClass === cls).length;
}

/**
 * Fin d'un concours. Avec prix : coupe, pièces et points hors plafond, et montée de classe
 * à la première place ou au 2e podium de la classe (F-CON-4). Sans prix (F-CON-6) : le classement seul.
 */
export function settleContest(save: SaveGame, dogId: DogId, contest: ContestId, score: number, seed: number, now: number, prize: boolean): { save: SaveGame; result: ContestResult } {
  const dog = save.dogs.find((d) => d.id === dogId);
  const cls = dog?.contestClass[contest] ?? 0;
  const rivals = rivalScores(seed, contest, cls);
  const place = placeOf(contest, score, rivals);
  const base: ContestResult = { contestId: contest, contestClass: cls, score, rivals, place, prize, points: 0, coins: 0, classUp: false };
  if (!dog || !prize) return { save, result: base };
  const reward = contestRewards(cls, place);
  const podium = place <= 3;
  const classUp = podium && cls < 4 && (place === 1 || podiumsAt(dog, contest, cls) + 1 >= C.podiumsToRise);
  const counters = save.day.perDog[dogId] ?? { masterPoints: 0, caresses: 0, newTricks: 0, prizeContests: 0 };
  let next: SaveGame = {
    ...save,
    coins: save.coins + reward.coins,
    dogs: save.dogs.map((d) =>
      d.id !== dogId
        ? d
        : {
            ...d,
            trophies: podium ? [...d.trophies, { contestId: contest, contestClass: cls, place: place as 1 | 2 | 3, at: now }] : d.trophies,
            contestClass: classUp ? { ...d.contestClass, [contest]: (cls + 1) as ContestClass } : d.contestClass,
          },
    ),
    day: { ...save.day, perDog: { ...save.day.perDog, [dogId]: { ...counters, prizeContests: counters.prizeContests + 1 } } },
  };
  next = awardPoints(next, dogId, reward.points, false);
  return { save: next, result: { ...base, points: reward.points, coins: reward.coins, classUp } };
}

/** F-CON-6 : il reste des concours avec prix aujourd'hui. */
export function prizeLeft(save: SaveGame, dogId: DogId): number {
  return Math.max(0, C.prizePerDay - (save.day.perDog[dogId]?.prizeContests ?? 0));
}
