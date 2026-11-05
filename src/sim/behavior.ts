/**
 * Esprit du chiot : activité choisie par score toutes les 500 ms, réactions
 * immédiates aux gestes (F-MAIN), soins (F-SOIN), sommeil (F-VIE-1) et accueil (F-VIE-2).
 * Pur : le temps avance par `tickMind`, le hasard vient de `rngState`.
 */
import { BALANCE } from '../data/balance';
import { SPONTANEOUS_TRICK, TRICKS, type Posture as TrickPosture, type TrickId } from '../data/tricks';
import { obedienceMalus, obeyProbability } from './obedience';
import { comboFor } from './tricks';
import { isUrgent } from './needs';
import { createRng, type Rng } from './rng';
import type { ToyKind, ToyState } from './toys';

const P = BALANCE.puppy;
const N = BALANCE.needs;
const S = BALANCE.sleep;
const C = BALANCE.care;
const TY = BALANCE.toys;
const TR = BALANCE.training;
const FAM = BALANCE.family;

export type Posture = TrickPosture;
export type Activity =
  | 'wander'
  | 'come'
  | 'petted'
  | 'sniffHand'
  | 'attend'
  | 'sulk'
  | 'spontaneous'
  | 'greet'
  | 'eat'
  | 'sleep'
  | 'groom'
  | 'fetch'
  | 'chew'
  | 'tug'
  | 'fear'
  | 'perform'
  /** F-VIE-4 : jouer avec un autre chiot de la maison. */
  | 'play';
export type Mood = 'calm' | 'happy' | 'content' | 'curious' | 'sulky' | 'startled' | 'asleep';
export type BodyPart = 'head' | 'ear' | 'muzzle' | 'back' | 'flank' | 'belly' | 'tail' | 'paw';
export type Gait = 'still' | 'walk' | 'trot' | 'run';
export type CareTool = 'soap' | 'shower' | 'dryer' | 'brush';
/** D-88 : étapes du bain, dans l'ordre. */
export type BathStage = 'wet' | 'soap' | 'rinse' | 'dry' | 'done';
export type BowlKind = 'food' | 'water';
export type PuppyEventType =
  | 'bark'
  | 'yip'
  | 'whine'
  | 'yelp'
  | 'sniff'
  | 'lick'
  | 'yawn'
  | 'shake'
  | 'scratch'
  | 'dig'
  | 'howl'
  | 'sniffGround'
  | 'jump'
  | 'spin'
  | 'playBow'
  | 'startle'
  | 'perk'
  | 'backOff'
  | 'flop'
  | 'wiggle'
  | 'sit'
  | 'chew'
  | 'lap'
  | 'lickLips'
  | 'stretch'
  | 'snore'
  | 'bulb'
  | 'progress'
  | 'learned'
  | 'confused'
  | 'similar'
  | 'lookAway'
  | 'givePaw'
  | 'beg'
  | 'roll'
  | 'flip'
  | 'handstand'
  | 'playdead'
  | 'dance'
  | 'treat'
  | 'nibble'
  /** Halètement, après avoir couru. */
  | 'pant'
  /** D-88 : une étape du bain vient d'être finie. */
  | 'bathStep';

export interface PuppyEvent {
  seq: number;
  type: PuppyEventType;
  t: number;
  spontaneous?: true;
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface ToyView {
  id: string;
  kind: ToyKind;
  state: ToyState;
  pos: Vec2;
  h: number;
  carrier: string | null;
}

export interface BowlView {
  id: string;
  kind: BowlKind;
  pos: Vec2;
  /** Ce que la gamelle apporte (pâtée, lait) ; sinon le repas ordinaire. */
  meal?: number | undefined;
}

export type LookTarget =
  | { kind: 'player' }
  | { kind: 'point'; x: number; z: number }
  | { kind: 'up' }
  | { kind: 'ground' }
  | { kind: 'away' }
  | { kind: 'hand' };

export type Gesture =
  | { kind: 'stroke'; part: BodyPart; distancePx: number }
  | { kind: 'present' }
  | { kind: 'presentEnd' }
  | { kind: 'tap'; at: Vec2 | null }
  | { kind: 'pull'; part: 'tail' | 'ear' }
  | { kind: 'raise'; fast?: boolean }
  | { kind: 'raiseEnd' }
  | { kind: 'push'; part: BodyPart }
  | { kind: 'touch'; part: BodyPart }
  | { kind: 'groomStart' }
  | { kind: 'groomEnd' }
  | { kind: 'scrub'; tool: CareTool; distancePx: number }
  | { kind: 'bowl' }
  | { kind: 'toyThrown'; toyId: string; toyKind: ToyKind }
  | { kind: 'ropeOffered'; toyId: string }
  | { kind: 'tug'; pullPx: number }
  | { kind: 'ropeRelease' }
  | { kind: 'toyTaken'; toyId: string }
  | { kind: 'press'; part: BodyPart }
  | { kind: 'circle' }
  | { kind: 'train' }
  | { kind: 'order'; trickId: TrickId }
  | { kind: 'orderSimilar' }
  | { kind: 'voiceMiss' }
  | { kind: 'treat' }
  | { kind: 'call' }
  | { kind: 'forceSpontaneous'; trick: TrickId }
  /** D-74 : il fait ses besoins (renifle d'abord le sol). */
  | { kind: 'relieved' }
  /** D-80 : l'atelier montre un mouvement (sans dressage). */
  | { kind: 'perform'; trick: TrickId };

export interface PuppyContext {
  traits: { docility: number; energy: number; boldness: number };
  affection: number;
  energy: number;
  hunger: number;
  thirst: number;
  cleanliness: number;
  /** D-82 : amusement. */
  fun: number;
  night: boolean;
  bowls: readonly BowlView[];
  toys: readonly ToyView[];
  /** F-JEU-4 : approches de chaque sorte d'objet. */
  familiar: Readonly<Record<string, number>>;
  /** F-DRE : tours du chien et place pour en apprendre. */
  tricks: readonly { trickId: TrickId; learned: boolean; repetitions: number; mastery: number }[];
  canLearnNew: boolean;
  repsNeeded: number;
  /** F-VIE-4 : les autres chiots de la maison. */
  selfId?: string | undefined;
  friends?: readonly Friend[] | undefined;
}

export interface Friend {
  id: string;
  pos: Vec2;
  activity: Activity;
  /** Le chiot avec qui il joue. */
  partner: string | null;
}

export interface Effects {
  affectionDelta: number;
  caresses: number;
  hungerDelta: number;
  thirstDelta: number;
  cleanDelta: number;
  /** Propreté imposée (bain terminé). */
  cleanSet: number | null;
  bowlEaten: string | null;
  /** Le chiot prend un jouet dans la gueule. */
  toyGrab: string | null;
  toyDrop: { id: string; pos: Vec2 } | null;
  /** Corde attrapée : tirée des deux côtés. */
  toyTug: string | null;
  /** Corde lâchée : le joueur la garde. */
  toyRelease: string | null;
  /** Une approche de plus d'une sorte d'objet. */
  familiar: ToyKind | null;
  /** Une répétition de plus pour ce tour ; `trainLearned` s'il est désormais appris. */
  trained: TrickId | null;
  trainLearned: boolean;
  /** Ordre réussi : la maîtrise du tour monte. */
  masteryUp: TrickId | null;
}

const SPONTANEOUS = ['sniffGround', 'scratch', 'yawn', 'shake', 'dig', 'bark', 'howl'] as const;
type SpontaneousKind = (typeof SPONTANEOUS)[number];

/** Gestes qui réveillent : toucher ou appeler (F-VIE-1). */
const WAKING: ReadonlySet<Gesture['kind']> = new Set(['stroke', 'touch', 'tap', 'pull', 'push', 'scrub', 'groomStart', 'order', 'circle', 'press', 'call']);

export interface PuppyMind {
  /** Temps de simulation écoulé, en ms. */
  t: number;
  activity: Activity;
  activityStartedAt: number;
  nextDecisionAt: number;
  /** Scores de départ de la dernière décision (sans bonus ni hasard). */
  lastScores: Partial<Record<Activity, number>>;
  posture: Posture;
  postureLockUntil: number;
  pos: Vec2;
  target: Vec2 | null;
  gait: Gait;
  /** Orientation au sol : 0 face au joueur, π/2 vers la droite. */
  facing: number;
  look: LookTarget;
  mood: Mood;
  /** Éveillé et attentif : le regard suit le doigt. */
  attentive: boolean;
  /** 0 à 1 : vitesse de la queue, rebond. */
  excitement: number;

