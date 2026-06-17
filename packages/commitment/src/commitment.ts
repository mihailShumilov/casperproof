/**
 * The CasperProof commitment computation (§8) — the single source of truth.
 *
 * ```text
 * input_hash  = blake2b_256(canonical_bytes(input))
 * output_hash = blake2b_256(canonical_bytes(output))
 * commitment  = blake2b_256( input_hash || output_hash || utf8(model_id) || le_u64(timestamp) )
 * ```
 *
 * Field order is fixed: input_hash, output_hash, model_id (UTF-8), timestamp (u64 LE).
 */
import { canonicalBytes } from './canonical.js';
import { blake2b256, concatBytes, fromHex, leU64, toHex } from './hash.js';
import type { CommitmentInput, CommitmentResult, Hex, JsonValue } from './types.js';

/** `blake2b_256(canonical_bytes(value))` as lowercase hex. */
export function hashPayload(value: JsonValue): Hex {
  return toHex(blake2b256(canonicalBytes(value)));
}

/** Compute the commitment given precomputed input/output hashes. */
export function commitmentFromHashes(
  inputHash: Hex,
  outputHash: Hex,
  modelId: string,
  timestamp: number,
): Hex {
  const preimage = concatBytes(
    fromHex(inputHash),
    fromHex(outputHash),
    new TextEncoder().encode(modelId),
    leU64(timestamp),
  );
  return toHex(blake2b256(preimage));
}

/** Compute the full commitment result for an attestation. */
export function computeCommitment(args: CommitmentInput): CommitmentResult {
  const inputHash = hashPayload(args.input);
  const outputHash = hashPayload(args.output);
  const commitment = commitmentFromHashes(inputHash, outputHash, args.modelId, args.timestamp);
  return { inputHash, outputHash, commitment };
}

/**
 * Verify a recomputed output hash against the on-chain value (§8 verification).
 * Returns true when they match (PASS), false when tampered (FAIL).
 */
export function verifyOutputHash(recomputed: Hex, onchain: Hex): boolean {
  return normalizeHex(recomputed) === normalizeHex(onchain);
}

function normalizeHex(hex: Hex): string {
  return (hex.startsWith('0x') ? hex.slice(2) : hex).toLowerCase();
}
