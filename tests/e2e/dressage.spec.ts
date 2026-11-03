import { expect, test, type Page } from '@playwright/test';
import { activity, fresh, pointOn } from './helpers';

/** Chiot docile et attaché : il obéit presque toujours. */
async function eager(page: Page): Promise<void> {
  await page.evaluate(() => {
    const t = window.__truffe;
    if (!t) return;
    const s = t.store.getState();
    t.store.replaceForDebug({
      ...s,
      save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, affection: 100, traits: { ...d.traits, docility: 1, boldness: 0.8 } })) },
    });
  });
}

const tricks = (page: Page) => page.evaluate(() => window.__truffe?.store.getState().save.dogs[0]?.tricks ?? []);

test.describe('Jalon 4 : dressage aux boutons', () => {
  test('F-DRE-1 et F-DRE-2 : toucher une patte, toucher l’ampoule, jusqu’au tour appris', async ({ page }) => {
    await fresh(page);
    await eager(page);
    for (let i = 0; i < 8 && !(await tricks(page)).find((t) => t.trickId === 'paw')?.learned; i++) {
      const paw = await pointOn(page, 'paw');
      await page.mouse.click(paw.x, paw.y);
      await expect.poll(() => page.evaluate(() => window.__truffe?.bulb()), { timeout: 2000 }).not.toBeNull();
      if (i === 0) await page.screenshot({ path: 'test-results/dressage-1-ampoule.png' });
      const b = await page.evaluate(() => window.__truffe?.bulb());
      if (!b) throw new Error('ampoule introuvable');
      await page.mouse.click(b.x, b.y);
      await page.waitForTimeout(2500);
    }
    const paw = (await tricks(page)).find((t) => t.trickId === 'paw');
    expect(paw?.learned).toBe(true);
    expect(paw?.repetitions).toBeGreaterThanOrEqual(3);
    expect(paw?.repetitions).toBeLessThanOrEqual(6);

    // La fiche le montre.
    await page.getByRole('button', { name: 'Fiche' }).click();
    await expect(page.getByTestId('card').locator('[data-trick=paw]')).toContainText('La patte');
    await page.screenshot({ path: 'test-results/dressage-2-fiche.png' });
    await page.getByRole('button', { name: 'Fermer' }).first().click();

    // F-DRE-4 : l'ordre depuis la liste du bouton Micro.
    let performed = false;
    for (let i = 0; i < 5 && !performed; i++) {
      await page.getByTestId('mic').click();
      await expect(page.getByTestId('orders')).toBeVisible();
      if (i === 0) await page.screenshot({ path: 'test-results/dressage-3-ordres.png' });
      await page.getByTestId('order-paw').click();
      performed = (await activity(page)) === 'perform';
      if (performed) {
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/dressage-4-patte.png' });
      }
      await page.waitForTimeout(2500);
    }
    expect(performed).toBe(true);
  });

  test('refuser le micro ne bloque rien : les ordres restent aux boutons', async ({ page }) => {
    await fresh(page);
    // Maintenir Micro : l'explication s'affiche avant toute demande au navigateur.
    const mic = page.getByTestId('mic');
    const box = await mic.boundingBox();
    if (!box) throw new Error('bouton Micro introuvable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    const ask = page.getByTestId('mic-ask');
    await expect(ask).toBeVisible();
    await page.screenshot({ path: 'test-results/dressage-5-micro.png' });
    await ask.getByRole('button', { name: 'Plus tard' }).click();
    await expect(ask).toHaveCount(0);
    // La liste d'ordres et l'appel restent là.
    await mic.click();
    await expect(page.getByTestId('order-call')).toBeVisible();
    await page.getByTestId('order-call').click();
    await expect.poll(() => activity(page)).toBe('come');
  });

  test('les poses des tours', async ({ page }) => {
    await fresh(page);
    await eager(page);
    const all = ['sit', 'down', 'roll', 'paw', 'beg', 'jump', 'spin', 'howl', 'dig', 'sniff', 'bark', 'scratch', 'flip', 'handstand', 'playdead', 'dance'];
    await page.evaluate((all) => {
      const t = window.__truffe;
      if (!t) return;
      const s = t.store.getState();
      const learned = all.map((id) => ({ trickId: id, repetitions: 3, learned: true, mastery: 1, command: { label: id } }));
      t.store.replaceForDebug({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, tricks: learned as typeof d.tricks })) } });
    }, all);
    const shoot = async (name: string, order: string, wait: number) => {
      await page.evaluate((o) => window.__truffe?.store.dispatch({ type: 'order', trickId: o as 'sit' }), order);
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `test-results/tour-${name}.png` });
    };
    await shoot('debout', 'sit', 1800);
    await shoot('debout', 'beg', 900);
    await shoot('danse', 'spin', 700);
    await page.waitForTimeout(2500);
    await shoot('couche', 'down', 1600);
    await shoot('poirier', 'beg', 1000);
    await page.waitForTimeout(2000);
    await shoot('roulade', 'roll', 2200);
    await shoot('mort', 'roll', 1200);
    await page.waitForTimeout(2500);
    await shoot('patte', 'paw', 700);
  });
});
