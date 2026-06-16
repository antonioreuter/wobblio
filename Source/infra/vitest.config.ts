import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // CDK synth + template assertions are heavier than pure-logic units.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
