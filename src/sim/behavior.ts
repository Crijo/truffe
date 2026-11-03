/**
 * Esprit du chiot : activité choisie par score toutes les 500 ms, réactions
 * immédiates aux gestes (F-MAIN) et accueil au retour (F-VIE-2).
 * Pur : le temps avance par `tickMind`, le hasard vient de `rngState`.
 */
import { BALANCE } from '../data/balance';
import { createRng, type Rng } from './rng';

const P = BALANCE.puppy;

export type Posture = 'stand' | 'sit' | 'lie' | 'side';
export type Activity = 'wander' | 'come' | 'petted' | 'sniffHand' | 'attend' | 'sulk' | 'spontaneous' | 'greet';
export type Mood = 'calm' | 'happy' | 'content' | 'curious' | 'sulky' | 'startled';
export type BodyPart = 'head' | 'ear' | 'muzzle' | 'back' | 'flank' | 'belly' | 'tail' | 'paw';
export type Gait = 'still' | 'walk' | 'trot' | 'run';
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
  | 'sit';

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
  | { kind: 'raise' }
  | { kind: 'raiseEnd' }
  | { kind: 'push'; part: BodyPart }
  | { kind: 'touch'; part: BodyPart };

export interface PuppyContext {
  traits: { docility: number; energy: number; boldness: number };
  affection: number;
  energy: number;
}

export interface Effects {
  affectionDelta: number;
  caresses: number;
}

const SPONTANEOUS = ['sniffGround', 'scratch', 'yawn', 'shake', 'dig', 'bark', 'howl'] as const;
type SpontaneousKind = (typeof SPONTANEOUS)[number];

export interface PuppyMind {
  /** Temps de simulation écoulé, en ms. */
  t: number;
  activity: Activity;
  activityStartedAt: number;
  nextDecisionAt: number;
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
  spontaneous: { kind: SpontaneousKind; until: number } | null;
  greet: { intensity: 1 | 2 | 3; until: number; nextFeatAt: number; feats: PuppyEventType[] } | null;
  plan: { mode: 'idle' | 'walk'; until: number };
  startledUntil: number;
  happyUntil: number;
  curiousUntil: number;

  /** Incrémenté à chaque geste : le rendu mesure la latence de réaction. */
  reactionSeq: number;
  events: PuppyEvent[];
  nextSeq: number;
  rngState: number;
}

const NEVER = -1e12;
const MAX_EVENTS = 32;

export function createMind(seed: number, pos: Vec2 = P.floor.home): PuppyMind {
  return {
    t: 0,
    activity: 'wander',
    activityStartedAt: 0,
    nextDecisionAt: P.decisionIntervalMs,
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
    spontaneous: null,
    greet: null,
    plan: { mode: 'idle', until: P.wander.idleMinMs },
    startledUntil: NEVER,
    happyUntil: NEVER,
    curiousUntil: NEVER,
    reactionSeq: 0,
    events: [],
    nextSeq: 1,
    rngState: seed >>> 0,
  };
}

// ---------------------------------------------------------------- outils

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const noEffects = (): Effects => ({ affectionDelta: 0, caresses: 0 });

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

function setPosture(m: PuppyMind, posture: Posture): void {
  if (m.t < m.postureLockUntil && posture !== m.posture) return;
  m.posture = posture;
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
  if (m.sulkUntil > m.t) out.sulk = s.sulk;
  if (m.spontaneous || m.t - m.lastAloneRefAt > P.aloneForSpontaneousMs) {
    out.spontaneous = s.spontaneousBase + ctx.energy * s.spontaneousPerEnergy;
  }
  if (m.greet && m.greet.until > m.t) out.greet = s.greet;
  return out;
}

function decide(m: PuppyMind, ctx: PuppyContext): void {
  const scores = baseScores(m, ctx);
  let best: Activity = 'wander';
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
  if (best !== m.activity || !scores[m.activity]) enter(m, best, ctx);
}

// ---------------------------------------------------------------- activités