  handOnDogUntil: number;
  strokeAccumPx: number;
  lastCaressAt: number;
  handPresent: boolean;
  handPhase: 'sniff' | 'lick' | null;
  handPhaseAt: number;
  taps: number[];
  callUntil: number;
  callAt: number;
  callPoint: Vec2 | null;
  pulls: number[];
  sulkUntil: number;
  raised: boolean;
  raiseAt: number;
  raiseSitDone: boolean;
  /** Repère pour « laissé seul » : dernière interaction ou dernier geste spontané. */
  lastAloneRefAt: number;
  /** Dernier geste du joueur (le sommeil attend qu'on le laisse tranquille). */
  lastInteractionAt: number;
  wokeAt: number;
  spontaneous: { kind: SpontaneousKind; until: number } | null;
  greet: { intensity: 1 | 2 | 3; until: number; nextFeatAt: number; feats: PuppyEventType[] } | null;
  plan: { mode: 'idle' | 'walk'; until: number };
  startledUntil: number;
  happyUntil: number;
  curiousUntil: number;

  eating: { bowlId: string; kind: BowlKind; meal: number; until: number | null; nextBiteAt: number } | null;
  bath: { active: boolean; stage: BathStage; foam: number; wet: number };
  brush: { gained: number; accumPx: number; lastAt: number };
  shineUntil: number;
  /** F-JEU-2 : ce que le chiot a décidé de faire du dernier jouet lancé. */
  toyPlan: { toyId: string; kind: ToyKind; plan: 'fetch' | 'chew' | 'ignore'; at: number } | null;
  /** Jouet dans la gueule. */
  holding: string | null;
  tug: { toyId: string; pulled: number; lastPullAt: number; nextYankAt: number } | null;
  chewUntil: number;
  nextChewAt: number;
  fear: { toyId: string; kind: ToyKind; until: number; approaching: boolean } | null;
  lastFearAt: number;
  /** F-DRE-1 : ampoule au-dessus de la tête. */
  bulb: { trickId: TrickId; until: number } | null;
  perform: { trickId: TrickId; until: number } | null;
  /** F-VIE-4 : partie de jeu avec un autre chiot. */
  play: { partner: string; until: number; nextNibbleAt: number; orbit: number } | null;
  lastPlayAt: number;
  recentOrders: number[];
  begUntil: number;
  /** Début d'un besoin urgent pendant la session (D-03). */
  urgentSince: number | null;

  /** Incrémenté à chaque geste : le rendu mesure la latence de réaction. */
  reactionSeq: number;
  events: PuppyEvent[];
  nextSeq: number;
  rngState: number;
}

const NEVER = -1e12;
const MAX_EVENTS = 32;
const EPS = 1e-6;

export function createMind(seed: number, pos: Vec2 = P.floor.home): PuppyMind {
  return {
    t: 0,
    activity: 'wander',
    activityStartedAt: 0,
    nextDecisionAt: P.decisionIntervalMs,
    lastScores: {},
    posture: 'stand',
    postureLockUntil: 0,
    pos: { ...pos },
    target: null,
    gait: 'still',
    facing: 0,
    look: { kind: 'player' },
    mood: 'calm',
    attentive: true,
    excitement: 0.3,
    handOnDogUntil: NEVER,
    strokeAccumPx: 0,
    lastCaressAt: NEVER,
    handPresent: false,
    handPhase: null,
    handPhaseAt: 0,
    taps: [],
    callUntil: NEVER,
    callAt: 0,
    callPoint: null,
    pulls: [],
    sulkUntil: NEVER,
    raised: false,
    raiseAt: 0,
    raiseSitDone: true,
    lastAloneRefAt: 0,
    lastInteractionAt: 0,
    wokeAt: NEVER,
    spontaneous: null,
    greet: null,
    plan: { mode: 'idle', until: P.wander.idleMinMs },
    startledUntil: NEVER,
    happyUntil: NEVER,
    curiousUntil: NEVER,
    eating: null,
    bath: { active: false, stage: 'wet', foam: 0, wet: 0 },
    brush: { gained: 0, accumPx: 0, lastAt: NEVER },
    shineUntil: NEVER,
    urgentSince: null,
    toyPlan: null,
    holding: null,
    tug: null,
    chewUntil: 0,
    nextChewAt: 0,
    fear: null,
    lastFearAt: NEVER,
    bulb: null,
    perform: null,
    play: null,
    lastPlayAt: NEVER,
    recentOrders: [],
    begUntil: 0,
    reactionSeq: 0,
    events: [],
    nextSeq: 1,
    rngState: seed >>> 0,
  };
}

// ---------------------------------------------------------------- outils

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const noEffects = (): Effects => ({
  affectionDelta: 0,
  caresses: 0,
  hungerDelta: 0,
  thirstDelta: 0,
  cleanDelta: 0,
  cleanSet: null,
  bowlEaten: null,
  toyGrab: null,
  toyDrop: null,
  toyTug: null,
  toyRelease: null,
  familiar: null,
  trained: null,
  trainLearned: false,
  masteryUp: null,
});

/** D-83 : le sol où l'on peut courir après un jouet, plus large que le salon visible. */
function clampToYard(p: Vec2): Vec2 {
  const f = P.floor;
  const y = BALANCE.toys.yard;
  return { x: clamp(p.x, y.minX, y.maxX), z: clamp(p.z, f.minZ, f.maxZ) };
}

function clampToFloor(p: Vec2): Vec2 {
  const f = P.floor;
  return { x: clamp(p.x, f.minX, f.maxX), z: clamp(p.z, f.minZ, f.maxZ) };
}

function emit(m: PuppyMind, type: PuppyEventType, spontaneous = false): void {
  const e: PuppyEvent = { seq: m.nextSeq++, type, t: m.t };
  if (spontaneous) e.spontaneous = true;
  m.events.push(e);
  if (m.events.length > MAX_EVENTS) m.events.splice(0, m.events.length - MAX_EVENTS);
}

function withRng<T>(m: PuppyMind, fn: (rng: Rng) => T): T {
  const rng = createRng(0);
  rng.setState(m.rngState);
  const out = fn(rng);
  m.rngState = rng.getState();
  return out;
}

function randomFloorPoint(rng: Rng): Vec2 {
  const f = P.floor;
  return { x: rng.range(f.minX, f.maxX), z: rng.range(f.minZ + 0.1, f.maxZ - 0.05) };
}

// ---------------------------------------------------------------- jouets

const toyOf = (ctx: PuppyContext, id: string | undefined): ToyView | undefined => ctx.toys.find((t) => t.id === id);
const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);

