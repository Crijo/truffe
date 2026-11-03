import { describe, expect, it } from 'vitest';
import { createNewGame, reduce } from '../../src/sim/game';
import { SAVE_VERSION } from '../../src/sim/state';

const T0 = Date.UTC(2026, 10, 3, 12, 0, 0);

describe('Partie neuve', () => {
  it('suit le modèle de données de la spec', () => {
    const g = createNewGame(T0, 1234);
    expect(g.version).toBe(SAVE_VERSION);
    expect(g.createdAt).toBe(T0);
    expect(g.lastSeenAt).toBe(T0);
    expect(g.coins).toBe(0);
    expect(g.masterPoints).toBe(0);
    expect(g.dogs).toEqual([]);
    expect(g.homeDogIds).toEqual([]);
    expect(g.discovered).toEqual({ items: [], tricks: [] });
    expect(g.stats.sessions).toBe(0);
  });
});

describe('Ouverture de session', () => {
  it('compte les sessions et avance lastSeenAt', () => {
    let g = createNewGame(T0, 1);
    g = reduce(g, { type: 'session/start', now: T0 + 60_000 });
    expect(g.stats.sessions).toBe(1);
    expect(g.lastSeenAt).toBe(T0 + 60_000);
  });

  it('une horloge qui recule ne fait pas reculer lastSeenAt', () => {
    let g = createNewGame(T0, 1);
    g = reduce(g, { type: 'session/start', now: T0 - 3_600_000 });
    expect(g.lastSeenAt).toBe(T0);
  });

  it('ne modifie jamais l’état reçu', () => {
    const g = createNewGame(T0, 1);
    const before = structuredClone(g);
    reduce(g, { type: 'session/start', now: T0 + 1 });
    expect(g).toEqual(before);
  });
});

describe('Pas de simulation', () => {
  it('avance lastSeenAt', () => {
    let g = createNewGame(T0, 1);
    g = reduce(g, { type: 'tick', now: T0 + 100, dtMs: 100 });
    expect(g.lastSeenAt).toBe(T0 + 100);
  });

  it('n’avance pas lastSeenAt si l’horloge recule', () => {
    let g = createNewGame(T0, 1);
    g = reduce(g, { type: 'tick', now: T0 - 100, dtMs: 100 });
    expect(g.lastSeenAt).toBe(T0);
  });
});
