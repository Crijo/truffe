import { Container, Graphics } from 'pixi.js';
import type { Dirt } from '../sim/chores';
import type { Room } from './room';

const MUD = 0x7a5233;
const CRUMB = 0xc98f4e;
const FUR = 0xb9a58c;

/** D-91 : taches du salon (traces de pattes, miettes, poils), à plat sur le sol ; elles pâlissent quand on frotte. */
export class DirtView {
  private readonly g = new Graphics();
  private hitBoxes: { id: string; x: number; y: number; r: number }[] = [];

  constructor(layer: Container, private readonly room: Room) {
    // Sous tout le reste : les taches sont sur le sol.
    this.g.zIndex = -2;
    layer.addChild(this.g);
  }

  /** Où frotter chaque tache (tests, et le mini-jeu). */
  targets(): { id: string; x: number; y: number }[] {
    return this.hitBoxes.map((h) => ({ id: h.id, x: h.x, y: h.y }));
  }

  hitTest(x: number, y: number): string | null {
    let best: { id: string; d: number } | null = null;
    for (const h of this.hitBoxes) {
      const d = Math.hypot(x - h.x, y - h.y);
      if (d <= h.r && (!best || d < best.d)) best = { id: h.id, d };
    }
    return best?.id ?? null;
  }

  update(dirt: readonly Dirt[], highlight: boolean): void {
    const g = this.g;
    g.clear();
    this.hitBoxes = [];
    for (const d of dirt) {
      const f = this.room.floorToScreen(d.pos);
      // Un peu plus grandes que nature : elles doivent se voir sur un téléphone.
      const s = f.s * 1.4;
      const a = 0.25 + 0.65 * d.size;
      if (highlight) g.ellipse(f.x, f.y, s * 0.17, s * 0.06).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
      if (d.kind === 'paw') {
        // Une empreinte : coussinet et quatre doigts.
        g.ellipse(f.x, f.y, s * 0.04, s * 0.022).fill({ color: MUD, alpha: a });
        for (const [ox, oy] of [
          [-0.045, -0.03],
          [-0.016, -0.045],
          [0.016, -0.045],
          [0.045, -0.03],
        ] as const)
          g.ellipse(f.x + ox * s, f.y + oy * s * 0.5, s * 0.013, s * 0.009).fill({ color: MUD, alpha: a });
      } else if (d.kind === 'crumbs') {
        for (let i = 0; i < 7; i++) {
          const ang = i * 2.4;
          g.circle(f.x + Math.cos(ang) * s * 0.06 * (0.4 + (i % 3) * 0.3), f.y + Math.sin(ang) * s * 0.02, s * 0.008 + (i % 2) * 2).fill({ color: CRUMB, alpha: a });
        }
      } else {
        // Une touffe de poils : quelques traits courbes.
        for (let i = -2; i <= 2; i++) {
          g.moveTo(f.x - s * 0.05, f.y + i * 2)
            .quadraticCurveTo(f.x, f.y - s * 0.03 + i * 3, f.x + s * 0.05, f.y + i * 2)
            .stroke({ width: 2, color: FUR, alpha: a, cap: 'round' });
        }
      }
      this.hitBoxes.push({ id: d.id, x: f.x, y: f.y - s * 0.01, r: Math.max(36, s * 0.14) });
    }
  }
}
