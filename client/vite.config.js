import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/feed/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'feed-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              }
            }
          },
          {
            urlPattern: /\/api\/users\/profile/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'user-profile-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /^https:\/\/gmu-badminton-api\.onrender\.com\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Mason Badminton Connect',
        short_name: 'Mason Badminton',
        description: 'A student-run community platform for George Mason University badminton players. Connect, rank up, and hit the courts.',
        theme_color: '#006633',
        background_color: '#02120a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.test.{js,jsx}']
  }
})
