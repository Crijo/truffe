import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { openSaveStore } from '../../src/save/storage';
import { createNewGame } from '../../src/sim/game';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('Sauvegarde IndexedDB', () => {
  it('retourne null sans sauvegarde', async () => {
    const s = await openSaveStore();
    expect(await s.load()).toBeNull();
  });

  it('une valeur enregistrée survit à la réouverture (rechargement)', async () => {
    const s1 = await openSaveStore();
    await s1.save({ ...createNewGame(1000, 1), coins: 42 });
    s1.close();
    const s2 = await openSaveStore();
    expect((await s2.load())?.coins).toBe(42);
  });

  it('conserve deux copies et recharge la précédente si la dernière est corrompue', async () => {
    const s = await openSaveStore();
    await s.save({ ...createNewGame(1000, 1), coins: 1 });
    await s.save({ ...createNewGame(1000, 1), coins: 2 });
    await s.writeRawForTests('current', '{tronqué');
    expect((await s.load())?.coins).toBe(1);
  });

  it('retourne null si les deux copies sont corrompues', async () => {
    const s = await openSaveStore();
    await s.save(createNewGame(1000, 1));
    await s.save(createNewGame(1000, 1));
    await s.writeRawForTests('current', 'x');
    await s.writeRawForTests('previous', { version: 999 });
    expect(await s.load()).toBeNull();
  });
});

describe('Achats et équipement après rechargement (critère du jalon 5)', () => {
  it('le sac, les pièces et les accessoires portés survivent à la réouverture', async () => {
    const { startWithDog } = await import('../sim/fixtures');
    const { reduce } = await import('../../src/sim/game');
    let s = startWithDog(Date.UTC(2026, 10, 3, 13), -60);
    s = { ...s, save: { ...s.save, coins: 1000 } };
    s = reduce(s, { type: 'shop/buy', itemId: 'bonnet' });
    s = reduce(s, { type: 'shop/buy', itemId: 'biscuit' });
    s = reduce(s, { type: 'equip', itemId: 'bonnet' });
    s = reduce(s, { type: 'market/sell', itemId: 'biscuit' });
    const s1 = await openSaveStore();
    await s1.save(s.save);
    s1.close();
    const loaded = await (await openSaveStore()).load();
    expect(loaded?.coins).toBe(s.save.coins);
    expect(loaded?.inventory.bonnet).toBe(1);
    expect(loaded?.inventory.biscuit ?? 0).toBe(0);
    expect(loaded?.dogs[0]?.equipped).toEqual(['bonnet']);
    expect(loaded?.discovered.items).toEqual(expect.arrayContaining(['bonnet', 'biscuit']));
  });
});
