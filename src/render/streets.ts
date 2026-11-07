/**
 * D-92 : décor des rues de la promenade. Chaque rue a son allure (maisons, boutiques, parc) ;
 * aux carrefours, la rue de côté s'enfonce entre les façades et un panneau montre où l'on tourne. Des lampadaires et des buissons passent
 * devant le chiot.
 *
 * Comme en D-84, rien n'est retracé à chaque image : chaque allure est dessinée une fois, à la
 * longueur exacte d'une rue (moins la rue de côté), en formes partagées ; à chaque image on ne
 * fait que placer quelques tranches. Pas de masque : ils coûtaient trop cher sur téléphone.
 */
import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { BALANCE } from '../data/balance';
import { SEASONS, type Season } from '../data/seasons';
import { streetKind, turnAt, type Route, type StreetKind } from '../sim/walk';

const KINDS: readonly StreetKind[] = ['houses', 'shops', 'park'];
/** Vitesse relative des bandes (parallaxe). */
const SPEED = { far: 0.45, mid: 0.8, front: 1.35 } as const;
/** Largeur de la rue de côté, sur le trottoir (px). */
const SIDE_STREET = 84;

type Shapes = Record<`${StreetKind}${0 | 1}`, GraphicsContext>;

interface Layer {
  v: number;
  /** Longueur d'une rue à cette vitesse, et place laissée à la rue de côté (px). */
  len: number;
  gap: number;
  shapes: Shapes;
  slots: Graphics[];
}

export interface StreetGeometry {
  w: number;
  h: number;
  /** Haut du trottoir, et bordure côté rue. */
  walkTop: number;
  curb: number;
  /** x de l'écran où marche le chiot. */
  dogX: number;
}

export class StreetDecor {
  /** À placer sous le trottoir (far, mid) et au-dessus du chiot (front). */
  readonly back = new Container();
  readonly front = new Container();
  /** Rues de côté (entre les façades) et passages piétons (sur le trottoir). */
  readonly sides = new Graphics();
  readonly crossings = new Container();
  private readonly farBox = new Container();
  private readonly midBox = new Container();
  private readonly frontStrip = new Graphics();
  /** Passage piéton et panneau, une forme par direction ; deux carrefours visibles au plus. */
  private readonly signs: Record<'left' | 'right' | 'straight', GraphicsContext> = { left: new GraphicsContext(), right: new GraphicsContext(), straight: new GraphicsContext() };
  private readonly crossPool = [new Graphics(), new Graphics(), new Graphics()];
  private far: Layer | null = null;
  private mid: Layer | null = null;
  private frontPeriod = 1;
  private geo: StreetGeometry = { w: 1, h: 1, walkTop: 0, curb: 0, dogX: 0 };

  constructor(private readonly pxPerM: number) {
    this.front.addChild(this.frontStrip);
    this.back.addChild(this.farBox, this.sides, this.midBox);
    this.crossings.addChild(...this.crossPool);
  }

  paint(geo: StreetGeometry, season: Season): void {
    this.geo = geo;
    for (const l of [this.far, this.mid]) {
      if (!l) continue;
      for (const g of l.slots) g.destroy();
      for (const c of Object.values(l.shapes)) c.destroy();
    }
    this.far = this.layer(SPEED.far, geo, (k, variant, len) => paintFar(k, variant, len, geo, season));
    this.mid = this.layer(SPEED.mid, geo, (k, variant, len) => paintMid(k, variant, len, geo, season));
    this.farBox.addChild(...this.far.slots);
    this.midBox.addChild(...this.mid.slots);
    this.frontPeriod = paintFront(this.frontStrip, geo, season);
    for (const turn of ['left', 'right', 'straight'] as const) paintCrossing(this.signs[turn], geo, turn);
  }

  private layer(v: number, geo: StreetGeometry, paint: (k: StreetKind, variant: 0 | 1, len: number) => GraphicsContext): Layer {
    const len = BALANCE.walk.edgeM * this.pxPerM * v;
    const gap = SIDE_STREET * v;
    const body = len - gap;
    const shapes = {} as Shapes;
    for (const k of KINDS) for (const variant of [0, 1] as const) shapes[`${k}${variant}`] = paint(k, variant, body);
    // Assez de tranches pour couvrir l'écran, plus une de chaque côté.
    const slots = Array.from({ length: Math.ceil(geo.w / len) + 2 }, () => new Graphics());
    return { v, len, gap, shapes, slots };
  }

