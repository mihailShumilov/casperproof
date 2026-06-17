# @casperproof/config

Shared tooling presets for the CasperProof monorepo so every package and app behaves
identically in CI and locally.

## Exports

| Import | Purpose |
|---|---|
| `@casperproof/config/tsconfig.base.json` | Strict TypeScript base (extended by each package's `tsconfig.json`). |
| `@casperproof/config/eslint` | Flat ESLint config (JS + `typescript-eslint` + Prettier compat). |
| `@casperproof/config/prettier` | Prettier options. |
| `@casperproof/config/vitest` | `definePackageConfig()` + `coverageThresholds` enforcing the **>90%** gate (§16). |

## Usage

`tsconfig.json`:

```json
{ "extends": "@casperproof/config/tsconfig.base.json", "include": ["src"] }
```

`vitest.config.ts`:

```ts
import { definePackageConfig } from '@casperproof/config/vitest';
export default definePackageConfig();
```
