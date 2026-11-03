import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/data/balance';
import {
  baseScores,
  createMind,
  greetIntensity,
  handleGesture,
  startGreeting,
  tickMind,
  type Gesture,
  type PuppyContext,
  type PuppyMind,
} from '../../src/sim/behavior';

const P = BALANCE.puppy;
const ctx: PuppyContext = {
  traits: { docility: 0.5, energy: 0.9, boldness: 0.7 },
  affection: 30,
  energy: 100,
  hunger: 80,
  thirst: 80,
  cleanliness: 90,
  night: false,
  bowls: [],
};

function run(m: PuppyMind, ms: number, c: PuppyContext = ctx): PuppyMind {
  let mind = m;
  for (let t = 0; t < ms; t += 100) mind = tickMind(mind, 100, c).mind;
  return mind;
}
const g = (m: PuppyMind, gesture: Gesture, c: PuppyContext = ctx) => handleGesture(m, gesture, c);
const eventsOf = (m: PuppyMind) => m.events.map((e) => e.type);
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe('Choix de l’activité (SPEC, Modèle de simulation)', () => {
  it('donne les scores de départ du tableau', () => {
    const m = createMind(1);
    const s = baseScores({ ...m, callUntil: m.t + 1000, handOnDogUntil: m.t + 1000, sulkUntil: m.t + 1000, lastAloneRefAt: -60_000 }, ctx);
    expect(s.wander).toBe(30);
    expect(s.come).toBe(50 + 30 / 2);
    expect(s.petted).toBe(70);
    expect(s.sulk).toBe(60);
    expect(s.spontaneous).toBe(25 + 100 / 4);
  });

  it('n’offre que les activités dont la condition est remplie', () => {
    const s = baseScores(createMind(1), ctx);
    expect(Object.keys(s)).toEqual(['wander']);
  });

  it('revoit son choix toutes les 500 ms', () => {
    let m = createMind(1);
    const first = m.nextDecisionAt;
    m = run(m, 400);
    expect(m.nextDecisionAt).toBe(first);
    m = run(m, 200);
    expect(m.nextDecisionAt).toBeGreaterThan(first);
    expect(m.nextDecisionAt - first).toBe(P.decisionIntervalMs);
  });

  it('est reproductible avec la même graine', () => {
    expect(run(createMind(7), 30_000)).toEqual(run(createMind(7), 30_000));
  });
});

describe('Flâner seul', () => {
  it('se déplace de lui-même et reste dans la pièce', () => {
    let m = createMind(3);
    const positions = new Set<string>();
    for (let i = 0; i < 600; i++) {
      m = tickMind(m, 100, ctx).mind;
      positions.add(`${m.pos.x.toFixed(2)},${m.pos.z.toFixed(2)}`);
      expect(m.pos.x).toBeGreaterThanOrEqual(P.floor.minX);
      expect(m.pos.x).toBeLessThanOrEqual(P.floor.maxX);
      expect(m.pos.z).toBeGreaterThanOrEqual(P.floor.minZ);
      expect(m.pos.z).toBeLessThanOrEqual(P.floor.maxZ);
    }
    expect(positions.size).toBeGreaterThan(20);
  });

  it('fait un geste spontané après 20 s sans interaction', () => {
    let m = createMind(5);
    m = run(m, 19_000);
    expect(m.events.some((e) => e.spontaneous)).toBe(false);
    m = run(m, 3000);
    expect(m.events.some((e) => e.spontaneous)).toBe(true);
  });

  it('change de posture au repos (debout, assis, couché)', () => {
    const postures = new Set<string>();
    for (let seed = 1; seed < 6; seed++) {
      let m = createMind(seed);
      for (let i = 0; i < 900; i++) {
        m = tickMind(m, 100, ctx).mind;
        postures.add(m.posture);
      }
    }
    expect(postures).toContain('stand');
    expect(postures).toContain('sit');
    expect(postures).toContain('lie');
  });
});