  update(progress: number, route: Route): void {
    const { w, dogX } = this.geo;
    const E = BALANCE.walk.edgeM;
    const n = Math.max(1, route.length - 1);
    /** x à l'écran du début de la rue k, pour une bande de vitesse v. */
    const at = (k: number, v: number): number => dogX + (k * E - progress) * this.pxPerM * v;
    // Avant le départ et après l'arrivée : les maisons du quartier.
    const kindOf = (k: number): StreetKind => (k < 0 || k >= n ? 'houses' : streetKind(route[k] ?? '', route[k + 1] ?? ''));
    for (const layer of [this.far, this.mid]) {
      if (!layer) continue;
      const first = Math.floor(progress / E - dogX / layer.len);
      layer.slots.forEach((g, i) => {
        const k = first + i;
        const x = at(k, layer.v) + layer.gap / 2;
        g.visible = x < w && x + layer.len > 0;
        if (!g.visible) return;
        const ctx = layer.shapes[`${kindOf(k)}${(((k % 2) + 2) % 2) as 0 | 1}`];
        if (g.context !== ctx) g.context = ctx;
        g.x = Math.round(x);
      });
    }
    this.frontStrip.x = -((((progress * this.pxPerM * SPEED.front) % this.frontPeriod) + this.frontPeriod) % this.frontPeriod);
    this.drawCrossings(route, at, n);
  }

  /** Rues de côté (redessinées : leur perspective change), passages piétons et panneaux (déplacés). */
  private drawCrossings(route: Route, at: (k: number, v: number) => number, n: number): void {
    const { w, h, walkTop } = this.geo;
    const s = this.sides;
    s.clear();
    const farFoot = h * 0.62;
    let used = 0;
    for (let k = 1; k < n; k++) {
      const xg = at(k, 1);
      if (xg < -SIDE_STREET * 2 || xg > w + SIDE_STREET * 2) continue;
      const xf = at(k, SPEED.far);
      // La rue de côté s'enfonce vers le fond, entre les façades (perspective : étroite au loin).
      const top = SIDE_STREET * SPEED.far * 0.5;
      const bottom = SIDE_STREET * 0.5;
      s.moveTo(xf - top, farFoot - 4).lineTo(xf + top, farFoot - 4).lineTo(xg + bottom, walkTop).lineTo(xg - bottom, walkTop).closePath().fill(0x8a8580);
      s.moveTo(xf, farFoot).lineTo(xg, walkTop).stroke({ width: 2, color: 0xf2e9c9, alpha: 0.8 });
      const g = this.crossPool[used++];
      if (!g) continue;
      const ctx = this.signs[turnAt(route, k) ?? 'straight'];
      if (g.context !== ctx) g.context = ctx;
      g.visible = true;
      g.x = Math.round(xg);
    }
    for (let i = used; i < this.crossPool.length; i++) {
      const g = this.crossPool[i];
      if (g) g.visible = false;
    }
  }
}

/** Panneau du virage, à l'angle de la rue de côté (autour de x = 0). D-95 : plus de passage piéton sur le trottoir. */
function paintCrossing(c: GraphicsContext, geo: StreetGeometry, turn: 'left' | 'right' | 'straight'): void {
  const { walkTop } = geo;
  c.clear();
  const bottom = SIDE_STREET * 0.5;
  const px = bottom + 14;
  const py = walkTop - 70;
  c.rect(px - 2, py, 4, 70).fill(0x6c7a80);
  c.roundRect(px - 20, py - 30, 40, 32, 6).fill(0x3f7fb5).stroke({ width: 2, color: 0xffffff });
  const ax = px;
  const ay = py - 14;
  if (turn === 'straight') c.moveTo(ax, ay + 10).lineTo(ax, ay - 8).moveTo(ax - 6, ay - 2).lineTo(ax, ay - 8).lineTo(ax + 6, ay - 2);
  else {
    const d = turn === 'left' ? -1 : 1;
    c.moveTo(ax - 6 * d, ay + 10).lineTo(ax - 6 * d, ay - 3).lineTo(ax + 8 * d, ay - 3);
    c.moveTo(ax + 3 * d, ay - 8).lineTo(ax + 8 * d, ay - 3).lineTo(ax + 3 * d, ay + 2);
  }
  c.stroke({ width: 3, color: 0xffffff, cap: 'round', join: 'round' });
}

// ---------------------------------------------------------------- dessins (créés pour Truffe)

/** Positions d'objets de largeur `unit` répartis sur `len` (objets entiers, centrés). */
function spots(len: number, unit: number): number[] {
  const count = Math.max(1, Math.floor(len / unit));
  const start = (len - count * unit) / 2;
  return Array.from({ length: count }, (_, i) => start + i * unit);
}

