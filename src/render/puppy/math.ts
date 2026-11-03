/** Petite algèbre 3D pour la marionnette : vecteurs, rotations, projection d'ellipsoïdes. */

export type V3 = [number, number, number];
/** Matrice 3×3, rangée par lignes. */
export type M3 = [number, number, number, number, number, number, number, number, number];

export const rotX = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, s, 0, -s, c];
};
export const rotY = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};
export const rotZ = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};

export function mul(a: M3, b: M3): M3 {
  const [a0, a1, a2, a3, a4, a5, a6, a7, a8] = a;
  const [b0, b1, b2, b3, b4, b5, b6, b7, b8] = b;
  return [
    a0 * b0 + a1 * b3 + a2 * b6,
    a0 * b1 + a1 * b4 + a2 * b7,
    a0 * b2 + a1 * b5 + a2 * b8,
    a3 * b0 + a4 * b3 + a5 * b6,
    a3 * b1 + a4 * b4 + a5 * b7,
    a3 * b2 + a4 * b5 + a5 * b8,
    a6 * b0 + a7 * b3 + a8 * b6,
    a6 * b1 + a7 * b4 + a8 * b7,
    a6 * b2 + a7 * b5 + a8 * b8,
  ];
}

export const apply = (m: M3, v: readonly number[]): V3 => {
  const x = v[0] ?? 0;
  const y = v[1] ?? 0;
  const z = v[2] ?? 0;
  return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
};
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const mulEach = (a: V3, b: readonly number[]): V3 => [a[0] * (b[0] ?? 1), a[1] * (b[1] ?? 1), a[2] * (b[2] ?? 1)];

/** Plus court écart angulaire de a vers b. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Caméra légèrement plongeante : x écran = X, y écran = −Y·cos φ + Z·sin φ.
 * Z pointe vers le joueur.
 */
export class Camera {
  readonly cos: number;
  readonly sin: number;
  /** Direction vers le joueur : sert au tri en profondeur et à la visibilité. */
  readonly view: V3;

  constructor(tilt: number) {
    this.cos = Math.cos(tilt);
    this.sin = Math.sin(tilt);
    this.view = [0, this.sin, this.cos];
  }

  /** Projette un point (unités du chiot) en décalage écran, avant mise à l'échelle. */
  project(p: V3): { x: number; y: number } {
    return { x: p[0], y: -this.cos * p[1] + this.sin * p[2] };
  }

  /**
   * Profondeur pour l'ordre de dessin. La hauteur compte peu : vu de dos,
   * les épaules doivent passer devant la tête, même si elle est plus haute.
   */
  depth(p: V3): number {
    return p[2] * this.cos + p[1] * this.sin * 0.25;
  }

  /**
   * Contour projeté d'un ellipsoïde orienté par R et de demi-axes r :
   * une ellipse de demi-axes (a, b) tournée de `rot`.
   */
  ellipse(R: M3, r: readonly number[]): { a: number; b: number; rot: number } {
    const r0 = r[0] ?? 0;
    const r1 = r[1] ?? 0;
    const r2 = r[2] ?? 0;
    const x0 = R[0] * r0;
    const x1 = R[1] * r1;
    const x2 = R[2] * r2;
    const y0 = -this.cos * R[3] * r0 + this.sin * R[6] * r0;
    const y1 = -this.cos * R[4] * r1 + this.sin * R[7] * r1;
    const y2 = -this.cos * R[5] * r2 + this.sin * R[8] * r2;
    const c00 = x0 * x0 + x1 * x1 + x2 * x2;
    const c01 = x0 * y0 + x1 * y1 + x2 * y2;
    const c11 = y0 * y0 + y1 * y1 + y2 * y2;
    const half = (c00 + c11) / 2;
    const disc = Math.sqrt(((c00 - c11) / 2) ** 2 + c01 * c01);
    return {
      a: Math.sqrt(half + disc),
      b: Math.sqrt(Math.max(0, half - disc)),
      rot: 0.5 * Math.atan2(2 * c01, c00 - c11),
    };
  }
}

/** Ressort amorti : suit une cible avec souplesse. */
export class Spring {
  v = 0;
  constructor(public x: number) {}

  step(target: number, dt: number, omega: number, zeta = 1): number {
    // Sous-pas : l'intégration reste stable même pour une image longue.
    const n = Math.max(1, Math.ceil((dt * omega) / 0.25));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const f = omega * omega * (target - this.x) - 2 * zeta * omega * this.v;
      this.v += f * h;
      this.x += this.v * h;
    }
    if (!Number.isFinite(this.x)) {
      this.x = target;
      this.v = 0;
    }
    return this.x;
  }
}

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const smooth = (u: number): number => u * u * (3 - 2 * u);

export function shade(color: number, k: number, toward = 0x2a1a10): number {
  const r = ((color >> 16) & 255) * (1 - k) + ((toward >> 16) & 255) * k;
  const g = ((color >> 8) & 255) * (1 - k) + ((toward >> 8) & 255) * k;
  const b = (color & 255) * (1 - k) + (toward & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
