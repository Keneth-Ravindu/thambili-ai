import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The backend whitelists http://localhost:5173 for CORS, so keep this port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
