import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/CRMP/' : '/',
  plugins: [
    react({
      // Disable fast refresh to fix Safari preamble issue in development
      // Re-enable for HMR in Chrome if needed
      fastRefresh: false,
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 3225,
    host: true,
    watch: {
      ignored: ['**/.bg-shell/**', '**/node_modules/**', '**/.git/**'],
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
})
