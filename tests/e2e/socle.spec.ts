import { expect, test } from '@playwright/test';

test.describe('Jalon 0 : socle', () => {
  test('affiche une scène plein écran sur téléphone', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?debug');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

    const vp = page.viewportSize();
    const box = await page.locator('#app canvas').boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box?.width ?? 0)).toBe(vp?.width);
    expect(Math.round(box?.height ?? 0)).toBe(vp?.height);

    const scroll = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - innerWidth,
      y: document.documentElement.scrollHeight - innerHeight,
    }));
    expect(scroll).toEqual({ x: 0, y: 0 });
    expect(errors).toEqual([]);
    await page.screenshot({ path: 'test-results/socle-telephone.png' });
  });

  test('une valeur enregistrée survit au rechargement', async ({ page }) => {
    await page.goto('/?debug');
    const debug = page.getByTestId('debug');
    await expect(debug).toHaveAttribute('data-sessions', /\d+/);
    const first = Number(await debug.getAttribute('data-sessions'));

    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    await expect(debug).toHaveAttribute('data-sessions', String(first + 1));

    await page.reload();
    await expect(debug).toHaveAttribute('data-sessions', String(first + 2));
  });
});
