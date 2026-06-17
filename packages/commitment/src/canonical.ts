/**
 * Canonical JSON serialization (§8).
 *
 * Deterministic encoding so that the attestor, the verifier, and the cross-language
 * golden-vector test all hash *exactly* the same bytes. The rules:
 *
 *  - Object keys are sorted (ascending, by code unit — keys are restricted to BMP).
 *  - No insignificant whitespace (compact form, like `JSON.stringify` with no spaces).
 *  - UTF-8 output.
 *  - Numbers MUST be integers (see {@link assertCanonicalNumber}).
 *
 * The Rust side mirrors this with `serde_json` (whose `Map` is a sorted `BTreeMap`,
 * producing identical compact, key-sorted output for the same value).
 */
import type { JsonValue } from './types.js';

/** Thrown when a value cannot be canonicalized deterministically. */
export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalizationError';
  }
}

function assertCanonicalNumber(n: number): void {
  if (!Number.isFinite(n)) {
    throw new CanonicalizationError(`Non-finite numbers are not canonicalizable: ${n}`);
  }
  if (!Number.isInteger(n)) {
    throw new CanonicalizationError(
      `Only integer numbers are canonicalizable (got ${n}); represent decimals as strings.`,
    );
  }
  if (!Number.isSafeInteger(n)) {
    throw new CanonicalizationError(
      `Integer ${n} exceeds Number.MAX_SAFE_INTEGER; represent large integers as strings.`,
    );
  }
}

/** Recursively rebuild a value with object keys sorted, validating numbers. */
function normalize(value: JsonValue): JsonValue {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(normalize);
  switch (typeof value) {
    case 'number':
      assertCanonicalNumber(value);
      return value;
    case 'boolean':
    case 'string':
      return value;
    case 'object': {
      const obj = value as { [key: string]: JsonValue };
      const sorted: { [key: string]: JsonValue } = {};
      for (const key of Object.keys(obj).sort()) {
        sorted[key] = normalize(obj[key]!);
      }
      return sorted;
    }
    default:
      throw new CanonicalizationError(`Unsupported value type: ${typeof value}`);
  }
}

/**
 * Produce the canonical JSON string for a value.
 * `JSON.stringify` already emits compact output with standards-compliant escaping;
 * normalizing first guarantees deterministic key order.
 */
export function canonicalize(value: JsonValue): string {
  return JSON.stringify(normalize(value));
}

/** UTF-8 bytes of the canonical JSON encoding. */
export function canonicalBytes(value: JsonValue): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}
