import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the marketing site.
 *
 * Covers the pure content + formatting helpers plus a static-render check of
 * the data-driven sections. No DOM is needed: component tests render to a
 * static HTML string via `react-dom/server`, so the node environment suffices
 * (no jsdom / extra deps). The `esbuild.jsx` override transforms our `.tsx`
 * sources (the app's tsconfig keeps `jsx: preserve` for Next).
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'lib/**/*.{test,spec}.{ts,tsx}',
      'components/**/*.{test,spec}.{ts,tsx}',
      'test/**/*.{test,spec}.{ts,tsx}',
    ],
  },
});
