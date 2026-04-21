import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const PWA_CACHE_VERSION = 'v4'
const APP_SHELL_CACHE_NAME = `app-shell-${PWA_CACHE_VERSION}`
const BIBLE_DATA_CACHE_NAME = `bible-data-${PWA_CACHE_VERSION}`

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: '多譯本聖經關鍵字查詢',
        short_name: '聖經快搜',
        description: '以 JSON 為核心、可安裝到手機與電腦的多譯本聖經關鍵字查詢 App。',
        theme_color: '#0f172a',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        cacheId: `quick-bibles-earch-${PWA_CACHE_VERSION}`,
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: APP_SHELL_CACHE_NAME,
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: BIBLE_DATA_CACHE_NAME,
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 4176,
    strictPort: true
  },
  preview: {
    host: '0.0.0.0',
    port: 4176,
    strictPort: true
  },
  worker: {
    format: 'es'
  }
})
