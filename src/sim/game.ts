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
  type Friend,
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
import { awardPoints, buy, gain, lose, marketStock, sell, shopCatalog, toggleEquip } from './economy';
import { finishWalk, pickUp, questionPoints, rewardable, startWalk, stepWalk, walkGains, type QuestionPoint, type Route, type WalkState } from './walk';
import { ITEM_BY_ID, type ItemId } from '../data/items';
import type { TrickId } from '../data/tricks';
import type { ContestId, VoiceTemplate } from './state';
import { availableBreeds, availableDecors, grantUnlocks, itemLocked } from './unlocks';
import type { DecorId } from './state';
import { canEnter, prizeLeft, settleContest, type ContestResult } from './contests';
import { startDisc, stepDisc, throwDisc, type DiscRun } from './contest/disc';
import { aimAgility, startAgility, stepAgility, type AgilityRun } from './contest/agility';
import { orderObedience, startObedience, stepObedience, type ObedienceRun } from './contest/obedience';

/** Concours en cours (F-CON), puis son bilan. */
export interface ContestSession {
  contestId: ContestId;
  dogId: DogId;
  contestClass: Dog['contestClass'][ContestId];
  /** F-CON-6 : faux au-delà de 3 concours dans la journée. */
  prize: boolean;
  seed: number;
  run: DiscRun | AgilityRun | ObedienceRun;
  result: ContestResult | null;
}

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
  /** Promenade en cours (F-PRO), ou son bilan. */
  walk: WalkState | null;
  contest: ContestSession | null;
  /** Le chiot que le joueur a touché en dernier, parmi ceux de la maison. */
  active: DogId | null;
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
  | { type: 'toy/hold'; kind: ToyKind; at: Vec2; itemId?: ItemId | undefined }
  | { type: 'toy/pick'; toyId: string }
  | { type: 'toy/move'; toyId: string; at: Vec2 }
  | { type: 'toy/throw'; toyId: string; vx: number; vz: number }
  | { type: 'toy/tug'; pullPx: number }
  | { type: 'toy/release'; toyId: string }
  /** D-71 : ranger un jouet (tenu ou au sol), ou tous ceux qui traînent. */
  | { type: 'toy/putAway'; toyId: string }
  | { type: 'toy/putAwayAll' }
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
  | { type: 'settings/set'; patch: Partial<Pick<SaveGame['settings'], 'reduceMotion' | 'musicVolume' | 'sfxVolume' | 'brightness'>> }
  | { type: 'walk/start'; route: Route; now: number; questions?: QuestionPoint[] }
  | { type: 'walk/leash'; lane: number | null }
  | { type: 'walk/pickup' }
  | { type: 'walk/continue' }
  | { type: 'walk/enter' }
  | { type: 'walk/finish' }
  | { type: 'walk/close' }
  | { type: 'contest/enter'; contestId: ContestId; dogId?: DogId }
  /** Disque : geste du doigt, en pixels par milliseconde, vers le haut positif. */
  | { type: 'contest/throw'; fx: number; fy: number }
  /** Agilité : le doigt sur le terrain, en mètres (null : levé). */
  | { type: 'contest/aim'; at: { x: number; y: number } | null }
  | { type: 'contest/order'; trickId: TrickId }
  | { type: 'contest/quit' }
  | { type: 'contest/close' }
  /** F-VIE-4 : chiot actif, maison et pension, décor. */
  | { type: 'family/select'; dogId: DogId }
  | { type: 'family/move'; dogId: DogId; to: 'home' | 'hotel' }
  | { type: 'settings/decor'; decor: DecorId }
  | { type: 'poop/pickup'; poopId: string }
  | { type: 'shop/buy'; itemId: ItemId }
  | { type: 'market/buy'; itemId: ItemId }
  | { type: 'market/sell'; itemId: ItemId }
  | { type: 'equip'; itemId: ItemId; dogId?: DogId }
  | { type: 'use'; itemId: ItemId; at?: Vec2 | null; dogId?: DogId }
  /** Débogage et tests : points de maître. */
  | { type: 'debug/points'; points: number }
  /** Débogage et tests : le chiot fait ce geste spontané. */
  | { type: 'debug/spontaneous'; trick: TrickId };

