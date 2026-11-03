import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { dayKeyAt } from '../../src/sim/day';
import { createGameState, createNewGame, reduce, type GameState } from '../../src/sim/game';
import { SAVE_VERSION } from '../../src/sim/state';
import { startWithDog } from './fixtures';

const T0 = Date.UTC(2026, 10, 3, 12, 0, 0);
const TZ = -60; // Paris en hiver : getTimezoneOffset() = -60
const HOUR = 3_600_000;

const started = (now = T0): GameState => startWithDog(now, TZ);
const dog = (s: GameState) => {
  const d = s.save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};

describe('Partie neuve', () => {
  it('suit le modèle de données de la spec', () => {
    const g = createNewGame(T0, 1234);
    expect(g.version).toBe(SAVE_VERSION);
    expect(g.createdAt).toBe(T0);
    expect(g.lastSeenAt).toBe(T0);
    expect(g.coins).toBe(BALANCE.economy.welcomeCoins);
    expect(g.masterPoints).toBe(0);
    expect(g.dogs).toEqual([]);
    expect(g.homeDogIds).toEqual([]);
    expect(g.discovered).toEqual({ items: [], tricks: [] });
    expect(g.stats.sessions).toBe(0);
  });

  it('jalon 3 : aucun chiot imposé ; le chiot adopté a son esprit dès son arrivée', () => {
    expect(reduce(createGameState(createNewGame(T0, 1)), { type: 'session/start', now: T0, tzOffsetMin: TZ }).save.dogs).toEqual([]);
    const s = started();
    expect(dog(s).affection).toBe(BALANCE.start.affection);
    expect(s.save.homeDogIds).toEqual([dog(s).id]);
    expect(s.minds[dog(s).id]).toBeDefined();
  });
});

describe('Ouverture de session', () => {
  it('compte les sessions et avance lastSeenAt', () => {
    const s = reduce(started(), { type: 'session/start', now: T0 + 60_000, tzOffsetMin: TZ });
    expect(s.save.stats.sessions).toBe(2);
    expect(s.save.lastSeenAt).toBe(T0 + 60_000);
  });

  it('une horloge qui recule ne fait pas reculer lastSeenAt', () => {
    const s = reduce(started(), { type: 'session/start', now: T0 - HOUR, tzOffsetMin: TZ });
    expect(s.save.lastSeenAt).toBe(T0);
  });

  it('ne modifie jamais l’état reçu', () => {
    const s = started();
    const before = structuredClone(s);
    reduce(s, { type: 'session/start', now: T0 + 1, tzOffsetMin: TZ });
    reduce(s, { type: 'gesture', gesture: { kind: 'stroke', part: 'back', distancePx: 80 } });
    expect(s).toEqual(before);
  });

  it('F-VIE-2 : après une longue absence, le chiot accueille le joueur', () => {
    const s = reduce(started(), { type: 'session/start', now: T0 + 26 * HOUR, tzOffsetMin: TZ });
    expect(s.minds[dog(s).id]?.activity).toBe('greet');
  });

  it('F-VIE-2 : au retour sur l’onglet après une pause', () => {
    let s = started();
    s = reduce(s, { type: 'session/resume', now: T0 + HOUR, tzOffsetMin: TZ });
    expect(s.minds[dog(s).id]?.activity).toBe('greet');
    expect(s.save.stats.sessions).toBe(1);
  });

  it('F-VIE-2 : pas d’accueil après une absence très courte', () => {
    const s = reduce(started(), { type: 'session/resume', now: T0 + 30_000, tzOffsetMin: TZ });
    expect(s.minds[dog(s).id]?.activity).not.toBe('greet');
  });
});

describe('Pas de simulation', () => {
  it('avance lastSeenAt', () => {
    const s = reduce(started(), { type: 'tick', now: T0 + 100, dtMs: 100, tzOffsetMin: TZ });
    expect(s.save.lastSeenAt).toBe(T0 + 100);
  });

  it('n’avance pas lastSeenAt si l’horloge recule', () => {
    const s = reduce(started(), { type: 'tick', now: T0 - 100, dtMs: 100, tzOffsetMin: TZ });
    expect(s.save.lastSeenAt).toBe(T0);
  });
});

describe('F-MAIN-1 : affection par les caresses', () => {
  const stroke = (s: GameState, n: number) => {
    let now = s.save.lastSeenAt;
    for (let i = 0; i < n; i++) {
      s = reduce(s, { type: 'gesture', gesture: { kind: 'stroke', part: 'back', distancePx: 70 } });
      for (let k = 0; k < 21; k++) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
    }
    return s;
  };

  it('+1 par caresse', () => {
    expect(dog(stroke(started(), 3)).affection).toBe(BALANCE.start.affection + 3);
  });

  it('plafond de 15 caresses par jour', () => {
    const s = stroke(started(), 20);
    expect(dog(s).affection).toBe(BALANCE.start.affection + BALANCE.puppy.caress.dailyCap);
  });

  it('le plafond repart à 4 h du matin, heure locale', () => {
    let s = stroke(started(), 20);
    const next4am = Date.UTC(2026, 10, 4, 3, 0, 0); // 4 h à Paris
    s = reduce(s, { type: 'tick', now: next4am + 1000, dtMs: 100, tzOffsetMin: TZ });
    // La nuit sans jeu compte comme un jour d'absence (−1, D-12).
    const after = dog(s).affection;
    expect(after).toBe(BALANCE.start.affection + BALANCE.puppy.caress.dailyCap - 1);
    s = stroke(s, 2);
    expect(dog(s).affection).toBe(after + 2);
  });

  it('l’affection reste entre 0 et 100', () => {
    let s = started();
    for (let i = 0; i < 200; i++) s = reduce(s, { type: 'gesture', gesture: { kind: 'pull', part: 'tail' } });
    expect(dog(s).affection).toBeGreaterThanOrEqual(0);
  });
});

describe('Jour de jeu', () => {
  it('commence à 4 h du matin, heure locale', () => {
    const before = Date.UTC(2026, 10, 4, 2, 59, 0); // 3 h 59 à Paris
    const after = Date.UTC(2026, 10, 4, 3, 0, 0); // 4 h 00 à Paris
    expect(dayKeyAt(before, TZ)).not.toBe(dayKeyAt(after, TZ));
    expect(dayKeyAt(after, TZ)).toBe(dayKeyAt(Date.UTC(2026, 10, 5, 2, 0, 0), TZ));
  });
});
