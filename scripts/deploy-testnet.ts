/**
 * Deploy the CasperProof contracts to Casper Testnet — or, when no testnet secrets are
 * present, run a deterministic **mock deploy** that writes placeholder package hashes to
 * `.env.local` so the rest of the stack (dApp, agents, x402) boots end-to-end locally.
 *
 * Live deploys are performed by the Odra **livenet** binary (`contracts/bin/livenet.rs`,
 * `--features livenet`), which uses Odra's native deploy machinery (signing, submission,
 * package-hash capture) — the same `Deployer`/`HostRef` API the MockVM tests use. This script
 * spawns that binary, maps the env vars Odra's livenet env expects, and parses the
 * `CP_RESULT <KEY>=<VALUE>` lines it prints into `.env.local`.
 *
 * Real deploy requires:
 *   - CASPER_SECRET_KEY_PATH  (PEM secret key for the funded deploy account)
 *   - CSPR_CLOUD_TOKEN        (CSPR.cloud access token)
 *   - cargo + the nightly toolchain (present in docker/Dockerfile.contracts and on the VPS)
 *
 * Useful env knobs:
 *   - CP_FORCE_MOCK=true       → always mock, even with secrets present
 *   - CP_DRY_RUN=true          → print the exact cargo command + env, do not execute
 *   - CP_LIVENET_STEP=deploy   → install the 4 contracts only (skip the demo arc); default `all`
 *
 * Run: `pnpm deploy:testnet` or `make deploy-testnet`.
 */
import { spawnSync } from 'node:child_process';
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
/** Demo transactions whose deploy hashes become the cspr.live links (live runs). */
const DEMO_STEPS = ['submit_attestation', 'claim', 'resolve'] as const;

function hasTestnetSecrets(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.CASPER_SECRET_KEY_PATH && env.CSPR_CLOUD_TOKEN);
}

function isTrue(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

/** Deterministic placeholder package hash for mock mode (stable across runs). */
function mockPackageHash(name: string, network: string): string {
  const digest = blake2b256(new TextEncoder().encode(`casperproof:${network}:${name}`));
  return `hash-${toHex(digest)}`;
}

/**
 * Map CasperProof's env vars onto the `ODRA_CASPER_LIVENET_*` vars Odra's livenet env reads.
 * Explicit `ODRA_CASPER_LIVENET_*` values always win; otherwise we derive sane defaults from
 * the existing Casper / CSPR.cloud config so a normal `.env` "just works".
 */
function livenetEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const chain = env.CASPER_NETWORK_NAME ?? 'casper-test';
  // CSPR.cloud's node proxy is the recommended Odra livenet RPC endpoint.
  const node =
    env.ODRA_CASPER_LIVENET_NODE_ADDRESS ??
    (chain === 'casper' ? 'https://node.cspr.cloud' : 'https://node.testnet.cspr.cloud');
  const out: Record<string, string> = {
    ODRA_CASPER_LIVENET_SECRET_KEY_PATH:
      env.ODRA_CASPER_LIVENET_SECRET_KEY_PATH ?? env.CASPER_SECRET_KEY_PATH ?? '',
    ODRA_CASPER_LIVENET_NODE_ADDRESS: node,
    ODRA_CASPER_LIVENET_CHAIN_NAME: env.ODRA_CASPER_LIVENET_CHAIN_NAME ?? chain,
    ODRA_CASPER_LIVENET_EVENTS_URL:
      env.ODRA_CASPER_LIVENET_EVENTS_URL ?? `${node.replace(/\/$/, '')}/events`,
  };
  if (env.CSPR_CLOUD_TOKEN) out.CSPR_CLOUD_AUTH_TOKEN = env.CSPR_CLOUD_TOKEN;
  return out;
}

/** Parse `CP_RESULT <KEY>=<VALUE>` lines emitted by the livenet binary. */
function parseResults(stdout: string): Record<string, string> {
  const results: Record<string, string> = {};
  for (const line of stdout.split('\n')) {
    const match = /^CP_RESULT\s+([A-Z0-9_]+)=(.+)$/.exec(line.trim());
    if (match) results[match[1]!] = match[2]!.trim();
  }
  return results;
}

/**
 * Best-effort: associate each `>>> CP_STEP <name>` banner with the next 64-hex deploy hash the
 * Odra livenet client logs, yielding the demo-tx → cspr.live links. The exact log format is
 * confirmed against live output on the deploy machine; missing hashes are reported, never faked.
 */
function parseDemoTxHashes(stdout: string): Partial<Record<(typeof DEMO_STEPS)[number], string>> {
  const txs: Record<string, string> = {};
  let current: string | undefined;
  for (const line of stdout.split('\n')) {
    const step = /CP_STEP\s+([a-z_]+)/.exec(line);
    if (step) {
      current = step[1];
      continue;
    }
    if (!current) continue;
    const hex = /\b([0-9a-fA-F]{64})\b/.exec(line);
    if (hex && !txs[current]) {
      txs[current] = hex[1]!.toLowerCase();
      current = undefined;
    }
  }
  return txs as Partial<Record<(typeof DEMO_STEPS)[number], string>>;
}

