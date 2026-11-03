import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { BREEDS, STARTER_BREEDS } from '../../src/data/breeds';
import { adoptionPrice, rollLitter, validateName } from '../../src/sim/adoption';
import { createGameState, createNewGame, reduce, type GameState } from '../../src/sim/game';
import { createRng } from '../../src/sim/rng';

const T0 = Date.UTC(2026, 10, 3, 13, 0);
const TZ = -60;
const start = (): GameState => reduce(createGameState(createNewGame(T0, 7)), { type: 'session/start', now: T0, tzOffsetMin: TZ });

describe('F-ADO-1 : le chenil', () => {
  it('6 races de départ', () => {
    expect(STARTER_BREEDS).toEqual(['labrador', 'teckel', 'chihuahua', 'berger', 'carlin', 'beagle']);
    for (const id of STARTER_BREEDS) expect(BREEDS[id]).toBeDefined();
  });

  it('3 chiots tirés au hasard pour la race choisie', () => {
    for (const breed of STARTER_BREEDS) {
      const litter = rollLitter(createRng(1), breed);
      expect(litter).toHaveLength(BALANCE.adoption.litterSize);
      expect(litter.every((c) => c.breedId === breed)).toBe(true);
    }
  });

  it('reproductible à partir d’une graine, variée d’une graine à l’autre', () => {
    expect(rollLitter(createRng(5), 'beagle')).toEqual(rollLitter(createRng(5), 'beagle'));
    const many = new Set<string>();
    for (let s = 1; s < 30; s++) for (const c of rollLitter(createRng(s), 'labrador')) many.add(`${c.coat.base}-${c.sex}-${c.temperament}`);
    expect(many.size).toBeGreaterThan(6);
  });

  it('au premier lancement, aucun chiot n’est imposé : le chenil s’ouvre', () => {
    const s = start();
    expect(s.save.dogs).toHaveLength(0);
    expect(Object.keys(s.minds)).toHaveLength(0);
  });
});

describe('F-ADO-2 : race, pelage, sexe, tempérament visible', () => {
  it('chaque chiot a tout cela, et des traits à ±0,1 de son étiquette', () => {
    for (let seed = 1; seed < 40; seed++) {
      for (const c of rollLitter(createRng(seed), 'berger')) {
        const breed = BREEDS.berger;
        expect(c.coat.base).toBeGreaterThanOrEqual(0);
        expect(c.coat.base).toBeLessThan(breed?.coats.length ?? 0);
        expect(['f', 'm']).toContain(c.sex);
        expect(['sage', 'joueur', 'timide', 'tetu']).toContain(c.temperament);
        const ref = BALANCE.temperaments[c.temperament];
        for (const k of ['docility', 'energy', 'boldness'] as const) expect(Math.abs(c.traits[k] - ref[k])).toBeLessThanOrEqual(0.1 + 1e-9);
      }
    }
  });

  it('deux chiots ne sont jamais identiques', () => {
    const [a, b] = rollLitter(createRng(3), 'carlin');
    expect(a?.traits).not.toEqual(b?.traits);
  });
});

describe('F-ADO-3 : le nom', () => {
  it('accepte un nom simple, sans espaces autour', () => {
    expect(validateName('  Noisette ')).toEqual({ ok: true, name: 'Noisette' });
    expect(validateName('Jo-Jo')).toEqual({ ok: true, name: 'Jo-Jo' });
    expect(validateName('Éclair')).toEqual({ ok: true, name: 'Éclair' });
  });

  it('refuse un nom vide, trop long ou fait de signes', () => {
    expect(validateName('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateName('A'.repeat(BALANCE.adoption.nameMaxLength + 1))).toEqual({ ok: false, reason: 'long' });
    expect(validateName('<b>')).toEqual({ ok: false, reason: 'chars' });
  });
});

describe('F-ADO-4 : prix', () => {
  it('le premier chiot est offert, les suivants coûtent de 500 à 2 000 pièces', () => {
    const s = start();
    expect(adoptionPrice(s.save, 'berger')).toBe(0);
    for (const id of STARTER_BREEDS) {
      const price = BREEDS[id]?.price ?? 0;
      expect(price).toBeGreaterThanOrEqual(500);
      expect(price).toBeLessThanOrEqual(2000);
    }
  });

  it('adopter : choisir la race, un chiot, un nom ; le chiot arrive au salon', () => {
    let s = reduce(start(), { type: 'kennel/open', breedId: 'teckel' });
    expect(s.kennel?.litter).toHaveLength(3);
    const pick = s.kennel?.litter[1];
    s = reduce(s, { type: 'adopt', index: 1, name: 'Biscotte', now: T0 + 1000, tzOffsetMin: TZ });
    const d = s.save.dogs[0];
    expect(d?.name).toBe('Biscotte');
    expect(d?.breedId).toBe('teckel');
    expect(d?.traits).toEqual(pick?.traits);
    expect(d?.affection).toBe(BALANCE.start.affection);
    expect(d?.needs).toEqual({ hunger: 80, thirst: 80, cleanliness: 90, energy: 100 });
    expect(s.save.homeDogIds).toEqual([d?.id]);
    expect(s.minds[d?.id ?? '']).toBeDefined();
    expect(s.kennel).toBeNull();
    expect(s.save.coins).toBe(0);
  });

  it('un nom invalide n’adopte pas', () => {
    let s = reduce(start(), { type: 'kennel/open', breedId: 'teckel' });
    s = reduce(s, { type: 'adopt', index: 0, name: '  ', now: T0, tzOffsetMin: TZ });
    expect(s.save.dogs).toHaveLength(0);
  });

  it('le deuxième chiot coûte son prix, et faute de pièces l’adoption est refusée', () => {
    let s = reduce(start(), { type: 'kennel/open', breedId: 'teckel' });
    s = reduce(s, { type: 'adopt', index: 0, name: 'Un', now: T0, tzOffsetMin: TZ });
    expect(adoptionPrice(s.save, 'berger')).toBe(BREEDS.berger?.price);
    s = reduce(s, { type: 'kennel/open', breedId: 'berger' });
    s = reduce(s, { type: 'adopt', index: 0, name: 'Deux', now: T0, tzOffsetMin: TZ });
    expect(s.save.dogs).toHaveLength(1);
    s = { ...s, save: { ...s.save, coins: 5000 } };
    s = reduce(s, { type: 'kennel/open', breedId: 'berger' });
    s = reduce(s, { type: 'adopt', index: 0, name: 'Deux', now: T0, tzOffsetMin: TZ });
    expect(s.save.dogs).toHaveLength(2);
    expect(s.save.coins).toBe(5000 - (BREEDS.berger?.price ?? 0));
  });
});

describe('Chiot des jalons 1 et 2, sans nom', () => {
  it('il est gardé et le jeu demande seulement de le nommer', () => {
    let s = start();
    s = reduce(s, { type: 'kennel/open', breedId: 'beagle' });
    s = reduce(s, { type: 'adopt', index: 0, name: 'Tmp', now: T0, tzOffsetMin: TZ });
    const id = s.save.dogs[0]?.id ?? '';
    s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, name: '' })) } };
    s = reduce(s, { type: 'rename', dogId: id, name: 'Truffe' });
    expect(s.save.dogs[0]?.name).toBe('Truffe');
  });
});
