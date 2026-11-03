/**
 * Objets de Truffe (F-ECO-3, F-ECO-4), tous créés pour le projet :
 * aucun nom, objet ou logo de marque.
 */
export type ItemCategory = 'food' | 'toy' | 'accessory' | 'care' | 'found' | 'furniture';
export type ItemId = string;
export type EquipSlot = 'collar' | 'neck' | 'head' | 'eyes';
/** Gabarit de dessin de l'icône (voir ui/itemIcon.ts). */
export type ItemShape =
  | 'can'
  | 'biscuit'
  | 'bone'
  | 'bottle'
  | 'cheese'
  | 'ball'
  | 'disc'
  | 'ring'
  | 'rope'
  | 'collar'
  | 'bandana'
  | 'hat'
  | 'strawhat'
  | 'bow'
  | 'glasses'
  | 'crown'
  | 'shampoo'
  | 'brush'
  | 'spray'
  | 'cone'
  | 'shell'
  | 'feather'
  | 'stone'
  | 'key'
  | 'button'
  | 'leaf'
  | 'acorn'
  | 'marble'
  | 'bell'
  | 'card'
  | 'star'
  | 'flower'
  | 'bigball'
  | 'mouse'
  | 'sofa';

export interface ItemDef {
  id: ItemId;
  label: string;
  category: ItemCategory;
  shape: ItemShape;
  colors: [number, number];
  /** Prix en boutique ; null : introuvable en boutique. */
  price: number | null;
  /** Rachat à la brocante. */
  resale: number;
  /** Seulement à la brocante ou en promenade. */
  rare?: boolean;
  /** Offert par un déblocage de points de maître (ni boutique, ni brocante). */
  unlock?: boolean;
  /** Jouet plus gros que les autres. */
  big?: boolean;
  /** Jouet mécanique : il roule tout seul un moment. */
  motor?: boolean;
  slot?: EquipSlot;
  /** Jouet : sorte de jouet lancé. */
  toyKind?: 'ball' | 'disc' | 'rope';
  /** Nourriture : ce qu'elle apporte. */
  food?: { hunger?: number; thirst?: number; treat?: boolean };
}

const it = (d: ItemDef): ItemDef => d;

