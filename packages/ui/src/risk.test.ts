import { describe, expect, it } from 'vitest';
import { tierForScore, tierColor, tierBg } from './risk.js';
import { colors } from './tokens.js';
import type { Tier } from './risk.js';

describe('tierForScore', () => {
  it.each([
    [0, 'LOW'],
    [39, 'LOW'],
    [40, 'MEDIUM'],
    [59, 'MEDIUM'],
    [60, 'HIGH'],
    [79, 'HIGH'],
    [80, 'EXTREME'],
    [100, 'EXTREME'],
  ] as const)('maps score %i to %s', (score, tier) => {
    expect(tierForScore(score)).toBe(tier);
  });

  it('clamps out-of-range scores to the nearest tier', () => {
    expect(tierForScore(-10)).toBe('LOW');
    expect(tierForScore(150)).toBe('EXTREME');
  });
});

describe('tierColor', () => {
  it.each([
    ['LOW', colors.proof],
    ['MEDIUM', colors.info],
    ['HIGH', colors.warn],
    ['EXTREME', colors.fail],
  ] as const)('maps %s to its semantic token color', (tier, expected) => {
    expect(tierColor(tier as Tier)).toBe(expected);
  });
});

describe('tierBg', () => {
  it('returns a translucent rgba derived from the tier color', () => {
    // proof green #2fd47a -> rgb(47, 212, 122)
    expect(tierBg('LOW')).toBe('rgba(47, 212, 122, 0.12)');
  });

  it('honours a custom alpha', () => {
    expect(tierBg('EXTREME', 0.5)).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/);
  });
});
