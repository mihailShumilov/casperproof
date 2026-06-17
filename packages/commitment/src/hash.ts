/**
 * blake2b-256 primitives and hex helpers (§8).
 *
 * blake2b-256 is Casper-native; the scheme never uses sha256. We use `@noble/hashes`,
 * a small audited implementation. `blake2b(data, { dkLen: 32 })` is standard
 * BLAKE2b with a 32-byte (256-bit) digest, which matches the Rust `blake2` crate's
 * `Blake2bVar::new(32)` byte-for-byte (asserted by the golden-vector parity test).
 */
import { blake2b } from '@noble/hashes/blake2b';

/** Number of bytes in a commitment hash. */
export const HASH_LENGTH = 32;

/** Compute blake2b-256 of arbitrary bytes. */
export function blake2b256(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: HASH_LENGTH });
}

/** Lowercase hex encoding of bytes. */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/** Decode a (optionally `0x`-prefixed) hex string into bytes. */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) {
    throw new Error(`Invalid hex length: ${clean.length}`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex at offset ${i * 2}: ${clean.slice(i * 2, i * 2 + 2)}`);
    }
    out[i] = byte;
  }
  return out;
}

/** Encode a u64 as 8 little-endian bytes. Accepts number or bigint. */
export function leU64(value: number | bigint): Uint8Array {
  let n = typeof value === 'bigint' ? value : BigInt(value);
  if (n < 0n) {
    throw new Error(`u64 cannot be negative: ${value}`);
  }
  if (n > 0xffffffffffffffffn) {
    throw new Error(`u64 overflow: ${value}`);
  }
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

/** Concatenate byte arrays. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
