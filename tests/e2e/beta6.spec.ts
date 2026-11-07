import { expect, test, type Page } from '@playwright/test';
import { fresh } from './helpers';

const state = (page: Page) => page.evaluate(() => window.__truffe?.store.getState());
const cam = (page: Page) => page.evaluate(() => window.__truffe?.camera?.() ?? 0);

/** Glisse la vue du salon (sur le mur, à côté des chiots). */
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

test.describe('Jalon 12 : jardin, croquettes, Sac', () => {
  test('D-98 : la porte du salon mène au jardin ; un tas creusé donne un trésor (ou rien) ; le menu ramène au salon', async ({ page }) => {
    test.setTimeout(60_000);
    await fresh(page);
    // La porte est à droite du salon : on glisse la vue jusqu'à elle.
    await swipe(page, -300);
    await swipe(page, -300);
    await expect.poll(() => cam(page)).toBeLessThan(-150);
    const vp = page.viewportSize() ?? { width: 390, height: 800 };
    const door = await page.evaluate(({ w, h }) => {
      const t = window.__truffe;
      for (let y = h * 0.1; y < h * 0.6; y += 10) for (let x = 0; x < w; x += 10) if (t?.doorAt?.(x, y)) return { x: x + 20, y: y + 40 };
      return null;
    }, { w: vp.width, h: vp.height });
    if (!door) throw new Error('porte introuvable');
    await page.screenshot({ path: 'test-results/j12-porte.png' });
    await page.mouse.click(door.x, door.y);
    await expect(page.locator('body')).toHaveAttribute('data-place', 'garden');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/j12-jardin.png' });

    const mounds = await page.evaluate(() => window.__truffe?.moundsOnScreen?.() ?? []);
    const m = mounds.find((p) => p.x > 30 && p.x < vp.width - 30);
    if (!m) throw new Error('aucun tas visible');
    await page.mouse.click(m.x, m.y);
    await expect.poll(async () => (await state(page))?.save.garden.spots.find((p) => p.id === m.id)?.dug, { timeout: 15_000 }).toBe(true);
    await expect(page.locator('.toast')).toContainText(/trouvé|creusé/);
    await page.screenshot({ path: 'test-results/j12-trou.png' });

    await page.getByTestId('out').click();
    await expect(page.getByTestId('out-garden')).toContainText('Salon');
    await page.getByTestId('out-garden').click();
    await expect(page.locator('body')).toHaveAttribute('data-place', 'home');
  });

  test('D-98 : au jardin, balle et corde se jouent comme au salon', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('out').click();
    await page.getByTestId('out-garden').click();
    await expect(page.locator('body')).toHaveAttribute('data-place', 'garden');
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('item-ball').click();
    const vp = page.viewportSize() ?? { width: 390, height: 800 };
    await page.mouse.move(vp.width / 2, vp.height * 0.75);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(vp.width / 2 + i * 4, vp.height * 0.75 - i * 30);
    await page.mouse.up();
    await expect.poll(async () => (await state(page))?.toys.length ?? 0).toBe(1);
    await page.screenshot({ path: 'test-results/j12-jardin-balle.png' });
  });

  test('D-97 : le stock de croquettes s’affiche ; sans croquettes, on est renvoyé à la boutique', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: 'Sac' }).click();
    await expect(page.getByTestId('kibble-left')).toContainText('10 repas');
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      t.store.replaceForDebug({ ...s, save: { ...s.save, inventory: { ...s.save.inventory, croquettes: 0 } } });
    });
    await page.getByRole('button', { name: 'Sac' }).click();
    await expect(page.getByTestId('kibble-left')).toContainText('Plus de croquettes');
    await page.getByTestId('item-food').click();
    await expect(page.locator('.toast')).toContainText('boutique');
    expect((await state(page))?.bowls.length).toBe(0);
  });

  test('D-94 : un Sac très rempli défile', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      const many = ['patee', 'biscuit', 'os', 'lait', 'fromage', 'balle-pois', 'balle-feutre', 'disque-etoile', 'anneau', 'collier-rouge', 'collier-cuir', 'foulard-vert', 'foulard-carreaux', 'bonnet', 'chapeau-paille', 'noeud-rose', 'noeud-bleu', 'lunettes-rondes', 'shampooing-doux', 'brosse-douce'];
      t.store.replaceForDebug({ ...s, save: { ...s.save, inventory: { ...s.save.inventory, ...Object.fromEntries(many.map((id) => [id, 1])) } } });
    });
    await page.getByRole('button', { name: 'Sac' }).click();
    const sheet = page.locator('section.sheet[aria-label="Sac"]');
    const box = await sheet.boundingBox();
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    const scroll = await sheet.evaluate((e) => ({ h: e.scrollHeight, c: e.clientHeight }));
    expect(scroll.h).toBeGreaterThan(scroll.c);
    await sheet.evaluate((e) => (e.scrollTop = e.scrollHeight));
    await expect(page.getByTestId('item-food')).not.toBeInViewport();
    await sheet.evaluate((e) => (e.scrollTop = 0));
    await expect(page.getByTestId('item-food')).toBeInViewport();
    await page.screenshot({ path: 'test-results/j12-sac.png' });
  });
});
