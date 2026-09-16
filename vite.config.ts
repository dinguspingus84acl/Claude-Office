import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Pages: BASE_PATH=/ for grokbottech.com; /Claude-Office/ for the github.io project URL.
  base: process.env.BASE_PATH || './',
  server: {
    port: 3333,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3334',
        ws: true,
      },
    },
  },
})
