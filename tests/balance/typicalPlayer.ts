/**
 * Joueurs types pour l'équilibrage (SPEC, Tests : « un script simule 30 jours de joueurs types »).
 * Les gains passent par les vraies règles (plafond, concours, rivaux, épreuves en temps réel) ;
 * seuls les gestes du joueur sont résumés : ce qu'il fait chaque jour et son adresse.
 */
import { BALANCE } from '../../src/data/balance';
import { TRICK_IDS, type TrickId } from '../../src/data/tricks';
import { settleContest, prizeLeft } from '../../src/sim/contests';
import { startDisc, stepDisc, throwDisc } from '../../src/sim/contest/disc';
import { aimAgility, startAgility, stepAgility } from '../../src/sim/contest/agility';
import { orderObedience, startObedience, stepObedience } from '../../src/sim/contest/obedience';
import { awardPoints } from '../../src/sim/economy';
import { awardXp, levelOf } from '../../src/sim/levels';
import { createRng, type Rng } from '../../src/sim/rng';
import { tiersAt } from '../../src/sim/unlocks';
import { walkGains } from '../../src/sim/walk';
import type { ContestId, Dog, SaveGame } from '../../src/sim/state';
import { startWithDog } from '../sim/fixtures';

export interface Profile {
  name: string;
  minutes: number;
  /** Concours joués par jour (le joueur les fait tant qu'il reste des prix). */
  contests: number;
  /** Nouveaux tours tentés par jour, répétitions d'ordres connus. */
  newTricks: number;
  orders: number;
  walks: number;
  walkM: number;
  /** Soins : repas et eau, et un brossage tous les `groomEvery` jours. */
  groomEvery: number;
  /** Adresse de 0 à 1 aux concours. */
  skill: number;
}

export const PROFILES: Profile[] = [
  { name: 'Occasionnel (5 min)', minutes: 5, contests: 1, newTricks: 1, orders: 3, walks: 0, walkM: 0, groomEvery: 3, skill: 0.4 },
  { name: 'Quotidien (15 min)', minutes: 15, contests: 2, newTricks: 2, orders: 8, walks: 1, walkM: 500, groomEvery: 2, skill: 0.6 },
  { name: 'Acharné (60 min)', minutes: 60, contests: 6, newTricks: 4, orders: 30, walks: 3, walkM: 900, groomEvery: 1, skill: 0.85 },
];

const T0 = Date.UTC(2026, 10, 3, 18, 0);
const DAY = 24 * 3_600_000;
const G = BALANCE.gains;

const dogOf = (save: SaveGame): Dog => {
  const d = save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};
const editDog = (save: SaveGame, f: (d: Dog) => Dog): SaveGame => ({ ...save, dogs: save.dogs.map(f) });

/** Score d'une épreuve jouée par un joueur d'adresse `skill`. */
function playContest(dog: Dog, contest: ContestId, seed: number, skill: number, rng: Rng): number {
  const err = 1 - skill;
  if (contest === 'disc') {
    let r = startDisc(dog.traits, dog.needs.energy);
    let wait = 0;
    while (!r.finished) {
      if (r.disc.state === 'hand') {
        wait += 100;
        if (wait >= 500 + err * 1200) {
          r = throwDisc(r, rng.range(-0.1, 0.1), 0.48 + rng.range(-0.5, 0.5) * err);
          wait = 0;
        }
      }
      r = stepDisc(r, 100);
    }
    return r.score;
  }
  if (contest === 'agility') {
    let r = startAgility(dog.traits, dog.needs.energy);
    // Le doigt glisse vers le prochain point, plus ou moins vite et juste, et hésite parfois.
    let finger = { x: r.dog.x, y: r.dog.y };
    let goal = finger;
    let hesitate = 0;
    const fingerSpeed = 2.5 + 4 * skill;
    for (let t = 0; !r.finished; t += 100) {
      const p = r.course[r.next]?.points[r.sub];
      if (t % 500 === 0 && p) goal = { x: p.x + rng.range(-1, 1) * (0.2 + err * 1.2), y: p.y + rng.range(-1, 1) * (0.2 + err * 1.2) };
      const dx = goal.x - finger.x;
      const dy = goal.y - finger.y;
      const d = Math.hypot(dx, dy);
      const k = d > 0 ? Math.min(1, (fingerSpeed * 0.1) / d) : 0;
      finger = { x: finger.x + dx * k, y: finger.y + dy * k };
      if (hesitate <= 0 && rng.next() < err * 0.03) hesitate = 1200;
      hesitate -= 100;
      r = stepAgility(aimAgility(r, hesitate > 0 ? null : finger), 100);
    }
    return r.score;
  }
  let r = startObedience(dog, dog.contestClass.obedience, seed);
  let wait = 0;
  const react = 900 + err * 2600;
  while (!r.finished) {
    if (!r.waiting) {
      wait += 100;
      if (wait >= react + rng.range(0, 800)) {
        const wanted = r.orders[r.index] ?? 'sit';
        r = orderObedience(r, rng.next() < err * 0.12 ? (TRICK_IDS.find((t) => t !== wanted) ?? wanted) : wanted);
        wait = 0;
      }
    }
    r = stepObedience(r, 100);
  }
  return r.score;
}

