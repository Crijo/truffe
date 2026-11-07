import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { ITEMS, ITEM_BY_ID } from '../../src/data/items';
import { marketStock, shopCatalog } from '../../src/sim/economy';
import { reduce, type GameState } from '../../src/sim/game';
import { startWithDog } from './fixtures';

const T0 = Date.UTC(2026, 10, 3, 13, 0);
const TZ = -60;
const DAY = 24 * 3_600_000;

const dog = (s: GameState) => {
  const d = s.save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};
const rich = (): GameState => {
  const s = startWithDog(T0, TZ);
  return { ...s, save: { ...s.save, coins: 2000 } };
};

describe('Objets (critère : au moins 30, aucun objet de marque)', () => {
  it('au moins 30 objets, identifiants uniques, toutes les catégories', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const c of ['food', 'toy', 'accessory', 'care', 'found']) expect(ITEMS.some((i) => i.category === c)).toBe(true);
  });

  it('aucun nom de marque', () => {
    const brands = /kong|frisbee|nerf|wham|purina|pedigree|royal canin|disney|lego|barbie|adidas|nike|gucci|ray-?ban/i;
    for (const i of ITEMS) expect(i.label).not.toMatch(brands);
  });

  it('chaque objet se revend (sauf les croquettes, D-97), et la boutique vend nourriture, jouets, accessoires et soins', () => {
    for (const i of ITEMS.filter((x) => !x.pack)) expect(i.resale).toBeGreaterThan(0);
    const cats = new Set(shopCatalog().map((i) => i.category));
    expect(cats).toEqual(new Set(['food', 'toy', 'accessory', 'care']));
  });
});

describe('F-ECO-3 : boutique', () => {
  it('acheter retire les pièces et ajoute l’objet au sac et au carnet', () => {
    let s = rich();
    s = reduce(s, { type: 'shop/buy', itemId: 'bonnet' });
    expect(s.save.coins).toBe(2000 - (ITEM_BY_ID.bonnet?.price ?? 0));
    expect(s.save.inventory.bonnet).toBe(1);
    expect(s.save.discovered.items).toContain('bonnet');
  });

  it('sans assez de pièces, rien ne se passe', () => {
    let s = startWithDog(T0, TZ);
    s = { ...s, save: { ...s.save, coins: 10 } };
    s = reduce(s, { type: 'shop/buy', itemId: 'bonnet' });
    expect(s.save.coins).toBe(10);
    expect(s.save.inventory.bonnet ?? 0).toBe(0);
  });

  it('un objet rare ne se trouve pas en boutique', () => {
    let s = rich();
    s = reduce(s, { type: 'shop/buy', itemId: 'couronne-fleurs' });
    expect(s.save.inventory['couronne-fleurs'] ?? 0).toBe(0);
  });

  it('les nouvelles parties ont des pièces de bienvenue', () => {
    expect(startWithDog(T0, TZ).save.coins).toBe(BALANCE.economy.welcomeCoins);
  });
});

describe('F-ECO-3 : brocante', () => {
  it('le stock change chaque jour, et reste le même toute la journée', () => {
    expect(marketStock('20000')).toEqual(marketStock('20000'));
    expect(marketStock('20000')).toHaveLength(BALANCE.economy.marketSize);
    expect(marketStock('20000')).not.toEqual(marketStock('20001'));
  });

  it('elle vend parfois des objets rares', () => {
    const rare = new Set<string>();
    for (let d = 0; d < 60; d++) for (const o of marketStock(String(20000 + d))) if (ITEM_BY_ID[o.itemId]?.rare) rare.add(o.itemId);
    expect(rare.size).toBeGreaterThan(0);
  });

  it('acheter à la brocante, au prix du jour', () => {
    let s = rich();
    const offer = marketStock(s.save.day.dayKey)[0];
    if (!offer) throw new Error('brocante vide');
    s = reduce(s, { type: 'market/buy', itemId: offer.itemId });
    expect(s.save.coins).toBe(2000 - offer.price);
    expect(s.save.inventory[offer.itemId]).toBe(1);
  });

  it('un objet absent du stock du jour ne s’achète pas', () => {
    let s = rich();
    const stock = marketStock(s.save.day.dayKey).map((o) => o.itemId);
    const other = ITEMS.find((i) => !stock.includes(i.id));
    s = reduce(s, { type: 'market/buy', itemId: other?.id ?? '' });
    expect(s.save.coins).toBe(2000);
  });

  it('elle rachète les objets', () => {
    let s = rich();
    s = reduce(s, { type: 'shop/buy', itemId: 'bonnet' });
    const coins = s.save.coins;
    s = reduce(s, { type: 'market/sell', itemId: 'bonnet' });
    expect(s.save.coins).toBe(coins + (ITEM_BY_ID.bonnet?.resale ?? 0));
    expect(s.save.inventory.bonnet ?? 0).toBe(0);
    expect(s.save.discovered.items).toContain('bonnet');
    s = reduce(s, { type: 'market/sell', itemId: 'bonnet' });
    expect(s.save.coins).toBe(coins + (ITEM_BY_ID.bonnet?.resale ?? 0));
  });
});

