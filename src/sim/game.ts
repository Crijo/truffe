import { BALANCE } from '../data/balance';
import { adoptionPrice, dogFromCandidate, rollLitter, validateName, type Candidate } from './adoption';
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
import { isNight, tickNeeds } from './needs';
import { applyOffline } from './offline';
import { createRng } from './rng';
import { SAVE_VERSION, type BreedId, type Dog, type DogDailyCounters, type DogId, type SaveGame } from './state';
import { createToy, stepToy, throwToy, type Toy, type ToyKind } from './toys';
import { canLearnNew, newTrick, repsNeeded } from './tricks';
import type { TrickId } from '../data/tricks';
import type { VoiceTemplate } from './state';

/** État complet : la partie sauvegardée, et ce qui ne vit que pendant la session. */
export interface GameState {
  save: SaveGame;
  minds: Record<DogId, PuppyMind>;
  /** Gamelles posées au sol (F-SOIN-1). */
  bowls: BowlView[];
  nextBowlId: number;
  /** Jouets du salon (F-JEU). */
  toys: Toy[];
  nextToyId: number;
  /** Chenil ouvert (F-ADO-1) : la race choisie et ses 3 chiots. */
  kennel: { breedId: BreedId; litter: Candidate[] } | null;
  night: boolean;
}

export type GameAction =
  | { type: 'session/start'; now: number; tzOffsetMin: number }
  | { type: 'session/resume'; now: number; tzOffsetMin: number }
  | { type: 'tick'; now: number; dtMs: number; tzOffsetMin: number }
  | { type: 'gesture'; gesture: Gesture; dogId?: DogId }
  | { type: 'care/bowl'; kind: BowlKind; at: Vec2 | null }
  | { type: 'kennel/open'; breedId: BreedId }
  | { type: 'kennel/close' }
  | { type: 'adopt'; index: number; name: string; now: number; tzOffsetMin: number }
  | { type: 'rename'; dogId: DogId; name: string }
  | { type: 'toy/hold'; kind: ToyKind; at: Vec2 }
  | { type: 'toy/pick'; toyId: string }
  | { type: 'toy/move'; toyId: string; at: Vec2 }
  | { type: 'toy/throw'; toyId: string; vx: number; vz: number }
  | { type: 'toy/tug'; pullPx: number }
  | { type: 'toy/release'; toyId: string }
  | { type: 'train'; dogId?: DogId }
  | { type: 'order'; trickId: TrickId; dogId?: DogId }
  | { type: 'trick/forget'; trickId: TrickId; dogId?: DogId }
  | { type: 'trick/relabel'; trickId: TrickId; label: string; dogId?: DogId }
  | { type: 'trick/voice'; trickId: TrickId; template: VoiceTemplate; dogId?: DogId }
  | { type: 'trick/voiceClear'; trickId: TrickId; dogId?: DogId }
  | { type: 'name/voice'; template: VoiceTemplate; dogId?: DogId }
  | { type: 'voice/clearAll' }
  | { type: 'voice/miss'; dogId?: DogId }
  | { type: 'voice/similar'; dogId?: DogId }
  | { type: 'call'; dogId?: DogId }
  | { type: 'settings/mic'; allowed: boolean }
  /** Débogage et tests : le chiot fait ce geste spontané. */
  | { type: 'debug/spontaneous'; trick: TrickId };

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
  return { save, minds: {}, bowls: [], nextBowlId: 1, toys: [], nextToyId: 1, kennel: null, night: false };
}

/** Chiens à nommer : ceux des jalons 1 et 2 n'avaient pas de nom. */
export function unnamedDogs(save: SaveGame): Dog[] {
  return save.dogs.filter((d) => d.name === '');
}

