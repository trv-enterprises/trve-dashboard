import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      // Fix Carbon's ~@ibm/plex webpack-style imports for Vite
      '~@ibm/plex': path.resolve(__dirname, 'node_modules/@ibm/plex')
    }
  },
  server: {
    host: '0.0.0.0',  // Listen on all interfaces for Tailscale access
    port: 5173
  }
})