function paintFar(kind: StreetKind, variant: 0 | 1, len: number, geo: StreetGeometry, season: Season): GraphicsContext {
  const { h } = geo;
  const look = SEASONS[season];
  const g = new GraphicsContext();
  const foot = h * 0.62;
  if (kind === 'houses') {
    const colors = [0xf2c9a0, 0xe8b37a, 0xd9a0a0, 0xc9d9b0, 0xf0dca0];
    spots(len, 120).forEach((x, i) => {
      const k = i + variant * 3;
      const c = colors[k % colors.length] ?? 0xf2c9a0;
      const top = h * (0.3 + ((k * 37) % 5) * 0.02);
      g.rect(x + 4, top, 112, foot - top).fill(c).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.3 });
      g.moveTo(x - 2, top).lineTo(x + 60, top - 34).lineTo(x + 122, top).fill(0xb5562a);
      if (look.snow) g.moveTo(x + 18, top - 8).lineTo(x + 60, top - 34).lineTo(x + 102, top - 8).quadraticCurveTo(x + 60, top - 16, x + 18, top - 8).fill(0xffffff);
      g.rect(x + 22, top + 22, 22, 22).fill(0xfdf6ea);
      g.rect(x + 74, top + 22, 22, 22).fill(0xfdf6ea);
    });
    return g;
  }
  if (kind === 'shops') {
    // Façades de boutiques : grande vitrine, store à rayures, enseigne.
    const walls = [0xe9d8c4, 0xd7c4e0, 0xc4dbe0, 0xf0d6b8];
    const awnings = [0xd9534f, 0x3f7fb5, 0x5aa469, 0xe8955a];
    spots(len, 150).forEach((x0, j) => {
      const x = x0 + 3;
      const i = (j + variant * 2) % 4;
      const top = h * (0.26 + (i % 2) * 0.03);
      const a = awnings[i] ?? 0xd9534f;
      g.rect(x, top, 144, foot - top).fill(walls[i] ?? 0xe9d8c4).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.3 });
      g.rect(x + 10, top + 14, 124, 22).fill(0x4a2f1f);
      g.circle(x + 30, top + 25, 6).fill(a);
      g.rect(x + 44, top + 22, 70, 6).fill({ color: 0xfdf6ea, alpha: 0.85 });
      const wy = foot - h * 0.14;
      g.rect(x + 12, wy, 84, h * 0.14 - 6).fill(0xbfe0ee).stroke({ width: 3, color: 0x6b5444 });
      g.moveTo(x + 22, wy + 8).lineTo(x + 40, wy + 26).stroke({ width: 3, color: 0xffffff, alpha: 0.7 });
      g.rect(x + 104, wy + 4, 28, h * 0.14 - 10).fill(0x8a5c36);
      for (let s = 0; s < 6; s++) g.rect(x + 8 + s * 22, wy - 22, 22, 18).fill(s % 2 ? 0xfdf6ea : a);
      g.moveTo(x + 8, wy - 4).lineTo(x + 140, wy - 4).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.4 });
      if (look.snow) g.rect(x, top - 5, 144, 8).fill(0xffffff);
    });
    return g;
  }
  // Parc : une colline et de grands arbres au loin, derrière une haie.
  const crown = look.foliage[variant % Math.max(1, look.foliage.length)] ?? look.foliage[0] ?? 0x7cc47f;
  g.ellipse(len / 2, foot - 6, len / 2, h * 0.14).fill(look.snow ? 0xeef2f5 : look.grass);
  spots(len, 110).forEach((x, i) => {
    const tx = x + 55;
    const r = i % 2 ? 24 : 34;
    if (look.foliage.length === 0) {
      g.rect(tx - 4, foot - h * 0.2, 8, h * 0.2).fill(look.trunk);
      g.moveTo(tx, foot - h * 0.18).lineTo(tx - 20, foot - h * 0.26).moveTo(tx, foot - h * 0.16).lineTo(tx + 22, foot - h * 0.25).stroke({ width: 3, color: look.trunk, cap: 'round' });
    } else {
      g.rect(tx - 4, foot - h * 0.16, 8, h * 0.16).fill(look.trunk);
      g.circle(tx, foot - h * 0.16 - r * 0.4, r).fill(i % 2 ? (look.foliage[1] ?? crown) : crown).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.2 });
    }
  });
  g.rect(0, foot - 18, len, 18).fill(look.snow ? 0xdfe8e4 : 0x5f9e5a);
  return g;
}