const emptyCounters = (): DogDailyCounters => ({ masterPoints: 0, caresses: 0, newTricks: 0, prizeContests: 0 });
const F = BALANCE.puppy.floor;
const clamp100 = (v: number): number => Math.min(100, Math.max(0, v));

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
    toys: state.toys,
    familiar: dog.familiar,
    tricks: dog.tricks,
    canLearnNew: canLearnNew(dog, state.save.day.perDog[dog.id]?.newTricks ?? 0),
    repsNeeded: repsNeeded(dog.traits, dog.affection),
  };
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

function setToy(state: GameState, id: string, f: (t: Toy) => Toy): GameState {
  return { ...state, toys: state.toys.map((t) => (t.id === id ? f(t) : t)) };
}

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
  if (delta !== 0 || touchesNeeds || fx.familiar) {
    const max = BALANCE.toys.familiarAfter;
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
              familiar: fx.familiar ? { ...d.familiar, [fx.familiar]: Math.min(max, (d.familiar[fx.familiar] ?? 0) + 1) } : d.familiar,
            },
      ),
    };
  }
  if (fx.trained || fx.masteryUp) save = applyTraining(save, dogId, fx);
  let s: GameState = save === state.save ? state : { ...state, save };
  if (fx.bowlEaten) s = { ...s, bowls: s.bowls.filter((b) => b.id !== fx.bowlEaten) };
  if (fx.toyGrab) s = setToy(s, fx.toyGrab, (t) => ({ ...t, state: 'carried', carrier: dogId, v: { x: 0, z: 0, h: 0 } }));
  if (fx.toyTug) s = setToy(s, fx.toyTug, (t) => ({ ...t, state: 'tug', carrier: dogId }));
  if (fx.toyRelease) s = setToy(s, fx.toyRelease, (t) => ({ ...t, state: 'held', carrier: null }));
  if (fx.toyDrop) {
    const drop = fx.toyDrop;
    s = setToy(s, drop.id, (t) => ({ ...t, state: 'ground', carrier: null, pos: { ...drop.pos }, h: 0, v: { x: 0, z: 0, h: 0 } }));
  }
  return s;
}

/** Répétitions, tours appris et maîtrise (F-DRE-2, F-DRE-4). */
function applyTraining(save: SaveGame, dogId: DogId, fx: Effects): SaveGame {
  const counters = save.day.perDog[dogId] ?? emptyCounters();
  const step = BALANCE.obedience.masteryStep;
  let learnedNow = false;
  const dogs = save.dogs.map((d) => {
    if (d.id !== dogId) return d;
    let tricks = d.tricks;
    if (fx.trained) {
      const id = fx.trained;
      const cur = tricks.find((t) => t.trickId === id) ?? newTrick(id);
      const next = { ...cur, repetitions: cur.repetitions + 1, learned: cur.learned || fx.trainLearned };
      learnedNow = !cur.learned && next.learned;
      tricks = tricks.some((t) => t.trickId === id) ? tricks.map((t) => (t.trickId === id ? next : t)) : [...tricks, next];
    }
    if (fx.masteryUp) {
      const id = fx.masteryUp;
      tricks = tricks.map((t) => (t.trickId === id ? { ...t, mastery: Math.min(1, t.mastery + step) } : t));
    }
    return { ...d, tricks };
  });
  const perDog = learnedNow ? { ...save.day.perDog, [dogId]: { ...counters, newTricks: counters.newTricks + 1 } } : save.day.perDog;
  return { ...save, dogs, day: { ...save.day, perDog } };
}

function editTricks(state: GameState, dogId: DogId | undefined, f: (d: Dog) => Dog): GameState {
  const id = dogId ?? state.save.homeDogIds[0];
  return { ...state, save: { ...state.save, dogs: state.save.dogs.map((d) => (d.id === id ? f(d) : d)) } };
}

/** F-DRE : au plus 5 empreintes vocales par ordre (SPEC, Reconnaissance vocale). */
const MAX_TEMPLATES = 5;

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

function clampFloor(p: Vec2): Vec2 {
  return { x: Math.min(F.maxX, Math.max(F.minX, p.x)), z: Math.min(F.maxZ, Math.max(F.minZ, p.z)) };
}

