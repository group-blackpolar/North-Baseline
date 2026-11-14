import { defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// `NORTH_DEV_API=http://localhost:4000 pnpm dev` points the dev server at a local CORECROW instead of production.
const api = process.env.NORTH_DEV_API ?? 'https://api.blackpolar.org'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: api, changeOrigin: true },
      '/api': { target: api, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // RM-071: stable vendor chunks keep the app chunk small and cache across releases.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules[\/](react|react-dom|scheduler)[\/]/.test(id)) return 'vendor-react'
          return undefined
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

