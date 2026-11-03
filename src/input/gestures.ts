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
  /** Centre du corps à l'écran (pour le cercle de « Tourne »). */
  bodyCenter(): { x: number; y: number };
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
  mode: 'free' | 'pull' | 'push' | 'press';
  /** Cercle autour du chiot : angle cumulé et début du tour. */
  angle: number;
  lastAngle: number | null;
  circleT0: number;
}

const G = BALANCE.gestures;
const pullable = (p: BodyPart | null): p is 'tail' | 'ear' => p === 'tail' || p === 'ear';
const pressable = (p: BodyPart | null): boolean => p === 'back' || p === 'flank' || p === 'belly';

export class GestureRecognizer {
  private press: Press | null = null;
  private hoverPos: { x: number; y: number; t: number } | null = null;
  private zone: Zone = null;
  private zoneSince = 0;
  private anchor = { x: 0, y: 0, t: 0 };
  private active: Zone = null;
  private last = { x: 0, y: 0, t: 0 };
  private raiseFast = false;

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
    this.press = { x0: x, y0: y, t0: t, x, y, part: this.probe.hitTest(x, y), path: 0, mode: 'free', angle: 0, lastAngle: null, circleT0: t };
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
    } else if (p.mode !== 'push' && p.mode !== 'press') {
      if ((p.part === 'flank' || p.part === 'belly') && t - p.t0 <= G.pushMaxMs && disp >= G.pushMinPx) {
        p.mode = 'push';
        this.emit({ kind: 'push', part: p.part });
      } else if (step > 0) {
        const cur = this.probe.hitTest(x, y);
        if (cur && !pullable(cur)) this.emit({ kind: 'stroke', part: cur, distancePx: step });
      }
    }
    if (!pullable(p.part)) this.trackCircle(p, x, y, t);
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
    const p = this.press;
    // « Couché » : appui immobile sur le dos, le flanc ou le ventre.
    if (p && p.mode === 'free' && pressable(p.part) && p.path < G.tapMaxMovePx && t - p.t0 >= G.pressHoldMs) {
      p.mode = 'press';
      this.emit({ kind: 'press', part: p.part ?? 'back' });
    }
    if (p && p.mode !== 'free') return;
    if (this.zone === 'raise' && this.active !== 'raise' && t - this.zoneSince >= G.raiseHoldMs) this.setActive('raise');
    if (this.zone === 'present' && this.active !== 'present' && t - this.anchor.t >= G.presentHoldMs) this.setActive('present');
  }

  /** « Tourne » : un tour presque complet autour du centre du corps, assez loin de lui. */
  private trackCircle(p: Press, x: number, y: number, t: number): void {
    const c = this.probe.bodyCenter();
    const r = Math.hypot(x - c.x, y - c.y);
    if (r < this.probe.headRadius() * 1.2) {
      p.lastAngle = null;
      return;
    }
    const a = Math.atan2(y - c.y, x - c.x);
    if (p.lastAngle !== null) {
      let d = a - p.lastAngle;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      p.angle += d;
    } else p.circleT0 = t;
    p.lastAngle = a;
    if (t - p.circleT0 > G.circleMaxMs) {
      p.angle = 0;
      p.circleT0 = t;
    }
    if (Math.abs(p.angle) >= Math.PI * 2 * G.circleTurns) {
      p.angle = 0;
      p.circleT0 = t;
      this.emit({ kind: 'circle' });
    }
  }

  private track(x: number, y: number, t: number): void {
    const dt = Math.max(1, t - this.last.t);
    const upSpeed = ((this.last.y - y) / dt) * 1000;
    this.last = { x, y, t };
    const zone = this.zoneOf(x, y);
    if (zone !== this.zone) {
      this.zone = zone;
      this.zoneSince = t;
      this.anchor = { x, y, t };
      if (this.active && this.active !== zone) this.setActive(null);
      // « Saut » : main levée vite, signalée sans attendre.
      this.raiseFast = zone === 'raise' && upSpeed >= G.raiseFastPxPerS;
      if (this.raiseFast) this.setActive('raise');
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
      if (this.press && pressable(this.press.part)) return null;
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
    if (zone === 'raise') this.emit({ kind: 'raise', fast: this.raiseFast });
  }
}
