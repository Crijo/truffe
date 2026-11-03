import { BALANCE } from '../../src/data/balance';
import { createGameState, createNewGame, reduce, type GameState } from '../../src/sim/game';

/**
 * Partie avec un beagle « joueur » adopté au chenil, comme le chiot de départ
 * des jalons 1 et 2 : les tests de ces jalons gardent leurs hypothèses.
 */
export function startWithDog(now: number, tzOffsetMin: number, seed = 1): GameState {
  let s = reduce(createGameState(createNewGame(now, seed)), { type: 'session/start', now, tzOffsetMin });
  s = reduce(s, { type: 'kennel/open', breedId: 'beagle' });
  s = reduce(s, { type: 'adopt', index: 0, name: 'Truffe', now, tzOffsetMin });
  const ref = BALANCE.temperaments.joueur;
  return {
    ...s,
    save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, temperament: 'joueur', traits: { ...d.traits, docility: ref.docility, energy: ref.energy, boldness: ref.boldness } })) },
  };
}
