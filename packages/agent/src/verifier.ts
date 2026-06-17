/**
 * The verifier — proves an attestation's off-chain payload still matches its on-chain hash.
 *
 * Verification algorithm (§8 + attestation-oracle skill):
 * 1. Load the attestation by id (on-chain, via the SDK).
 * 2. Fetch the payload by `uri` from the content-addressed {@link PayloadStore}.
 * 3. Recompute the output hash from the payload via the locked `@casperproof/commitment`.
 * 4. Compare byte-for-byte to the on-chain `output_hash`. Match ⇒ PASS; mismatch ⇒ FAIL (a
 *    tamper).
 *
 * Returns `{ valid, recomputedHash, onchainHash, attestor, stake, reputation }`. A FAIL is a
 * normal result (not an exception) — it is exactly what the tamper demo surfaces before the
 * challenge/slash step.
 */
import type { CasperProofSdk, Reputation } from '@casperproof/casper-sdk';
import { hashPayload, verifyOutputHash } from '@casperproof/commitment';
import type { Hex, JsonValue } from '@casperproof/commitment';
import type { PayloadStore } from './store.js';

/** Result of {@link verify}. */
export interface VerifyResult {
  /** `true` when the recomputed output hash matches the on-chain value (PASS). */
  valid: boolean;
  /** Output hash recomputed from the fetched payload. */
  recomputedHash: Hex;
  /** Output hash stored on-chain. */
  onchainHash: Hex;
  /** Attestor address. */
  attestor: string;
  /** Stake locked behind the attestation (stringified motes). */
  stake: string;
  /** Attestor reputation snapshot. */
  reputation: Reputation;
  /** Off-chain payload URI that was fetched and verified. */
  uri: string;
}

/** Extract the attested `output` from a stored payload (the attestor stores a wrapper). */
function extractOutput(payload: JsonValue): JsonValue {
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload) && 'output' in payload) {
    return (payload as { output: JsonValue }).output;
  }
  // Older / raw payloads stored the output directly.
  return payload;
}

/**
 * Verify an attestation against its off-chain payload.
 *
 * @param sdk The CasperProof client (mock or live).
 * @param store The off-chain payload store.
 * @param id The attestation id to verify.
 */
export async function verify(sdk: CasperProofSdk, store: PayloadStore, id: number): Promise<VerifyResult> {
  const attestation = await sdk.getAttestation(id);
  const payload = await store.getJson(attestation.uri);
  const recomputedHash = hashPayload(extractOutput(payload));
  const valid = verifyOutputHash(recomputedHash, attestation.outputHash);
  const reputation = await sdk.attestorReputation(attestation.attestor);

  return {
    valid,
    recomputedHash,
    onchainHash: attestation.outputHash,
    attestor: attestation.attestor,
    stake: attestation.stake,
    reputation,
    uri: attestation.uri,
  };
}
