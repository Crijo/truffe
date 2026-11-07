// D-100 : icônes et écrans de démarrage de l'appli Android, rendus depuis public/favicon.svg
// (l'empreinte de Truffe) avec le Chromium de Playwright, à la place de ceux de Capacitor.
// Usage : node scripts/make-android-icons.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const RES = 'android/app/src/main/res';
const svg = readFileSync('public/favicon.svg', 'utf8');
const paw = svg.replace(/<rect[^>]*\/>/, '');
const CREAM = '#f6e7d0';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(file, w, h, html, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;background:${transparent ? 'transparent' : CREAM}">${html}</body></html>`);
  await page.screenshot({ path: file, omitBackground: transparent });
  console.log(file);
}
const pawAt = (pct) => `<div style="width:100%;height:100%;display:grid;place-items:center">${paw.replace('<svg ', `<svg style="width:${pct}%;height:${pct}%" `)}</div>`;

for (const [d, k] of Object.entries(DENSITIES)) {
  const dir = `${RES}/mipmap-${d}`;
  const icon = Math.round(48 * k);
  // Icône classique (carré arrondi) et ronde.
  await render(`${dir}/ic_launcher.png`, icon, icon, svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" '), true);
  await render(`${dir}/ic_launcher_round.png`, icon, icon, `<div style="width:100%;height:100%;border-radius:50%;background:${CREAM};overflow:hidden">${pawAt(70)}</div>`, true);
  // Icône adaptative : l'empreinte dans la zone sûre (66 % du centre), fond crème à part.
  const fg = Math.round(108 * k);
  await render(`${dir}/ic_launcher_foreground.png`, fg, fg, pawAt(50), true);
}
// Écrans de démarrage : l'empreinte au centre, sur le fond du jeu.
for (const dir of readdirSync(RES).filter((n) => n.startsWith('drawable'))) {
  const file = `${RES}/${dir}/splash.png`;
  if (!existsSync(file)) continue;
  const land = dir.includes('land');
  const k = DENSITIES[dir.split('-').pop()] ?? 2;
  const [w, h] = land ? [Math.round(480 * k), Math.round(320 * k)] : [Math.round(320 * k), Math.round(480 * k)];
  const size = Math.round(Math.min(w, h) * 0.3);
  await render(file, w, h, `<div style="width:100%;height:100%;display:grid;place-items:center">${paw.replace('<svg ', `<svg style="width:${size}px;height:${size}px" `)}</div>`);
}
await browser.close();
