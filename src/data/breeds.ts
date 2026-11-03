/**
 * Races paramétriques : une race est un jeu de mesures, de formes et de robes.
 * Unités : longueur du corps d'un chiot moyen ≈ 1 ; `size` met tout à l'échelle.
 */
export type V3 = readonly [number, number, number];
export type EarType = 'floppy' | 'erect' | 'folded';
export type TailType = 'straight' | 'otter' | 'whip' | 'bushy' | 'curl';

/** Robe : les couleurs d'un chiot. */
export interface Coat {
  id: string;
  label: string;
  fur: number;
  ear: number;
  /** Selle sur le dos, ou aucune. */
  saddle: number | null;
  chest: number;
  muzzle: number;
  /** Liste blanche sur le front. */
  blaze: boolean;
  tailTip: number | null;
  paws: number;
}

export interface BreedLook {
  id: string;
  label: string;
  /** F-ADO-4 : prix à partir du deuxième chiot. */
  price: number;
  size: number;
  /** Demi-axes du corps (largeur, hauteur, longueur). */
  body: V3;
  chest: V3;
  head: V3;
  muzzle: V3;
  /** Position du museau dans le repère de la tête. */
  muzzleAt: V3;
  nose: V3;
  eyeRadius: number;
  ear: { type: EarType; length: number; width: number };
  tail: { type: TailType; length: number; width: number };
  leg: { width: number; standHeight: number };
  coats: Coat[];
  colors: { nose: number; brow: number; outline: number };
}

const OUTLINE = 0x4a2f1f;
const CREAM = 0xfbf4e9;

const solid = (id: string, label: string, fur: number, ear: number, light: number): Coat => ({
  id,
  label,
  fur,
  ear,
  saddle: null,
  chest: light,
  muzzle: light,
  blaze: false,
  tailTip: null,
  paws: light,
});