export function createNewGame(now: number, seed: number): SaveGame {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeenAt: now,
    coins: BALANCE.economy.welcomeCoins,
    masterPoints: 0,
    unlockTier: 0,
    inventory: {},
    discovered: { items: [], tricks: [] },
    dogs: [],
    homeDogIds: [],
    day: { dayKey: '', perDog: {} },
    settings: { reduceMotion: false, musicVolume: 0.6, sfxVolume: 0.8, micAllowed: null, decor: 'home', brightness: BALANCE.display.defaultBrightness },
    rngState: seed >>> 0,
    stats: { sessions: 0 },
    poops: [],
  };
}

export function createGameState(save: SaveGame): GameState {
  return { save, minds: {}, bowls: [], nextBowlId: 1, toys: [], nextToyId: 1, kennel: null, walk: null, contest: null, active: null, night: false };
}

/** Chiens à nommer : ceux des jalons 1 et 2 n'avaient pas de nom. */
export function unnamedDogs(save: SaveGame): Dog[] {
  return save.dogs.filter((d) => d.name === '');
}

const emptyCounters = (): DogDailyCounters => ({ masterPoints: 0, caresses: 0, newTricks: 0, prizeContests: 0 });
const F = BALANCE.puppy.floor;
const P_HOME_Z = BALANCE.puppy.floor.home.z;
const clamp100 = (v: number): number => Math.min(100, Math.max(0, v));

/** Le chiot visé par défaut : le chiot actif s'il est à la maison, sinon le premier. */
export function homeId(state: GameState): DogId | undefined {
  const a = state.active;
  return a && state.save.homeDogIds.includes(a) ? a : state.save.homeDogIds[0];
}

/** F-VIE-4 : ce que chaque chiot voit des autres chiots de la maison. */
function friendsOf(dog: Dog, state: GameState): Friend[] {
  const out: Friend[] = [];
  for (const id of state.save.homeDogIds) {
    const m = state.minds[id];
    if (id === dog.id || !m) continue;
    out.push({ id, pos: m.pos, activity: m.activity, partner: m.play?.partner ?? null });
  }
  return out;
}

