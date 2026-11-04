import { expect, test, type Page } from '@playwright/test';
import { fresh, pointOn } from './helpers';

const state = (page: Page) => page.evaluate(() => window.__truffe?.store.getState());
const setDog = (page: Page, patch: Record<string, unknown>) =>
  page.evaluate((patch) => {
    const t = window.__truffe;
    if (!t) return;
    const s = t.store.getState();
    t.store.replaceForDebug({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, ...patch })) } });
  }, patch);

test.describe('Jalon 8, lot 1 : retours de bêta', () => {
  test('les barres portent leur nom ; le pelage a une icône de bulles', async ({ page }) => {
    await fresh(page);
    const status = page.getByTestId('status');
    for (const w of ['Faim', 'Soif', 'Pelage']) await expect(status).toContainText(w);
    await page.screenshot({ path: 'test-results/beta1-barres.png', clip: { x: 200, y: 0, width: 212, height: 160 } });
  });

  test('un chiot sale se voit sale', async ({ page }) => {
    await fresh(page);
    await setDog(page, { needs: { hunger: 80, thirst: 80, cleanliness: 20, energy: 100 } });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/beta1-sale.png' });
  });

  test('une main apparaît sous le doigt quand on caresse', async ({ page }) => {
    await fresh(page);
    const p = await pointOn(page, 'head');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + 20, p.y, { steps: 5 });
    await expect(page.locator('.tool-cursor.hand')).toBeVisible();
    await page.screenshot({ path: 'test-results/beta1-main.png' });
    await page.mouse.up();
    await expect(page.locator('.tool-cursor')).toBeHidden();
  });

  test('D-74 : besoins au salon, on les ramasse', async ({ page }) => {
    await fresh(page);
    await setDog(page, { lastReliefAt: Date.now() - 5 * 3_600_000 });
    await expect.poll(async () => (await state(page))?.save.poops.length).toBe(1);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/beta1-besoin.png' });
    const before = (await state(page))?.save.masterPoints ?? 0;
    const target = await page.evaluate(() => window.__truffe?.poopsOnScreen?.()[0]);
    if (!target) throw new Error('besoin introuvable à l’écran');
    await page.mouse.click(target.x, target.y);
    await expect.poll(async () => (await state(page))?.save.poops.length).toBe(0);
    expect((await state(page))?.save.masterPoints).toBe(before + 5);
  });

  test('D-75 : obéissance dans la fiche et au concours', async ({ page }) => {
    await fresh(page);
    await setDog(page, { tricks: [{ trickId: 'sit', repetitions: 5, learned: true, mastery: 0.6, command: { label: 'Assis' } }] });
    await page.getByRole('button', { name: 'Fiche' }).click();
    const card = page.getByTestId('card');
    await expect(card.locator('[data-kind=obedience] [role=meter]')).toBeVisible();
    await expect(card.locator('.trick .mastery [role=meter]')).toHaveAttribute('aria-valuenow', '60');
    await page.screenshot({ path: 'test-results/beta1-obeissance.png' });
    await card.getByRole('button', { name: 'Fermer' }).first().click();
    await page.getByTestId('out').click();
    await page.getByTestId('out-contests').click();
    await expect(page.locator('.contest-obey [role=meter]')).toBeVisible();
  });
});