describe('F-MAIN-1 : caresse sur la tête, le dos ou le ventre', () => {
  for (const part of ['head', 'back', 'belly'] as const) {
    it(`réagit tout de suite à une caresse sur ${part}`, () => {
      const r = g(createMind(1), { kind: 'stroke', part, distancePx: 10 });
      expect(r.mind.activity).toBe('petted');
      expect(r.mind.mood).toBe('content');
      expect(r.mind.gait).toBe('still');
    });
  }

  it('compte une caresse tous les 60 px, au plus toutes les 2 s', () => {
    let m = createMind(1);
    let caresses = 0;
    let r = g(m, { kind: 'stroke', part: 'back', distancePx: 40 });
    caresses += r.effects.caresses;
    r = g(r.mind, { kind: 'stroke', part: 'back', distancePx: 30 });
    caresses += r.effects.caresses;
    expect(caresses).toBe(1);
    expect(r.effects.affectionDelta).toBe(0); // l'affection est appliquée par le jeu, plafond compris
    m = r.mind;
    r = g(m, { kind: 'stroke', part: 'back', distancePx: 80 });
    expect(r.effects.caresses).toBe(0);
    m = run(r.mind, 2000);
    r = g(m, { kind: 'stroke', part: 'back', distancePx: 80 });
    expect(r.effects.caresses).toBe(1);
  });

  it('remue la queue plus vite pendant la caresse', () => {
    const before = createMind(1);
    const after = g(before, { kind: 'stroke', part: 'head', distancePx: 70 }).mind;
    expect(after.excitement).toBeGreaterThan(before.excitement);
  });
});

describe('F-MAIN-2 : main immobile près du museau', () => {
  it('renifle, puis lèche', () => {
    let m = g(createMind(1), { kind: 'present' }).mind;
    expect(m.activity).toBe('sniffHand');
    expect(m.handPhase).toBe('sniff');
    expect(eventsOf(m)).toContain('sniff');
    m = run(m, P.hand.sniffMs + 100);
    expect(m.handPhase).toBe('lick');
    expect(eventsOf(m)).toContain('lick');
  });

  it('arrête quand la main s’en va', () => {
    let m = g(createMind(1), { kind: 'present' }).mind;
    m = g(m, { kind: 'presentEnd' }).mind;
    m = run(m, 1000);
    expect(m.activity).not.toBe('sniffHand');
  });
});

describe('F-MAIN-3 : toucher l’écran à répétition', () => {
  it('un seul toucher : dresse les oreilles et regarde le point, sans venir', () => {
    const at = { x: 0.6, z: 0.8 };
    const m = g(createMind(1), { kind: 'tap', at }).mind;
    expect(eventsOf(m)).toContain('perk');
    expect(m.look).toEqual({ kind: 'point', x: 0.6, z: 0.8 });
    expect(m.mood).toBe('curious');
    expect(run(m, 3000).activity).not.toBe('come');
  });

  it('deux touchers en moins de 1,2 s : regarde, puis vient au point', () => {
    const at = { x: 0.5, z: 0.85 };
    let m = createMind(1);
    m = g(m, { kind: 'tap', at }).mind;
    m = run(m, 500);
    m = g(m, { kind: 'tap', at }).mind;
    expect(m.activity).toBe('come');
    expect(m.gait).toBe('still');
    m = run(m, P.taps.lookBeforeComeMs + 100);
    expect(m.gait).not.toBe('still');
    m = run(m, 5000);
    expect(dist(m.pos, at)).toBeLessThan(0.05);
  });

  it('deux touchers espacés de plus de 1,2 s : ne vient pas', () => {
    let m = g(createMind(1), { kind: 'tap', at: null }).mind;
    m = run(m, 1500);
    m = g(m, { kind: 'tap', at: null }).mind;
    expect(m.activity).not.toBe('come');
  });
});

