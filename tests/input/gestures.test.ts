import { beforeEach, describe, expect, it } from 'vitest';
import { GestureRecognizer, type PuppyProbe } from '../../src/input/gestures';
import type { BodyPart, Gesture } from '../../src/sim/behavior';

/**
 * Chiot factice vu de face : tête centrée en (200, 200), rayon 50 ;
 * corps (dos en haut, flanc au milieu, ventre en bas) de y = 250 à 400 ; queue à droite.
 */
const probe: PuppyProbe = {
  hitTest(x, y): BodyPart | null {
    if (Math.hypot(x - 200, y - 200) < 50) return y > 215 ? 'muzzle' : 'head';
    if (x > 330 && x < 380 && y > 280 && y < 320) return 'tail';
    if (x > 120 && x < 280 && y > 250 && y < 400) return y < 300 ? 'back' : y < 350 ? 'flank' : 'belly';
    return null;
  },
  nose: () => ({ x: 200, y: 225 }),
  headTop: () => ({ x: 200, y: 150 }),
  headRadius: () => 50,
  toFloor: (_x, y) => (y > 300 ? { x: 0.1, z: 0.7 } : null),
  bodyCenter: () => ({ x: 200, y: 300 }),
};

let out: Gesture[];
let r: GestureRecognizer;
beforeEach(() => {
  out = [];
  r = new GestureRecognizer(probe, (g) => out.push(g));
});
const kinds = () => out.map((g) => g.kind);

function drag(from: [number, number], to: [number, number], ms: number, steps = 10, t0 = 0): number {
  r.down(from[0], from[1], t0, 'touch');
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    r.move(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, t0 + ms * k);
  }
  return t0 + ms;
}

