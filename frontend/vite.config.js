import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate', // auto-installs new SW versions, no manual refresh needed
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Hello Chat',
        short_name: 'HelloChat',
        description: 'Real-time messaging, voice notes, and calls.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 'display_override' gives a nicer app-like window on desktop
        // (Windows/macOS/Linux) PWA installs when supported.
        display_override: ['window-controls-overlay', 'standalone'],
        background_color: '#101820',
        theme_color: '#101820',
        orientation: 'portrait-primary',
        icons: [
          { src: '/pwa-icons/icon-64.png', sizes: '64x64', type: 'image/png' },
          { src: '/pwa-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-shell + static assets are precached for offline load.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Keep the service worker from trying to cache/intercept the API,
        // socket.io, or uploaded media - those must always hit the network.
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/socket\.io\//],
        runtimeCaching: [
          {
            // Uploaded chat media: cache-first once fetched, so images/voice
            // notes you've already opened still work offline.
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploaded-media',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // API calls: network-first with a short cache fallback so the
            // app can show last-known data if you briefly lose connection.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // avoid SW weirdness during `vite dev`; test PWA via `vite preview`
      },
    }),
  ],
})
