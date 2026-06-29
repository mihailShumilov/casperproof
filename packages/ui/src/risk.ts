/**
 * Risk-tier helpers.
 *
 * A 0–100 risk score is bucketed into one of four {@link Tier}s, each mapped to
 * a CasperProof semantic token color (and a translucent variant for halos /
 * backgrounds). Used by the {@link RingGauge} and the upcoming insurance /
 * reputation feature surfaces.
 */

import { colors } from './tokens.js';

/** A coarse risk classification, ordered low → high. */
export type Tier = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

/**
 * Bucket a 0–100 risk score into a {@link Tier}.
 *
 * Boundaries: `LOW` 0–39, `MEDIUM` 40–59, `HIGH` 60–79, `EXTREME` 80–100.
 * Out-of-range scores clamp to the nearest tier (`<40` → LOW, `≥80` → EXTREME).
 */
export function tierForScore(score: number): Tier {
  if (score < 40) return 'LOW';
  if (score < 60) return 'MEDIUM';
  if (score < 80) return 'HIGH';
  return 'EXTREME';
}

/**
 * Solid CasperProof token color for a tier.
 *
 * LOW → proof green, MEDIUM → info blue, HIGH → warn orange,
 * EXTREME → fail red.
 */
export function tierColor(tier: Tier): string {
  switch (tier) {
    case 'LOW':
      return colors.proof;
    case 'MEDIUM':
      return colors.info;
    case 'HIGH':
      return colors.warn;
    case 'EXTREME':
      return colors.fail;
  }
}

/**
 * A translucent version of the tier color, suitable for fills / glows.
 *
 * @param tier  The risk tier.
 * @param alpha Opacity 0–1. Defaults to `0.12`.
 */
export function tierBg(tier: Tier, alpha = 0.12): string {
  return hexToRgba(tierColor(tier), alpha);
}

/** Convert a `#rrggbb` hex string to an `rgba(...)` string. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
