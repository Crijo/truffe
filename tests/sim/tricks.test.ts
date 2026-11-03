import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import { TRICKS, TRICK_IDS, type TrickId } from '../../src/data/tricks';
import type { Gesture, Posture } from '../../src/sim/behavior';
import { reduce, type GameState } from '../../src/sim/game';
import { repsNeeded } from '../../src/sim/tricks';
import { startWithDog } from './fixtures';

const TR = BALANCE.training;
const T0 = Date.UTC(2026, 10, 3, 13, 0);
const TZ = -60;
const DAY = 24 * 3_600_000;

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
const g = (s: GameState, gesture: Gesture) => reduce(s, { type: 'gesture', gesture });
const eventsOf = (s: GameState) => mind(s).events.map((e) => e.type);
const trick = (s: GameState, id: TrickId) => dog(s).tricks.find((t) => t.trickId === id);
/** Chien docile et attaché : il obéit presque toujours. */
function eager(seed = 1): GameState {
  const s = startWithDog(T0, TZ, seed);
  return { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, affection: 100, traits: { ...d.traits, docility: 1 } })) } };
}
function posed(s: GameState, posture: Posture): GameState {
  const id = dog(s).id;
  const m = mind(s);
  return { ...s, minds: { ...s.minds, [id]: { ...m, posture, postureLockUntil: m.t + 60_000 } } };
}

/** Provoque le geste qui fait apparaître l'ampoule du tour. */
function provoke(s: GameState, id: TrickId): GameState {
  switch (id) {
    case 'sit':
      return advance(g(posed(s, 'stand'), { kind: 'raise', fast: false }), TR.bulbMs / 3);
    case 'beg':
      return g(posed(s, 'sit'), { kind: 'raise', fast: false });
    case 'jump':
      return g(posed(s, 'beg'), { kind: 'raise', fast: true });
    case 'down':
      return g(posed(s, 'stand'), { kind: 'press', part: 'back' });
    case 'roll':
      return g(posed(s, 'lie'), { kind: 'push', part: 'flank' });
    case 'paw':
      return g(s, { kind: 'touch', part: 'paw' });
    case 'spin':
      return g(s, { kind: 'circle' });
    default: {
      const combo = TRICKS[id].combo;
      if (combo) return reduce(posed(s, combo.posture), { type: 'order', trickId: combo.base });
      return reduce(s, { type: 'debug/spontaneous', trick: id });
    }
  }
}

/** Apprend un tour : provoquer, toucher l'ampoule, autant de fois qu'il le faut. */
function learn(s: GameState, id: TrickId): GameState {
  for (let i = 0; i < 12 && !trick(s, id)?.learned; i++) {
    s = provoke(s, id);
    if (mind(s).bulb?.trickId === id) s = reduce(s, { type: 'train' });
    s = advance(s, 4000);
    s = g(s, { kind: 'raiseEnd' });
  }
  return s;
}

describe('Les 16 tours', () => {
  it('7 de base, 5 spontanés, 4 combinés secrets', () => {
    expect(TRICK_IDS).toHaveLength(16);
    const count = (c: string) => TRICK_IDS.filter((t) => TRICKS[t].category === c).length;
    expect([count('base'), count('spontaneous'), count('combo')]).toEqual([7, 5, 4]);
  });
});

describe('F-DRE-1 : l’ampoule', () => {
  const cases: [TrickId, string][] = [
    ['sit', 'lever la main au-dessus d’un chiot debout'],
    ['beg', 'lever la main d’un chiot assis'],
    ['jump', 'lever vite la main d’un chiot debout sur ses pattes arrière'],
    ['down', 'appuyer doucement sur le dos'],
    ['roll', 'pousser le flanc d’un chiot couché'],
    ['paw', 'toucher une patte avant'],
    ['spin', 'dessiner un cercle autour de lui'],
  ];
  for (const [id, how] of cases) {
    it(`${TRICKS[id].label} : ${how}`, () => {
      const s = provoke(eager(), id);
      expect(mind(s).bulb?.trickId).toBe(id);
    });
  }

  it('les gestes spontanés allument aussi l’ampoule', () => {
    // Laissé seul, il finit par faire un geste spontané, qui allume l'ampoule de ce tour.
    let s = eager();
    let seen: string | undefined;
    for (let i = 0; i < 120 && !seen; i++) {
      s = advance(s, 1000);
      seen = mind(s).bulb?.trickId;
    }
    expect(['howl', 'dig', 'sniff', 'bark', 'scratch']).toContain(seen);
    // Chacun des cinq, provoqué directement (le tirage est aléatoire).
    for (const id of ['howl', 'dig', 'sniff', 'bark', 'scratch'] as const) expect(mind(provoke(eager(), id)).bulb?.trickId).toBe(id);
  });

  it('l’ampoule dure 3 secondes', () => {
    let s = provoke(eager(), 'paw');
    s = advance(s, TR.bulbMs - 200);
    expect(mind(s).bulb).not.toBeNull();
    s = advance(s, 400);
    expect(mind(s).bulb).toBeNull();
  });

  it('toucher l’ampoule associe un ordre, au nom du tour par défaut', () => {
    let s = provoke(eager(), 'paw');
    s = reduce(s, { type: 'train' });
    expect(trick(s, 'paw')?.repetitions).toBe(1);
    expect(trick(s, 'paw')?.command.label).toBe('La patte');
    expect(mind(s).bulb).toBeNull();
  });

  it('pas d’ampoule pour un tour déjà appris', () => {
    let s = learn(eager(), 'paw');
    s = provoke(s, 'paw');
    expect(mind(s).bulb).toBeNull();
  });
});

