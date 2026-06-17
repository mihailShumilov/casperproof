import { describe, expect, it } from 'vitest';
import {
  commitmentFromHashes,
  computeCommitment,
  hashPayload,
  verifyOutputHash,
} from './commitment.js';
import { buildVectors } from './gen-golden.js';

describe('computeCommitment', () => {
  it('is deterministic and independent of key insertion order', () => {
    const a = computeCommitment({
      input: { b: 2, a: 1 },
      output: { y: 1, x: 2 },
      modelId: 'm',
      timestamp: 100,
    });
    const b = computeCommitment({
      input: { a: 1, b: 2 },
      output: { x: 2, y: 1 },
      modelId: 'm',
      timestamp: 100,
    });
    expect(a).toEqual(b);
  });

  it('produces 64-hex-char (32-byte) hashes', () => {
    const r = computeCommitment({ input: {}, output: {}, modelId: 'm', timestamp: 0 });
    for (const h of [r.inputHash, r.outputHash, r.commitment]) {
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('changes the commitment when timestamp changes', () => {
    const base = { input: { a: 1 }, output: { b: 2 }, modelId: 'm' };
    const t1 = computeCommitment({ ...base, timestamp: 1 });
    const t2 = computeCommitment({ ...base, timestamp: 2 });
    expect(t1.inputHash).toBe(t2.inputHash);
    expect(t1.outputHash).toBe(t2.outputHash);
    expect(t1.commitment).not.toBe(t2.commitment);
  });

  it('changes the commitment when model_id changes', () => {
    const base = { input: { a: 1 }, output: { b: 2 }, timestamp: 5 };
    expect(computeCommitment({ ...base, modelId: 'm1' }).commitment).not.toBe(
      computeCommitment({ ...base, modelId: 'm2' }).commitment,
    );
  });

  it('changes hashes when payloads change', () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });

  it('commitmentFromHashes matches computeCommitment', () => {
    const { inputHash, outputHash, commitment } = computeCommitment({
      input: { foo: 'bar' },
      output: { n: 7 },
      modelId: 'casperproof-riskscorer-v1',
      timestamp: 1718600000,
    });
    expect(commitmentFromHashes(inputHash, outputHash, 'casperproof-riskscorer-v1', 1718600000)).toBe(
      commitment,
    );
  });
});

describe('verifyOutputHash', () => {
  it('passes for matching hashes (case/prefix-insensitive)', () => {
    expect(verifyOutputHash('ab12', 'ab12')).toBe(true);
    expect(verifyOutputHash('0xAB12', 'ab12')).toBe(true);
  });
  it('fails for tampered (mismatched) hashes', () => {
    expect(verifyOutputHash('ab12', 'ab13')).toBe(false);
  });
});

describe('golden vectors (self-consistency)', () => {
  const file = buildVectors();
  it('every vector recomputes to its stored hashes', () => {
    for (const v of file.vectors) {
      const r = computeCommitment({
        input: v.input,
        output: v.output,
        modelId: v.modelId,
        timestamp: v.timestamp,
      });
      expect(r.inputHash, v.name).toBe(v.inputHash);
      expect(r.outputHash, v.name).toBe(v.outputHash);
      expect(r.commitment, v.name).toBe(v.commitment);
    }
  });
  it('covers the documented canonicalization edge cases', () => {
    const names = file.vectors.map((v) => v.name);
    expect(names).toContain('key-order-insensitive');
    expect(names).toContain('unicode-and-types');
    expect(names).toContain('nested-arrays-objects');
  });
});
