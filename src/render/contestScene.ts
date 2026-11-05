/**
 * Scène des concours (F-CON) : un terrain vu en perspective, le chiot, le disque ou les obstacles.
 * Les positions viennent de la simulation (mètres) ; la scène ne décide de rien.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { BALANCE } from '../data/balance';
import type { BreedLook } from '../data/breeds';
import { createMind, performTrick, withEvent, type PuppyEventType, type PuppyMind, type Vec2 } from '../sim/behavior';
import type { AgilityRun } from '../sim/contest/agility';
import type { DiscRun } from '../sim/contest/disc';
import type { ContestSession } from '../sim/game';
import type { CoatParams, ItemId } from '../sim/state';
import { SEASONS, type Season } from '../data/seasons';
import { PuppyView } from './puppy/PuppyView';
import { SeasonFx } from './seasonFx';
import { Room } from './room';

const F = BALANCE.puppy.floor;
const D = BALANCE.contests.disc;

/** Terrain plus profond que le salon : horizon haut, chiot plus petit. */
class FieldRoom extends Room {
  override readonly horizonRatio = 0.3;
  override get sNear(): number {
    return Math.min(this.w * 0.32, this.h * 0.2, 170);
  }
}

const PALETTE = {
  chalk: 0xf7f4ea,
  /** Texte sur l'herbe : contraste AA. */
  label: 0x1f3d1a,
  disc: 0xe4572e,
  discRim: 0xffd166,
  post: 0xf2f2f2,
  bar: 0xe8564a,
  tunnel: 0x3f86c6,
  tunnelDark: 0x2f6aa0,
  pole: 0xf2c94c,
  seesaw: 0xb5562a,
  finish: 0x7cc47f,
  target: 0xffffff,
  finger: 0xb5562a,
} as const;

export class ContestScene {
  readonly container = new Container();
  readonly room = new FieldRoom();
  private readonly bg = new Graphics();
  private readonly marks = new Graphics();
  private readonly fx = new Graphics();
  private readonly falling = new SeasonFx(18);
  private readonly labels = new Container();
  private readonly view: PuppyView;
  private mind: PuppyMind;
  private last: Vec2;
  private seen = { catches: 0, cleared: 0, results: 0 };
  private readonly kind: ContestSession['contestId'];
  private w = 0;
  private h = 0;

  constructor(
    breed: BreedLook,
    coat: CoatParams,
    private readonly equipped: () => ItemId[],
    session: ContestSession,
    /** D-77 : saison du terrain. */
    private readonly season: Season = 'summer',
  ) {
    this.kind = session.contestId;
    const start = this.dogFloor(session.run);
    this.mind = { ...createMind(7, start), posture: 'stand', mood: 'happy', excitement: 0.9, look: { kind: 'player' } };
    this.last = start;
    this.view = new PuppyView(breed, coat, this.room, start);
    this.container.sortableChildren = true;
    this.bg.zIndex = -10;
    this.marks.zIndex = -5;
    this.labels.zIndex = -4;
    this.fx.zIndex = 1000;
    this.falling.g.zIndex = -3;
    this.container.addChild(this.bg, this.marks, this.labels, this.falling.g, this.view.container, this.fx);
  }

  layout(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.room.layout(w, h);
    this.drawField();
  }

  /** Mètres du terrain → sol de la scène. */
  toFloor(p: { x: number; y: number }): Vec2 {
    if (this.kind === 'disc') return { x: (p.x / D.halfWidthM) * F.maxX, z: F.maxZ - (p.y / D.fieldM) * (F.maxZ - F.minZ) };
    if (this.kind === 'agility') return { x: (p.x / 10) * F.maxX, z: F.maxZ - (p.y / 28) * (F.maxZ - F.minZ) };
    return { x: 0, z: 0.55 };
  }

  /** Écran → mètres du terrain (agilité : le doigt). */
  toField(x: number, y: number): { x: number; y: number } {
    const f = this.room.screenToFloor(x, Math.max(y, this.room.horizon + 1)) ?? { x: 0, z: F.minZ };
    if (this.kind === 'disc') return { x: (f.x / F.maxX) * D.halfWidthM, y: ((F.maxZ - f.z) / (F.maxZ - F.minZ)) * D.fieldM };
    return { x: (f.x / F.maxX) * 10, y: ((F.maxZ - f.z) / (F.maxZ - F.minZ)) * 28 };
  }

  private dogFloor(run: ContestSession['run']): Vec2 {
    if (run.kind === 'obedience') return { x: 0, z: 0.55 };
    return this.toFloor(run.dog);
  }

  /** Mètres du terrain → écran. */
  screenOf(p: { x: number; y: number }): { x: number; y: number } {
    const s = this.screen(p);
    return { x: s.x, y: s.y };
  }

  private screen(p: { x: number; y: number }): { x: number; y: number; s: number } {
    return this.room.floorToScreen(this.toFloor(p));
  }

