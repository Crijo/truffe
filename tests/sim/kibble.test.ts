import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { ITEM_BY_ID } from '../../src/data/items';
import { migrate } from '../../src/save/migrations';
import { shopCatalog } from '../../src/sim/economy';
import { reduce, type GameState } from '../../src/sim/game';
import { startWithDog } from './fixtures';

const TZ = -60;
const T0 = Date.UTC(2026, 10, 7, 13, 0);
const K = BALANCE.kibble;
const stock = (s: GameState) => s.save.inventory[K.itemId] ?? 0;
const withStock = (s: GameState, n: number): GameState => ({ ...s, save: { ...s.save, inventory: { ...s.save.inventory, [K.itemId]: n } } });

describe('D-97 : les croquettes s’achètent', () => {
  it('une partie neuve commence avec un petit stock', () => {
    expect(stock(startWithDog(T0, TZ))).toBe(K.start);
  });

  it('servir une gamelle de croquettes en prend une portion ; l’eau reste gratuite', () => {
    let s = startWithDog(T0, TZ);
    s = reduce(s, { type: 'care/bowl', kind: 'food', at: null });
    expect(stock(s)).toBe(K.start - 1);
    s = reduce(s, { type: 'care/bowl', kind: 'water', at: null });
    expect(stock(s)).toBe(K.start - 1);
    expect(s.bowls.map((b) => b.kind).sort()).toEqual(['food', 'water']);
  });

  it('déplacer une gamelle pas encore mangée ne coûte rien de plus', () => {
    let s = reduce(startWithDog(T0, TZ), { type: 'care/bowl', kind: 'food', at: null });
    s = reduce(s, { type: 'care/bowl', kind: 'food', at: { x: 0.3, z: 0.7 } });
    expect(stock(s)).toBe(K.start - 1);
    expect(s.bowls).toHaveLength(1);
  });

  it('sans croquettes, pas de gamelle', () => {
    const s = reduce(withStock(startWithDog(T0, TZ), 0), { type: 'care/bowl', kind: 'food', at: null });
    expect(s.bowls).toHaveLength(0);
  });

  it('la boutique vend des sacs de plusieurs portions', () => {
    const def = ITEM_BY_ID[K.itemId];
    expect(def?.pack).toBe(K.pack);
    expect(shopCatalog().map((i) => i.id)).toContain(K.itemId);
    let s = withStock(startWithDog(T0, TZ), 0);
    const coins = s.save.coins;
    s = reduce(s, { type: 'shop/buy', itemId: K.itemId });
    expect(stock(s)).toBe(K.pack);
    expect(s.save.coins).toBe(coins - (def?.price ?? 0));
  });

  it('migration v9 → v10 : les joueurs reçoivent le stock de départ', () => {
    const s = startWithDog(T0, TZ);
    const inventory = Object.fromEntries(Object.entries(s.save.inventory).filter(([id]) => id !== K.itemId));
    const m = migrate(JSON.parse(JSON.stringify({ ...s.save, version: 9, inventory })));
    expect(m.inventory[K.itemId]).toBe(K.start);
  });
});