function paintMid(kind: StreetKind, variant: 0 | 1, len: number, geo: StreetGeometry, season: Season): GraphicsContext {
  const { h } = geo;
  const look = SEASONS[season];
  const g = new GraphicsContext();
  const tree = (x: number, k: number, r: number): void => {
    g.rect(x - 4, h * 0.5, 8, h * 0.16).fill(look.trunk);
    if (look.foliage.length === 0) {
      const y0 = h * 0.5;
      g.moveTo(x, y0).lineTo(x - 18, y0 - 26).moveTo(x, y0 - 6).lineTo(x + 20, y0 - 30).moveTo(x, y0).lineTo(x, y0 - 38).moveTo(x - 9, y0 - 13).lineTo(x - 22, y0 - 14).stroke({ width: 3, color: look.trunk, cap: 'round' });
      g.ellipse(x + 20, y0 - 31, 6, 2.5).fill(0xffffff);
      g.ellipse(x - 18, y0 - 27, 6, 2.5).fill(0xffffff);
    } else {
      const c = look.foliage[k % look.foliage.length] ?? 0x7cc47f;
      g.circle(x, h * 0.48, r).fill(c).stroke({ width: 2, color: 0x4a2f1f, alpha: 0.25 });
      if (look.dots !== null) for (let j = 0; j < 7; j++) g.circle(x + Math.cos(j * 2.4) * r * 0.6, h * 0.48 + Math.sin(j * 2.4) * r * 0.53, 3).fill(look.dots);
    }
  };
  if (kind === 'shops') {
    // Réverbères et jardinières, en alternance.
    spots(len, 150).forEach((x0, i) => {
      const x = x0 + 75;
      if ((i + variant) % 2 === 0) {
        g.rect(x - 3, h * 0.44, 6, h * 0.22).fill(0x4a4a52);
        g.roundRect(x - 12, h * 0.42, 24, 12, 5).fill(0x4a4a52);
        g.circle(x, h * 0.45, 6).fill(0xffe8a0);
      } else {
        g.roundRect(x - 26, h * 0.62, 52, 18, 4).fill(0xa8764a);
        const leaf = look.foliage.length === 0 ? 0xdfe8e4 : (look.foliage[0] ?? 0x7cc47f);
        const flower = look.foliage.length === 0 ? 0xffffff : (look.dots ?? 0xd9534f);
        for (let j = 0; j < 5; j++) g.circle(x - 20 + j * 10, h * 0.615, 6).fill(leaf);
        for (let j = 0; j < 4; j++) g.circle(x - 15 + j * 10, h * 0.605, 3).fill(flower);
      }
    });
    return g;
  }
  if (kind === 'park') {
    // Clôture basse et arbres serrés.
    spots(len, 160).forEach((x, i) => tree(x + 80, i + variant, 38));
    for (let x = 4; x < len - 4; x += 40) g.rect(x, h * 0.6, 5, h * 0.06).fill(0xf6efe2);
    g.rect(0, h * 0.61, len, 4).fill(0xf6efe2);
    g.rect(0, h * 0.64, len, 4).fill(0xf6efe2);
    return g;
  }
  spots(len, 200).forEach((x, i) => tree(x + 100, i + variant, 30));
  return g;
}

/** Lampadaires et buissons au premier plan, devant le chiot (D-92 : profondeur). */
function paintFront(g: Graphics, geo: StreetGeometry, season: Season): number {
  const { w, h, curb } = geo;
  const look = SEASONS[season];
  g.clear();
  const period = 520;
  for (let k = -1; k * 260 < w + period + 260; k++) {
    const x = k * 260 + 120;
    if (k % 2 === 0) {
      // Lampadaire, côté rue : il passe devant le chiot.
      g.rect(x - 5, h * 0.3, 10, h - h * 0.3).fill(0x3d3f45);
      g.moveTo(x, h * 0.3).quadraticCurveTo(x, h * 0.26, x + 26, h * 0.26).stroke({ width: 7, color: 0x3d3f45, cap: 'round' });
      g.roundRect(x + 16, h * 0.26, 26, 12, 5).fill(0x3d3f45);
      g.ellipse(x + 29, h * 0.275 + 10, 9, 4).fill(0xffe8a0);
    } else {
      // Buisson en bas de l'écran, au bord de la rue.
      const y = Math.max(curb + 40, h - 30);
      const c = look.snow ? 0xe8eef0 : look.foliage.length > 0 ? (look.foliage[0] ?? 0x5f9e5a) : 0x6b8f5a;
      g.circle(x - 30, y, 34).fill(c);
      g.circle(x + 10, y - 10, 42).fill(c);
      g.circle(x + 50, y, 32).fill(c);
      g.circle(x + 10, y - 10, 42).stroke({ width: 3, color: 0x2f4a2a, alpha: 0.2 });
    }
  }
  return period;
}
