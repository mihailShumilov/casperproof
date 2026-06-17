/**
 * Shared types for the CasperProof commitment scheme (§8).
 *
 * The commitment is the trust anchor of the entire system. The attestor builds it,
 * the verifier recomputes it, and the on-chain registry stores/compares the resulting
 * bytes only — it never recomputes hashes.
 */

/** Lowercase hex string. A 32-byte hash is 64 hex chars. */
export type Hex = string;

/**
 * A JSON value. The commitment canonicalizes these deterministically before hashing.
 *
 * NOTE: numbers MUST be integers. Non-integer (floating-point) numbers serialize
 * differently across languages (e.g. `1.0` → `"1"` in JS but `"1.0"` in serde_json),
 * which would break TS ⇆ Rust parity. Represent decimals as strings.
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Inputs to {@link computeCommitment}. */
export interface CommitmentInput {
  /** The agent's input payload (any canonicalizable JSON value). */
  input: JsonValue;
  /** The agent's output payload (any canonicalizable JSON value). */
  output: JsonValue;
  /** Model identifier, e.g. `casperproof-riskscorer-v1`. Hashed as UTF-8 bytes. */
  modelId: string;
  /** Unix timestamp as a u64. Encoded little-endian into the commitment preimage. */
  timestamp: number;
}

/** Result of {@link computeCommitment}: the three hashes that anchor an attestation. */
export interface CommitmentResult {
  /** `blake2b_256(canonical_bytes(input))` */
  inputHash: Hex;
  /** `blake2b_256(canonical_bytes(output))` */
  outputHash: Hex;
  /** `blake2b_256(input_hash || output_hash || utf8(model_id) || le_u64(timestamp))` */
  commitment: Hex;
}

/** A single golden vector for cross-language parity testing. */
export interface GoldenVector {
  name: string;
  input: JsonValue;
  output: JsonValue;
  modelId: string;
  timestamp: number;
  /** Expected canonical encoding of `input`. */
  canonicalInput: string;
  /** Expected canonical encoding of `output`. */
  canonicalOutput: string;
  inputHash: Hex;
  outputHash: Hex;
  commitment: Hex;
}

export interface GoldenVectorFile {
  scheme: string;
  hash: 'blake2b-256';
  note: string;
  vectors: GoldenVector[];
}
