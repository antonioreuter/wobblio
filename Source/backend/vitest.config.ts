import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@handlers': path.resolve(__dirname, 'src/handlers'),
    },
  },
});
