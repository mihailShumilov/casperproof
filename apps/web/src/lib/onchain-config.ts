/**
 * Browser-side config for live on-chain writes: are they enabled, and the {@link OnchainContext}
 * (chain + deployed package hashes) needed to build a transaction.
 *
 * Sourced from `NEXT_PUBLIC_*` env vars (Next inlines these at build time). Live writes require
 * both a CSPR.click app id and at least the registry package hash; otherwise the dApp stays on the
 * zero-secret mock path. `env` is injectable so resolution is unit-tested without the build env.
 */
import type { OnchainContract } from '@casperproof/casper-sdk';
import type { OnchainContext } from './onchain-tx.js';

type Env = Record<string, string | undefined>;

function defaultEnv(): Env {
  return (globalThis as { process?: { env?: Env } }).process?.env ?? {};
}

/** Live writes are enabled when a CSPR.click app id and the registry package hash are configured. */
export function liveWritesEnabled(env: Env = defaultEnv()): boolean {
  return Boolean(env.NEXT_PUBLIC_CSPR_CLICK_APP_ID && env.NEXT_PUBLIC_ATTESTATION_REGISTRY_HASH);
}

/** Build the {@link OnchainContext} for an active account from the public env config. */
export function onchainContextFor(publicKeyHex: string, env: Env = defaultEnv()): OnchainContext {
  const packageHashes: Partial<Record<OnchainContract, string>> = {};
  if (env.NEXT_PUBLIC_ATTESTATION_REGISTRY_HASH)
    packageHashes.registry = env.NEXT_PUBLIC_ATTESTATION_REGISTRY_HASH;
  if (env.NEXT_PUBLIC_INSURANCE_HASH) packageHashes.insurance = env.NEXT_PUBLIC_INSURANCE_HASH;
  if (env.NEXT_PUBLIC_STAKE_TOKEN_HASH) packageHashes.stakeToken = env.NEXT_PUBLIC_STAKE_TOKEN_HASH;
  if (env.NEXT_PUBLIC_USDC_TOKEN_HASH) packageHashes.usdcToken = env.NEXT_PUBLIC_USDC_TOKEN_HASH;
  return {
    senderPublicKeyHex: publicKeyHex,
    chainName: env.NEXT_PUBLIC_CASPER_CHAIN_NAME ?? 'casper-test',
    packageHashes,
  };
}
