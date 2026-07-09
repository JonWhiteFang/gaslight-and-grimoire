import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/gaslight-and-grimoire/',
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendor libs into their own chunks so they cache
        // independently of app code and don't bloat the entry chunk (F-043).
        // Vite 8 bundles with Rolldown, which only supports the function form
        // of manualChunks (the object form was dropped) — map each vendor's
        // node_modules path to a named chunk.
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react';
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) {
            return 'motion';
          }
          if (id.includes('node_modules/howler')) {
            return 'audio';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
