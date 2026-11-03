import { BALANCE } from '../data/balance';
import {
  createMind,
  handleGesture,
  startGreeting,
  tickMind,
  type BowlKind,
  type BowlView,
  type Effects,
  type Gesture,
  type PuppyContext,
  type PuppyMind,
  type Vec2,
} from './behavior';
import { dayKeyAt } from './day';
import { createStarterDog } from './dog';
import { isNight, tickNeeds } from './needs';
import { applyOffline } from './offline';
import { createRng } from './rng';
import { SAVE_VERSION, type Dog, type DogDailyCounters, type DogId, type SaveGame } from './state';

/** État complet : la partie sauvegardée, et ce qui ne vit que pendant la session. */
export interface GameState {
  save: SaveGame;
  minds: Record<DogId, PuppyMind>;
  /** Gamelles posées au sol (F-SOIN-1). */
  bowls: BowlView[];
  nextBowlId: number;
  night: boolean;
}

export type GameAction =
  | { type: 'session/start'; now: number; tzOffsetMin: number }
  | { type: 'session/resume'; now: number; tzOffsetMin: number }
  | { type: 'tick'; now: number; dtMs: number; tzOffsetMin: number }
  | { type: 'gesture'; gesture: Gesture; dogId?: DogId }
  | { type: 'care/bowl'; kind: BowlKind; at: Vec2 | null };

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
  return { save, minds: {}, bowls: [], nextBowlId: 1, night: false };
}

const emptyCounters = (): DogDailyCounters => ({ masterPoints: 0, caresses: 0, newTricks: 0, prizeContests: 0 });
const F = BALANCE.puppy.floor;

function contextOf(dog: Dog, state: GameState): PuppyContext {
  return {
    traits: dog.traits,
    affection: dog.affection,
    energy: dog.needs.energy,
    hunger: dog.needs.hunger,
    thirst: dog.needs.thirst,
    cleanliness: dog.needs.cleanliness,
    night: state.night,
    bowls: state.bowls,
  };
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
  return { ...state, save: { ...state.save, rngState: rng.getState() }, minds };
}

function rollDay(save: SaveGame, now: number, tzOffsetMin: number): SaveGame {
  if (now < save.lastSeenAt) return save;
  const key = dayKeyAt(now, tzOffsetMin);
  return key === save.day.dayKey ? save : { ...save, day: { dayKey: key, perDog: {} } };
}

const clamp100 = (v: number): number => Math.min(100, Math.max(0, v));

function applyEffects(state: GameState, dogId: DogId, fx: Effects): GameState {
  let save = state.save;
  const counters = save.day.perDog[dogId] ?? emptyCounters();
  const C = BALANCE.puppy.caress;
  const allowed = Math.max(0, Math.min(fx.caresses, C.dailyCap - counters.caresses));
  const delta = fx.affectionDelta + allowed * C.affectionGain;
  if (allowed > 0) {
    save = { ...save, day: { ...save.day, perDog: { ...save.day.perDog, [dogId]: { ...counters, caresses: counters.caresses + allowed } } } };
  }
  const touchesNeeds = fx.hungerDelta || fx.thirstDelta || fx.cleanDelta || fx.cleanSet !== null;
  if (delta !== 0 || touchesNeeds) {
    save = {
      ...save,
      dogs: save.dogs.map((d) =>
        d.id !== dogId
          ? d
          : {
              ...d,
              affection: clamp100(d.affection + delta),
              needs: {
                ...d.needs,
                hunger: clamp100(d.needs.hunger + fx.hungerDelta),
                thirst: clamp100(d.needs.thirst + fx.thirstDelta),
                cleanliness: clamp100((fx.cleanSet ?? d.needs.cleanliness) + fx.cleanDelta),
              },
            },
      ),
    };
  }
  const bowls = fx.bowlEaten ? state.bowls.filter((b) => b.id !== fx.bowlEaten) : state.bowls;
  return save === state.save && bowls === state.bowls ? state : { ...state, save, bowls };
}

