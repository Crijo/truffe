import { expect, test, type Page } from '@playwright/test';
import { fresh } from './helpers';

const dog = (page: Page) => page.evaluate(() => window.__truffe?.store.getState().save.dogs[0]);
const save = (page: Page) => page.evaluate(() => window.__truffe?.store.getState().save);

/** Glisse le doigt sur le plan, d'un croisement à l'autre (colonne, rangée). */
async function trace(page: Page, nodes: [number, number][]): Promise<void> {
  const box = await page.getByTestId('city').boundingBox();
  if (!box) throw new Error('plan introuvable');
  const at = ([c, r]: [number, number]) => ({ x: box.x + ((c * 100 + 50) / 600) * box.width, y: box.y + ((r * 100 + 50) / 600) * box.height });
  const first = at(nodes[0] ?? [2, 5]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const n of nodes.slice(1)) {
    const p = at(n);
    await page.mouse.move(p.x, p.y, { steps: 6 });
  }
  await page.mouse.up();
}

async function openMap(page: Page): Promise<void> {
  await page.getByTestId('out').click();
  await page.getByTestId('out-walk').click();
  await expect(page.getByTestId('city')).toBeVisible();
}

test.describe('Jalon 5 : promenade et objets', () => {
  test('F-PRO-1 : le trajet est plafonné par l’endurance (500 m)', async ({ page }) => {
    await fresh(page);
    await openMap(page);
    await trace(page, [
      [2, 5],
      [2, 4],
      [2, 3],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
      [5, 1],
      [5, 0],
      [4, 0],
      [3, 0],
      [2, 0],
      [1, 0],
    ]);
    await expect(page.getByTestId('route-meter')).toContainText('500 m / 500 m');
    await page.screenshot({ path: 'test-results/promenade-1-plan.png' });
  });

  test('F-PRO-3 à F-PRO-7 : la promenade, la laisse, un lieu, puis les gains', async ({ page }) => {
    test.setTimeout(150_000);
    await fresh(page);
    const before = await dog(page);
    await openMap(page);
    await trace(page, [
      [2, 5],
      [2, 4],
      [2, 3],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
    ]);
    await page.getByTestId('walk-go').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'walk');
    await page.waitForTimeout(1500);
    // Tenir la laisse vers le haut.
    const vp = page.viewportSize() ?? { width: 400, height: 800 };
    await page.mouse.move(vp.width * 0.15, vp.height * 0.6);
    await page.mouse.down();
    await page.mouse.move(vp.width * 0.15, vp.height * 0.55, { steps: 3 });
    await page.screenshot({ path: 'test-results/promenade-2-marche.png' });
    await page.mouse.up();

    let shotPlace = false;
    for (let i = 0; i < 120; i++) {
      if (await page.getByTestId('walk-summary').isVisible()) break;
      if (await page.getByTestId('walk-pickup').isVisible()) {
        await page.screenshot({ path: 'test-results/promenade-3-besoins.png' });
        await page.getByTestId('walk-pickup').click();
      }
      if (await page.getByTestId('walk-enter').isVisible()) {
        if (!shotPlace) await page.screenshot({ path: 'test-results/promenade-4-gymnase.png' });
        shotPlace = true;
        await page.getByTestId('walk-enter').click();
        // D-103 : au gymnase, l'entraînement s'ouvre ; on le quitte pour reprendre la promenade.
        if (await page.getByTestId('contest-hud').isVisible()) await page.getByTestId('contest-quit').click();
        await page.getByTestId('walk-continue').click();
      }
      await page.waitForTimeout(500);
    }
    await expect(page.getByTestId('walk-summary')).toBeVisible();
    await page.screenshot({ path: 'test-results/promenade-5-bilan.png' });
    const after = await dog(page);
    expect(after?.stamina).toBe((before?.stamina ?? 0) + 1);
    expect(after?.visited.gym).toBe(true);
    expect((await save(page))?.masterPoints ?? 0).toBeGreaterThanOrEqual(13);
    await page.getByTestId('walk-back').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'living');

    // F-PRO-7 : une deuxième promenade tout de suite ne rapporterait rien.
    await openMap(page);
    await expect(page.locator('.map-panel .hint').first()).toContainText('min');
  });

  test('F-ECO-3 : acheter, porter, et le retrouver après rechargement', async ({ page }) => {
    await fresh(page);
    const coins = (await save(page))?.coins ?? 0;
    await page.getByTestId('out').click();
    await page.getByTestId('out-shop').click();
    await page.getByRole('button', { name: 'Accessoires' }).click();
    await page.screenshot({ path: 'test-results/boutique-1.png' });
    await page.getByTestId('buy-bonnet').click();
    await expect(page.getByTestId('coins')).toContainText(String(coins - 200));
    await page.getByTestId('panel-close').click();

    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('own-bonnet').click();
    await expect(page.getByTestId('own-bonnet')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Fermer' }).first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/boutique-2-bonnet.png' });

    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const d = await dog(page);
    expect(d?.equipped).toContain('bonnet');
    expect((await save(page))?.inventory.bonnet).toBe(1);
    expect((await save(page))?.coins).toBe(coins - 200);
  });

  test('F-ECO-3 : la brocante vend et rachète', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('out').click();
    await page.getByTestId('out-market').click();
    const first = page.locator('[data-testid^=mbuy-]').first();
    const id = ((await first.getAttribute('data-testid')) ?? '').replace('mbuy-', '');
    const coins = (await save(page))?.coins ?? 0;
    if (await first.isEnabled()) {
      await first.click();
      expect((await save(page))?.inventory[id]).toBe(1);
      await page.getByTestId(`sell-${id}`).click();
      expect((await save(page))?.inventory[id] ?? 0).toBe(0);
      expect((await save(page))?.coins ?? 0).toBeLessThan(coins);
    }
    await page.screenshot({ path: 'test-results/brocante.png' });
  });

  test('F-ECO-4 : le carnet montre des silhouettes pour ce qui reste à découvrir', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: 'Fiche' }).click();
    await page.getByTestId('open-book').click();
    await expect(page.locator('.book-cell.unknown').first()).toBeVisible();
    expect(await page.locator('.book-cell').count()).toBeGreaterThanOrEqual(30 + 16);
    await page.screenshot({ path: 'test-results/carnet.png' });
  });
});