describe('F-MAIN-4 : tirer la queue ou les oreilles', () => {
  it('un tirage : surprise ou jeu, sans perte d’affection', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      const r = g(createMind(seed), { kind: 'pull', part: 'tail' });
      expect(r.effects.affectionDelta).toBe(0);
      const e = eventsOf(r.mind);
      seen.add(e.includes('startle') ? 'surprise' : e.includes('playBow') ? 'jeu' : 'autre');
    }
    expect(seen).toEqual(new Set(['surprise', 'jeu']));
  });

  it('trois tirages en 10 s : recule, boude et perd de l’affection', () => {
    let m = createMind(1);
    const start = { ...m.pos };
    let delta = 0;
    for (let i = 0; i < 3; i++) {
      const r = g(m, { kind: 'pull', part: i % 2 ? 'ear' : 'tail' });
      delta += r.effects.affectionDelta;
      m = run(r.mind, 1000);
    }
    expect(delta).toBe(-P.pull.affectionLoss);
    expect(eventsOf(m)).toContain('backOff');
    expect(m.activity).toBe('sulk');
    expect(m.mood).toBe('sulky');
    expect(m.attentive).toBe(false);
    m = run(m, 1500);
    expect(dist(m.pos, start)).toBeGreaterThan(0.1);
  });

  it('chaque tirage suivant coûte encore de l’affection', () => {
    let m = createMind(1);
    let delta = 0;
    for (let i = 0; i < 5; i++) {
      const r = g(m, { kind: 'pull', part: 'tail' });
      delta += r.effects.affectionDelta;
      m = run(r.mind, 500);
    }
    expect(delta).toBe(-3 * P.pull.affectionLoss);
  });

  it('des tirages espacés de plus de 10 s ne font pas bouder', () => {
    let m = createMind(1);
    for (let i = 0; i < 3; i++) {
      m = g(m, { kind: 'pull', part: 'tail' }).mind;
      m = run(m, 6000);
    }
    expect(m.activity).not.toBe('sulk');
  });
});

describe('F-MAIN-5 : main levée au-dessus du museau', () => {
  it('suit des yeux vers le haut', () => {
    const m = g(createMind(1), { kind: 'raise' }).mind;
    expect(m.look.kind).toBe('up');
    expect(m.activity).toBe('attend');
    expect(m.attentive).toBe(true);
  });

  it('peut s’asseoir, d’autant plus qu’il est docile', () => {
    const sitRate = (docility: number) => {
      let sits = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const c = { ...ctx, traits: { ...ctx.traits, docility } };
        let m: PuppyMind = { ...createMind(seed), posture: 'stand' };
        m = g(m, { kind: 'raise' }, c).mind;
        m = run(m, P.raise.sitDelayMs + 200, c);
        if (m.posture === 'sit') sits++;
      }
      return sits / 300;
    };
    const low = sitRate(0.1);
    const high = sitRate(0.9);
    expect(low).toBeCloseTo(P.raise.sitChanceBase + 0.1 * P.raise.sitChancePerDocility, 1);
    expect(high).toBeCloseTo(P.raise.sitChanceBase + 0.9 * P.raise.sitChancePerDocility, 1);
  });
});

describe('F-MAIN-6 : pousser le ventre ou le flanc', () => {
  it('debout ou assis : se couche', () => {
    for (const posture of ['stand', 'sit'] as const) {
      const m = g({ ...createMind(1), posture }, { kind: 'push', part: 'flank' }).mind;
      expect(m.posture).toBe('lie');
    }
  });

  it('couché : se roule sur le côté', () => {
    const m = g({ ...createMind(1), posture: 'lie' }, { kind: 'push', part: 'belly' }).mind;
    expect(m.posture).toBe('side');
    expect(eventsOf(m)).toContain('flop');
  });

  it('reste couché un moment au lieu de se relever aussitôt', () => {
    let m = g({ ...createMind(1), posture: 'stand' }, { kind: 'push', part: 'flank' }).mind;
    m = run(m, 1500);
    expect(m.posture).toBe('lie');
  });
});