export const BREEDS: Record<string, BreedLook> = {
  labrador: {
    id: 'labrador',
    label: 'Labrador',
    price: 800,
    size: 1.12,
    body: [0.26, 0.25, 0.43],
    chest: [0.22, 0.22, 0.18],
    head: [0.24, 0.22, 0.23],
    muzzle: [0.13, 0.1, 0.15],
    muzzleAt: [0, -0.07, 0.18],
    nose: [0.065, 0.048, 0.04],
    eyeRadius: 0.052,
    ear: { type: 'floppy', length: 0.24, width: 0.15 },
    tail: { type: 'otter', length: 0.34, width: 0.09 },
    leg: { width: 0.125, standHeight: 0.38 },
    coats: [solid('jaune', 'Sable', 0xe6c07c, 0xd4a862, 0xf3dcae), solid('noir', 'Noir', 0x34302d, 0x2a2623, 0x45403c), solid('chocolat', 'Chocolat', 0x6e4632, 0x5c3a29, 0x86593f)],
    colors: { nose: 0x2b1e1a, brow: 0x9a7a4a, outline: OUTLINE },
  },
  teckel: {
    id: 'teckel',
    label: 'Teckel',
    price: 600,
    size: 0.95,
    body: [0.19, 0.18, 0.52],
    chest: [0.165, 0.165, 0.15],
    head: [0.2, 0.18, 0.21],
    muzzle: [0.095, 0.075, 0.18],
    muzzleAt: [0, -0.055, 0.2],
    nose: [0.05, 0.04, 0.035],
    eyeRadius: 0.046,
    ear: { type: 'floppy', length: 0.27, width: 0.15 },
    tail: { type: 'whip', length: 0.32, width: 0.055 },
    leg: { width: 0.1, standHeight: 0.23 },
    coats: [
      solid('fauve', 'Fauve', 0xb9672f, 0x8f4a20, 0xcf8446),
      { id: 'noirfeu', label: 'Noir et feu', fur: 0x2d231d, ear: 0x241b16, saddle: null, chest: 0xc07a3c, muzzle: 0xc07a3c, blaze: false, tailTip: null, paws: 0xc07a3c },
    ],
    colors: { nose: 0x2b1e1a, brow: 0xc07a3c, outline: OUTLINE },
  },
  chihuahua: {
    id: 'chihuahua',
    label: 'Chihuahua',
    price: 700,
    size: 0.66,
    body: [0.2, 0.19, 0.3],
    chest: [0.17, 0.17, 0.14],
    head: [0.27, 0.245, 0.235],
    muzzle: [0.09, 0.07, 0.09],
    muzzleAt: [0, -0.075, 0.16],
    nose: [0.045, 0.035, 0.03],
    eyeRadius: 0.074,
    ear: { type: 'erect', length: 0.36, width: 0.24 },
    tail: { type: 'whip', length: 0.27, width: 0.045 },
    leg: { width: 0.08, standHeight: 0.31 },
    coats: [
      { id: 'creme', label: 'Crème', fur: 0xe3b67e, ear: 0xd9a46a, saddle: null, chest: CREAM, muzzle: 0xf0d2a6, blaze: false, tailTip: null, paws: CREAM },
      { id: 'chocolat', label: 'Chocolat', fur: 0x7a4a30, ear: 0x6a3f28, saddle: null, chest: CREAM, muzzle: 0x9a6646, blaze: true, tailTip: CREAM, paws: CREAM },
      { id: 'noirblanc', label: 'Noir et blanc', fur: 0x302b29, ear: 0x2a2523, saddle: null, chest: CREAM, muzzle: CREAM, blaze: true, tailTip: CREAM, paws: CREAM },
    ],
    colors: { nose: 0x2b1e1a, brow: 0xa0764a, outline: OUTLINE },
  },
  berger: {
    id: 'berger',
    label: 'Berger allemand',
    price: 1200,
    size: 1.3,
    body: [0.25, 0.25, 0.46],
    chest: [0.21, 0.22, 0.18],
    head: [0.22, 0.2, 0.22],
    muzzle: [0.105, 0.085, 0.2],
    muzzleAt: [0, -0.05, 0.2],
    nose: [0.06, 0.045, 0.04],
    eyeRadius: 0.048,
    ear: { type: 'erect', length: 0.3, width: 0.2 },
    tail: { type: 'bushy', length: 0.42, width: 0.12 },
    leg: { width: 0.12, standHeight: 0.42 },
    coats: [
      { id: 'noirfeu', label: 'Noir et feu', fur: 0xbd7f42, ear: 0x2c2420, saddle: 0x2a2220, chest: 0xd9a868, muzzle: 0x3a2e28, blaze: false, tailTip: 0x2a2220, paws: 0xd9a868 },
      { id: 'noir', label: 'Noir', fur: 0x2c2724, ear: 0x262220, saddle: null, chest: 0x3c3632, muzzle: 0x3c3632, blaze: false, tailTip: null, paws: 0x3c3632 },
    ],
    colors: { nose: 0x1f1714, brow: 0xd9a868, outline: OUTLINE },
  },
  carlin: {
    id: 'carlin',
    label: 'Carlin',
    price: 900,
    size: 0.82,
    body: [0.25, 0.24, 0.31],
    chest: [0.22, 0.21, 0.17],
    head: [0.255, 0.23, 0.215],
    muzzle: [0.125, 0.085, 0.05],
    muzzleAt: [0, -0.07, 0.18],
    nose: [0.06, 0.042, 0.03],
    eyeRadius: 0.072,
    ear: { type: 'folded', length: 0.13, width: 0.13 },
    tail: { type: 'curl', length: 0.22, width: 0.075 },
    leg: { width: 0.11, standHeight: 0.3 },
    coats: [
      { id: 'fauve', label: 'Fauve', fur: 0xdcbc8c, ear: 0x3a302a, saddle: null, chest: 0xe8cfa6, muzzle: 0x3a302a, blaze: false, tailTip: null, paws: 0xe8cfa6 },
      { id: 'noir', label: 'Noir', fur: 0x2e2a28, ear: 0x262220, saddle: null, chest: 0x3a3532, muzzle: 0x262220, blaze: false, tailTip: null, paws: 0x3a3532 },
    ],
    colors: { nose: 0x1f1714, brow: 0x6b5a48, outline: OUTLINE },
  },
  beagle: {
    id: 'beagle',
    label: 'Beagle',
    price: 700,
    size: 1,
    body: [0.24, 0.23, 0.4],
    chest: [0.2, 0.2, 0.17],
    head: [0.24, 0.215, 0.215],
    muzzle: [0.12, 0.095, 0.12],
    muzzleAt: [0, -0.07, 0.16],
    nose: [0.06, 0.045, 0.04],
    eyeRadius: 0.058,
    ear: { type: 'floppy', length: 0.34, width: 0.16 },
    tail: { type: 'straight', length: 0.3, width: 0.065 },
    leg: { width: 0.115, standHeight: 0.36 },
    coats: [
      { id: 'tricolore', label: 'Tricolore', fur: 0xcf9152, ear: 0x9c6436, saddle: 0x3d2c23, chest: CREAM, muzzle: CREAM, blaze: true, tailTip: CREAM, paws: CREAM },
      { id: 'citron', label: 'Citron', fur: 0xdcb276, ear: 0xc49656, saddle: null, chest: CREAM, muzzle: CREAM, blaze: true, tailTip: CREAM, paws: CREAM },
    ],
    colors: { nose: 0x2b1e1a, brow: 0x8a5631, outline: OUTLINE },
  },
  husky: {
    id: 'husky',
    label: 'Husky',
    price: 1400,
    size: 1.22,
    body: [0.25, 0.25, 0.44],
    chest: [0.21, 0.22, 0.18],
    head: [0.23, 0.21, 0.22],
    muzzle: [0.105, 0.085, 0.17],
    muzzleAt: [0, -0.055, 0.19],
    nose: [0.058, 0.044, 0.038],
    eyeRadius: 0.05,
    ear: { type: 'erect', length: 0.24, width: 0.19 },
    tail: { type: 'curl', length: 0.36, width: 0.12 },
    leg: { width: 0.118, standHeight: 0.4 },
    coats: [
      { id: 'grisblanc', label: 'Gris et blanc', fur: 0x8d939a, ear: 0x6c7279, saddle: 0x4f555c, chest: CREAM, muzzle: CREAM, blaze: true, tailTip: CREAM, paws: CREAM },
      { id: 'noirblanc', label: 'Noir et blanc', fur: 0x3a3836, ear: 0x2e2c2a, saddle: 0x24221f, chest: CREAM, muzzle: CREAM, blaze: true, tailTip: CREAM, paws: CREAM },
      { id: 'cuivre', label: 'Cuivre et blanc', fur: 0xb8703d, ear: 0x9a5a2e, saddle: null, chest: CREAM, muzzle: CREAM, blaze: true, tailTip: CREAM, paws: CREAM },
    ],
    colors: { nose: 0x1f1714, brow: 0xe9e4dc, outline: OUTLINE },
  },
  caniche: {
    id: 'caniche',
    label: 'Caniche',
    price: 1300,
    size: 0.9,
    body: [0.22, 0.23, 0.34],
    chest: [0.2, 0.21, 0.16],
    head: [0.24, 0.24, 0.22],
    muzzle: [0.095, 0.08, 0.15],
    muzzleAt: [0, -0.06, 0.18],
    nose: [0.05, 0.04, 0.035],
    eyeRadius: 0.054,
    ear: { type: 'floppy', length: 0.3, width: 0.19 },
    tail: { type: 'bushy', length: 0.22, width: 0.11 },
    leg: { width: 0.1, standHeight: 0.4 },
    coats: [solid('abricot', 'Abricot', 0xe0a46a, 0xd08f55, 0xeab988), solid('blanc', 'Blanc', 0xf4efe6, 0xe9e1d3, 0xfbf7f0), solid('noir', 'Noir', 0x2f2b29, 0x272321, 0x3a3532)],
    colors: { nose: 0x2b1e1a, brow: 0xb98a5a, outline: OUTLINE },
  },
  corgi: {
    id: 'corgi',
    label: 'Corgi',
    price: 1500,
    size: 0.92,
    body: [0.24, 0.21, 0.46],
    chest: [0.21, 0.2, 0.16],
    head: [0.23, 0.21, 0.21],
    muzzle: [0.105, 0.08, 0.14],
    muzzleAt: [0, -0.06, 0.18],
    nose: [0.055, 0.042, 0.036],
    eyeRadius: 0.054,
    ear: { type: 'erect', length: 0.32, width: 0.23 },
    tail: { type: 'bushy', length: 0.2, width: 0.11 },
    leg: { width: 0.11, standHeight: 0.22 },
    coats: [
      { id: 'roux', label: 'Roux et blanc', fur: 0xd0803e, ear: 0xb86a2e, saddle: null, chest: CREAM, muzzle: CREAM, blaze: true, tailTip: null, paws: CREAM },
      { id: 'tricolore', label: 'Tricolore', fur: 0xc2783e, ear: 0x9c5e30, saddle: 0x3a2c24, chest: CREAM, muzzle: CREAM, blaze: true, tailTip: null, paws: CREAM },
    ],
    colors: { nose: 0x1f1714, brow: 0xe8b583, outline: OUTLINE },
  },
  dalmatien: {
    id: 'dalmatien',
    label: 'Dalmatien',
    price: 2000,
    size: 1.18,
    body: [0.24, 0.24, 0.44],
    chest: [0.2, 0.21, 0.17],
    head: [0.22, 0.205, 0.22],
    muzzle: [0.11, 0.09, 0.17],
    muzzleAt: [0, -0.06, 0.18],
    nose: [0.058, 0.044, 0.038],
    eyeRadius: 0.052,
    ear: { type: 'floppy', length: 0.25, width: 0.15 },
    tail: { type: 'whip', length: 0.36, width: 0.06 },
    leg: { width: 0.11, standHeight: 0.42 },
    coats: [
      { id: 'noir', label: 'Taches noires', fur: 0xf6f3ee, ear: 0x2e2a28, saddle: 0x2e2a28, chest: 0xfbf8f3, muzzle: 0xf6f3ee, blaze: false, tailTip: 0x2e2a28, paws: 0xfbf8f3 },
      { id: 'foie', label: 'Taches foie', fur: 0xf6f1ea, ear: 0x7a4a32, saddle: 0x7a4a32, chest: 0xfbf8f3, muzzle: 0xf6f1ea, blaze: false, tailTip: 0x7a4a32, paws: 0xfbf8f3 },
    ],
    colors: { nose: 0x1f1714, brow: 0x9a948c, outline: OUTLINE },
  },
};

/** F-ADO-1 : les 6 races de départ, dans l'ordre du chenil. */
export const STARTER_BREEDS = ['labrador', 'teckel', 'chihuahua', 'berger', 'carlin', 'beagle'] as const;

/** Races débloquées par les points de maître (n° 7, 8, 9 et la race secrète). */
export const UNLOCK_BREEDS = ['husky', 'caniche', 'corgi', 'dalmatien'] as const;

/** Robe d'un chiot, nuancée par sa variation de teinte. */
export function coatOf(breed: BreedLook, base: number): Coat {
  return breed.coats[base] ?? breed.coats[0] ?? solid('x', '?', 0xcf9152, 0x9c6436, CREAM);
}