function contextOf(dog: Dog, state: GameState): PuppyContext {
  return {
    selfId: dog.id,
    friends: friendsOf(dog, state),
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
  // F-VIE-4 : chaque nouveau chiot arrive à sa place, pas sur les autres.
  const spots = BALANCE.family.spawnX;
  for (const id of missing) {
    const i = Object.keys(minds).length;
    minds[id] = createMind(Math.floor(rng.next() * 2 ** 32), { x: spots[i % spots.length] ?? 0, z: P_HOME_Z });
  }
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
  const before = save.dogs.find((d) => d.id === dogId);
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
  if (before) save = awardPoints(save, dogId, careGains(before, save.dogs.find((d) => d.id === dogId) ?? before, fx));
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

/** F-ECO-2 : points des soins, si le besoin était réel (D-08), et des tours réussis. */
function careGains(before: Dog, after: Dog, fx: Effects): number {
  const G = BALANCE.gains;
  const need = BALANCE.needs.realNeed;
  let pts = 0;
  if (fx.bowlEaten) {
    if (fx.hungerDelta > 0 && before.needs.hunger < need.hunger) pts += G.meal;
    if (fx.thirstDelta > 0 && before.needs.thirst < need.thirst) pts += G.meal;
  }
  // Bain terminé, ou brossage qui rend le pelage « Superbe ».
  const groomed = fx.cleanSet !== null || (fx.cleanDelta > 0 && after.needs.cleanliness >= need.cleanliness);
  if (groomed && before.needs.cleanliness < need.cleanliness) pts += G.groom;
  if (fx.masteryUp) pts += G.trickRepeat;
  return pts;
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
  const next = { ...save, dogs, day: { ...save.day, perDog } };
  return learnedNow ? awardPoints(next, dogId, BALANCE.gains.newTrick) : next;
}

function editTricks(state: GameState, dogId: DogId | undefined, f: (d: Dog) => Dog): GameState {
  const id = dogId ?? homeId(state);
  return { ...state, save: { ...state.save, dogs: state.save.dogs.map((d) => (d.id === id ? f(d) : d)) } };
}

/** F-DRE : au plus 5 empreintes vocales par ordre (SPEC, Reconnaissance vocale). */
const MAX_TEMPLATES = 5;

/** Graine de la prochaine promenade : les « ? » du plan et les événements en dépendent. */
export function walkSeed(save: SaveGame): number {
  return save.rngState >>> 0;
}

/** F-PRO-4 : les points « ? » affichés sur le plan avant de partir. */
export function currentQuestions(save: SaveGame): QuestionPoint[] {
  return questionPoints(walkSeed(save));
}

const firstDog = (state: GameState, dogId?: DogId): Dog | undefined => state.save.dogs.find((d) => d.id === (dogId ?? homeId(state)));

/** Fin de promenade : propreté et énergie si elle est allée au bout ; gains si elle était éligible (F-PRO-7). */
function settleWalk(state: GameState, w: WalkState): GameState {
  const dog = firstDog(state);
  if (!dog) return { ...state, walk: w };
  const now = state.save.lastSeenAt;
  const done = w.progress >= w.plan.lengthM;
  const g = walkGains(w.plan.lengthM);
  let save: SaveGame = {
    ...state.save,
    dogs: state.save.dogs.map((d) => {
      if (d.id !== dog.id) return d;
      const needs = done ? { ...d.needs, cleanliness: clamp100(d.needs.cleanliness + BALANCE.walk.cleanliness), energy: clamp100(d.needs.energy + BALANCE.walk.energy) } : d.needs;
      if (done) d = { ...d, lastReliefAt: now };
      if (!w.rewarded) return { ...d, needs };
      return { ...d, needs, stamina: d.stamina + g.stamina, affection: clamp100(d.affection + g.affection), walks: { lastRewardedAt: now, count: d.walks.count + 1 } };
    }),
  };
  if (w.rewarded) save = awardPoints(save, dog.id, g.points + w.pointsDelta);
  return { ...state, save, walk: w };
}

function stepRun(run: ContestSession['run'], dtMs: number): ContestSession['run'] {
  switch (run.kind) {
    case 'disc':
      return stepDisc(run, dtMs);
    case 'agility':
      return stepAgility(run, dtMs);
    case 'obedience':
      return stepObedience(run, dtMs);
  }
}

/** Un pas de concours ; à la fin, le classement et les gains. */
function stepContest(state: GameState, dtMs: number): GameState {
  const c = state.contest;
  if (!c || c.result) return state;
  const run = stepRun(c.run, dtMs);
  if (!run.finished) return { ...state, contest: { ...c, run } };
  const score = Math.round(run.score * 10) / 10;
  const r = settleContest(state.save, c.dogId, c.contestId, score, c.seed, state.save.lastSeenAt, c.prize);
  return { ...state, save: r.save, contest: { ...c, run, result: r.result } };
}

/** D-60 : à la pension, on nourrit, abreuve et brosse les chiots. */
function boarded(d: Dog): Dog {
  const k = BALANCE.family.hotelCare;
  return { ...d, needs: { hunger: Math.max(d.needs.hunger, k), thirst: Math.max(d.needs.thirst, k), cleanliness: Math.max(d.needs.cleanliness, k), energy: 100 } };
}

/**
 * D-74 : chaque chiot de la maison fait ses besoins s'il n'est pas sorti depuis le délai ;
 * un besoin oublié trop longtemps coûte des points, une seule fois.
 */
function homeRelief(state: GameState, now: number): GameState {
  const P = BALANCE.home.poop;
  if (state.walk || state.contest) return state;
  let s = state;
  for (const id of s.save.homeDogIds) {
    const dog = s.save.dogs.find((d) => d.id === id);
    const mind = s.minds[id];
    if (!dog || now - dog.lastReliefAt < P.intervalMs || mind?.activity === 'sleep') continue;
    if (s.save.poops.length >= P.max) {
      s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => (d.id === id ? { ...d, lastReliefAt: now } : d)) } };
      continue;
    }
    const rng = createRng(s.save.rngState);
    const base = mind?.pos ?? { x: rng.range(F.minX, F.maxX), z: rng.range(F.minZ + 0.2, F.maxZ - 0.1) };
    // À côté du chiot, un peu devant : il ne le cache pas.
    const side = rng.next() < 0.5 ? -1 : 1;
    const pos = clampFloor({ x: base.x + side * rng.range(0.5, 0.6), z: base.z + rng.range(0, 0.05) });
    const poop = { id: `poop-${now.toString(36)}-${id}`, dogId: id, pos, at: now, forgotten: false };
    s = {
      ...s,
      save: { ...s.save, rngState: rng.getState(), poops: [...s.save.poops, poop], dogs: s.save.dogs.map((d) => (d.id === id ? { ...d, lastReliefAt: now } : d)) },
    };
    if (mind) s = gestureAll(s, { kind: 'relieved' }, id);
  }
  const late = s.save.poops.filter((p) => !p.forgotten && now - p.at >= P.forgetMs);
  if (late.length > 0) {
    let save: SaveGame = { ...s.save, poops: s.save.poops.map((p) => (late.includes(p) ? { ...p, forgotten: true } : p)) };
    for (const p of late) save = awardPoints(save, p.dogId, P.forgetPoints);
    s = { ...s, save };
  }
  return s;
}

