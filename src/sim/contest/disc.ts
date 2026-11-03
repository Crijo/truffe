/**
 * F-CON-1 : concours de disque. Terrain vu de dessus, en mètres : x de côté, y devant le joueur.
 * Le score dépend de la distance et de la difficulté de l'attrapé : en l'air, il rapporte bien plus.
 */
import { BALANCE } from '../../data/balance';
import type { Dog } from '../state';

const D = BALANCE.contests.disc;

export interface DiscCatch {
  meters: number;
  points: number;
  air: boolean;
  out: boolean;
}

export interface DiscRun {
  kind: 'disc';
  timeLeftMs: number;
  disc: { x: number; y: number; h: number; vx: number; vy: number; vh: number; state: 'hand' | 'flying' | 'ground' | 'mouth' };
  /** Point où le disque va retomber, que le chiot vise. */
  land: { x: number; y: number } | null;
  dog: { x: number; y: number; phase: 'wait' | 'chase' | 'return' };
  speed: number;
  throws: number;
  catches: DiscCatch[];
  score: number;
  finished: boolean;
}

export function startDisc(traits: Dog['traits'], energy: number): DiscRun {
  const [lo, hi] = D.dogSpeedMps;
  const speed = (lo + (hi - lo) * traits.energy) * (energy < 20 ? 0.8 : 1);
  return {
    kind: 'disc',
    timeLeftMs: D.durationMs,
    disc: { x: 0, y: 0, h: D.startHeightM, vx: 0, vy: 0, vh: 0, state: 'hand' },
    land: null,
    dog: { x: 0, y: D.homeY, phase: 'wait' },
    speed,
    throws: 0,
    catches: [],
    score: 0,
    finished: false,
  };
}

/** Un pas de vol du disque. */
function fly(d: DiscRun['disc'], dt: number): DiscRun['disc'] {
  const k = Math.exp(-D.drag * dt);
  return { ...d, x: d.x + d.vx * dt, y: d.y + d.vy * dt, vx: d.vx * k, vy: d.vy * k, h: d.h + d.vh * dt, vh: d.vh - D.gravity * dt };
}

const outside = (p: { x: number; y: number }): boolean => Math.abs(p.x) > D.halfWidthM || p.y > D.fieldM || p.y < 0;

/** Lancer au geste : `fx`, `fy` en pixels par milliseconde, `fy` positif vers le haut de l'écran. */
export function throwDisc(run: DiscRun, fx: number, fy: number): DiscRun {
  if (run.finished || run.disc.state !== 'hand' || fy <= 0) return run;
  const len = Math.hypot(fx, fy);
  const speed = Math.min(D.maxSpeedMps, Math.max(D.minSpeedMps, len * 1000 * D.fingerSensitivity));
  let disc: DiscRun['disc'] = { x: 0, y: 0, h: D.startHeightM, vx: (fx / len) * speed, vy: (fy / len) * speed, vh: D.liftMps, state: 'flying' };
  const start = disc;
  for (let i = 0; i < 400 && disc.h > 0; i++) disc = fly(disc, 0.02);
  return { ...run, disc: start, land: { x: disc.x, y: disc.y }, dog: { ...run.dog, phase: 'chase' }, throws: run.throws + 1 };
}

function moveToward(p: { x: number; y: number }, to: { x: number; y: number }, step: number): { x: number; y: number; arrived: boolean } {
  const dx = to.x - p.x;
  const dy = to.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d <= step) return { x: to.x, y: to.y, arrived: true };
  return { x: p.x + (dx / d) * step, y: p.y + (dy / d) * step, arrived: false };
}

function caught(run: DiscRun, air: boolean): DiscRun {
  const meters = Math.hypot(run.disc.x, run.disc.y);
  const out = outside(run.disc);
  const points = out ? 0 : Math.round(meters * (air ? D.airMult : D.groundMult));
  return {
    ...run,
    disc: { ...run.disc, state: 'mouth', h: 0.4, vx: 0, vy: 0, vh: 0 },
    land: null,
    dog: { ...run.dog, phase: 'return' },
    catches: [...run.catches, { meters: Math.round(meters * 10) / 10, points, air, out }],
    score: run.score + points,
  };
}

export function stepDisc(run: DiscRun, dtMs: number): DiscRun {
  if (run.finished) return run;
  const dt = dtMs / 1000;
  let r: DiscRun = { ...run, timeLeftMs: run.timeLeftMs - dtMs };
  if (r.disc.state === 'flying') {
    const d = fly(r.disc, dt);
    r = { ...r, disc: d.h <= 0 ? { ...d, h: 0, vx: 0, vy: 0, vh: 0, state: 'ground' } : d };
  }
  if (r.dog.phase === 'chase') {
    const target = r.disc.state === 'ground' ? r.disc : (r.land ?? r.disc);
    const m = moveToward(r.dog, target, r.speed * dt);
    r = { ...r, dog: { x: m.x, y: m.y, phase: 'chase' } };
    const dist = Math.hypot(r.dog.x - r.disc.x, r.dog.y - r.disc.y);
    // Attrapé en l'air : le disque redescend, à portée de gueule.
    if (r.disc.state === 'flying' && r.disc.vh < 0 && r.disc.h <= D.catchHeightM && dist <= D.catchRadiusM) r = caught(r, true);
    else if (r.disc.state === 'ground' && (outside(r.disc) || dist <= 0.5)) r = caught(r, false);
  } else if (r.dog.phase === 'return') {
    const m = moveToward(r.dog, { x: 0, y: D.homeY }, D.returnSpeedMps * dt);
    r = { ...r, dog: { x: m.x, y: m.y, phase: m.arrived ? 'wait' : 'return' } };
    r = { ...r, disc: m.arrived ? { x: 0, y: 0, h: D.startHeightM, vx: 0, vy: 0, vh: 0, state: 'hand' } : { ...r.disc, x: m.x, y: m.y } };
  }
  if (r.timeLeftMs <= 0) r = { ...r, timeLeftMs: 0, finished: true };
  return r;
}
