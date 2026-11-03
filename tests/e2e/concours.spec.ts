import { expect, test, type Page } from '@playwright/test';
import { fresh } from './helpers';

const save = (page: Page) => page.evaluate(() => window.__truffe?.store.getState().save);
const contest = (page: Page) => page.evaluate(() => window.__truffe?.store.getState().contest ?? null);

/** Prépare le chiot : lieux visités, deux tours appris, beaucoup de pièces, des points de maître. */
async function prepare(page: Page, extra: { points?: number } = {}): Promise<void> {
  await page.evaluate((extra) => {
    const t = window.__truffe;
    if (!t) return;
    const s = t.store.getState();
    const trick = (id: 'sit' | 'down') => ({ trickId: id, repetitions: 5, learned: true, mastery: 1, command: { label: id === 'sit' ? 'Assis' : 'Couché' } });
    t.store.replaceForDebug({
      ...s,
      save: {
        ...s.save,
        coins: 20_000,
        masterPoints: extra.points ?? s.save.masterPoints,
        dogs: s.save.dogs.map((d) => ({ ...d, affection: 100, visited: { park: true, gym: true, market: true }, tricks: [trick('sit'), trick('down')] })),
      },
    });
  }, extra);
}

async function openContest(page: Page, id: 'disc' | 'agility' | 'obedience'): Promise<void> {
  await page.getByTestId('out').click();
  await page.getByTestId('out-contests').click();
  await page.getByTestId(`enter-${id}`).click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'contest');
}

async function finishAndBack(page: Page, name: string): Promise<void> {
  await expect(page.getByTestId('contest-result')).toBeVisible({ timeout: 130_000 });
  await page.screenshot({ path: `test-results/concours-${name}-resultat.png` });
  await page.getByTestId('contest-back').click();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'living');
  expect(await contest(page)).toBeNull();
}

