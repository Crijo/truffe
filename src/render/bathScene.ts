/**
 * D-88 : salle de bain, une scène à part du salon. Le chiot actif y est seul, debout dans le bac
 * de douche, de trois quarts pour qu'on puisse le laver partout. Gouttes, bulles et souffle
 * sous le doigt pendant qu'on frotte.
 */
import { Container, Graphics } from 'pixi.js';
import type { BreedLook } from '../data/breeds';
import type { CareTool, PuppyMind } from '../sim/behavior';
import type { CoatParams } from '../sim/state';
import type { PuppyProbe } from '../input/gestures';
import { PuppyView } from './puppy/PuppyView';
import { Room } from './room';

const SPOT = { x: 0, z: 0.5 };
/** De trois quarts : on voit la tête, le flanc et l'arrière-train. */
const FACING = 0.65;

const TILE = { wall: 0xd9eef3, line: 0xc2dfe7, band: 0xeef8fa, floor: 0xe8e2d6, floorLine: 0xd8d0c0 } as const;

/** Pièce plus petite que le salon : le chiot y est vu de plus près. */
class BathRoom extends Room {
  override readonly horizonRatio: number = 0.5;
  override get sNear(): number {
    return Math.min(this.w * 0.85, this.h * 0.42, 420);
  }
}

interface Particle {
  kind: CareTool;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export class BathScene {
  readonly container = new Container();
  private readonly room = new BathRoom();
  private readonly back = new Graphics();
  private readonly tray = new Graphics();
  private readonly rim = new Graphics();
  private readonly fx = new Graphics();
  private readonly dogLayer = new Container();
  private readonly dog: PuppyView;
  private particles: Particle[] = [];
  private size = '';

  constructor(breed: BreedLook, coat: CoatParams) {
    this.container.sortableChildren = true;
    this.dog = new PuppyView(breed, coat, this.room, SPOT);
    this.back.zIndex = 0;
    this.tray.zIndex = 1;
    this.dogLayer.zIndex = 5;
    this.rim.zIndex = 6;
    this.fx.zIndex = 10;
    this.dogLayer.addChild(this.dog.container);
    this.container.addChild(this.back, this.tray, this.dogLayer, this.rim, this.fx);
  }

  /** Sonde des gestes sur le chiot de la salle de bain. */
  get probe(): PuppyProbe {
    return this.dog.probe;
  }

  layout(w: number, h: number): void {
    this.room.layout(w, h);
    const key = `${w}x${h}`;
    if (key === this.size) return;
    this.size = key;
    this.paint(w, h);
  }

  /** Gouttes (douche), bulles (savon) ou souffle (sèche-cheveux) là où frotte le doigt. */
  splash(tool: CareTool, x: number, y: number): void {
    if (this.particles.length > 90) return;
    const n = tool === 'shower' ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      if (tool === 'shower') this.particles.push({ kind: tool, x: x + (Math.random() - 0.5) * 30, y: y - 10, vx: (Math.random() - 0.5) * 40, vy: 160 + Math.random() * 120, life: 0, max: 0.6 });
      else if (tool === 'soap') this.particles.push({ kind: tool, x, y, vx: Math.cos(a) * 30, vy: -30 - Math.random() * 40, life: 0, max: 1.1 });
      else if (tool === 'dryer') this.particles.push({ kind: tool, x: x + 30, y: y + (Math.random() - 0.5) * 30, vx: -220 - Math.random() * 80, vy: (Math.random() - 0.5) * 30, life: 0, max: 0.35 });
    }
  }

