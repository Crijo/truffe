import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// `--mode https` : certificat local, pour que le micro marche sur un téléphone du réseau local.
// `--mode app` (D-100) : le jeu pour l'appli Android, dans dist-app, sans service worker (l'appli a ses propres mises à jour).
export default defineConfig(({ mode }) => ({
  base: './',
  build: mode === 'app' ? { outDir: 'dist-app' } : {},
  define: { __TRUFFE_VERSION__: JSON.stringify(process.env.TRUFFE_VERSION ?? 'dev') },
  plugins: [
    ...(mode === 'https' ? [basicSsl()] : []),
    // Jalon 7 : installable, et jouable sans réseau une fois chargé (tout est mis en cache).
    ...(mode === 'app' ? [] : [VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Truffe',
        short_name: 'Truffe',
        description: 'Un chiot virtuel qui se souvient de toi.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6e7d0',
        theme_color: '#f6e7d0',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest}'],
        navigateFallback: 'index.html',
        // Le premier chargement est aussitôt servi par le cache : hors ligne dès la visite suivante.
        clientsClaim: true,
        skipWaiting: true,
      },
    })]),
  ],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    environment: 'node',
  },
}));
