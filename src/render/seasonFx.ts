/**
 * D-77 : ce qui tombe du ciel selon la saison (pétales, feuilles, flocons), dans un rectangle.
 * Positions calculées à partir du temps : rien à mémoriser, aucun hasard.
 */
import { Graphics } from 'pixi.js';
import { SEASONS, type Season } from '../data/seasons';

export class SeasonFx {
  readonly g = new Graphics();
  private t = 0;

  constructor(private readonly count = 26) {
    this.g.eventMode = 'none';
  }

  /** `scroll` : décalage horizontal du décor (promenade), en pixels. */
  update(dtMs: number, season: Season, rect: { x: number; y: number; w: number; h: number }, reduceMotion: boolean, scroll = 0): void {
    const look = SEASONS[season];
    const g = this.g;
    g.clear();
    if (!look.falling || rect.w <= 0 || rect.h <= 0) return;
    if (!reduceMotion) this.t += dtMs / 1000;
    const n = reduceMotion ? Math.ceil(this.count / 3) : this.count;
    for (let i = 0; i < n; i++) {
      const speed = look.falling === 'snow' ? 18 + (i % 5) * 6 : 26 + (i % 4) * 8;
      const phase = ((i * 0.618) % 1) * rect.h;
      const y = rect.y + ((phase + this.t * speed) % rect.h);
      const sway = Math.sin(this.t * (0.8 + (i % 3) * 0.3) + i) * (look.falling === 'snow' ? 6 : 14);
      const baseX = ((i * 0.381966 * rect.w + rect.w) % rect.w) - (scroll % rect.w);
      const x = rect.x + ((baseX + sway + rect.w * 2) % rect.w);
      const c = look.fallingColors[i % look.fallingColors.length] ?? 0xffffff;
      if (look.falling === 'snow') {
        g.circle(x, y, 1.6 + (i % 3)).fill({ color: c, alpha: 0.9 });
      } else {
        const a = this.t * 2 + i;
        const rx = look.falling === 'leaves' ? 5 : 3.5;
        const ry = rx * (0.45 + 0.35 * Math.abs(Math.sin(a)));
        g.ellipse(x, y, rx, ry).fill({ color: c, alpha: 0.95 });
      }
    }
  }
}
