/**
 * @casperproof/commitment — the trust anchor (§8).
 *
 * blake2b-256 commitment scheme with deterministic canonical JSON. Imported by the
 * attestor, the verifier, the SDK, and the agents so every component agrees byte-for-byte.
 * The on-chain registry stores/compares the resulting bytes only.
 */
export * from './types.js';
export { canonicalize, canonicalBytes, CanonicalizationError } from './canonical.js';
export { blake2b256, toHex, fromHex, leU64, concatBytes, HASH_LENGTH } from './hash.js';
export {
  hashPayload,
  commitmentFromHashes,
  computeCommitment,
  verifyOutputHash,
} from './commitment.js';
