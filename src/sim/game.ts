import { SAVE_VERSION, type SaveGame } from './state';

export type GameAction =
  | { type: 'session/start'; now: number }
  | { type: 'tick'; now: number; dtMs: number };

export function createNewGame(now: number, seed: number): SaveGame {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeenAt: now,
    coins: 0,
    masterPoints: 0,
    inventory: {},
    discovered: { items: [], tricks: [] },
    dogs: [],
    homeDogIds: [],
    day: { dayKey: '', perDog: {} },
    settings: { reduceMotion: false, musicVolume: 0.6, sfxVolume: 0.8, micAllowed: null },
    rngState: seed >>> 0,
    stats: { sessions: 0 },
  };
}

/** Une horloge qui recule ne fait jamais reculer lastSeenAt. */
function seen(state: SaveGame, now: number): number {
  return Math.max(state.lastSeenAt, now);
}

/** Réducteur pur : renvoie un nouvel état, ne modifie jamais celui reçu. */
export function reduce(state: SaveGame, action: GameAction): SaveGame {
  switch (action.type) {
    case 'session/start':
      return {
        ...state,
        lastSeenAt: seen(state, action.now),
        stats: { ...state.stats, sessions: state.stats.sessions + 1 },
      };
    case 'tick':
      return { ...state, lastSeenAt: seen(state, action.now) };
  }
}
