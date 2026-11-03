import { describe, expect, it } from 'vitest';
import { migrate, SaveError } from '../../src/save/migrations';
import { createNewGame } from '../../src/sim/game';
import { SAVE_VERSION } from '../../src/sim/state';

describe('Migrations de sauvegarde', () => {
  it('accepte une sauvegarde à la version courante', () => {
    const g = createNewGame(1000, 1);
    expect(migrate(structuredClone(g))).toEqual(g);
  });

  it('rejette ce qui n’est pas un objet', () => {
    expect(() => migrate(null)).toThrow(SaveError);
    expect(() => migrate('texte')).toThrow(SaveError);
  });

  it('rejette une version inconnue ou future', () => {
    expect(() => migrate({ version: 0 })).toThrow(SaveError);
    expect(() => migrate({ ...createNewGame(1, 1), version: SAVE_VERSION + 1 })).toThrow(SaveError);
  });

  it('rejette une sauvegarde tronquée', () => {
    const g: Record<string, unknown> = { ...createNewGame(1, 1) };
    delete g.dogs;
    expect(() => migrate(g)).toThrow(SaveError);
  });

  it('rejette des compteurs non numériques', () => {
    expect(() => migrate({ ...createNewGame(1, 1), coins: 'beaucoup' })).toThrow(SaveError);
  });
});

describe('Migration v1 → v2 (jalon 3 : sexe, tempérament, objets familiers)', () => {
  /** Sauvegarde telle qu'écrite par les jalons 1 et 2. */
  const v1 = {
    ...createNewGame(1000, 1),
    version: 1,
    dogs: [
      {
        id: 'dog-abc',
        name: '',
        breedId: 'beagle',
        coat: { base: 0, patch: 0, patchAmount: 1 },
        traits: { docility: 0.55, energy: 0.85, boldness: 0.66 },
        needs: { hunger: 50, thirst: 40, cleanliness: 70, energy: 90 },
        affection: 42,
        stamina: 5,
        tricks: [],
        contestClass: { disc: 0, agility: 0, obedience: 0 },
        trophies: [],
        equipped: [],
      },
    ],
    homeDogIds: ['dog-abc'],
  };

  it('ajoute les nouveaux champs et garde tout le reste', () => {
    const g = migrate(structuredClone(v1));
    expect(g.version).toBe(SAVE_VERSION);
    const d = g.dogs[0];
    expect(d?.affection).toBe(42);
    expect(d?.needs).toEqual(v1.dogs[0]?.needs);
    expect(d?.traits).toEqual(v1.dogs[0]?.traits);
    expect(['f', 'm']).toContain(d?.sex);
    expect(d?.temperament).toBe('joueur');
    expect(d?.familiar).toEqual({});
    expect(g.homeDogIds).toEqual(['dog-abc']);
  });

  it('une sauvegarde v1 sans chien passe aussi', () => {
    const g = migrate({ ...createNewGame(1, 1), version: 1 });
    expect(g.dogs).toEqual([]);
  });
});
