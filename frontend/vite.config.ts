import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // 💡 Quitamos el 'rewrite' para que la URL le llegue completa (/api/v1/...) a FastAPI
      },
    },
  },
})