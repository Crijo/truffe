/** Générateur pseudo-aléatoire à graine (mulberry32), reproductible et sérialisable. */
export interface Rng {
  /** Nombre dans [0, 1). */
  next(): number;
  /** Nombre dans [min, max). */
  range(min: number, max: number): number;
  /** Élément au hasard d'une liste non vide. */
  pick<T>(items: readonly T[]): T;
  getState(): number;
  setState(state: number): void;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    pick: (items) => {
      if (items.length === 0) throw new Error('pick sur une liste vide');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    getState: () => s,
    setState: (state) => {
      s = state >>> 0;
    },
  };
}
