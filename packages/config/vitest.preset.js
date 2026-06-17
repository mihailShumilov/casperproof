// Shared Vitest preset enforcing the >90% line + branch coverage gate (§16).
import { defineConfig } from 'vitest/config';

export const coverageThresholds = {
  lines: 90,
  branches: 90,
  functions: 90,
  statements: 90,
};

/** Build a package vitest config with the shared coverage gate applied. */
export function definePackageConfig(overrides = {}) {
  const { coverage: coverageOverride, test: testOverride, ...rest } = overrides;
  return defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary', 'json', 'lcov'],
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.{test,spec}.ts', 'src/**/index.ts', 'src/**/types.ts', 'src/**/*.d.ts'],
        thresholds: coverageThresholds,
        ...coverageOverride,
      },
      ...testOverride,
    },
    ...rest,
  });
}

export default definePackageConfig;
