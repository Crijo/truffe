/** SPEC, Obéissance (F-DRE-4) : probabilité d'exécuter un ordre reconnu. */
import { BALANCE } from '../data/balance';

const O = BALANCE.obedience;
const URGENT = BALANCE.needs.words.hunger[2];

export function obeyProbability(p: { docility: number; affection: number; mastery: number; malus: number }): number {
  const v = O.base + O.perDocility * p.docility + (O.perAffection * p.affection) / 100 + O.perMastery * p.mastery - p.malus;
  return Math.min(O.max, Math.max(O.min, v));
}

/** Malus : faim ou soif urgente, fatigue, ordres répétés en moins d'une minute. */
export function obedienceMalus(s: { hunger: number; thirst: number; energy: number; recentOrders: number }): number {
  let m = 0;
  if (s.hunger < URGENT || s.thirst < URGENT) m += O.malusUrgent;
  if (s.energy < O.tiredBelow) m += O.malusTired;
  if (s.recentOrders >= O.spamCount) m += O.malusSpam;
  return m;
}
