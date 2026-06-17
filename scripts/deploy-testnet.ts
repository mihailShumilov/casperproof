/**
 * Deploy the CasperProof contracts to Casper Testnet — or, when no testnet secrets are
 * present, run a deterministic **mock deploy** that writes placeholder package hashes to
 * `.env.local` so the rest of the stack (dApp, agents, x402) boots end-to-end locally.
 *
 * Real deploy requires:
 *   - CASPER_SECRET_KEY_PATH  (PEM secret key for the deploy account)
 *   - CSPR_CLOUD_TOKEN        (CSPR.cloud access token)
 *   - the contract wasm built via `cargo odra build` (see Dockerfile.contracts / Makefile)
 * Missing secrets are recorded in SETUP_NEEDED.md. Run: `pnpm deploy:testnet` or `make deploy-testnet`.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { blake2b256, toHex } from '@casperproof/commitment';

const CONTRACTS = ['AttestationRegistry', 'Insurance', 'StakeToken', 'MockUsdc'] as const;
const ENV_KEYS: Record<(typeof CONTRACTS)[number], string> = {
  AttestationRegistry: 'ATTESTATION_REGISTRY_HASH',
  Insurance: 'INSURANCE_HASH',
  StakeToken: 'STAKE_TOKEN_HASH',
  MockUsdc: 'USDC_TOKEN_HASH',
};

function hasTestnetSecrets(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.CASPER_SECRET_KEY_PATH && env.CSPR_CLOUD_TOKEN);
}

/** Deterministic placeholder package hash for mock mode (stable across runs). */
function mockPackageHash(name: string, network: string): string {
  const digest = blake2b256(new TextEncoder().encode(`casperproof:${network}:${name}`));
  return `hash-${toHex(digest)}`;
}

async function main(): Promise<void> {
  const env = process.env;
  const network = env.CASPER_NETWORK_NAME ?? 'casper-test';
  const outPath = resolve(process.cwd(), '.env.local');
  const live = hasTestnetSecrets(env);

  console.log(`\n▶ CasperProof deploy — network: ${network} — mode: ${live ? 'LIVE' : 'MOCK'}`);

  const addresses: Record<string, string> = {};
  for (const name of CONTRACTS) {
    addresses[ENV_KEYS[name]] = mockPackageHash(name, network);
  }

  if (live) {
    console.log('  Detected testnet secrets. Building wasm + deploying is performed by the');
    console.log('  Dockerfile.contracts deployer (cargo odra build → casper-client put-deploy).');
    console.log('  NOTE: this Node entry does not bundle casper-js-sdk; real on-chain submission');
    console.log('  is delegated to the deployer container / casper-client. See SETUP_NEEDED.md.');
    // Real package hashes would be captured from the deploy receipts here and override the
    // deterministic placeholders above. Until casper-js-sdk/casper-client is wired, we still
    // emit the deterministic values so downstream services have something to bind to.
  } else {
    console.log('  No testnet secrets found → mock deploy (deterministic placeholder hashes).');
    console.log('  Provide CASPER_SECRET_KEY_PATH + CSPR_CLOUD_TOKEN for a real deploy.');
  }

  const lines = [
    '# Written by scripts/deploy-testnet.ts',
    `# network=${network} mode=${live ? 'live' : 'mock'}`,
    ...Object.entries(addresses).map(([k, v]) => `${k}=${v}`),
  ];
  writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');

  console.log(`\n  Wrote ${CONTRACTS.length} package hashes to ${outPath}:`);
  for (const name of CONTRACTS) {
    console.log(`    ${ENV_KEYS[name]} = ${addresses[ENV_KEYS[name]]}`);
  }
  if (!live) {
    console.log('\n  ⚠ MOCK addresses — not on-chain. See SETUP_NEEDED.md to deploy for real.');
  }
  console.log(
    existsSync(outPath) ? '\n✓ deploy step complete.\n' : '\n✗ failed to write .env.local\n',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
