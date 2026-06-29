import { describe, expect, it } from 'vitest';
import {
  FACTORS,
  FACTOR_GROUPS,
  computeCategories,
  computeFactors,
  decodeSeed,
  encodeSeed,
  verdictForTier,
  type FactorGroup,
} from './riskFactors';

/** Re-derive the weighted mean of a factor set the same way the model does. */
function weightedMean(factors: ReturnType<typeof computeFactors>): number {
  return factors.reduce((sum, f) => sum + f.value * (f.weight / 100), 0);
}

describe('FACTORS table', () => {
  it('defines exactly 15 factors', () => {
    expect(FACTORS).toHaveLength(15);
  });

  it('has weights that sum to 100', () => {
    expect(FACTORS.reduce((sum, f) => sum + f.weight, 0)).toBe(100);
  });

  it('uses only the four known groups, each with display metadata', () => {
    const groups: FactorGroup[] = ['TRANSACTION', 'PROTOCOL', 'SECURITY', 'IDENTITY'];
    for (const f of FACTORS) {
      expect(groups).toContain(f.group);
      expect(FACTOR_GROUPS[f.group].label.length).toBeGreaterThan(0);
    }
  });

  it('gives every factor a unique key, an explanation, and three scan lines', () => {
    const keys = new Set(FACTORS.map((f) => f.key));
    expect(keys.size).toBe(15);
    for (const f of FACTORS) {
      expect(f.explanation.length).toBeGreaterThan(0);
      expect(f.scan).toHaveLength(3);
      // The label is interpolated into the per-group scan template.
      expect(f.scan[1].toLowerCase()).toContain(f.label.toLowerCase());
    }
  });
});

describe('computeFactors', () => {
  it('is deterministic for the same seed + score', () => {
    const a = computeFactors('account-hash-abc', 73);
    const b = computeFactors('account-hash-abc', 73);
    expect(a).toEqual(b);
  });

  it('produces different breakdowns for different seeds', () => {
    const a = computeFactors('seed-one', 50);
    const b = computeFactors('seed-two', 50);
    expect(a.map((f) => f.value)).not.toEqual(b.map((f) => f.value));
  });

  it('keeps every factor value within [0, 100]', () => {
    for (const score of [0, 5, 50, 95, 100]) {
      for (const f of computeFactors('agent-x', score)) {
        expect(f.value).toBeGreaterThanOrEqual(0);
        expect(f.value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('reconciles the weighted mean back to the overall score', () => {
    for (const score of [0, 12, 30, 50, 65, 73, 88, 100]) {
      const mean = weightedMean(computeFactors('account-hash-1f4c', score));
      expect(Math.abs(mean - score)).toBeLessThanOrEqual(2);
    }
  });

  it('assigns each factor a tier consistent with its value', () => {
    for (const f of computeFactors('agent-x', 50)) {
      if (f.value < 40) expect(f.tier).toBe('LOW');
      else if (f.value < 60) expect(f.tier).toBe('MEDIUM');
      else if (f.value < 80) expect(f.tier).toBe('HIGH');
      else expect(f.tier).toBe('EXTREME');
    }
  });

  it('clamps fractional / out-of-range overall scores', () => {
    const factors = computeFactors('agent-x', 120.7);
    for (const f of factors) expect(f.value).toBeLessThanOrEqual(100);
  });
});

describe('computeCategories', () => {
  it('rolls the 15 factors up into the four ordered groups', () => {
    const cats = computeCategories(computeFactors('agent-x', 60));
    expect(cats.map((c) => c.group)).toEqual([
      'TRANSACTION',
      'PROTOCOL',
      'SECURITY',
      'IDENTITY',
    ]);
    // Group weights sum to 100 across all categories.
    expect(cats.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
    for (const c of cats) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('verdictForTier', () => {
  it('marks LOW/MEDIUM/HIGH insurable and EXTREME not insurable', () => {
    expect(verdictForTier('LOW').insurable).toBe(true);
    expect(verdictForTier('MEDIUM').insurable).toBe(true);
    expect(verdictForTier('HIGH').insurable).toBe(true);
    expect(verdictForTier('EXTREME').insurable).toBe(false);
  });

  it('returns a non-empty detail line for each tier', () => {
    for (const tier of ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] as const) {
      expect(verdictForTier(tier).detail.length).toBeGreaterThan(0);
    }
  });
});

describe('encodeSeed / decodeSeed', () => {
  it('round-trips arbitrary seed strings', () => {
    for (const seed of [
      'account-hash-1f4c0a9e',
      'agent 7 · risk',
      '0xDEADBEEF',
      'unicode ✓ ⚡ €',
    ]) {
      expect(decodeSeed(encodeSeed(seed))).toBe(seed);
    }
  });

  it('produces URL-safe ids (no +, /, or = characters)', () => {
    const id = encodeSeed('account-hash-1f4c0a9e2b7d6f8a/with+padding==');
    expect(id).not.toMatch(/[+/=]/);
  });
});
