import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { createGameState, createNewGame, reduce, type GameState } from '../../src/sim/game';
import { createToy, stepToy, throwToy, type Toy } from '../../src/sim/toys';

const T = BALANCE.toys;
const F = BALANCE.puppy.floor;
const T0 = Date.UTC(2026, 10, 3, 13, 0);
const TZ = -60;

type Temper = keyof typeof BALANCE.temperaments;

function adopted(seed: number, temper: Temper = 'joueur', affection = 30): GameState {
  let s = reduce(createGameState(createNewGame(T0, seed)), { type: 'session/start', now: T0, tzOffsetMin: TZ });
  s = reduce(s, { type: 'kennel/open', breedId: 'beagle' });
  s = reduce(s, { type: 'adopt', index: 0, name: 'Test', now: T0, tzOffsetMin: TZ });
  const traits = { ...BALANCE.temperaments[temper] };
  return { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, traits, temperament: temper, affection })) } };
}
const dog = (s: GameState) => {
  const d = s.save.dogs[0];
  if (!d) throw new Error('aucun chien');
  return d;
};
const mind = (s: GameState) => {
  const m = s.minds[dog(s).id];
  if (!m) throw new Error('aucun esprit');
  return m;
};
function advance(s: GameState, ms: number): GameState {
  let now = s.save.lastSeenAt;
  for (let t = 0; t < ms; t += 100) s = reduce(s, { type: 'tick', now: (now += 100), dtMs: 100, tzOffsetMin: TZ });
  return s;
}
/** Le joueur prend un jouet au premier plan et le lance. */
function throwFrom(s: GameState, kind: 'ball' | 'disc', vx: number, vz: number): GameState {
  s = reduce(s, { type: 'toy/hold', kind, at: { x: 0, z: 0.9 } });
  const id = s.toys.find((t) => t.state === 'held')?.id ?? '';
  return reduce(s, { type: 'toy/throw', toyId: id, vx, vz });
}
const familiarize = (s: GameState, kind: string): GameState => ({
  ...s,
  save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, familiar: { ...d.familiar, [kind]: T.familiarAfter } })) },
});
const eventsOf = (s: GameState) => mind(s).events.map((e) => e.type);

function fly(toy: Toy, maxMs = 8000): { toy: Toy; airMs: number } {
  let t = toy;
  let airMs = 0;
  for (let ms = 0; ms < maxMs; ms += 100) {
    t = stepToy(t, 100);
    if (t.h > 0.001) airMs += 100;
  }
  return { toy: t, airMs };
}

describe('F-JEU-1 : la trajectoire suit le geste', () => {
  const start = (kind: 'ball' | 'disc') => createToy('t', kind, { x: 0, z: 0.9 });

  it('la direction du doigt donne la direction du lancer', () => {
    const right = fly(throwToy(start('ball'), 1.2, -1, 0)).toy;
    const left = fly(throwToy(start('ball'), -1.2, -1, 0)).toy;
    expect(right.pos.x).toBeGreaterThan(0.2);
    expect(left.pos.x).toBeLessThan(-0.2);
    expect(right.pos.z).toBeLessThan(0.9);
  });

  it('un geste plus vif lance plus loin (premier point d’impact)', () => {
    const landing = (toy: Toy) => {
      let t = stepToy(toy, 100);
      while (t.h > 0) t = stepToy(t, 100);
      return t.pos;
    };
    const soft = landing(throwToy(start('ball'), 0, -0.6, 0));
    const hard = landing(throwToy(start('ball'), 0, -1.5, 0));
    expect(0.9 - hard.z).toBeGreaterThan(0.9 - soft.z);
  });

  it('le jouet reste dans la pièce et finit par s’arrêter', () => {
    const r = fly(throwToy(start('ball'), 3, -3, 0)).toy;
    expect(r.pos.x).toBeLessThanOrEqual(F.maxX);
    expect(r.pos.z).toBeGreaterThanOrEqual(F.minZ);
    expect(r.state).toBe('ground');
    expect(Math.hypot(r.v.x, r.v.z)).toBeLessThan(0.01);
  });

  it('le disque plane plus longtemps que la balle', () => {
    expect(fly(throwToy(start('disc'), 0, -1.2, 0)).airMs).toBeGreaterThan(fly(throwToy(start('ball'), 0, -1.2, 0)).airMs);
  });

  it('la vitesse est plafonnée', () => {
    const t = throwToy(start('ball'), 50, -50, 0);
    expect(Math.hypot(t.v.x, t.v.z)).toBeLessThanOrEqual(T.maxSpeed + 1e-9);
  });

  it('chaque lancer coûte 1 d’énergie', () => {
    const s = adopted(1);
    const e0 = dog(s).needs.energy;
    expect(dog(throwFrom(s, 'ball', 0, -1)).needs.energy).toBeCloseTo(e0 - T.energyPerThrow);
  });
});

