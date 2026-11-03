/** Modèle de données sauvegardé (SPEC, Modèle de données). */

export const SAVE_VERSION = 1;

export type DogId = string;
export type ItemId = string;
export type TrickId = string;
export type BreedId = string;
export type ContestId = 'disc' | 'agility' | 'obedience';
export type ContestClass = 0 | 1 | 2 | 3 | 4;

/** Empreinte vocale : suite de vecteurs MFCC (jalon 4). */
export type VoiceTemplate = number[][];

export interface CoatParams {
  base: number;
  patch: number;
  patchAmount: number;
}

export interface LearnedTrick {
  trickId: TrickId;
  repetitions: number;
  learned: boolean;
  mastery: number;
  command: { label: string; voice?: VoiceTemplate[] };
}

export interface Trophy {
  contestId: ContestId;
  contestClass: ContestClass;
  place: 1 | 2 | 3;
  at: number;
}

export interface Dog {
  id: DogId;
  name: string;
  breedId: BreedId;
  coat: CoatParams;
  traits: { docility: number; energy: number; boldness: number };
  needs: { hunger: number; thirst: number; cleanliness: number; energy: number };
  affection: number;
  stamina: number;
  tricks: LearnedTrick[];
  contestClass: Record<ContestId, ContestClass>;
  trophies: Trophy[];
  voiceName?: VoiceTemplate[];
  equipped: ItemId[];
}

export interface DogDailyCounters {
  masterPoints: number;
  caresses: number;
  newTricks: number;
  prizeContests: number;
}

/** Compteurs remis à zéro à 4 h du matin, heure locale. */
export interface DailyCounters {
  /** Jour de jeu courant, « AAAA-MM-JJ ». Vide tant qu'aucun jour n'a commencé. */
  dayKey: string;
  perDog: Record<DogId, DogDailyCounters>;
}

export interface Settings {
  reduceMotion: boolean;
  musicVolume: number;
  sfxVolume: number;
  /** null : jamais demandé. */
  micAllowed: boolean | null;
}

export interface SaveGame {
  version: number;
  createdAt: number;
  /** Horloge la plus récente jamais vue. */
  lastSeenAt: number;
  coins: number;
  masterPoints: number;
  inventory: Record<ItemId, number>;
  discovered: { items: ItemId[]; tricks: TrickId[] };
  dogs: Dog[];
  homeDogIds: DogId[];
  day: DailyCounters;
  settings: Settings;
  /** Graine du générateur, conservée pour rejouer à l'identique. */
  rngState: number;
  stats: { sessions: number };
}
