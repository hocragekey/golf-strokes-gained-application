import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Optional: proxy /api to a deployed environment, e.g. https://d179dqlepdzlfu.cloudfront.net.
const apiTarget = process.env.VITE_API_PROXY_TARGET;

// Public, non-secret app configuration shared with the deploy workflow.
const appConfig = JSON.parse(
  readFileSync(new URL('../../config/app.json', import.meta.url), 'utf8'),
) as { googleClientId?: string };
const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID ?? appConfig.googleClientId ?? '';

// Set VITE_BASE when hosting under a sub-path, e.g. GitHub Pages project sites.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Golf Strokes Gained',
        short_name: 'Strokes Gained',
        description: 'Turn your scorecard into strokes-gained stats and practice priorities.',
        theme_color: '#14532d',
        background_color: '#f4f6f3',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: { conditions: ['@golf-sg/source'] },
  server: {
    port: 5173,
    proxy: apiTarget ? { '/api': { target: apiTarget, changeOrigin: true } } : undefined,
  },
  build: { sourcemap: true, target: 'es2022' },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
