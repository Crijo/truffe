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
import { SEASONS, type Season } from '../data/seasons';
import { PuppyView } from './puppy/PuppyView';
import { SeasonFx } from './seasonFx';
import { Room } from './room';
import { StreetDecor } from './streets';

const W = BALANCE.walk;
/** Pixels par mètre sur le trottoir. */
const PX_PER_M = 16;
/** Joints des dalles tous les 64 px ; feuilles tous les 37 px, motif qui revient toutes les 15. */
const STRIPE_PERIOD = 64;
const LEAF_PERIOD = 37 * 15;

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
  /** D-77 : saison du décor, et ce qui tombe du ciel. */
  season: Season = 'summer';
  private readonly fx = new SeasonFx(16);
  /** D-84 : bandes du décor, dessinées une fois et déplacées ; D-92 : une allure par rue. */
  private readonly streets = new StreetDecor(PX_PER_M);
  private readonly groundStrip = new Graphics();
  private readonly leafStrip = new Graphics();
  private backKey = '';
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
    this.fx.g.zIndex = 2;
    this.streets.back.zIndex = 0.2;
    this.streets.crossings.zIndex = 1.7;
    this.streets.front.zIndex = 15;
    this.groundStrip.zIndex = 1.5;
    this.leafStrip.zIndex = 1.6;
    this.container.addChild(this.back, this.streets.back, this.ground, this.groundStrip, this.leafStrip, this.streets.crossings, this.fx.g, this.things, this.dogLayer, this.streets.front, this.leash);
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
    this.drawBackground(w);
    this.fx.update(dtMs, this.season, { x: 0, y: 0, w: r.w, h: r.laneY(0) + 30 }, PuppyView.reduceMotion, w.progress * PX_PER_M * 0.8);
    this.drawThings(w);
    this.dog.update(dtMs, this.mind, null, 100, this.equipped());
    // La voie du haut est plus loin : on trie par hauteur à l'écran, pas par z du salon.
    this.dog.container.zIndex = r.laneY(w.lane);

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
      this.neighbor.view.container.zIndex = r.laneY(0.5);
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

  /**
   * D-84 : le décor (maisons, arbres, dalles, feuilles tombées) est dessiné une seule fois en bandes
   * qui se répètent ; à chaque image on ne fait que les faire glisser. Redessiné seulement
   * quand la taille de l'écran ou la saison change.
   */
  private drawBackground(w: WalkState): void {
    const r = this.room;
    const progress = w.progress;
    const key = `${r.w}x${r.h}:${this.season}`;
    if (key !== this.backKey) {
      this.backKey = key;
      this.paintBackground();
      this.streets.paint({ w: r.w, h: r.h, walkTop: r.laneY(1) - 24, curb: r.laneY(0) + 30, dogX: r.w * r.dogX }, this.season);
    }
    const scroll = (layer: Container, speed: number, period: number): void => {
      layer.x = -((((progress * PX_PER_M * speed) % period) + period) % period);
    };
    this.streets.update(progress, w.plan.route);
    scroll(this.groundStrip, 1, STRIPE_PERIOD);
    scroll(this.leafStrip, 1, LEAF_PERIOD);
  }

  private paintBackground(): void {
    const r = this.room;
    const w = r.w;
    const h = r.h;
    const look = SEASONS[this.season];
    // Ciel.
    const g = this.back;
    g.clear();
    g.rect(0, 0, w, h).fill(look.sky);
    // Trottoir : deux voies, et la bordure de la rue.
    const gr = this.ground;
    gr.clear();
    const y1 = r.laneY(1) - 24;
    gr.rect(0, y1, w, h - y1).fill(0xd9cfc0);
    if (look.snow) gr.rect(0, y1 - 4, w, 8).fill(0xffffff);
    gr.rect(0, r.laneY(0) + 30, w, 10).fill(look.snow ? 0xf2f5f7 : 0xa89a88);
    gr.rect(0, r.laneY(0) + 40, w, h).fill(0x6e6a66);
    // Joints des dalles et, en automne, feuilles tombées (bandes qui glissent).
    const st = this.groundStrip;
    st.clear();
    for (let i = -1; i * 64 < w + STRIPE_PERIOD + 64; i++) st.rect(i * 64, y1, 2, r.laneY(0) + 30 - y1).fill({ color: 0xb9ab98, alpha: 0.7 });
    const lv = this.leafStrip;
    lv.clear();
    if (look.falling === 'leaves') {
      for (let k = -1; k * 37 < w + LEAF_PERIOD + 37; k++) {
        const c = look.fallingColors[((k % 3) + 3) % 3] ?? 0xe08a3c;
        lv.ellipse(k * 37, y1 + 6 + ((((k * 13) % 5) + 5) % 5) * ((r.laneY(0) + 24 - y1) / 5), 5, 2.5).fill({ color: c, alpha: 0.8 });
      }
    }
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
