import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      external: (id) =>
        id.startsWith('/config.js') ||
        id.startsWith('/js/cp-error-reporter.js') ||
        id.startsWith('/js/cp-api.js'),
    },
  },
})
