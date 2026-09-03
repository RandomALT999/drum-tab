import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/drum-tab/';

const sha = ((): string => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();
const BUILD = `${sha} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

export default defineConfig({
  base: BASE,
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' meant a fix only reached the phone if the update toast was
      // both seen and tapped — and iOS keeps a Home Screen app alive for days,
      // so it often was not. Two rounds of status-bar fixes sat undelivered
      // behind it. autoUpdate lets the new worker claim the page on its own.
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon-bone.png', 'favicon-bone.svg'],
      workbox: {
        // Fonts are large and immutable; make sure they land in the precache so
        // noteheads never fall back to tofu when offline. The kit's mp3s and
        // its manifest belong here for the same reason — an installed app that
        // has to reach the network to make a sound is not much use on a train.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ttf,mp3,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        // Icon filenames carry the variant. iOS reads the icon once, at Add to
        // Home Screen, and both Safari's HTTP cache and the installed service
        // worker will happily serve the previous bytes from the same URL — so a
        // new icon needs a new name, not just new content.
        id: BASE,
        name: 'Drum Tab',
        short_name: 'Drum Tab',
        description:
          'Write, hear and perform drum grooves in real five-line drum notation.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0d0d10',
        theme_color: '#0d0d10',
        categories: ['music', 'productivity'],
        icons: [
          { src: 'icon-bone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-bone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-bone-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
