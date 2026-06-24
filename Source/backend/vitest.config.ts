import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      exclude: ['src/core/ports/**', 'src/core/domain/billing.ts'],
      thresholds: { lines: 99, functions: 100, branches: 99, statements: 99 },
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