/** F-JEU-2 : rapporter si l'humeur le permet, sinon mâchouiller ou ignorer. */
function rollToyPlan(m: PuppyMind, ctx: PuppyContext): 'fetch' | 'chew' | 'ignore' {
  if (m.activity === 'sulk' || m.sulkUntil > m.t) return 'ignore';
  const p = TY.plan;
  const pFetch = clamp(p.fetchBase + (p.fetchPerAffection * ctx.affection) / 100 + p.fetchPerDocility * ctx.traits.docility + p.fetchPerEnergyTrait * ctx.traits.energy, 0, 0.95);
  return withRng(m, (rng) => {
    if (rng.next() < pFetch) return 'fetch';
    return rng.next() < 0.15 + p.chewPerEnergyTrait * ctx.traits.energy ? 'chew' : 'ignore';
  });
}

/** Le jouet du plan est-il encore à prendre ? */
function toyAvailable(m: PuppyMind, ctx: PuppyContext): boolean {
  const plan = m.toyPlan;
  if (!plan || plan.plan === 'ignore') return false;
  if (m.holding === plan.toyId) return true;
  const toy = toyOf(ctx, plan.toyId);
  if (!toy || toy.state === 'carried') return false;
  if (toy.kind === 'rope') return toy.state === 'held' || toy.state === 'tug';
  return toy.state !== 'held' && m.t - plan.at < TY.thrownMemoryMs;
}

/** F-JEU-4 : un objet encore inconnu peut effrayer un chiot timide. */
function fearAvailable(m: PuppyMind, ctx: PuppyContext): boolean {
  if (m.fear) return true;
  const plan = m.toyPlan;
  if (!plan || ctx.traits.boldness >= TY.timidBelow) return false;
  if ((ctx.familiar[plan.kind] ?? 0) >= TY.familiarAfter) return false;
  if (m.t - m.lastFearAt < TY.fearCooldownMs || m.t - plan.at > TY.thrownMemoryMs) return false;
  const toy = toyOf(ctx, plan.toyId);
  return !!toy && toy.state !== 'carried' && m.holding !== toy.id;
}

/** Vers le jouet, en restant un peu en retrait pour l'attraper avec la gueule. */
function approachPoint(m: PuppyMind, at: Vec2, gap: number): Vec2 {
  const d = dist2(m.pos, at) || 1;
  return clampToYard({ x: at.x + ((m.pos.x - at.x) / d) * gap, z: at.z + ((m.pos.z - at.z) / d) * gap });
}

// ---------------------------------------------------------------- dressage (F-DRE)

const knownTrick = (ctx: PuppyContext, id: TrickId) => ctx.tricks.find((t) => t.trickId === id);

/** F-DRE-1 : le chiot vient de faire un geste qu'il peut apprendre. */
function offerBulb(m: PuppyMind, ctx: PuppyContext, id: TrickId | undefined): void {
  if (!id || knownTrick(ctx, id)?.learned || !ctx.canLearnNew) return;
  m.bulb = { trickId: id, until: m.t + TR.bulbMs };
  emit(m, 'bulb');
}

const TRICK_EVENT: Record<TrickId, PuppyEventType> = {
  sit: 'sit',
  down: 'flop',
  roll: 'roll',
  paw: 'givePaw',
  beg: 'beg',
  jump: 'jump',
  spin: 'spin',
  howl: 'howl',
  dig: 'dig',
  sniff: 'sniffGround',
  bark: 'bark',
  scratch: 'scratch',
  flip: 'flip',
  handstand: 'handstand',
  playdead: 'playdead',
  dance: 'dance',
};

/** Exécute un tour : posture, animation, puis retour au calme. */
function startPerform(m: PuppyMind, id: TrickId): void {
  const def = TRICKS[id];
  m.perform = { trickId: id, until: m.t + def.durationMs };
  m.activity = 'perform';
  m.activityStartedAt = m.t;
  m.target = null;
  m.gait = 'still';
  m.look = { kind: 'player' };
  m.attentive = true;
  m.posture = def.endPosture ?? 'stand';
  if (def.endPosture === 'beg') m.begUntil = m.t + def.durationMs + TR.begHoldMs;
  m.postureLockUntil = m.t + def.durationMs + 1500;
  emit(m, TRICK_EVENT[id]);
}

/** Marionnette des concours : le chiot exécute ce tour, sans décider de rien. */
export function performTrick(mind: PuppyMind, id: TrickId): PuppyMind {
  const m = structuredClone(mind);
  startPerform(m, id);
  return m;
}

/** Marionnette des concours : un événement (saut, aboiement…) pour l'animation et le son. */
export function withEvent(mind: PuppyMind, type: PuppyEventType): PuppyMind {
  const m = structuredClone(mind);
  emit(m, type);
  return m;
}

function setPosture(m: PuppyMind, posture: Posture): void {
  if (m.t < m.postureLockUntil && posture !== m.posture) return;
  m.posture = posture;
}

/** Gamelle la plus utile pour un besoin réel (D-08), et son score (100 − jauge). */
function bestBowl(ctx: PuppyContext): { bowl: BowlView; score: number } | null {
  let best: { bowl: BowlView; score: number } | null = null;
  for (const bowl of ctx.bowls) {
    const v = bowl.kind === 'food' ? ctx.hunger : ctx.thirst;
    const threshold = bowl.kind === 'food' ? N.realNeed.hunger : N.realNeed.thirst;
    if (v >= threshold) continue;
    const score = 100 - v;
    if (!best || score > best.score) best = { bowl, score };
  }
  return best;
}

function canSleep(m: PuppyMind, ctx: PuppyContext): boolean {
  if (m.activity === 'sleep') return true;
  if (m.bath.active || !(ctx.night || ctx.energy < S.lowEnergy)) return false;
  const quiet = m.t - m.wokeAt < 10 * 60_000 ? S.afterWakeMs : S.aloneMs;
  return m.t - m.lastInteractionAt >= quiet;
}

// ---------------------------------------------------------------- scores

/** Scores de départ des activités possibles (SPEC, Choix de l'activité). */
export function baseScores(m: PuppyMind, ctx: PuppyContext): Partial<Record<Activity, number>> {
  const s = P.scores;
  const out: Partial<Record<Activity, number>> = { wander: s.wander };
  if (m.callUntil > m.t) out.come = s.comeBase + ctx.affection * s.comePerAffection;
  if (m.handOnDogUntil > m.t) out.petted = s.petted;
  if (m.handPresent) out.sniffHand = s.petted;
  if (m.raised) out.attend = s.petted;
  const needSulk = m.urgentSince !== null && m.t - m.urgentSince >= N.sulkAfterUrgentMs;
  if (m.sulkUntil > m.t || needSulk) out.sulk = s.sulk;
  if (!ctx.night && (m.spontaneous || m.t - m.lastAloneRefAt > P.aloneForSpontaneousMs)) {
    out.spontaneous = s.spontaneousBase + ctx.energy * s.spontaneousPerEnergy;
  }
  if (m.greet && m.greet.until > m.t) out.greet = s.greet;
  const bowl = bestBowl(ctx);
  if (bowl) out.eat = bowl.score;
  if (canSleep(m, ctx)) out.sleep = 100 - ctx.energy + (ctx.night ? S.nightBonus : 0);
  if (m.bath.active) out.groom = 100;
  if (toyAvailable(m, ctx) && m.toyPlan) {
    const fetchScore = TY.scores.fetchBase + ctx.energy * TY.scores.fetchPerEnergy;
    const a: Activity = m.toyPlan.kind === 'rope' && !m.holding ? 'tug' : m.toyPlan.plan === 'chew' ? 'chew' : 'fetch';
    out[a] = fetchScore;
  }
  if (m.tug) out.tug = 100;
  if (fearAvailable(m, ctx)) out.fear = TY.scores.fearBase - ctx.traits.boldness * TY.scores.fearPerBoldness;
  if (m.perform && m.perform.until > m.t) out.perform = TR.orderScore;
  if (m.play && m.play.until > m.t && friendOf(ctx, m.play.partner)) out.play = FAM.playScore + 20;
  else {
    const mate = playMate(m, ctx);
    if (mate) out.play = mate.invited ? FAM.playScore + 40 : FAM.playScore + ctx.energy * 0.25;
  }
  return out;
}

