import { expect, test } from '@playwright/test';

test.describe('Jalon 7 : application installable', () => {
  test('manifeste et icônes de l’application', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = (await (await page.request.get(href ?? '')).json()) as { name: string; display: string; icons: { src: string; sizes: string; purpose?: string }[] };
    expect(manifest.name).toBe('Truffe');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const i of manifest.icons) expect((await page.request.get(i.src)).ok()).toBe(true);
  });

  test('le jeu se relance sans réseau, avec la partie', async ({ page, context }) => {
    await page.goto('/?debug&adopt=beagle');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), { timeout: 15_000 }).toBe(true);
    const id = await page.evaluate(() => window.__truffe?.store.getState().save.dogs[0]?.id);
    await page.waitForTimeout(500);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'living');
    expect(await page.evaluate(() => window.__truffe?.store.getState().save.dogs[0]?.id)).toBe(id);
    await page.screenshot({ path: 'test-results/pwa-hors-ligne.png' });
    await context.setOffline(false);
  });
});
