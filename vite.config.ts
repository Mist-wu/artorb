/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { artorbSite } from './scripts/site-plugin.ts';

export default defineConfig({
  plugins: [react(), tailwindcss(), artorbSite()],
  server: { port: 8797 },
  preview: { port: 8799 },
  build: {
    outDir: 'dist',
    rolldownOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        credits: resolve(import.meta.dirname, 'credits.html'),
      },
      output: {
        // Long-lived vendor chunks; the app chunk changes most often.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/ },
          ],
        },
      },
    },
    // three.js alone is ~520 kB minified.
    chunkSizeWarningLimit: 600,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
