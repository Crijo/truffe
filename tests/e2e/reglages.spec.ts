import { expect, test } from '@playwright/test';
import { fresh } from './helpers';

test.describe('Jalon 7 : réglages et sauvegarde', () => {
  test('réglages, export puis import de la sauvegarde', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('out').click();
    await page.getByTestId('out-settings').click();
    await page.getByTestId('reduce-motion').check();
    await page.getByTestId('music-volume').fill('0');
    await expect(page.locator('body')).toHaveClass(/reduce-motion/);
    await page.screenshot({ path: 'test-results/reglages.png' });
    const settings = await page.evaluate(() => window.__truffe?.store.getState().save.settings);
    expect(settings).toMatchObject({ reduceMotion: true, musicVolume: 0 });

    const download = page.waitForEvent('download');
    await page.getByTestId('export-save').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^truffe-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await file.path();
    const dogId = await page.evaluate(() => window.__truffe?.store.getState().save.dogs[0]?.id);

    // Une autre partie, puis on réimporte le fichier.
    await page.evaluate(() => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      t.store.replaceForDebug({ ...s, save: { ...s.save, coins: 1 } });
    });
    page.once('dialog', (d) => void d.accept());
    const reloaded = page.waitForEvent('load');
    await page.getByTestId('import-file').setInputFiles(path);
    await reloaded;
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const after = await page.evaluate(() => window.__truffe?.store.getState().save);
    expect(after?.dogs[0]?.id).toBe(dogId);
    expect(after?.coins).not.toBe(1);
    expect(after?.settings.reduceMotion).toBe(true);
  });

  test('un fichier qui n’est pas une sauvegarde est refusé', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('out').click();
    await page.getByTestId('out-settings').click();
    page.once('dialog', (d) => void d.accept());
    await page.getByTestId('import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"bonjour":1}') });
    await expect(page.getByRole('status').filter({ hasText: 'pas une sauvegarde' })).toBeVisible();
  });
});
