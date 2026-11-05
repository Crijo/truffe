/**
 * D-77 : ce qui tombe du ciel selon la saison (pétales, feuilles, flocons), dans un rectangle.
 * Positions calculées à partir du temps : rien à mémoriser, aucun hasard.
 * Chaque particule est une petite forme dessinée une seule fois et partagée (GraphicsContext) :
 * à chaque image on ne fait que la déplacer, ce qui évite de retracer des dizaines d'ellipses (D-84).
 */
import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { SEASONS, type Season } from '../data/seasons';

/** Formes partagées d'une saison : une par couleur. */
export function particleShapes(season: Season): GraphicsContext[] {
  const look = SEASONS[season];
  if (!look.falling) return [];
  return look.fallingColors.map((c) => {
    const ctx = new GraphicsContext();
    if (look.falling === 'snow') ctx.circle(0, 0, 2).fill({ color: c, alpha: 0.9 });
    else {
      const rx = look.falling === 'leaves' ? 5 : 3.5;
      ctx.ellipse(0, 0, rx, rx * 0.8).fill({ color: c, alpha: 0.95 });
    }
    return ctx;
  });
}

/** Réserve de petites formes réutilisées d'une image à l'autre. */
export class ShapePool {
  readonly layer = new Container();
  private season: Season | null = null;
  private shapes: GraphicsContext[] = [];
  private used = 0;

  constructor() {
    this.layer.eventMode = 'none';
  }

  /** À appeler au début de chaque image. */
  begin(season: Season): void {
    if (season !== this.season) {
      this.season = season;
      for (const c of this.layer.removeChildren()) c.destroy();
      for (const s of this.shapes) s.destroy();
      this.shapes = particleShapes(season);
    }
    this.used = 0;
  }

  /** Place la forme de couleur `color` en (x, y). */
  put(color: number, x: number, y: number, sx = 1, sy = 1, rot = 0): void {
    const ctx = this.shapes[color % Math.max(1, this.shapes.length)];
    if (!ctx) return;
    let g = this.layer.children[this.used] as Graphics | undefined;
    if (!g) {
      g = new Graphics(ctx);
      this.layer.addChild(g);
    } else if (g.context !== ctx) g.context = ctx;
    g.visible = true;
    g.position.set(x, y);
    g.scale.set(sx, sy);
    g.rotation = rot;
    this.used++;
  }

  /** Cache les formes non utilisées cette image. */
  end(): void {
    const kids = this.layer.children;
    for (let i = this.used; i < kids.length; i++) {
      const k = kids[i];
      if (k) k.visible = false;
    }
  }
}

export class SeasonFx {
  private readonly pool = new ShapePool();
  readonly g: Container = this.pool.layer;
  private t = 0;

  constructor(private readonly count = 26) {}

  /** `scroll` : décalage horizontal du décor (promenade), en pixels. */
  update(dtMs: number, season: Season, rect: { x: number; y: number; w: number; h: number }, reduceMotion: boolean, scroll = 0): void {
    const look = SEASONS[season];
    this.pool.begin(season);
    if (!look.falling || rect.w <= 0 || rect.h <= 0) {
      this.pool.end();
      return;
    }
    if (!reduceMotion) this.t += dtMs / 1000;
    const n = reduceMotion ? Math.ceil(this.count / 3) : this.count;
    for (let i = 0; i < n; i++) {
      const snow = look.falling === 'snow';
      const speed = snow ? 18 + (i % 5) * 6 : 26 + (i % 4) * 8;
      const phase = ((i * 0.618) % 1) * rect.h;
      const y = rect.y + ((phase + this.t * speed) % rect.h);
      const sway = Math.sin(this.t * (0.8 + (i % 3) * 0.3) + i) * (snow ? 6 : 14);
      const baseX = ((i * 0.381966 * rect.w + rect.w) % rect.w) - (scroll % rect.w);
      const x = rect.x + ((baseX + sway + rect.w * 2) % rect.w);
      if (snow) {
        const r = 0.8 + (i % 3) * 0.5;
        this.pool.put(i, x, y, r, r);
      } else {
        const a = this.t * 2 + i;
        this.pool.put(i, x, y, 1, 0.55 + 0.45 * Math.abs(Math.sin(a)), Math.sin(a * 0.7) * 0.6);
      }
    }
    this.pool.end();
  }
}
