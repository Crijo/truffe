/** Les 16 tours (SPEC, Dressage). */

/** Postures du chiot (« beg » : debout sur les pattes arrière). */
export type Posture = 'stand' | 'sit' | 'lie' | 'side' | 'beg';

export type TrickId =
  | 'sit'
  | 'down'
  | 'roll'
  | 'paw'
  | 'beg'
  | 'jump'
  | 'spin'
  | 'howl'
  | 'dig'
  | 'sniff'
  | 'bark'
  | 'scratch'
  | 'flip'
  | 'handstand'
  | 'playdead'
  | 'dance';

export type TrickCategory = 'base' | 'spontaneous' | 'combo';

export interface TrickDef {
  id: TrickId;
  /** Nom du tour, et ordre proposé par défaut. */
  label: string;
  category: TrickCategory;
  /** Combiné secret : l'ordre de base, donné dans cette posture. */
  combo?: { base: TrickId; posture: Posture };
  /** Posture du chiot après le tour. */
  endPosture?: Posture;
  durationMs: number;
}

export const TRICKS: Record<TrickId, TrickDef> = {
  sit: { id: 'sit', label: 'Assis', category: 'base', endPosture: 'sit', durationMs: 1600 },
  down: { id: 'down', label: 'Couché', category: 'base', endPosture: 'lie', durationMs: 1800 },
  roll: { id: 'roll', label: 'Roulade', category: 'base', endPosture: 'side', durationMs: 2000 },
  paw: { id: 'paw', label: 'La patte', category: 'base', endPosture: 'sit', durationMs: 1800 },
  beg: { id: 'beg', label: 'Debout', category: 'base', endPosture: 'beg', durationMs: 2200 },
  jump: { id: 'jump', label: 'Saute', category: 'base', durationMs: 1200 },
  spin: { id: 'spin', label: 'Tourne', category: 'base', durationMs: 1400 },
  howl: { id: 'howl', label: 'Chante', category: 'spontaneous', endPosture: 'sit', durationMs: 2300 },
  dig: { id: 'dig', label: 'Creuse', category: 'spontaneous', durationMs: 2500 },
  sniff: { id: 'sniff', label: 'Cherche', category: 'spontaneous', durationMs: 2300 },
  bark: { id: 'bark', label: 'Parle', category: 'spontaneous', durationMs: 1400 },
  scratch: { id: 'scratch', label: 'Gratte', category: 'spontaneous', endPosture: 'sit', durationMs: 2500 },
  flip: { id: 'flip', label: 'Salto', category: 'combo', combo: { base: 'jump', posture: 'sit' }, durationMs: 1500 },
  handstand: { id: 'handstand', label: 'Poirier', category: 'combo', combo: { base: 'beg', posture: 'lie' }, durationMs: 2400 },
  playdead: { id: 'playdead', label: 'Fais le mort', category: 'combo', combo: { base: 'roll', posture: 'side' }, endPosture: 'side', durationMs: 3000 },
  dance: { id: 'dance', label: 'Danse', category: 'combo', combo: { base: 'spin', posture: 'beg' }, endPosture: 'beg', durationMs: 2600 },
};

export const TRICK_IDS = Object.keys(TRICKS) as TrickId[];

/** Geste spontané du chiot → tour qu'il peut apprendre. */
export const SPONTANEOUS_TRICK: Partial<Record<string, TrickId>> = {
  howl: 'howl',
  dig: 'dig',
  sniffGround: 'sniff',
  bark: 'bark',
  scratch: 'scratch',
};
