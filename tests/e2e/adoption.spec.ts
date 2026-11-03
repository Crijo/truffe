import { expect, test, type Page } from '@playwright/test';
import { activity, fresh } from './helpers';

const toys = (page: Page) => page.evaluate(() => window.__truffe?.store.getState().toys ?? []);

/** Glisse le doigt pour lancer le jouet en main, de (x0, y0) vers (x1, y1). */
async function fling(page: Page, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 5, y0 + ((y1 - y0) * i) / 5);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
}

async function arm(page: Page, testid: string): Promise<void> {
  await page.getByRole('button', { name: 'Sac' }).click();
  await page.getByTestId(testid).click();
}

test.describe('Jalon 3 : adoption et jeu', () => {
  test('F-ADO : du premier lancement au salon en moins de 2 minutes', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/?debug');
    const kennel = page.getByTestId('kennel');
    await expect(kennel).toBeVisible();
    await expect(kennel.locator('.k-breed')).toHaveCount(6);
    await expect(kennel.locator('.k-breed img')).toHaveCount(6);
    await page.screenshot({ path: 'test-results/adopt-1-races.png' });

    await kennel.getByRole('button', { name: 'Teckel' }).click();
    await expect(kennel.locator('.k-pup')).toHaveCount(3);
    await page.waitForTimeout(800);
    await kennel.locator('.k-pup').nth(1).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/adopt-2-chiots.png' });
    await page.getByTestId('choose').click();

    const input = page.getByTestId('name-input');
    await input.fill('  ');
    await page.getByTestId('adopt').click();
    await expect(page.getByRole('alert')).toContainText('Écris un nom');
    await input.fill('Biscotte');
    await page.screenshot({ path: 'test-results/adopt-3-nom.png' });
    await page.getByTestId('adopt').click();

    await expect(page.locator('body')).toHaveAttribute('data-mode', 'living');
    await expect(kennel).toHaveCount(0);
    expect(Date.now() - t0).toBeLessThan(120_000);
    const dog = await page.evaluate(() => window.__truffe?.store.getState().save.dogs[0]);
    expect(dog?.name).toBe('Biscotte');
    expect(dog?.breedId).toBe('teckel');

    await page.getByRole('button', { name: 'Fiche' }).click();
    await expect(page.getByTestId('card')).toContainText('Biscotte');
    await expect(page.getByTestId('card')).toContainText('Teckel');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/adopt-4-salon.png' });

    // Un rechargement ne ramène pas au chenil.
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'living');
  });

  test('les 6 races, en couleurs et en silhouettes', async ({ page }) => {
    await page.goto('/?debug&gallery');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/races-couleurs.png' });
    await page.goto('/?debug&gallery&silhouette');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/races-silhouettes.png' });
  });

  test('F-JEU-1 : le lancer suit la direction et la vitesse du doigt', async ({ page }) => {
    await fresh(page);
    const vp = page.viewportSize() ?? { width: 400, height: 800 };
    const cx = vp.width / 2;
    const y0 = vp.height * 0.86;

    await arm(page, 'item-ball');
    await fling(page, cx, y0, cx + 120, y0 - 160);
    await expect.poll(async () => (await toys(page))[0]?.state).not.toBe('held');
    await page.waitForTimeout(250);
    await page.screenshot({ path: 'test-results/jeu-1-lancer.png' });
    await expect.poll(async () => (await toys(page))[0]?.state, { timeout: 5000 }).not.toBe('flying');
    const right = (await toys(page))[0]?.pos.x ?? 0;
    expect(right).toBeGreaterThan(0.1);

    await page.evaluate(() => {
      const t = window.__truffe;
      if (t) t.store.replaceForDebug({ ...t.store.getState(), toys: [] });
    });
    await arm(page, 'item-ball');
    await fling(page, cx, y0, cx - 120, y0 - 160);
    // Fin du vol : au sol, ou déjà attrapée par le chiot à l'endroit où elle tombe.
    await expect.poll(async () => (await toys(page))[0]?.state, { timeout: 5000 }).toMatch(/ground|carried/);
    expect((await toys(page))[0]?.pos.x ?? 0).toBeLessThan(-0.1);
  });

  test('F-JEU-2 : il rapporte, mâchouille ou ignore', async ({ page }) => {
    await fresh(page);
    const vp = page.viewportSize() ?? { width: 400, height: 800 };
    await arm(page, 'item-ball');
    await fling(page, vp.width / 2, vp.height * 0.86, vp.width / 2 + 60, vp.height * 0.6);
    const plan = await page.evaluate(() => (window.__truffe ? window.__truffe.store.getState().minds[window.__truffe.dogId]?.toyPlan?.plan : null));
    expect(['fetch', 'chew', 'ignore']).toContain(plan ?? 'ignore');
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `test-results/jeu-2-${plan ?? 'ignore'}.png` });
  });

  test('F-JEU-3 : la corde se tire', async ({ page }) => {
    await fresh(page);
    const vp = page.viewportSize() ?? { width: 400, height: 800 };
    for (let attempt = 0; attempt < 6; attempt++) {
      await arm(page, 'item-rope');
      await page.mouse.move(vp.width / 2 + 40, vp.height * 0.78);
      await page.mouse.down();
      let tugging = false;
      for (let i = 0; i < 40 && !tugging; i++) {
        await page.mouse.move(vp.width / 2 + 40 + (i % 2), vp.height * 0.78);
        await page.waitForTimeout(100);
        tugging = (await activity(page)) === 'tug' && (await toys(page)).some((t) => t.state === 'tug');
      }
      if (tugging) {
        for (let i = 0; i < 6; i++) {
          await page.mouse.move(vp.width / 2 + 60 + i * 14, vp.height * 0.8 + i * 6);
          await page.waitForTimeout(40);
        }
        await page.screenshot({ path: 'test-results/jeu-3-corde.png' });
        await page.mouse.up();
        return;
      }
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
    throw new Error('le chiot n’a jamais attrapé la corde');
  });
});
