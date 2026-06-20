import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8765,
    proxy: {
      '/api': {
        target: 'http://localhost:19260',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@monaco-editor/react'],
  },
})
