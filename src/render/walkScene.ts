/**
 * Promenade en vue de profil (F-PRO-3) : décor qui défile, deux voies de trottoir,
 * laisse tenue au doigt, cadeaux, besoins, rencontres et lieux.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { PLACE_LABELS } from '../data/city';
import { BALANCE } from '../data/balance';
import { BREEDS, type BreedLook } from '../data/breeds';
import { ITEM_BY_ID } from '../data/items';
import { createMind, type PuppyEventType, type PuppyMind, type Vec2 } from '../sim/behavior';
import type { CoatParams } from '../sim/state';
import type { WalkState } from '../sim/walk';
import { PuppyView } from './puppy/PuppyView';
import { Room } from './room';

const W = BALANCE.walk;
/** Pixels par mètre sur le trottoir. */
const PX_PER_M = 16;

/** Le chiot reste au même endroit de l'écran ; c'est le décor qui défile. */
class WalkRoom extends Room {
  dogX = 0.42;
  laneY(lane: number): number {
    return this.h * (0.8 - lane * 0.11);
  }
  override floorToScreen(p: Vec2): { x: number; y: number; s: number } {
    const lane = (p.z - 0.4) / 0.2;
    return { x: this.w * this.dogX, y: this.laneY(lane), s: this.sNear * (0.62 - lane * 0.08) };
  }
  override floorUnits(): { x: number; z: number } {
    return { x: 1, z: 1 };
  }
  override screenToFloor(): Vec2 | null {
    return null;
  }
}

export class WalkScene {
  readonly container = new Container();
  private readonly room = new WalkRoom();
  private readonly back = new Graphics();
  private readonly ground = new Graphics();
  private readonly things = new Graphics();
  private readonly leash = new Graphics();
  private readonly dogLayer = new Container();
  private readonly signs = new Map<number, Text>();
  private readonly dog: PuppyView;
  private mind: PuppyMind;
  private neighbor: { view: PuppyView; mind: PuppyMind; index: number } | null = null;
  private barksSeen = 0;
  private seq = 1000;
  private t = 0;

  constructor(
    breed: BreedLook,
    coat: CoatParams,
    private readonly equipped: () => string[],
  ) {
    this.container.sortableChildren = true;
    this.dog = new PuppyView(breed, coat, this.room, { x: 0, z: 0.5 });
    this.mind = { ...createMind(3, { x: 0, z: 0.5 }), facing: Math.PI / 2, gait: 'walk', mood: 'happy', excitement: 0.8 };
    this.back.zIndex = 0;
    this.ground.zIndex = 1;
    this.things.zIndex = 5;
    this.dogLayer.zIndex = 10;
    this.dogLayer.sortableChildren = true;
    this.dogLayer.addChild(this.dog.container);
    this.leash.zIndex = 20;
    this.container.addChild(this.back, this.ground, this.things, this.dogLayer, this.leash);
  }

  layout(w: number, h: number): void {
    this.room.layout(w, h);
  }

  /** Voie (0 ou 1) correspondant à une hauteur d'écran, pour la laisse. */
  laneAt(y: number): number {
    const y0 = this.room.laneY(0);
    const y1 = this.room.laneY(1);
    return Math.min(1, Math.max(0, (y0 - y) / (y0 - y1)));
  }

  private emit(type: PuppyEventType): void {
    this.mind = { ...this.mind, events: [...this.mind.events.slice(-20), { seq: ++this.seq, type, t: this.mind.t }] };
  }

  update(dtMs: number, w: WalkState, hand: { x: number; y: number } | null): void {
    this.t += dtMs / 1000;
    const r = this.room;
    const paused = !!w.pause;
    // Aboiements d'annonce (F-PRO-4).
    for (; this.barksSeen < w.barks.length; this.barksSeen++) {
      const b = w.barks[this.barksSeen];
      for (let i = 0; i < (b?.count ?? 1); i++) this.emit('bark');
    }
    const poopStop = w.pause?.kind === 'poop';
    this.mind = {
      ...this.mind,
      t: this.mind.t + dtMs,
      pos: { x: w.progress * 0.06, z: 0.4 + w.lane * 0.2 },
      gait: paused ? 'still' : 'walk',
      posture: poopStop ? 'sit' : 'stand',
      facing: Math.PI / 2,
      look: { kind: 'point', x: w.progress * 0.06 + 2, z: 0.5 },
      mood: w.pause?.kind === 'encounter' ? 'happy' : 'calm',
      excitement: w.pause?.kind === 'encounter' ? 1 : 0.6,
      attentive: false,
    };
    this.drawBackground(w.progress);
    this.drawThings(w);
    this.dog.update(dtMs, this.mind, null, 100, this.equipped());

    // Rencontre : le chien voisin vient renifler.
    const enc = w.pause?.kind === 'encounter' ? w.pause.index : -1;
    if (enc >= 0 && this.neighbor?.index !== enc) {
      this.neighbor?.view.container.destroy({ children: true });
      const ids = Object.keys(BREEDS);
      const breed = BREEDS[ids[enc % ids.length] ?? 'beagle'] ?? BREEDS.beagle;
      if (breed) {
        const view = new PuppyView(breed, { base: enc % 2, patch: 0.3, patchAmount: 1 }, r, { x: 0, z: 0.5 });
        this.dogLayer.addChild(view.container);
        this.neighbor = { view, mind: { ...createMind(enc + 9, { x: 0, z: 0.5 }), facing: -Math.PI / 2, mood: 'happy', excitement: 1 }, index: enc };
        this.emit('wiggle');
      }
    }
    if (this.neighbor) {
      const e = w.plan.events[this.neighbor.index];
      const dx = ((e?.at ?? 0) - w.progress) * PX_PER_M + 70;
      this.neighbor.view.container.x = dx;
      this.neighbor.view.update(dtMs, this.neighbor.mind, null);
      if (dx < -r.w) {
        this.neighbor.view.container.destroy({ children: true });
        this.neighbor = null;
      }
    }

    // Laisse : de la main du joueur au collier.
    const collar = this.dog.neckScreen();
    const from = hand ?? { x: -10, y: r.h * 0.62 };
    const sag = hand ? 6 : 26;
    this.leash.clear();
    this.leash
      .moveTo(from.x, from.y)
      .quadraticCurveTo((from.x + collar.x) / 2, Math.max(from.y, collar.y) + sag, collar.x, collar.y)
      .stroke({ width: 4, color: 0xb5562a, cap: 'round' });
  }

