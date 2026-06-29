import { describe, expect, it } from 'vitest';
import {
  COVERAGE_OUTSTANDING_MOTES,
  csprToMotes,
  formatRatio,
  groupThousands,
  isWithdrawable,
  lockedMotes,
  MIN_SOLVENCY_RATIO_BPS,
  MOTES_PER_CSPR,
  motesToCsprNumber,
  pendingRewardsMotes,
  poolSharePercent,
  SEED_POOL_STAKED_MOTES,
  solvencyLevelFor,
  solvencyRatio,
  withdrawableMotes,
} from './staking';

describe('csprToMotes', () => {
  it('converts whole CSPR to motes', () => {
    expect(csprToMotes('1')).toBe('1000000000');
    expect(csprToMotes('100')).toBe('100000000000');
  });

  it('converts fractional CSPR without floating-point loss', () => {
    expect(csprToMotes('1.5')).toBe('1500000000');
    expect(csprToMotes('0.000000001')).toBe('1');
    expect(csprToMotes('.5')).toBe('500000000');
  });

  it('truncates beyond 9 fractional digits', () => {
    expect(csprToMotes('1.1234567899')).toBe('1123456789');
  });

  it('returns "0" for empty / malformed input', () => {
    expect(csprToMotes('')).toBe('0');
    expect(csprToMotes('   ')).toBe('0');
    expect(csprToMotes('.')).toBe('0');
    expect(csprToMotes('abc')).toBe('0');
    expect(csprToMotes('1.2.3')).toBe('0');
  });
});

describe('motesToCsprNumber', () => {
  it('divides by 1e9', () => {
    expect(motesToCsprNumber(1_500_000_000n)).toBe(1.5);
    expect(motesToCsprNumber(0n)).toBe(0);
  });
});

describe('groupThousands', () => {
  it('groups the integer part', () => {
    expect(groupThousands('55000')).toBe('55,000');
    expect(groupThousands(1234567)).toBe('1,234,567');
  });

  it('preserves a decimal part', () => {
    expect(groupThousands('12345.67')).toBe('12,345.67');
  });

  it('leaves short numbers untouched', () => {
    expect(groupThousands('42')).toBe('42');
  });
});

describe('solvencyRatio', () => {
  it('is total staked over coverage', () => {
    expect(solvencyRatio(150n, 100n)).toBeCloseTo(1.5);
  });

  it('is Infinity with capital but no coverage', () => {
    expect(solvencyRatio(100n, 0n)).toBe(Infinity);
  });

  it('is 0 for an empty pool', () => {
    expect(solvencyRatio(0n, 0n)).toBe(0);
  });
});

describe('solvencyLevelFor', () => {
  it('buckets ratios into health tiers', () => {
    expect(solvencyLevelFor(2)).toBe('HEALTHY');
    expect(solvencyLevelFor(1.5)).toBe('HEALTHY');
    expect(solvencyLevelFor(1.49)).toBe('CAUTION');
    expect(solvencyLevelFor(1.1)).toBe('CAUTION');
    expect(solvencyLevelFor(1.05)).toBe('CRITICAL');
    expect(solvencyLevelFor(0.5)).toBe('CRITICAL');
  });
});

describe('formatRatio', () => {
  it('formats finite ratios with an x suffix', () => {
    expect(formatRatio(1.5)).toBe('1.50x');
    expect(formatRatio(1.2)).toBe('1.20x');
  });

  it('renders ∞ for non-finite ratios', () => {
    expect(formatRatio(Infinity)).toBe('∞');
  });
});

describe('withdrawableMotes (solvency guard)', () => {
  const coverage = 50_000n * MOTES_PER_CSPR;
  const required = (coverage * MIN_SOLVENCY_RATIO_BPS) / 10_000n; // 60,000 CSPR

  it('caps the free surplus above the guard floor', () => {
    // total 75,000 → surplus over the 60,000 floor = 15,000
    const total = 75_000n * MOTES_PER_CSPR;
    const userStaked = 20_000n * MOTES_PER_CSPR;
    expect(withdrawableMotes(total, coverage, userStaked)).toBe(15_000n * MOTES_PER_CSPR);
  });

  it('never exceeds the staker’s own position', () => {
    const total = 200_000n * MOTES_PER_CSPR; // huge surplus
    const userStaked = 5_000n * MOTES_PER_CSPR;
    expect(withdrawableMotes(total, coverage, userStaked)).toBe(userStaked);
  });

  it('is zero when the pool is at or below the guard floor', () => {
    const total = required; // exactly at the floor, no surplus
    const userStaked = 10_000n * MOTES_PER_CSPR;
    expect(withdrawableMotes(total, coverage, userStaked)).toBe(0n);
    expect(withdrawableMotes(required - 1n, coverage, userStaked)).toBe(0n);
  });
});

describe('lockedMotes', () => {
  it('is the position minus what is withdrawable', () => {
    expect(lockedMotes(20_000n, 15_000n)).toBe(5_000n);
  });

  it('clamps to zero when everything is withdrawable', () => {
    expect(lockedMotes(15_000n, 20_000n)).toBe(0n);
  });
});

describe('isWithdrawable', () => {
  it('is true when the request fits the surplus', () => {
    expect(isWithdrawable(10n, 15n)).toBe(true);
    expect(isWithdrawable(15n, 15n)).toBe(true);
  });

  it('is false when the request exceeds the surplus (gated)', () => {
    expect(isWithdrawable(20n, 15n)).toBe(false);
  });

  it('is false for a non-positive request', () => {
    expect(isWithdrawable(0n, 15n)).toBe(false);
  });
});

describe('poolSharePercent', () => {
  it('is the pro-rata share', () => {
    expect(poolSharePercent(25n, 100n)).toBe(25);
  });

  it('is zero for an empty position or pool', () => {
    expect(poolSharePercent(0n, 100n)).toBe(0);
    expect(poolSharePercent(10n, 0n)).toBe(0);
  });
});

describe('pendingRewardsMotes', () => {
  it('is the pro-rata cut of the reward pool', () => {
    expect(pendingRewardsMotes(25n, 100n, 1000n)).toBe(250n);
  });

  it('is zero with no position', () => {
    expect(pendingRewardsMotes(0n, 100n, 1000n)).toBe(0n);
  });
});

describe('seed constants form a tight-but-solvent demo pool', () => {
  it('starts in CAUTION and reaches HEALTHY once a staker tops it up', () => {
    const start = solvencyRatio(SEED_POOL_STAKED_MOTES, COVERAGE_OUTSTANDING_MOTES);
    expect(solvencyLevelFor(start)).toBe('CAUTION');
    const topped = solvencyRatio(
      SEED_POOL_STAKED_MOTES + 20_000n * MOTES_PER_CSPR,
      COVERAGE_OUTSTANDING_MOTES,
    );
    expect(solvencyLevelFor(topped)).toBe('HEALTHY');
  });
});
