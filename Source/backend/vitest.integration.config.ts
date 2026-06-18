import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/tests/integration/**/*.test.ts'],
    setupFiles: ['src/tests/integration/loadLocalEnv.ts'],
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@handlers': path.resolve(__dirname, 'src/handlers'),
    },
  },
});
