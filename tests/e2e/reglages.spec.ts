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

test('D-72 : la luminosité éclaircit le salon le soir', async ({ page }) => {
  await fresh(page);
  // Force le soir (23 h) : la teinte de nuit s'applique.
  await page.evaluate(() => {
    const t = window.__truffe;
    if (!t) return;
    const s = t.store.getState();
    const d = new Date();
    d.setHours(23, 0, 0, 0);
    t.store.replaceForDebug({ ...s, save: { ...s.save, lastSeenAt: d.getTime() } });
  });
  const shot = async (v: string, name: string): Promise<number> => {
    await page.getByTestId('out').click();
    await page.getByTestId('out-settings').click();
    await page.getByTestId('brightness').fill(v);
    await page.getByTestId('panel-close').click();
    await page.waitForTimeout(400);
    const png = await page.screenshot({ path: `test-results/luminosite-${name}.png` });
    // Luminosité moyenne de la capture, décodée par le navigateur.
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const g = document.createElement('canvas');
      g.width = 40;
      g.height = 80;
      const x = g.getContext('2d');
      if (!x) return 0;
      x.drawImage(img, 0, 0, 40, 80);
      const d = x.getImageData(0, 0, 40, 80).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += (d[i] ?? 0) + (d[i + 1] ?? 0) + (d[i + 2] ?? 0);
      return sum / (d.length / 4) / 3;
    }, png.toString('base64'));
  };
  const dark = await shot('0', 'min');
  const light = await shot('100', 'max');
  expect(light).toBeGreaterThan(dark + 20);
  expect(await page.evaluate(() => window.__truffe?.store.getState().save.settings.brightness)).toBe(1);
});