  private drawBackground(progress: number): void {
    const r = this.room;
    const g = this.back;
    const w = r.w;
    const h = r.h;
    g.clear();
    g.rect(0, 0, w, h).fill(0xcfe6f2);
    // Maisons au loin (parallaxe lente).
    const far = progress * PX_PER_M * 0.45;
    const colors = [0xf2c9a0, 0xe8b37a, 0xd9a0a0, 0xc9d9b0, 0xf0dca0];
    for (let i = -1; i < Math.ceil(w / 120) + 2; i++) {
      const x = i * 120 - (far % 120);
      const k = Math.floor((far + i * 120) / 120);
      const c = colors[((k % colors.length) + colors.length) % colors.length] ?? 0xf2c9a0;
      const top = h * (0.3 + ((k * 37) % 5) * 0.02);
      g.rect(x, top, 112, h * 0.62 - top).fill(c).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.3 });
      g.moveTo(x - 6, top).lineTo(x + 56, top - 34).lineTo(x + 118, top).fill(0xb5562a);
      g.rect(x + 18, top + 22, 22, 22).fill(0xfdf6ea);
      g.rect(x + 70, top + 22, 22, 22).fill(0xfdf6ea);
    }
    // Arbres et réverbères (parallaxe moyenne).
    const mid = progress * PX_PER_M * 0.8;
    for (let i = -1; i < Math.ceil(w / 200) + 2; i++) {
      const x = i * 200 - (mid % 200) + 60;
      g.rect(x - 4, h * 0.5, 8, h * 0.16).fill(0x8a5a2e);
      g.circle(x, h * 0.48, 30).fill(0x7cc47f).stroke({ width: 2, color: 0x3e7c46, alpha: 0.6 });
    }
    // Trottoir : deux voies, et la bordure de la rue.
    const gr = this.ground;
    gr.clear();
    const y1 = r.laneY(1) - 24;
    gr.rect(0, y1, w, h - y1).fill(0xd9cfc0);
    const near = progress * PX_PER_M;
    for (let i = -1; i < Math.ceil(w / 64) + 2; i++) {
      const x = i * 64 - (near % 64);
      gr.rect(x, y1, 2, r.laneY(0) + 30 - y1).fill({ color: 0xb9ab98, alpha: 0.7 });
    }
    gr.rect(0, r.laneY(0) + 30, w, 10).fill(0xa89a88);
    gr.rect(0, r.laneY(0) + 40, w, h).fill(0x6e6a66);
  }

  private drawThings(w: WalkState): void {
    const r = this.room;
    const g = this.things;
    g.clear();
    const dogX = r.w * r.dogX;
    w.plan.events.forEach((e, i) => {
      const x = dogX + (e.at - w.progress) * PX_PER_M;
      if (x < -60 || x > r.w + 80) return;
      const y = r.laneY(e.lane);
      const done = w.done.includes(i);
      if (e.kind === 'hidden' && !done && e.at - w.progress <= W.sparkleLeadM) {
        // F-PRO-5 : un éclat furtif dans une des voies.
        const tw = 0.6 + 0.4 * Math.sin(this.t * 10 + i);
        const s = 12 * tw;
        g.moveTo(x - s, y).lineTo(x + s, y).moveTo(x, y - s * 1.4).lineTo(x, y + s * 1.4).stroke({ width: 3, color: 0xffe27a, cap: 'round' });
        g.circle(x, y, 5).fill(0xfff6c8);
      }
      if (e.kind === 'question' && e.sub === 'gift' && !done) {
        const c = ITEM_BY_ID[e.itemId ?? '']?.colors[0] ?? 0xe8564a;
        g.roundRect(x - 13, y - 22, 26, 22, 4).fill(c).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.6 });
        g.rect(x - 2, y - 22, 4, 22).fill(0xfff3dc);
        g.moveTo(x - 8, y - 28).lineTo(x, y - 22).lineTo(x + 8, y - 28).stroke({ width: 3, color: 0xfff3dc });
      }
      if (e.kind === 'poop' && done && (w.poop?.index !== i || !w.poop.picked)) {
        g.ellipse(x + 18, y + 4, 10, 6).fill(0x6b4a2a);
        g.ellipse(x + 18, y - 2, 7, 5).fill(0x7a5634);
        g.ellipse(x + 18, y - 7, 4, 3).fill(0x8a6440);
      }
      if (e.kind === 'place' && e.place) {
        const signY = r.laneY(1) - 120;
        g.roundRect(x - 60, signY, 120, 34, 8).fill(0xfdf6ea).stroke({ width: 3, color: 0xb5562a });
        let label = this.signs.get(i);
        if (!label) {
          label = new Text({ text: PLACE_LABELS[e.place], style: { fontFamily: 'system-ui, sans-serif', fontSize: 18, fontWeight: '700', fill: 0x3d2b1f } });
          label.anchor.set(0.5);
          label.zIndex = 6;
          this.signs.set(i, label);
          this.container.addChild(label);
        }
        label.position.set(x, signY + 17);
      }
    });
  }
}
