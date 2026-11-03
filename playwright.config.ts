import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: ['compat.spec.ts', 'perf.spec.ts'],
      use: {
        ...devices['Pixel 7'],
        // Rendu GPU : sans lui, Chromium sans écran dessine en logiciel à ~12 images/s.
        launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] },
      },
    },
    // Jalon 7 : compatibilité. Un parcours court sur le moteur de Safari et sur Firefox.
    { name: 'safari-iphone', testMatch: /compat/ , use: { ...devices['iPhone 13'] } },
    { name: 'firefox', testMatch: 'compat.spec.ts', use: { ...devices['Desktop Firefox'], viewport: { width: 412, height: 860 } } },
    { name: 'chrome', testMatch: 'compat.spec.ts', use: { ...devices['Pixel 7'] } },
    // Mesures de PERF.md : à lancer seules (npm run perf), la machine ne doit rien faire d'autre.
    {
      name: 'perf',
      testMatch: 'perf.spec.ts',
      use: { ...devices['Pixel 7'], launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] } },
    },
  ],
});