const friendOf = (ctx: PuppyContext, id: string): Friend | undefined => ctx.friends?.find((f) => f.id === id && f.activity !== 'sleep');

/** F-VIE-4 : un autre chiot éveillé, tout près, avec qui jouer ; ou qui l'invite. */
function playMate(m: PuppyMind, ctx: PuppyContext): { friend: Friend; invited: boolean } | null {
  if (!ctx.friends || ctx.night || ctx.energy < 40 || m.bath.active || m.t - m.lastPlayAt < FAM.playCooldownMs) return null;
  for (const f of ctx.friends) {
    if (f.activity === 'play' && f.partner === ctx.selfId) return { friend: f, invited: true };
  }
  for (const f of ctx.friends) {
    if (['sleep', 'eat', 'perform', 'play', 'groom'].includes(f.activity)) continue;
    if (Math.hypot(f.pos.x - m.pos.x, f.pos.z - m.pos.z) <= FAM.playRange) return { friend: f, invited: false };
  }
  return null;
}

function decide(m: PuppyMind, ctx: PuppyContext): void {
  const scores = baseScores(m, ctx);
  m.lastScores = scores;
  let best = 'wander' as Activity;
  let bestScore = -Infinity;
  withRng(m, (rng) => {
    for (const [a, base] of Object.entries(scores) as [Activity, number][]) {
      const score = base + (a === m.activity ? P.currentActivityBonus : 0) + rng.range(-P.scoreNoise, P.scoreNoise);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
  });
  // Une gamelle finie : « manger » reste possible, mais vers la gamelle suivante.
  const finishedMeal = best === 'eat' && m.activity === 'eat' && !m.eating;
  if (best !== m.activity || !scores[m.activity] || finishedMeal) enter(m, best, ctx);
}

// ---------------------------------------------------------------- activités

function enter(m: PuppyMind, a: Activity, ctx: PuppyContext): void {
  const prev = m.activity;
  m.activity = a;
  m.activityStartedAt = m.t;
  m.attentive = !['sulk', 'spontaneous', 'sleep', 'eat', 'fetch', 'chew', 'fear', 'play'].includes(a);
  if (prev === 'sniffHand') m.handPhase = null;
  if (prev === 'spontaneous') m.spontaneous = null;
  if (prev === 'eat') m.eating = null;
  if (prev === 'play' && a !== 'play') {
    m.play = null;
    m.lastPlayAt = m.t;
  }

  switch (a) {
    case 'wander': {
      // Après une interaction, il reste là un moment au lieu de repartir aussitôt.
      const calm = prev !== 'wander' && prev !== 'spontaneous';
      m.target = null;
      m.gait = 'still';
      m.plan = { mode: 'idle', until: m.t + (calm ? P.wander.idleMaxMs : P.wander.idleMinMs) };
      if (calm && prev !== 'sulk') m.look = { kind: 'player' };
      if (prev === 'sleep' || prev === 'groom') m.posture = 'sit';
      break;
    }
    case 'come':
      m.target = clampToFloor(m.callPoint ?? P.floor.front);
      m.gait = 'still';
      break;
    case 'petted':
    case 'sniffHand':
      m.target = null;
      m.gait = 'still';
      m.look = a === 'petted' ? { kind: 'player' } : { kind: 'hand' };
      if (a === 'sniffHand') {
        m.handPhase = 'sniff';
        m.handPhaseAt = m.t;
        emit(m, 'sniff');
      }
      break;
    case 'attend':
      m.target = null;
      m.gait = 'still';
      m.look = { kind: 'up' };
      break;
    case 'sulk':
      m.target = null;
      m.gait = 'still';
      m.look = { kind: 'away' };
      if (m.posture === 'side') m.posture = 'sit';
      m.facing = withRng(m, (rng) => (rng.next() < 0.5 ? -1 : 1) * rng.range(2.2, 2.8));
      break;
    case 'spontaneous': {
      const kind = withRng(m, (rng) => rng.pick(SPONTANEOUS));
      m.spontaneous = { kind, until: m.t + P.spontaneousDurationMs };
      m.target = null;
      m.gait = 'still';
      if (kind === 'scratch' || kind === 'howl') setPosture(m, 'sit');
      if (kind === 'shake' || kind === 'dig' || kind === 'sniffGround') setPosture(m, 'stand');
      m.look = kind === 'howl' ? { kind: 'up' } : kind === 'bark' ? withRng(m, (r) => ({ kind: 'point', ...randomFloorPoint(r) })) : { kind: 'ground' };
      emit(m, kind, true);
      offerBulb(m, ctx, SPONTANEOUS_TRICK[kind]);
      break;
    }
    case 'greet': {
      const intensity = m.greet?.intensity ?? 1;
      m.target = { ...P.floor.front };
      m.gait = intensity === 1 ? 'trot' : 'run';
      m.look = { kind: 'player' };
      setPosture(m, 'stand');
      break;
    }
    case 'eat': {
      const b = bestBowl(ctx);
      if (!b) break;
      m.eating = { bowlId: b.bowl.id, kind: b.bowl.kind, meal: b.bowl.meal ?? (b.bowl.kind === 'food' ? N.meal : N.water), until: null, nextBiteAt: 0 };
      m.target = clampToFloor({ x: b.bowl.pos.x, z: b.bowl.pos.z - C.bowlOffsetZ });
      m.gait = 'trot';
      m.look = { kind: 'point', ...b.bowl.pos };
      m.postureLockUntil = 0;
      break;
    }
    case 'sleep': {
      m.target = null;
      m.gait = 'still';
      m.look = { kind: 'ground' };
      m.postureLockUntil = 0;
      m.posture = 'lie';
      emit(m, 'yawn');
      // F-VIE-4 : il va dormir contre un autre chiot endormi.
      const mate = ctx.friends?.find((f) => f.activity === 'sleep');
      if (mate) {
        const side = mate.pos.x > 0 ? -1 : 1;
        const spot = clampToFloor({ x: mate.pos.x + side * 0.17, z: mate.pos.z + 0.02 });
        if (Math.hypot(spot.x - m.pos.x, spot.z - m.pos.z) > 0.05) {
          m.target = spot;
          m.gait = 'walk';
          m.posture = 'stand';
        }
      }
      break;
    }
    case 'play': {
      const mate = m.play ? friendOf(ctx, m.play.partner) : playMate(m, ctx)?.friend;
      if (!mate) break;
      if (!m.play || m.play.partner !== mate.id) {
        const orbit = withRng(m, (rng) => (rng.next() < 0.5 ? -1 : 1));
        m.play = { partner: mate.id, until: m.t + FAM.playMs, nextNibbleAt: m.t + 700, orbit };
      }
      m.postureLockUntil = 0;
      m.look = { kind: 'point', ...mate.pos };
      emit(m, 'playBow');
      break;
    }
    case 'groom':
      // D-88 : debout, pour qu'on puisse le laver partout.
      m.target = null;
      m.gait = 'still';
      m.look = { kind: 'player' };
      m.postureLockUntil = 0;
      m.posture = 'stand';
      m.facing = 0;
      break;
    case 'fetch':
    case 'chew': {
      const toy = toyOf(ctx, m.toyPlan?.toyId);
      m.postureLockUntil = 0;
      if (m.holding) {
        if (a === 'chew') startChew(m);
        else {
          m.target = { ...P.floor.front };
          m.gait = 'trot';
        }
      } else if (toy) {
        m.target = approachPoint(m, toy.pos, 0.03);
        m.gait = a === 'fetch' ? 'run' : 'trot';
        m.look = { kind: 'point', ...toy.pos };
      }
      break;
    }
    case 'tug': {
      const toy = toyOf(ctx, m.toyPlan?.toyId);
      m.postureLockUntil = 0;
      if (toy && !m.tug) {
        m.target = approachPoint(m, toy.pos, 0.1);
        m.gait = 'trot';
        m.look = { kind: 'hand' };
      }
      break;
    }
    case 'fear': {
      const toy = toyOf(ctx, m.toyPlan?.toyId);
      m.postureLockUntil = 0;
      if (!m.fear && toy && m.toyPlan) {
        m.fear = { toyId: toy.id, kind: m.toyPlan.kind, until: m.t + TY.fearMs, approaching: false };
        const d = dist2(m.pos, toy.pos) || 1;
        m.target = clampToFloor({ x: m.pos.x + ((m.pos.x - toy.pos.x) / d) * 0.25, z: m.pos.z + ((m.pos.z - toy.pos.z) / d) * 0.25 });
        m.gait = 'trot';
        m.startledUntil = m.fear.until;
        m.look = { kind: 'point', ...toy.pos };
        emit(m, 'startle');
        emit(m, 'whine');
      }
      break;
    }
  }
}

function startChew(m: PuppyMind): void {
  m.target = null;
  m.gait = 'still';
  m.postureLockUntil = 0;
  m.posture = 'lie';
  m.chewUntil = m.t + TY.chewMs;
  m.nextChewAt = m.t;
  m.look = { kind: 'ground' };
}

/** Position de la gueule, au sol. */
function mouthPos(m: PuppyMind): Vec2 {
  const off = TY.dropOffsetZ;
  return clampToYard({ x: m.pos.x + Math.sin(m.facing) * off, z: m.pos.z + Math.cos(m.facing) * off });
}

/** Le chiot gagne la corde (F-JEU-3) : il l'emporte et la mâchouille. */
function dogWinsTug(m: PuppyMind, fx: Effects, ctx: PuppyContext): void {
  if (!m.tug) return;
  const id = m.tug.toyId;
  m.tug = null;
  m.holding = id;
  fx.toyGrab = id;
  if (m.toyPlan) m.toyPlan = { ...m.toyPlan, plan: 'chew' };
  m.happyUntil = m.t + 2000;
  emit(m, 'wiggle');
  enter(m, 'chew', ctx);
}

/** En changeant d'activité, il lâche ce qu'il tient. */
function letGo(m: PuppyMind, fx: Effects): void {
  if (m.holding && m.activity !== 'fetch' && m.activity !== 'chew') {
    fx.toyDrop = { id: m.holding, pos: mouthPos(m) };
    m.holding = null;
  }
  if (m.tug && m.activity !== 'tug') {
    fx.toyRelease = m.tug.toyId;
    m.tug = null;
  }
}

function arrive(m: PuppyMind): void {
  m.target = null;
  m.gait = 'still';
  if (m.activity === 'come' || m.activity === 'greet') {
    m.facing = 0;
    m.look = { kind: 'player' };
    emit(m, 'wiggle');
  }
  if (m.activity === 'come') {
    m.callUntil = NEVER;
    m.happyUntil = m.t + 2000;
  }
  if (m.activity === 'greet' && m.greet) m.greet.nextFeatAt = m.t + 200;
  if (m.activity === 'fetch' && m.holding) m.facing = 0;
  if (m.activity === 'sleep') m.posture = 'lie';
  if (m.activity === 'eat' && m.eating) {
    m.facing = 0;
    m.look = { kind: 'ground' };
    m.eating.until = m.t + C.eatMs;
    m.eating.nextBiteAt = m.t;
  }
}

function move(m: PuppyMind, dtMs: number): void {
  if (!m.target || m.gait === 'still') return;
  if (m.posture !== 'stand') {
    if (m.t < m.postureLockUntil) return;
    m.posture = 'stand';
  }
  const dx = m.target.x - m.pos.x;
  const dz = m.target.z - m.pos.z;
  const d = Math.hypot(dx, dz);
  const step = (P.speeds[m.gait] * dtMs) / 1000;
  if (d <= Math.max(step, P.arriveEpsilon)) {
    m.pos = { ...m.target };
    arrive(m);
    return;
  }
  m.pos = clampToYard({ x: m.pos.x + (dx / d) * step, z: m.pos.z + (dz / d) * step });
  m.facing = Math.atan2(dx, dz);
}

function updateActivity(m: PuppyMind, ctx: PuppyContext, fx: Effects): void {
  switch (m.activity) {
    case 'wander':
      if (m.t < m.plan.until || m.target) break;
      withRng(m, (rng) => {
        const w = P.wander;
        if (rng.next() < w.walkChance && m.t >= m.postureLockUntil) {
          m.target = randomFloorPoint(rng);
          m.gait = rng.next() < 0.25 ? 'trot' : 'walk';
          m.look = { kind: 'point', ...m.target };
          if (rng.next() < w.sniffChance) {
            m.look = { kind: 'ground' };
            emit(m, 'sniffGround');
          }
          m.plan = { mode: 'walk', until: m.t };
        } else {
          const r = rng.next();
          setPosture(m, r < 0.4 ? 'stand' : r < 0.75 ? 'sit' : 'lie');
          if (rng.next() < 0.5) {
            m.look = { kind: 'player' };
            if (rng.next() < 0.5) m.facing = rng.range(-0.4, 0.4);
          } else {
            m.look = { kind: 'point', ...randomFloorPoint(rng) };
          }
          m.plan = { mode: 'idle', until: m.t + rng.range(w.idleMinMs, w.idleMaxMs) };
        }
      });
      break;
    case 'come':
      if (m.target && m.gait === 'still' && m.t >= m.callAt) {
        const d = Math.hypot(m.target.x - m.pos.x, m.target.z - m.pos.z);
        m.gait = d > 0.45 ? 'run' : 'trot';
      }
      break;
    case 'sniffHand':
      if (m.handPhase === 'sniff' && m.t - m.handPhaseAt >= P.hand.sniffMs) {
        m.handPhase = 'lick';
        m.handPhaseAt = m.t;
        emit(m, 'lick');
      } else if (m.handPhase === 'lick' && m.t - m.handPhaseAt >= P.hand.lickIntervalMs) {
        m.handPhaseAt = m.t;
        emit(m, 'lick');
      }
      break;
    case 'attend':
      if (!m.raiseSitDone && m.t - m.raiseAt >= P.raise.sitDelayMs) {
        m.raiseSitDone = true;
        const p = P.raise.sitChanceBase + ctx.traits.docility * P.raise.sitChancePerDocility;
        if (m.posture === 'stand' && withRng(m, (rng) => rng.next()) < p) {
          setPosture(m, 'sit');
          emit(m, 'sit');
          offerBulb(m, ctx, 'sit');
        }
      }
      break;
    case 'spontaneous':
      if (m.spontaneous && m.t >= m.spontaneous.until) {
        m.spontaneous = null;
        m.lastAloneRefAt = m.t;
      }
      break;
    case 'greet': {
      const gr = m.greet;
      if (!gr) break;
      if (!m.target && m.t >= gr.nextFeatAt) {
        const feat = gr.feats.shift();
        if (feat) {
          emit(m, feat);
          gr.nextFeatAt = m.t + (gr.intensity === 3 ? 650 : 900);
        }
      }
      if (m.t >= gr.until) {
        if (gr.intensity >= 2) emit(m, 'pant');
        m.greet = null;
        m.happyUntil = m.t + 3000;
      }
      break;
    }
    case 'eat': {
      const e = m.eating;
      if (!e || e.until === null) break;
      if (m.t >= e.until) {
        if (e.kind === 'food') fx.hungerDelta += e.meal;
        else fx.thirstDelta += e.meal;
        fx.bowlEaten = e.bowlId;
        m.eating = null;
        m.happyUntil = m.t + 2500;
        m.look = { kind: 'player' };
        emit(m, 'lickLips');
      } else if (m.t >= e.nextBiteAt) {
        e.nextBiteAt = m.t + (e.kind === 'food' ? 420 : 300);
        emit(m, e.kind === 'food' ? 'chew' : 'lap');
      }
      break;
    }
    case 'play': {
      const pl = m.play;
      const mate = pl ? friendOf(ctx, pl.partner) : undefined;
      if (!pl || !mate || m.t >= pl.until) {
        if (pl) emit(m, 'pant');
        m.play = null;
        m.lastPlayAt = m.t;
        m.happyUntil = m.t + 2000;
        m.target = null;
        m.gait = 'still';
        break;
      }
      // Ils se tournent autour, se poursuivent et se mordillent.
      const a = (m.t / 650) * pl.orbit;
      m.target = clampToFloor({ x: mate.pos.x + Math.sin(a) * FAM.playOrbit, z: mate.pos.z + Math.cos(a) * FAM.playOrbit * 0.6 });
      m.gait = 'run';
      m.look = { kind: 'point', ...mate.pos };
      const d = Math.hypot(mate.pos.x - m.pos.x, mate.pos.z - m.pos.z);
      if (d < FAM.playOrbit * 1.4 && m.t >= pl.nextNibbleAt) {
        pl.nextNibbleAt = m.t + withRng(m, (rng) => rng.range(900, 1900));
        emit(m, withRng(m, (rng) => (rng.next() < 0.7 ? 'nibble' : rng.next() < 0.5 ? 'playBow' : 'yip')));
      }
      break;
    }
    case 'sleep':
      // Au matin, reposé, il se réveille de lui-même.
      if (!ctx.night && ctx.energy >= 95) wake(m);
      else if (Math.floor(m.t / 3200) !== Math.floor((m.t - 100) / 3200)) emit(m, 'snore');
      break;
    case 'fetch':
    case 'chew': {
      const plan = m.toyPlan;
      if (!plan) break;
      const toy = toyOf(ctx, plan.toyId);
      if (!m.holding) {
        if (!toy) break;
        m.look = { kind: 'point', ...toy.pos };
        const reachable = toy.h < 0.25 && toy.state !== 'held' && toy.state !== 'carried';
        if (reachable && dist2(m.pos, toy.pos) <= TY.grabDistance + 0.05) {
          m.holding = toy.id;
          fx.toyGrab = toy.id;
          fx.familiar = plan.kind;
          if (m.activity === 'fetch') {
            m.target = { ...P.floor.front };
            m.gait = 'trot';
            m.look = { kind: 'player' };
          } else startChew(m);
        } else {
          m.target = approachPoint(m, toy.pos, 0.03);
          if (m.gait === 'still') m.gait = m.activity === 'fetch' ? 'run' : 'trot';
        }
      } else if (m.activity === 'fetch' && !m.target) {
        // Rendu devant le joueur : il pose le jouet.
        fx.toyDrop = { id: m.holding, pos: mouthPos(m) };
        m.holding = null;
        m.toyPlan = null;
        m.happyUntil = m.t + 2500;
        m.look = { kind: 'player' };
        emit(m, 'wiggle');
      } else if (m.activity === 'chew') {
        if (m.t >= m.chewUntil) {
          fx.toyDrop = { id: m.holding, pos: mouthPos(m) };
          m.holding = null;
          m.toyPlan = null;
        } else if (m.t >= m.nextChewAt) {
          m.nextChewAt = m.t + 450;
          emit(m, 'chew');
        }
      }
      break;
    }
    case 'tug': {
      const toy = toyOf(ctx, m.toyPlan?.toyId);
      if (!toy) break;
      if (!m.tug) {
        if (toy.state !== 'held') break;
        if (dist2(m.pos, toy.pos) < 0.16) {
          m.tug = { toyId: toy.id, pulled: 0, lastPullAt: m.t, nextYankAt: m.t + TY.tug.yankEveryMs };
          fx.toyTug = toy.id;
          fx.familiar = 'rope';
          m.target = null;
          m.gait = 'still';
          m.posture = 'stand';
          m.facing = Math.atan2(toy.pos.x - m.pos.x, toy.pos.z - m.pos.z);
          m.look = { kind: 'hand' };
          emit(m, 'yip');
        } else {
          m.target = approachPoint(m, toy.pos, 0.1);
          if (m.gait === 'still') m.gait = 'trot';
        }
      } else if (m.t - m.tug.lastPullAt >= TY.tug.idleMs) {
        dogWinsTug(m, fx, ctx);
      } else if (m.t >= m.tug.nextYankAt) {
        m.tug.nextYankAt = m.t + TY.tug.yankEveryMs;
        emit(m, 'shake');
        if (withRng(m, (rng) => rng.next()) < TY.tug.yankChance * (0.6 + ctx.traits.boldness)) dogWinsTug(m, fx, ctx);
      }
      break;
    }
    case 'fear': {
      const f = m.fear;
      if (!f) break;
      const toy = toyOf(ctx, f.toyId);
      if (!f.approaching && m.t >= f.until) {
        // Après la frayeur, il s'approche prudemment pour renifler.
        f.approaching = true;
        m.startledUntil = NEVER;
        m.curiousUntil = m.t + 4000;
        if (toy) {
          m.target = approachPoint(m, toy.pos, 0.12);
          m.gait = 'walk';
          m.look = { kind: 'point', ...toy.pos };
        }
      } else if (f.approaching && !m.target) {
        emit(m, 'sniff');
        fx.familiar = f.kind;
        m.fear = null;
        m.lastFearAt = m.t;
        if (m.toyPlan) m.toyPlan = { ...m.toyPlan, plan: 'ignore' };
      }
      break;
    }
    case 'petted':
    case 'sulk':
    case 'groom':
      break;
  }
}

function wake(m: PuppyMind): void {
  m.wokeAt = m.t;
  m.activity = 'wander';
  m.plan = { mode: 'idle', until: m.t + P.wander.idleMaxMs };
  m.posture = 'sit';
  m.attentive = true;
  m.look = { kind: 'player' };
  emit(m, 'yawn');
  emit(m, 'stretch');
}

function computeMood(m: PuppyMind): Mood {
  if (m.activity === 'sleep') return 'asleep';
  if (m.activity === 'sulk') return 'sulky';
  if (m.t < m.startledUntil) return 'startled';
  if (m.activity === 'greet' || m.t < m.happyUntil) return 'happy';
  if (m.activity === 'petted' || m.activity === 'sniffHand' || m.activity === 'groom') return 'content';
  if (m.activity === 'attend' || m.t < m.curiousUntil) return 'curious';
  if (m.activity === 'come') return m.gait === 'still' ? 'curious' : 'happy';
  if (m.activity === 'fetch' || m.activity === 'tug' || m.activity === 'play') return 'happy';
  if (m.activity === 'chew') return 'content';
  if (m.activity === 'fear') return 'curious';
  if (m.activity === 'perform') return 'happy';
  return 'calm';
}

const EXCITEMENT: Record<Mood, number> = { happy: 0.95, content: 0.7, curious: 0.45, calm: 0.3, sulky: 0.05, startled: 0.1, asleep: 0 };

function settle(m: PuppyMind, dtMs: number): void {
  m.mood = computeMood(m);
  const target = EXCITEMENT[m.mood];
  const k = Math.min(1, (dtMs / 1000) * 1.2);
  m.excitement += (target - m.excitement) * k;
}

// ---------------------------------------------------------------- API

export function tickMind(mind: PuppyMind, dtMs: number, ctx: PuppyContext): { mind: PuppyMind; effects: Effects } {
  const m = structuredClone(mind);
  const fx = noEffects();
  m.t += dtMs;
  if (isUrgent(ctx)) m.urgentSince ??= m.t;
  else m.urgentSince = null;
  move(m, dtMs);
  updateActivity(m, ctx, fx);
  if (m.bulb && m.t >= m.bulb.until) m.bulb = null;
  if (m.perform && m.t >= m.perform.until) {
    m.perform = null;
    m.happyUntil = m.t + 1500;
  }
  // Debout sur ses pattes arrière, il retombe assis au bout d'un moment.
  if (m.posture === 'beg' && m.activity !== 'perform' && m.t >= m.begUntil) m.posture = 'sit';
  if (m.t >= m.nextDecisionAt) {
    m.nextDecisionAt += P.decisionIntervalMs;
    // Le sommeil ne s'interrompt que si le joueur touche le chiot ou l'appelle.
    if (m.activity !== 'sleep') decide(m, ctx);
  }
  letGo(m, fx);
  settle(m, dtMs);
  return { mind: m, effects: fx };
}

/** Intensité de l'accueil (F-VIE-2) selon la durée d'absence. */
export function greetIntensity(absenceMs: number): 0 | 1 | 2 | 3 {
  const [a, b, c] = P.greet.thresholdsMs;
  if (absenceMs >= c) return 3;
  if (absenceMs >= b) return 2;
  if (absenceMs >= a) return 1;
  return 0;
}

const FEATS: Record<1 | 2 | 3, PuppyEventType[]> = {
  1: ['yip', 'wiggle'],
  2: ['bark', 'jump', 'wiggle', 'yip'],
  3: ['bark', 'jump', 'spin', 'whine', 'jump', 'bark', 'wiggle', 'yip'],
};

const DEFAULT_CTX: PuppyContext = {
  traits: { docility: 0.5, energy: 0.5, boldness: 0.5 },
  affection: 30,
  energy: 100,
  hunger: 80,
  thirst: 80,
  cleanliness: 90,
  fun: 80,
  night: false,
  bowls: [],
  toys: [],
  familiar: {},
  tricks: [],
  canLearnNew: true,
  repsNeeded: 4,
};

export function startGreeting(mind: PuppyMind, absenceMs: number, ctx: PuppyContext = DEFAULT_CTX): PuppyMind {
  const intensity = greetIntensity(absenceMs);
  if (intensity === 0) return mind;
  const m = structuredClone(mind);
  m.greet = { intensity, until: m.t + 1500 + P.greet.durationMs[intensity], nextFeatAt: Infinity, feats: [...FEATS[intensity]] };
  m.lastAloneRefAt = m.t;
  m.lastInteractionAt = m.t;
  m.sulkUntil = NEVER;
  m.urgentSince = null;
  m.postureLockUntil = 0;
  enter(m, 'greet', ctx);
  emit(m, intensity === 1 ? 'perk' : 'bark');
  settle(m, 0);
  return m;
}

function scrub(m: PuppyMind, tool: CareTool, px: number, fx: Effects): void {
  const b = m.bath;
  m.handOnDogUntil = m.t + P.pettingHoldMs;
  if (tool === 'brush') {
    const br = m.brush;
    if (m.t - br.lastAt > C.brushSessionGapMs) {
      br.gained = 0;
      br.accumPx = 0;
    }
    br.lastAt = m.t;
    br.accumPx += px;
    while (br.accumPx >= C.brushPxPerStep && br.gained < C.brushMaxPerSession) {
      br.accumPx -= C.brushPxPerStep;
      br.gained += C.brushStep;
      fx.cleanDelta += C.brushStep;
      m.shineUntil = m.t + C.shineMs;
    }
    return;
  }
  if (!b.active) return;
  // D-88 : mouiller, savonner, rincer, sécher ; chaque étape attend la précédente.
  const next = (stage: BathStage): void => {
    b.stage = stage;
    emit(m, 'bathStep');
  };
  if (b.stage === 'wet' && tool === 'shower') {
    b.wet = Math.min(1, b.wet + px / C.wetPx);
    if (b.wet > 1 - EPS) {
      b.wet = 1;
      next('soap');
    }
  } else if (b.stage === 'soap' && tool === 'soap') {
    b.foam = Math.min(1, b.foam + px / C.soapPx);
    if (b.foam > 1 - EPS) {
      b.foam = 1;
      next('rinse');
    }
  } else if (b.stage === 'rinse' && tool === 'shower') {
    b.foam = Math.max(0, b.foam - px / C.rinsePx);
    if (b.foam < EPS) {
      b.foam = 0;
      next('dry');
      // Rincé : il s'ébroue, avant le sèche-cheveux.
      emit(m, 'shake');
    }
  } else if (b.stage === 'dry' && tool === 'dryer') {
    b.wet = Math.max(0, b.wet - px / C.dryPx);
    if (b.wet < EPS) {
      b.wet = 0;
      fx.cleanSet = N.bath;
      m.happyUntil = m.t + 3000;
      next('done');
    }
  }
}

export function handleGesture(mind: PuppyMind, g: Gesture, ctx: PuppyContext): { mind: PuppyMind; effects: Effects } {
  const m = structuredClone(mind);
  const fx = noEffects();
  m.reactionSeq++;
  const C2 = P.caress;

  if (m.activity === 'sleep') {
    if (!WAKING.has(g.kind)) {
      if (g.kind === 'present') m.handPresent = true;
      if (g.kind === 'presentEnd') m.handPresent = false;
      if (g.kind === 'raise') m.raised = true;
      if (g.kind === 'raiseEnd') m.raised = false;
      return { mind: m, effects: fx };
    }
    wake(m);
  }
  if (g.kind !== 'bowl' && g.kind !== 'present' && g.kind !== 'presentEnd' && g.kind !== 'raiseEnd') {
    m.lastInteractionAt = m.t;
  }
  m.lastAloneRefAt = m.t;

  switch (g.kind) {
    case 'stroke':
      m.handOnDogUntil = m.t + P.pettingHoldMs;
      m.strokeAccumPx = Math.min(C2.minStrokePx, m.strokeAccumPx + g.distancePx);
      if (m.strokeAccumPx >= C2.minStrokePx && m.t - m.lastCaressAt >= C2.minIntervalMs) {
        fx.caresses = 1;
        m.lastCaressAt = m.t;
        m.strokeAccumPx = 0;
      }
      m.excitement = Math.min(1, m.excitement + 0.15);
      if (m.greet && !m.target) m.greet.until = m.t;
      break;
    case 'touch':
      m.handOnDogUntil = m.t + P.pettingHoldMs;
      if (g.part === 'paw') {
        // « Donne la patte » : toucher une patte avant.
        startPerform(m, 'paw');
        offerBulb(m, ctx, 'paw');
      }
      break;
    case 'present':
      m.handPresent = true;
      break;
    case 'presentEnd':
      m.handPresent = false;
      break;
    case 'raise':
      m.raised = true;
      m.raiseAt = m.t;
      m.raiseSitDone = false;
      m.look = { kind: 'up' };
      if (m.posture === 'beg' && g.fast) {
        // « Saut » : lever vite la main d'un chiot debout.
        startPerform(m, 'jump');
        offerBulb(m, ctx, 'jump');
      } else if (m.posture === 'sit') {
        // « Debout » : lever la main d'un chiot assis.
        startPerform(m, 'beg');
        offerBulb(m, ctx, 'beg');
      }
      break;
    case 'raiseEnd':
      m.raised = false;
      break;
    case 'tap': {
      m.taps = [...m.taps.filter((t) => m.t - t < P.taps.windowMs), m.t];
      m.look = g.at ? { kind: 'point', x: g.at.x, z: g.at.z } : { kind: 'player' };
      m.curiousUntil = m.t + 2000;
      emit(m, 'perk');
      if (m.taps.length >= P.taps.count) {
        m.taps = [];
        m.callPoint = g.at ? clampToFloor(g.at) : null;
        m.callUntil = m.t + P.taps.callMs;
        m.callAt = m.t + P.taps.lookBeforeComeMs;
        m.postureLockUntil = 0;
      }
      break;
    }
    case 'pull': {
      m.pulls = [...m.pulls.filter((t) => m.t - t < P.pull.windowMs), m.t];
      if (m.pulls.length >= P.pull.repeatedCount) {
        fx.affectionDelta = -P.pull.affectionLoss;
        m.sulkUntil = m.t + P.pull.sulkMs;
        m.happyUntil = NEVER;
        m.postureLockUntil = 0;
        emit(m, 'backOff');
        emit(m, 'whine');
        decide(m, ctx);
        const away = Math.sign(m.pos.x || 1);
        m.target = clampToFloor({ x: m.pos.x + away * P.pull.backOffDistance * 0.7, z: m.pos.z - P.pull.backOffDistance * 0.7 });
        m.gait = 'trot';
        m.posture = 'stand';
        letGo(m, fx);
        settle(m, 0);
        return { mind: m, effects: fx };
      }
      if (withRng(m, (rng) => rng.next()) < 0.5) {
        m.startledUntil = m.t + 1200;
        emit(m, 'startle');
        emit(m, 'yelp');
      } else {
        m.happyUntil = m.t + 2000;
        emit(m, 'playBow');
        emit(m, 'yip');
      }
      m.look = { kind: 'player' };
      break;
    }
    case 'push':
      m.postureLockUntil = 0;
      if (m.posture === 'lie' || m.posture === 'side') {
        if (m.posture === 'lie') {
          emit(m, 'flop');
          // « Roulade » : pousser le flanc d'un chiot couché.
          offerBulb(m, ctx, 'roll');
        }
        m.posture = 'side';
        m.happyUntil = m.t + 2500;
      } else {
        m.posture = 'lie';
        offerBulb(m, ctx, 'down');
      }
      m.postureLockUntil = m.t + 4000;
      m.target = null;
      m.gait = 'still';
      m.handOnDogUntil = m.t + P.pettingHoldMs;
      break;
    case 'press':
      // « Couché » : appuyer doucement sur le dos.
      m.handOnDogUntil = m.t + P.pettingHoldMs;
      if (m.posture !== 'lie' && m.posture !== 'side') {
        startPerform(m, 'down');
        offerBulb(m, ctx, 'down');
      }
      break;
    case 'circle':
      // « Tourne » : dessiner un cercle autour de lui.
      startPerform(m, 'spin');
      offerBulb(m, ctx, 'spin');
      break;
    case 'perform':
      startPerform(m, g.trick);
      break;
    case 'relieved':
      m.look = { kind: 'ground' };
      emit(m, 'sniffGround');
      break;
    case 'forceSpontaneous':
      startPerform(m, g.trick);
      offerBulb(m, ctx, g.trick);
      break;
    case 'train': {
      // F-DRE-1 : toucher l'ampoule associe l'ordre ; F-DRE-2 : appris après assez de répétitions.
      const b = m.bulb;
      if (!b || m.t >= b.until) break;
      const reps = (knownTrick(ctx, b.trickId)?.repetitions ?? 0) + 1;
      fx.trained = b.trickId;
      if (reps >= ctx.repsNeeded) {
        fx.trainLearned = true;
        m.happyUntil = m.t + 3000;
        emit(m, 'learned');
      } else emit(m, 'progress');
      m.bulb = null;
      break;
    }
    case 'order': {
      m.recentOrders = [...m.recentOrders.filter((t) => m.t - t < BALANCE.obedience.spamWindowMs), m.t];
      const base = knownTrick(ctx, g.trickId);
      if (!base?.learned) {
        // F-DRE-3 : ordre mal compris, point d'interrogation rouge.
        m.curiousUntil = m.t + 1500;
        emit(m, 'confused');
        break;
      }
      const combo = comboFor(g.trickId, m.posture);
      const comboKnown = combo ? knownTrick(ctx, combo) : undefined;
      const doing = combo ?? g.trickId;
      const mastery = (combo ? comboKnown?.mastery : base.mastery) ?? 0;
      const malus = obedienceMalus({ hunger: ctx.hunger, thirst: ctx.thirst, energy: ctx.energy, recentOrders: m.recentOrders.length - 1 });
      const p = obeyProbability({ docility: ctx.traits.docility, affection: ctx.affection, mastery, malus });
      if (withRng(m, (rng) => rng.next()) < p) {
        startPerform(m, doing);
        if (combo && !comboKnown?.learned) offerBulb(m, ctx, combo);
        else fx.masteryUp = doing;
      } else {
        // L'ordre est compris mais pas suivi : il regarde ailleurs, bâille ou part renifler.
        const r = withRng(m, (rng) => rng.pick(['lookAway', 'yawn', 'sniffGround'] as const));
        m.look = r === 'sniffGround' ? { kind: 'ground' } : { kind: 'away' };
        emit(m, r);
      }
      break;
    }
    case 'orderSimilar':
      // F-DRE-3 : ordre trop proche d'un autre, point d'interrogation bleu.
      emit(m, 'similar');
      break;
    case 'treat':
      // Une friandise donnée à la main.
      m.happyUntil = m.t + 2500;
      m.excitement = 1;
      m.look = { kind: 'player' };
      emit(m, 'treat');
      emit(m, 'lickLips');
      break;
    case 'voiceMiss':
      // F-DRE-3 : ordre mal compris à la voix, point d'interrogation rouge.
      m.curiousUntil = m.t + 1500;
      emit(m, 'confused');
      break;
    case 'call':
      // Le joueur l'appelle par son nom : il vient.
      m.callPoint = null;
      m.callUntil = m.t + P.taps.callMs;
      m.callAt = m.t + P.taps.lookBeforeComeMs;
      m.postureLockUntil = 0;
      m.curiousUntil = m.t + 2000;
      emit(m, 'perk');
      break;
    case 'groomStart':
      m.bath = { active: true, stage: 'wet', foam: 0, wet: 0 };
      break;
    case 'groomEnd':
      if (m.bath.wet > 0 || m.bath.foam > 0) emit(m, 'shake');
      m.bath = { active: false, stage: 'wet', foam: 0, wet: 0 };
      break;
    case 'scrub':
      scrub(m, g.tool, g.distancePx, fx);
      break;
    case 'bowl':
      break;
    case 'toyThrown':
      m.toyPlan = { toyId: g.toyId, kind: g.toyKind, plan: rollToyPlan(m, ctx), at: m.t };
      m.curiousUntil = m.t + 1500;
      emit(m, 'perk');
      break;
    case 'ropeOffered':
      m.toyPlan = { toyId: g.toyId, kind: 'rope', plan: rollToyPlan(m, ctx), at: m.t };
      break;
    case 'tug':
      if (m.tug) {
        m.tug.pulled += g.pullPx;
        m.tug.lastPullAt = m.t;
        if (m.tug.pulled >= TY.tug.winPx) {
          // Le joueur gagne : le chiot lâche, ravi de la partie.
          fx.toyRelease = m.tug.toyId;
          m.tug = null;
          m.toyPlan = null;
          m.happyUntil = m.t + 2500;
          emit(m, 'playBow');
        }
      }
      break;
    case 'ropeRelease':
      if (m.tug) dogWinsTug(m, fx, ctx);
      break;
    case 'toyTaken':
      if (m.toyPlan?.toyId === g.toyId) m.toyPlan = null;
      break;
  }

  decide(m, ctx);
  letGo(m, fx);
  settle(m, 0);
  return { mind: m, effects: fx };
}