describe('F-MAIN-1 : glisser sur le chiot', () => {
  it('émet des caresses avec la partie touchée et la distance', () => {
    const t = drag([150, 270], [250, 270], 600);
    r.up(250, 270, t);
    const strokes = out.filter((g) => g.kind === 'stroke');
    expect(strokes.length).toBeGreaterThan(5);
    expect(strokes.every((g) => g.kind === 'stroke' && g.part === 'back')).toBe(true);
    const total = strokes.reduce((s, g) => s + (g.kind === 'stroke' ? g.distancePx : 0), 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('émet la première caresse dès le premier mouvement', () => {
    r.down(150, 270, 0, 'touch');
    r.move(155, 270, 16);
    expect(kinds()).toEqual(['stroke']);
  });
});

describe('F-MAIN-6 : pousser le flanc ou le ventre', () => {
  it('un geste vif sur le flanc est une poussée', () => {
    drag([150, 320], [200, 320], 150);
    expect(kinds()).toContain('push');
    expect(out.find((g) => g.kind === 'push')).toEqual({ kind: 'push', part: 'flank' });
    const after = out.slice(out.findIndex((g) => g.kind === 'push') + 1);
    expect(after.some((g) => g.kind === 'stroke')).toBe(false);
  });

  it('un glissement lent sur le flanc reste une caresse', () => {
    drag([150, 320], [200, 320], 700);
    expect(kinds()).not.toContain('push');
    expect(kinds()).toContain('stroke');
  });
});

describe('F-MAIN-4 : tirer la queue', () => {
  it('un tirage par appui, après quelques pixels', () => {
    drag([350, 300], [390, 300], 200);
    expect(out.filter((g) => g.kind === 'pull')).toEqual([{ kind: 'pull', part: 'tail' }]);
    expect(kinds()).not.toContain('stroke');
  });
});

describe('F-MAIN-3 : toucher l’écran', () => {
  it('un toucher bref hors du chiot est un « tap » avec le point au sol', () => {
    r.down(60, 380, 0, 'touch');
    r.up(61, 381, 120);
    expect(out).toEqual([{ kind: 'tap', at: { x: 0.1, z: 0.7 } }]);
  });

  it('sur le mur, le point est inconnu', () => {
    r.down(60, 60, 0, 'touch');
    r.up(60, 60, 100);
    expect(out).toEqual([{ kind: 'tap', at: null }]);
  });

  it('un toucher bref sur le chiot est un « touch »', () => {
    r.down(200, 270, 0, 'touch');
    r.up(200, 270, 100);
    expect(out).toEqual([{ kind: 'touch', part: 'back' }]);
  });

  it('un appui long n’est pas un toucher', () => {
    r.down(60, 380, 0, 'touch');
    r.up(60, 380, 900);
    expect(kinds()).not.toContain('tap');
  });
});

describe('F-MAIN-2 : main immobile près du museau', () => {
  it('au doigt : après un court maintien immobile', () => {
    r.down(260, 230, 0, 'touch');
    r.update(200);
    expect(kinds()).not.toContain('present');
    r.update(500);
    expect(kinds()).toContain('present');
    r.up(260, 230, 600);
    expect(kinds()).toContain('presentEnd');
  });

  it('à la souris, sans cliquer', () => {
    r.hover(260, 230, 0);
    r.update(500);
    expect(kinds()).toContain('present');
    r.hover(30, 30, 600);
    r.update(620);
    expect(kinds()).toContain('presentEnd');
  });

  it('une main qui bouge ne compte pas', () => {
    for (let t = 0; t <= 600; t += 50) {
      r.hover(240 + (t % 100 === 0 ? 0 : 30), 230, t);
      r.update(t);
    }
    expect(kinds()).not.toContain('present');
  });
});

describe('F-MAIN-5 : main au-dessus du museau', () => {
  it('lever la main au-dessus de la tête', () => {
    r.down(330, 200, 0, 'touch');
    r.move(200, 120, 300);
    r.update(350);
    expect(kinds()).not.toContain('raise');
    r.update(520);
    expect(kinds()).toContain('raise');
    r.move(400, 120, 600);
    r.update(620);
    expect(kinds()).toContain('raiseEnd');
  });
});

describe('Regard', () => {
  it('le doigt posé est suivi ; la souris aussi, tant qu’elle reste sur la scène', () => {
    r.down(10, 20, 0, 'touch');
    expect(r.pointerAt(10)).toEqual({ x: 10, y: 20 });
    r.up(10, 20, 50);
    expect(r.pointerAt(60)).toBeNull();
    r.hover(30, 40, 100);
    expect(r.pointerAt(5000)).toEqual({ x: 30, y: 40 });
    r.leave();
    expect(r.pointerAt(5000)).toBeNull();
  });
});

describe('F-MAIN-2 : souris immobile', () => {
  it('une souris posée près du museau reste « présentée » sans bouger', () => {
    r.hover(260, 230, 0);
    r.update(500);
    r.update(10_000);
    expect(kinds()).toEqual(['present']);
    r.leave();
    expect(kinds()).toEqual(['present', 'presentEnd']);
  });
});

describe('Dressage : nouveaux gestes', () => {
  it('Couché : appui immobile sur le dos', () => {
    r.down(200, 270, 0, 'touch');
    r.update(300);
    expect(kinds()).not.toContain('press');
    r.update(500);
    expect(out.find((g) => g.kind === 'press')).toEqual({ kind: 'press', part: 'back' });
    r.update(900);
    expect(out.filter((g) => g.kind === 'press')).toHaveLength(1);
    r.up(200, 270, 1000);
    expect(kinds()).not.toContain('touch');
  });

  it('Tourne : un cercle dessiné autour du chiot', () => {
    const c = { x: 200, y: 300 };
    const R = 170;
    // Départ sous le chiot (pas sur la queue, qu'on tirerait).
    r.down(c.x, c.y + R, 0, 'touch');
    for (let i = 1; i <= 40; i++) {
      const a = Math.PI / 2 + (i / 40) * Math.PI * 2;
      r.move(c.x + R * Math.cos(a), c.y + R * Math.sin(a), i * 30);
    }
    expect(kinds()).toContain('circle');
    expect(out.filter((g) => g.kind === 'circle')).toHaveLength(1);
  });

  it('un demi-cercle ne suffit pas', () => {
    const c = { x: 200, y: 300 };
    r.down(c.x + 170, c.y, 0, 'touch');
    for (let i = 1; i <= 20; i++) r.move(c.x + 170 * Math.cos((i / 40) * Math.PI * 2), c.y + 170 * Math.sin((i / 40) * Math.PI * 2), i * 30);
    expect(kinds()).not.toContain('circle');
  });

  it('Saut : main levée vite, signalée tout de suite', () => {
    r.down(330, 300, 0, 'touch');
    r.move(200, 120, 60);
    expect(out.find((g) => g.kind === 'raise')).toEqual({ kind: 'raise', fast: true });
  });

  it('main levée lentement : pas de « vite »', () => {
    r.down(330, 200, 0, 'touch');
    r.move(200, 140, 600);
    r.update(900);
    expect(out.find((g) => g.kind === 'raise')).toEqual({ kind: 'raise', fast: false });
  });
});
