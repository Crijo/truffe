import { expect, test, type Page } from '@playwright/test';
import { fresh } from './helpers';

const state = (page: Page) => page.evaluate(() => window.__truffe?.store.getState());

/** Part de la maison, trace deux pâtés de maisons vers le haut et part. */
async function startWalk(page: Page): Promise<void> {
  await page.getByTestId('out').click();
  await page.getByTestId('out-walk').click();
  const box = await page.getByTestId('city').boundingBox();
  if (!box) throw new Error('plan introuvable');
  const at = (c: number, r: number) => ({ x: box.x + ((c * 100 + 50) / 600) * box.width, y: box.y + ((r * 100 + 50) / 600) * box.height });
  await page.mouse.move(at(2, 5).x, at(2, 5).y);
  await page.mouse.down();
  await page.mouse.move(at(2, 4).x, at(2, 4).y, { steps: 6 });
  await page.mouse.move(at(2, 3).x, at(2, 3).y, { steps: 6 });
  await page.mouse.up();
  await page.getByTestId('walk-go').click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'walk');
}

test.describe('Jalon 9 : corrections de bêta', () => {
  test('D-82 : la jauge « Amusement » s’affiche, et lancer un jouet la remonte', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      t.store.replaceForDebug({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, needs: { ...d.needs, fun: 30 } })) } });
    });
    await expect(page.locator('[data-kind=fun]')).toContainText('Amusement');
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      t.store.dispatch({ type: 'toy/hold', kind: 'ball', at: { x: 0, z: 0.9 } });
      t.store.dispatch({ type: 'toy/throw', toyId: t.store.getState().toys[0]?.id ?? '', vx: 0.3, vz: -1 });
    });
    expect((await state(page))?.save.dogs[0]?.needs.fun ?? 0).toBeGreaterThan(30);
    await page.screenshot({ path: 'test-results/amusement.png' });
  });

  test('D-83 : un lancer de côté sort de l’écran ; la caméra suit, puis revient', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/?debug&adopt=beagle&season=autumn');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      t.store.replaceForDebug({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, affection: 95, traits: { docility: 0.9, energy: 0.6, boldness: 0.7 }, familiar: { ...d.familiar, ball: 9 } })) } });
      t.store.dispatch({ type: 'toy/hold', kind: 'ball', at: { x: 0, z: 0.9 } });
      t.store.dispatch({ type: 'toy/throw', toyId: t.store.getState().toys[0]?.id ?? '', vx: 2.4, vz: -0.3 });
    });
    const cam = () => page.evaluate(() => window.__truffe?.camera?.() ?? 0);
    await expect.poll(cam, { timeout: 8000 }).toBeLessThan(-60);
    await page.screenshot({ path: 'test-results/camera-1-suit.png' });
    // Le jouet ressort de l'écran du salon, puis tout le monde rentre et la caméra revient.
    expect(Math.max(...((await state(page))?.toys.map((t) => t.pos.x) ?? [0]))).toBeGreaterThan(0.9);
    await expect.poll(cam, { timeout: 40_000 }).toBe(0);
    await page.screenshot({ path: 'test-results/camera-2-retour.png' });
  });

  test('D-85 : en promenade, sur la voie du haut, on passe derrière le chien croisé', async ({ page }) => {
    await page.goto('/?debug&adopt=beagle&season=autumn');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(800);
    await startWalk(page);
    await page.waitForTimeout(500);
    // Rencontre imposée juste devant, chiot sur la voie du haut.
    await page.evaluate(() => {
      const t = window.__truffe;
      const s = t?.store.getState();
      if (!t || !s?.walk) return;
      const w = s.walk;
      const at = w.progress + 1;
      const events = [...w.plan.events, { kind: 'question' as const, sub: 'encounter' as const, at, lane: 1 }];
      t.store.replaceForDebug({ ...s, walk: { ...w, lane: 1, plan: { ...w.plan, events }, pause: { kind: 'encounter', until: w.t + 60_000, index: events.length - 1 } } });
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/promenade-profondeur.png' });
  });
});
