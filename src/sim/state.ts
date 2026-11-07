import type { Dirt } from './chores';
/** Modèle de données sauvegardé (SPEC, Modèle de données). */

export const SAVE_VERSION = 10;

export type DogId = string;
export type ItemId = string;
export type { TrickId } from '../data/tricks';
import type { TrickId } from '../data/tricks';
export type BreedId = string;
export type ContestId = 'disc' | 'agility' | 'obedience';
export type Sex = 'f' | 'm';
export type TemperamentId = 'sage' | 'joueur' | 'timide' | 'tetu';
export type ContestClass = 0 | 1 | 2 | 3 | 4;
/** Décor du salon (déblocages à 6 000 et 18 000 points). */
export type DecorId = 'home' | 'seaside' | 'space';

/** Empreinte vocale : suite de vecteurs MFCC (jalon 4). */
export type VoiceTemplate = number[][];

export interface CoatParams {
  /** Indice de la robe dans la race. */
  base: number;
  /** Variation de teinte, de −1 à 1. */
  patch: number;
  /** Taille des taches, de 0,6 à 1,2. */
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
  sex: Sex;
  /** Étiquette visible du tempérament (F-ADO-2). */
  temperament: TemperamentId;
  traits: { docility: number; energy: number; boldness: number };
  /** D-82 : fun = amusement. */
  needs: { hunger: number; thirst: number; cleanliness: number; energy: number; fun: number };
  affection: number;
  stamina: number;
  tricks: LearnedTrick[];
  contestClass: Record<ContestId, ContestClass>;
  trophies: Trophy[];
  /** D-103 : meilleurs scores à l'entraînement libre (parc : disque, gymnase : agilité). */
  bests?: Partial<Record<'disc' | 'agility', number>>;
  voiceName?: VoiceTemplate[];
  equipped: ItemId[];
  /** F-JEU-4 : nombre d'approches de chaque sorte d'objet. */
  familiar: Record<ItemId, number>;
  /** F-PRO-7 : dernière promenade avec gains. */
  walks: { lastRewardedAt: number | null; count: number };
  /** D-78 : expérience du chiot. */
  xp: number;
  /** D-74 : dernière fois qu'il a fait ses besoins (promenade terminée ou au salon). */
  lastReliefAt: number;
  /** Lieux visités en promenade (F-CON : un concours s'ouvre après une visite). */
  visited: { park: boolean; gym: boolean; market: boolean };
}

/** D-98 : un petit tas de terre ; `item` : le trésor qu'il cache (ou rien). */
export interface GardenSpot {
  id: string;
  pos: { x: number; z: number };
  item: ItemId | null;
  dug: boolean;
}

export interface Poop {
  id: string;
  dogId: DogId;
  pos: { x: number; z: number };
  at: number;
  /** Resté trop longtemps : les points sont déjà retirés, des mouches tournent. */
  forgotten: boolean;
}

export interface DogDailyCounters {
  masterPoints: number;
  caresses: number;
  newTricks: number;
  prizeContests: number;
  /** D-78 : XP des soins gagnée aujourd'hui (plafonnée). */
  careXp?: number;
  /** D-87 : XP de soins déjà donnée au chiot aujourd’hui. */
  dogCareXp?: number;
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
  decor: DecorId;
  /** D-72 : de 0 (nuit sombre) à 1 (pas de voile de nuit). */
  brightness: number;
}

export interface SaveGame {
  version: number;
  createdAt: number;
  /** Horloge la plus récente jamais vue. */
  lastSeenAt: number;
  coins: number;
  masterPoints: number;
  /** D-78 : expérience du joueur. */
  xp: number;
  /** Paliers de déblocage déjà accordés (SPEC, Économie et progression). */
  unlockTier: number;
  inventory: Record<ItemId, number>;
  discovered: { items: ItemId[]; tricks: TrickId[] };
  dogs: Dog[];
  homeDogIds: DogId[];
  day: DailyCounters;
  settings: Settings;
  /** Graine du générateur, conservée pour rejouer à l'identique. */
  rngState: number;
  stats: { sessions: number };
  /** D-74 : besoins à ramasser au salon. */
  poops: Poop[];
  /** D-98 : tas de terre du jardin, tirés pour la journée `dayKey`. */
  garden: { dayKey: string; spots: GardenSpot[] };
  /** D-91 : taches du salon, et moment du dernier poil tombé. */
  dirt: Dirt[];
  dirtClockAt: number;
}
