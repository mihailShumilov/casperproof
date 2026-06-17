import { describe, expect, it } from 'vitest';
import { canonicalize, canonicalBytes, CanonicalizationError } from './canonical.js';

describe('canonicalize', () => {
  it('sorts object keys deterministically regardless of insertion order', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(canonicalize({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });

  it('sorts keys recursively in nested objects', () => {
    expect(canonicalize({ z: { y: 1, x: 2 }, a: 3 })).toBe('{"a":3,"z":{"x":2,"y":1}}');
  });

  it('emits compact output with no insignificant whitespace', () => {
    expect(canonicalize({ a: [1, 2, 3], b: 'x' })).toBe('{"a":[1,2,3],"b":"x"}');
  });

  it('preserves array order (arrays are ordered)', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('handles primitives, booleans, and null', () => {
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(false)).toBe('false');
    expect(canonicalize('hi')).toBe('"hi"');
    expect(canonicalize(123)).toBe('123');
  });

  it('passes BMP unicode through as UTF-8 (no escaping)', () => {
    expect(canonicalize({ name: 'café', glyph: '漢字' })).toBe('{"glyph":"漢字","name":"café"}');
  });

  it('rejects non-integer numbers', () => {
    expect(() => canonicalize(1.5)).toThrow(CanonicalizationError);
    expect(() => canonicalize({ x: 0.1 })).toThrow(/integer/);
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(CanonicalizationError);
    expect(() => canonicalize(Number.NaN)).toThrow(/Non-finite/);
  });

  it('rejects unsafe integers', () => {
    expect(() => canonicalize(Number.MAX_SAFE_INTEGER + 1)).toThrow(/MAX_SAFE_INTEGER/);
  });

  it('encodes canonical bytes as UTF-8', () => {
    const bytes = canonicalBytes({ a: 1 });
    expect(new TextDecoder().decode(bytes)).toBe('{"a":1}');
  });
});
