/**
 * The attestor — turns an agent's `{input, output, modelId}` into a stake-backed, tamper-evident
 * on-chain attestation.
 *
 * Flow (§8 + attestation-oracle skill):
 * 1. Compute the commitment (`input_hash`, `output_hash`, `commitment`) via the locked
 *    `@casperproof/commitment` — never reimplemented here.
 * 2. Store the full off-chain payload in the content-addressed {@link PayloadStore}, getting back
 *    an `s3://…` URI.
 * 3. Submit the attestation (hashes + metadata + stake + uri) on-chain via the SDK.
 *
 * The on-chain registry stores hashes + metadata + stake only; the full payload lives off-chain
 * by URI. The verifier later refetches by URI and recomputes the hash to prove integrity.
 */
import type { CasperProofSdk, SubmitAttestationResult } from '@casperproof/casper-sdk';
import type { JsonValue } from '@casperproof/commitment';
import type { AgentConfig } from './agent.config.js';
import { defaultConfig } from './agent.config.js';
import type { PayloadStore } from './store.js';

/** The payload that is hashed, stored off-chain, and anchored on-chain. */
export interface AttestationPayload {
  /** The agent's input (canonicalizable JSON). */
  input: JsonValue;
  /** The agent's output (canonicalizable JSON). */
  output: JsonValue;
  /** Model identifier, e.g. `casperproof-riskscorer-v1`. */
  modelId: string;
}

/** Arguments to {@link attest}. */
export interface AttestArgs extends AttestationPayload {
  /** Unix timestamp (u64) hashed into the commitment. Defaults to now. */
  timestamp?: number;
  /** Stake to lock (stringified motes). Defaults to the agent config stake. */
  stake?: string;
  /** Optional attestor address override (mock mode). */
  attestor?: string;
}

/** Result of {@link attest}: the submit result plus the off-chain payload URI. */
export interface AttestResult extends SubmitAttestationResult {
  /** Content-addressed URI of the stored off-chain payload. */
  uri: string;
}

/**
 * Build, store, and submit a stake-backed attestation.
 *
 * @param sdk The CasperProof client (mock or live).
 * @param store The off-chain payload store.
 * @param args The payload, optional timestamp / stake / attestor overrides.
 * @param config Agent config (default stake + nothing else). Defaults to {@link defaultConfig}.
 */
export async function attest(
  sdk: CasperProofSdk,
  store: PayloadStore,
  args: AttestArgs,
  config: AgentConfig = defaultConfig,
): Promise<AttestResult> {
  const timestamp = args.timestamp ?? Math.floor(Date.now() / 1000);

  // The off-chain payload is the full record needed to re-derive the output hash.
  const payload: JsonValue = {
    modelId: args.modelId,
    input: args.input,
    output: args.output,
    timestamp,
  };
  const uri = await store.put(payload);

  const submit = await sdk.submitAttestation({
    modelId: args.modelId,
    input: args.input,
    output: args.output,
    timestamp,
    uri,
    stake: args.stake ?? config.attestationStake,
    ...(args.attestor !== undefined ? { attestor: args.attestor } : {}),
  });

  return { ...submit, uri };
}