describe('F-DRE-2 : 3 à 6 répétitions', () => {
  it('selon le tempérament et l’affection', () => {
    expect(repsNeeded({ docility: 1, energy: 0.5, boldness: 0.5 }, 100)).toBe(TR.repsMin);
    expect(repsNeeded({ docility: 0, energy: 0.5, boldness: 0.5 }, 0)).toBe(TR.repsMax);
    const mid = repsNeeded({ docility: 0.5, energy: 0.5, boldness: 0.5 }, 50);
    expect(mid).toBeGreaterThan(TR.repsMin);
    expect(mid).toBeLessThan(TR.repsMax);
  });

  it('appris après le bon nombre de répétitions, avec une fête', () => {
    let s = eager();
    for (let i = 0; i < TR.repsMin - 1; i++) {
      s = reduce(provoke(s, 'paw'), { type: 'train' });
      s = advance(s, 3000);
    }
    expect(trick(s, 'paw')?.learned).toBe(false);
    s = reduce(provoke(s, 'paw'), { type: 'train' });
    expect(trick(s, 'paw')?.learned).toBe(true);
    expect(eventsOf(s)).toContain('learned');
  });
});

describe('F-DRE-3 : trois retours distincts', () => {
  it('l’ampoule au-dessus de la tête montre le progrès', () => {
    const s = reduce(provoke(eager(), 'paw'), { type: 'train' });
    expect(eventsOf(s)).toContain('progress');
  });

  it('un ordre inconnu donne le point d’interrogation rouge', () => {
    const s = reduce(eager(), { type: 'order', trickId: 'paw' });
    expect(eventsOf(s)).toContain('confused');
  });

  it('un ordre trop proche d’un autre donne le point d’interrogation bleu', () => {
    const s = g(eager(), { kind: 'orderSimilar' });
    expect(eventsOf(s)).toContain('similar');
  });
});

describe('F-DRE-4 : obéissance', () => {
  it('un chiot docile et attaché exécute presque toujours un ordre appris', () => {
    let s = learn(eager(), 'paw');
    let ok = 0;
    for (let i = 0; i < 20; i++) {
      s = reduce(s, { type: 'order', trickId: 'paw' });
      if (mind(s).activity === 'perform') ok++;
      s = advance(s, 13_000);
    }
    expect(ok).toBeGreaterThanOrEqual(16);
  });

  it('chaque réussite fait monter la maîtrise de 0,05', () => {
    let s = learn(eager(), 'paw');
    const m0 = trick(s, 'paw')?.mastery ?? 0;
    for (let i = 0; i < 20 && (trick(s, 'paw')?.mastery ?? 0) === m0; i++) {
      s = reduce(s, { type: 'order', trickId: 'paw' });
      s = advance(s, 13_000);
    }
    expect(trick(s, 'paw')?.mastery).toBeCloseTo(m0 + BALANCE.obedience.masteryStep, 5);
  });

  it('en cas d’échec, il regarde ailleurs, bâille ou part renifler', () => {
    let s = learn(eager(), 'paw');
    s = { ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, affection: 0, traits: { ...d.traits, docility: 0 } })) } };
    const reactions = new Set<string>();
    for (let i = 0; i < 30; i++) {
      s = reduce(s, { type: 'order', trickId: 'paw' });
      if (mind(s).activity !== 'perform') {
        const last = mind(s).events.at(-1)?.type ?? '';
        reactions.add(last);
      }
      s = advance(s, 3000);
    }
    expect([...reactions].every((r) => ['lookAway', 'yawn', 'sniffGround'].includes(r))).toBe(true);
    expect(reactions.size).toBeGreaterThan(1);
  });

  it('un tour exécuté met le chiot dans sa posture', () => {
    let s = learn(eager(), 'sit');
    s = posed(s, 'stand');
    s = { ...s, minds: { ...s.minds, [dog(s).id]: { ...mind(s), postureLockUntil: 0 } } };
    for (let i = 0; i < 10 && mind(s).activity !== 'perform'; i++) s = advance(reduce(s, { type: 'order', trickId: 'sit' }), 100);
    s = advance(s, 2000);
    expect(mind(s).posture).toBe('sit');
  });

  it('un ordre réveille le chiot endormi', () => {
    let s = learn(startWithDog(Date.UTC(2026, 10, 3, 22, 0), TZ), 'paw');
    s = advance(s, 60_000);
    expect(mind(s).activity).toBe('sleep');
    s = reduce(s, { type: 'order', trickId: 'paw' });
    expect(mind(s).activity).not.toBe('sleep');
  });
});

