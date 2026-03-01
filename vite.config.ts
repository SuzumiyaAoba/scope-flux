import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@scope-flux/core': r('./packages/core/src/index.ts'),
      '@scope-flux/serializer': r('./packages/serializer/src/index.ts'),
      '@scope-flux/react': r('./packages/react/src/index.tsx'),
      '@scope-flux/scheduler': r('./packages/scheduler/src/index.ts'),
      '@scope-flux/inspect': r('./packages/inspect/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