function writeEnvLocal(
  outPath: string,
  network: string,
  mode: 'mock' | 'live',
  addresses: Record<string, string>,
  txComments: string[] = [],
): void {
  const lines = [
    '# Written by scripts/deploy-testnet.ts',
    `# network=${network} mode=${mode}`,
    ...Object.entries(addresses).map(([k, v]) => `${k}=${v}`),
    ...txComments,
  ];
  writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
}

/** Run the Odra livenet deploy binary and return its captured stdout (throws on failure). */
function runLivenet(env: NodeJS.ProcessEnv, contractsDir: string): string {
  const childEnv = { ...env, ...livenetEnv(env) };
  const args = ['run', '--bin', 'livenet', '--features', 'livenet'];

  if (isTrue(env.CP_DRY_RUN)) {
    console.log('  [dry-run] would execute (cwd=contracts):');
    console.log(`    cargo ${args.join(' ')}`);
    console.log('  [dry-run] with ODRA_CASPER_LIVENET_* env:');
    for (const [k, v] of Object.entries(livenetEnv(env))) {
      const shown = k.includes('TOKEN') || k.includes('SECRET') ? '<redacted>' : v;
      console.log(`    ${k}=${shown}`);
    }
    return '';
  }

  console.log('  Spawning Odra livenet deployer: cargo run --bin livenet --features livenet');
  const proc = spawnSync('cargo', args, {
    cwd: contractsDir,
    env: childEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (proc.error) {
    throw new Error(`failed to spawn cargo (is the Rust toolchain installed?): ${proc.error.message}`);
  }
  const stdout = proc.stdout ?? '';
  process.stdout.write(stdout);
  if (proc.status !== 0) {
    throw new Error(`livenet deploy exited with code ${proc.status}`);
  }
  return stdout;
}

async function main(): Promise<void> {
  const env = process.env;
  const network = env.CASPER_NETWORK_NAME ?? 'casper-test';
  const outPath = resolve(process.cwd(), '.env.local');
  const contractsDir = resolve(process.cwd(), 'contracts');
  const live = hasTestnetSecrets(env) && !isTrue(env.CP_FORCE_MOCK);
  const explorer = network === 'casper' ? 'https://cspr.live' : 'https://testnet.cspr.live';

  console.log(`\n▶ CasperProof deploy — network: ${network} — mode: ${live ? 'LIVE' : 'MOCK'}`);

  if (!live) {
    if (isTrue(env.CP_FORCE_MOCK)) console.log('  CP_FORCE_MOCK set → forcing mock deploy.');
    else console.log('  No testnet secrets found → mock deploy (deterministic placeholder hashes).');
    console.log('  Provide CASPER_SECRET_KEY_PATH + CSPR_CLOUD_TOKEN for a real deploy.');
    const addresses: Record<string, string> = {};
    for (const name of CONTRACTS) addresses[ENV_KEYS[name]] = mockPackageHash(name, network);
    writeEnvLocal(outPath, network, 'mock', addresses);
    console.log(`\n  Wrote ${CONTRACTS.length} package hashes to ${outPath}:`);
    for (const name of CONTRACTS) console.log(`    ${ENV_KEYS[name]} = ${addresses[ENV_KEYS[name]]}`);
    console.log('\n  ⚠ MOCK addresses — not on-chain. See docs/DEPLOYMENT.md to deploy for real.');
    console.log(existsSync(outPath) ? '\n✓ deploy step complete.\n' : '\n✗ failed to write .env.local\n');
    return;
  }

  // ── Live deploy via the Odra livenet binary ──────────────────────────────────
  const stdout = runLivenet(env, contractsDir);
  if (isTrue(env.CP_DRY_RUN)) {
    console.log('\n✓ dry-run complete (no deploy performed).\n');
    return;
  }

  const results = parseResults(stdout);
  const missing = CONTRACTS.filter((name) => !results[ENV_KEYS[name]]);
  if (missing.length > 0) {
    throw new Error(
      `livenet deploy did not report package hashes for: ${missing.join(', ')} — see output above`,
    );
  }

  const addresses: Record<string, string> = {};
  for (const name of CONTRACTS) addresses[ENV_KEYS[name]] = results[ENV_KEYS[name]]!;

  // Demo-tx → cspr.live links (best-effort; only when the full arc ran).
  const txHashes = parseDemoTxHashes(stdout);
  const txComments: string[] = [];
  for (const step of DEMO_STEPS) {
    const hash = txHashes[step];
    if (hash) txComments.push(`# TX ${step}=${hash}  ->  ${explorer}/deploy/${hash}`);
  }

  writeEnvLocal(outPath, network, 'live', addresses, txComments);

  console.log(`\n  Wrote ${CONTRACTS.length} real package hashes to ${outPath}:`);
  for (const name of CONTRACTS) console.log(`    ${ENV_KEYS[name]} = ${addresses[ENV_KEYS[name]]}`);
  if (txComments.length > 0) {
    console.log('\n  Demo transactions (record these as the cspr.live submission links):');
    for (const comment of txComments) console.log(`    ${comment.replace(/^# /, '')}`);
  } else {
    console.log(
      '\n  (No demo-tx hashes captured from logs — read them from the deployer account on',
    );
    console.log(`   ${explorer} or re-run with CP_LIVENET_STEP=all. Package hashes above are live.)`);
  }
  console.log('\n✓ live deploy complete.\n');
}

main().catch((err) => {
  console.error(`\n✗ deploy failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
