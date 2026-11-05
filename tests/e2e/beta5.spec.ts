import { expect, test, type Page } from '@playwright/test';
import { fresh } from './helpers';

const state = (page: Page) => page.evaluate(() => window.__truffe?.store.getState());
const cam = (page: Page) => page.evaluate(() => window.__truffe?.camera?.() ?? 0);

/** Glisse horizontalement sur le mur (là où il n'y a pas de chiot). */
async function swipe(page: Page, dx: number): Promise<void> {
  const vp = page.viewportSize() ?? { width: 390, height: 800 };
  const y = vp.height * 0.3;
  const x0 = vp.width / 2;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  await page.mouse.move(x0 + dx / 2, y + 2, { steps: 6 });
  await page.mouse.move(x0 + dx, y + 4, { steps: 6 });
  await page.mouse.up();
}

test.describe('Jalon 10 : retours de bêta', () => {
  test('D-87 : le niveau du joueur est affiché à part, avec ce qu’il vient de gagner', async ({ page }) => {
    await fresh(page);
    const badge = page.getByTestId('player-level');
    await expect(badge).toContainText('Toi');
    await expect(badge).toContainText('niv. 1');
    await page.evaluate(() => window.__truffe?.store.dispatch({ type: 'debug/xp', walks: 1 }));
    await expect(page.locator('.xp-chip.player')).toBeVisible();
    await expect(page.locator('.xp-chip.dog')).toBeVisible();
    await page.screenshot({ path: 'test-results/j10-niveaux.png' });
  });

  test('D-89 : on fait glisser la vue du salon ; appelé, le chiot vient là où l’on regarde', async ({ page }) => {
    await fresh(page);
    await swipe(page, -260);
    await expect.poll(() => cam(page)).toBeLessThan(-150);
    const s = await state(page);
    expect(s?.viewX ?? 0).toBeGreaterThan(0.5);
    await page.screenshot({ path: 'test-results/j10-vue-glissee.png' });
    await page.evaluate(() => window.__truffe?.store.dispatch({ type: 'call' }));
    await expect
      .poll(async () => {
        const st = await state(page);
        return st?.minds[st.save.homeDogIds[0] ?? '']?.pos.x ?? 0;
      }, { timeout: 15_000 })
      .toBeGreaterThan(0.5);
    await page.screenshot({ path: 'test-results/j10-vient-ici.png' });
  });

  test('D-89 : un chiot hors de la vue a un repère au bord ; le toucher y emmène', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      const id = s.save.homeDogIds[0] ?? '';
      const m = s.minds[id];
      if (!m) return;
      t.store.replaceForDebug({ ...s, minds: { ...s.minds, [id]: { ...m, pos: { x: -2.3, z: 0.6 }, target: null, plan: { mode: 'idle', until: m.t + 60_000 } } } });
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/j10-repere.png' });
    // Le repère est au bord gauche, à hauteur du chiot.
    const mark = await page.evaluate(() => window.__truffe?.edges?.()[0] ?? null);
    if (!mark) throw new Error('aucun repère');
    expect(mark.x).toBeLessThan(60);
    await page.mouse.click(mark.x, mark.y);
    await expect.poll(() => cam(page)).toBeGreaterThan(150);
    await page.screenshot({ path: 'test-results/j10-repere-suivi.png' });
  });

  test('D-90 : un panier apparaît quand on tient un jouet ; lâché dedans, le jouet est rangé', async ({ page }) => {
    await fresh(page);
    const basket = page.getByTestId('toy-basket');
    await expect(basket).toBeHidden();
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('item-ball').click();
    const vp = page.viewportSize() ?? { width: 390, height: 800 };
    await page.mouse.move(vp.width * 0.7, vp.height * 0.7);
    await page.mouse.down();
    await expect(basket).toBeVisible();
    const box = await basket.boundingBox();
    if (!box) throw new Error('panier introuvable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await expect(basket).toHaveClass(/over/);
    await page.screenshot({ path: 'test-results/j10-panier.png' });
    await page.mouse.up();
    await expect.poll(async () => (await state(page))?.toys.length ?? -1).toBe(0);
  });

  test('D-91 : ménage à l’éponge ; tout propre, le bilan s’affiche', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      const at = s.save.lastSeenAt;
      const dirt = [
        { id: 'a', kind: 'paw' as const, pos: { x: -0.45, z: 0.75 }, size: 1, at },
        { id: 'b', kind: 'crumbs' as const, pos: { x: 0.4, z: 0.8 }, size: 1, at },
        { id: 'c', kind: 'fur' as const, pos: { x: 0.5, z: 0.35 }, size: 1, at },
      ];
      t.store.replaceForDebug({ ...s, save: { ...s.save, dirt } });
    });
    await page.getByRole('button', { name: 'Sac' }).click();
    await expect(page.getByTestId('item-chores')).toContainText('Taches : 3');
    await page.getByTestId('item-chores').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'chores');
    await expect(page.getByTestId('chores-count')).toContainText('3');
    await page.screenshot({ path: 'test-results/j10-menage.png' });
    const pts = (await state(page))?.save.masterPoints ?? 0;
    for (let round = 0; round < 6; round++) {
      const spots = await page.evaluate(() => window.__truffe?.dirtOnScreen?.() ?? []);
      const target = spots[0];
      if (!target) break;
      await page.mouse.move(target.x - 25, target.y);
      await page.mouse.down();
      for (let i = 0; i < 8; i++) await page.mouse.move(target.x + (i % 2 ? 25 : -25), target.y + (i % 3) * 3, { steps: 4 });
      await page.mouse.up();
    }
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'living');
    await expect(page.locator('.toast')).toContainText('points');
    expect((await state(page))?.save.dirt.length).toBe(0);
    expect((await state(page))?.save.masterPoints ?? 0).toBeGreaterThan(pts);
    await page.screenshot({ path: 'test-results/j10-menage-fini.png' });
  });

  test('D-92 : la promenade change de rue aux carrefours, tourne, et montre le trajet', async ({ page }) => {
    await page.goto('/?debug&adopt=beagle&season=spring');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(800);
    await page.getByTestId('out').click();
    await page.getByTestId('out-walk').click();
    const box = await page.getByTestId('city').boundingBox();
    if (!box) throw new Error('plan introuvable');
    const at = (c: number, r: number) => ({ x: box.x + ((c * 100 + 50) / 600) * box.width, y: box.y + ((r * 100 + 50) / 600) * box.height });
    // Maison (2-5) → nord jusqu'à 2-3, puis à droite vers 3-3 et 4-3.
    const path: [number, number][] = [[2, 5], [2, 4], [2, 3], [3, 3], [4, 3]];
    const first = path[0] ?? [2, 5];
    await page.mouse.move(at(...first).x, at(...first).y);
    await page.mouse.down();
    for (const [c, r] of path.slice(1)) await page.mouse.move(at(c, r).x, at(c, r).y, { steps: 6 });
    await page.mouse.up();
    await page.getByTestId('walk-go').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'walk');
    await expect(page.getByTestId('walk-mini')).toBeVisible();
    const goTo = (m: number) =>
      page.evaluate((m) => {
        const t = window.__truffe;
        const s = t?.store.getState();
        if (!t || !s?.walk) return;
        t.store.replaceForDebug({ ...s, walk: { ...s.walk, progress: m, pause: null, plan: { ...s.walk.plan, events: [] } } });
      }, m);
    await goTo(92);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/j10-carrefour.png' });
    await goTo(104);
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/j10-apres-virage.png' });
    const route = (await state(page))?.walk?.plan.route ?? [];
    expect(route.slice(0, 5)).toEqual(['2-5', '2-4', '2-3', '3-3', '4-3']);
  });
});
