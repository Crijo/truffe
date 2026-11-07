import { expect, test } from '@playwright/test';

/** Jalon 7 : le parcours essentiel marche sur chaque moteur (Chromium, WebKit, Gecko). */
test('adopter, caresser, nourrir, ouvrir les concours et les réglages', async ({ page }, info) => {
  // Chrome sans carte graphique (GitHub Actions) dessine à une douzaine d'images par seconde : on lui laisse le temps.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug');
  const kennel = page.getByTestId('kennel');
  await expect(kennel).toBeVisible({ timeout: 30_000 });
  await kennel.getByRole('button', { name: 'Beagle' }).click();
  await kennel.locator('.k-pup').nth(0).click();
  await page.getByTestId('choose').click();
  await page.getByTestId('name-input').fill('Truffe');
  await page.getByTestId('adopt').click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'living');
  await page.waitForTimeout(1500);

  // Caresse : quelques allers-retours au milieu du chiot.
  const box = page.viewportSize() ?? { width: 400, height: 800 };
  await page.mouse.move(box.width / 2 - 30, box.height * 0.62);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) await page.mouse.move(box.width / 2 + (i % 2 ? 30 : -30), box.height * 0.62, { steps: 4 });
  await page.mouse.up();

  // Repas.
  await page.getByRole('button', { name: 'Sac' }).click();
  await page.getByTestId('item-food').click();
  await expect.poll(() => page.evaluate(() => window.__truffe?.store.getState().bowls.length ?? 0)).toBe(1);

  await page.getByTestId('out').click();
  await page.getByTestId('out-contests').click();
  await expect(page.getByTestId('refusal-obedience')).toBeVisible();
  await page.getByTestId('panel-close').click();
  await page.getByTestId('settings').click();
  await page.getByTestId('reduce-motion').check();
  expect(await page.evaluate(() => window.__truffe?.store.getState().save.settings.reduceMotion)).toBe(true);
  await page.getByTestId('panel-close').click();

  // Jalon 8 : Fiche avec les niveaux, atelier des tours.
  await page.evaluate(() => window.__truffe?.store.dispatch({ type: 'debug/xp', walks: 20 }));
  await page.getByTestId('status').click();
  await expect(page.getByTestId('levels')).toContainText('Niveau');
  await page.getByTestId('open-workshop').click();
  await page.getByTestId('workshop-play-flip').click();
  await expect(page.getByTestId('workshop-status')).toContainText('Manche 1');
  await page.getByTestId('workshop-quit').click();
  await page.getByTestId('panel-close').click();

  const fps = await page.evaluate(() => window.__truffe?.fps() ?? 0);
  await page.screenshot({ path: `test-results/compat-${info.project.name}.png` });
  console.log(`${info.project.name} : ${Math.round(fps)} i/s`);
  expect(errors).toEqual([]);
});