  private drawField(): void {
    const { w, h } = this;
    const y = this.room.horizon;
    const g = this.bg;
    g.clear();
    const look = SEASONS[this.season];
    g.rect(0, 0, w, y).fill(look.sky);
    g.ellipse(w * 0.25, y, w * 0.4, h * 0.06).fill(look.hills);
    g.ellipse(w * 0.8, y, w * 0.45, h * 0.05).fill(look.hills);
    g.rect(0, y, w, h - y).fill(look.grass);
    for (let i = 1; i < 7; i++) g.rect(0, y + (h - y) * (i / 7) ** 1.3, w, 3).fill(look.grassLine);
    this.labels.removeChildren().forEach((c) => c.destroy());
    const m = this.marks;
    m.clear();
    if (this.kind === 'disc') {
      // Lignes tous les 10 m, et les bords du terrain.
      for (let d = 10; d <= D.fieldM; d += 10) {
        const a = this.screen({ x: -D.halfWidthM, y: d });
        const b = this.screen({ x: D.halfWidthM, y: d });
        m.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color: PALETTE.chalk, alpha: 0.85 });
        const t = new Text({ text: `${d} m`, style: { fontFamily: 'system-ui, sans-serif', fontSize: 15, fill: PALETTE.label, fontWeight: '700' } });
        t.position.set(b.x - 44, b.y - 20);
        this.labels.addChild(t);
      }
      const corners = [
        { x: -D.halfWidthM, y: 0 },
        { x: -D.halfWidthM, y: D.fieldM },
        { x: D.halfWidthM, y: D.fieldM },
        { x: D.halfWidthM, y: 0 },
      ].map((p) => this.screen(p));
      const [c0, c1, c2, c3] = corners;
      if (c0 && c1 && c2 && c3) m.moveTo(c0.x, c0.y).lineTo(c1.x, c1.y).lineTo(c2.x, c2.y).lineTo(c3.x, c3.y).stroke({ width: 3, color: PALETTE.chalk, alpha: 0.85 });
    } else if (this.kind === 'obedience') {
      const c = this.room.floorToScreen({ x: 0, z: 0.55 });
      m.ellipse(c.x, c.y, c.s * 1.1, c.s * 0.28).fill({ color: PALETTE.chalk, alpha: 0.35 }).stroke({ width: 3, color: PALETTE.chalk });
    }
  }

  /** Obstacles d'agilité ; le prochain point à atteindre brille. */
  private drawAgility(run: AgilityRun, t: number): void {
    const m = this.marks;
    m.clear();
    run.course.forEach((ob, i) => {
      const done = i < run.next;
      const alpha = done ? 0.45 : 1;
      const pts = ob.points.map((p) => this.screen(p));
      const first = pts[0];
      if (!first) return;
      switch (ob.kind) {
        case 'hurdle': {
          const r = ob.points[0]?.r ?? 1;
          const a = this.screen({ x: (ob.points[0]?.x ?? 0) - r, y: ob.points[0]?.y ?? 0 });
          const b = this.screen({ x: (ob.points[0]?.x ?? 0) + r, y: ob.points[0]?.y ?? 0 });
          const hgt = first.s * 0.45;
          m.rect(a.x - 3, a.y - hgt, 6, hgt).fill({ color: PALETTE.post, alpha });
          m.rect(b.x - 3, b.y - hgt, 6, hgt).fill({ color: PALETTE.post, alpha });
          m.moveTo(a.x, a.y - hgt * 0.75).lineTo(b.x, b.y - hgt * 0.75).stroke({ width: 6, color: PALETTE.bar, alpha });
          break;
        }
        case 'tunnel': {
          m.moveTo(first.x, first.y);
          for (const p of pts.slice(1)) m.lineTo(p.x, p.y);
          m.stroke({ width: first.s * 0.5, color: PALETTE.tunnel, alpha, cap: 'round', join: 'round' });
          m.ellipse(first.x, first.y - first.s * 0.1, first.s * 0.24, first.s * 0.2).fill({ color: PALETTE.tunnelDark, alpha });
          break;
        }
        case 'slalom':
          for (const p of pts) m.rect(p.x - 3, p.y - p.s * 0.6, 6, p.s * 0.6).fill({ color: PALETTE.pole, alpha });
          break;
        case 'seesaw': {
          const end = pts[pts.length - 1] ?? first;
          m.moveTo(first.x, first.y - first.s * 0.08).lineTo(end.x, end.y - end.s * 0.08).stroke({ width: first.s * 0.22, color: PALETTE.seesaw, alpha, cap: 'round' });
          const mid = { x: (first.x + end.x) / 2, y: (first.y + end.y) / 2 };
          m.poly([mid.x - 10, mid.y, mid.x + 10, mid.y, mid.x, mid.y - 14]).fill({ color: PALETTE.tunnelDark, alpha });
          break;
        }
        case 'finish': {
          const r = ob.points[0]?.r ?? 1.5;
          const a = this.screen({ x: (ob.points[0]?.x ?? 0) - r, y: ob.points[0]?.y ?? 0 });
          const b = this.screen({ x: (ob.points[0]?.x ?? 0) + r, y: ob.points[0]?.y ?? 0 });
          const hgt = first.s * 1.1;
          m.rect(a.x - 4, a.y - hgt, 8, hgt).fill(PALETTE.finish);
          m.rect(b.x - 4, b.y - hgt, 8, hgt).fill(PALETTE.finish);
          m.rect(a.x, a.y - hgt, b.x - a.x, hgt * 0.2).fill(PALETTE.finish);
          break;
        }
      }
    });
    // Le prochain point.
    const next = run.course[run.next]?.points[run.sub];
    if (next && !run.finished) {
      const p = this.screen(next);
      const pulse = 1 + 0.15 * Math.sin(t / 180);
      m.ellipse(p.x, p.y, p.s * 0.35 * pulse, p.s * 0.1 * pulse).stroke({ width: 4, color: PALETTE.target, alpha: 0.95 });
    }
    if (run.target) {
      const f = this.screen(run.target);
      m.ellipse(f.x, f.y, f.s * 0.16, f.s * 0.05).fill({ color: PALETTE.finger, alpha: 0.5 });
    }
  }

  private drawDisc(run: DiscRun): void {
    const g = this.fx;
    g.clear();
    if (run.disc.state === 'mouth' || run.disc.state === 'hand') {
      if (run.disc.state === 'hand') {
        const p = this.screen({ x: 0, y: 0.4 });
        g.ellipse(p.x, p.y - p.s * 0.55, p.s * 0.22, p.s * 0.08).fill(PALETTE.disc).stroke({ width: 3, color: PALETTE.discRim });
      }
      return;
    }
    const p = this.screen(run.disc);
    const lift = run.disc.h * p.s * 0.55;
    g.ellipse(p.x, p.y, p.s * 0.16, p.s * 0.05).fill({ color: 0x000000, alpha: 0.18 });
    g.ellipse(p.x, p.y - lift, p.s * 0.16, p.s * 0.06).fill(PALETTE.disc).stroke({ width: 2, color: PALETTE.discRim });
  }

  /** Une image : renvoie les événements nouveaux du chiot (pour les sons). */
  update(dtMs: number, session: ContestSession, t: number): PuppyEventType[] {
    const run = session.run;
    let m: PuppyMind = { ...this.mind, t: this.mind.t + dtMs };
    const fresh: PuppyEventType[] = [];
    const emit = (type: PuppyEventType): void => {
      m = withEvent(m, type);
      fresh.push(type);
    };
    if (run.kind === 'obedience') {
      this.fx.clear();
      if (run.results.length > this.seen.results) {
        this.seen.results = run.results.length;
        const r = run.results[run.results.length - 1];
        const trick = run.orders[run.index];
        if (r?.ok && trick) {
          m = performTrick(m, trick);
          fresh.push('bark');
        } else emit(r ? 'lookAway' : 'yawn');
      }
      if (m.perform && m.t >= m.perform.until) m = { ...m, perform: null, activity: 'wander', posture: 'sit' };
    } else {
      const pos = this.toFloor(run.dog);
      const dx = pos.x - this.last.x;
      const dz = pos.z - this.last.z;
      const speedM = (Math.hypot(dx / F.maxX, dz / (F.maxZ - F.minZ)) * (run.kind === 'disc' ? D.fieldM : 24)) / Math.max(0.016, dtMs / 1000);
      const gait = speedM > 5 ? 'run' : speedM > 2 ? 'trot' : speedM > 0.3 ? 'walk' : 'still';
      m = { ...m, pos, gait, activity: gait === 'still' ? 'wander' : 'fetch', posture: 'stand', facing: Math.hypot(dx, dz) > 1e-5 ? Math.atan2(dx, dz) : m.facing };
      this.last = pos;
      if (run.kind === 'disc') {
        if (run.catches.length > this.seen.catches) {
          this.seen.catches = run.catches.length;
          const c = run.catches[run.catches.length - 1];
          if (c?.air) emit('jump');
          else emit('sniffGround');
        }
        m = { ...m, holding: run.disc.state === 'mouth' ? 'disc' : null, look: run.disc.state === 'flying' ? { kind: 'point', ...this.toFloor(run.disc) } : { kind: 'player' } };
        this.drawDisc(run);
      } else {
        const hurdles = run.cleared.filter((ok, i) => ok && run.course[i]?.kind === 'hurdle').length;
        if (hurdles > this.seen.cleared) {
          this.seen.cleared = hurdles;
          emit('jump');
        }
        this.drawAgility(run, t);
        this.fx.clear();
      }
    }
    this.mind = m;
    this.falling.update(dtMs, this.season, { x: 0, y: 0, w: this.w, h: this.h }, PuppyView.reduceMotion);
    this.view.update(dtMs, m, null, 100, this.equipped());
    return fresh;
  }
}
