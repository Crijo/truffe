/**
 * Promenade (F-PRO) : trajet sur le plan, événements tirés d'une graine,
 * marche en vue de profil avec la laisse, gains toutes les 30 minutes.
 */
import { BALANCE } from '../data/balance';
import { CITY_BY_ID, CITY_COLS, CITY_ROWS, HOME_NODE, type PlaceId } from '../data/city';
import { FINDABLE, type ItemId } from '../data/items';
import { createRng, type Rng } from './rng';

const W = BALANCE.walk;

export type Route = string[];
export interface QuestionPoint {
  nodeId: string;
  kind: 'gift' | 'encounter';
}

export interface WalkEvent {
  /** Distance depuis le départ, en mètres. */
  at: number;
  kind: 'question' | 'hidden' | 'poop' | 'place';
  sub?: 'gift' | 'encounter';
  /** Voie du trottoir : 0 côté rue, 1 côté maisons. */
  lane: number;
  itemId?: ItemId;
  place?: PlaceId;
}

export interface WalkPlan {
  route: Route;
  lengthM: number;
  events: WalkEvent[];
}

export interface WalkState {
  plan: WalkPlan;
  progress: number;
  lane: number;
  /** Voie vers laquelle le joueur tire la laisse ; null : laisse lâche. */
  laneTarget: number | null;
  /** Voie qui attire le chiot (une odeur, un bruit). */
  wish: number;
  nextWishAt: number;
  t: number;
  rngState: number;
  done: number[];
  collected: ItemId[];
  /** Points gagnés ou perdus en route (besoins ramassés ou oubliés). */
  pointsDelta: number;
  log: string[];
  barks: { at: number; sub: 'gift' | 'encounter'; count: number }[];
  poop: { index: number; until: number | null; picked: boolean } | null;
  pause: { kind: 'encounter' | 'place' | 'poop'; until: number | null; index: number } | null;
  /** Cette promenade donnera-t-elle des gains (F-PRO-7) ? */
  eligible: boolean;
  finished: boolean;
  rewarded: boolean;
  /** D-81 : vrais pas du joueur comptés pendant la marche. */
  steps: number;
}

// ---------------------------------------------------------------- plan

export function neighbors(id: string): string[] {
  const n = CITY_BY_ID[id];
  if (!n) return [];
  const out: string[] = [];
  for (const [dc, dr] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const c = n.col + dc;
    const r = n.row + dr;
    if (c >= 0 && c < CITY_COLS && r >= 0 && r < CITY_ROWS) out.push(`${c}-${r}`);
  }
  return out;
}

export const routeMeters = (r: Route): number => Math.max(0, r.length - 1) * W.edgeM;
export const maxMeters = (stamina: number): number => stamina * W.metersPerStamina;

/** F-PRO-1 : prolonge le trajet d'une rue voisine ; revenir en arrière efface la dernière. */
export function extendRoute(r: Route, node: string, stamina: number): Route {
  const last = r.at(-1) ?? HOME_NODE;
  if (r.length >= 2 && r[r.length - 2] === node) return r.slice(0, -1);
  if (!neighbors(last).includes(node)) return r;
  if (routeMeters(r) + W.edgeM > maxMeters(stamina)) return r;
  return [...r, node];
}

/** F-PRO-4 : les points « ? » du plan, tirés d'une graine. */
export function questionPoints(seed: number): QuestionPoint[] {
  const rng = createRng(seed ^ 0x51ed27);
  const free = Object.values(CITY_BY_ID).filter((n) => !n.place);
  const out: QuestionPoint[] = [];
  while (out.length < W.questionPoints) {
    const n = rng.pick(free);
    if (!out.some((q) => q.nodeId === n.id)) out.push({ nodeId: n.id, kind: rng.next() < 0.6 ? 'gift' : 'encounter' });
  }
  return out;
}

