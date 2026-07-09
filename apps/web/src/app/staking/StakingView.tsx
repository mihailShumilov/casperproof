/**
 * Staking view: be the house behind the oracle's insurance vault.
 *
 * Stakers supply capital to the LP pool that backs outstanding parametric
 * coverage and earn a pro-rata share of the premiums. The page surfaces:
 *   1. Pool health KPIs (total staked, coverage outstanding, solvency ratio with
 *      a HEALTHY/CAUTION/CRITICAL badge, staker count) — animated with useCountUp.
 *   2. A stake card that signs `stake(amount)` once a wallet is connected.
 *   3. The connected staker's position (staked, pool share, pending rewards, claim).
 *   4. The animated, solvency-guarded {@link UnstakeFlow}.
 *
 * The pool's other-LP capital + outstanding coverage are seeded for the offline
 * demo (mock mode), exactly as the Insurance view seeds a nominal reserve. The
 * connected wallet's own stake/unstake are **real SDK writes** layered on top:
 * `stake`/`unstake` return live deploy hashes and the KPIs update from them.
 */
'use client';

import { useCallback, useMemo, useState } from 'react';
import { Badge, Button, Card, StatTile, Tag, useCountUp } from '@casperproof/ui';
import { CasperProofSdkError } from '@casperproof/casper-sdk';
import { getSdk } from '@/lib/sdk';
import { useWallet } from '@/lib/wallet';
import { LiveFeed } from '@/components/LiveFeed';
import { UnstakeFlow } from '@/components/UnstakeFlow';
import { formatMotes } from '@/lib/format';
import {
  COVERAGE_OUTSTANDING_MOTES,
  csprToMotes,
  formatRatio,
  groupThousands,
  lockedMotes,
  MIN_SOLVENCY_RATIO_BPS,
  motesToCsprNumber,
  pendingRewardsMotes,
  poolSharePercent,
  REWARDS_POOL_MOTES,
  SEED_POOL_STAKED_MOTES,
  SEED_STAKER_COUNT,
  solvencyLevelFor,
  solvencyRatio,
  withdrawableMotes,
} from '@/lib/staking';

const LEVEL_BADGE: Record<
  ReturnType<typeof solvencyLevelFor>,
  'active' | 'challenged' | 'slashed'
> = {
  HEALTHY: 'active',
  CAUTION: 'challenged',
  CRITICAL: 'slashed',
};