function enter(m: PuppyMind, a: Activity, ctx: PuppyContext): void {
  const prev = m.activity;
  m.activity = a;
  m.activityStartedAt = m.t;
  m.attentive = a !== 'sulk' && a !== 'spontaneous';
  if (prev === 'sniffHand') m.handPhase = null;
  if (prev === 'spontaneous') m.spontaneous = null;

  switch (a) {
    case 'wander': {
      // Après une interaction, il reste là un moment au lieu de repartir aussitôt.
      const calm = prev !== 'wander' && prev !== 'spontaneous';
      m.target = null;
      m.gait = 'still';
      m.plan = { mode: 'idle', until: m.t + (calm ? P.wander.idleMaxMs : P.wander.idleMinMs) };
      if (calm && prev !== 'sulk') m.look = { kind: 'player' };
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
  }
  void ctx;
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
  m.pos = clampToFloor({ x: m.pos.x + (dx / d) * step, z: m.pos.z + (dz / d) * step });
  m.facing = Math.atan2(dx, dz);
}

function updateActivity(m: PuppyMind, ctx: PuppyContext): void {
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
        m.greet = null;
        m.happyUntil = m.t + 3000;
      }
      break;
    }
    case 'petted':
    case 'sulk':
      break;
  }
}

function computeMood(m: PuppyMind): Mood {
  if (m.activity === 'sulk') return 'sulky';
  if (m.t < m.startledUntil) return 'startled';
  if (m.activity === 'greet' || m.t < m.happyUntil) return 'happy';
  if (m.activity === 'petted' || m.activity === 'sniffHand') return 'content';
  if (m.activity === 'attend' || m.t < m.curiousUntil) return 'curious';
  if (m.activity === 'come') return m.gait === 'still' ? 'curious' : 'happy';
  return 'calm';
}

const EXCITEMENT: Record<Mood, number> = { happy: 0.95, content: 0.7, curious: 0.45, calm: 0.3, sulky: 0.05, startled: 0.1 };

function settle(m: PuppyMind, dtMs: number): void {
  m.mood = computeMood(m);
  const target = EXCITEMENT[m.mood];
  const k = Math.min(1, (dtMs / 1000) * 1.2);
  m.excitement += (target - m.excitement) * k;
}

// ---------------------------------------------------------------- API

export function tickMind(mind: PuppyMind, dtMs: number, ctx: PuppyContext): { mind: PuppyMind; effects: Effects } {
  const m = structuredClone(mind);
  m.t += dtMs;
  move(m, dtMs);
  updateActivity(m, ctx);
  if (m.t >= m.nextDecisionAt) {
    m.nextDecisionAt += P.decisionIntervalMs;
    decide(m, ctx);
  }
  settle(m, dtMs);
  return { mind: m, effects: noEffects() };
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

export function startGreeting(mind: PuppyMind, absenceMs: number, ctx?: PuppyContext): PuppyMind {
  const intensity = greetIntensity(absenceMs);
  if (intensity === 0) return mind;
  const m = structuredClone(mind);
  m.greet = { intensity, until: m.t + 1500 + P.greet.durationMs[intensity], nextFeatAt: Infinity, feats: [...FEATS[intensity]] };
  m.lastAloneRefAt = m.t;
  m.sulkUntil = NEVER;
  m.postureLockUntil = 0;
  enter(m, 'greet', ctx ?? { traits: { docility: 0.5, energy: 0.5, boldness: 0.5 }, affection: 30, energy: 100 });
  emit(m, intensity === 1 ? 'perk' : 'bark');
  settle(m, 0);
  return m;
}

export function handleGesture(mind: PuppyMind, g: Gesture, ctx: PuppyContext): { mind: PuppyMind; effects: Effects } {
  const m = structuredClone(mind);
  const fx = noEffects();
  m.reactionSeq++;
  m.lastAloneRefAt = m.t;
  const C = P.caress;

  switch (g.kind) {
    case 'stroke':
      m.handOnDogUntil = m.t + P.pettingHoldMs;
      m.strokeAccumPx = Math.min(C.minStrokePx, m.strokeAccumPx + g.distancePx);
      if (m.strokeAccumPx >= C.minStrokePx && m.t - m.lastCaressAt >= C.minIntervalMs) {
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
        m.curiousUntil = m.t + 1500;
        emit(m, 'perk');
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
        if (m.posture === 'lie') emit(m, 'flop');
        m.posture = 'side';
        m.happyUntil = m.t + 2500;
      } else {
        m.posture = 'lie';
      }
      m.postureLockUntil = m.t + 4000;
      m.target = null;
      m.gait = 'still';
      m.handOnDogUntil = m.t + P.pettingHoldMs;
      break;
  }

  decide(m, ctx);
  settle(m, 0);
  return { mind: m, effects: fx };
}