describe('Réaction immédiate (critère : moins de 100 ms)', () => {
  const gestures: Gesture[] = [
    { kind: 'stroke', part: 'back', distancePx: 20 },
    { kind: 'present' },
    { kind: 'tap', at: null },
    { kind: 'pull', part: 'tail' },
    { kind: 'raise' },
    { kind: 'push', part: 'flank' },
  ];
  for (const gesture of gestures) {
    it(`${gesture.kind} change l’état sans attendre de pas de simulation`, () => {
      const m = run(createMind(2), 3000);
      const r = g(m, gesture);
      expect(r.mind.t).toBe(m.t);
      expect(r.mind.reactionSeq).toBeGreaterThan(m.reactionSeq);
    });
  }
});

describe('Humeurs lisibles sans texte', () => {
  it('au moins 3 humeurs distinctes selon la situation', () => {
    const moods = new Set<string>();
    moods.add(g(createMind(1), { kind: 'stroke', part: 'back', distancePx: 70 }).mind.mood);
    moods.add(g(createMind(1), { kind: 'tap', at: null }).mind.mood);
    moods.add(startGreeting(createMind(1), 3 * 3_600_000).mood);
    let m = createMind(1);
    for (let i = 0; i < 3; i++) m = g(m, { kind: 'pull', part: 'tail' }).mind;
    moods.add(m.mood);
    expect(moods).toEqual(new Set(['content', 'curious', 'happy', 'sulky']));
  });

  it('ne garde pas la bouderie indéfiniment', () => {
    let m = createMind(1);
    for (let i = 0; i < 3; i++) m = g(m, { kind: 'pull', part: 'tail' }).mind;
    m = run(m, P.pull.sulkMs + 2000);
    expect(m.mood).not.toBe('sulky');
  });
});

describe('F-VIE-2 : retour du joueur', () => {
  it('l’intensité dépend de l’absence', () => {
    const [a, b, c] = P.greet.thresholdsMs;
    expect(greetIntensity(a - 1)).toBe(0);
    expect(greetIntensity(a)).toBe(1);
    expect(greetIntensity(b)).toBe(2);
    expect(greetIntensity(c)).toBe(3);
    expect(greetIntensity(30 * 24 * 3_600_000)).toBe(3);
  });

  it('une horloge qui recule ne déclenche pas d’accueil', () => {
    expect(greetIntensity(-5 * 3_600_000)).toBe(0);
    expect(startGreeting(createMind(1), -5 * 3_600_000).activity).not.toBe('greet');
  });

  it('accourt vers le joueur, d’autant plus vite que l’absence est longue', () => {
    const short = startGreeting(createMind(1), 10 * 60_000);
    const long = startGreeting(createMind(1), 2 * 24 * 3_600_000);
    expect(short.activity).toBe('greet');
    expect(long.activity).toBe('greet');
    expect(short.gait).toBe('trot');
    expect(long.gait).toBe('run');
    expect(long.mood).toBe('happy');

    const arrive = (m: PuppyMind) => {
      for (let t = 0; t < 10_000; t += 100) {
        m = tickMind(m, 100, ctx).mind;
        if (dist(m.pos, P.floor.front) < 0.05) return t;
      }
      return Infinity;
    };
    expect(arrive(long)).toBeLessThan(arrive(short));
    expect(arrive(long)).toBeLessThan(2000);
  });

  it('fait la fête plus fort après une longue absence', () => {
    const count = (m: PuppyMind) => run(m, 7000).events.filter((e) => ['bark', 'jump', 'spin', 'whine'].includes(e.type)).length;
    expect(count(startGreeting(createMind(1), 2 * 24 * 3_600_000))).toBeGreaterThan(
      count(startGreeting(createMind(1), 10 * 60_000)),
    );
  });

  it('regarde le joueur une fois arrivé', () => {
    const m = run(startGreeting(createMind(1), 3 * 3_600_000), 2500);
    expect(m.look.kind).toBe('player');
    expect(Math.abs(m.facing)).toBeLessThan(0.3);
  });
});
