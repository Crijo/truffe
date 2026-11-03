// Icônes de l'application (PWA), rendues depuis public/favicon.svg avec le Chromium de Playwright.
// Usage : node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/favicon.svg', 'utf8');
const paw = svg.replace(/<rect[^>]*\/>/, '');
const icons = [
  { file: 'public/icon-192.png', size: 192, inner: svg },
  { file: 'public/icon-512.png', size: 512, inner: svg },
  { file: 'public/apple-touch-icon.png', size: 180, inner: svg },
  // Masquable : l'empreinte tient dans la zone sûre (80 %), sur fond plein.
  { file: 'public/icon-maskable-512.png', size: 512, inner: paw, maskable: true },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const i of icons) {
  await page.setViewportSize({ width: i.size, height: i.size });
  const body = i.maskable
    ? `<div style="width:100%;height:100%;background:#f6e7d0;display:grid;place-items:center">${i.inner.replace('<svg ', '<svg style="width:62%;height:62%" ')}</div>`
    : i.inner.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ');
  await page.setContent(`<html><body style="margin:0;width:${i.size}px;height:${i.size}px;background:transparent">${body}</body></html>`);
  await page.screenshot({ path: i.file, omitBackground: !i.maskable });
  console.log(i.file);
}
await browser.close();
