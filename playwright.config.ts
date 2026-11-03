import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
});
