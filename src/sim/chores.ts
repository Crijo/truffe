/**
 * D-91 : le salon se salit (traces de pattes au retour de promenade, miettes des repas,
 * poils avec le temps) ; un mini-jeu à l'éponge le nettoie.
 */
import { BALANCE } from '../data/balance';
import type { Rng } from './rng';
import type { SaveGame } from './state';

const C = BALANCE.chores;

export type DirtKind = 'paw' | 'crumbs' | 'fur';

export interface Dirt {
  id: string;
  kind: DirtKind;
  pos: { x: number; z: number };
  /** Ce qui reste à frotter, de 1 (tache entière) à 0 (propre). */
  size: number;
  at: number;
}

/** Ménage en cours : temps écoulé, taches au début, taches effacées. */
export interface ChoresRun {
  t: number;
  start: number;
  cleaned: number;
}

export interface ChoresResult {
  cleaned: number;
  points: number;
  bonus: boolean;
}

/** Ajoute des taches (sans dépasser le maximum). */
export function addDirt(save: SaveGame, kind: DirtKind, spots: readonly { x: number; z: number }[], now: number): SaveGame {
  const room = C.maxSpots - save.dirt.length;
  if (room <= 0 || spots.length === 0) return save;
  const added = spots.slice(0, room).map((pos, i) => ({ id: `${kind}-${now.toString(36)}-${save.dirt.length + i}`, kind, pos: { ...pos }, size: 1, at: now }));
  return { ...save, dirt: [...save.dirt, ...added] };
}

/** Traces de pattes : de la porte (à droite du salon) vers le milieu. */
export function pawTrail(rng: Rng, n: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const z0 = rng.range(0.45, 0.75);
  for (let i = 0; i < n; i++) {
    const k = n > 1 ? i / (n - 1) : 0;
    out.push({ x: C.doorX - k * (C.doorX - 0.2) + rng.range(-0.05, 0.05), z: Math.min(0.88, Math.max(0.2, z0 + (i % 2 ? 0.05 : -0.05) + rng.range(-0.04, 0.04))) });
  }
  return out;
}

/** Poils : un toutes les `furEveryMs` depuis le dernier, n'importe où dans le salon. */
export function accumulateFur(save: SaveGame, now: number, rng: Rng): SaveGame {
  let s = save;
  let clock = s.dirtClockAt;
  const R = BALANCE.puppy.roam;
  const f = BALANCE.puppy.floor;
  while (now - clock >= C.furEveryMs) {
    clock += C.furEveryMs;
    if (s.dirt.length >= C.maxSpots) {
      clock = now;
      break;
    }
    s = addDirt(s, 'fur', [{ x: rng.range(R.minX + 0.3, R.maxX - 0.3), z: rng.range(f.minZ + 0.1, f.maxZ - 0.05) }], clock);
  }
  return clock === s.dirtClockAt ? s : { ...s, dirtClockAt: clock };
}

/** Frotte une tache ; renvoie aussi si elle vient d'être effacée. */
export function scrubDirt(save: SaveGame, id: string, px: number): { save: SaveGame; cleaned: boolean } {
  const d = save.dirt.find((x) => x.id === id);
  if (!d || px <= 0) return { save, cleaned: false };
  const size = d.size - px / C.scrubPx;
  if (size <= 1e-6) return { save: { ...save, dirt: save.dirt.filter((x) => x.id !== id) }, cleaned: true };
  return { save: { ...save, dirt: save.dirt.map((x) => (x.id === id ? { ...x, size } : x)) }, cleaned: false };
}

/** Points du ménage : par tache effacée, et un bonus si tout est propre avant la fin du temps. */
export function choresResult(run: ChoresRun, left: number): ChoresResult {
  const bonus = left === 0 && run.cleaned > 0 && run.t <= C.limitMs;
  return { cleaned: run.cleaned, points: run.cleaned * C.pointsPerSpot + (bonus ? C.bonus : 0), bonus };
}

/** Salon assez sale pour que le pelage se salisse plus vite. */
export const roomIsDirty = (save: SaveGame): boolean => save.dirt.length >= C.dirtyRoomSpots;
