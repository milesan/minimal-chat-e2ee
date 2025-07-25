import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: './client',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 3033,
    proxy: {
      '/api': {
        target: 'http://localhost:3035',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3035',
        ws: true
      }
    }
  }
});