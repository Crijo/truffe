import { expect, test, type Page } from '@playwright/test';

const ready = async (page: Page, url: string): Promise<void> => {
  await page.goto(url);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1200);
};
const state = (page: Page) => page.evaluate(() => window.__truffe?.store.getState());

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

test.describe('Jalon 8, lot 2 : saisons et niveaux', () => {
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
    test(`D-77 : salon, promenade et concours en ${season}`, async ({ page }) => {
      await ready(page, `/?debug&adopt=beagle&season=${season}`);
      await page.screenshot({ path: `test-results/saison-${season}-salon.png` });
      await page.getByTestId('out').click();
      await page.getByTestId('out-walk').click();
      await trace(page, [
        [2, 5],
        [2, 4],
        [2, 3],
      ]);
      await page.getByTestId('walk-go').click();
      await expect(page.locator('body')).toHaveAttribute('data-mode', 'walk');
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `test-results/saison-${season}-promenade.png` });
    });
  }

  test('D-78 : niveaux du chiot et du joueur, dans les barres et la Fiche, avec une annonce', async ({ page }) => {
    await ready(page, '/?debug&adopt=beagle');
    await expect(page.getByTestId('status-level')).toContainText('niv. 1');
    const coins = (await state(page))?.save.coins ?? 0;
    await page.evaluate(() => window.__truffe?.store.dispatch({ type: 'debug/xp', walks: 2 }));
    await expect(page.getByTestId('status-level')).toContainText('niv. 2');
    await expect(page.locator('.toast')).toContainText('niveau 2');
    expect((await state(page))?.save.coins).toBeGreaterThan(coins);
    await page.getByTestId('status').click();
    const levels = page.getByTestId('levels');
    await expect(levels.locator('[data-kind=dog]')).toContainText('Niveau 2');
    await expect(levels.locator('[data-kind=player]')).toContainText('Niveau 2');
    await page.screenshot({ path: 'test-results/niveaux-fiche.png' });
  });
});
