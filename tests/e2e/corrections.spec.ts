import { expect, test, type Page } from '@playwright/test';
import { fresh } from './helpers';

const state = (page: Page) => page.evaluate(() => window.__truffe?.store.getState());

test.describe('Corrections : fiche, barres d’état, gamelles, jouets', () => {
  test('la fiche montre les tours en cours d’apprentissage, et des barres', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      const tr = (id: 'sit' | 'down' | 'paw', reps: number, learned: boolean) => ({ trickId: id, repetitions: reps, learned, mastery: 0, command: { label: id === 'sit' ? 'Assis' : id === 'down' ? 'Couché' : 'La patte' } });
      t.store.replaceForDebug({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, needs: { ...d.needs, hunger: 30, thirst: 70, cleanliness: 95 }, tricks: [tr('sit', 5, true), tr('down', 2, false), tr('paw', 1, false)] })) } });
    });
    await page.getByRole('button', { name: 'Fiche' }).click();
    const card = page.getByTestId('card');
    const learning = card.locator('.trick.learning');
    await expect(learning).toHaveCount(2);
    await expect(learning.first()).toContainText('Couché');
    expect((await learning.first().boundingBox())?.height ?? 0).toBeGreaterThan(30);
    const meter = card.locator('[data-kind=hunger] [role=meter]');
    await expect(meter).toHaveAttribute('aria-valuenow', '30');
    expect((await card.locator('[data-kind=hunger] .gauge-bar > span').boundingBox())?.width ?? 0).toBeGreaterThan(10);
    await page.screenshot({ path: 'test-results/correction-1-fiche.png' });
  });

  test('les barres de faim, soif et pelage restent visibles sur l’écran', async ({ page }) => {
    await fresh(page);
    const status = page.getByTestId('status');
    await expect(status).toBeVisible();
    await expect(status.locator('[role=meter]')).toHaveCount(3);
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      t.store.replaceForDebug({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, needs: { ...d.needs, thirst: 10 } })) } });
    });
    await expect(status.locator('[data-kind=thirst]')).toHaveClass(/level-urgent/);
    await page.screenshot({ path: 'test-results/correction-2-barres.png' });
  });

  test('croquettes et eau servies ensemble', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('item-food').click();
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('item-water').click();
    await page.waitForTimeout(500);
    expect((await state(page))?.bowls.map((b) => b.kind).sort()).toEqual(['food', 'water']);
    await page.screenshot({ path: 'test-results/correction-3-gamelles.png' });
  });

  test('ranger les jouets : depuis le Sac, ou en les posant sur la barre', async ({ page }) => {
    await fresh(page);
    const w = page.viewportSize()?.width ?? 400;
    const h = page.viewportSize()?.height ?? 800;
    // Une balle lancée qui reste au sol.
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('item-ball').click();
    await page.mouse.move(w / 2, h * 0.75);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(w / 2 + i * 4, h * 0.75 - i * 30);
      await page.waitForTimeout(12);
    }
    await page.mouse.up();
    await page.waitForTimeout(2500);
    expect((await state(page))?.toys.length).toBe(1);
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('put-away').click();
    await expect.poll(async () => (await state(page))?.toys.filter((t) => t.state !== 'carried').length).toBe(0);

    // Un disque pris en main, puis posé sur la barre du bas.
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('item-disc').click();
    const bar = await page.locator('.hud .bar:not(.tools)').boundingBox();
    await page.mouse.move(w / 2, h * 0.7);
    await page.mouse.down();
    await page.mouse.move(w / 2, (bar?.y ?? h - 60) + 20, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect((await state(page))?.toys.filter((t) => t.kind === 'disc').length).toBe(0);
  });
});
