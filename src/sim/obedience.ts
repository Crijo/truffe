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

/**
 * D-75 : note d'obéissance montrée au joueur (0 à 1) : la probabilité d'obéir, sans malus,
 * avec la maîtrise moyenne des tours appris. Elle monte quand on fait s'exercer le chiot.
 */
export function dogObedience(d: { traits: { docility: number }; affection: number; tricks: readonly { learned: boolean; mastery: number }[] }): number {
  const learned = d.tricks.filter((t) => t.learned);
  if (learned.length === 0) return 0;
  const mastery = learned.reduce((a, t) => a + t.mastery, 0) / learned.length;
  return obeyProbability({ docility: d.traits.docility, affection: d.affection, mastery, malus: 0 });
}
