/**
 * La main qui tient un jouet (F-JEU-1, F-JEU-3) : le geste de lancer, ou la corde tirée.
 * Traduit le doigt en actions ; ne touche jamais à l'état.
 */
import type { GameAction } from '../sim/game';
import type { ToyKind } from '../sim/toys';
import type { Vec2 } from '../sim/behavior';

export interface ToyHandDeps {
  dispatch(a: GameAction): void;
  toFloor(x: number, y: number): Vec2 | null;
  velocity(vxPx: number, vyPx: number, y: number): { vx: number; vz: number };
  /** Jouet au sol sous le doigt. */
  toyAt(x: number, y: number): string | null;
  /** Jouet tenu après `toy/hold` ou `toy/pick`. */
  heldToy(): { id: string; kind: ToyKind } | null;
  /** Gueule du chien qui tire la corde, à l'écran. */
  mouth(): { x: number; y: number } | null;
}

/** En dessous de cette vitesse, le jouet est posé plutôt que lancé. */
const MIN_FLING_PX_S = 160;

export class ToyHand {
  private armed: ToyKind | null = null;
  private pressing = false;
  private samples: { x: number; y: number; t: number }[] = [];
  /** Position du doigt qui tient un jouet, pour le dessiner. */
  hand: { x: number; y: number } | null = null;

  constructor(private readonly d: ToyHandDeps) {}

  /** Jouet choisi dans le Sac : le prochain appui le prend en main. */
  arm(kind: ToyKind | null): void {
    this.armed = kind;
  }

  get isArmed(): boolean {
    return this.armed !== null;
  }

  /** Renvoie vrai si cet appui concerne un jouet. */
  down(x: number, y: number, t: number): boolean {
    const front = this.d.toFloor(x, y) ?? { x: 0, z: 0.88 };
    if (this.armed) {
      this.d.dispatch({ type: 'toy/hold', kind: this.armed, at: front });
      this.armed = null;
    } else {
      const id = this.d.toyAt(x, y);
      if (!id) return false;
      this.d.dispatch({ type: 'toy/pick', toyId: id });
    }
    if (!this.d.heldToy()) return false;
    this.pressing = true;
    this.hand = { x, y };
    this.samples = [{ x, y, t }];
    return true;
  }

  move(x: number, y: number, t: number): void {
    if (!this.pressing) return;
    const held = this.d.heldToy();
    const last = this.samples.at(-1);
    this.hand = { x, y };
    this.samples.push({ x, y, t });
    this.samples = this.samples.filter((s) => t - s.t <= 300);
    const at = this.d.toFloor(x, y);
    if (held && at) this.d.dispatch({ type: 'toy/move', toyId: held.id, at });
    // Corde : seule la part du geste qui s'éloigne de la gueule tire.
    const mouth = this.d.mouth();
    if (held?.kind === 'rope' && mouth && last) {
      const ax = x - mouth.x;
      const ay = y - mouth.y;
      const al = Math.hypot(ax, ay) || 1;
      const pull = ((x - last.x) * ax + (y - last.y) * ay) / al;
      if (pull > 0) this.d.dispatch({ type: 'toy/tug', pullPx: pull });
    }
  }

  up(x: number, y: number, t: number): void {
    if (!this.pressing) return;
    this.pressing = false;
    const held = this.d.heldToy();
    this.hand = null;
    if (!held) return;
    if (held.kind === 'rope') {
      this.d.dispatch({ type: 'toy/release', toyId: held.id });
      return;
    }
    // Vitesse sur les ~120 dernières ms ; si une image a tardé, sur le plus ancien point récent.
    const recent = this.samples.filter((s) => t - s.t > 8);
    const first = recent.find((s) => t - s.t <= 120) ?? recent.at(-1) ?? this.samples[0];
    const dt = first ? Math.max(16, t - first.t) / 1000 : 1;
    const vxPx = first ? (x - first.x) / dt : 0;
    const vyPx = first ? (y - first.y) / dt : 0;
    if (Math.hypot(vxPx, vyPx) < MIN_FLING_PX_S) {
      this.d.dispatch({ type: 'toy/release', toyId: held.id });
      return;
    }
    const v = this.d.velocity(vxPx, vyPx, y);
    this.d.dispatch({ type: 'toy/throw', toyId: held.id, vx: v.vx, vz: v.vz });
  }

  cancel(): void {
    if (this.pressing) this.up(this.hand?.x ?? 0, this.hand?.y ?? 0, performance.now() + 1000);
  }
}
