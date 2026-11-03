/**
 * Temps écoulé hors ligne, appliqué en un seul calcul (SPEC, Temps et sauvegarde).
 * Faim, soif et propreté ne descendent pas sous 5 ; seules les 72 dernières heures comptent.
 */
import { BALANCE } from '../data/balance';
import { dayKeyAt } from './day';
import type { Dog } from './state';

const HOUR = 3_600_000;

export function applyOffline(dog: Dog, fromMs: number, toMs: number, tzOffsetMin: number): Dog {
  if (!(toMs > fromMs)) return dog;
  const O = BALANCE.needs.offline;
  const r = BALANCE.needs.perHour;
  const start = Math.max(fromMs, toMs - O.maxHours * HOUR);
  const h = (toMs - start) / HOUR;
  const decay = (v: number, rate: number): number => (v < O.floor ? v : Math.max(O.floor, v - rate * h));

  // D-12 : un jour d'absence = un passage de 4 h du matin.
  const days = Number(dayKeyAt(toMs, tzOffsetMin)) - Number(dayKeyAt(start, tzOffsetMin));
  const affection = dog.affection <= O.affectionFloor ? dog.affection : Math.max(O.affectionFloor, dog.affection - days * O.affectionPerDay);

  return {
    ...dog,
    affection,
    needs: {
      hunger: decay(dog.needs.hunger, r.hunger),
      thirst: decay(dog.needs.thirst, r.thirst),
      cleanliness: decay(dog.needs.cleanliness, r.cleanliness),
      energy: Math.min(100, dog.needs.energy + O.energyRestPerHour * h),
    },
  };
}
