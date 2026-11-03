import { expect, type Page } from '@playwright/test';

/** Trouve un point de l'écran sur la partie demandée du chiot. */
export async function pointOn(page: Page, part: string): Promise<{ x: number; y: number }> {
  const p = await page.evaluate((part) => {
    const t = window.__truffe;
    if (!t) return null;
    const pts: { x: number; y: number }[] = [];
    for (let y = 0; y < innerHeight; y += 4)
      for (let x = 0; x < innerWidth; x += 4) if (t.probe.hitTest(x, y) === part) pts.push({ x, y });
    if (pts.length === 0) return null;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return pts.reduce((b, p) => (Math.hypot(p.x - cx, p.y - cy) < Math.hypot(b.x - cx, b.y - cy) ? p : b));
  }, part);
  if (!p) throw new Error(`partie introuvable : ${part}`);
  return p;
}

export const debug = (page: Page) => page.getByTestId('debug');

export async function fresh(page: Page): Promise<void> {
  await page.goto('/?debug');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1200);
}

/** Valeurs internes, pour vérifier les règles chiffrées (jamais affichées au joueur). */
export function needs(page: Page) {
  return page.evaluate(() => {
    const t = window.__truffe;
    const d = t?.store.getState().save.dogs[0];
    return d ? { ...d.needs, affection: d.affection } : null;
  });
}

export function activity(page: Page) {
  return page.evaluate(() => (window.__truffe ? window.__truffe.store.getState().minds[window.__truffe.dogId]?.activity : ''));
}

/**
 * Simule une absence de `ms` (la dernière visite est reculée d'autant),
 * ou, si `ms` est négatif, une horloge reculée de |ms|.
 */
export async function returnAfter(page: Page, ms: number): Promise<void> {
  await page.evaluate((ms) => {
    const t = window.__truffe;
    if (!t) return;
    if (ms > 0) return t.rewind(ms);
    const s = t.store.getState();
    t.store.dispatch({ type: 'session/resume', now: s.save.lastSeenAt + ms, tzOffsetMin: new Date().getTimezoneOffset() });
  }, ms);
}

/** Frotte le chiot (sur la tête, toujours visible de face) pendant `ms`. */
export async function rub(page: Page, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const p = await pointOn(page, 'head').catch(() => pointOn(page, 'flank'));
    await page.mouse.move(p.x - 20, p.y);
    await page.mouse.down();
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(p.x - 20 + (i % 2 ? 40 : 0), p.y + (i % 3) * 4, { steps: 3 });
      await page.waitForTimeout(25);
    }
    await page.mouse.up();
  }
}