  update(dtMs: number, mind: PuppyMind, cleanliness: number, equipped: readonly string[], pointer: { x: number; y: number } | null): void {
    // Le chiot de la simulation reste au salon ; ici, on le montre au milieu du bac, debout.
    const m: PuppyMind = { ...mind, pos: SPOT, target: null, facing: FACING, gait: 'still' };
    this.dog.update(dtMs, m, pointer, cleanliness, equipped);
    const dt = dtMs / 1000;
    const g = this.fx;
    g.clear();
    this.particles = this.particles.filter((p) => (p.life += dt) < p.max);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = 1 - p.life / p.max;
      if (p.kind === 'shower') g.ellipse(p.x, p.y, 2.2, 5).fill({ color: 0x6fb2dc, alpha: 0.8 * k });
      else if (p.kind === 'soap') g.circle(p.x, p.y, 4 + 5 * (p.life / p.max)).stroke({ width: 1.5, color: 0xa9cfe0, alpha: k }).fill({ color: 0xffffff, alpha: 0.6 * k });
      else g.moveTo(p.x, p.y).lineTo(p.x + 22, p.y).stroke({ width: 2, color: 0xffffff, alpha: 0.9 * k, cap: 'round' });
    }
  }

  private paint(w: number, h: number): void {
    const r = this.room;
    const y = r.horizon;
    const b = this.back;
    b.clear();
    // Mur carrelé, frise claire en haut.
    b.rect(0, 0, w, y).fill(TILE.wall);
    b.rect(0, 0, w, Math.min(60, y * 0.12)).fill(TILE.band);
    const tile = Math.max(36, Math.round(w / 9));
    for (let x = (w / 2) % tile; x < w; x += tile) b.rect(x - 1, 0, 2, y).fill(TILE.line);
    for (let ty = y; ty > 0; ty -= tile) b.rect(0, ty - 1, w, 2).fill(TILE.line);
    // Sol carrelé.
    b.rect(0, y, w, h - y).fill(TILE.floor);
    for (let i = 1; i < 6; i++) b.rect(0, y + (h - y) * (i / 6) ** 1.3, w, 2).fill(TILE.floorLine);
    for (let i = -6; i <= 6; i++) {
      const top = r.floorToScreen({ x: i * 0.3, z: 0 });
      const bottom = r.floorToScreen({ x: i * 0.3 * 1.25, z: 1.1 });
      b.moveTo(top.x, y).lineTo(bottom.x, h).stroke({ width: 2, color: TILE.floorLine });
    }
    b.rect(0, y - 5, w, 10).fill(0xf6fbfc);

    // Pommeau de douche et flexible, à droite.
    const sx = w * 0.8;
    const sy = y * 0.32;
    b.moveTo(sx, y * 0.86).lineTo(sx, sy + 20).stroke({ width: 6, color: 0xa7b7bd, cap: 'round' });
    b.moveTo(sx, sy + 20).quadraticCurveTo(sx, sy, sx - 26, sy).stroke({ width: 6, color: 0xa7b7bd, cap: 'round' });
    b.ellipse(sx - 34, sy + 8, 18, 9).fill(0xc9d6db).stroke({ width: 2, color: 0x8fa2a9 });
    for (let i = -2; i <= 2; i++) b.circle(sx - 34 + i * 6, sy + 12, 1.6).fill(0x6c858e);
    // Robinet mitigeur.
    b.roundRect(sx - 14, y * 0.7, 28, 14, 6).fill(0xc9d6db).stroke({ width: 2, color: 0x8fa2a9 });

    // Miroir et étagère, à gauche.
    const mx = w * 0.12;
    const my = y * 0.22;
    const mw = Math.min(110, w * 0.24);
    b.roundRect(mx, my, mw, mw * 1.2, mw * 0.45).fill(0xeaf4f8).stroke({ width: 5, color: 0xf6fbfc });
    b.moveTo(mx + mw * 0.25, my + mw * 0.3).lineTo(mx + mw * 0.45, my + mw * 0.15).stroke({ width: 4, color: 0xffffff, alpha: 0.8, cap: 'round' });
    const shelfY = my + mw * 1.2 + 26;
    b.roundRect(mx - 6, shelfY, mw + 12, 8, 3).fill(0xf6fbfc).stroke({ width: 2, color: 0xc2dfe7 });
    // Flacons (créés pour Truffe : formes simples).
    b.roundRect(mx + 6, shelfY - 30, 18, 30, 5).fill(0x9fd3c7);
    b.rect(mx + 11, shelfY - 37, 8, 7).fill(0xfaf3e6);
    b.roundRect(mx + 32, shelfY - 24, 16, 24, 5).fill(0xf2a49a);
    b.roundRect(mx + 56, shelfY - 20, 22, 20, 6).fill(0xf2d27a);

    // Serviette pliée sur une patère, à droite du miroir.
    const tx = w * 0.42;
    b.circle(tx, y * 0.42, 5).fill(0xa7b7bd);
    b.roundRect(tx - 22, y * 0.42 + 4, 44, 58, 6).fill(0xf6c6a8).stroke({ width: 2, color: 0xe4a885 });
    b.rect(tx - 22, y * 0.42 + 44, 44, 6).fill(0xe8b090);

    // Bac de douche, sous le chiot : fond et bord arrière ; le bord avant passe devant les pieds.
    const yb = r.floorToScreen({ x: 0, z: 0.12 }).y;
    const yf = r.floorToScreen({ x: 0, z: 0.8 }).y;
    const left = { x: w * 0.2, y: yb };
    const right = { x: w * 0.8, y: yb };
    const fl = { x: w * 0.1, y: yf };
    const fr = { x: w * 0.9, y: yf };
    const t = this.tray;
    t.clear();
    t.moveTo(left.x, left.y).lineTo(right.x, right.y).lineTo(fr.x, fr.y).lineTo(fl.x, fl.y).closePath().fill(0xf7fbfc).stroke({ width: 4, color: 0xc2dfe7, join: 'round' });
    const drain = { x: w * 0.72, y: yf - (yf - yb) * 0.18 };
    t.ellipse(drain.x, drain.y, 12, 5).fill(0xc9d6db).stroke({ width: 1.5, color: 0x8fa2a9 });
    const rim = this.rim;
    rim.clear();
    rim.roundRect(fl.x - 4, fl.y - 3, fr.x - fl.x + 8, 12, 6).fill(0xffffff).stroke({ width: 2, color: 0xc2dfe7 });
  }
}
