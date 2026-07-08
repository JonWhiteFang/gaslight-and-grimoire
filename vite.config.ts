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
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          audio: ['howler'],
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