/** Les événements d'un trajet : tout vient de la graine, donc tout est reproductible. */
export function planWalk(route: Route, seed: number, questions: readonly QuestionPoint[]): WalkPlan {
  const lengthM = routeMeters(route);
  const events: WalkEvent[] = [];
  // Cadeaux cachés et besoins : flux de hasard propre, indépendant des « ? ».
  const rng = createRng(seed);
  for (let m = W.hiddenGiftEveryM * 0.6; m < lengthM - 15; m += W.hiddenGiftEveryM) {
    if (rng.next() < W.hiddenGiftChance) {
      events.push({ at: Math.round(m + rng.range(-30, 30)), kind: 'hidden', lane: rng.next() < 0.5 ? 0 : 1, itemId: rng.pick(FINDABLE) });
    }
  }
  if (lengthM >= 100 && rng.next() < W.poopChance) events.push({ at: Math.round(lengthM * rng.range(0.3, 0.75)), kind: 'poop', lane: 0 });
  // « ? » et lieux traversés.
  const qr = createRng(seed ^ 0x9e3779b9);
  route.forEach((id, i) => {
    if (i === 0) return;
    const at = i * W.edgeM;
    const q = questions.find((x) => x.nodeId === id);
    if (q && !events.some((e) => e.kind === 'question' && e.at === at)) {
      events.push(q.kind === 'gift' ? { at, kind: 'question', sub: 'gift', lane: 0, itemId: qr.pick(FINDABLE) } : { at, kind: 'question', sub: 'encounter', lane: 0 });
    }
    const place = CITY_BY_ID[id]?.place;
    if (place && place !== 'home' && !events.some((e) => e.kind === 'place' && e.place === place)) events.push({ at, kind: 'place', lane: 0, place });
  });
  events.sort((a, b) => a.at - b.at);
  return { route, lengthM, events };
}

/** F-PRO-7 : 10 points + 1 par 100 m, +1 d'endurance, +3 d'affection. */
export function walkGains(lengthM: number): { points: number; stamina: number; affection: number } {
  return { points: W.points.base + Math.floor((lengthM / 100) * W.points.per100m), stamina: W.stamina, affection: W.affection };
}

/** D-81 : bonus des vrais pas : points de maître et XP, plafonnés. */
export function stepBonus(steps: number): { points: number; xp: number } {
  const S = W.steps;
  return { points: Math.min(S.maxPoints, Math.floor(steps / S.perPoint)), xp: Math.min(S.maxXp, Math.floor(steps / S.perXp)) * BALANCE.levels.player.steps };
}

export const rewardable = (lastRewardedAt: number | null, now: number): boolean => lastRewardedAt === null || now - lastRewardedAt >= W.cooldownMs;

// ---------------------------------------------------------------- marche

export function startWalk(route: Route, seed: number, questions: readonly QuestionPoint[], eligible: boolean): WalkState {
  return {
    plan: planWalk(route, seed, questions),
    progress: 0,
    lane: 0.5,
    laneTarget: null,
    wish: 0.5,
    nextWishAt: 0,
    t: 0,
    rngState: (seed ^ 0x2545f491) >>> 0,
    done: [],
    collected: [],
    pointsDelta: 0,
    log: [],
    barks: [],
    poop: null,
    pause: null,
    eligible,
    finished: false,
    rewarded: false,
    steps: 0,
  };
}

function withRng<T>(w: WalkState, f: (r: Rng) => T): T {
  const r = createRng(0);
  r.setState(w.rngState);
  const out = f(r);
  w.rngState = r.getState();
  return out;
}

/** Termine la marche : un besoin non ramassé compte comme oublié. */
export function finishWalk(walk: WalkState, completed: boolean): WalkState {
  const w = structuredClone(walk);
  if (w.poop && !w.poop.picked) {
    w.pointsDelta += W.points.forget;
    w.log.push('forget');
    w.poop = null;
  }
  w.finished = true;
  w.rewarded = completed && w.eligible;
  w.pause = null;
  return w;
}

