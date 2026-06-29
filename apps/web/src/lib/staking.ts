/**
 * Pure helpers for the staking view + the animated unstake flow.
 *
 * Kept free of React and SDK imports so they are trivially unit-testable and
 * reusable from both the view and the {@link UnstakeFlow} state machine.
 *
 * CasperProof's insurance vault is an LP pool: stakers supply capital that backs
 * outstanding parametric coverage. Unstaking is governed by a **solvency guard**
 * — there is no fixed time cooldown. A staker may only withdraw capital the pool
 * does not need to keep its collateralisation at or above the guard floor
 * (`MIN_SOLVENCY_RATIO_BPS`). Capital beyond the free surplus is "backing
 * coverage" and is locked until coverage expires or new capital arrives.
 */

/** 1 CSPR = 1e9 motes. */
export const MOTES_PER_CSPR = 1_000_000_000n;

/**
 * Guard floor: the pool must stay at least this collateralised (in basis
 * points of outstanding coverage) after a withdrawal. 12000 bps = 120%.
 */
export const MIN_SOLVENCY_RATIO_BPS = 12_000n;

/**
 * Seeded demo vault snapshot (mock mode only).
 *
 * Mirrors the approach in the Insurance view, which seeds a nominal vault
 * reserve "so the solvency guard is visible in the demo". These are the mock
 * pool's other-LP capital + outstanding coverage; the connected wallet's own
 * stake/unstake are **real SDK writes** layered on top and reflected live.
 */
export const SEED_POOL_STAKED_MOTES = 55_000n * MOTES_PER_CSPR; // 55,000 CSPR from other LPs
export const COVERAGE_OUTSTANDING_MOTES = 50_000n * MOTES_PER_CSPR; // 50,000 CSPR of cover
export const SEED_STAKER_COUNT = 142;
/** Premiums distributed pro-rata to LPs (the reward pool the staker shares in). */
export const REWARDS_POOL_MOTES = 3_200n * MOTES_PER_CSPR; // 3,200 CSPR

/** Solvency health tier for the pool-health badge. */
export type SolvencyLevel = 'HEALTHY' | 'CAUTION' | 'CRITICAL';

/** Lifecycle phases of the animated unstake flow, keyed to the solvency guard. */
export type UnstakePhase = 'idle' | 'checking' | 'executable' | 'gated' | 'done';

/**
 * Parse a decimal CSPR string (e.g. `"1.5"`) to a motes string (`"1500000000"`).
 * Returns `"0"` for empty / malformed input. Uses BigInt + string slicing so no
 * floating-point precision is lost.
 */
export function csprToMotes(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '.' || !/^\d*(\.\d*)?$/.test(trimmed)) {
    return '0';
  }
  const [whole, frac = ''] = trimmed.split('.');
  const fracPadded = `${frac}000000000`.slice(0, 9);
  return (BigInt(whole || '0') * MOTES_PER_CSPR + BigInt(fracPadded || '0')).toString();
}

/** Convert a motes bigint to a CSPR number (for charts / count-up). */
export function motesToCsprNumber(motes: bigint): number {
  return Number(motes) / Number(MOTES_PER_CSPR);
}

/** Group the integer part of a number (or numeric string) with thousands separators. */
export function groupThousands(value: string | number): string {
  const str = typeof value === 'number' ? String(value) : value;
  const [intPart = '', fracPart] = str.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart != null ? `${grouped}.${fracPart}` : grouped;
}

/**
 * Solvency ratio = total staked / coverage outstanding. Returns `Infinity` when
 * there is capital but no outstanding coverage, and `0` for an empty pool.
 */
export function solvencyRatio(totalStakedMotes: bigint, coverageMotes: bigint): number {
  if (coverageMotes <= 0n) {
    return totalStakedMotes > 0n ? Infinity : 0;
  }
  return Number(totalStakedMotes) / Number(coverageMotes);
}

/** Bucket a solvency ratio into a health tier for the pool-health badge. */
export function solvencyLevelFor(ratio: number): SolvencyLevel {
  if (ratio >= 1.5) return 'HEALTHY';
  if (ratio >= 1.1) return 'CAUTION';
  return 'CRITICAL';
}

/** Format a solvency ratio for display, e.g. `"1.50x"` or `"∞"`. */
export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return '∞';
  return `${ratio.toFixed(2)}x`;
}

/**
 * Capital the staker may withdraw **now** under the solvency guard.
 *
 * The pool must keep at least `minRatioBps` of outstanding coverage collateralised.
 * The free surplus above that floor is `total − (coverage × minRatioBps / 10000)`,
 * clamped to ≥ 0 and capped at the staker's own position — you can never withdraw
 * more than you staked, nor capital the pool needs to stay solvent.
 */
export function withdrawableMotes(
  totalStakedMotes: bigint,
  coverageMotes: bigint,
  userStakedMotes: bigint,
  minRatioBps: bigint = MIN_SOLVENCY_RATIO_BPS,
): bigint {
  const required = (coverageMotes * minRatioBps) / 10_000n;
  const free = totalStakedMotes - required;
  const surplus = free > 0n ? free : 0n;
  return surplus < userStakedMotes ? surplus : userStakedMotes;
}

/** Capital of the staker's position that is currently locked (backing coverage). */
export function lockedMotes(userStakedMotes: bigint, withdrawable: bigint): bigint {
  const locked = userStakedMotes - withdrawable;
  return locked > 0n ? locked : 0n;
}

/**
 * Whether a requested unstake clears the solvency guard. `false` (gated) when the
 * request exceeds the currently-withdrawable surplus. A non-positive request is
 * never executable.
 */
export function isWithdrawable(requestedMotes: bigint, withdrawable: bigint): boolean {
  return requestedMotes > 0n && requestedMotes <= withdrawable;
}

/** The staker's pro-rata share of the pool, in percent (0 when the pool is empty). */
export function poolSharePercent(userStakedMotes: bigint, totalStakedMotes: bigint): number {
  if (totalStakedMotes <= 0n || userStakedMotes <= 0n) return 0;
  return (Number(userStakedMotes) / Number(totalStakedMotes)) * 100;
}

/** Pending LP rewards: the staker's pro-rata share of the distributed premiums. */
export function pendingRewardsMotes(
  userStakedMotes: bigint,
  totalStakedMotes: bigint,
  rewardsPoolMotes: bigint = REWARDS_POOL_MOTES,
): bigint {
  if (totalStakedMotes <= 0n || userStakedMotes <= 0n) return 0n;
  return (rewardsPoolMotes * userStakedMotes) / totalStakedMotes;
}
