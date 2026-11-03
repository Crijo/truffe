import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * Jalon 7 : mesures de performance (SPEC, Performance et compatibilité), notées dans PERF.md.
 * Téléphone de milieu de gamme 2022 approché par un processeur ralenti 4 fois ;
 * « 4G » : profil « Slow 4G » des outils de Chrome (1,6 Mbit/s, 150 ms d'aller-retour).
 */
const OUT = 'test-results/perf.json';
const record = (key: string, value: unknown): void => {
  mkdirSync('test-results', { recursive: true });
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, unknown>;
  } catch {
    all = {};
  }
  writeFileSync(OUT, JSON.stringify({ ...all, [key]: value }, null, 2));
};

async function throttle(page: Page, cpu: number, network: boolean): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (network) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  }
}

/** Images par seconde, seconde par seconde, pendant `seconds`. */
function sampleFps(page: Page, seconds: number): Promise<number[]> {
  return page.evaluate(
    (seconds) =>
      new Promise<number[]>((done) => {
        const out: number[] = [];
        let frames = 0;
        let t0 = performance.now();
        const tick = (t: number): void => {
          frames++;
          if (t - t0 >= 1000) {
            out.push(Math.round((frames * 1000) / (t - t0)));
            frames = 0;
            t0 = t;
          }
          if (out.length < seconds) requestAnimationFrame(tick);
          else done(out);
        };
        requestAnimationFrame(tick);
      }),
    seconds,
  );
}

async function threeDogs(page: Page): Promise<void> {
  await page.goto('/?debug&adopt=beagle');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => {
    const t = window.__truffe;
    if (!t) return;
    const s = t.store.getState();
    t.store.replaceForDebug({ ...s, save: { ...s.save, coins: 10_000 } });
    for (const breed of ['labrador', 'carlin']) {
      t.store.dispatch({ type: 'kennel/open', breedId: breed });
      t.store.dispatch({ type: 'adopt', index: 0, name: breed === 'carlin' ? 'Bouchon' : 'Moka', now: Date.now(), tzOffsetMin: new Date().getTimezoneOffset() });
    }
  });
  await page.waitForTimeout(3000);
}

test.describe('Jalon 7 : performance', () => {
  test('premier affichage en 4G et poids initial', async ({ page }) => {
    await throttle(page, 4, true);
    const t0 = Date.now();
    await page.goto('/');
    await expect(page.getByTestId('kennel')).toBeVisible({ timeout: 30_000 });
    const ready = Date.now() - t0;
    const m = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
      const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const bytes = res.reduce((a, r) => a + r.transferSize, 0) + (nav?.transferSize ?? 0);
      return { fcp, bytes };
    });
    record('premierAffichage', { fcpMs: Math.round(m.fcp ?? -1), chenilAfficheMs: ready, poidsTransfereKo: Math.round(m.bytes / 1024) });
    expect(ready).toBeLessThan(3000);
    expect(m.bytes).toBeLessThan(2 * 1024 * 1024);
  });

  test('3 chiots : images par seconde, processeur normal et ralenti 4 fois', async ({ page }) => {
    test.setTimeout(90_000);
    await threeDogs(page);
    const normal = await sampleFps(page, 6);
    await throttle(page, 4, false);
    await page.waitForTimeout(1000);
    const slow = await sampleFps(page, 8);
    record('troisChiots', { normal, ralenti4x: slow, minRalenti: Math.min(...slow), moyenneRalenti: Math.round(slow.reduce((a, b) => a + b, 0) / slow.length) });
    expect(Math.min(...slow)).toBeGreaterThanOrEqual(30);
  });
});
