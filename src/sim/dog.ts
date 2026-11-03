import { BALANCE } from '../data/balance';
import type { Rng } from './rng';
import type { Dog } from './state';

type Temperament = keyof typeof BALANCE.temperaments;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function rollTraits(rng: Rng, temperament: Temperament): Dog['traits'] {
  const base = BALANCE.temperaments[temperament];
  const j = BALANCE.traitJitter;
  return {
    docility: clamp01(base.docility + rng.range(-j, j)),
    energy: clamp01(base.energy + rng.range(-j, j)),
    boldness: clamp01(base.boldness + rng.range(-j, j)),
  };
}

/** Beagle joueur de référence (tests ; le jeu passe par le chenil depuis le jalon 3). */
export function createStarterDog(rng: Rng): Dog {
  const s = BALANCE.start;
  return {
    id: `dog-${Math.floor(rng.next() * 2 ** 31).toString(36)}`,
    name: '',
    breedId: 'beagle',
    coat: { base: 0, patch: 0, patchAmount: 1 },
    sex: 'm',
    temperament: 'joueur',
    familiar: {},
    traits: rollTraits(rng, 'joueur'),
    needs: { hunger: s.hunger, thirst: s.thirst, cleanliness: s.cleanliness, energy: s.energy },
    affection: s.affection,
    stamina: s.stamina,
    tricks: [],
    contestClass: { disc: 0, agility: 0, obedience: 0 },
    trophies: [],
    equipped: [],
  };
}
