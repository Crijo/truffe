import { expect, test, type Page } from '@playwright/test';

/** Trouve un point de l'écran sur la partie demandée du chiot. */
async function pointOn(page: Page, part: string): Promise<{ x: number; y: number }> {
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

const debug = (page: Page) => page.getByTestId('debug');

async function settle(page: Page, ms = 600) {
  await page.waitForTimeout(ms);
}

async function fresh(page: Page) {
  await page.goto('/?debug&adopt=beagle');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  // Ramène le chiot au calme, debout, au milieu.
  await settle(page, 1200);
}

async function maxLatency(page: Page): Promise<number> {
  const r = await page.evaluate(() => ({
    fps: window.__truffe?.fps() ?? 0,
    lat: Math.max(...(window.__truffe?.latencies.slice(-5) ?? [999])),
  }));
  console.log(`fps=${r.fps.toFixed(0)} latence=${r.lat.toFixed(0)} ms`);
  return r.lat;
}

test.describe('Jalon 1 : le chiot vivant', () => {
  test('respire, cligne et flâne seul', async ({ page }) => {
    await fresh(page);
    await page.screenshot({ path: 'test-results/chiot-1-repos.png' });
    const pos = () =>
      page.evaluate(() => {
        const t = window.__truffe;
        return JSON.stringify(t ? t.store.getState().minds[t.dogId]?.pos : null);
      });
    const pos0 = await pos();
    await expect.poll(pos, { timeout: 25_000, intervals: [500] }).not.toBe(pos0);
    const gait = () => page.evaluate(() => (window.__truffe ? window.__truffe.store.getState().minds[window.__truffe.dogId]?.gait : ''));
    await expect.poll(gait, { timeout: 60_000, intervals: [100] }).not.toBe('still');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/chiot-1b-marche.png' });
  });

  test('F-MAIN-1 : la caresse le rend content, en moins de 100 ms', async ({ page }) => {
    await fresh(page);
    // Vu de face, le dos est caché : on caresse la tête.
    const p = await pointOn(page, 'head');
    await page.mouse.move(p.x - 15, p.y);
    await page.mouse.down();
    for (let i = 0; i < 24; i++) {
      await page.mouse.move(p.x - 15 + (i % 6) * 6, p.y);
      await page.waitForTimeout(30);
    }
    await expect(debug(page)).toHaveAttribute('data-activity', 'petted');
    await expect(debug(page)).toHaveAttribute('data-mood', 'content');
    expect(await maxLatency(page)).toBeLessThan(100);
    await settle(page, 500);
    await page.screenshot({ path: 'test-results/chiot-2-content.png' });
    await page.mouse.up();
  });

  test('F-MAIN-2 : main immobile près du museau, il renifle puis lèche', async ({ page }) => {
    await fresh(page);
    const nose = await page.evaluate(() => window.__truffe?.probe.nose());
    const hr = await page.evaluate(() => window.__truffe?.probe.headRadius() ?? 40);
    if (!nose) throw new Error('nez introuvable');
    await page.mouse.move(nose.x, nose.y + hr * 0.6);
    await expect(debug(page)).toHaveAttribute('data-activity', 'sniffHand');
    expect(await maxLatency(page)).toBeLessThan(100);
    await settle(page, 1500);
    await page.screenshot({ path: 'test-results/chiot-3-leche.png' });
  });

  test('F-MAIN-3 : toucher deux fois l’écran, il regarde puis vient', async ({ page }) => {
    await fresh(page);
    const vp = page.viewportSize() ?? { width: 400, height: 800 };
    const at = { x: vp.width * 0.8, y: vp.height * 0.9 };
    await page.mouse.click(at.x, at.y);
    await expect(debug(page)).toHaveAttribute('data-mood', 'curious');
    expect(await maxLatency(page)).toBeLessThan(100);
    await page.waitForTimeout(300);
    await page.mouse.click(at.x, at.y);
    await expect(debug(page)).toHaveAttribute('data-activity', 'come');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/chiot-4-vient.png' });
  });

  test('F-MAIN-4 : tirer trois fois la queue le fait bouder', async ({ page }) => {
    await fresh(page);
    const pulls = () => page.evaluate(() => (window.__truffe ? (window.__truffe.store.getState().minds[window.__truffe.dogId]?.pulls.length ?? 0) : 0));
    // Le chiot peut bouger entre la visée et l'appui : on recommence jusqu'à 3 tirages comptés.
    for (let i = 0; i < 8 && (await pulls()) < 3; i++) {
      const p = await pointOn(page, 'tail').catch(() => pointOn(page, 'ear'));
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 40, p.y + 10, { steps: 4 });
      await page.mouse.up();
      expect(await maxLatency(page)).toBeLessThan(100);
      await page.waitForTimeout(700);
    }
    await expect(debug(page)).toHaveAttribute('data-mood', 'sulky');
    await settle(page, 1200);
    await page.screenshot({ path: 'test-results/chiot-5-boude.png' });
  });

  test('F-MAIN-5 : main levée au-dessus du museau, il lève les yeux', async ({ page }) => {
    await fresh(page);
    const top = await page.evaluate(() => window.__truffe?.probe.headTop());
    const hr = await page.evaluate(() => window.__truffe?.probe.headRadius() ?? 40);
    if (!top) throw new Error('tête introuvable');
    await page.mouse.move(top.x, top.y - hr * 1.5);
    await expect(debug(page)).toHaveAttribute('data-activity', 'attend');
    await expect(debug(page)).toHaveAttribute('data-mood', 'curious');
    expect(await maxLatency(page)).toBeLessThan(100);
    await settle(page, 900);
    await page.screenshot({ path: 'test-results/chiot-6-attentif.png' });
  });

  test('F-MAIN-6 : pousser le flanc le couche, puis le roule sur le côté', async ({ page }) => {
    await fresh(page);
    const push = async () => {
      const p = await pointOn(page, 'flank').catch(() => pointOn(page, 'belly'));
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 50, p.y, { steps: 2 });
      await page.mouse.up();
      expect(await maxLatency(page)).toBeLessThan(100);
    };
    await push();
    await expect(debug(page)).toHaveAttribute('data-posture', 'lie');
    await settle(page, 900);
    await page.screenshot({ path: 'test-results/chiot-7-couche.png' });
    await push();
    await expect(debug(page)).toHaveAttribute('data-posture', 'side');
    await settle(page, 900);
    await page.screenshot({ path: 'test-results/chiot-8-cote.png' });
  });

  test('F-VIE-2 : il accourt au retour du joueur', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => window.__truffe?.rewind(26 * 3_600_000));
    await expect(debug(page)).toHaveAttribute('data-activity', 'greet');
    await expect(debug(page)).toHaveAttribute('data-mood', 'happy');
    await page.waitForTimeout(450);
    await page.screenshot({ path: 'test-results/chiot-9-accueil.png' });
    await page.waitForTimeout(1500);
    const nose = await page.evaluate(() => window.__truffe?.probe.nose());
    if (nose) await page.screenshot({ path: 'test-results/chiot-9b-visage.png', clip: { x: nose.x - 70, y: nose.y - 80, width: 140, height: 130 } });
  });
});
