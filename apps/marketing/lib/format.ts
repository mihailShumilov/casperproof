/**
 * Pure formatting helpers used by the marketing site.
 *
 * All functions are deterministic and side-effect free so they can be unit
 * tested without a DOM or network. They format on-chain primitives (motes,
 * counts, ratios) for display — never fabricate data.
 */

/** Number of motes in one CSPR (Casper's base unit, 1e9). */
export const MOTES_PER_CSPR = 1_000_000_000n;

/**
 * Format a stringified motes amount as a human CSPR value.
 *
 * Truncates to `maxFractionDigits` (default 0) and groups thousands. Accepts
 * the stringified motes the SDK returns (e.g. an attestation `stake`).
 *
 * @example motesToCspr('2500000000') // '2.5'
 */
export function motesToCspr(motes: string | bigint, maxFractionDigits = 2): string {
  const value = typeof motes === 'bigint' ? motes : BigInt(motes || '0');
  const whole = value / MOTES_PER_CSPR;
  const remainder = value % MOTES_PER_CSPR;

  if (maxFractionDigits <= 0 || remainder === 0n) {
    return groupThousands(whole.toString());
  }

  // Build the fractional part, zero-padded to 9 digits, then trim.
  const fraction = remainder
    .toString()
    .padStart(9, '0')
    .slice(0, maxFractionDigits)
    .replace(/0+$/, '');
  const wholeStr = groupThousands(whole.toString());
  return fraction.length > 0 ? `${wholeStr}.${fraction}` : wholeStr;
}

/** Insert thousands separators into a non-negative integer string. */
export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format an integer count for display, grouping thousands.
 *
 * @example formatCount(1234) // '1,234'
 */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return groupThousands(Math.trunc(Math.max(0, value)).toString());
}

/**
 * Format a ratio in `[0, 1]` as a whole-number percentage string.
 *
 * @example formatPercent(0.5) // '50%'
 */
export function formatPercent(ratio: number, fractionDigits = 0): string {
  if (!Number.isFinite(ratio)) return '0%';
  const clamped = Math.min(1, Math.max(0, ratio));
  return `${(clamped * 100).toFixed(fractionDigits)}%`;
}

/** Truncate a long hex hash for display (`0xabcd…ef01`). */
export function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
