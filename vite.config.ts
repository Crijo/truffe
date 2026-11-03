import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    environment: 'node',
  },
});
