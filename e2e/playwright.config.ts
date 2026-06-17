/**
 * Playwright configuration for the CasperProof end-to-end suite.
 *
 * The suite drives the dApp (`@casperproof/web`) which runs fully offline against
 * the SDK mock backend — no secrets, no network. `webServer` builds the app and
 * serves the production build on :29300 so the same config runs locally and in CI.
 *
 * Browser binaries are downloaded with:
 *   pnpm --filter @casperproof/e2e exec playwright install chromium
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 29300;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  // Each spec drives a stateful, in-memory mock store; keep specs isolated.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The mock store is per page-session, so a worker can safely run specs serially.
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Build then serve the production build. `reuseExistingServer` lets a dev
    // run reuse an already-running `next start` on :29300.
    command: 'pnpm --filter @casperproof/web build && pnpm --filter @casperproof/web start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // A cold production build can take a while in CI.
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
