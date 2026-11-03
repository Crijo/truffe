/**
 * Reconnaissance des gestes de la main (F-MAIN), indépendante du DOM :
 * reçoit des positions et des instants, émet des gestes pour la simulation.
 */
import { BALANCE } from '../data/balance';
import type { BodyPart, Gesture, Vec2 } from '../sim/behavior';

/** Ce que le rendu sait du chiot à l'écran. */
export interface PuppyProbe {
  hitTest(x: number, y: number): BodyPart | null;
  nose(): { x: number; y: number };
  headTop(): { x: number; y: number };
  headRadius(): number;
  toFloor(x: number, y: number): Vec2 | null;
}

type PointerKind = 'touch' | 'mouse' | 'pen';
type Zone = 'present' | 'raise' | null;

interface Press {
  x0: number;
  y0: number;
  t0: number;
  x: number;
  y: number;
  part: BodyPart | null;
  path: number;
  mode: 'free' | 'pull' | 'push';
}

const G = BALANCE.gestures;
const pullable = (p: BodyPart | null): p is 'tail' | 'ear' => p === 'tail' || p === 'ear';

export class GestureRecognizer {
  private press: Press | null = null;
  private hoverPos: { x: number; y: number; t: number } | null = null;
  private zone: Zone = null;
  private zoneSince = 0;
  private anchor = { x: 0, y: 0, t: 0 };
  private active: Zone = null;

  constructor(
    private readonly probe: PuppyProbe,
    private readonly emit: (g: Gesture) => void,
  ) {}

  /** Position à suivre du regard : doigt posé, ou souris présente sur la scène. */
  pointerAt(_t: number): { x: number; y: number } | null {
    if (this.press) return { x: this.press.x, y: this.press.y };
    if (this.hoverPos) return { x: this.hoverPos.x, y: this.hoverPos.y };
    return null;
  }

  /** La souris quitte la scène. */
  leave(): void {
    this.hoverPos = null;
    this.update(0);
  }

  down(x: number, y: number, t: number, _kind: PointerKind): void {
    this.press = { x0: x, y0: y, t0: t, x, y, part: this.probe.hitTest(x, y), path: 0, mode: 'free' };
    this.track(x, y, t);
  }

  move(x: number, y: number, t: number): void {
    const p = this.press;
    if (!p) return this.hover(x, y, t);
    const step = Math.hypot(x - p.x, y - p.y);
    p.x = x;
    p.y = y;
    p.path += step;
    const disp = Math.hypot(x - p.x0, y - p.y0);

    if (pullable(p.part)) {
      if (p.mode === 'free' && disp >= G.pullMinPx) {
        p.mode = 'pull';
        this.emit({ kind: 'pull', part: p.part });
      }
    } else if (p.mode !== 'push') {
      if ((p.part === 'flank' || p.part === 'belly') && t - p.t0 <= G.pushMaxMs && disp >= G.pushMinPx) {
        p.mode = 'push';
        this.emit({ kind: 'push', part: p.part });
      } else if (step > 0) {
        const cur = this.probe.hitTest(x, y);
        if (cur && !pullable(cur)) this.emit({ kind: 'stroke', part: cur, distancePx: step });
      }
    }
    this.track(x, y, t);
  }

  up(x: number, y: number, t: number): void {
    const p = this.press;
    this.press = null;
    if (p && p.path < G.tapMaxMovePx && t - p.t0 <= G.tapMaxMs) {
      if (p.part) this.emit({ kind: 'touch', part: p.part });
      else this.emit({ kind: 'tap', at: this.probe.toFloor(x, y) });
    }
    this.setActive(null);
    this.zone = null;
  }

  cancel(): void {
    this.press = null;
    this.setActive(null);
    this.zone = null;
  }

  /** Souris sans bouton enfoncé. */
  hover(x: number, y: number, t: number): void {
    this.hoverPos = { x, y, t };
    this.track(x, y, t);
  }

  /** À appeler à chaque image : détecte les maintiens (main présentée, main levée). */
  update(t: number): void {
    const pos = this.pointerAt(t);
    if (!pos) {
      this.setActive(null);
      this.zone = null;
      return;
    }
    if (this.press && this.press.mode !== 'free') return;
    if (this.zone === 'raise' && this.active !== 'raise' && t - this.zoneSince >= G.raiseHoldMs) this.setActive('raise');
    if (this.zone === 'present' && this.active !== 'present' && t - this.anchor.t >= G.presentHoldMs) this.setActive('present');
  }

  private track(x: number, y: number, t: number): void {
    const zone = this.zoneOf(x, y);
    if (zone !== this.zone) {
      this.zone = zone;
      this.zoneSince = t;
      this.anchor = { x, y, t };
      if (this.active && this.active !== zone) this.setActive(null);
    } else if (zone === 'present' && Math.hypot(x - this.anchor.x, y - this.anchor.y) > G.presentStillPx) {
      this.anchor = { x, y, t };
      if (this.active === 'present') this.setActive(null);
    }
  }

  private zoneOf(x: number, y: number): Zone {
    const hr = this.probe.headRadius();
    const top = this.probe.headTop();
    if (y < top.y && y > top.y - 3 * hr && Math.abs(x - top.x) < 1.3 * hr) return 'raise';
    const nose = this.probe.nose();
    if (Math.hypot(x - nose.x, y - nose.y) < 1.5 * hr) {
      if (!pullable(this.probe.hitTest(x, y))) return 'present';
    }
    return null;
  }

  private setActive(zone: Zone): void {
    if (zone === this.active) return;
    if (this.active === 'present') this.emit({ kind: 'presentEnd' });
    if (this.active === 'raise') this.emit({ kind: 'raiseEnd' });
    this.active = zone;
    if (zone === 'present') this.emit({ kind: 'present' });
    if (zone === 'raise') this.emit({ kind: 'raise' });
  }
}
