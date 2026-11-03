import { reduce, type GameAction } from '../sim/game';
import type { SaveGame } from '../sim/state';

type Listener = (state: SaveGame, action: GameAction) => void;

/** Seul point d'écriture de l'état : render/ et ui/ passent par dispatch. */
export class GameStore {
  private listeners = new Set<Listener>();

  constructor(private state: SaveGame) {}

  getState(): SaveGame {
    return this.state;
  }

  dispatch(action: GameAction): void {
    this.state = reduce(this.state, action);
    for (const l of this.listeners) l(this.state, action);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
