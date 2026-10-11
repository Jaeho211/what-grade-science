import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({ plugins: [react(), VitePWA({
  registerType: 'prompt',
  includeAssets: ['apple-touch-icon.png', 'icon.svg'],
  manifest: {
    id: '/', name: '몇 학년? 과학', short_name: '몇 학년? 과학', description: '10문제로 알아보는 나의 과학 나이',
    lang: 'ko', start_url: '/', scope: '/', display: 'standalone',
    theme_color: '#faf8f4', background_color: '#faf8f4',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg}'],
    
    cleanupOutdatedCaches: true,
  },
})] });
