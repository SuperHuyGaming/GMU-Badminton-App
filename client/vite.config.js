import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.jpg'],
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
            src: '/icon.jpg',
            sizes: '1024x1024',
            type: 'image/jpeg'
          },
          {
            src: '/icon.jpg',
            sizes: '1024x1024',
            type: 'image/jpeg',
            purpose: 'any maskable'
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