/** Temps écoulé hors du jeu, appliqué à chaque chien. */
function offline(save: SaveGame, from: number, to: number, tzOffsetMin: number): SaveGame {
  if (!(to > from)) return save;
  return { ...save, dogs: save.dogs.map((d) => (save.homeDogIds.includes(d.id) ? applyOffline(d, from, to, tzOffsetMin) : boarded(applyOffline(d, from, to, tzOffsetMin)))) };
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
  const next = reduceAction(state, action);
  const save = grantUnlocks(next.save);
  return save === next.save ? next : { ...next, save };
}

function reduceAction(state: GameState, action: GameAction): GameState {
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
      return homeRelief(greetAll(ensureMinds({ ...state, save, night }), absence), save.lastSeenAt);
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
      if (s.contest && !s.contest.result) s = stepContest(s, action.dtMs);
      if (s.walk && !s.walk.finished) {
        const r = stepWalk(s.walk, action.dtMs, firstDog(s)?.traits.docility ?? 0.5);
        let save = s.save;
        for (const id of r.picked) save = gain(save, id);
        s = { ...s, save, walk: r.walk };
        if (r.walk.finished) s = settleWalk(s, r.walk);
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
      if (!backwards) s = homeRelief(s, s.save.lastSeenAt);
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
      return gestureAll(state, action.gesture, action.dogId ?? homeId(state));
    case 'care/bowl': {
      const CA = BALANCE.care;
      let pos = action.at
        ? { x: Math.min(F.maxX, Math.max(F.minX, action.at.x)), z: Math.min(F.maxZ, Math.max(F.minZ + 0.15, action.at.z)) }
        : { ...CA.bowlSpots[action.kind] };
      // Les deux gamelles tiennent côte à côte : posée sur l'autre, la nouvelle se décale.
      const other = state.bowls.find((b) => b.kind !== action.kind);
      if (other && Math.hypot(pos.x - other.pos.x, pos.z - other.pos.z) < CA.bowlGap) {
        const side = other.pos.x + CA.bowlGap <= F.maxX ? 1 : -1;
        pos = { x: other.pos.x + side * CA.bowlGap, z: other.pos.z };
      }
      const bowl: BowlView = { id: `${action.kind}-${state.nextBowlId}`, kind: action.kind, pos };
      const s = { ...state, nextBowlId: state.nextBowlId + 1, bowls: [...state.bowls.filter((b) => b.kind !== action.kind), bowl] };
      return gestureAll(s, { kind: 'bowl' });
    }

    // ------------------------------------------------------------ adoption (F-ADO)
    case 'kennel/open': {
      if (!availableBreeds(state.save.masterPoints).includes(action.breedId)) return state;
      const rng = createRng(state.save.rngState);
      const litter = rollLitter(rng, action.breedId);
      return { ...state, kennel: { breedId: action.breedId, litter }, save: { ...state.save, rngState: rng.getState() } };
    }
    case 'kennel/close':
      return { ...state, kennel: null };
    case 'adopt': {
      const pick = state.kennel?.litter[action.index];
      const name = validateName(action.name);
      if (!pick || !name.ok || state.save.dogs.length >= BALANCE.family.maxDogs) return state;
      const price = adoptionPrice(state.save, pick.breedId);
      if (state.save.coins < price) return state;
      const dog = { ...dogFromCandidate(pick, name.name), lastReliefAt: Math.max(state.save.lastSeenAt, action.now) };
      const atHome = state.save.homeDogIds.length < BALANCE.family.maxHome;
      const save: SaveGame = {
        ...state.save,
        coins: state.save.coins - price,
        dogs: [...state.save.dogs, dog],
        homeDogIds: atHome ? [...state.save.homeDogIds, dog.id] : state.save.homeDogIds,
        lastSeenAt: Math.max(state.save.lastSeenAt, action.now),
      };
      return ensureMinds({ ...state, save, kennel: null, active: atHome ? dog.id : state.active });
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
      const fresh = createToy(`${action.kind}-${state.nextToyId}`, action.kind, at);
      const toy = existing ? { ...existing, state: 'held' as const, pos: at, h: 0.5, v: { x: 0, z: 0, h: 0 }, itemId: action.itemId } : { ...fresh, itemId: action.itemId };
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
    case 'toy/putAway':
    case 'toy/putAwayAll': {
      const away = (t: Toy): boolean => (action.type === 'toy/putAwayAll' || t.id === action.toyId) && (t.state === 'held' || t.state === 'ground');
      return state.toys.some(away) ? { ...state, toys: state.toys.filter((t) => !away(t)) } : state;
    }
    case 'toy/tug':
      return gestureAll(state, { kind: 'tug', pullPx: action.pullPx });

    // ------------------------------------------------------------ dressage (F-DRE)
    case 'train':
      return gestureAll(state, { kind: 'train' }, action.dogId ?? homeId(state));
    case 'order':
      return gestureAll(state, { kind: 'order', trickId: action.trickId }, action.dogId ?? homeId(state));
    case 'voice/miss':
      return gestureAll(state, { kind: 'voiceMiss' }, action.dogId ?? homeId(state));
    case 'voice/similar':
      return gestureAll(state, { kind: 'orderSimilar' }, action.dogId ?? homeId(state));
    case 'call':
      return gestureAll(state, { kind: 'call' }, action.dogId ?? homeId(state));
    case 'settings/set': {
      const p = action.patch;
      const vol = (v: number | undefined, cur: number): number => (v === undefined ? cur : Math.min(1, Math.max(0, v)));
      const cur = state.save.settings;
      const settings = { ...cur, reduceMotion: p.reduceMotion ?? cur.reduceMotion, musicVolume: vol(p.musicVolume, cur.musicVolume), sfxVolume: vol(p.sfxVolume, cur.sfxVolume), brightness: vol(p.brightness, cur.brightness) };
      return { ...state, save: { ...state.save, settings } };
    }
    case 'settings/mic':
      return { ...state, save: { ...state.save, settings: { ...state.save.settings, micAllowed: action.allowed } } };
    // ------------------------------------------------------------ promenade (F-PRO)
    case 'walk/start': {
      const dog = firstDog(state);
      if (!dog || action.route.length < 2) return state;
      const seed = walkSeed(state.save);
      const questions = action.questions ?? questionPoints(seed);
      const walk = startWalk(action.route, seed, questions, rewardable(dog.walks.lastRewardedAt, action.now));
      // La graine avance : la prochaine promenade sera différente.
      const rng = createRng(state.save.rngState);
      rng.next();
      return { ...state, walk, save: { ...state.save, rngState: rng.getState() } };
    }
    case 'walk/leash':
      return state.walk && !state.walk.finished ? { ...state, walk: { ...state.walk, laneTarget: action.lane === null ? null : Math.min(1, Math.max(0, action.lane)) } } : state;
    case 'walk/pickup':
      return state.walk ? { ...state, walk: pickUp(state.walk) } : state;
    case 'walk/continue':
      return state.walk?.pause?.kind === 'place' ? { ...state, walk: { ...state.walk, pause: null } } : state;
    case 'walk/enter': {
      const w = state.walk;
      const ev = w?.pause?.kind === 'place' ? w.plan.events[w.pause.index] : undefined;
      const place = ev?.place;
      if (!place || place === 'home') return state;
      return editTricks(state, undefined, (d) => ({ ...d, visited: { ...d.visited, [place]: true } }));
    }
    case 'walk/finish':
      return state.walk && !state.walk.finished ? settleWalk(state, finishWalk(state.walk, false)) : state;
    case 'walk/close':
      return { ...state, walk: null };

    // ------------------------------------------------------------ concours (F-CON)
    case 'contest/enter': {
      const dog = firstDog(state, action.dogId);
      if (!dog || state.contest || !canEnter(dog, action.contestId).ok) return state;
      const rng = createRng(state.save.rngState);
      const seed = Math.floor(rng.next() * 2 ** 31);
      const cls = dog.contestClass[action.contestId];
      const run =
        action.contestId === 'disc'
          ? startDisc(dog.traits, dog.needs.energy)
          : action.contestId === 'agility'
            ? startAgility(dog.traits, dog.needs.energy)
            : startObedience(dog, cls, seed);
      const contest: ContestSession = { contestId: action.contestId, dogId: dog.id, contestClass: cls, prize: prizeLeft(state.save, dog.id) > 0, seed, run, result: null };
      return { ...state, contest, save: { ...state.save, rngState: rng.getState() } };
    }
    case 'contest/throw': {
      const c = state.contest;
      return c && !c.result && c.run.kind === 'disc' ? { ...state, contest: { ...c, run: throwDisc(c.run, action.fx, action.fy) } } : state;
    }
    case 'contest/aim': {
      const c = state.contest;
      return c && !c.result && c.run.kind === 'agility' ? { ...state, contest: { ...c, run: aimAgility(c.run, action.at) } } : state;
    }
    case 'contest/order': {
      const c = state.contest;
      return c && !c.result && c.run.kind === 'obedience' ? { ...state, contest: { ...c, run: orderObedience(c.run, action.trickId) } } : state;
    }
    case 'contest/quit':
      return state.contest && !state.contest.result ? { ...state, contest: null } : state;
    case 'contest/close':
      return { ...state, contest: null };

    // ------------------------------------------------------------ plusieurs chiots (F-VIE-4)
    case 'family/select':
      return state.save.homeDogIds.includes(action.dogId) ? { ...state, active: action.dogId } : state;
    case 'family/move': {
      const home = state.save.homeDogIds;
      const isHome = home.includes(action.dogId);
      if (!state.save.dogs.some((d) => d.id === action.dogId) || state.walk || state.contest) return state;
      if (action.to === 'home') {
        if (isHome || home.length >= BALANCE.family.maxHome) return state;
        return ensureMinds({ ...state, save: { ...state.save, homeDogIds: [...home, action.dogId] } });
      }
      const hotel = state.save.dogs.length - home.length;
      if (!isHome || home.length <= 1 || hotel >= BALANCE.family.maxHotel) return state;
      const minds = Object.fromEntries(Object.entries(state.minds).filter(([id]) => id !== action.dogId));
      // Ce qu'il tenait reste au salon.
      const toys = state.toys.map((t) => (t.carrier === action.dogId ? { ...t, state: 'ground' as const, carrier: null, h: 0 } : t));
      return { ...state, minds, toys, active: state.active === action.dogId ? null : state.active, save: { ...state.save, homeDogIds: home.filter((id) => id !== action.dogId) } };
    }
    case 'poop/pickup': {
      const p = state.save.poops.find((x) => x.id === action.poopId);
      if (!p) return state;
      const save = { ...state.save, poops: state.save.poops.filter((x) => x.id !== p.id) };
      return { ...state, save: p.forgotten ? save : awardPoints(save, p.dogId, BALANCE.home.poop.pickupPoints) };
    }
    case 'settings/decor':
      return availableDecors(state.save.masterPoints).includes(action.decor) ? { ...state, save: { ...state.save, settings: { ...state.save.settings, decor: action.decor } } } : state;

    // ------------------------------------------------------------ objets (F-ECO-3)
    case 'shop/buy': {
      const def = shopCatalog().find((i) => i.id === action.itemId && !itemLocked(i.id, state.save.masterPoints));
      return def?.price ? { ...state, save: buy(state.save, def.id, def.price) } : state;
    }
    case 'market/buy': {
      const offer = marketStock(state.save.day.dayKey).find((o) => o.itemId === action.itemId);
      return offer ? { ...state, save: buy(state.save, offer.itemId, offer.price) } : state;
    }
    case 'market/sell':
      return { ...state, save: sell(state.save, action.itemId) };
    case 'equip': {
      const dog = firstDog(state, action.dogId);
      return dog ? { ...state, save: toggleEquip(state.save, dog.id, action.itemId) } : state;
    }
    case 'use': {
      const def = ITEM_BY_ID[action.itemId];
      const dog = firstDog(state, action.dogId);
      const after = def && dog ? lose(state.save, def.id) : null;
      if (!def || !dog || !after) return state;
      let s: GameState = { ...state, save: after };
      const f = def.food;
      const setDog = (st: GameState, g: (d: Dog) => Dog): GameState => ({ ...st, save: { ...st.save, dogs: st.save.dogs.map((d) => (d.id === dog.id ? g(d) : d)) } });
      if (f?.treat) {
        s = setDog(s, (d) => ({ ...d, needs: { ...d.needs, hunger: clamp100(d.needs.hunger + (f.hunger ?? 0)) } }));
        return gestureAll(s, { kind: 'treat' }, dog.id);
      }
      if (f?.hunger || f?.thirst) {
        const kind = f.hunger ? 'food' : 'water';
        s = reduce(s, { type: 'care/bowl', kind, at: action.at ?? null });
        return { ...s, bowls: s.bowls.map((b) => (b.kind === kind ? { ...b, meal: f.hunger ?? f.thirst } : b)) };
      }
      if (def.id === 'shampooing-doux' || def.id === 'eau-lavande') {
        const plus = def.id === 'eau-lavande' ? 10 : 20;
        return setDog(s, (d) => ({ ...d, needs: { ...d.needs, cleanliness: clamp100(d.needs.cleanliness + plus) } }));
      }
      return state;
    }
    case 'debug/points': {
      const dog = firstDog(state);
      return dog ? { ...state, save: awardPoints(state.save, dog.id, action.points) } : state;
    }
    case 'debug/spontaneous':
      return gestureAll(state, { kind: 'forceSpontaneous', trick: action.trick }, homeId(state));
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
