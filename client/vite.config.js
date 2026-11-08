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
        importScripts: ['/sw-push.js'],
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
            urlPattern: /\/api\/tournaments/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tournaments-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /\/api\/courts/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'courts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 12 * 60 * 60
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
  build: {
    modulePreload: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Split long-lived libraries every page needs at startup into their own
          // chunks, so they stay cached when app code changes. MUI is NOT grouped:
          // a single MUI chunk would pull components only lazy pages use into the
          // first download.
          groups: [
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
              priority: 20,
            },
            {
              name: 'realtime-vendor',
              test: /[\\/]node_modules[\\/](socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.test.{js,jsx}'],
    testTimeout: 20000
  },
  server: {
    proxy: {
      '/api/v1/tournaments': {
        target: 'http://localhost:8081',
        changeOrigin: true
      }
    }
  }
})
