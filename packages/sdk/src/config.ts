/**
 * Configuration resolution for `@casperproof/casper-sdk`.
 *
 * Merges explicit {@link CasperProofConfig} overrides with environment variables (defaulting
 * to `process.env`) and documented local fallbacks. The resulting {@link ResolvedConfig} is
 * fully populated so the backends never have to re-read the environment.
 *
 * Mode selection follows the casper-stack rule: **`CSPR_CLOUD_TOKEN` present ⇒ live**,
 * otherwise mock. An explicit `mode` override always wins.
 */
import { z } from 'zod';
import { internalError } from './errors.js';
import type { CasperProofConfig, FetchLike, ResolvedConfig } from './types.js';

/** Documented local defaults (match `.env.example`). */
const DEFAULTS = {
  csprCloudRestUrl: 'https://api.testnet.cspr.cloud',
  csprCloudStreamingUrl: 'wss://streaming.testnet.cspr.cloud',
  casperNodeUrl: 'https://node.testnet.casper.network/rpc',
  casperNetworkName: 'casper-test',
  timeoutMs: 10_000,
  retries: 2,
  retryBaseDelayMs: 50,
} as const;

/** Treat empty / whitespace-only env values as unset. */
function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Validation schema for the numeric tuning knobs (positive, finite). */
const numericSchema = z.number().int('must be an integer').nonnegative('must be >= 0');

function resolveNumeric(name: string, value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = numericSchema.safeParse(value);
  if (!parsed.success) {
    throw internalError(
      `Invalid config \`${name}\`: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
    );
  }
  return parsed.data;
}

/**
 * Resolve the global `fetch` if available, throwing only when a REST backend actually needs
 * it (callers in mock mode never reach this). Returns a thunk-free {@link FetchLike}.
 */
function resolveFetch(explicit: FetchLike | undefined): FetchLike {
  if (explicit) return explicit;
  const globalFetch = (globalThis as { fetch?: unknown }).fetch;
  if (typeof globalFetch === 'function') {
    return globalFetch.bind(globalThis) as FetchLike;
  }
  // Deferred: only the RestBackend dereferences fetch, and it does so per-call. We return a
  // stub that rejects with a clear, typed error if a live request is ever attempted without
  // a `fetch` implementation.
  return () =>
    Promise.reject(
      internalError(
        'No global `fetch` available; pass `config.fetch` to use the live REST backend.',
      ),
    );
}

/**
 * Merge config + environment into a fully-resolved {@link ResolvedConfig}.
 *
 * @param config Explicit overrides. Any unset field falls back to env, then to a default.
 */
export function resolveConfig(config: CasperProofConfig = {}): ResolvedConfig {
  const env =
    config.env ??
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ??
    {};

  const csprCloudToken = clean(config.csprCloudToken ?? env['CSPR_CLOUD_TOKEN']);
  const mode = config.mode ?? (csprCloudToken ? 'live' : 'mock');

  return {
    mode,
    csprCloudRestUrl:
      clean(config.csprCloudRestUrl ?? env['CSPR_CLOUD_REST_URL']) ?? DEFAULTS.csprCloudRestUrl,
    csprCloudStreamingUrl:
      clean(config.csprCloudStreamingUrl ?? env['CSPR_CLOUD_STREAMING_URL']) ??
      DEFAULTS.csprCloudStreamingUrl,
    csprCloudToken,
    casperNodeUrl: clean(config.casperNodeUrl ?? env['CASPER_NODE_URL']) ?? DEFAULTS.casperNodeUrl,
    casperNetworkName:
      clean(config.casperNetworkName ?? env['CASPER_NETWORK_NAME']) ?? DEFAULTS.casperNetworkName,
    attestationRegistryHash: clean(
      config.attestationRegistryHash ?? env['ATTESTATION_REGISTRY_HASH'],
    ),
    insuranceHash: clean(config.insuranceHash ?? env['INSURANCE_HASH']),
    stakeTokenHash: clean(config.stakeTokenHash ?? env['STAKE_TOKEN_HASH']),
    timeoutMs: resolveNumeric('timeoutMs', config.timeoutMs, DEFAULTS.timeoutMs),
    retries: resolveNumeric('retries', config.retries, DEFAULTS.retries),
    retryBaseDelayMs: resolveNumeric(
      'retryBaseDelayMs',
      config.retryBaseDelayMs,
      DEFAULTS.retryBaseDelayMs,
    ),
    fetch: resolveFetch(config.fetch),
  };
}
