import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { build: { externalizeDeps: false } },
  preload: {
    build: {
      externalizeDeps: false,
      // Sandboxed Electron preloads cannot execute ESM imports.
      lib: { formats: ['cjs'] },
    },
  },
  renderer: { plugins: [react()] },
});