describe('Combinés secrets', () => {
  it('l’ordre de base dans la bonne posture allume l’ampoule du combiné', () => {
    let s = learn(eager(), 'jump');
    s = reduce(posed(s, 'sit'), { type: 'order', trickId: 'jump' });
    expect(mind(s).bulb?.trickId).toBe('flip');
  });

  it('une fois appris, il l’exécute à l’ordre de base dans cette posture', () => {
    let s = learn(eager(), 'jump');
    s = learn(s, 'flip');
    expect(trick(s, 'flip')?.learned).toBe(true);
    let done = false;
    for (let i = 0; i < 10 && !done; i++) {
      s = reduce(posed(s, 'sit'), { type: 'order', trickId: 'jump' });
      done = mind(s).perform?.trickId === 'flip';
      s = advance(s, 3000);
    }
    expect(done).toBe(true);
  });
});

describe('F-DRE-5 : limites', () => {
  it('4 nouveaux tours par jour au plus', () => {
    let s = eager();
    for (const id of ['paw', 'spin', 'down', 'roll', 'beg'] as const) s = learn(s, id);
    expect(dog(s).tricks.filter((t) => t.learned)).toHaveLength(TR.newPerDay);
    expect(trick(s, 'beg')?.learned ?? false).toBe(false);
    // Le lendemain, il peut de nouveau apprendre.
    s = reduce(s, { type: 'session/resume', now: s.save.lastSeenAt + DAY, tzOffsetMin: TZ });
    s = learn(s, 'beg');
    expect(trick(s, 'beg')?.learned).toBe(true);
  });

  it('répéter les tours connus reste illimité', () => {
    let s = learn(eager(), 'paw');
    let ok = 0;
    for (let i = 0; i < 40; i++) {
      s = reduce(s, { type: 'order', trickId: 'paw' });
      if (mind(s).activity === 'perform') ok++;
      s = advance(s, 2500);
    }
    expect(ok).toBeGreaterThan(10);
  });

  it('les 16 tours peuvent être appris, 14 au plus à la fois ; oublier libère une place', () => {
    let s = eager();
    const order: TrickId[] = ['sit', 'beg', 'jump', 'down', 'roll', 'paw', 'spin', 'howl', 'dig', 'sniff', 'bark', 'scratch', 'flip', 'handstand', 'playdead', 'dance'];
    for (const id of order) {
      for (let day = 0; day < 6 && !trick(s, id)?.learned; day++) {
        s = learn(s, id);
        if (!trick(s, id)?.learned) s = reduce(s, { type: 'session/resume', now: s.save.lastSeenAt + DAY, tzOffsetMin: TZ });
      }
    }
    const learned = dog(s).tricks.filter((t) => t.learned).map((t) => t.trickId);
    expect(learned).toHaveLength(TR.maxTricks);
    const missing = order.filter((id) => !learned.includes(id));
    expect(missing).toHaveLength(2);

    // F-DRE-6 : oublier deux tours de base pour apprendre les deux derniers.
    s = reduce(s, { type: 'trick/forget', trickId: 'howl' });
    s = reduce(s, { type: 'trick/forget', trickId: 'bark' });
    for (const id of missing) {
      for (let day = 0; day < 6 && !trick(s, id)?.learned; day++) {
        s = learn(s, id);
        if (!trick(s, id)?.learned) s = reduce(s, { type: 'session/resume', now: s.save.lastSeenAt + DAY, tzOffsetMin: TZ });
      }
      expect(trick(s, id)?.learned).toBe(true);
    }
    const all = new Set([...learned, ...missing]);
    expect(all.size).toBe(16);
  });
});

describe('F-DRE-6 : réenregistrer ou supprimer', () => {
  it('renommer l’ordre d’un tour', () => {
    let s = learn(eager(), 'paw');
    s = reduce(s, { type: 'trick/relabel', trickId: 'paw', label: 'Tape' });
    expect(trick(s, 'paw')?.command.label).toBe('Tape');
  });

  it('supprimer un tour', () => {
    let s = learn(eager(), 'paw');
    s = reduce(s, { type: 'trick/forget', trickId: 'paw' });
    expect(trick(s, 'paw')).toBeUndefined();
  });

  it('enregistrer une empreinte vocale, au plus 5 par ordre', () => {
    let s = learn(eager(), 'paw');
    for (let i = 0; i < 7; i++) s = reduce(s, { type: 'trick/voice', trickId: 'paw', template: [[i, 1, 2]] });
    expect(trick(s, 'paw')?.command.voice).toHaveLength(5);
    s = reduce(s, { type: 'trick/voiceClear', trickId: 'paw' });
    expect(trick(s, 'paw')?.command.voice ?? []).toHaveLength(0);
  });
});
