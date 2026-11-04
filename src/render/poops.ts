import { Container, Graphics } from 'pixi.js';
import type { Poop } from '../sim/state';
import type { Room } from './room';

const BROWN = 0x6b4527;
const DARK = 0x4a2f1a;
const SHINE = 0x9a6a40;

/** D-74 : besoins au salon ; des mouches tournent autour de ceux qu'on a oubliés. */
export class PoopsView {
  private readonly items = new Map<string, Graphics>();
  private hitBoxes: { id: string; x: number; y: number; r: number }[] = [];

  constructor(
    private readonly layer: Container,
    private readonly room: Room,
  ) {}

  /** Où toucher chaque besoin (tests). */
  targets(): { id: string; x: number; y: number }[] {
    return this.hitBoxes.map((h) => ({ id: h.id, x: h.x, y: h.y }));
  }

  hitTest(x: number, y: number): string | null {
    for (const h of this.hitBoxes) if (Math.hypot(x - h.x, y - h.y) <= h.r) return h.id;
    return null;
  }

  update(poops: readonly Poop[], t: number): void {
    const alive = new Set(poops.map((p) => p.id));
    for (const [id, g] of this.items) {
      if (!alive.has(id)) {
        g.destroy();
        this.items.delete(id);
      }
    }
    this.hitBoxes = [];
    for (const p of poops) {
      let g = this.items.get(p.id);
      if (!g) {
        g = new Graphics();
        this.items.set(p.id, g);
        this.layer.addChild(g);
      }
      const f = this.room.floorToScreen(p.pos);
      const s = f.s;
      g.clear();
      g.zIndex = p.pos.z - 0.01;
      g.ellipse(f.x, f.y, s * 0.075, s * 0.022).fill({ color: 0x3a2618, alpha: 0.2 });
      // Trois boudins empilés, de plus en plus petits.
      g.ellipse(f.x, f.y - s * 0.02, s * 0.07, s * 0.028).fill(BROWN).stroke({ width: 2, color: DARK });
      g.ellipse(f.x + s * 0.004, f.y - s * 0.048, s * 0.05, s * 0.022).fill(BROWN).stroke({ width: 2, color: DARK });
      g.ellipse(f.x - s * 0.004, f.y - s * 0.07, s * 0.028, s * 0.016).fill(BROWN).stroke({ width: 2, color: DARK });
      g.ellipse(f.x - s * 0.02, f.y - s * 0.052, s * 0.012, s * 0.006).fill(SHINE);
      if (p.forgotten) {
        for (let k = 0; k < 3; k++) {
          const a = t / (260 + k * 70) + k * 2.1;
          const fx = f.x + Math.cos(a) * s * 0.1;
          const fy = f.y - s * 0.13 + Math.sin(a * 1.7) * s * 0.05;
          g.circle(fx, fy, s * 0.009).fill(0x222222);
          g.ellipse(fx - s * 0.008, fy - s * 0.008, s * 0.008, s * 0.004).fill({ color: 0xffffff, alpha: 0.7 });
        }
      }
      this.hitBoxes.push({ id: p.id, x: f.x, y: f.y - s * 0.04, r: Math.max(34, s * 0.11) });
    }
  }
}
