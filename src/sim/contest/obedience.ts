/**
 * F-CON-3 : concours d'obéissance. Un enchaînement imposé d'ordres, tirés parmi les tours appris ;
 * chaque ordre suivi rapporte des points, d'autant plus qu'il a été donné vite.
 */
import { BALANCE } from '../../data/balance';
import type { TrickId } from '../../data/tricks';
import { obedienceMalus, obeyProbability } from '../obedience';
import { createRng } from '../rng';
import type { ContestClass, Dog } from '../state';

const O = BALANCE.contests.obedience;
/** Le chiot exécute le tour avant l'ordre suivant. */
const PERFORM_MS = 1500;

export interface ObedienceRun {
  kind: 'obedience';
  orders: TrickId[];
  index: number;
  elapsedMs: number;
  /** Le chiot exécute (ou rate) : l'ordre suivant attend. */
  waiting: boolean;
  waitMs: number;
  results: { ok: boolean; points: number }[];
  score: number;
  finished: boolean;
  rngState: number;
  dog: { docility: number; affection: number; hunger: number; thirst: number; energy: number; mastery: Partial<Record<TrickId, number>> };
}

export function startObedience(dog: Dog, cls: ContestClass, seed: number): ObedienceRun {
  const rng = createRng(seed >>> 0);
  const known = dog.tricks.filter((t) => t.learned).map((t) => t.trickId);
  const count = 5 + cls;
  const orders: TrickId[] = [];
  for (let i = 0; i < count && known.length > 0; i++) {
    // Jamais deux fois de suite le même ordre, s'il y a le choix.
    let pick = rng.pick(known);
    if (known.length > 1 && pick === orders[orders.length - 1]) pick = rng.pick(known.filter((k) => k !== pick));
    orders.push(pick);
  }
  return {
    kind: 'obedience',
    orders,
    index: 0,
    elapsedMs: 0,
    waiting: false,
    waitMs: 0,
    results: [],
    score: 0,
    finished: orders.length === 0,
    rngState: rng.getState(),
    dog: {
      docility: dog.traits.docility,
      affection: dog.affection,
      hunger: dog.needs.hunger,
      thirst: dog.needs.thirst,
      energy: dog.needs.energy,
      mastery: Object.fromEntries(dog.tricks.map((t) => [t.trickId, t.mastery])),
    },
  };
}

function record(run: ObedienceRun, ok: boolean, points: number): ObedienceRun {
  return { ...run, results: [...run.results, { ok, points }], score: run.score + points, waiting: true, waitMs: 0 };
}

/** Ordre donné au bouton ou à la voix. */
export function orderObedience(run: ObedienceRun, trickId: TrickId): ObedienceRun {
  if (run.finished || run.waiting) return run;
  const wanted = run.orders[run.index];
  if (trickId !== wanted) return record(run, false, 0);
  const rng = createRng(run.rngState);
  const d = run.dog;
  const malus = obedienceMalus({ hunger: d.hunger, thirst: d.thirst, energy: d.energy, recentOrders: 0 });
  const p = obeyProbability({ docility: d.docility, affection: d.affection, mastery: d.mastery[trickId] ?? 0, malus });
  const ok = rng.next() < p;
  const points = ok ? Math.round(O.pointsPerTrick + O.speedBonus * Math.max(0, 1 - run.elapsedMs / O.orderMs)) : 0;
  return { ...record(run, ok, points), rngState: rng.getState() };
}

export function stepObedience(run: ObedienceRun, dtMs: number): ObedienceRun {
  if (run.finished) return run;
  if (run.waiting) {
    const waitMs = run.waitMs + dtMs;
    if (waitMs < PERFORM_MS) return { ...run, waitMs };
    const index = run.index + 1;
    return { ...run, index, elapsedMs: 0, waiting: false, waitMs: 0, finished: index >= run.orders.length };
  }
  const elapsedMs = run.elapsedMs + dtMs;
  // Trop tard : l'ordre compte comme raté.
  return elapsedMs >= O.orderMs ? record({ ...run, elapsedMs }, false, 0) : { ...run, elapsedMs };
}

/** Le tour que le chiot exécute en ce moment, s'il a obéi. */
export function performing(run: ObedienceRun): TrickId | null {
  return run.waiting && run.results[run.results.length - 1]?.ok ? (run.orders[run.index] ?? null) : null;
}
