import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@mocs/core': path.resolve(import.meta.dirname, './src/renderer/core'),
      '@mocs/geometry': path.resolve(import.meta.dirname, './src/renderer/geometry'),
      '@mocs/scene': path.resolve(import.meta.dirname, './src/renderer/scene'),
      '@mocs/render-contract': path.resolve(import.meta.dirname, './src/renderer/render-contract'),
      '@mocs/renderer-molstar': path.resolve(import.meta.dirname, './src/renderer/renderer-molstar'),
      '@mocs/evidence': path.resolve(import.meta.dirname, './src/renderer/evidence'),
      '@mocs/conformance': path.resolve(import.meta.dirname, './src/renderer/conformance'),
      '@mocs/loading': path.resolve(import.meta.dirname, './src/renderer/loading'),
      '@mocs/fixtures': path.resolve(import.meta.dirname, './src/renderer/fixtures'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
})
