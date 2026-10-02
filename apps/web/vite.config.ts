import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API base URL is injected at build time via VITE_API_BASE_URL.
// In dev we proxy /api to the local Hono server so the browser sees a
// same-origin request and CORS is never involved.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('three-stdlib') || id.includes('meshline')) {
            return 'three-stdlib';
          }

          if (id.includes('@react-three/drei')) {
            return 'three-drei';
          }

          if (id.includes('@react-three/fiber')) {
            return 'three-fiber';
          }

          if (id.includes('three')) {
            return 'three-core';
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
