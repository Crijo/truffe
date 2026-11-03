import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** SPEC, Accessibilité : contrastes conformes à WCAG AA (4,5:1 ; 3:1 pour le grand texte). */
const css = readFileSync('src/style.css', 'utf8');
const token = (name: string): string => {
  const m = new RegExp(`--${name}: *(#[0-9a-f]{6})`, 'i').exec(css);
  if (!m?.[1]) throw new Error(`jeton ${name} absent`);
  return m[1];
};

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const over = (fg: Rgb, alpha: number, bg: Rgb): Rgb => fg.map((c, i) => c * alpha + (bg[i] ?? 0) * (1 - alpha)) as Rgb;
const lum = (c: Rgb): number => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: Rgb, b: Rgb): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

const INK = hex(token('ink'));
const PAPER = hex(token('paper'));
const PAPER2 = hex(token('paper-2'));
const WHITE: Rgb = [255, 255, 255];
const HINT = hex('#6b5444');
/** Fonds les plus clairs derrière les bandeaux translucides : mur, ciel des concours. */
const BACKDROPS = [hex('#f6e7d0'), hex('#cfe6f2'), hex('#bfe3f0'), PAPER];

describe('Contrastes WCAG AA', () => {
  const pairs: [string, Rgb, Rgb, number][] = [
    ['texte sur papier', INK, PAPER, 4.5],
    ['texte sur papier foncé', INK, PAPER2, 4.5],
    ['indice sur papier', HINT, PAPER, 4.5],
    ['indice sur papier foncé', HINT, PAPER2, 4.5],
    ['bouton principal', WHITE, hex(token('accent')), 4.5],
    ['à surveiller', hex(token('watch')), PAPER2, 4.5],
    ['urgent', hex(token('urgent')), PAPER, 4.5],
    ['réussite', hex(token('ok')), PAPER, 4.5],
    ['titre accentué (grand texte)', hex(token('accent')), PAPER, 3],
    ['distances sur l’herbe (concours)', hex('#1f3d1a'), hex('#8cc27a'), 4.5],
  ];
  for (const [name, fg, bg, min] of pairs) {
    it(`${name} : au moins ${min}:1`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  }

  it('texte blanc sur les bandeaux sombres translucides, quel que soit le décor', () => {
    for (const alpha of [0.72, 0.75, 0.8, 0.88]) for (const b of BACKDROPS) expect(ratio(WHITE, over(hex('#3d2b1f'), alpha, b))).toBeGreaterThanOrEqual(4.5);
  });

  it('texte sombre sur les bandeaux clairs translucides', () => {
    for (const b of [...BACKDROPS, hex('#262a4f'), hex('#8cc27a')]) expect(ratio(INK, over(PAPER, 0.8, b))).toBeGreaterThanOrEqual(4.5);
  });
});
