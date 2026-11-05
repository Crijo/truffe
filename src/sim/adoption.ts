/** Chenil et adoption (F-ADO). */
import { BALANCE } from '../data/balance';
import { BREEDS } from '../data/breeds';
import { rollTraits } from './dog';
import type { Rng } from './rng';
import type { BreedId, CoatParams, Dog, SaveGame, Sex, TemperamentId } from './state';

export interface Candidate {
  id: string;
  breedId: BreedId;
  coat: CoatParams;
  sex: Sex;
  temperament: TemperamentId;
  traits: Dog['traits'];
}

const TEMPERAMENTS: readonly TemperamentId[] = ['sage', 'joueur', 'timide', 'tetu'];

/** F-ADO-1 : 3 chiots tirés au hasard pour la race choisie. */
export function rollLitter(rng: Rng, breedId: BreedId): Candidate[] {
  const coats = BREEDS[breedId]?.coats.length ?? 1;
  return Array.from({ length: BALANCE.adoption.litterSize }, () => {
    const temperament = rng.pick(TEMPERAMENTS);
    return {
      id: `dog-${Math.floor(rng.next() * 2 ** 31).toString(36)}`,
      breedId,
      coat: { base: Math.floor(rng.next() * coats), patch: rng.range(-1, 1), patchAmount: rng.range(0.8, 1.2) },
      sex: rng.next() < 0.5 ? 'f' : 'm',
      temperament,
      traits: rollTraits(rng, temperament),
    };
  });
}

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'long' | 'chars' };

/** F-ADO-3 : un nom au clavier, court, fait de lettres. */
export function validateName(raw: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return { ok: false, reason: 'empty' };
  if (name.length > BALANCE.adoption.nameMaxLength) return { ok: false, reason: 'long' };
  if (!/^\p{L}[\p{L}\p{M}' -]*$/u.test(name)) return { ok: false, reason: 'chars' };
  return { ok: true, name };
}

/** F-ADO-4 : le premier chiot est offert. */
export function adoptionPrice(save: SaveGame, breedId: BreedId): number {
  return save.dogs.length === 0 ? 0 : (BREEDS[breedId]?.price ?? 0);
}

export function dogFromCandidate(c: Candidate, name: string): Dog {
  const s = BALANCE.start;
  return {
    id: c.id,
    name,
    breedId: c.breedId,
    coat: c.coat,
    sex: c.sex,
    temperament: c.temperament,
    traits: c.traits,
    needs: { hunger: s.hunger, thirst: s.thirst, cleanliness: s.cleanliness, energy: s.energy, fun: s.fun },
    affection: s.affection,
    stamina: s.stamina,
    tricks: [],
    contestClass: { disc: 0, agility: 0, obedience: 0 },
    trophies: [],
    equipped: [],
    familiar: {},
    walks: { lastRewardedAt: null, count: 0 },
    lastReliefAt: 0,
    xp: 0,
    visited: { park: false, gym: false, market: false },
  };
}
