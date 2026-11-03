import { reduce, type GameAction, type GameState } from '../sim/game';

type Listener = (state: GameState, action: GameAction) => void;

/** Seul point d'écriture de l'état : render/ et ui/ passent par dispatch. */
export class GameStore {
  private listeners = new Set<Listener>();

  constructor(private state: GameState) {}

  getState(): GameState {
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