export const ITEMS: ItemDef[] = [
  // Nourriture.
  it({ id: 'patee', label: 'Pâtée tendre', category: 'food', shape: 'can', colors: [0xc0604a, 0xf2e2c4], price: 60, resale: 20, food: { hunger: 60 } }),
  it({ id: 'biscuit', label: 'Biscuit croquant', category: 'food', shape: 'biscuit', colors: [0xd9a05b, 0x9c6b2f], price: 20, resale: 8, food: { hunger: 10, treat: true } }),
  it({ id: 'os', label: 'Os à mâcher', category: 'food', shape: 'bone', colors: [0xf3e7cf, 0xb99a6a], price: 40, resale: 15, food: { hunger: 15, treat: true } }),
  it({ id: 'lait', label: 'Lait pour chiot', category: 'food', shape: 'bottle', colors: [0xf8f6f0, 0x6aa6d8], price: 30, resale: 10, food: { thirst: 40 } }),
  it({ id: 'fromage', label: 'Friandise au fromage', category: 'food', shape: 'cheese', colors: [0xf2c94c, 0xd9a520], price: 25, resale: 9, food: { hunger: 8, treat: true } }),
  // Jouets.
  it({ id: 'balle-pois', label: 'Balle à pois', category: 'toy', shape: 'ball', colors: [0x3f86c6, 0xfff3dc], price: 80, resale: 30, toyKind: 'ball' }),
  it({ id: 'balle-feutre', label: 'Balle feutrée', category: 'toy', shape: 'ball', colors: [0xc7d94f, 0xf8f8e8], price: 70, resale: 25, toyKind: 'ball' }),
  it({ id: 'disque-etoile', label: 'Disque étoilé', category: 'toy', shape: 'disc', colors: [0xe4572e, 0xffd166], price: 120, resale: 45, toyKind: 'disc' }),
  it({ id: 'anneau', label: 'Anneau souple', category: 'toy', shape: 'ring', colors: [0x7cc47f, 0x3e7c46], price: 90, resale: 35, toyKind: 'disc' }),
  it({ id: 'corde-noeuds', label: 'Corde à trois nœuds', category: 'toy', shape: 'rope', colors: [0xb04a8b, 0xf2d7e8], price: 90, resale: 35, toyKind: 'rope' }),
  // Accessoires.
  it({ id: 'collier-rouge', label: 'Collier rouge', category: 'accessory', shape: 'collar', colors: [0xd23b3b, 0xf2c94c], price: 150, resale: 60, slot: 'collar' }),
  it({ id: 'collier-cuir', label: 'Collier en cuir', category: 'accessory', shape: 'collar', colors: [0x7a4a2a, 0xd9c08a], price: 220, resale: 90, slot: 'collar' }),
  it({ id: 'foulard-vert', label: 'Foulard vert', category: 'accessory', shape: 'bandana', colors: [0x3f9a5a, 0xfaf3e6], price: 120, resale: 45, slot: 'neck' }),
  it({ id: 'foulard-carreaux', label: 'Foulard à carreaux', category: 'accessory', shape: 'bandana', colors: [0x2f5d9a, 0xe8564a], price: 140, resale: 55, slot: 'neck' }),
  it({ id: 'bonnet', label: 'Bonnet de laine', category: 'accessory', shape: 'hat', colors: [0xe8564a, 0xfaf3e6], price: 200, resale: 80, slot: 'head' }),
  it({ id: 'chapeau-paille', label: 'Chapeau de paille', category: 'accessory', shape: 'strawhat', colors: [0xe8c26a, 0xc0392b], price: 260, resale: 100, slot: 'head' }),
  it({ id: 'noeud-rose', label: 'Nœud rose', category: 'accessory', shape: 'bow', colors: [0xf28ab2, 0xc2547f], price: 90, resale: 35, slot: 'head' }),
  it({ id: 'noeud-bleu', label: 'Nœud bleu ciel', category: 'accessory', shape: 'bow', colors: [0x7fc4f0, 0x3f86c6], price: 90, resale: 35, slot: 'head' }),
  it({ id: 'lunettes-rondes', label: 'Lunettes rondes', category: 'accessory', shape: 'glasses', colors: [0x2b2320, 0x9fd3f2], price: 300, resale: 120, slot: 'eyes' }),
  it({ id: 'couronne-fleurs', label: 'Couronne de fleurs', category: 'accessory', shape: 'crown', colors: [0xf7b2c4, 0x7cc47f], price: null, resale: 160, rare: true, slot: 'head' }),
  // Soins.
  it({ id: 'shampooing-doux', label: 'Shampooing doux', category: 'care', shape: 'shampoo', colors: [0x9fd3c7, 0xfaf3e6], price: 80, resale: 30 }),
  it({ id: 'brosse-douce', label: 'Brosse douce', category: 'care', shape: 'brush', colors: [0xb98ad9, 0xf3e7cf], price: 110, resale: 40 }),
  it({ id: 'eau-lavande', label: 'Eau de lavande', category: 'care', shape: 'spray', colors: [0xa98ad9, 0xe8e0f5], price: 130, resale: 50 }),
  // Trouvailles de promenade.
  it({ id: 'pomme-pin', label: 'Pomme de pin', category: 'found', shape: 'cone', colors: [0x8a5a2e, 0xc08a4a], price: null, resale: 12 }),
  it({ id: 'coquillage', label: 'Coquillage', category: 'found', shape: 'shell', colors: [0xf7d6c4, 0xd9a08a], price: null, resale: 25 }),
  it({ id: 'plume-bleue', label: 'Plume bleue', category: 'found', shape: 'feather', colors: [0x3f86c6, 0xb9dcf5], price: null, resale: 30 }),
  it({ id: 'caillou-brillant', label: 'Caillou brillant', category: 'found', shape: 'stone', colors: [0x9aa8b0, 0xffffff], price: null, resale: 18 }),
  it({ id: 'cle-ancienne', label: 'Clé ancienne', category: 'found', shape: 'key', colors: [0xc9a23c, 0x8a6a1a], price: null, resale: 80, rare: true }),
  it({ id: 'bouton-dore', label: 'Bouton doré', category: 'found', shape: 'button', colors: [0xe8c24a, 0xa8842a], price: null, resale: 40 }),
  it({ id: 'feuille-erable', label: 'Feuille d’érable', category: 'found', shape: 'leaf', colors: [0xe4572e, 0xf2a03d], price: null, resale: 10 }),
  it({ id: 'gland', label: 'Gland', category: 'found', shape: 'acorn', colors: [0xa8743f, 0x6b4a2a], price: null, resale: 10 }),
  it({ id: 'bille-verre', label: 'Bille de verre', category: 'found', shape: 'marble', colors: [0x5fb8a8, 0xffffff], price: null, resale: 35 }),
  it({ id: 'clochette', label: 'Petite clochette', category: 'found', shape: 'bell', colors: [0xe8c24a, 0x8a6a1a], price: null, resale: 45 }),
  it({ id: 'carte-postale', label: 'Carte postale', category: 'found', shape: 'card', colors: [0xf8f1e4, 0x3f86c6], price: null, resale: 50, rare: true }),
  it({ id: 'etoile-mer', label: 'Étoile de mer', category: 'found', shape: 'star', colors: [0xf2a03d, 0xd9672e], price: null, resale: 60, rare: true }),
  it({ id: 'marguerite', label: 'Marguerite', category: 'found', shape: 'flower', colors: [0xffffff, 0xf2c94c], price: null, resale: 8 }),
  // Déblocages (SPEC, Économie et progression).
  it({ id: 'ballon', label: 'Gros ballon', category: 'toy', shape: 'bigball', colors: [0xe8564a, 0xffffff], price: null, resale: 40, unlock: true, big: true, toyKind: 'ball' }),
  it({ id: 'canape', label: 'Petit canapé', category: 'furniture', shape: 'sofa', colors: [0x5f8fb0, 0xf2e2c4], price: null, resale: 150, unlock: true }),
  it({ id: 'souris-meca', label: 'Souris mécanique', category: 'toy', shape: 'mouse', colors: [0x9aa3ab, 0xf28ab2], price: null, resale: 90, unlock: true, motor: true, toyKind: 'ball' }),
];

export const ITEM_BY_ID: Record<ItemId, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Objets qu'on peut trouver en promenade (F-PRO-4, F-PRO-5). */
export const FINDABLE: ItemId[] = ITEMS.filter((i) => i.category === 'found' || i.id === 'os' || i.id === 'biscuit').map((i) => i.id);