describe('F-JEU-2 : rapporter, mâchouiller ou ignorer', () => {
  /** Issue d'un lancer, une fois le jouet connu. */
  function outcome(seed: number, temper: Temper, affection: number): 'fetch' | 'chew' | 'ignore' {
    let s = familiarize(adopted(seed, temper, affection), 'ball');
    s = throwFrom(s, 'ball', 0.4, -1.2);
    const plan = mind(s).toyPlan?.plan;
    return plan ?? 'ignore';
  }

  it('le score de « rapporter » vaut 60 + énergie ÷ 4', () => {
    let seed = 1;
    while (outcome(seed, 'sage', 90) !== 'fetch') seed++;
    let s = familiarize(adopted(seed, 'sage', 90), 'ball');
    s = throwFrom(s, 'ball', 0, -1);
    const sc = mind(s).lastScores;
    const value = sc.fetch ?? sc.chew;
    expect(value).toBeCloseTo(T.scores.fetchBase + dog(s).needs.energy * T.scores.fetchPerEnergy, 5);
  });

  it('un chiot attaché et docile rapporte plus souvent qu’un têtu peu attaché', () => {
    let good = 0;
    let bad = 0;
    for (let seed = 1; seed <= 80; seed++) {
      if (outcome(seed, 'sage', 90) === 'fetch') good++;
      if (outcome(seed, 'tetu', 20) === 'fetch') bad++;
    }
    expect(good).toBeGreaterThan(bad + 20);
  });

  it('les trois issues existent', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) seen.add(outcome(seed, 'joueur', 40));
    expect(seen).toEqual(new Set(['fetch', 'chew', 'ignore']));
  });

  it('rapporter : il court au jouet, le prend dans la gueule, le ramène et le pose devant le joueur', () => {
    let seed = 1;
    while (outcome(seed, 'sage', 90) !== 'fetch') seed++;
    let s = familiarize(adopted(seed, 'sage', 90), 'ball');
    s = throwFrom(s, 'ball', 0.5, -1.4);
    let carried = false;
    for (let i = 0; i < 150 && !carried; i++) {
      s = advance(s, 100);
      carried = s.toys[0]?.state === 'carried';
    }
    expect(carried).toBe(true);
    expect(mind(s).holding).toBe(s.toys[0]?.id);
    s = advance(s, 8000);
    const toy = s.toys[0];
    expect(toy?.state).toBe('ground');
    expect(mind(s).holding).toBeNull();
    expect(Math.hypot((toy?.pos.x ?? 9) - F.front.x, (toy?.pos.z ?? 9) - F.front.z)).toBeLessThan(0.2);
  });

  it('mâchouiller : il prend le jouet et se couche pour le mordiller', () => {
    let seed = 1;
    while (outcome(seed, 'joueur', 40) !== 'chew') seed++;
    let s = familiarize(adopted(seed, 'joueur', 40), 'ball');
    s = throwFrom(s, 'ball', 0.5, -1.2);
    s = advance(s, 6000);
    expect(mind(s).activity).toBe('chew');
    expect(eventsOf(s)).toContain('chew');
    expect(mind(s).posture).toBe('lie');
  });

  it('ignorer : il regarde, mais ne bouge pas vers le jouet', () => {
    let seed = 1;
    while (outcome(seed, 'tetu', 20) !== 'ignore') seed++;
    let s = familiarize(adopted(seed, 'tetu', 20), 'ball');
    s = throwFrom(s, 'ball', 0.5, -1.2);
    s = advance(s, 6000);
    expect(['fetch', 'chew']).not.toContain(mind(s).activity);
    expect(s.toys[0]?.state).toBe('ground');
  });

  it('il ne rapporte pas en boudant', () => {
    let s = familiarize(adopted(3, 'sage', 90), 'ball');
    for (let i = 0; i < 3; i++) s = reduce(s, { type: 'gesture', gesture: { kind: 'pull', part: 'tail' } });
    s = throwFrom(s, 'ball', 0, -1);
    expect(mind(s).toyPlan?.plan ?? 'ignore').toBe('ignore');
  });
});

