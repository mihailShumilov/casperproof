/**
 * Pure presentation helpers shared across the dApp views.
 *
 * Kept free of React and SDK imports so they are trivially unit-testable and
 * reusable from both server and client components.
 */

/** Result of attempting to parse a JSON text field. */
export type JsonParseResult = { ok: true; value: unknown } | { ok: false; error: string };

/**
 * Parse a user-entered JSON string, returning a tagged result rather than
 * throwing. Empty / whitespace-only input is treated as an error so the UI can
 * prompt the user instead of silently submitting `undefined`.
 */
export function parseJson(text: string): JsonParseResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Input is empty' };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    return { ok: false, error: message };
  }
}

/** `true` when `text` parses as JSON (and is non-empty). */
export function isValidJson(text: string): boolean {
  return parseJson(text).ok;
}

/**
 * Pretty-print a JSON value with two-space indentation. Falls back to `String`
 * for values JSON cannot represent (e.g. `undefined`).
 */
export function prettyJson(value: unknown): string {
  try {
    const out = JSON.stringify(value, null, 2);
    return out ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Truncate a hex/hash string to `lead` + ellipsis + `tail` characters, leaving
 * a leading `0x`-style prefix untouched. Mirrors the UI `HashDisplay`
 * truncation so non-component code (toasts, logs, tests) formats identically.
 */
export function formatHash(hash: string, lead = 6, tail = 6): string {
  if (!hash) return '';
  const hasPrefix = hash.startsWith('0x');
  const prefix = hasPrefix ? '0x' : '';
  const body = hasPrefix ? hash.slice(2) : hash;
  if (body.length <= lead + tail + 1) {
    return hash;
  }
  return `${prefix}${body.slice(0, lead)}…${body.slice(-tail)}`;
}

/**
 * Format a stringified motes amount (1 CSPR = 1e9 motes) as a human CSPR
 * string. Uses BigInt so very large stakes never lose precision; trims
 * trailing zeros from the fractional part.
 */
export function formatMotes(motes: string, fractionDigits = 2): string {
  let value: bigint;
  try {
    value = BigInt(motes);
  } catch {
    return `${motes} CSPR`;
  }
  const MOTES_PER_CSPR = 1_000_000_000n;
  const whole = value / MOTES_PER_CSPR;
  const remainder = value % MOTES_PER_CSPR;
  if (remainder === 0n || fractionDigits <= 0) {
    return `${formatWithGrouping(whole)} CSPR`;
  }
  // Build the fractional part to `fractionDigits` places.
  const fracFull = remainder.toString().padStart(9, '0');
  const frac = fracFull.slice(0, fractionDigits).replace(/0+$/, '');
  return frac.length > 0
    ? `${formatWithGrouping(whole)}.${frac} CSPR`
    : `${formatWithGrouping(whole)} CSPR`;
}

/** Group a non-negative bigint with thousands separators. */
function formatWithGrouping(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Map an attestation/policy status string to the UI Badge status variant. */
export function statusToBadge(status: string): 'active' | 'challenged' | 'slashed' | 'finalized' {
  switch (status) {
    case 'Challenged':
      return 'challenged';
    case 'Slashed':
      return 'slashed';
    case 'Finalized':
    case 'Claimed':
    case 'Expired':
      return 'finalized';
    case 'Active':
    default:
      return 'active';
  }
}

/** Format a unix-seconds timestamp as a short, locale-stable HH:MM:SS clock. */
export function formatClock(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