describe('Équiper', () => {
  it('un accessoire par emplacement ; en remettre un autre remplace le premier', () => {
    let s = rich();
    s = reduce(s, { type: 'shop/buy', itemId: 'bonnet' });
    s = reduce(s, { type: 'shop/buy', itemId: 'chapeau-paille' });
    s = reduce(s, { type: 'shop/buy', itemId: 'collier-rouge' });
    s = reduce(s, { type: 'equip', itemId: 'bonnet' });
    s = reduce(s, { type: 'equip', itemId: 'collier-rouge' });
    expect(dog(s).equipped.sort()).toEqual(['bonnet', 'collier-rouge']);
    s = reduce(s, { type: 'equip', itemId: 'chapeau-paille' });
    expect(dog(s).equipped.sort()).toEqual(['chapeau-paille', 'collier-rouge']);
    s = reduce(s, { type: 'equip', itemId: 'chapeau-paille' });
    expect(dog(s).equipped).toEqual(['collier-rouge']);
  });

  it('on ne peut pas équiper ce qu’on n’a pas, ni ce qui ne se porte pas', () => {
    let s = rich();
    s = reduce(s, { type: 'equip', itemId: 'bonnet' });
    expect(dog(s).equipped).toEqual([]);
    s = reduce(s, { type: 'shop/buy', itemId: 'biscuit' });
    s = reduce(s, { type: 'equip', itemId: 'biscuit' });
    expect(dog(s).equipped).toEqual([]);
  });

  it('revendre un accessoire porté l’enlève', () => {
    let s = rich();
    s = reduce(s, { type: 'shop/buy', itemId: 'bonnet' });
    s = reduce(s, { type: 'equip', itemId: 'bonnet' });
    s = reduce(s, { type: 'market/sell', itemId: 'bonnet' });
    expect(dog(s).equipped).toEqual([]);
  });
});

describe('Nourriture du sac', () => {
  it('une friandise se donne et s’use', () => {
    let s = rich();
    s = reduce(s, { type: 'shop/buy', itemId: 'biscuit' });
    s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, needs: { ...d.needs, hunger: 50 } })) } };
    s = reduce(s, { type: 'use', itemId: 'biscuit' });
    expect(s.save.inventory.biscuit ?? 0).toBe(0);
    expect(dog(s).needs.hunger).toBeCloseTo(60, 0);
    expect(s.minds[dog(s).id]?.events.map((e) => e.type)).toContain('treat');
  });

  it('la pâtée se pose en gamelle et nourrit davantage', () => {
    let s = rich();
    s = reduce(s, { type: 'shop/buy', itemId: 'patee' });
    s = reduce(s, { type: 'use', itemId: 'patee', at: { x: 0.3, z: 0.7 } });
    expect(s.bowls.find((b) => b.kind === 'food')?.meal).toBe(ITEM_BY_ID.patee?.food?.hunger);
    expect(s.save.inventory.patee ?? 0).toBe(0);
  });
});

describe('Le jour suivant', () => {
  it('la brocante a changé', () => {
    let s = rich();
    const before = marketStock(s.save.day.dayKey);
    s = reduce(s, { type: 'session/resume', now: s.save.lastSeenAt + DAY, tzOffsetMin: TZ });
    expect(marketStock(s.save.day.dayKey)).not.toEqual(before);
  });
});
