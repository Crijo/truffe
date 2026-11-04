/**
 * Chiot articulé en 2,5D : chaque partie est un ellipsoïde projeté, animé par des ressorts.
 * Lit l'esprit du chiot (sim/) et ne le modifie jamais.
 */
import { Container, Graphics } from 'pixi.js';
import { coatOf, type BreedLook, type Coat } from '../../data/breeds';
import { ITEM_BY_ID } from '../../data/items';
import type { PuppyProbe } from '../../input/gestures';
import type { BodyPart, Posture, PuppyEvent, PuppyEventType, PuppyMind } from '../../sim/behavior';
import type { CoatParams } from '../../sim/state';
import type { Room } from '../room';
import {
  Camera,
  Spring,
  add,
  angleDiff,
  apply,
  clamp,
  dot,
  mul,
  mulEach,
  norm,
  rotX,
  rotY,
  rotZ,
  scale,
  shade,
  smooth,
  sub,
  type M3,
  type V3,
} from './math';
import { ACT_MS, MOODS, POSTURES } from './poses';

const TILT = 0.36;
const SCLERA = 0xfffaf2;
const IRIS = 0x2a1a12;
const MOUTH = 0x5b2626;
const TONGUE = 0xee8a93;

type HitPart = BodyPart | 'body';
type Hit =
  | { part: HitPart; z: number; kind: 'ellipse'; cx: number; cy: number; a: number; b: number; rot: number }
  | { part: HitPart; z: number; kind: 'capsule'; ax: number; ay: number; bx: number; by: number; r: number };

interface Act {
  kind: PuppyEventType;
  t0: number;
  dur: number;
}

/** Décalages additionnés par les animations ponctuelles. */
interface Offsets {
  rootY: number;
  yaw: number;
  roll: number;
  pitch: number;
  bodyY: number;
  bodyZ: number;
  headPitch: number;
  headTilt: number;
  mouth: number;
  tongue: number;
  tongueUp: number;
  lids: number;
  earLift: number;
  earFlap: number;
  tailUp: number;
  wag: number;
  crouch: number;
  brow: number;
  scratch: number;
  paddle: number;
  nose: number;
  /** Patte avant levée (« Donne la patte »). */
  paw: number;
  /** Pattes arrière en l'air (poirier, faire le mort). */
  hindUp: number;
}

const zeroOffsets = (): Offsets => ({
  rootY: 0,
  yaw: 0,
  roll: 0,
  pitch: 0,
  bodyY: 0,
  bodyZ: 0,
  headPitch: 0,
  headTilt: 0,
  mouth: 0,
  tongue: 0,
  tongueUp: 0,
  lids: 0,
  earLift: 0,
  earFlap: 0,
  tailUp: 0,
  wag: 0,
  crouch: 0,
  brow: 0,
  scratch: 0,
  paddle: 0,
  nose: 0,
  paw: 0,
  hindUp: 0,
});

const SPRING_OMEGA = {
  bodyY: 9,
  bodyZ: 9,
  pitch: 8,
  roll: 7,
  headUp: 10,
  headFwd: 10,
  lookYaw: 13,
  lookPitch: 13,
  headTilt: 7,
  earLift: 10,
  tailUp: 8,
  wagAmp: 6,
  lids: 34,
  lowLid: 18,
  mouth: 22,
  tongue: 14,
  brow: 12,
  irisX: 30,
  irisY: 30,
  moving: 8,
} as const;
type SpringName = keyof typeof SPRING_OMEGA;

export class PuppyView {
  readonly container = new Container();
  /** Appelé à la première image qui montre la réaction à un geste. */
  onReaction: ((seq: number) => void) | null = null;

  private readonly shadow = new Graphics();
  private readonly body = new Container();
  private readonly cam = new Camera(TILT);
  private readonly gfx = new Map<string, Graphics>();
  private hits: Hit[] = [];
  private acts: Act[] = [];
  private lastSeq = -1;
  private lastReaction = 0;

  private t = 0;
  private px: number;
  private pz: number;
  private yaw = 0;
  private yawVel = 0;
  private readonly sp: Record<SpringName, Spring>;
  private readonly feet: Spring[];
  private readonly ears = [
    { spread: new Spring(0.25), swing: new Spring(0) },
    { spread: new Spring(0.25), swing: new Spring(0) },
  ];
  private gaitPhase = 0;
  private wagPhase = 0;
  /** Réglage « réduire les animations » : sauts, tours et rebonds bien plus sobres. */
  static reduceMotion = false;
  private breathPhase = 0;
  private blinkAt = 1.5;
  private blinkUntil = 0;
  private saccadeAt = 0;
  private saccade = { x: 0, y: 0 };

  // Géométrie de la dernière image, pour le regard et les gestes.
  private ox = 0;
  private oy = 0;
  private s = 1;
  private headC: V3 = [0, 0.7, 0.1];
  private headS = { x: 0, y: 0 };
  private noseS = { x: 0, y: 0 };
  private headTopS = { x: 0, y: 0 };
  private mouthS = { x: 0, y: 0 };
  private neckS = { x: 0, y: 0 };
  /** Yeux à l'écran (null : de dos), pour les lunettes. */
  private eyeS: Record<1 | -1, { x: number; y: number; r: number; rot: number } | null> = { 1: null, [-1]: null };
  private equipped: readonly string[] = [];
  private bulbS: { x: number; y: number; r: number } | null = null;
  private bodyCS = { x: 0, y: 0 };
  private bodyUpS = { x: 0, y: -1, len: 1 };

  /** Couleur du pelage de l'image en cours (assombrie quand il est mouillé). */
  private fur: number;
  private cleanliness = 100;
  private readonly fx = new Graphics();
  /** Directions fixes à la surface du corps et de la tête : bulles, taches, gouttes. */
  private readonly spots: { onHead: boolean; dir: V3; r: number }[] = [];

  /** Robe de ce chiot. */
  private readonly coat: Coat;

  constructor(
    private readonly breed: BreedLook,
    coatParams: CoatParams,
    private readonly room: Room,
    start: { x: number; z: number },
  ) {
    this.px = start.x;
    this.pz = start.z;
    this.container.addChild(this.shadow, this.body);
    this.body.sortableChildren = true;
    const base = coatOf(breed, coatParams.base);
    // Deux chiots d'une même robe ne sont jamais tout à fait de la même teinte.
    const k = Math.abs(coatParams.patch) * 0.08;
    const toward = coatParams.patch > 0 ? 0xffffff : 0x000000;
    this.coat = { ...base, fur: shade(base.fur, k, toward), ear: shade(base.ear, k, toward) };
    this.sp = Object.fromEntries(Object.keys(SPRING_OMEGA).map((k) => [k, new Spring(0)])) as Record<SpringName, Spring>;
    this.sp.bodyY.x = this.bodyYFor('stand');
    this.sp.headUp.x = POSTURES.stand.headUp;
    this.sp.headFwd.x = POSTURES.stand.headFwd;
    this.feet = this.feetFor('stand').flatMap((f) => f.map((v) => new Spring(v)));
    this.fur = this.coat.fur;
    this.fx.zIndex = 100;
    this.body.addChild(this.fx);
    for (let i = 0; i < 30; i++) {
      const onHead = i >= 22;
      const a = Math.random() * Math.PI * 2;
      const y = onHead ? 0.2 + Math.random() * 0.7 : -0.2 + Math.random() * 1.1;
      this.spots.push({ onHead, dir: norm([Math.cos(a), y, Math.sin(a)]), r: 0.6 + Math.random() * 0.6 });
    }
  }

  /** Hauteur du centre du corps selon la posture, d'après les proportions de la race. */
  private bodyYFor(p: Posture): number {
    const B = this.breed;
    if (p === 'stand') return B.leg.standHeight;
    if (p === 'sit') return Math.max(B.body[1] * 1.05, B.leg.standHeight * 0.75);
    if (p === 'lie') return B.body[1] * 0.89;
    if (p === 'beg') return B.body[2] * 1.1 + 0.04;
    return B.body[0] * 0.98;
  }