/** Temps écoulé hors du jeu, appliqué à chaque chien. */
function offline(save: SaveGame, from: number, to: number, tzOffsetMin: number): SaveGame {
  if (!(to > from)) return save;
  return { ...save, dogs: save.dogs.map((d) => applyOffline(d, from, to, tzOffsetMin)) };
}

function greetAll(state: GameState, absenceMs: number): GameState {
  const minds = { ...state.minds };
  for (const dog of state.save.dogs) {
    const m = minds[dog.id];
    if (m) minds[dog.id] = startGreeting(m, absenceMs, contextOf(dog, state));
  }
  return { ...state, minds };
}

function gestureAll(state: GameState, gesture: Gesture, only?: DogId): GameState {
  let s = state;
  for (const dog of state.save.dogs) {
    if (only && dog.id !== only) continue;
    const m = s.minds[dog.id];
    if (!m) continue;
    const r = handleGesture(m, gesture, contextOf(dog, s));
    s = applyEffects({ ...s, minds: { ...s.minds, [dog.id]: r.mind } }, dog.id, r.effects);
  }
  return s;
}

/** Réducteur pur : renvoie un nouvel état, ne modifie jamais celui reçu. */
export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'session/start':
    case 'session/resume': {
      const absence = action.now - state.save.lastSeenAt;
      let save = offline(ensureDogs(state.save), state.save.lastSeenAt, action.now, action.tzOffsetMin);
      save = rollDay(save, action.now, action.tzOffsetMin);
      save = {
        ...save,
        lastSeenAt: Math.max(save.lastSeenAt, action.now),
        stats: action.type === 'session/start' ? { ...save.stats, sessions: save.stats.sessions + 1 } : save.stats,
      };
      const night = action.now >= state.save.lastSeenAt ? isNight(action.now, action.tzOffsetMin) : state.night;
      return greetAll(ensureMinds({ ...state, save, night }), absence);
    }
    case 'tick': {
      // Une horloge qui recule ne fait passer aucun temps sur les besoins ;
      // le chiot vit quand même et ce qu'il mange compte.
      const backwards = action.now < state.save.lastSeenAt;
      let s: GameState = state;
      if (!backwards) {
        // Appareil en veille : l'écart d'horloge compte comme une absence.
        const gap = action.now - action.dtMs - state.save.lastSeenAt;
        let save = gap > BALANCE.needs.gapAsOfflineMs ? offline(state.save, state.save.lastSeenAt, action.now - action.dtMs, action.tzOffsetMin) : state.save;
        save = rollDay(save, action.now, action.tzOffsetMin);
        s = { ...state, save: { ...save, lastSeenAt: action.now }, night: isNight(action.now, action.tzOffsetMin) };
      }
      for (const dog of s.save.dogs) {
        const m = s.minds[dog.id];
        if (!m) continue;
        const asleep = m.activity === 'sleep';
        const needs = backwards ? dog.needs : tickNeeds(dog.needs, action.dtMs, asleep);
        const updated = { ...dog, needs };
        s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => (d.id === dog.id ? updated : d)) } };
        const r = tickMind(m, action.dtMs, contextOf(updated, s));
        s = applyEffects({ ...s, minds: { ...s.minds, [dog.id]: r.mind } }, dog.id, r.effects);
      }
      return s;
    }
    case 'gesture':
      return gestureAll(state, action.gesture, action.dogId ?? state.save.homeDogIds[0]);
    case 'care/bowl': {
      const pos = action.at
        ? { x: Math.min(F.maxX, Math.max(F.minX, action.at.x)), z: Math.min(F.maxZ, Math.max(F.minZ + 0.15, action.at.z)) }
        : { x: 0.35, z: 0.75 };
      const bowl: BowlView = { id: `${action.kind}-${state.nextBowlId}`, kind: action.kind, pos };
      const s = { ...state, nextBowlId: state.nextBowlId + 1, bowls: [...state.bowls.filter((b) => b.kind !== action.kind), bowl] };
      return gestureAll(s, { kind: 'bowl' });
    }
  }
}
