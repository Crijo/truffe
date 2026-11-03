/**
 * F-CON-2 : concours d'agilité. Le chiot suit le doigt d'obstacle en obstacle ;
 * le score est le temps, plus 5 secondes par obstacle sauté ou manqué.
 * Terrain vu de dessus, en mètres : x de −10 à 10, y de 0 à 28.
 */
import { BALANCE } from '../../data/balance';
import type { Dog } from '../state';

const A = BALANCE.contests.agility;

export type ObstacleKind = 'hurdle' | 'tunnel' | 'slalom' | 'seesaw' | 'finish';

export interface Obstacle {
  kind: ObstacleKind;
  /** Points à toucher dans l'ordre ; tunnel et balançoire se traversent seuls une fois entrés. */
  points: readonly { x: number; y: number; r: number }[];
}

const G = A.gateWidthM / 2;

export const AGILITY_COURSE: readonly Obstacle[] = [
  { kind: 'hurdle', points: [{ x: -4, y: 6, r: G }] },
  { kind: 'hurdle', points: [{ x: -6, y: 12, r: G }] },
  { kind: 'tunnel', points: [{ x: -6, y: 16, r: G }, { x: -5, y: 20, r: 0.3 }, { x: -2, y: 23, r: 0.3 }] },
  {
    kind: 'slalom',
    points: [
      { x: 2, y: 24, r: 0.8 },
      { x: 3.6, y: 22.4, r: 0.8 },
      { x: 2, y: 20.8, r: 0.8 },
      { x: 3.6, y: 19.2, r: 0.8 },
      { x: 2, y: 17.6, r: 0.8 },
      { x: 3.6, y: 16, r: 0.8 },
    ],
  },
  { kind: 'seesaw', points: [{ x: 6.5, y: 13.5, r: G }, { x: 6.5, y: 7.5, r: 0.3 }] },
  { kind: 'hurdle', points: [{ x: 3, y: 4.5, r: G }] },
  { kind: 'finish', points: [{ x: 1.5, y: 1, r: 1.5 }] },
];

export const AGILITY_START = { x: -2, y: 1 } as const;

export interface AgilityRun {
  kind: 'agility';
  course: readonly Obstacle[];
  next: number;
  sub: number;
  /** Dans le tunnel ou sur la balançoire : le chiot avance seul. */
  auto: boolean;
  dog: { x: number; y: number; heading: number };
  target: { x: number; y: number } | null;
  speed: number;
  timeMs: number;
  penalties: number;
  /** Obstacles franchis (vrai) ou manqués (faux), dans l'ordre. */
  cleared: boolean[];
  score: number;
  finished: boolean;
}

export function startAgility(traits: Dog['traits'], energy: number): AgilityRun {
  const [lo, hi] = A.dogSpeedMps;
  return {
    kind: 'agility',
    course: AGILITY_COURSE,
    next: 0,
    sub: 0,
    auto: false,
    dog: { x: AGILITY_START.x, y: AGILITY_START.y, heading: 0 },
    target: null,
    speed: (lo + (hi - lo) * traits.energy) * (energy < 20 ? 0.8 : 1),
    timeMs: 0,
    penalties: 0,
    cleared: [],
    score: 0,
    finished: false,
  };
}

/** Le doigt sur le terrain (null : levé). */
export function aimAgility(run: AgilityRun, at: { x: number; y: number } | null): AgilityRun {
  return run.finished ? run : { ...run, target: at };
}

const near = (p: { x: number; y: number }, q: { x: number; y: number; r: number }): boolean => Math.hypot(p.x - q.x, p.y - q.y) <= q.r;

function finish(run: AgilityRun, extraPenalties: number): AgilityRun {
  const penalties = run.penalties + extraPenalties;
  return { ...run, penalties, finished: true, score: run.timeMs / 1000 + penalties * A.penaltyS };
}

/** Obstacle suivant ; `skipped` obstacles comptent en pénalité. */
function advance(run: AgilityRun, to: number, skipped: number): AgilityRun {
  const cleared = [...run.cleared, ...Array.from({ length: skipped }, () => false), true];
  const r: AgilityRun = { ...run, next: to + 1, sub: 0, auto: false, penalties: run.penalties + skipped, cleared };
  return r.next >= r.course.length ? finish(r, 0) : r;
}

export function stepAgility(run: AgilityRun, dtMs: number): AgilityRun {
  if (run.finished) return run;
  let r: AgilityRun = { ...run, timeMs: run.timeMs + dtMs };
  const ob = r.course[r.next];
  if (!ob) return finish(r, 0);
  const dt = dtMs / 1000;
  const slow = ob.kind === 'tunnel' ? A.tunnelSlow : ob.kind === 'seesaw' ? A.seesawSlow : 1;
  const goal = r.auto ? ob.points[r.sub] : r.target;
  if (goal) {
    const dx = goal.x - r.dog.x;
    const dy = goal.y - r.dog.y;
    const d = Math.hypot(dx, dy);
    const step = r.speed * (r.auto ? slow : 1) * dt;
    if (d > 0.2) {
      const k = Math.min(1, step / d);
      r = { ...r, dog: { x: r.dog.x + dx * k, y: r.dog.y + dy * k, heading: Math.atan2(dx, dy) } };
    }
  }
  if (r.auto) {
    const p = ob.points[r.sub];
    if (p && near(r.dog, p)) r = r.sub + 1 >= ob.points.length ? advance(r, r.next, 0) : { ...r, sub: r.sub + 1 };
  } else {
    const p = ob.points[r.sub];
    if (p && near(r.dog, p)) {
      if (r.sub + 1 >= ob.points.length) r = advance(r, r.next, 0);
      else r = { ...r, sub: r.sub + 1, auto: ob.kind === 'tunnel' || ob.kind === 'seesaw' };
    } else if (r.sub === 0) {
      // Le chiot arrive sur un obstacle plus loin : ceux d'avant sont manqués.
      for (let j = r.next + 1; j < r.course.length; j++) {
        const first = r.course[j]?.points[0];
        if (first && near(r.dog, first)) {
          const skipped = j - r.next;
          const later = r.course[j];
          r = later && later.points.length > 1 ? { ...r, next: j, sub: 1, penalties: r.penalties + skipped, cleared: [...r.cleared, ...Array.from({ length: skipped }, () => false)], auto: later.kind === 'tunnel' || later.kind === 'seesaw' } : advance(r, j, skipped);
          break;
        }
      }
    }
  }
  if (!r.finished && r.timeMs >= A.timeCapMs) r = finish({ ...r, cleared: r.cleared }, r.course.length - r.next);
  return r;
}
