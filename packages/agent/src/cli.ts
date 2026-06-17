#!/usr/bin/env node
/**
 * CasperProof agent CLI — a headless entry point that runs one deterministic runtime cycle.
 *
 * Defaults to `LLM_BACKEND=none` (pure deterministic, no network) and the in-memory store so it
 * runs offline with no secrets. It scores a demo address, attests it on-chain (mock SDK by
 * default), then verifies the fresh attestation — the happy path of the demo flow.
 *
 * Run: `LLM_BACKEND=none node dist/cli.js [address]`
 */
import { createRuntime } from './runtime.js';

/** Run the demo cycle and return a structured summary (so it is unit-testable). */
export async function runCli(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
): Promise<{ attestationId: number; verified: boolean }> {
  // Default to the deterministic, offline backend unless the caller overrode it.
  const resolvedEnv = { ...env, LLM_BACKEND: env['LLM_BACKEND'] ?? 'none' };
  const address =
    argv[0] ?? 'account-hash-0000000000000000000000000000000000000000000000000000000000000abc';

  const runtime = createRuntime(resolvedEnv);

  const attestCycle = await runtime.runOnce({ address });
  const attestResult = attestCycle.result as { id: number; uri: string };

  const verifyCycle = await runtime.runOnce({ attestationId: attestResult.id });
  const verifyResult = verifyCycle.result as { valid: boolean };

  console.log(
    JSON.stringify(
      {
        backend: runtime.backend.kind,
        sdkMode: runtime.sdk.mode,
        store: runtime.store.backendKind,
        address,
        attestationId: attestResult.id,
        uri: attestResult.uri,
        verified: verifyResult.valid,
      },
      null,
      2,
    ),
  );

  return { attestationId: attestResult.id, verified: verifyResult.valid };
}

// Execute when run directly (not when imported by tests).
// `import.meta.url` ends with the invoked script path in the `node dist/cli.js` case.
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (invokedDirectly) {
  runCli().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
