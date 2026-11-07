import { Container, Graphics } from 'pixi.js';
import type { GardenSpot } from '../sim/state';
import type { Room } from './room';

const SOIL = 0x8a5a36;
const SOIL_TOP = 0xa8744a;
const HOLE = 0x4a2f1a;

/** D-98 : petits tas de terre du jardin, et les trous une fois creusés. */
export class GardenView {
  private readonly g = new Graphics();
  private hitBoxes: { id: string; x: number; y: number; r: number }[] = [];

  constructor(layer: Container, private readonly room: Room) {
    this.g.zIndex = -1.5;
    layer.addChild(this.g);
  }

  /** Où toucher chaque tas (tests). */
  targets(): { id: string; x: number; y: number }[] {
    return this.hitBoxes.map((h) => ({ id: h.id, x: h.x, y: h.y }));
  }

  hitTest(x: number, y: number): string | null {
    for (const h of this.hitBoxes) if (Math.hypot(x - h.x, y - h.y) <= h.r) return h.id;
    return null;
  }

  update(spots: readonly GardenSpot[], t: number): void {
    const g = this.g;
    g.clear();
    this.hitBoxes = [];
    for (const p of spots) {
      const f = this.room.floorToScreen(p.pos);
      const s = f.s;
      if (p.dug) {
        g.ellipse(f.x, f.y, s * 0.14, s * 0.045).fill(HOLE);
        g.ellipse(f.x + s * 0.16, f.y - s * 0.01, s * 0.06, s * 0.025).fill(SOIL);
        g.ellipse(f.x - s * 0.15, f.y + s * 0.005, s * 0.05, s * 0.02).fill(SOIL);
        continue;
      }
      // Un tas qui frémit un peu : quelque chose dessous ?
      const k = 1 + 0.03 * Math.sin(t / 380 + f.x);
      g.ellipse(f.x, f.y, s * 0.15, s * 0.05).fill({ color: 0x3a2618, alpha: 0.15 });
      g.ellipse(f.x, f.y - s * 0.02 * k, s * 0.13, s * 0.055 * k).fill(SOIL).stroke({ width: 2, color: 0x5e3b22 });
      g.ellipse(f.x - s * 0.02, f.y - s * 0.04 * k, s * 0.07, s * 0.025).fill(SOIL_TOP);
      for (const dx of [-0.08, 0.02, 0.09]) g.moveTo(f.x + dx * s, f.y - s * 0.01).lineTo(f.x + dx * s + 3, f.y - s * 0.06).stroke({ width: 2, color: 0x5f9e5a, cap: 'round' });
      this.hitBoxes.push({ id: p.id, x: f.x, y: f.y - s * 0.03, r: Math.max(34, s * 0.16) });
    }
  }
}
