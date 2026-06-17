/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { definePackageConfig } from '@casperproof/config/vitest';

export default definePackageConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.{test,spec}.{ts,tsx}'] },
  coverage: { include: ['src/**/*.{ts,tsx}'], exclude: ['src/**/*.test.*', 'src/index.ts', 'src/tokens.ts'] },
});
