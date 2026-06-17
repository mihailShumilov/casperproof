import { describe, it, expect } from 'vitest';
import {
  motesToCspr,
  groupThousands,
  formatCount,
  formatPercent,
  truncateMiddle,
  MOTES_PER_CSPR,
} from './format.js';

describe('motesToCspr', () => {
  it('converts whole CSPR amounts', () => {
    expect(motesToCspr('2000000000')).toBe('2');
    expect(motesToCspr(MOTES_PER_CSPR)).toBe('1');
  });

  it('renders a trimmed fraction', () => {
    expect(motesToCspr('2500000000')).toBe('2.5');
    expect(motesToCspr('1234567890', 2)).toBe('1.23');
  });

  it('groups thousands for large values', () => {
    expect(motesToCspr('50000000000000')).toBe('50,000');
  });

  it('handles zero and empty input', () => {
    expect(motesToCspr('0')).toBe('0');
    expect(motesToCspr('')).toBe('0');
  });

  it('drops the fraction when maxFractionDigits is 0', () => {
    expect(motesToCspr('2500000000', 0)).toBe('2');
  });
});

describe('groupThousands', () => {
  it('inserts separators', () => {
    expect(groupThousands('1000')).toBe('1,000');
    expect(groupThousands('1234567')).toBe('1,234,567');
    expect(groupThousands('999')).toBe('999');
  });
});

describe('formatCount', () => {
  it('formats finite non-negative integers', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1234)).toBe('1,234');
  });

  it('clamps negatives and rejects non-finite', () => {
    expect(formatCount(-5)).toBe('0');
    expect(formatCount(Number.NaN)).toBe('0');
    expect(formatCount(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('formats ratios as whole percents', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('clamps out-of-range ratios', () => {
    expect(formatPercent(1.5)).toBe('100%');
    expect(formatPercent(-0.2)).toBe('0%');
  });

  it('supports fraction digits', () => {
    expect(formatPercent(0.1234, 1)).toBe('12.3%');
  });
});

describe('truncateMiddle', () => {
  it('truncates long hashes', () => {
    expect(truncateMiddle('0x1234567890abcdef')).toBe('0x1234…cdef');
  });

  it('leaves short strings untouched', () => {
    expect(truncateMiddle('0xabcd')).toBe('0xabcd');
  });
});
