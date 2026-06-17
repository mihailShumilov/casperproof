import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the marketing site.
 *
 * Covers the pure content + formatting helpers (node environment, no DOM
 * needed). Component rendering is exercised by the shared `@casperproof/ui`
 * package's own suite; here we only test the site's own logic.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
  },
});
