import { Container, Graphics } from 'pixi.js';
import { BALANCE } from '../data/balance';
import type { BowlView, PuppyMind } from '../sim/behavior';
import type { Room } from './room';

const COLORS = {
  food: { bowl: 0xd9534f, rim: 0xe9827f, fill: 0x8a5a2e, bit: 0xa8743f },
  water: { bowl: 0x4a8fc8, rim: 0x79b2e0, fill: 0x9fd3f2, bit: 0xd8f0ff },
} as const;

/** Gamelles au sol (F-SOIN-1) ; leur contenu baisse pendant le repas. */
export class BowlsView {
  private readonly items = new Map<string, Graphics>();

  constructor(
    private readonly layer: Container,
    private readonly room: Room,
  ) {}

  update(bowls: readonly BowlView[], mind: PuppyMind | undefined): void {
    const alive = new Set(bowls.map((b) => b.id));
    for (const [id, g] of this.items) {
      if (!alive.has(id)) {
        g.destroy();
        this.items.delete(id);
      }
    }
    for (const b of bowls) {
      let g = this.items.get(b.id);
      if (!g) {
        g = new Graphics();
        this.items.set(b.id, g);
        this.layer.addChild(g);
      }
      const e = mind?.eating;
      const left = e && e.bowlId === b.id && e.until !== null ? Math.max(0, (e.until - mind.t) / BALANCE.care.eatMs) : 1;
      this.draw(g, b, left);
    }
  }

  private draw(g: Graphics, b: BowlView, left: number): void {
    const p = this.room.floorToScreen(b.pos);
    const s = p.s;
    const c = COLORS[b.kind];
    const w = s * 0.2;
    const h = s * 0.09;
    g.clear();
    g.ellipse(0, h * 0.9, w * 1.05, h * 0.35).fill({ color: 0x3a2618, alpha: 0.15 });
    g.moveTo(-w, 0).lineTo(-w * 0.78, h).lineTo(w * 0.78, h).lineTo(w, 0).fill(c.bowl).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.6 });
    g.ellipse(0, 0, w, h * 0.42).fill(c.rim).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.6 });
    if (left > 0.02) {
      g.ellipse(0, h * 0.08, w * 0.82, h * 0.3 * (0.5 + 0.5 * left)).fill(c.fill);
      if (b.kind === 'food') {
        const n = Math.round(9 * left);
        for (let i = 0; i < n; i++) g.circle(((i % 5) - 2) * w * 0.26, (Math.floor(i / 5) - 0.5) * h * 0.18, s * 0.018).fill(c.bit);
      } else {
        g.ellipse(-w * 0.3, -h * 0.02, w * 0.2, h * 0.06).fill({ color: c.bit, alpha: 0.8 });
      }
    }
    g.position.set(p.x, p.y);
    g.zIndex = b.pos.z;
  }
}
