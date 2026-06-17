import { definePackageConfig } from '@casperproof/config/vitest';

export default definePackageConfig({
  coverage: {
    // gen-golden is a dev script exercised by the parity test, not a runtime export.
    exclude: ['src/gen-golden.ts', 'src/**/*.test.ts', 'src/index.ts', 'src/types.ts'],
  },
});
