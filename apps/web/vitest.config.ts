/**
 * Vitest config for the CasperProof dApp.
 *
 * jsdom + the React plugin so component and hook tests run headlessly. Tests
 * live next to the code under `src/**`. Coverage is collected but not gated
 * here — the heavy demo flow is exercised by Playwright in `e2e/`, so the unit
 * suite focuses on pure helpers and the wallet reducer.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/*.d.ts'],
    },
  },
});
