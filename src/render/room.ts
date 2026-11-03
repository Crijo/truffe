import { BALANCE } from '../data/balance';
import type { Vec2 } from '../sim/behavior';

const F = BALANCE.puppy.floor;
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Géométrie du salon : passage entre le sol de la simulation et l'écran. */
export class Room {
  w = 1;
  h = 1;
  /** Part de la hauteur occupée par le mur. */
  readonly horizonRatio = 0.55;

  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
  }

  get horizon(): number {
    return Math.round(this.h * this.horizonRatio);
  }
  private get yBack(): number {
    return this.horizon + (this.h - this.horizon) * 0.2;
  }
  /** Bord avant du sol, au-dessus de la barre basse pour ne pas cacher les pattes. */
  private get yFront(): number {
    return this.h - Math.max((this.h - this.horizon) * 0.07, 104);
  }
  /** Pixels par unité du chiot, au premier plan. */
  get sNear(): number {
    return Math.min(this.w * 0.6, this.h * 0.36, 330);
  }

  scaleAt(z: number): number {
    return lerp(this.sNear * 0.55, this.sNear, z);
  }

  private halfWidth(z: number): number {
    return Math.max(0, (this.w / 2) * lerp(0.62, 1, z) - 0.42 * this.scaleAt(z));
  }

  floorToScreen(p: Vec2): { x: number; y: number; s: number } {
    return {
      x: this.w / 2 + (p.x / F.maxX) * this.halfWidth(p.z),
      y: lerp(this.yBack, this.yFront, p.z),
      s: this.scaleAt(p.z),
    };
  }

  /** Point du sol sous un point de l'écran, ou null sur le mur. */
  screenToFloor(x: number, y: number): Vec2 | null {
    if (y < this.horizon) return null;
    const z = Math.min(1, Math.max(0, (y - this.yBack) / (this.yFront - this.yBack)));
    const hw = this.halfWidth(z) || 1;
    return { x: ((x - this.w / 2) / hw) * F.maxX, z };
  }

  /**
   * Vitesse du doigt (px/s) en vitesse au sol, à la hauteur `y` de l'écran (F-JEU-1).
   * Un geste vers le haut lance vers le fond de la pièce.
   */
  fingerToFloorVelocity(vxPx: number, vyPx: number, y: number): { vx: number; vz: number } {
    const z = Math.min(1, Math.max(0, (y - this.yBack) / (this.yFront - this.yBack)));
    // Un geste vif (≈ 1 500 px/s) lance à travers la pièce sans tout faire rebondir sur les murs.
    const k = BALANCE.toys.fingerSensitivity;
    return {
      vx: (vxPx / (this.halfWidth(z) || 1)) * F.maxX * k,
      vz: (vyPx / (this.yFront - this.yBack)) * k,
    };
  }

  /** Unités du chiot par unité de sol (x, z), pour viser un point du sol. */
  floorUnits(z: number): { x: number; z: number } {
    const s = this.scaleAt(z);
    return { x: this.halfWidth(z) / F.maxX / s, z: 2.6 };
  }
}