/** Réducteur pur : renvoie un nouvel état, ne modifie jamais celui reçu. */
export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'session/start':
    case 'session/resume': {
      const absence = action.now - state.save.lastSeenAt;
      let save = offline(state.save, state.save.lastSeenAt, action.now, action.tzOffsetMin);
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
      if (s.toys.length > 0) s = { ...s, toys: s.toys.map((t) => stepToy(t, action.dtMs)) };
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
      // Un jouet porté suit la gueule de son chien.
      if (s.toys.some((t) => t.state === 'carried')) {
        s = {
          ...s,
          toys: s.toys.map((t) => {
            const m = t.state === 'carried' && t.carrier ? s.minds[t.carrier] : undefined;
            return m ? { ...t, pos: { ...m.pos }, h: 0.4 } : t;
          }),
        };
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

    // ------------------------------------------------------------ adoption (F-ADO)
    case 'kennel/open': {
      const rng = createRng(state.save.rngState);
      const litter = rollLitter(rng, action.breedId);
      return { ...state, kennel: { breedId: action.breedId, litter }, save: { ...state.save, rngState: rng.getState() } };
    }
    case 'kennel/close':
      return { ...state, kennel: null };
    case 'adopt': {
      const pick = state.kennel?.litter[action.index];
      const name = validateName(action.name);
      if (!pick || !name.ok) return state;
      const price = adoptionPrice(state.save, pick.breedId);
      if (state.save.coins < price) return state;
      const dog = dogFromCandidate(pick, name.name);
      const atHome = state.save.homeDogIds.length < 3;
      const save: SaveGame = {
        ...state.save,
        coins: state.save.coins - price,
        dogs: [...state.save.dogs, dog],
        homeDogIds: atHome ? [...state.save.homeDogIds, dog.id] : state.save.homeDogIds,
        lastSeenAt: Math.max(state.save.lastSeenAt, action.now),
      };
      return ensureMinds({ ...state, save, kennel: null });
    }
    case 'rename': {
      const name = validateName(action.name);
      if (!name.ok) return state;
      return { ...state, save: { ...state.save, dogs: state.save.dogs.map((d) => (d.id === action.dogId ? { ...d, name: name.name } : d)) } };
    }

    // ------------------------------------------------------------ jouets (F-JEU)
    case 'toy/hold': {
      const at = clampFloor(action.at);
      const existing = state.toys.find((t) => t.kind === action.kind && t.state !== 'carried' && t.state !== 'tug');
      const toy = existing ? { ...existing, state: 'held' as const, pos: at, h: 0.5, v: { x: 0, z: 0, h: 0 } } : createToy(`${action.kind}-${state.nextToyId}`, action.kind, at);
      let s: GameState = {
        ...state,
        nextToyId: existing ? state.nextToyId : state.nextToyId + 1,
        toys: existing ? state.toys.map((t) => (t.id === toy.id ? toy : t)) : [...state.toys, toy],
      };
      s = gestureAll(s, { kind: 'toyTaken', toyId: toy.id });
      if (toy.kind === 'rope') s = gestureAll(s, { kind: 'ropeOffered', toyId: toy.id });
      return s;
    }
    case 'toy/pick': {
      const toy = state.toys.find((t) => t.id === action.toyId);
      if (!toy || toy.state === 'carried' || toy.state === 'tug') return state;
      let s = setToy(state, toy.id, (t) => ({ ...t, state: 'held', h: 0.5, v: { x: 0, z: 0, h: 0 } }));
      s = gestureAll(s, { kind: 'toyTaken', toyId: toy.id });
      if (toy.kind === 'rope') s = gestureAll(s, { kind: 'ropeOffered', toyId: toy.id });
      return s;
    }
    case 'toy/move':
      return setToy(state, action.toyId, (t) => (t.state === 'held' || t.state === 'tug' ? { ...t, pos: clampFloor(action.at) } : t));
    case 'toy/throw': {
      const toy = state.toys.find((t) => t.id === action.toyId);
      if (!toy || toy.state !== 'held') return state;
      let s = setToy(state, toy.id, (t) => throwToy(t, action.vx, action.vz, state.save.lastSeenAt));
      // SPEC, Jauges : −1 d'énergie par lancer.
      const cost = BALANCE.toys.energyPerThrow;
      s = {
        ...s,
        save: {
          ...s.save,
          dogs: s.save.dogs.map((d) => (s.save.homeDogIds.includes(d.id) ? { ...d, needs: { ...d.needs, energy: clamp100(d.needs.energy - cost) } } : d)),
        },
      };
      return gestureAll(s, { kind: 'toyThrown', toyId: toy.id, toyKind: toy.kind });
    }
    case 'toy/tug':
      return gestureAll(state, { kind: 'tug', pullPx: action.pullPx });

    // ------------------------------------------------------------ dressage (F-DRE)
    case 'train':
      return gestureAll(state, { kind: 'train' }, action.dogId ?? state.save.homeDogIds[0]);
    case 'order':
      return gestureAll(state, { kind: 'order', trickId: action.trickId }, action.dogId ?? state.save.homeDogIds[0]);
    case 'voice/miss':
      return gestureAll(state, { kind: 'voiceMiss' }, action.dogId ?? state.save.homeDogIds[0]);
    case 'voice/similar':
      return gestureAll(state, { kind: 'orderSimilar' }, action.dogId ?? state.save.homeDogIds[0]);
    case 'call':
      return gestureAll(state, { kind: 'call' }, action.dogId ?? state.save.homeDogIds[0]);
    case 'settings/mic':
      return { ...state, save: { ...state.save, settings: { ...state.save.settings, micAllowed: action.allowed } } };
    case 'debug/spontaneous':
      return gestureAll(state, { kind: 'forceSpontaneous', trick: action.trick }, state.save.homeDogIds[0]);
    case 'trick/forget':
      return editTricks(state, action.dogId, (d) => ({ ...d, tricks: d.tricks.filter((t) => t.trickId !== action.trickId) }));
    case 'trick/relabel': {
      const label = action.label.trim().slice(0, 20);
      if (!label) return state;
      return editTricks(state, action.dogId, (d) => ({ ...d, tricks: d.tricks.map((t) => (t.trickId === action.trickId ? { ...t, command: { ...t.command, label } } : t)) }));
    }
    case 'trick/voice':
      return editTricks(state, action.dogId, (d) => ({
        ...d,
        tricks: d.tricks.map((t) =>
          t.trickId === action.trickId ? { ...t, command: { ...t.command, voice: [...(t.command.voice ?? []), action.template].slice(-MAX_TEMPLATES) } } : t,
        ),
      }));
    case 'trick/voiceClear':
      return editTricks(state, action.dogId, (d) => ({
        ...d,
        tricks: d.tricks.map((t) => (t.trickId === action.trickId ? { ...t, command: { label: t.command.label } } : t)),
      }));
    case 'name/voice':
      return editTricks(state, action.dogId, (d) => ({ ...d, voiceName: [...(d.voiceName ?? []), action.template].slice(-MAX_TEMPLATES) }));
    case 'voice/clearAll':
      // SPEC : les empreintes vocales peuvent être effacées.
      return {
        ...state,
        save: {
          ...state.save,
          dogs: state.save.dogs.map(({ voiceName: _v, ...d }) => ({ ...d, tricks: d.tricks.map((t) => ({ ...t, command: { label: t.command.label } })) })),
        },
      };
    case 'toy/release': {
      const toy = state.toys.find((t) => t.id === action.toyId);
      if (!toy) return state;
      if (toy.state === 'tug') return gestureAll(state, { kind: 'ropeRelease' });
      if (toy.state !== 'held') return state;
      return setToy(state, toy.id, (t) => ({ ...t, state: 'flying', v: { x: 0, z: 0, h: 0 } }));
    }
  }
}
