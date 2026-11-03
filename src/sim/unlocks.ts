/** Déblocages selon les points de maître (SPEC, Économie et progression). */
import { BALANCE } from '../data/balance';
import { STARTER_BREEDS } from '../data/breeds';
import { ITEM_BY_ID, type ItemId } from '../data/items';
import { gain } from './economy';
import type { BreedId, DecorId, SaveGame } from './state';

const TIERS = BALANCE.unlocks;

/** Paliers atteints avec ces points. */
export function tiersAt(points: number): number {
  return TIERS.filter((t) => points >= t.at).length;
}

/** Races proposées au chenil : les 6 de départ, puis les races débloquées. */
export function availableBreeds(points: number): BreedId[] {
  return [...STARTER_BREEDS, ...TIERS.filter((t) => points >= t.at).flatMap((t) => t.breeds)];
}

/** Décors du salon ouverts. */
export function availableDecors(points: number): DecorId[] {
  return ['home', ...TIERS.filter((t) => points >= t.at && t.decor !== null).map((t) => t.decor as DecorId)];
}

/** D-35 : la corde (et tout jouet de corde) arrive au premier palier. */
export function ropeUnlocked(points: number): boolean {
  return points >= (TIERS[0]?.at ?? 0);
}

/** Un objet encore verrouillé ne se vend pas en boutique. */
export function itemLocked(itemId: ItemId, points: number): boolean {
  return ITEM_BY_ID[itemId]?.toyKind === 'rope' && !ropeUnlocked(points);
}

/** Accorde les paliers nouvellement atteints : les objets offerts vont dans le sac. */
export function grantUnlocks(save: SaveGame): SaveGame {
  const reached = tiersAt(save.masterPoints);
  if (reached <= save.unlockTier) return save;
  let next = save;
  for (let i = save.unlockTier; i < reached; i++) {
    for (const id of TIERS[i]?.items ?? []) if (ITEM_BY_ID[id]) next = gain(next, id);
  }
  return { ...next, unlockTier: reached };
}

/** Ce que débloque un palier, pour l'annoncer. */
export function tierContent(i: number): (typeof TIERS)[number] | undefined {
  return TIERS[i];
}
