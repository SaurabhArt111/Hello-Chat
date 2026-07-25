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
      // injectManifest (instead of the default generateSW) lets us ship a
      // custom service worker (src/sw.js) that handles Web Push events -
      // needed to ring/notify for incoming and missed calls even when the
      // app isn't open. generateSW only supports precaching/runtime
      // caching, with no hook for custom push/notificationclick handlers.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      },
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
      devOptions: {
        enabled: false, // avoid SW weirdness during `vite dev`; test PWA via `vite preview`
      },
    }),
  ],
})
