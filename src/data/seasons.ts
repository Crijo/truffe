/** D-77 : couleurs et effets de chaque saison (dessinés par le code, voir ASSETS.md). */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonLook {
  sky: number;
  /** Feuillage des arbres ; vide : arbres nus (hiver). */
  foliage: readonly number[];
  /** Petites fleurs ou fruits sur les arbres. */
  dots: number | null;
  trunk: number;
  hills: number;
  grass: number;
  grassLine: number;
  /** Neige sur les toits et au sol. */
  snow: boolean;
  /** Ce qui tombe du ciel. */
  falling: 'petals' | 'leaves' | 'snow' | null;
  fallingColors: readonly number[];
}

export const SEASONS: Record<Season, SeasonLook> = {
  spring: {
    sky: 0xd4ecf5,
    foliage: [0x8fd08a, 0x7cc47f],
    dots: 0xf7b6c8,
    trunk: 0x8a5a2e,
    hills: 0xb1d89c,
    grass: 0x93c97c,
    grassLine: 0x83b96d,
    snow: false,
    falling: 'petals',
    fallingColors: [0xf7c6d4, 0xfbe0e8],
  },
  summer: {
    sky: 0xcfe6f2,
    foliage: [0x7cc47f, 0x6bb46f],
    dots: null,
    trunk: 0x8a5a2e,
    hills: 0xa9cf9a,
    grass: 0x8cc27a,
    grassLine: 0x7db36b,
    snow: false,
    falling: null,
    fallingColors: [],
  },
  autumn: {
    sky: 0xe6dccb,
    foliage: [0xe08a3c, 0xd2603a, 0xe8b44a, 0xb8873a],
    dots: null,
    trunk: 0x7a4e2a,
    hills: 0xc9b77e,
    grass: 0xa9b56a,
    grassLine: 0x98a45c,
    snow: false,
    falling: 'leaves',
    fallingColors: [0xe08a3c, 0xd2603a, 0xe8b44a],
  },
  winter: {
    sky: 0xdfe8ef,
    foliage: [],
    dots: null,
    trunk: 0x6e4a2c,
    hills: 0xe9eef2,
    grass: 0xc9d6c4,
    grassLine: 0xb7c6b2,
    snow: true,
    falling: 'snow',
    fallingColors: [0xffffff],
  },
};

export const SEASON_NAMES: Record<Season, string> = { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' };
