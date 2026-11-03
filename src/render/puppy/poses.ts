/**
 * Postures et expressions du chiot, en unités du chiot.
 * Repère du chiot : x sur le côté, y vers le haut, z vers le museau.
 */
import type { Mood, Posture, PuppyEventType } from '../../sim/behavior';
import type { V3 } from './math';

export interface PostureDef {
  bodyY: number;
  bodyZ: number;
  pitch: number;
  roll: number;
  headUp: number;
  headFwd: number;
  /** Part du roulis du corps reprise par la tête. */
  headRollFollow: number;
  /** Pattes : avant (côté +x, côté −x), arrière (+x, −x), au sol, repère tourné du chiot. */
  feet: [V3, V3, V3, V3];
}

export const POSTURES: Record<Posture, PostureDef> = {
  stand: {
    bodyY: 0.36,
    bodyZ: 0,
    pitch: 0,
    roll: 0,
    headUp: 0.2,
    headFwd: 0.13,
    headRollFollow: 0,
    feet: [
      [0.13, 0, 0.24],
      [-0.13, 0, 0.24],
      [0.14, 0, -0.24],
      [-0.14, 0, -0.24],
    ],
  },
  sit: {
    bodyY: 0.27,
    bodyZ: -0.1,
    pitch: 0.6,
    roll: 0,
    headUp: 0.2,
    headFwd: 0.1,
    headRollFollow: 0,
    feet: [
      [0.11, 0, 0.17],
      [-0.11, 0, 0.17],
      [0.19, 0, -0.11],
      [-0.19, 0, -0.11],
    ],
  },
  lie: {
    bodyY: 0.205,
    bodyZ: 0,
    pitch: 0.04,
    roll: 0,
    headUp: 0.13,
    headFwd: 0.17,
    headRollFollow: 0,
    feet: [
      [0.12, 0.02, 0.46],
      [-0.12, 0.02, 0.46],
      [0.25, 0.02, -0.1],
      [-0.25, 0.02, -0.1],
    ],
  },
  beg: {
    bodyY: 0.48,
    bodyZ: -0.1,
    pitch: 1.2,
    roll: 0,
    headUp: 0.19,
    headFwd: 0.03,
    headRollFollow: 0,
    feet: [
      [0.1, 0.42, 0.17],
      [-0.1, 0.42, 0.17],
      [0.17, 0, -0.06],
      [-0.17, 0, -0.06],
    ],
  },
  side: {
    bodyY: 0.235,
    bodyZ: 0,
    pitch: 0,
    roll: 1.4,
    headUp: 0.05,
    headFwd: 0.2,
    headRollFollow: 0.65,
    feet: [
      [0.47, 0.17, 0.27],
      [0.44, 0.03, 0.21],
      [0.47, 0.17, -0.21],
      [0.44, 0.03, -0.28],
    ],
  },
};

/** Expression d'ensemble : ce qui rend l'humeur lisible sans texte. */
export interface Expression {
  /** −1 oreilles plaquées en arrière, 0 au repos, 1 dressées. */
  earLift: number;
  /** −1 queue rentrée, 1 dressée. */
  tailUp: number;
  wagAmp: number;
  wagHz: number;
  lids: number;
  lowLid: number;
  mouth: number;
  tongue: number;
  /** −1 sourcils tristes, 1 relevés. */
  brow: number;
  crouch: number;
  bounce: number;
  headTilt: number;
  /** Tête basse (rad, vers le bas). */
  headDrop: number;
}

export const MOODS: Record<Mood, Expression> = {
  calm: { earLift: 0, tailUp: 0.25, wagAmp: 0.3, wagHz: 1.1, lids: 0.05, lowLid: 0, mouth: 0.12, tongue: 0, brow: 0, crouch: 0, bounce: 0, headTilt: 0, headDrop: 0 },
  happy: { earLift: 0.45, tailUp: 0.65, wagAmp: 0.85, wagHz: 3.4, lids: 0, lowLid: 0.32, mouth: 0.75, tongue: 0.85, brow: 0.5, crouch: 0, bounce: 1, headTilt: 0, headDrop: -0.05 },
  content: { earLift: -0.25, tailUp: 0.3, wagAmp: 0.65, wagHz: 2, lids: 0.55, lowLid: 0.22, mouth: 0.4, tongue: 0.3, brow: 0.2, crouch: 0, bounce: 0, headTilt: 0.12, headDrop: -0.1 },
  curious: { earLift: 1, tailUp: 0.8, wagAmp: 0.12, wagHz: 1.2, lids: -0.15, lowLid: 0, mouth: 0, tongue: 0, brow: 0.9, crouch: 0, bounce: 0, headTilt: 0.3, headDrop: -0.05 },
  sulky: { earLift: -0.9, tailUp: -0.75, wagAmp: 0.03, wagHz: 0.6, lids: 0.38, lowLid: 0, mouth: 0, tongue: 0, brow: -1, crouch: 0.1, bounce: 0, headTilt: 0, headDrop: 0.4 },
  startled: { earLift: -1, tailUp: -0.45, wagAmp: 0, wagHz: 1, lids: -0.25, lowLid: 0, mouth: 0.25, tongue: 0, brow: 1, crouch: 0.35, bounce: 0, headTilt: 0, headDrop: 0.1 },
  asleep: { earLift: -0.35, tailUp: -0.3, wagAmp: 0, wagHz: 0.3, lids: 1, lowLid: 0, mouth: 0, tongue: 0, brow: 0, crouch: 0.05, bounce: 0, headTilt: 0.15, headDrop: 0.6 },
};

/** Durées des animations ponctuelles déclenchées par les événements du chiot (ms). */
export const ACT_MS: Partial<Record<PuppyEventType, number>> = {
  jump: 620,
  spin: 900,
  shake: 950,
  startle: 650,
  playBow: 1300,
  backOff: 600,
  wiggle: 800,
  bark: 300,
  yip: 230,
  whine: 1100,
  yelp: 340,
  sniff: 750,
  sniffGround: 2300,
  lick: 500,
  yawn: 1600,
  scratch: 2500,
  dig: 2500,
  howl: 2300,
  perk: 900,
  flop: 550,
  chew: 400,
  lap: 300,
  lickLips: 700,
  stretch: 1300,
  givePaw: 1600,
  roll: 1500,
  flip: 1300,
  handstand: 2300,
  playdead: 2900,
  dance: 2500,
  learned: 1400,
  progress: 800,
  confused: 1600,
  similar: 1600,
  lookAway: 900,
};
