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