/** Un pas de marche. Le chiot suit la laisse plus volontiers s'il est docile. */
export function stepWalk(walk: WalkState, dtMs: number, docility: number): { walk: WalkState; picked: ItemId[]; ended: boolean } {
  if (walk.finished) return { walk, picked: [], ended: false };
  const w = structuredClone(walk);
  const dt = dtMs / 1000;
  w.t += dtMs;
  const picked: ItemId[] = [];

  // Fenêtre pour ramasser les besoins (F-PRO-6).
  if (w.poop && !w.poop.picked && w.poop.until !== null && w.t >= w.poop.until) {
    w.pointsDelta += W.points.forget;
    w.log.push('forget');
    w.poop = null;
  }
  if (w.pause) {
    if (w.pause.until !== null && w.t >= w.pause.until) {
      if (w.pause.kind === 'poop' && w.poop) w.poop.until = w.t + W.pickupMs;
      w.pause = null;
    } else return { walk: w, picked, ended: false };
  }

  // Avancer ; la voie résulte de la laisse et de ce qui attire le chiot.
  const before = w.progress;
  w.progress = Math.min(w.plan.lengthM, w.progress + W.speedMps * dt);
  if (w.t >= w.nextWishAt) {
    withRng(w, (r) => {
      w.wish = r.next() < 0.5 ? 0 : 1;
      w.nextWishAt = w.t + r.range(1500, 3500);
    });
  }
  const pullWish = W.wanderPull * (1 - docility * 0.5);
  w.lane += (w.wish - w.lane) * Math.min(1, pullWish * dt);
  if (w.laneTarget !== null) w.lane += (w.laneTarget - w.lane) * Math.min(1, W.leashPull * (0.5 + docility) * dt);
  w.lane = Math.min(1, Math.max(0, w.lane));

  w.plan.events.forEach((e, i) => {
    if (w.done.includes(i)) return;
    // Aboiements d'annonce (F-PRO-4) : un pour un cadeau, deux pour une rencontre.
    if (e.kind === 'question' && e.sub && before < e.at - W.barkLeadM && w.progress >= e.at - W.barkLeadM) {
      w.barks.push({ at: e.at, sub: e.sub, count: e.sub === 'gift' ? 1 : 2 });
    }
    if (e.at > w.progress) return;
    w.done.push(i);
    if (e.kind === 'hidden') {
      // F-PRO-5 : il fallait tirer la laisse à temps vers le cadeau.
      if (Math.abs(w.lane - e.lane) <= W.laneTolerance && e.itemId) {
        picked.push(e.itemId);
        w.collected.push(e.itemId);
        w.log.push('gift');
      } else w.log.push('missed');
    } else if (e.kind === 'question' && e.sub === 'gift' && e.itemId) {
      picked.push(e.itemId);
      w.collected.push(e.itemId);
      w.log.push('gift');
    } else if (e.kind === 'question' && e.sub === 'encounter') {
      w.pause = { kind: 'encounter', until: w.t + W.encounterMs, index: i };
      w.log.push('encounter');
    } else if (e.kind === 'poop') {
      w.pause = { kind: 'poop', until: w.t + W.poopStopMs, index: i };
      w.poop = { index: i, until: null, picked: false };
      w.log.push('poop');
    } else if (e.kind === 'place') {
      w.pause = { kind: 'place', until: null, index: i };
      w.log.push(`place:${e.place ?? ''}`);
    }
  });

  const ended = w.progress >= w.plan.lengthM && !w.pause;
  return { walk: ended ? finishWalk(w, true) : w, picked, ended };
}

/** Ramasser les besoins (F-PRO-6). */
export function pickUp(walk: WalkState): WalkState {
  if (!walk.poop || walk.poop.picked) return walk;
  return { ...walk, poop: { ...walk.poop, picked: true }, pointsDelta: walk.pointsDelta + W.points.pickup, log: [...walk.log, 'pickup'] };
}
