/**
 * Root convenience wrapper that regenerates the commitment golden vectors
 * (`packages/commitment/golden-vectors.json`). The TypeScript implementation is the
 * generator; the Rust `commitment.rs` test asserts parity against the same file.
 * Run: `pnpm gen:golden`.
 */
import { execSync } from 'node:child_process';

execSync('pnpm --filter @casperproof/commitment gen:golden', { stdio: 'inherit' });
