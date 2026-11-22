import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const apiTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  cacheDir: '.vite-cache',
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src')
    }
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-router')) return 'router'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify') || id.includes('canvg') || id.includes('fflate')) return 'pdf'
          if (id.includes('node_modules/bootstrap')) return 'bootstrap'
          return 'vendor'
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        ws: true
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
})
