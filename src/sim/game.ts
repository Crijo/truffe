import { BALANCE } from '../data/balance';
import { createMind, handleGesture, startGreeting, tickMind, type Effects, type Gesture, type PuppyContext, type PuppyMind } from './behavior';
import { dayKeyAt } from './day';
import { createStarterDog } from './dog';
import { createRng } from './rng';
import { SAVE_VERSION, type Dog, type DogDailyCounters, type DogId, type SaveGame } from './state';

/** État complet : la partie sauvegardée et l'esprit (non sauvegardé) de chaque chiot présent. */
export interface GameState {
  save: SaveGame;
  minds: Record<DogId, PuppyMind>;
}

export type GameAction =
  | { type: 'session/start'; now: number; tzOffsetMin: number }
  | { type: 'session/resume'; now: number; tzOffsetMin: number }
  | { type: 'tick'; now: number; dtMs: number; tzOffsetMin: number }
  | { type: 'gesture'; gesture: Gesture; dogId?: DogId };

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

export function createGameState(save: SaveGame): GameState {
  return { save, minds: {} };
}

const emptyCounters = (): DogDailyCounters => ({ masterPoints: 0, caresses: 0, newTricks: 0, prizeContests: 0 });

function contextOf(dog: Dog): PuppyContext {
  return { traits: dog.traits, affection: dog.affection, energy: dog.needs.energy };
}

/** Jalon 1 : crée le beagle de départ s'il n'y a encore aucun chien. */
function ensureDogs(save: SaveGame): SaveGame {
  if (save.dogs.length > 0) return save;
  const rng = createRng(save.rngState);
  const dog = createStarterDog(rng);
  return { ...save, dogs: [dog], homeDogIds: [dog.id], rngState: rng.getState() };
}

function ensureMinds(state: GameState): GameState {
  const missing = state.save.homeDogIds.filter((id) => !state.minds[id]);
  if (missing.length === 0) return state;
  const rng = createRng(state.save.rngState);
  const minds = { ...state.minds };
  for (const id of missing) minds[id] = createMind(Math.floor(rng.next() * 2 ** 32));
  return { save: { ...state.save, rngState: rng.getState() }, minds };
}

function rollDay(save: SaveGame, now: number, tzOffsetMin: number): SaveGame {
  if (now < save.lastSeenAt) return save;
  const key = dayKeyAt(now, tzOffsetMin);
  return key === save.day.dayKey ? save : { ...save, day: { dayKey: key, perDog: {} } };
}

function applyEffects(save: SaveGame, dogId: DogId, fx: Effects): SaveGame {
  if (fx.affectionDelta === 0 && fx.caresses === 0) return save;
  const counters = save.day.perDog[dogId] ?? emptyCounters();
  const C = BALANCE.puppy.caress;
  const allowed = Math.max(0, Math.min(fx.caresses, C.dailyCap - counters.caresses));
  const delta = fx.affectionDelta + allowed * C.affectionGain;
  return {
    ...save,
    day: { ...save.day, perDog: { ...save.day.perDog, [dogId]: { ...counters, caresses: counters.caresses + allowed } } },
    dogs: save.dogs.map((d) => (d.id === dogId ? { ...d, affection: Math.min(100, Math.max(0, d.affection + delta)) } : d)),
  };
}

function greetAll(state: GameState, absenceMs: number): GameState {
  const minds = { ...state.minds };
  for (const dog of state.save.dogs) {
    const m = minds[dog.id];
    if (m) minds[dog.id] = startGreeting(m, absenceMs, contextOf(dog));
  }
  return { ...state, minds };
}

/** Réducteur pur : renvoie un nouvel état, ne modifie jamais celui reçu. */
export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'session/start':
    case 'session/resume': {
      const absence = action.now - state.save.lastSeenAt;
      let save = rollDay(ensureDogs(state.save), action.now, action.tzOffsetMin);
      save = {
        ...save,
        lastSeenAt: Math.max(save.lastSeenAt, action.now),
        stats: action.type === 'session/start' ? { ...save.stats, sessions: save.stats.sessions + 1 } : save.stats,
      };
      return greetAll(ensureMinds({ ...state, save }), absence);
    }
    case 'tick': {
      let save = rollDay(state.save, action.now, action.tzOffsetMin);
      save = { ...save, lastSeenAt: Math.max(save.lastSeenAt, action.now) };
      const minds = { ...state.minds };
      for (const dog of save.dogs) {
        const m = minds[dog.id];
        if (!m) continue;
        const r = tickMind(m, action.dtMs, contextOf(dog));
        minds[dog.id] = r.mind;
        save = applyEffects(save, dog.id, r.effects);
      }
      return { save, minds };
    }
    case 'gesture': {
      const id = action.dogId ?? state.save.homeDogIds[0];
      const dog = state.save.dogs.find((d) => d.id === id);
      const m = id ? state.minds[id] : undefined;
      if (!dog || !m) return state;
      const r = handleGesture(m, action.gesture, contextOf(dog));
      return { save: applyEffects(state.save, dog.id, r.effects), minds: { ...state.minds, [dog.id]: r.mind } };
    }
  }
}