  /** Pattes de la posture, mises à l'échelle du corps de la race (référence : beagle). */
  private feetFor(p: Posture): [V3, V3, V3, V3] {
    const kx = this.breed.body[0] / 0.24;
    const kz = this.breed.body[2] / 0.4;
    return POSTURES[p].feet.map((f) => [f[0] * kx, f[1], f[2] * kz] as V3) as [V3, V3, V3, V3];
  }

  /** Collier à l'écran, pour accrocher la laisse. */
  neckScreen(): { x: number; y: number } {
    return this.neckS;
  }

  /** Accessoires portés : collier, foulard, chapeau, nœud, lunettes. */
  private accessories(neckC: V3, Rb: M3, headC: V3, Rh: M3, headZ: number): void {
    const g = this.g('wear');
    g.zIndex = headZ + 0.02;
    const cg = this.g('collar');
    cg.zIndex = headZ - 0.002;
    if (this.equipped.length === 0) return;
    const B = this.breed;
    const s = this.s;
    const hex = (id: string, k: 0 | 1) => ITEM_BY_ID[id]?.colors[k] ?? 0xd23b3b;
    const front = this.facing(apply(Rh, [0, 0, 1]));
    const angle = this.screenAngle(headC, Rh);
    for (const id of this.equipped) {
      const slot = ITEM_BY_ID[id]?.slot;
      const shape = ITEM_BY_ID[id]?.shape;
      if (slot === 'collar') {
        const e = this.cam.ellipse(Rb, [B.head[0] * 0.66, B.head[1] * 0.18, B.head[2] * 0.66]);
        const c = this.toS(add(neckC, apply(Rb, [0, -B.head[1] * 0.2, 0])));
        cg.ellipse(c.x, c.y, e.a * s, Math.max(3, e.b * s)).stroke({ width: Math.max(4, s * 0.035), color: hex(id, 0) });
        cg.circle(c.x, c.y + Math.max(3, e.b * s) + s * 0.012, s * 0.022).fill(hex(id, 1)).stroke({ width: 1.5, color: 0x4a2f1f, alpha: 0.6 });
      } else if (slot === 'neck') {
        const c = this.toS(add(neckC, apply(Rb, [0, -B.head[1] * 0.25, B.head[2] * 0.2])));
        const w = B.head[0] * s * (0.55 + 0.35 * Math.abs(front));
        g.moveTo(c.x - w, c.y - s * 0.02).lineTo(c.x + w, c.y - s * 0.02).lineTo(c.x, c.y + s * 0.2).closePath().fill(hex(id, 0)).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.5 });
        g.circle(c.x, c.y + s * 0.07, s * 0.014).fill(hex(id, 1));
      } else if (slot === 'head') {
        const top = this.toS(add(headC, apply(Rh, [0, B.head[1] * 0.92, -B.head[2] * 0.1])));
        const hw = B.head[0] * s;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const at = (dx: number, dy: number) => ({ x: top.x + dx * ca - dy * sa, y: top.y + dx * sa + dy * ca });
        if (shape === 'hat') {
          const l = at(-hw * 0.75, 0);
          const r = at(hw * 0.75, 0);
          const t = at(0, -hw * 0.95);
          g.moveTo(l.x, l.y).quadraticCurveTo(at(-hw * 0.7, -hw * 0.9).x, at(-hw * 0.7, -hw * 0.9).y, t.x, t.y).quadraticCurveTo(at(hw * 0.7, -hw * 0.9).x, at(hw * 0.7, -hw * 0.9).y, r.x, r.y).closePath().fill(hex(id, 0)).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.5 });
          g.moveTo(l.x, l.y).lineTo(r.x, r.y).stroke({ width: hw * 0.22, color: hex(id, 1), cap: 'round' });
          g.circle(t.x, t.y, hw * 0.16).fill(hex(id, 1));
        } else if (shape === 'strawhat') {
          g.ellipse(top.x, top.y, hw * 1.25, hw * 0.3).fill(hex(id, 0)).stroke({ width: 2, color: 0x8a6a1a, alpha: 0.6 });
          const d = at(0, -hw * 0.25);
          g.ellipse(d.x, d.y, hw * 0.6, hw * 0.42).fill(hex(id, 0)).stroke({ width: 2, color: 0x8a6a1a, alpha: 0.6 });
          g.rect(d.x - hw * 0.6, d.y + hw * 0.05, hw * 1.2, hw * 0.14).fill(hex(id, 1));
        } else if (shape === 'crown') {
          for (let k = -2; k <= 2; k++) {
            const q = at(k * hw * 0.32, Math.abs(k) * hw * 0.08);
            g.circle(q.x, q.y, hw * 0.17).fill(k % 2 ? hex(id, 1) : hex(id, 0)).stroke({ width: 1.5, color: 0x4a2f1f, alpha: 0.4 });
          }
        } else {
          // Nœud, posé sur le côté de la tête.
          const q = this.toS(add(headC, apply(Rh, [B.head[0] * 0.55, B.head[1] * 0.75, B.head[2] * 0.2])));
          const k = hw * 0.32;
          g.moveTo(q.x, q.y).lineTo(q.x - k * 1.2, q.y - k * 0.8).lineTo(q.x - k * 1.2, q.y + k * 0.8).closePath().fill(hex(id, 0));
          g.moveTo(q.x, q.y).lineTo(q.x + k * 1.2, q.y - k * 0.8).lineTo(q.x + k * 1.2, q.y + k * 0.8).closePath().fill(hex(id, 0));
          g.circle(q.x, q.y, k * 0.4).fill(hex(id, 1));
        }
      } else if (slot === 'eyes') {
        const l = this.eyeS[1];
        const r = this.eyeS[-1];
        for (const e of [l, r]) if (e) g.circle(e.x, e.y, e.r * 1.35).fill({ color: hex(id, 1), alpha: 0.35 }).stroke({ width: Math.max(2.5, s * 0.02), color: hex(id, 0) });
        if (l && r) g.moveTo(l.x, l.y).lineTo(r.x, r.y).stroke({ width: Math.max(2, s * 0.015), color: hex(id, 0) });
      }
    }
  }

  /** Ampoule à l'écran (null si éteinte). */
  bulbScreen(): { x: number; y: number; r: number } | null {
    return this.bulbS;
  }

  /** Ampoule à l'écran, pour la toucher (F-DRE-1). */
  bulbAt(x: number, y: number): boolean {
    const b = this.bulbS;
    return !!b && Math.hypot(x - b.x, y - b.y) <= b.r;
  }

  /** Position écran de la gueule (jouet porté). */
  mouthScreen(): { x: number; y: number } {
    return this.mouthS;
  }

  // ------------------------------------------------------------ sonde pour les gestes

  readonly probe: PuppyProbe = {
    hitTest: (x, y) => this.hitTest(x, y),
    bodyCenter: () => this.bodyCS,
    nose: () => this.noseS,
    headTop: () => this.headTopS,
    headRadius: () => this.breed.head[0] * this.s,
    toFloor: (x, y) => this.room.screenToFloor(x, y),
  };

  private hitTest(x: number, y: number): BodyPart | null {
    const margin = 6;
    let best: Hit | null = null;
    for (const h of this.hits) {
      if (best && h.z <= best.z) continue;
      if (h.kind === 'ellipse') {
        const c = Math.cos(-h.rot);
        const s = Math.sin(-h.rot);
        const dx = x - h.cx;
        const dy = y - h.cy;
        const lx = dx * c - dy * s;
        const ly = dx * s + dy * c;
        if ((lx / (h.a + margin)) ** 2 + (ly / (h.b + margin)) ** 2 <= 1) best = h;
      } else {
        const vx = h.bx - h.ax;
        const vy = h.by - h.ay;
        const l2 = vx * vx + vy * vy || 1;
        const k = clamp(((x - h.ax) * vx + (y - h.ay) * vy) / l2, 0, 1);
        if (Math.hypot(x - (h.ax + vx * k), y - (h.ay + vy * k)) <= h.r + margin) best = h;
      }
    }
    if (!best) return null;
    if (best.part !== 'body') return best.part;
    const u = ((x - this.bodyCS.x) * this.bodyUpS.x + (y - this.bodyCS.y) * this.bodyUpS.y) / this.bodyUpS.len;
    return u > 0.35 ? 'back' : u < -0.3 ? 'belly' : 'flank';
  }

  // ------------------------------------------------------------ animation

  update(dtMs: number, mind: PuppyMind, pointer: { x: number; y: number } | null, cleanliness = 100, equipped: readonly string[] = []): void {
    this.equipped = equipped;
    const dt = Math.min(dtMs, 50) / 1000;
    const now = (this.t += dt);
    this.consume(mind.events, now);
    this.cleanliness = cleanliness;
    this.fur = shade(this.coat.fur, 0.28 * mind.bath.wet, 0x4a3020);

    // Position au sol et orientation.
    const k = 1 - Math.exp(-dt * 10);
    const prevX = this.px;
    const prevZ = this.pz;
    this.px += (mind.pos.x - this.px) * k;
    this.pz += (mind.pos.z - this.pz) * k;
    const fu = this.room.floorUnits(this.pz);
    const speed = dt > 0 ? Math.hypot((this.px - prevX) * fu.x, (this.pz - prevZ) * fu.z) / dt : 0;
    const dyaw = angleDiff(this.yaw, mind.facing);
    const turn = clamp(dyaw * Math.min(1, dt * 7), -6 * dt, 6 * dt);
    this.yaw += turn;
    this.yawVel = dt > 0 ? turn / dt : 0;

    const fs = this.room.floorToScreen({ x: this.px, z: this.pz });
    this.container.zIndex = this.pz;
    this.ox = fs.x;
    this.oy = fs.y;
    this.s = fs.s * this.breed.size;

    const O = this.offsets(now);
    const pose = POSTURES[mind.posture];
    const E = MOODS[mind.mood];
    const ex = mind.excitement;
    const sp = this.sp;
    const step = (n: SpringName, target: number, zeta = 1) => sp[n].step(target, dt, SPRING_OMEGA[n], zeta);

    // Démarche.
    const moving = step('moving', speed > 0.05 && mind.posture === 'stand' ? 1 : 0);
    const running = mind.gait === 'run';
    const stride = running ? 0.15 : 0.1;
    this.gaitPhase += dt * Math.PI * 2 * clamp(speed / (2 * stride), 0, 4.5);
    const gp = this.gaitPhase;

    // Respiration, queue, rebond.
    this.breathPhase += dt * Math.PI * 2 * (0.35 + ex * 0.5 + (E.tongue > 0.5 ? 0.9 : 0));
    const breath = Math.sin(this.breathPhase) * 0.022;
    this.wagPhase += dt * Math.PI * 2 * E.wagHz * (0.6 + ex * 0.8);
    const petted = mind.activity === 'petted';
    const bounce = E.bounce * (1 - moving) * Math.abs(Math.sin(now * 6.5)) * 0.022 * (PuppyView.reduceMotion ? 0.25 : 1);

    step('bodyY', this.bodyYFor(mind.posture) - (E.crouch + O.crouch) * 0.07 + O.bodyY + bounce + moving * Math.abs(Math.sin(gp * 2)) * 0.014);
    step('bodyZ', pose.bodyZ + O.bodyZ);
    step('pitch', pose.pitch + O.pitch + (running ? moving * Math.sin(gp) * 0.09 : 0));
    step('roll', pose.roll + O.roll, 0.8);
    const kh = this.breed.head[1] / 0.215;
    step('headUp', pose.headUp * kh);
    step('headFwd', pose.headFwd * (this.breed.head[2] / 0.215));
    step('headTilt', E.headTilt + O.headTilt + (petted ? Math.sin(now * 1.6) * 0.15 : 0), 0.7);
    step('earLift', clamp(E.earLift + O.earLift - 0.7 * mind.bath.wet, -1, 1.2));
    step('tailUp', E.tailUp + O.tailUp);
    step('wagAmp', E.wagAmp * (0.55 + 0.45 * ex) + O.wag);
    step('mouth', clamp(E.mouth + O.mouth, 0, 1.3));
    step('tongue', clamp(E.tongue + O.tongue, 0, 1.2));
    step('brow', clamp(E.brow + O.brow, -1, 1));
    step('lowLid', E.lowLid);

    // Clignement.
    if (now > this.blinkAt) {
      this.blinkUntil = now + 0.13;
      this.blinkAt = now + (Math.random() < 0.15 ? 0.3 : 2 + Math.random() * 3.5);
    }
    const lidTarget = now < this.blinkUntil ? 1 : clamp(E.lids + O.lids + (petted ? 0.1 : 0), -0.3, 1);
    step('lids', lidTarget);

    // Regard : le doigt s'il est attentif, sinon la cible donnée par la simulation.
    const dir = this.lookDir(mind, pointer, fu);
    const wantYaw = angleDiff(this.yaw, Math.atan2(dir[0], dir[2]));
    const wantPitch = Math.atan2(dir[1], Math.hypot(dir[0], dir[2]));
    step('lookYaw', clamp(wantYaw * 0.8, -1.05, 1.05));
    step('lookPitch', clamp(wantPitch * 0.8, -0.8, 0.9));
    if (now > this.saccadeAt) {
      this.saccadeAt = now + 0.8 + Math.random() * 2;
      this.saccade = pointer ? { x: 0, y: 0 } : { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.3 };
    }
    step('irisX', clamp((wantYaw - sp.lookYaw.x) * 1.7 + this.saccade.x, -1, 1));
    step('irisY', clamp(-(wantPitch - sp.lookPitch.x) * 1.7 + this.saccade.y, -1, 1));

    // Pattes.
    const phases = running ? [0, 0.6, Math.PI, Math.PI + 0.6] : [0, Math.PI, Math.PI, 0];
    this.feetFor(mind.posture).forEach((f, i) => {
      const ph = gp + (phases[i] ?? 0);
      let fx = f[0];
      let fy = f[1] + Math.max(0, Math.cos(ph)) * (running ? 0.085 : 0.055) * moving;
      let fz = f[2] + Math.sin(ph) * stride * moving;
      if (i < 2 && O.paddle > 0) {
        const d = Math.sin(now * 17 + (i ? Math.PI : 0));
        fz += O.paddle * 0.1 * d;
        fy += O.paddle * 0.06 * Math.max(0, d);
      }
      if (i === 0 && O.paw > 0) {
        fy += O.paw * 0.22;
        fz += O.paw * 0.14;
      }
      if (i >= 2 && O.hindUp > 0) fy += O.hindUp * 0.32;
      if (i === 3 && O.scratch > 0) {
        fx = fx + (-0.05 - fx) * O.scratch;
        fy = fy + (0.36 + Math.sin(now * 32) * 0.035 - fy) * O.scratch;
        fz = fz + (0.12 - fz) * O.scratch;
      }
      this.feet[i * 3]?.step(fx, dt, 14);
      this.feet[i * 3 + 1]?.step(fy, dt, 14);
      this.feet[i * 3 + 2]?.step(fz, dt, 14);
    });

    this.draw(mind, O, breath, dt, now);

    if (mind.reactionSeq !== this.lastReaction) {
      this.lastReaction = mind.reactionSeq;
      this.onReaction?.(mind.reactionSeq);
    }
  }

  private consume(events: readonly PuppyEvent[], now: number): void {
    if (this.lastSeq < 0) {
      this.lastSeq = events.at(-1)?.seq ?? 0;
      return;
    }
    for (const e of events) {
      if (e.seq <= this.lastSeq) continue;
      this.lastSeq = e.seq;
      const dur = ACT_MS[e.type];
      if (dur) this.acts.push({ kind: e.type, t0: now, dur: dur / 1000 });
    }
    this.acts = this.acts.filter((a) => now - a.t0 < a.dur);
  }

  private offsets(now: number): Offsets {
    const o = zeroOffsets();
    for (const a of this.acts) {
      const u = clamp((now - a.t0) / a.dur, 0, 1);
      const env = Math.sin(Math.PI * u);
      switch (a.kind) {
        case 'jump':
          o.rootY += 0.3 * Math.sin(Math.PI * u);
          o.pitch += 0.22 * Math.sin(Math.PI * 2 * u);
          o.earFlap += env;
          break;
        case 'spin':
          o.yaw += Math.PI * 2 * smooth(u);
          break;
        case 'shake':
          o.roll += 0.32 * Math.sin(u * Math.PI * 12) * (1 - u);
          o.earFlap += env * 1.5;
          o.lids += 0.6 * env;
          break;
        case 'startle':
          o.rootY += 0.1 * Math.sin(Math.min(1, u * 2.5) * Math.PI);
          o.bodyZ -= 0.08 * env;
          o.crouch += 0.3 * env;
          o.earLift -= env;
          break;
        case 'playBow':
          o.pitch -= 0.5 * env;
          o.bodyY -= 0.07 * env;
          o.headPitch += 0.35 * env;
          o.tailUp += 0.5 * env;
          o.wag += 0.6 * env;
          o.mouth += 0.4 * env;
          break;
        case 'backOff':
          o.bodyZ -= 0.1 * env;
          o.pitch += 0.12 * env;
          break;
        case 'wiggle':
          o.roll += 0.1 * Math.sin(u * Math.PI * 8);
          o.wag += 0.8 * env;
          break;
        case 'bark':
          o.mouth += env;
          o.headPitch += 0.25 * env;
          o.earFlap += 0.4 * env;
          break;
        case 'yip':
          o.mouth += 0.6 * env;
          o.headPitch += 0.15 * env;
          break;
        case 'whine':
          o.headTilt += 0.3 * env;
          o.mouth += 0.15 * env;
          o.brow -= env;
          break;
        case 'yelp':
          o.mouth += env;
          o.headPitch += 0.3 * env;
          o.earLift -= env;
          break;
        case 'sniff':
          o.nose += env;
          o.headPitch -= 0.06 * Math.sin(u * Math.PI * 7);
          break;
        case 'sniffGround':
          o.headPitch -= 0.8 * env;
          o.nose += env;
          break;
        case 'lick':
          o.tongue += env;
          o.tongueUp += env;
          o.mouth += 0.5 * env;
          break;
        case 'yawn':
          o.mouth += 1.3 * env;
          o.lids += env;
          o.headPitch += 0.35 * env;
          o.earLift -= 0.4 * env;
          break;
        case 'scratch':
          o.scratch += smooth(Math.min(1, env * 2));
          o.headTilt += 0.4 * env;
          o.lids += 0.45 * env;
          break;
        case 'dig':
          o.paddle += smooth(Math.min(1, env * 2));
          o.headPitch -= 0.55 * env;
          break;
        case 'howl':
          o.headPitch += 1.0 * env;
          o.mouth += 0.55 * env;
          o.lids += 0.35 * env;
          break;
        case 'perk':
          o.earLift += env;
          o.headTilt += 0.25 * env;
          break;
        case 'flop':
          o.rootY += 0.05 * env;
          break;
        case 'chew':
          o.mouth += 0.55 * Math.abs(Math.sin(u * Math.PI * 2));
          break;
        case 'lap':
          o.tongue += env;
          o.mouth += 0.3 * env;
          break;
        case 'lickLips':
          o.tongue += env;
          o.tongueUp += env;
          o.mouth += 0.35 * env;
          break;
        case 'givePaw':
          o.paw += Math.min(1, env * 2.2);
          o.headTilt += 0.2 * env;
          break;
        case 'roll':
          o.roll += Math.PI * 2 * smooth(u);
          break;
        case 'flip':
          o.rootY += 0.45 * Math.sin(Math.PI * u);
          o.pitch += Math.PI * 2 * smooth(u);
          o.earFlap += env;
          break;
        case 'handstand': {
          const hold = Math.min(1, u * 4, (1 - u) * 4);
          o.pitch -= 1.25 * hold;
          o.bodyY += 0.12 * hold;
          o.hindUp += hold;
          o.headPitch += 0.6 * hold;
          break;
        }
        case 'playdead': {
          const hold = Math.min(1, u * 4, (1 - u) * 5);
          o.roll += 1.5 * hold;
          o.lids += hold;
          o.tongue += 0.9 * hold;
          o.mouth += 0.4 * hold;
          o.hindUp += 0.5 * hold;
          break;
        }
        case 'dance':
          o.yaw += Math.PI * 2 * smooth(u);
          o.rootY += 0.05 * Math.abs(Math.sin(u * Math.PI * 6));
          break;
        case 'learned':
          o.rootY += 0.12 * Math.abs(Math.sin(u * Math.PI * 2));
          o.wag += env;
          break;
        case 'lookAway':
          o.headTilt -= 0.2 * env;
          break;
        case 'stretch':
          o.pitch -= 0.4 * env;
          o.bodyY -= 0.05 * env;
          o.headPitch += 0.3 * env;
          o.lids += 0.7 * env;
          o.mouth += 0.6 * env;
          break;
        default:
          break;
      }
    }
    if (PuppyView.reduceMotion) {
      // Les tours restent lisibles, sans grands mouvements du corps entier.
      o.rootY *= 0.35;
      o.yaw *= 0.25;
      o.roll *= 0.35;
      o.pitch *= 0.35;
    }
    return o;
  }

  private lookDir(mind: PuppyMind, pointer: { x: number; y: number } | null, fu: { x: number; z: number }): V3 {
    const forward = (v: V3): V3 => apply(rotY(this.yaw), v);
    const towardPointer = (p: { x: number; y: number }): V3 => {
      const zt = 1.6;
      const dx = (p.x - this.headS.x) / this.s;
      const dy = (p.y - this.headS.y) / this.s;
      return [dx, (this.cam.sin * zt - dy) / this.cam.cos, zt];
    };
    if (pointer && mind.attentive) return towardPointer(pointer);
    const L = mind.look;
    switch (L.kind) {
      case 'player':
      case 'hand':
        return [-this.headC[0] * 0.2, 0.3, 2.5];
      case 'point':
        return sub([(L.x - this.px) * fu.x, 0, (L.z - this.pz) * fu.z], this.headC);
      case 'up':
        return forward([0, 1.2, 0.35]);
      case 'ground':
        return forward([0, -1, 0.55]);
      case 'away':
        return forward([0, -0.35, 1]);
    }
  }

  // ------------------------------------------------------------ dessin

  private g(name: string): Graphics {
    let g = this.gfx.get(name);
    if (!g) {
      g = new Graphics();
      this.gfx.set(name, g);
      this.body.addChild(g);
    }
    g.clear();
    g.visible = true;
    return g;
  }

  private toS(p: V3): { x: number; y: number } {
    const q = this.cam.project(p);
    return { x: this.ox + q.x * this.s, y: this.oy + q.y * this.s };
  }

  private ell(name: string, c: V3, R: M3, r: readonly number[], fill: number, opt: { z?: number; outline?: boolean; hit?: HitPart } = {}): number {
    const e = this.cam.ellipse(R, r);
    const p = this.toS(c);
    const g = this.g(name);
    const s = this.s;
    g.ellipse(0, 0, e.a * s, e.b * s).fill(fill);
    if (opt.outline !== false) g.stroke({ width: this.ol, color: shade(fill, 0.55, this.breed.colors.outline), alpha: 0.9 });
    g.position.set(p.x, p.y);
    g.rotation = e.rot;
    const z = opt.z ?? this.cam.depth(c);
    g.zIndex = z;
    if (opt.hit) this.hits.push({ part: opt.hit, z, kind: 'ellipse', cx: p.x, cy: p.y, a: e.a * s, b: e.b * s, rot: e.rot });
    return z;
  }

  /** Tache de pelage intérieure à une partie : visible seulement du côté où elle se trouve. */
  private patch(name: string, parentC: V3, parentZ: number, c: V3, R: M3, r: readonly number[], fill: number): void {
    const front = dot(sub(c, parentC), this.cam.view) > 0;
    this.ell(name, c, R, r, fill, { z: parentZ + (front ? 0.0005 : -0.0005), outline: false });
  }

  private get ol(): number {
    return Math.max(1.4, this.s * 0.011);
  }

  private draw(mind: PuppyMind, O: Offsets, breath: number, dt: number, now: number): void {
    const B = this.breed;
    const sp = this.sp;
    const s = this.s;
    this.hits = [];

    const yaw = this.yaw + O.yaw;
    const Ry = rotY(yaw);
    const Rb = mul(Ry, mul(rotX(sp.pitch.x), rotZ(sp.roll.x)));
    const lift = O.rootY;
    const bodyC = apply(Ry, [0, sp.bodyY.x + lift, sp.bodyZ.x]);
    const bodyR = [B.body[0], B.body[1] * (1 + breath), B.body[2]];
    const inBody = (v: readonly number[]): V3 => add(bodyC, apply(Rb, v));

    // Tête.
    const pose = POSTURES[mind.posture];
    const neck = inBody([0, B.body[1] * 0.6, B.body[2] * 0.75]);
    const headC = add(neck, apply(Rb, [0, sp.headUp.x, sp.headFwd.x]));
    const headYaw = yaw + sp.lookYaw.x;
    const headRoll = sp.roll.x * pose.headRollFollow + sp.headTilt.x;
    const eatingNow = mind.activity === 'eat' && mind.eating?.until != null;
    const headPitch = sp.lookPitch.x - MOODS[mind.mood].headDrop + (mind.activity === 'petted' ? 0.12 : 0) - (eatingNow ? 0.9 : 0) + O.headPitch;
    const Rh = mul(rotY(headYaw), mul(rotX(headPitch), rotZ(headRoll)));
    const inHead = (v: readonly number[]): V3 => add(headC, apply(Rh, v));
    this.headC = headC;

    // Ombre.
    const root = this.toS([0, 0, 0]);
    const shrink = 1 - clamp(lift * 1.5, 0, 0.5);
    this.shadow.clear();
    this.shadow
      .ellipse(root.x, root.y, s * (0.3 + 0.16 * Math.abs(Math.sin(yaw))) * shrink, s * 0.085 * shrink)
      .fill({ color: 0x3a2618, alpha: 0.16 });

    // Corps et taches.
    const bodyZ = this.ell('body', bodyC, Rb, bodyR, this.fur, { hit: 'body' });
    if (this.coat.saddle !== null) this.patch('saddle', bodyC, bodyZ, inBody([0, B.body[1] * 0.26, -B.body[2] * 0.12]), Rb, [B.body[0] * 0.92, B.body[1] * 0.74, B.body[2] * 0.78], this.coat.saddle);
    this.patch('belly', bodyC, bodyZ, inBody([0, -B.body[1] * 0.3, B.body[2] * 0.05]), Rb, [B.body[0] * 0.8, B.body[1] * 0.7, B.body[2] * 0.8], this.coat.chest);
    this.ell('chest', inBody([0, -0.01, B.body[2] * 0.62]), Rb, B.chest, this.coat.chest, { hit: 'body' });
    const cs = this.toS(bodyC);
    const up = this.toS(inBody([0, B.body[1], 0]));
    const ux = up.x - cs.x;
    const uy = up.y - cs.y;
    const ul = Math.hypot(ux, uy) || 1;
    this.bodyCS = cs;
    this.bodyUpS = { x: ux / ul, y: uy / ul, len: ul };

    // Pattes.
    const hips: V3[] = [
      [B.body[0] * 0.55, -B.body[1] * 0.5, B.body[2] * 0.58],
      [-B.body[0] * 0.55, -B.body[1] * 0.5, B.body[2] * 0.58],
      [B.body[0] * 0.58, -B.body[1] * 0.45, -B.body[2] * 0.58],
      [-B.body[0] * 0.58, -B.body[1] * 0.45, -B.body[2] * 0.58],
    ];
    hips.forEach((h, i) => {
      const hip = inBody(h);
      const fl: V3 = [this.feet[i * 3]?.x ?? 0, (this.feet[i * 3 + 1]?.x ?? 0) + lift * 0.75, this.feet[i * 3 + 2]?.x ?? 0];
      const foot = apply(Ry, fl);
      this.leg(`leg${i}`, hip, foot, Ry, this.fur, this.coat.paws);
    });

    // Queue.
    this.tail(inBody([0, B.body[1] * 0.45, -B.body[2] * 0.93]), Rb);

    // Cou : relie les épaules à la tête sous tous les angles.
    const neckC = add(scale(neck, 0.55), scale(headC, 0.45));
    this.ell('neck', neckC, Rb, [B.head[0] * 0.62, B.head[1] * 0.75, B.head[2] * 0.62], this.fur, { hit: 'head', outline: false });

    // Tête, museau, nez.
    const headZ = this.ell('head', headC, Rh, B.head, this.fur, { hit: 'head' });
    if (this.coat.blaze) this.patch('blaze', headC, headZ, inHead([0, 0.045, 0.1]), Rh, [B.head[0] * 0.19, B.head[1] * 0.56, B.head[2] * 0.51], this.coat.chest);
    else this.gfx.get('blaze')?.clear();
    const muzzleC = inHead(B.muzzleAt);
    const muzzleZ = this.ell('muzzle', muzzleC, Rh, B.muzzle, this.coat.muzzle, { hit: 'muzzle' });
    const twitch = O.nose > 0 ? 1 + Math.sin(now * 40) * 0.08 * O.nose : 1;
    const noseC = inHead([0, B.muzzleAt[1] + 0.035, B.muzzleAt[2] + B.muzzle[2] * 0.9]);
    this.ell('nose', noseC, Rh, [B.nose[0] * twitch, B.nose[1] * twitch, B.nose[2]], B.colors.nose, { z: Math.max(muzzleZ, this.cam.depth(noseC)) + 0.002, hit: 'muzzle' });
    this.noseHighlight(noseC, Rh);
    this.noseS = this.toS(noseC);
    this.headS = this.toS(headC);
    this.headTopS = this.toS(add(headC, [0, B.head[1], 0]));

    this.mouth(muzzleC, Rh, muzzleZ, O);
    for (const side of [1, -1] as const) {
      this.eye(side, headC, Rh, headZ);
      this.ear(side, headC, Rh, headYaw, headRoll, headZ, O, dt, now);
    }
    this.neckS = this.toS(neckC);
    this.accessories(neckC, Rb, headC, Rh, headZ);
    this.extras(mind, bodyC, Rb, bodyR, headC, Rh, bodyZ, now);
  }

  /** Point de la surface d'un ellipsoïde dans la direction `d` (repère local) et sa normale. */
  private surface(c: V3, R: M3, r: readonly number[], d: V3): { p: V3; n: V3 } {
    const r0 = r[0] ?? 1;
    const r1 = r[1] ?? 1;
    const r2 = r[2] ?? 1;
    const k = 1 / Math.hypot(d[0] / r0, d[1] / r1, d[2] / r2);
    const local: V3 = [d[0] * k, d[1] * k, d[2] * k];
    return { p: add(c, apply(R, local)), n: apply(R, norm([local[0] / r0 ** 2, local[1] / r1 ** 2, local[2] / r2 ** 2])) };
  }

  /** Bulles, gouttes, saleté, éclat, sommeil. */
  private extras(mind: PuppyMind, bodyC: V3, Rb: M3, bodyR: readonly number[], headC: V3, Rh: M3, bodyZ: number, now: number): void {
    const s = this.s;
    const fx = this.fx;
    fx.clear();
    const B = this.breed;
    const visible = this.spots
      .map((sp, i) => ({ i, sp, ...this.surface(sp.onHead ? headC : bodyC, sp.onHead ? Rh : Rb, sp.onHead ? B.head : bodyR, sp.dir) }))
      .filter((v) => this.facing(v.n) > 0.15);

    // Saleté (F-SOIN-4) : dès que le pelage n'est plus « Superbe », des taches de boue
    // de plus en plus nombreuses et foncées ; très sale, de la poussière flotte autour.
    const dirt = clamp((90 - this.cleanliness) / 75, 0, 1);
    const dg = this.g('dirt');
    dg.zIndex = bodyZ + 0.0008;
    if (dirt > 0) {
      for (const v of visible) {
        if ((v.sp.onHead && dirt < 0.35) || (!v.sp.onHead && v.i % 2 !== 0) || v.i / this.spots.length > Math.max(dirt, 0.25)) continue;
        const q = this.toS(v.p);
        const k = 0.8 + 0.7 * dirt;
        // Les taches de la tête passent au-dessus d'elle (calque des effets), celles du corps restent dessous.
        const g = v.sp.onHead ? fx : dg;
        g.ellipse(q.x, q.y, s * 0.045 * v.sp.r * k, s * 0.032 * v.sp.r * k).fill({ color: 0x5e3f22, alpha: 0.35 + 0.35 * dirt });
        g.circle(q.x + s * 0.03 * v.sp.r, q.y + s * 0.02, s * 0.012 * k).fill({ color: 0x5e3f22, alpha: 0.3 + 0.3 * dirt });
      }
      if (dirt > 0.6) {
        const c = this.toS(bodyC);
        for (let k = 0; k < 6; k++) {
          const a = now * 0.6 + k * 1.05;
          dg.circle(c.x + Math.cos(a) * s * 0.42, c.y - s * 0.25 + Math.sin(a * 1.3) * s * 0.16, s * 0.012).fill({ color: 0x8a7258, alpha: 0.55 });
        }
      }
    }

    // Mousse du bain.
    const foam = mind.bath.foam;
    const n = Math.round(foam * visible.length);
    for (let k = 0; k < n; k++) {
      const v = visible[k];
      if (!v) break;
      const q = this.toS(v.p);
      const wob = 1 + Math.sin(now * 3 + v.i) * 0.08;
      fx.circle(q.x, q.y, s * 0.045 * v.sp.r * wob).fill({ color: 0xffffff, alpha: 0.95 }).stroke({ width: 1.2, color: 0xb9d4e6 });
      fx.circle(q.x - s * 0.012, q.y - s * 0.014, s * 0.01).fill({ color: 0xe8f4ff });
    }

    // Gouttes : pelage mouillé.
    if (mind.bath.wet > 0) {
      for (let k = 0; k < 6; k++) {
        const v = visible[(k * 5) % Math.max(1, visible.length)];
        if (!v) break;
        const q = this.toS(v.p);
        const fall = ((now * 0.9 + k * 0.17) % 1) * s * 0.35;
        fx.ellipse(q.x, q.y + fall, s * 0.012, s * 0.02).fill({ color: 0x7fb6dd, alpha: 0.85 * mind.bath.wet * (1 - fall / (s * 0.35)) });
      }
    }

    // Éclat : après la brosse, ou pelage superbe.
    const shine = mind.shineUntil > mind.t ? 1 : this.cleanliness >= 90 ? 0.4 : 0;
    if (shine > 0) {
      for (let k = 0; k < 5; k++) {
        const v = visible[(k * 7 + 3) % Math.max(1, visible.length)];
        if (!v) break;
        const tw = Math.max(0, Math.sin(now * 2.2 + k * 1.7));
        if (tw * shine < 0.35) continue;
        const q = this.toS(v.p);
        const r = s * 0.035 * tw;
        fx.moveTo(q.x - r, q.y).lineTo(q.x + r, q.y).moveTo(q.x, q.y - r * 1.4).lineTo(q.x, q.y + r * 1.4).stroke({ width: 2, color: 0xfff6c8, cap: 'round' });
      }
    }

    // F-DRE-1 : l'ampoule ; F-DRE-3 : point d'interrogation rouge ou bleu.
    const top = this.toS(add(headC, [0, B.head[1] * 2.1, 0]));
    this.bulbS = null;
    if (mind.bulb && mind.bulb.until > mind.t) {
      const r = Math.max(18, s * 0.09);
      const pulse = 1 + Math.sin(now * 8) * 0.06;
      fx.circle(top.x, top.y, r * 1.6 * pulse).fill({ color: 0xfff1a8, alpha: 0.35 });
      fx.circle(top.x, top.y - r * 0.15, r * pulse).fill(0xffd84a).stroke({ width: 2.5, color: 0x8a6a1a });
      fx.roundRect(top.x - r * 0.45, top.y + r * 0.7, r * 0.9, r * 0.55, r * 0.15).fill(0xb9a58a).stroke({ width: 2, color: 0x6b5444 });
      fx.moveTo(top.x - r * 0.3, top.y - r * 0.1).quadraticCurveTo(top.x, top.y - r * 0.6, top.x + r * 0.3, top.y - r * 0.1).stroke({ width: 2, color: 0xfffbe6 });
      this.bulbS = { x: top.x, y: top.y, r: r * 1.7 };
    }
    const q = this.acts.find((a) => a.kind === 'confused' || a.kind === 'similar');
    if (q) {
      const r = Math.max(16, s * 0.075);
      const color = q.kind === 'confused' ? 0xc83a2a : 0x3a78c8;
      fx.circle(top.x, top.y, r).fill(0xffffff).stroke({ width: 3, color });
      fx.arc(top.x, top.y - r * 0.2, r * 0.32, Math.PI * 1.1, Math.PI * 2.15).stroke({ width: r * 0.2, color, cap: 'round' });
      fx.moveTo(top.x + r * 0.28, top.y - r * 0.05).lineTo(top.x, top.y + r * 0.22).stroke({ width: r * 0.2, color, cap: 'round' });
      fx.circle(top.x, top.y + r * 0.52, r * 0.12).fill(color);
    }

    // Sommeil : des « Z » qui montent.
    if (mind.activity === 'sleep') {
      const top = this.toS(add(headC, [0.15, 0.25, 0]));
      for (let k = 0; k < 3; k++) {
        const u = (now * 0.35 + k / 3) % 1;
        const size = s * (0.04 + 0.04 * u);
        const x = top.x + u * s * 0.25;
        const y = top.y - u * s * 0.45;
        fx.moveTo(x - size, y - size)
          .lineTo(x + size, y - size)
          .lineTo(x - size, y + size)
          .lineTo(x + size, y + size)
          .stroke({ width: 2.5, color: 0x5d6a9a, alpha: 1 - u, cap: 'round', join: 'round' });
      }
    }
  }

  private leg(name: string, hip: V3, foot: V3, Ry: M3, fur: number, paw: number): void {
    const a = this.toS(hip);
    const b = this.toS(foot);
    const w = this.breed.leg.width * this.s;
    const z = this.cam.depth(add(scale(hip, 0.5), scale(foot, 0.5)));
    const g = this.g(name);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w + this.ol * 2, color: shade(fur, 0.55, this.breed.colors.outline), cap: 'round' });
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: w, color: fur, cap: 'round' });
    g.position.set(0, 0);
    g.rotation = 0;
    g.zIndex = z;
    this.hits.push({ part: 'paw', z, kind: 'capsule', ax: a.x, ay: a.y, bx: b.x, by: b.y, r: w / 2 });
    this.ell(`${name}paw`, add(foot, apply(Ry, [0, 0.035, 0.03])), Ry, [0.066, 0.045, 0.08], paw, { z: z + 0.001, hit: 'paw' });
  }

  /** Forme de queue par type : port de base, courbure, effilement. */
  private static readonly TAILS = {
    straight: { lift: -0.3, curl: 0.22, taper: [1, 0.85, 0.7], segs: 3 },
    otter: { lift: -0.5, curl: 0.12, taper: [1.2, 0.85, 0.5], segs: 3 },
    whip: { lift: -0.1, curl: 0.4, taper: [1, 0.8, 0.55], segs: 4 },
    bushy: { lift: -1.0, curl: 0.16, taper: [0.9, 1.15, 1.0, 0.7], segs: 4 },
    curl: { lift: 0.6, curl: 1.25, taper: [1, 0.95, 0.85, 0.75, 0.6], segs: 5 },
  } as const;

  private tail(base: V3, Rb: M3): void {
    const T = this.breed.tail;
    const shape = PuppyView.TAILS[T.type];
    const sp = this.sp;
    const curled = T.type === 'curl';
    // Une queue en tire-bouchon remue peu, et se déroule quand il a peur ou boude.
    const wag = sp.wagAmp.x * Math.sin(this.wagPhase) * (curled ? 0.35 : 1);
    const up = sp.tailUp.x;
    let elev = shape.lift + up * (curled ? 0.6 : 1.15);
    const curl = curled ? shape.curl * Math.max(0.1, up + 0.4) : shape.curl * Math.max(0, up);
    const n = shape.segs;
    const pts: V3[] = [base];
    for (let i = 0; i < n; i++) {
      elev += curl;
      const w = wag * (0.6 + (0.4 * i) / Math.max(1, n - 1) * 2);
      const d: V3 = [Math.sin(w) * Math.cos(elev), Math.sin(elev), -Math.cos(w) * Math.cos(elev)];
      const prev = pts[i] ?? base;
      pts.push(add(prev, scale(apply(Rb, d), T.length / n)));
    }
    const sc = pts.map((p) => this.toS(p));
    const z = this.cam.depth(pts[Math.floor(n / 2)] ?? base);
    const g = this.g('tail');
    const outline = shade(this.fur, 0.55, this.breed.colors.outline);
    const widths = Array.from({ length: n }, (_, i) => T.width * this.s * (shape.taper[i] ?? 0.6));
    for (let i = 0; i < n; i++) {
      const a = sc[i];
      const b = sc[i + 1];
      if (!a || !b) continue;
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: (widths[i] ?? 1) + this.ol * 2, color: outline, cap: 'round' });
    }
    for (let i = 0; i < n; i++) {
      const a = sc[i];
      const b = sc[i + 1];
      if (!a || !b) continue;
      const tip = i === n - 1 && this.coat.tailTip !== null;
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: widths[i] ?? 1, color: tip ? (this.coat.tailTip ?? this.fur) : this.fur, cap: 'round' });
      this.hits.push({ part: 'tail', z, kind: 'capsule', ax: a.x, ay: a.y, bx: b.x, by: b.y, r: (widths[i] ?? 1) / 2 + 4 });
    }
    g.position.set(0, 0);
    g.rotation = 0;
    g.zIndex = z;
  }

  private facing(normal: V3): number {
    return dot(norm(normal), this.cam.view);
  }

  /** Angle à l'écran de l'axe latéral de la tête. */
  private screenAngle(c: V3, R: M3): number {
    const a = this.toS(c);
    const b = this.toS(add(c, apply(R, [1, 0, 0])));
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  private eye(side: 1 | -1, headC: V3, Rh: M3, headZ: number): void {
    const B = this.breed;
    const sp = this.sp;
    const dirL = norm([side * 0.44, 0.2, 0.87]);
    const pos = add(headC, apply(Rh, scale(mulEach(dirL, B.head), 0.97)));
    const f = this.facing(apply(Rh, dirL));
    const g = this.g(`eye${side}`);
    if (f < 0.1) {
      g.visible = false;
      this.gfx.get(`brow${side}`)?.clear();
      this.eyeS[side] = null;
      return;
    }
    const p = this.toS(pos);
    const s = this.s;
    const rx = B.eyeRadius * s * (0.3 + 0.7 * f);
    const ry = B.eyeRadius * s * 1.08;
    this.eyeS[side] = { x: p.x, y: p.y, r: Math.max(rx, ry), rot: this.screenAngle(headC, Rh) };
    g.position.set(p.x, p.y);
    g.rotation = this.screenAngle(headC, Rh);
    g.zIndex = headZ + 0.01;
    g.ellipse(0, 0, rx, ry).fill(SCLERA);
    const ix = sp.irisX.x * rx * 0.22;
    const iy = sp.irisY.x * ry * 0.16;
    g.ellipse(ix, iy, rx * 0.84, ry * 0.86).fill(IRIS);
    g.circle(ix - rx * 0.3, iy - ry * 0.35, ry * 0.22).fill(0xffffff);
    g.circle(ix + rx * 0.28, iy + ry * 0.24, ry * 0.1).fill({ color: 0xffffff, alpha: 0.85 });

    const lash = shade(this.fur, 0.7, B.colors.outline);
    const lw = Math.max(1.2, s * 0.012);
    g.ellipse(0, 0, rx, ry).stroke({ width: lw * 0.7, color: lash, alpha: 0.5 });
    const top = clamp(sp.lids.x, 0, 1);
    const low = clamp(sp.lowLid.x, 0, 0.9) * (1 - top * 0.6);
    if (top > 0.02) {
      const yc = -ry + 2 * ry * Math.min(top, 0.98);
      const a0 = Math.asin(clamp(yc / ry, -1, 1));
      const xc = rx * Math.cos(a0);
      g.moveTo(xc, yc);
      for (let i = 1; i <= 14; i++) {
        const a = a0 + ((-Math.PI - 2 * a0) * i) / 14;
        g.lineTo(rx * Math.cos(a), ry * Math.sin(a));
      }
      g.quadraticCurveTo(0, yc + ry * 0.3 * top, xc, yc).fill(this.fur);
      g.moveTo(-xc - lw * 0.3, yc).quadraticCurveTo(0, yc + ry * 0.3 * top, xc + lw * 0.3, yc).stroke({ width: lw, color: lash, cap: 'round' });
    }
    if (low > 0.02) {
      const yc = ry - 2 * ry * low;
      const a0 = Math.asin(clamp(yc / ry, -1, 1));
      const xc = rx * Math.cos(a0);
      g.moveTo(xc, yc);
      for (let i = 1; i <= 14; i++) {
        const a = a0 + ((Math.PI - 2 * a0) * i) / 14;
        g.lineTo(rx * Math.cos(a), ry * Math.sin(a));
      }
      g.quadraticCurveTo(0, yc - ry * 0.45 * low, xc, yc).fill(this.fur);
      g.moveTo(-xc, yc).quadraticCurveTo(0, yc - ry * 0.45 * low, xc, yc).stroke({ width: lw * 0.8, color: lash, alpha: 0.6, cap: 'round' });
    }

    // Sourcil : relevé (curieux) ou intérieur levé (triste).
    const browDir = norm([side * 0.42, 0.5, 0.76]);
    const bp = this.toS(add(headC, apply(Rh, mulEach(browDir, B.head))));
    const bg = this.g(`brow${side}`);
    if (f < 0.3) return;
    const b = sp.brow.x;
    const len = B.eyeRadius * s * 0.95 * (0.4 + 0.6 * f);
    const raise = Math.max(0, b) * ry * 0.35;
    const inner = -side * len;
    const outer = side * len * 0.4;
    const innerY = -raise - Math.max(0, -b) * ry * 0.45;
    const outerY = -raise + Math.max(0, -b) * ry * 0.1;
    bg.position.set(bp.x, bp.y);
    bg.rotation = this.screenAngle(headC, Rh);
    bg.zIndex = headZ + 0.011;
    bg.moveTo(inner * 0.5, innerY).lineTo(outer, outerY).stroke({ width: B.eyeRadius * s * 0.36, color: B.colors.brow, cap: 'round' });
  }

  private noseHighlight(noseC: V3, Rh: M3): void {
    const g = this.g('noseHi');
    const f = this.facing(apply(Rh, [0, 0.3, 1]));
    if (f < 0.2) {
      g.visible = false;
      return;
    }
    const p = this.toS(add(noseC, apply(Rh, [-0.018, 0.018, 0.03])));
    g.ellipse(0, 0, this.s * 0.018, this.s * 0.011).fill({ color: 0xffffff, alpha: 0.7 });
    g.position.set(p.x, p.y);
    g.rotation = this.screenAngle(noseC, Rh);
    g.zIndex = (this.gfx.get('nose')?.zIndex ?? 0) + 0.001;
  }

  private mouth(muzzleC: V3, Rh: M3, muzzleZ: number, O: Offsets): void {
    const B = this.breed;
    const sp = this.sp;
    const s = this.s;
    const g = this.g('mouth');
    const pos = add(muzzleC, apply(Rh, [0, -B.muzzle[1] * 0.5, B.muzzle[2] * 0.8]));
    const p = this.toS(pos);
    this.mouthS = p;
    const f = this.facing(apply(Rh, [0, -0.35, 1]));
    g.position.set(p.x, p.y);
    g.rotation = this.screenAngle(muzzleC, Rh);
    g.zIndex = muzzleZ + 0.003;
    const open = clamp(sp.mouth.x, 0, 1.3);
    const tongue = clamp(sp.tongue.x, 0, 1.2);
    const line = shade(this.coat.muzzle, 0.75, B.colors.outline);
    const lw = Math.max(1.2, s * 0.011);
    const w = B.muzzle[0] * s * 0.55 * Math.max(0.35, f);
    if (f > 0.12) {
      const h = B.muzzle[1] * s * 0.28;
      if (open > 0.06) {
        const oh = B.muzzle[1] * s * 0.8 * open;
        g.ellipse(0, oh * 0.45, w * 0.72, oh * 0.55 + 1).fill(MOUTH);
        if (tongue > 0.05) {
          const tl = B.muzzle[1] * s * (0.5 + 0.9 * tongue) * (1 - O.tongueUp * 0.3);
          const ty = oh * 0.55 + tl * 0.35 - O.tongueUp * B.muzzle[1] * s * 0.9;
          g.ellipse(0, ty, w * (0.48 + 0.15 * O.tongueUp), tl * 0.55).fill(TONGUE);
          g.moveTo(0, ty - tl * 0.35).lineTo(0, ty + tl * 0.2).stroke({ width: lw * 0.7, color: shade(TONGUE, 0.35), alpha: 0.6 });
        }
      }
      g.moveTo(-w, -h * 0.2)
        .quadraticCurveTo(-w * 0.5, h, 0, 0)
        .quadraticCurveTo(w * 0.5, h, w, -h * 0.2)
        .stroke({ width: lw, color: line, cap: 'round' });
      g.moveTo(0, -B.muzzle[1] * s * 0.45).lineTo(0, 0).stroke({ width: lw, color: line, cap: 'round' });
    } else if (tongue > 0.3) {
      g.ellipse(0, B.muzzle[1] * s * 0.5, B.muzzle[0] * s * 0.25, B.muzzle[1] * s * 0.5 * tongue).fill(TONGUE);
    }
  }

  private ear(side: 1 | -1, headC: V3, Rh: M3, headYaw: number, headRoll: number, headZ: number, O: Offsets, dt: number, now: number): void {
    const B = this.breed;
    const st = this.ears[side === 1 ? 0 : 1];
    if (!st) return;
    const lift = this.sp.earLift.x;
    const flap = O.earFlap * Math.sin(now * 28) * 0.35;
    st.spread.v += this.yawVel * side * 0.25 * dt * 60;
    st.spread.step(0.22 + 0.6 * Math.max(0, lift) + flap, dt, 9, 0.3);
    st.swing.step(lift < 0 ? 0.9 * -lift : 0, dt, 9, 0.35);
    const spread = st.spread.x;
    const swing = st.swing.x;
    const folded = B.ear.type === 'folded';
    const anchorL: V3 = folded ? [side * B.head[0] * 0.72, B.head[1] * 0.7, B.head[2] * 0.05] : [side * B.head[0] * 0.8, B.head[1] * 0.45, -B.head[2] * 0.12];
    const anchor = add(headC, apply(Rh, anchorL));
    const dirL: V3 = [side * Math.sin(spread), -Math.cos(spread) * Math.cos(swing), -Math.sin(swing) * Math.cos(spread)];
    const dir = apply(mul(rotY(headYaw), rotZ(headRoll * 0.6)), dirL);
    const len = B.ear.length;
    const g = this.g(`ear${side}`);
    const color = this.coat.ear;
    const outline = shade(color, 0.5, B.colors.outline);

    if (B.ear.type === 'erect') {
      // Oreille dressée : triangle vers le haut, rabattu en arrière quand il a peur ou boude.
      const up = lift < 0 ? -lift : 0;
      const spreadE = 0.28 + 0.5 * up + flap * 0.4;
      const back = 1.1 * up;
      const anchorE = add(headC, apply(Rh, [side * B.head[0] * 0.55, B.head[1] * 0.72, -B.head[2] * 0.05]));
      const dirE = apply(Rh, [side * Math.sin(spreadE), Math.cos(spreadE) * Math.cos(back), -Math.sin(back)]);
      const a = this.toS(anchorE);
      const tip = this.toS(add(anchorE, scale(dirE, len)));
      const dx = tip.x - a.x;
      const dy = tip.y - a.y;
      const dl = Math.hypot(dx, dy) || 1;
      const wide = 0.35 + 0.65 * Math.abs(this.facing(apply(Rh, [0, 0, 1])));
      const hw = B.ear.width * 0.5 * this.s * wide;
      const nx = (-dy / dl) * hw;
      const ny = (dx / dl) * hw;
      g.moveTo(a.x + nx, a.y + ny)
        .quadraticCurveTo(a.x + dx * 0.6 + nx * 0.7, a.y + dy * 0.6 + ny * 0.7, tip.x, tip.y)
        .quadraticCurveTo(a.x + dx * 0.6 - nx * 0.7, a.y + dy * 0.6 - ny * 0.7, a.x - nx, a.y - ny)
        .closePath()
        .fill(color)
        .stroke({ width: this.ol, color: outline, alpha: 0.9, join: 'round' });
      if (this.facing(apply(Rh, [0, 0, 1])) > 0.2 && up < 0.6) {
        const k = 0.55;
        g.moveTo(a.x + nx * k, a.y + ny * k)
          .quadraticCurveTo(a.x + dx * 0.55 + nx * 0.35, a.y + dy * 0.55 + ny * 0.35, a.x + dx * 0.82, a.y + dy * 0.82)
          .quadraticCurveTo(a.x + dx * 0.55 - nx * 0.35, a.y + dy * 0.55 - ny * 0.35, a.x - nx * k, a.y - ny * k)
          .closePath()
          .fill({ color: 0xe9a89c, alpha: 0.85 });
      }
      g.position.set(0, 0);
      g.rotation = 0;
      const z = headZ - 0.004 + (this.cam.depth(anchorE) > this.cam.depth(headC) + 0.05 ? 0.008 : 0);
      g.zIndex = z;
      this.hits.push({ part: 'ear', z, kind: 'capsule', ax: a.x, ay: a.y, bx: tip.x, by: tip.y, r: hw * 0.7 });
      return;
    }

    // Oreille tombante (ou repliée, plus courte) : pend avec souplesse.
    const center = add(anchor, scale(dir, len * 0.5));
    const a = this.toS(anchor);
    const b = this.toS(add(anchor, dir));
    const pl = Math.hypot(b.x - a.x, b.y - a.y) / this.s;
    const c = this.toS(center);
    const rx = Math.max(0.4, pl) * len * 0.5 * this.s;
    const ry = B.ear.width * 0.5 * this.s;
    g.ellipse(0, 0, rx, ry).fill(color);
    g.stroke({ width: this.ol, color: outline, alpha: 0.9 });
    g.position.set(c.x, c.y);
    g.rotation = Math.atan2(b.y - a.y, b.x - a.x);
    const front = this.cam.depth(center) > this.cam.depth(headC);
    const z = headZ + (front ? 0.004 : -0.004);
    g.zIndex = z;
    this.hits.push({ part: 'ear', z, kind: 'ellipse', cx: c.x, cy: c.y, a: rx, b: ry, rot: g.rotation });
  }
}
