import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the project at https://<user>.github.io/archive-tracer/
// Override with BASE_PATH (e.g. "/") for a custom domain or local preview.
const base = process.env.BASE_PATH ?? '/archive-tracer/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'archive-tracer – Spuren in Archiven finden',
        short_name: 'archive-tracer',
        description:
          'Dokumente zu Personen aus der Zeit des Zweiten Weltkriegs und der Shoah über mehrere Archive hinweg finden.',
        lang: 'de',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#faf8f5',
        theme_color: '#3b3a36',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Only the app shell is cached. Archive API responses are never cached
        // by the service worker (NARA terms, freshness, privacy).
        globPatterns: ['**/*.{js,css,html,svg}'],
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
