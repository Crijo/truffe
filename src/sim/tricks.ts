/** Dressage (F-DRE) : répétitions nécessaires, limites, tours combinés. */
import { BALANCE } from '../data/balance';
import { TRICKS, TRICK_IDS, type Posture, type TrickId } from '../data/tricks';
import type { Dog, LearnedTrick } from './state';

const TR = BALANCE.training;

/** F-DRE-2 : de 3 à 6 répétitions, moins pour un chiot docile et attaché. */
export function repsNeeded(traits: Dog['traits'], affection: number): number {
  const ease = 0.5 * traits.docility + 0.5 * (affection / 100);
  return Math.round(TR.repsMax - (TR.repsMax - TR.repsMin) * Math.min(1, Math.max(0, ease)));
}

/** F-DRE-5 : place pour un nouveau tour (14 au plus, 4 nouveaux par jour). */
export function canLearnNew(dog: Dog, learnedToday: number): boolean {
  return dog.tricks.filter((t) => t.learned).length < TR.maxTricks && learnedToday < TR.newPerDay;
}

/** Combiné secret déclenché par l'ordre `base` dans la posture donnée. */
export function comboFor(base: TrickId, posture: Posture): TrickId | null {
  return TRICK_IDS.find((id) => TRICKS[id].combo?.base === base && TRICKS[id].combo?.posture === posture) ?? null;
}

export function newTrick(id: TrickId): LearnedTrick {
  return { trickId: id, repetitions: 0, learned: false, mastery: 0, command: { label: TRICKS[id].label } };
}
