import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/redux-devtools.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  tsconfig: 'tsconfig.tsup.json',
});