test.describe('Jalon 6 : concours et progression', () => {
  test('F-CON-7 : sans visite ni tour appris, l’inscription est refusée avec une phrase', async ({ page }) => {
    await fresh(page);
    await page.getByTestId('out').click();
    await page.getByTestId('out-contests').click();
    await expect(page.getByTestId('refusal-disc')).toContainText('parc');
    await expect(page.getByTestId('refusal-agility')).toContainText('gymnase');
    await expect(page.getByTestId('refusal-obedience')).toContainText('tour');
    await page.screenshot({ path: 'test-results/concours-0-refus.png' });
  });

  test('F-CON-3 : obéissance aux boutons, jusqu’au classement', async ({ page }) => {
    test.setTimeout(90_000);
    await fresh(page);
    await prepare(page);
    await openContest(page, 'obedience');
    await page.screenshot({ path: 'test-results/concours-3-obeissance.png' });
    for (let i = 0; i < 40; i++) {
      const c = await contest(page);
      if (!c || c.result) break;
      if (c.run.kind === 'obedience' && !c.run.waiting) await page.getByTestId(`contest-order-${c.run.orders[c.run.index]}`).click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByTestId('contest-place')).toBeVisible();
    const s = await save(page);
    expect(s?.day.perDog[s.dogs[0]?.id ?? '']?.prizeContests).toBe(1);
    await finishAndBack(page, 'obeissance');
  });

  test('F-CON-1 : disque, lancé d’un geste du doigt vers le haut', async ({ page }) => {
    test.setTimeout(120_000);
    await fresh(page);
    await prepare(page);
    await openContest(page, 'disc');
    const w = page.viewportSize()?.width ?? 400;
    const h = page.viewportSize()?.height ?? 800;
    let shot = false;
    for (let i = 0; i < 200; i++) {
      const c = await contest(page);
      if (!c || c.result) break;
      if (c.run.kind === 'disc' && c.run.disc.state === 'hand') {
        // Geste doux vers le haut : ≈ 0,5 px/ms.
        await page.mouse.move(w / 2, h * 0.8);
        await page.mouse.down();
        for (let k = 1; k <= 5; k++) {
          await page.mouse.move(w / 2, h * 0.8 - k * 12);
          await page.waitForTimeout(20);
        }
        await page.mouse.up();
      } else if (!shot && c.run.kind === 'disc' && c.run.disc.state === 'flying') {
        shot = true;
        await page.screenshot({ path: 'test-results/concours-1-disque.png' });
      }
      await page.waitForTimeout(300);
    }
    const c = await contest(page);
    expect(c?.run.kind === 'disc' ? c.run.throws : 0).toBeGreaterThan(3);
    expect(c?.run.kind === 'disc' ? c.run.catches.filter((x) => x.air).length : 0).toBeGreaterThan(0);
    await finishAndBack(page, 'disque');
  });

  test('F-CON-2 : agilité, le chiot suit le doigt d’obstacle en obstacle', async ({ page }) => {
    test.setTimeout(150_000);
    await fresh(page);
    await prepare(page);
    await openContest(page, 'agility');
    await page.mouse.move(200, 600);
    await page.mouse.down();
    let shot = 0;
    for (let i = 0; i < 1500; i++) {
      const target = await page.evaluate(() => {
        const t = window.__truffe;
        const c = t?.store.getState().contest;
        if (!t?.fieldToScreen || !c || c.result || c.run.kind !== 'agility') return null;
        const p = c.run.course[c.run.next]?.points[c.run.sub];
        return p ? { ...t.fieldToScreen(p), next: c.run.next } : null;
      });
      if (!target) break;
      await page.mouse.move(target.x, target.y, { steps: 2 });
      if (target.next >= 3 && shot === 0) {
        shot = 1;
        await page.screenshot({ path: 'test-results/concours-2-agilite.png' });
      }
      await page.waitForTimeout(60);
    }
    await page.mouse.up();
    const c = await contest(page);
    expect(c?.result).not.toBeNull();
    expect(c?.run.kind === 'agility' ? c.run.penalties : 99).toBe(0);
    await finishAndBack(page, 'agilite');
  });

  test('Plusieurs chiots : adopter au chenil, 3 à la maison à 60 i/s, la pension, la race n° 7', async ({ page }) => {
    test.setTimeout(150_000);
    await fresh(page);
    await prepare(page, { points: 2000 });
    const adopt = async (breed: string, name: string) => {
      await page.getByTestId('out').click();
      await page.getByTestId('out-kennel').click();
      const kennel = page.getByTestId('kennel');
      await expect(kennel).toBeVisible();
      await kennel.getByRole('button', { name: breed }).click();
      await kennel.locator('.k-pup').nth(0).click();
      await page.getByTestId('choose').click();
      await page.getByTestId('name-input').fill(name);
      await page.getByTestId('adopt').click();
      await expect(page.locator('body')).toHaveAttribute('data-mode', 'living');
    };
    // 2 000 points : la race n° 7 est au chenil.
    await page.getByTestId('out').click();
    await page.getByTestId('out-kennel').click();
    await expect(page.getByTestId('kennel').getByRole('button', { name: 'Husky' })).toBeVisible();
    await page.getByTestId('kennel-exit').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'living');

    await adopt('Husky', 'Neige');
    await adopt('Carlin', 'Bouchon');
    expect((await save(page))?.homeDogIds).toHaveLength(3);
    await page.waitForTimeout(6000);
    const fps = await page.evaluate(() => window.__truffe?.fps() ?? 0);
    await page.screenshot({ path: 'test-results/famille-1-trois-chiots.png' });
    expect(fps).toBeGreaterThanOrEqual(55);

    // Un 4e chiot va à la pension ; on l'échange avec un chiot de la maison.
    await adopt('Teckel', 'Galopin');
    let s = await save(page);
    expect(s?.dogs).toHaveLength(4);
    expect(s?.homeDogIds).toHaveLength(3);
    const boarder = s?.dogs.find((d) => !s?.homeDogIds.includes(d.id))?.id ?? '';
    const leaving = s?.homeDogIds[1] ?? '';
    await page.getByTestId('out').click();
    await page.getByTestId('out-family').click();
    await page.getByTestId(`move-${boarder}`).click();
    await expect(page.getByRole('status').filter({ hasText: '3 chiots' })).toBeVisible();
    await page.getByTestId(`move-${leaving}`).click();
    await page.getByTestId(`move-${boarder}`).click();
    await page.screenshot({ path: 'test-results/famille-2-pension.png' });
    s = await save(page);
    expect(s?.homeDogIds).toContain(boarder);
    expect(s?.homeDogIds).not.toContain(leaving);
    await page.getByTestId('panel-close').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/famille-3-apres-echange.png' });
  });

  test('Déblocages : décor « Bord de mer » à 6 000 points', async ({ page }) => {
    await fresh(page);
    await prepare(page, { points: 6000 });
    await page.getByTestId('out').click();
    await page.getByTestId('out-family').click();
    await expect(page.getByTestId('decor-space')).toBeDisabled();
    await page.getByTestId('decor-seaside').click();
    await page.getByTestId('panel-close').click();
    expect((await save(page))?.settings.decor).toBe('seaside');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/decor-bord-de-mer.png' });
  });
});
