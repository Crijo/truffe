import { expect, test, type Page } from '@playwright/test';
import { fresh } from './helpers';

const state = (page: Page) => page.evaluate(() => window.__truffe?.store.getState());

/** Chiot prêt pour les concours, au niveau voulu, avec Assis et Couché appris. */
async function prepare(page: Page, walks = 0): Promise<void> {
  await page.evaluate((walks) => {
    const t = window.__truffe;
    if (!t) return;
    const s = t.store.getState();
    const trick = (id: 'sit' | 'down') => ({ trickId: id, repetitions: 5, learned: true, mastery: 1, command: { label: id === 'sit' ? 'Assis' : 'Couché' } });
    t.store.replaceForDebug({ ...s, save: { ...s.save, dogs: s.save.dogs.map((d) => ({ ...d, affection: 100, traits: { ...d.traits, docility: 1 }, visited: { park: true, gym: true, market: true }, tricks: [trick('sit'), trick('down')] })) } });
    t.store.dispatch({ type: 'debug/xp', walks });
  }, walks);
}

/** Glisse le doigt le long du dessin affiché dans le carré de tracé. */
async function traceGuide(page: Page): Promise<void> {
  const pad = page.getByTestId('trace-pad');
  const box = await pad.boundingBox();
  const d = await pad.locator('.trace-guide').getAttribute('d');
  if (!box || !d) throw new Error('pas de dessin');
  const pts = [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => ({ x: box.x + (Number(m[1]) / 100) * box.width, y: box.y + (Number(m[2]) / 100) * box.height }));
  const first = pts[0];
  if (!first) throw new Error('dessin vide');
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x + 2, p.y - 2, { steps: 3 });
  await page.mouse.up();
}

test.describe('Jalon 8, lot 3 : tracé, atelier des tours, pas', () => {
  test('D-79 : en concours d’obéissance, retracer le dessin donne l’ordre, avec un bonus', async ({ page }) => {
    test.setTimeout(90_000);
    await fresh(page);
    await prepare(page);
    await page.getByTestId('out').click();
    await page.getByTestId('out-contests').click();
    await page.getByTestId('enter-obedience').click();
    await expect(page.getByTestId('trace-pad')).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/trace-1-dessin.png' });
    await traceGuide(page);
    await expect.poll(async () => (await state(page))?.contest?.run.kind === 'obedience' && ((await state(page))?.contest?.run as { results: unknown[] }).results.length).toBe(1);
    const run = (await state(page))?.contest?.run;
    if (run?.kind !== 'obedience') throw new Error('pas d’obéissance');
    const BASE = 10;
    expect(run.results[0]?.ok).toBe(true);
    // Bonus de rapidité + bonus de précision : plus que l'ordre seul, même donné tard.
    expect(run.results[0]?.points ?? 0).toBeGreaterThan(BASE + 2);
    await page.screenshot({ path: 'test-results/trace-2-reussi.png' });
  });

  test('D-80 : l’atelier s’ouvre au niveau 5 ; refaire la suite compte comme une répétition', async ({ page }) => {
    test.setTimeout(90_000);
    await fresh(page);
    await page.getByTestId('status').click();
    await page.getByTestId('open-workshop').click();
    await expect(page.locator('[data-trick=flip]')).toContainText('Niveau 5');
    await expect(page.getByTestId('workshop-play-flip')).toHaveCount(0);
    await page.getByTestId('panel-close').click();
    await prepare(page, 20);
    await page.getByTestId('status').click();
    await page.getByTestId('open-workshop').click();
    await page.screenshot({ path: 'test-results/atelier-1-liste.png' });
    // On note les mouvements montrés, puis on les refait.
    await page.evaluate(() => {
      const w = window as unknown as { __shown: string[] };
      w.__shown = [];
      new MutationObserver((ms) => {
        for (const m of ms) {
          const el = m.target as HTMLElement;
          if (el.classList.contains('lit') && !(m.oldValue ?? '').includes('lit')) w.__shown.push(el.dataset.move ?? '');
        }
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    });
    await page.getByTestId('workshop-play-flip').click();
    for (let round = 0; round < 3; round++) {
      await expect(page.getByTestId('workshop-status')).toContainText('À toi', { timeout: 10_000 });
      if (round === 0) await page.screenshot({ path: 'test-results/atelier-2-jeu.png' });
      const shown = await page.evaluate(() => {
        const w = window as unknown as { __shown: string[] };
        const s = w.__shown;
        w.__shown = [];
        return s;
      });
      expect(shown).toHaveLength(3 + round);
      for (const m of shown) await page.getByTestId(`workshop-pad-${m}`).click();
      await page.evaluate(() => {
        (window as unknown as { __shown: string[] }).__shown = [];
      });
    }
    await expect(page.getByTestId('workshop-status')).toContainText('Réussi');
    const dog = (await state(page))?.save.dogs[0];
    expect(dog?.tricks.find((t) => t.trickId === 'flip')?.repetitions).toBe(1);
    await page.screenshot({ path: 'test-results/atelier-3-reussi.png' });
  });

  test('D-81 : les pas comptés par le téléphone s’affichent pendant la promenade', async ({ page }) => {
    await page.context().grantPermissions(['accelerometer', 'gyroscope']);
    await fresh(page);
    await page.getByTestId('out').click();
    await page.getByTestId('out-walk').click();
    const box = await page.getByTestId('city').boundingBox();
    if (!box) throw new Error('plan introuvable');
    const at = (c: number, r: number) => ({ x: box.x + ((c * 100 + 50) / 600) * box.width, y: box.y + ((r * 100 + 50) / 600) * box.height });
    await page.mouse.move(at(2, 5).x, at(2, 5).y);
    await page.mouse.down();
    await page.mouse.move(at(2, 4).x, at(2, 4).y, { steps: 6 });
    await page.mouse.move(at(2, 3).x, at(2, 3).y, { steps: 6 });
    await page.mouse.up();
    await page.getByTestId('walk-go').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'walk');
    await expect(page.getByTestId('walk-steps')).toBeHidden();
    await page.waitForTimeout(300);
    // Trois secondes de marche, 2 pas par seconde.
    await page.evaluate(async () => {
      for (let t = 0; t < 3000; t += 16) {
        const phase = ((t / 1000) * 2) % 1;
        const z = 9.81 + (phase < 0.25 ? Math.sin((phase / 0.25) * Math.PI) * 3 : -0.75 * Math.sin(((phase - 0.25) / 0.75) * Math.PI));
        window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0.2, y: 0.3, z }, interval: 16 }));
        await new Promise((r) => setTimeout(r, 16));
      }
    });
    await expect(page.getByTestId('walk-steps')).toBeVisible();
    const steps = await page.evaluate(() => { const w = window.__truffe?.store.getState().walk; return w ? w.steps : -1; });
    expect(steps).toBeGreaterThanOrEqual(4);
    expect(steps).toBeLessThanOrEqual(7);
    await page.screenshot({ path: 'test-results/pas-promenade.png' });
  });
});
