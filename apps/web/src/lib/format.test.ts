import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatHash,
  formatMotes,
  isValidJson,
  parseJson,
  prettyJson,
  statusToBadge,
} from './format';

describe('parseJson', () => {
  it('parses valid JSON', () => {
    const result = parseJson('{"a":1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it('trims surrounding whitespace before parsing', () => {
    const result = parseJson('  [1, 2, 3]  ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([1, 2, 3]);
  });

  it('rejects empty / whitespace-only input', () => {
    expect(parseJson('').ok).toBe(false);
    expect(parseJson('   ').ok).toBe(false);
    const result = parseJson('');
    if (!result.ok) expect(result.error).toMatch(/empty/i);
  });

  it('returns an error for malformed JSON', () => {
    const result = parseJson('{not json}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });
});

describe('isValidJson', () => {
  it('is true for valid JSON and false otherwise', () => {
    expect(isValidJson('{"x":true}')).toBe(true);
    expect(isValidJson('nope')).toBe(false);
    expect(isValidJson('')).toBe(false);
  });
});

describe('prettyJson', () => {
  it('indents with two spaces', () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('falls back to String for non-serializable values', () => {
    expect(prettyJson(undefined)).toBe('undefined');
  });
});

describe('formatHash', () => {
  it('truncates a long hash to lead…tail', () => {
    const hash = 'a'.repeat(64);
    expect(formatHash(hash, 6, 6)).toBe('aaaaaa…aaaaaa');
  });

  it('preserves a 0x prefix and truncates only the body', () => {
    const hash = `0x${'b'.repeat(40)}`;
    const out = formatHash(hash, 4, 4);
    expect(out.startsWith('0x')).toBe(true);
    expect(out).toBe('0xbbbb…bbbb');
  });

  it('returns short hashes unchanged', () => {
    expect(formatHash('abcd')).toBe('abcd');
  });

  it('returns empty string for empty input', () => {
    expect(formatHash('')).toBe('');
  });
});

describe('formatMotes', () => {
  it('formats a whole CSPR amount with grouping', () => {
    expect(formatMotes('2000000000')).toBe('2 CSPR');
    expect(formatMotes('1234000000000')).toBe('1,234 CSPR');
  });

  it('renders a fractional part trimmed of trailing zeros', () => {
    expect(formatMotes('1500000000')).toBe('1.5 CSPR');
    expect(formatMotes('250000000')).toBe('0.25 CSPR');
  });

  it('handles zero', () => {
    expect(formatMotes('0')).toBe('0 CSPR');
  });

  it('does not lose precision on very large amounts', () => {
    expect(formatMotes('1000000000000000000000')).toBe('1,000,000,000,000 CSPR');
  });

  it('falls back gracefully on non-numeric input', () => {
    expect(formatMotes('abc')).toBe('abc CSPR');
  });
});

describe('statusToBadge', () => {
  it('maps lifecycle statuses to badge variants', () => {
    expect(statusToBadge('Active')).toBe('active');
    expect(statusToBadge('Challenged')).toBe('challenged');
    expect(statusToBadge('Slashed')).toBe('slashed');
    expect(statusToBadge('Finalized')).toBe('finalized');
    expect(statusToBadge('Claimed')).toBe('finalized');
    expect(statusToBadge('Expired')).toBe('finalized');
  });

  it('defaults unknown statuses to active', () => {
    expect(statusToBadge('Whatever')).toBe('active');
  });
});

describe('formatClock', () => {
  it('formats unix seconds as zero-padded HH:MM:SS', () => {
    // Construct a known local time and round-trip through the formatter.
    const d = new Date(2024, 0, 1, 9, 5, 3);
    const out = formatClock(Math.floor(d.getTime() / 1000));
    expect(out).toBe('09:05:03');
  });
});
