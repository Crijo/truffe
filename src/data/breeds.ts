/**
 * Races paramétriques : une race est un jeu de mesures et de couleurs.
 * Unités : longueur du corps d'un chiot moyen ≈ 1.
 */
export type V3 = readonly [number, number, number];

export interface BreedLook {
  id: string;
  label: string;
  /** Demi-axes du corps (largeur, hauteur, longueur). */
  body: V3;
  chest: V3;
  head: V3;
  muzzle: V3;
  /** Position du museau dans le repère de la tête. */
  muzzleAt: V3;
  nose: V3;
  eyeRadius: number;
  ear: { length: number; width: number; floppy: boolean };
  tail: { length: number; width: number };
  leg: { width: number; standHeight: number };
  colors: {
    fur: number;
    saddle: number | null;
    white: number;
    ear: number;
    nose: number;
    brow: number;
    outline: number;
  };
}

export const BREEDS: Record<string, BreedLook> = {
  beagle: {
    id: 'beagle',
    label: 'Beagle',
    body: [0.24, 0.23, 0.4],
    chest: [0.2, 0.2, 0.17],
    head: [0.24, 0.215, 0.215],
    muzzle: [0.12, 0.095, 0.12],
    muzzleAt: [0, -0.07, 0.16],
    nose: [0.06, 0.045, 0.04],
    eyeRadius: 0.058,
    ear: { length: 0.34, width: 0.16, floppy: true },
    tail: { length: 0.3, width: 0.065 },
    leg: { width: 0.115, standHeight: 0.36 },
    colors: {
      fur: 0xcf9152,
      saddle: 0x3d2c23,
      white: 0xfbf4e9,
      ear: 0x9c6436,
      nose: 0x2b1e1a,
      brow: 0x8a5631,
      outline: 0x4a2f1f,
    },
  },
};
