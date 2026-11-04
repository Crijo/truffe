/**
 * D-80 : atelier des tours avancés. Les 4 tours combinés s'apprennent aussi par un jeu de mémoire,
 * ouvert à un certain niveau du chiot : il montre une suite de mouvements, le joueur la refait.
 */
import { BALANCE } from '../data/balance';
import type { TrickId } from '../data/tricks';
import { levelOf } from './levels';
import { createRng } from './rng';
import type { Dog } from './state';

const W = BALANCE.workshop;
export type WorkshopTrick = keyof typeof W.levels;
export const WORKSHOP_TRICKS = Object.keys(W.levels) as WorkshopTrick[];

export function isWorkshopTrick(id: TrickId): id is WorkshopTrick {
  return id in W.levels;
}

/** Le chiot a le niveau pour ce tour. */
export function workshopOpen(dog: Pick<Dog, 'xp'>, trickId: WorkshopTrick): boolean {
  return levelOf(dog.xp).level >= W.levels[trickId];
}

/** Suite de mouvements à mémoriser (jamais deux fois le même de suite). */
export function workshopSequence(seed: number, length: number): TrickId[] {
  const rng = createRng(seed >>> 0);
  const out: TrickId[] = [];
  for (let i = 0; i < length; i++) {
    const prev = out[out.length - 1];
    out.push(rng.pick(W.pads.filter((p) => p !== prev)));
  }
  return out;
}
