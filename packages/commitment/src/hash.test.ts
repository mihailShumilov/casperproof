import { describe, expect, it } from 'vitest';
import { blake2b256, concatBytes, fromHex, leU64, toHex } from './hash.js';

describe('blake2b256', () => {
  it('produces a 32-byte digest', () => {
    expect(blake2b256(new Uint8Array()).length).toBe(32);
  });

  it('matches the known blake2b-256 vector for the empty input', () => {
    // Standard BLAKE2b-256 of the empty string.
    expect(toHex(blake2b256(new Uint8Array()))).toBe(
      '0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8',
    );
  });

  it('matches the known blake2b-256 vector for "abc"', () => {
    expect(toHex(blake2b256(new TextEncoder().encode('abc')))).toBe(
      'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319',
    );
  });
});

describe('hex helpers', () => {
  it('round-trips bytes through hex', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(toHex(bytes)).toBe('00010f10ff');
    expect(Array.from(fromHex('00010f10ff'))).toEqual([0, 1, 15, 16, 255]);
  });

  it('accepts 0x-prefixed hex', () => {
    expect(Array.from(fromHex('0xff00'))).toEqual([255, 0]);
  });

  it('rejects odd-length and invalid hex', () => {
    expect(() => fromHex('abc')).toThrow(/length/);
    expect(() => fromHex('zz')).toThrow(/Invalid hex/);
  });
});

describe('leU64', () => {
  it('encodes little-endian 8 bytes', () => {
    expect(Array.from(leU64(0))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(leU64(1))).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(leU64(256))).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('handles bigint and the max u64', () => {
    expect(Array.from(leU64(0xffffffffffffffffn))).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });

  it('rejects negative and overflowing values', () => {
    expect(() => leU64(-1)).toThrow(/negative/);
    expect(() => leU64(0x1_0000_0000_0000_0000n)).toThrow(/overflow/);
  });
});

describe('concatBytes', () => {
  it('concatenates in order', () => {
    expect(Array.from(concatBytes(new Uint8Array([1]), new Uint8Array([2, 3])))).toEqual([1, 2, 3]);
  });
});
