import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10000,
    include: ['server/__tests__/**/*.test.ts'],
    setupFiles: ['server/__tests__/test-setup.ts'],
  },
});
