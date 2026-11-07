/**
 * Dessins fournis par le joueur pour Truffe (voir ASSETS.md) : la main qui caresse et le pommeau
 * de douche. Chaque image a son point chaud : l'endroit qui doit se trouver sous le doigt.
 */
const BASE = import.meta.env.BASE_URL;

export interface Art {
  src: string;
  /** Taille affichée (px). */
  w: number;
  h: number;
  /** Point sous le doigt, en part de la taille. */
  hotX: number;
  hotY: number;
}

export const ART = {
  /** Paume sous le doigt. */
  hand: { src: `${BASE}img/main.webp`, w: 64, h: 80, hotX: 0.5, hotY: 0.6 },
  /** Le jet tombe sous le doigt, le pommeau au-dessus, à droite. */
  shower: { src: `${BASE}img/pommeau.webp`, w: 96, h: 128, hotX: 0.28, hotY: 0.78 },
} as const satisfies Record<string, Art>;

export function artImg(a: Art): string {
  return `<img src="${a.src}" alt="" width="${a.w}" height="${a.h}" draggable="false">`;
}

/** Décalage à appliquer pour que le point chaud soit sous le doigt. */
export function artOffset(a: Art): { x: number; y: number } {
  return { x: a.w * a.hotX, y: a.h * a.hotY };
}