export interface Run {
  profile: string;
  /** Points de maître à la fin de chaque jour. */
  points: number[];
  /** Jour (1 = premier jour) où chaque palier de déblocage est atteint. */
  tierDay: (number | null)[];
  /** D-78 : niveau du joueur à la fin de chaque jour. */
  levels: number[];
}

export function simulate(profile: Profile, days = 30, seed = 1): Run {
  const rng = createRng(seed);
  let save = startWithDog(T0, -60, seed).save;
  const id = dogOf(save).id;
  const points: number[] = [];
  const levels: number[] = [];
  const tierDay: (number | null)[] = BALANCE.unlocks.map(() => null);
  const learnable = TRICK_IDS.filter((t) => t !== 'flip' && t !== 'handstand' && t !== 'playdead' && t !== 'dance');
  for (let day = 1; day <= days; day++) {
    const now = T0 + (day - 1) * DAY;
    save = { ...save, lastSeenAt: now, day: { dayKey: `j${day}`, perDog: {} } };
    // Soins : après une journée, faim et soif sont bien bas.
    save = awardPoints(save, id, 2 * G.meal);
    save = awardXp(awardXp(save, id, 'meal'), id, 'water');
    save = awardXp(save, id, 'caress', Math.min(BALANCE.puppy.caress.dailyCap, profile.minutes));
    if (day % profile.groomEvery === 0) save = awardXp(awardPoints(save, id, G.groom), id, 'groom');
    // Promenade : 10 + 1 par 100 m, et un besoin ramassé. Le 1er jour passe par le parc, le 2e par le gymnase.
    for (let w = 0; w < profile.walks; w++) {
      save = awardPoints(save, id, walkGains(profile.walkM).points + BALANCE.walk.points.pickup);
      save = awardXp(awardXp(save, id, 'walk'), id, 'walk100m', Math.floor(profile.walkM / 100));
    }
    if (profile.walks > 0 || day >= 3) save = editDog(save, (d) => ({ ...d, visited: { park: true, gym: day >= 2 || profile.walks > 1, market: true } }));
    // Dressage : nouveaux tours (4 par jour au plus, 14 en tout), puis ordres réussis selon l'obéissance.
    const known = dogOf(save).tricks.filter((t) => t.learned).length;
    const fresh = Math.max(0, Math.min(profile.newTricks, BALANCE.training.newPerDay, BALANCE.training.maxTricks - known));
    for (let k = 0; k < fresh; k++) {
      const trick = learnable[known + k] as TrickId | undefined;
      if (!trick) break;
      save = editDog(save, (d) => ({ ...d, tricks: [...d.tricks, { trickId: trick, repetitions: 5, learned: true, mastery: 0, command: { label: trick } }] }));
      save = awardXp(awardXp(awardPoints(save, id, G.newTrick), id, 'newTrick'), id, 'trickRepeat', 5);
    }
    for (let o = 0; o < profile.orders && dogOf(save).tricks.length > 0; o++) {
      if (rng.next() < 0.65) {
        save = awardXp(awardPoints(save, id, G.trickRepeat), id, 'masteryUp');
        const t = rng.pick(dogOf(save).tricks);
        save = editDog(save, (d) => ({ ...d, tricks: d.tricks.map((x) => (x.trickId === t.trickId ? { ...x, mastery: Math.min(1, x.mastery + 0.05) } : x)) }));
      }
    }
    // Concours : le joueur varie les épreuves ouvertes, dans un ordre différent chaque jour.
    const order = (['disc', 'agility', 'obedience'] as const).map((k) => ({ k, r: rng.next() })).sort((a, b) => a.r - b.r).map((x) => x.k);
    for (let c = 0; c < profile.contests && prizeLeft(save, id) > 0; c++) {
      const d = dogOf(save);
      const open = order.filter((k) => (k === 'disc' ? d.visited.park : k === 'agility' ? d.visited.gym : d.tricks.length > 0));
      if (open.length === 0) break;
      const contest = open[c % open.length] ?? 'disc';
      const cseed = Math.floor(rng.next() * 2 ** 31);
      const score = Math.round(playContest(d, contest, cseed, profile.skill, rng) * 10) / 10;
      const settled = settleContest(save, id, contest, score, cseed, now, true);
      save = awardXp(settled.save, id, 'contest');
      if (settled.result.place <= 3) save = awardXp(save, id, 'podium', 4 - settled.result.place);
    }
    points.push(save.masterPoints);
    levels.push(levelOf(save.xp).level);
    const reached = tiersAt(save.masterPoints);
    for (let i = 0; i < reached; i++) tierDay[i] ??= day;
  }
  return { profile: profile.name, points, tierDay, levels };
}