export function StakingView(): JSX.Element {
  const { isConnected } = useWallet();

  const [amount, setAmount] = useState('100');
  const [userStakedMotes, setUserStakedMotes] = useState(0n);
  const [staking, setStaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStakeHash, setLastStakeHash] = useState<string | null>(null);
  const [rewardsClaimed, setRewardsClaimed] = useState(false);

  // Derived pool state: seeded other-LP capital + the connected wallet's position.
  const pool = useMemo(() => {
    const totalStaked = SEED_POOL_STAKED_MOTES + userStakedMotes;
    const ratio = solvencyRatio(totalStaked, COVERAGE_OUTSTANDING_MOTES);
    const withdrawable = withdrawableMotes(
      totalStaked,
      COVERAGE_OUTSTANDING_MOTES,
      userStakedMotes,
      MIN_SOLVENCY_RATIO_BPS,
    );
    const rewards = rewardsClaimed
      ? 0n
      : pendingRewardsMotes(userStakedMotes, totalStaked, REWARDS_POOL_MOTES);
    return {
      totalStaked,
      ratio,
      level: solvencyLevelFor(ratio),
      withdrawable,
      locked: lockedMotes(userStakedMotes, withdrawable),
      share: poolSharePercent(userStakedMotes, totalStaked),
      rewards,
      stakerCount: SEED_STAKER_COUNT + (userStakedMotes > 0n ? 1 : 0),
    };
  }, [userStakedMotes, rewardsClaimed]);

  // Animated KPI count-ups (whole CSPR + ratio + staker count).
  const totalStakedCspr = useCountUp(Math.round(motesToCsprNumber(pool.totalStaked)));
  const coverageCspr = useCountUp(Math.round(motesToCsprNumber(COVERAGE_OUTSTANDING_MOTES)));
  const ratioCount = useCountUp(Number.isFinite(pool.ratio) ? pool.ratio : 0, { decimals: 2 });
  const stakerCount = useCountUp(pool.stakerCount);

  const handleStake = useCallback(async () => {
    setError(null);
    const motes = csprToMotes(amount);
    if (BigInt(motes) <= 0n) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setStaking(true);
    try {
      const result = await getSdk().stake(motes);
      setUserStakedMotes((prev) => prev + BigInt(motes));
      setLastStakeHash(result.deployHash);
      setRewardsClaimed(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStaking(false);
    }
  }, [amount]);

  // The on-chain unstake, delegated from the UnstakeFlow. Returns the deploy hash.
  const handleUnstake = useCallback(async (motes: string): Promise<string> => {
    const result = await getSdk().unstake(motes);
    setUserStakedMotes((prev) => {
      const next = prev - BigInt(motes);
      return next > 0n ? next : 0n;
    });
    return result.deployHash;
  }, []);

  const handleClaim = useCallback(() => {
    // No on-chain reward-claim entrypoint exists in this build's SDK surface, so
    // in mock mode claiming simply settles the accrued share locally.
    setRewardsClaimed(true);
  }, []);

  const hasStake = userStakedMotes > 0n;

  return (
    <div className="stack" style={{ gap: 'var(--cp-space-2xl)' }}>
      <header className="page-header">
        <h1>Staking</h1>
        <p>
          Back the insurance vault. Stake CSPR into the LP pool that collateralises outstanding
          coverage and earn a pro-rata share of premiums. Withdrawals clear an on-chain solvency
          guard — no timed cooldown.
        </p>
      </header>

      {/* Pool health */}
      <Card>
        <div className="row row--between" style={{ marginBottom: 'var(--cp-space-lg)' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Pool health
          </h2>
          <Badge status={LEVEL_BADGE[pool.level]}>{pool.level}</Badge>
        </div>
        <div className="grid grid--4">
          <StatTile label="Total staked" value={`${groupThousands(totalStakedCspr)} CSPR`} />
          <StatTile label="Coverage outstanding" value={`${groupThousands(coverageCspr)} CSPR`} />
          <StatTile
            label="Solvency ratio"
            value={Number.isFinite(pool.ratio) ? `${ratioCount}x` : '∞'}
            delta={`floor ${formatRatio(Number(MIN_SOLVENCY_RATIO_BPS) / 10_000)}`}
            deltaDirection={
              pool.level === 'HEALTHY' ? 'up' : pool.level === 'CRITICAL' ? 'down' : 'neutral'
            }
          />
          <StatTile label="Stakers" value={stakerCount} />
        </div>

        {/* Solvency bar with the guard-floor marker. */}
        <SolvencyBar ratio={pool.ratio} level={pool.level} />
      </Card>

      <div className="grid grid--2">
        {/* Stake card */}
        <Card>
          <h2 className="section-title">Stake CSPR</h2>
          {!isConnected && (
            <p className="notice notice--info" role="status">
              Connect your wallet to sign <span className="mono">stake</span>.
            </p>
          )}
          <div className="stack" style={{ marginTop: 'var(--cp-space-md)' }}>
            <label className="field">
              <span className="field__label">Amount (CSPR)</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                aria-label="Amount to stake in CSPR"
              />
            </label>
            <Button
              variant="primary"
              onClick={() => void handleStake()}
              disabled={!isConnected || staking}
            >
              {staking ? 'Staking…' : 'Stake'}
            </Button>
            {lastStakeHash && (
              <p className="notice notice--success" role="status">
                ✓ Staked. Pool position now{' '}
                <strong>{formatMotes(userStakedMotes.toString())}</strong>.
              </p>
            )}
            <p className="muted" style={{ fontSize: 'var(--cp-fontsize-xs)' }}>
              LP rewards accrue from the premiums policyholders pay into the vault, distributed
              pro-rata to staked capital. Your stake also raises the pool&apos;s solvency ratio.
            </p>
          </div>
        </Card>

        {/* My position */}
        <Card>
          <h2 className="section-title">My position</h2>
          {!hasStake ? (
            <p className="empty">
              No position yet. Stake CSPR to back the vault and earn premiums.
            </p>
          ) : (
            <>
              <div className="grid grid--3">
                <StatTile label="Staked" value={formatMotes(userStakedMotes.toString())} />
                <StatTile label="Pool share" value={`${pool.share.toFixed(2)}%`} />
                <StatTile
                  label="Pending rewards"
                  value={formatMotes(pool.rewards.toString())}
                  deltaDirection="up"
                  delta={pool.rewards > 0n ? 'from premiums' : undefined}
                />
              </div>
              <div className="row" style={{ marginTop: 'var(--cp-space-lg)' }}>
                <Button variant="secondary" onClick={handleClaim} disabled={pool.rewards <= 0n}>
                  Claim rewards
                </Button>
                {rewardsClaimed && (
                  <span className="muted" style={{ fontSize: 'var(--cp-fontsize-sm)' }}>
                    Rewards settled to your wallet.
                  </span>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {/* Animated unstake flow */}
      <Card>
        <UnstakeFlow
          userStakedMotes={userStakedMotes}
          withdrawableMotes={pool.withdrawable}
          walletConnected={isConnected}
          onExecute={handleUnstake}
        />
        {!hasStake && (
          <p
            className="muted"
            style={{ fontSize: 'var(--cp-fontsize-xs)', marginTop: 'var(--cp-space-md)' }}
          >
            Stake first to enable a withdrawal request.
          </p>
        )}
      </Card>

      <div className="grid grid--2">
        <Card>
          <Tag>Why a guard, not a timer</Tag>
          <h2 className="section-title" style={{ marginTop: 'var(--cp-space-md)' }}>
            Capital can&apos;t walk out from under live coverage
          </h2>
          <p className="muted">
            Instead of a fixed unbonding clock, the vault enforces a minimum collateralisation ratio
            on every withdrawal. You can always pull the free surplus immediately; capital backing
            outstanding policies unlocks as that coverage expires.
          </p>
        </Card>
        <LiveFeed />
      </div>
    </div>
  );
}

/** A horizontal solvency bar with the guard-floor marker. */
function SolvencyBar({
  ratio,
  level,
}: {
  ratio: number;
  level: ReturnType<typeof solvencyLevelFor>;
}): JSX.Element {
  // Map the ratio onto a 0–100 scale where 200% (2.0x) fills the bar.
  const pct = Number.isFinite(ratio) ? Math.max(0, Math.min(100, (ratio / 2) * 100)) : 100;
  const floorPct = (Number(MIN_SOLVENCY_RATIO_BPS) / 10_000 / 2) * 100;
  const color =
    level === 'HEALTHY'
      ? 'var(--cp-color-proof)'
      : level === 'CAUTION'
        ? 'var(--cp-color-warn)'
        : 'var(--cp-color-fail)';
  return (
    <div className="stake-solvency" style={{ marginTop: 'var(--cp-space-lg)' }}>
      <div className="attn-track stake-solvency__track">
        <i style={{ width: `${pct}%`, backgroundColor: color }} />
        <span
          className="stake-solvency__floor"
          style={{ left: `${floorPct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="stake-solvency__legend">
        <span className="muted">Collateralisation</span>
        <span className="mono">
          guard floor {formatRatio(Number(MIN_SOLVENCY_RATIO_BPS) / 10_000)} · backs{' '}
          {formatMotes(COVERAGE_OUTSTANDING_MOTES.toString())}
        </span>
      </div>
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof CasperProofSdkError) {
    return `${err.code}: ${err.message}`;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}