describe('F-JEU-3 : la corde', () => {
  function tugReady(seed: number): GameState {
    let s = familiarize(adopted(seed, 'joueur', 60), 'rope');
    s = reduce(s, { type: 'toy/hold', kind: 'rope', at: { x: 0.1, z: 0.85 } });
    for (let i = 0; i < 60 && mind(s).tug === null; i++) s = advance(s, 100);
    return s;
  }
  const ropeId = (s: GameState) => s.toys.find((t) => t.kind === 'rope')?.id ?? '';

  it('présentée, il vient l’attraper et résiste en secouant la tête', () => {
    let seed = 1;
    let s = tugReady(seed);
    while (mind(s).tug === null && seed < 20) s = tugReady(++seed);
    expect(mind(s).activity).toBe('tug');
    s = reduce(s, { type: 'toy/tug', pullPx: 40 });
    s = advance(s, 1300);
    expect(eventsOf(s)).toContain('shake');
  });

  it('tirer assez fort : il lâche, et le joueur garde la corde', () => {
    let seed = 1;
    for (;; seed++) {
      let s = tugReady(seed);
      if (mind(s).tug === null) continue;
      for (let i = 0; i < 20 && mind(s).tug; i++) {
        s = reduce(s, { type: 'toy/tug', pullPx: 60 });
        s = advance(s, 100);
      }
      if (mind(s).activity === 'chew') continue; // il a gagné avant : on essaie une autre graine
      expect(mind(s).tug).toBeNull();
      expect(s.toys.find((t) => t.id === ropeId(s))?.state).toBe('held');
      expect(eventsOf(s)).toContain('playBow');
      break;
    }
  });

  it('ne plus tirer : il gagne, emporte la corde et la mâchouille', () => {
    let seed = 1;
    let s = tugReady(seed);
    while (mind(s).tug === null && seed < 20) s = tugReady(++seed);
    s = advance(s, T.tug.idleMs + 1000);
    expect(mind(s).tug).toBeNull();
    expect(mind(s).holding).toBe(ropeId(s));
    s = advance(s, 3000);
    expect(mind(s).activity).toBe('chew');
  });
});

describe('F-JEU-4 : objet inconnu et chiot timide', () => {
  it('le score de la peur vaut 90 − audace × 80', () => {
    const s = throwFrom(adopted(4, 'timide'), 'disc', 0, -1);
    const fear = mind(s).lastScores.fear;
    expect(fear).toBeCloseTo(T.scores.fearBase - dog(s).traits.boldness * T.scores.fearPerBoldness, 5);
  });

  it('un objet inconnu peut effrayer un chiot timide', () => {
    let scared = 0;
    for (let seed = 1; seed <= 40; seed++) if (mind(throwFrom(adopted(seed, 'timide'), 'disc', 0, -1)).activity === 'fear') scared++;
    expect(scared).toBeGreaterThan(10);
  });

  it('il s’y habitue après quelques approches', () => {
    let s = adopted(1, 'timide');
    let episodes = 0;
    for (let i = 0; i < 30 && (dog(s).familiar.disc ?? 0) < T.familiarAfter; i++) {
      s = throwFrom(s, 'disc', 0.3 * ((i % 3) - 1), -1);
      if (mind(s).activity === 'fear') episodes++;
      s = advance(s, 9000);
      s = { ...s, toys: [] };
    }
    expect(dog(s).familiar.disc).toBe(T.familiarAfter);
    expect(episodes).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) {
      s = throwFrom(s, 'disc', 0, -1);
      expect(mind(s).activity).not.toBe('fear');
      s = advance(s, 3000);
      s = { ...s, toys: [] };
    }
  });

  it('un chiot audacieux n’a pas peur', () => {
    for (let seed = 1; seed <= 20; seed++) expect(mind(throwFrom(adopted(seed, 'tetu'), 'disc', 0, -1)).activity).not.toBe('fear');
  });
});
