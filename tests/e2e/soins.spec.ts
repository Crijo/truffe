import { expect, test } from '@playwright/test';
import { activity, debug, fresh, needs, returnAfter, rub } from './helpers';

const DAY = 24 * 3_600_000;

test.describe('Jalon 2 : besoins et temps', () => {
  test('la barre basse et ses cibles tactiles (≥ 44 px, texte et icône)', async ({ page }) => {
    await fresh(page);
    for (const name of ['Sac', 'Sortir', 'Micro', 'Réglages']) {
      const b = page.getByRole('button', { name });
      await expect(b).toBeVisible();
      const box = await b.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await expect(b.locator('svg')).toHaveCount(1);
    }
    // D-70 : la fiche s'ouvre par les barres d'état, en haut à droite.
    const status = page.getByRole('button', { name: 'Fiche' });
    await expect(status).toBeVisible();
    expect((await status.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: 'test-results/soins-1-salon.png' });
  });

  test('F-SOIN-4 : la fiche montre l’état en barres (et en mots pour les lecteurs d’écran), jamais en chiffres', async ({ page }) => {
    await fresh(page);
    await page.getByRole('button', { name: 'Fiche' }).click();
    const card = page.getByTestId('card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Faim');
    await expect(card).toContainText('Soif');
    await expect(card).toContainText('Pelage');
    // L'état (faim, soif, pelage) est en mots ; le compte des tours, plus bas, n'est pas un état.
    expect(await card.locator('.rows').innerText()).not.toMatch(/\d|%/);
    await page.screenshot({ path: 'test-results/soins-2-fiche.png' });
  });

  test('F-VIE-3 et F-SOIN-1 : après 30 jours, la fiche s’inquiète ; les gamelles glissées le nourrissent', async ({ page }) => {
    await fresh(page);
    await returnAfter(page, 30 * DAY);
    const n = await needs(page);
    // Plancher de 5 au retour ; le jeu reprend ensuite son cours (quelques millièmes en moins).
    for (const k of ['hunger', 'thirst', 'cleanliness'] as const) expect(n?.[k]).toBeGreaterThanOrEqual(4.99);
    await expect(debug(page)).toHaveAttribute('data-mood', 'happy');

    await page.getByRole('button', { name: 'Fiche' }).click();
    const card = page.getByTestId('card');
    await expect(card.locator('[data-kind=hunger]')).toContainText('Affamé');
    await expect(card.locator('[data-kind=thirst]')).toContainText('Assoiffé');
    await page.screenshot({ path: 'test-results/soins-3-affame.png' });
    await page.getByRole('button', { name: 'Fermer' }).last().click();

    // Glisser-déposer : du sac vers le sol.
    const vp = page.viewportSize() ?? { width: 400, height: 800 };
    for (const [testid, x] of [
      ['item-food', 0.72],
      ['item-water', 0.28],
    ] as const) {
      await page.getByRole('button', { name: 'Sac' }).click();
      const box = await page.getByTestId(testid).boundingBox();
      if (!box) throw new Error('objet introuvable');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(vp.width * x, vp.height * 0.8, { steps: 12 });
      await page.mouse.up();
    }
    await expect.poll(() => page.evaluate(() => window.__truffe?.store.getState().bowls.length)).toBe(2);
    // L'accueil d'après une longue absence passe d'abord (jusqu'à 8,5 s).
    await expect.poll(() => activity(page), { timeout: 12_000 }).toBe('eat');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/soins-4-repas.png' });
    await expect.poll(async () => (await needs(page))?.hunger ?? 0, { timeout: 20_000 }).toBeGreaterThan(40);
    await expect.poll(async () => (await needs(page))?.thirst ?? 0, { timeout: 20_000 }).toBeGreaterThan(50);

    await page.getByRole('button', { name: 'Fiche' }).click();
    await expect(card.locator('[data-kind=hunger]')).not.toContainText('Affamé');
    await expect(card.locator('[data-kind=thirst]')).not.toContainText('Assoiffé');
  });

  test('F-SOIN-2 : bain au doigt, puis le pelage est superbe', async ({ page }) => {
    await fresh(page);
    await returnAfter(page, 3 * DAY);
    await page.waitForTimeout(6000);
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('item-bath').click();
    await expect(page.getByRole('button', { name: 'Savon' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => activity(page)).toBe('groom');

    await rub(page, 3500);
    await page.screenshot({ path: 'test-results/soins-5-mousse.png' });
    await page.getByRole('button', { name: 'Douche' }).click();
    await rub(page, 2500);
    await page.screenshot({ path: 'test-results/soins-6-mouille.png' });
    await page.getByRole('button', { name: 'Serviette' }).click();
    await rub(page, 3000);
    await expect.poll(async () => (await needs(page))?.cleanliness ?? 0, { timeout: 4000 }).toBeGreaterThan(99);
    await page.getByRole('button', { name: 'Fini' }).click();
    await page.getByRole('button', { name: 'Fiche' }).click();
    await expect(page.getByTestId('card').locator('[data-kind=cleanliness]')).toContainText('Superbe');
  });

  test('F-SOIN-3 : la brosse fait briller le pelage', async ({ page }) => {
    await fresh(page);
    await returnAfter(page, DAY);
    await page.waitForTimeout(5000);
    const before = (await needs(page))?.cleanliness ?? 0;
    await page.getByRole('button', { name: 'Sac' }).click();
    await page.getByTestId('item-brush').click();
    await rub(page, 2500);
    await page.screenshot({ path: 'test-results/soins-7-brosse.png' });
    expect((await needs(page))?.cleanliness ?? 0).toBeGreaterThan(before + 10);
    await page.getByRole('button', { name: 'Fini' }).click();
    await expect(page.getByRole('button', { name: 'Sac' })).toBeVisible();
  });

  test('reculer l’horloge n’apporte aucun avantage', async ({ page }) => {
    await fresh(page);
    await returnAfter(page, 2 * DAY);
    const before = await needs(page);
    await returnAfter(page, -5 * DAY);
    await page.waitForTimeout(500);
    const after = await needs(page);
    expect(after?.affection).toBe(before?.affection);
    expect(after?.hunger ?? 0).toBeLessThanOrEqual((before?.hunger ?? 0) + 0.01);
    expect(after?.thirst ?? 0).toBeLessThanOrEqual((before?.thirst ?? 0) + 0.01);
  });
});

/** Fuseau où il est 23 h en ce moment : la nuit du salon. */
function nightZone(): string {
  const offset = (((23 - new Date().getUTCHours()) % 24) + 24) % 24;
  return offset <= 14 ? `Etc/GMT-${offset}` : `Etc/GMT+${24 - offset}`;
}

test.describe('F-VIE-1 : la nuit', () => {
  test.use({ timezoneId: nightZone() });

  test('il s’endort seul la nuit, et se réveille au toucher', async ({ page }) => {
    await fresh(page);
    await expect.poll(() => activity(page), { timeout: 60_000, intervals: [500] }).toBe('sleep');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/soins-8-nuit.png' });
    const p = await page.evaluate(() => window.__truffe?.probe.nose());
    if (!p) throw new Error('nez introuvable');
    await page.mouse.click(p.x, p.y - 30);
    await expect.poll(() => activity(page)).not.toBe('sleep');
  });
});
