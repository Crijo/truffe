/** Économie (F-ECO) : boutique, brocante, points de maître plafonnés, équipement. */
import { BALANCE } from '../data/balance';
import { ITEMS, ITEM_BY_ID, type ItemDef, type ItemId } from '../data/items';
import { createRng } from './rng';
import type { DogId, SaveGame } from './state';

const E = BALANCE.economy;

/** F-ECO-3 : la boutique vend nourriture, jouets, accessoires et soins (hors objets rares). */
export function shopCatalog(): ItemDef[] {
  return ITEMS.filter((i) => i.price !== null && !i.rare && i.category !== 'found');
}

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

/** F-ECO-3 : la brocante change chaque jour (même stock toute la journée). */
export function marketStock(dayKey: string): { itemId: ItemId; price: number }[] {
  const rng = createRng(hash(`brocante-${dayKey}`));
  const pool = ITEMS.filter((i) => i.category !== 'found' || i.rare);
  const picks: ItemDef[] = [];
  while (picks.length < E.marketSize && picks.length < pool.length) {
    const it = rng.pick(pool);
    if (!picks.includes(it)) picks.push(it);
  }
  return picks.map((it) => {
    const base = it.price ?? it.resale * E.rarePriceFactor;
    const k = 1 + rng.range(-E.marketPriceVariation, E.marketPriceVariation);
    return { itemId: it.id, price: Math.max(5, Math.round((base * k) / 5) * 5) };
  });
}

/** F-ECO-2 : points de maître, plafonnés à 200 par chiot et par jour (sauf concours). */
export function awardPoints(save: SaveGame, dogId: DogId, points: number, capped = true): SaveGame {
  if (points === 0) return save;
  if (points < 0) return { ...save, masterPoints: Math.max(0, save.masterPoints + points) };
  const day = save.day.perDog[dogId] ?? { masterPoints: 0, caresses: 0, newTricks: 0, prizeContests: 0 };
  const allowed = capped ? Math.max(0, Math.min(points, E.dailyPointsCap - day.masterPoints)) : points;
  if (allowed === 0) return save;
  return {
    ...save,
    masterPoints: save.masterPoints + allowed,
    day: { ...save.day, perDog: { ...save.day.perDog, [dogId]: { ...day, masterPoints: day.masterPoints + (capped ? allowed : 0) } } },
  };
}

/** Ajoute un objet au sac et au carnet (F-ECO-4). */
export function gain(save: SaveGame, itemId: ItemId, n = 1): SaveGame {
  const discovered = save.discovered.items.includes(itemId) ? save.discovered.items : [...save.discovered.items, itemId];
  return { ...save, inventory: { ...save.inventory, [itemId]: (save.inventory[itemId] ?? 0) + n }, discovered: { ...save.discovered, items: discovered } };
}

/** Retire un objet du sac ; un accessoire porté par un chien est enlevé s'il n'en reste plus. */
export function lose(save: SaveGame, itemId: ItemId): SaveGame | null {
  const have = save.inventory[itemId] ?? 0;
  if (have <= 0) return null;
  const left = have - 1;
  return {
    ...save,
    inventory: { ...save.inventory, [itemId]: left },
    dogs: left > 0 ? save.dogs : save.dogs.map((d) => (d.equipped.includes(itemId) ? { ...d, equipped: d.equipped.filter((e) => e !== itemId) } : d)),
  };
}

export function buy(save: SaveGame, itemId: ItemId, price: number): SaveGame {
  if (!ITEM_BY_ID[itemId] || save.coins < price) return save;
  return gain({ ...save, coins: save.coins - price }, itemId);
}

export function sell(save: SaveGame, itemId: ItemId): SaveGame {
  const def = ITEM_BY_ID[itemId];
  const after = def ? lose(save, itemId) : null;
  return after && def ? { ...after, coins: after.coins + def.resale } : save;
}

/** Un accessoire par emplacement ; le remettre l'enlève. */
export function toggleEquip(save: SaveGame, dogId: DogId, itemId: ItemId): SaveGame {
  const def = ITEM_BY_ID[itemId];
  if (!def?.slot || (save.inventory[itemId] ?? 0) <= 0) return save;
  return {
    ...save,
    dogs: save.dogs.map((d) => {
      if (d.id !== dogId) return d;
      if (d.equipped.includes(itemId)) return { ...d, equipped: d.equipped.filter((e) => e !== itemId) };
      const others = d.equipped.filter((e) => ITEM_BY_ID[e]?.slot !== def.slot);
      return { ...d, equipped: [...others, itemId] };
    }),
  };
}
