import { Container, Graphics } from 'pixi.js';
import { ITEM_BY_ID } from '../data/items';
import type { Toy } from '../sim/toys';
import type { Room } from './room';

const BALL = 0xd94f3d;
const BALL_STRIPE = 0xfff3dc;
const DISC = 0x3f86c6;
const DISC_RIM = 0xb9dcf5;
const ROPE = 0xd8a35a;
const ROPE_DARK = 0x9c6b2f;
const OUTLINE = 0x4a2f1f;

/** Où dessiner la gueule d'un chien (jouet porté, corde tirée). */
export type MouthOf = (dogId: string) => { x: number; y: number; z: number } | null;

/** Jouets du salon (F-JEU) : en vol, au sol, dans la main ou dans la gueule. */
export class ToysView {
  private readonly items = new Map<string, { g: Graphics; x: number; y: number; z: number }>();
  private hitBoxes: { id: string; x: number; y: number; r: number }[] = [];

  constructor(
    private readonly layer: Container,
    private readonly room: Room,
  ) {}

  /** Jouet au sol sous le doigt, pour le reprendre. */
  hitTest(x: number, y: number): string | null {
    for (const h of this.hitBoxes) if (Math.hypot(x - h.x, y - h.y) <= h.r) return h.id;
    return null;
  }

  update(dtMs: number, toys: readonly Toy[], hand: { x: number; y: number } | null, mouthOf: MouthOf): void {
    const alive = new Set(toys.map((t) => t.id));
    for (const [id, it] of this.items) {
      if (!alive.has(id)) {
        it.g.destroy();
        this.items.delete(id);
      }
    }
    this.hitBoxes = [];
    const k = 1 - Math.exp(-(dtMs / 1000) * 18);
    for (const t of toys) {
      const p = this.room.floorToScreen(t.pos);
      const s = p.s;
      let target = { x: p.x, y: p.y - t.h * s * 0.9, z: t.pos.z };
      const mouth = t.carrier ? mouthOf(t.carrier) : null;
      if (t.state === 'carried' && mouth) target = { x: mouth.x, y: mouth.y + s * 0.03, z: mouth.z + 0.001 };
      if (t.state === 'held' && hand) target = { x: hand.x, y: hand.y - s * 0.06, z: 10 };
      let it = this.items.get(t.id);
      if (!it) {
        it = { g: new Graphics(), ...target };
        this.items.set(t.id, it);
        this.layer.addChild(it.g);
      }
      const snap = t.state === 'carried' || t.state === 'held' || t.state === 'tug';
      it.x = snap ? target.x : it.x + (target.x - it.x) * k;
      it.y = snap ? target.y : it.y + (target.y - it.y) * k;
      it.z = target.z;
      const g = it.g;
      g.clear();
      g.position.set(0, 0);
      g.zIndex = it.z;
      // Ombre au sol, qui rapetisse quand le jouet monte.
      if (t.state === 'flying' || t.state === 'ground') {
        const lift = Math.min(1, t.h);
        g.ellipse(p.x, p.y, s * 0.07 * (1 - lift * 0.5), s * 0.025 * (1 - lift * 0.5)).fill({ color: 0x3a2618, alpha: 0.18 });
      }
      const col = t.itemId ? ITEM_BY_ID[t.itemId]?.colors : undefined;
      // Le gros ballon (déblocage à 300 points) est bien plus gros.
      if (t.kind === 'ball') this.ball(g, it.x, it.y, t.itemId && ITEM_BY_ID[t.itemId]?.big ? s * 2 : s, col);
      else if (t.kind === 'disc') this.disc(g, it.x, it.y, s, t.state === 'flying' ? Date.now() / 90 : 0, col);
      else this.rope(g, it.x, it.y, s, t, hand, mouth);
      if (t.state === 'ground') this.hitBoxes.push({ id: t.id, x: it.x, y: it.y, r: Math.max(30, s * 0.12) });
    }
  }

  private ball(g: Graphics, x: number, y: number, s: number, col?: readonly [number, number]): void {
    const r = s * 0.055;
    g.circle(x, y, r).fill(col?.[0] ?? BALL).stroke({ width: 2, color: OUTLINE, alpha: 0.7 });
    g.moveTo(x - r * 0.8, y - r * 0.3).quadraticCurveTo(x, y + r * 0.4, x + r * 0.8, y - r * 0.3).stroke({ width: r * 0.28, color: col?.[1] ?? BALL_STRIPE, cap: 'round' });
    g.circle(x - r * 0.35, y - r * 0.45, r * 0.18).fill({ color: 0xffffff, alpha: 0.6 });
  }

  private disc(g: Graphics, x: number, y: number, s: number, spin: number, col?: readonly [number, number]): void {
    const rx = s * 0.12;
    const ry = s * 0.04;
    g.ellipse(x, y, rx, ry).fill(col?.[0] ?? DISC).stroke({ width: 2, color: OUTLINE, alpha: 0.7 });
    g.ellipse(x, y - ry * 0.15, rx * 0.62, ry * 0.55).stroke({ width: 2, color: col?.[1] ?? DISC_RIM, alpha: 0.9 });
    g.circle(x + Math.cos(spin) * rx * 0.5, y + Math.sin(spin) * ry * 0.4, s * 0.008).fill(DISC_RIM);
  }

  private rope(g: Graphics, x: number, y: number, s: number, t: Toy, hand: { x: number; y: number } | null, mouth: { x: number; y: number } | null): void {
    const w = s * 0.03;
    const knot = (kx: number, ky: number) => g.circle(kx, ky, w * 1.1).fill(ROPE_DARK).stroke({ width: 1.5, color: OUTLINE, alpha: 0.6 });
    let a = { x: x - s * 0.12, y };
    let b = { x: x + s * 0.12, y };
    let sag = s * 0.04;
    if (t.state === 'tug' && hand && mouth) {
      a = hand;
      b = mouth;
      sag = 0;
    } else if (t.state === 'held' && hand) {
      a = hand;
      b = { x: hand.x + s * 0.05, y: hand.y + s * 0.28 };
      sag = s * 0.06;
    } else if (t.state === 'carried' && mouth) {
      a = { x: mouth.x - s * 0.13, y: mouth.y + s * 0.06 };
      b = { x: mouth.x + s * 0.13, y: mouth.y + s * 0.06 };
      sag = s * 0.05;
    }
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 + sag;
    g.moveTo(a.x, a.y).quadraticCurveTo(mx, my, b.x, b.y).stroke({ width: w * 2 + 3, color: OUTLINE, alpha: 0.5, cap: 'round' });
    g.moveTo(a.x, a.y).quadraticCurveTo(mx, my, b.x, b.y).stroke({ width: w * 2, color: ROPE, cap: 'round' });
    knot(a.x, a.y);
    knot(b.x, b.y);
  }
}
