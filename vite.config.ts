import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@suzumiyaaoba/scope-flux-core': r('./packages/core/src/index.ts'),
      '@suzumiyaaoba/scope-flux-serializer': r('./packages/serializer/src/index.ts'),
      '@suzumiyaaoba/scope-flux-react': r('./packages/react/src/index.tsx'),
      '@suzumiyaaoba/scope-flux-scheduler': r('./packages/scheduler/src/index.ts'),
      '@suzumiyaaoba/scope-flux-inspect': r('./packages/inspect/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', '**/run.ts'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 90,
        branches: 80,
      },
    },
  },
});
