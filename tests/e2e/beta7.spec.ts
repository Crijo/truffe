import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) => page.evaluate(() => window.__truffe?.store.getState());

/** Part en promenade, puis s'arrête devant le lieu demandé. */
async function walkTo(page: Page, place: 'park' | 'gym'): Promise<void> {
  await page.goto('/?debug&adopt=beagle&season=summer');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(800);
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
  await page.evaluate((place) => {
    const t = window.__truffe;
    const s = t?.store.getState();
    if (!t || !s?.walk) return;
    const w = s.walk;
    const events = [...w.plan.events, { kind: 'place' as const, at: w.progress, lane: 1, place }];
    t.store.replaceForDebug({ ...s, walk: { ...w, plan: { ...w.plan, events }, pause: { kind: 'place', until: null, index: events.length - 1 } } });
  }, place);
}

/** Écourte l'essai en cours (le disque dure une minute). */
async function finishSoon(page: Page): Promise<void> {
  await page.evaluate(() => {
    const t = window.__truffe;
    const s = t?.store.getState();
    const c = s?.contest;
    if (!t || !s || !c || c.run.kind !== 'disc') return;
    t.store.replaceForDebug({ ...s, contest: { ...c, run: { ...c.run, timeLeftMs: 500 } } });
  });
}

test.describe('Jalon 15 : parc et gymnase', () => {
  test('D-103 : au parc, on s’entraîne au disque, on bat son record, on recommence, puis la promenade reprend', async ({ page }) => {
    test.setTimeout(60_000);
    await walkTo(page, 'park');
    await expect(page.getByTestId('walk-enter')).toContainText('disque');
    await page.getByTestId('walk-enter').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'contest');
    await expect(page.getByTestId('contest-hud')).toContainText('Parc');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/j15-parc.png' });
    // Un lancer, puis l'essai se termine.
    await page.evaluate(() => window.__truffe?.store.dispatch({ type: 'contest/throw', fx: 0.2, fy: 1.2 }));
    await page.waitForTimeout(2500);
    await finishSoon(page);
    await expect(page.getByTestId('practice-score')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('practice-record')).toBeVisible();
    await page.screenshot({ path: 'test-results/j15-parc-bilan.png' });
    expect((await state(page))?.save.dogs[0]?.bests?.disc).toBeDefined();
    await page.getByTestId('practice-again').click();
    await expect(page.getByTestId('contest-hud')).toContainText('Parc');
    expect((await state(page))?.contest?.practiceResult).toBeNull();
    await page.getByTestId('contest-quit').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'walk');
    expect((await state(page))?.walk?.pause?.kind).toBe('place');
    await page.getByTestId('walk-continue').click();
    await expect.poll(async () => (await state(page))?.walk?.pause ?? null).toBeNull();
  });

  test('D-103 : au gymnase, on s’entraîne à l’agilité', async ({ page }) => {
    await walkTo(page, 'gym');
    await expect(page.getByTestId('walk-enter')).toContainText('agilité');
    await page.getByTestId('walk-enter').click();
    await expect(page.getByTestId('contest-hud')).toContainText('Gymnase');
    expect((await state(page))?.contest?.run.kind).toBe('agility');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/j15-gymnase.png' });
    // La visite ouvre aussi le concours d'agilité (D-56).
    expect((await state(page))?.save.dogs[0]?.visited.gym).toBe(true);
  });
});
