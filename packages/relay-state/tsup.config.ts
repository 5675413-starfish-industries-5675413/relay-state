import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'electron/main/index': 'src/electron/main/index.ts',
    'electron/preload/index': 'src/electron/preload/index.ts',
    'renderer/index': 'src/renderer/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['esm'],
  target: 'es2022',
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: true,
  outDir: 'dist',
  external: ['electron', 'react'],
});
