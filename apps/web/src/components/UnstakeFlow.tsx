/**
 * Animated unstake flow — a solvency-guarded withdrawal state machine.
 *
 * CasperProof's insurance vault has no fixed time cooldown; withdrawals are
 * governed by a **solvency guard**. This component walks the staker through that
 * guard with a step indicator (nodes + connectors), an animated solvency-check
 * transition (RAF progress bar, reduced-motion safe), and phase badges:
 *
 *   idle → checking → executable → done
 *                  ↘ gated (capital is backing outstanding coverage)
 *
 * In the gated state it shows exactly how much is withdrawable now and how much
 * remains locked, and offers a one-tap "withdraw the available amount" path.
 * The actual chain write is delegated to `onExecute` so the view owns the SDK.
 */
'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, prefersReducedMotion } from '@casperproof/ui';
import { formatMotes } from '@/lib/format';
import {
  csprToMotes,
  isWithdrawable,
  lockedMotes,
  type UnstakePhase,
} from '@/lib/staking';

/** Duration of the animated solvency check (ms). */
const CHECK_MS = 1100;

export interface UnstakeFlowProps {
  /** The connected staker's position, in motes. */
  userStakedMotes: bigint;
  /** Capital free to withdraw now under the solvency guard, in motes. */
  withdrawableMotes: bigint;
  /** Whether a wallet is connected (gates the request action). */
  walletConnected: boolean;
  /** Executes the on-chain unstake for `amountMotes`; resolves with the deploy hash. */
  onExecute: (amountMotes: string) => Promise<string>;
}

type StepState = 'done' | 'active' | 'gated' | 'pending';

/** Animated, solvency-guarded unstake state machine. */
export function UnstakeFlow({
  userStakedMotes,
  withdrawableMotes,
  walletConnected,
  onExecute,
}: UnstakeFlowProps): JSX.Element {
  const [phase, setPhase] = useState<UnstakePhase>('idle');
  const [amount, setAmount] = useState('');
  const [requestedMotes, setRequestedMotes] = useState(0n);
  const [progress, setProgress] = useState(0);
  const [deployHash, setDeployHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requested = useMemo(() => {
    try {
      return BigInt(csprToMotes(amount));
    } catch {
      return 0n;
    }
  }, [amount]);

  const requestValid =
    requested > 0n && requested <= userStakedMotes && walletConnected && userStakedMotes > 0n;

  // The animated solvency check. Advances a progress bar from 0→1 over CHECK_MS,
  // then resolves to `executable` or `gated`. Jumps straight to the verdict when
  // the user prefers reduced motion (and in jsdom, which has no rAF clock).
  useEffect(() => {
    if (phase !== 'checking') return;
    const settle = (): void =>
      setPhase(isWithdrawable(requestedMotes, withdrawableMotes) ? 'executable' : 'gated');

    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setProgress(1);
      settle();
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / CHECK_MS);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        settle();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, requestedMotes, withdrawableMotes]);

  const onRequest = useCallback(() => {
    if (!requestValid) return;
    setError(null);
    setProgress(0);
    setRequestedMotes(requested);
    setPhase('checking');
  }, [requestValid, requested]);

  const onWithdrawAvailable = useCallback(() => {
    setRequestedMotes(withdrawableMotes);
    setPhase('executable');
  }, [withdrawableMotes]);

  const onExecuteClick = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const hash = await onExecute(requestedMotes.toString());
      setDeployHash(hash);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unstake failed');
    } finally {
      setBusy(false);
    }
  }, [onExecute, requestedMotes]);

  const reset = useCallback(() => {
    setPhase('idle');
    setAmount('');
    setRequestedMotes(0n);
    setProgress(0);
    setDeployHash(null);
    setError(null);
  }, []);

  const locked = lockedMotes(requestedMotes, withdrawableMotes);

  return (
    <div className={`stake-unstake stake-unstake--${phase}`}>
      <div className="stake-unstake__head">
        <div>
          <h3 className="stake-unstake__title">Unstake flow</h3>
          <p className="stake-unstake__sub">
            No time cooldown — withdrawals clear an on-chain solvency guard.
          </p>
        </div>
        <PhaseBadge phase={phase} />
      </div>

      <StepRow phase={phase} progress={progress} />

      {phase === 'idle' && (
        <div className="stake-unstake__row">
          <label className="field stake-unstake__amount">
            <span className="field__label">Amount to unstake (CSPR)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              aria-label="Amount to unstake in CSPR"
            />
          </label>
          <Button variant="secondary" onClick={onRequest} disabled={!requestValid}>
            Request unstake
          </Button>
        </div>
      )}

      {phase === 'checking' && (
        <p className="stake-unstake__status" role="status">
          Checking pool solvency for {formatMotes(requestedMotes.toString())}…
        </p>
      )}

      {phase === 'executable' && (
        <div className="stake-unstake__row">
          <div>
            <span className="stake-unstake__metric-label">Solvency check passed</span>
            <span className="stake-unstake__metric stake-unstake__metric--ok">
              {formatMotes(requestedMotes.toString())} free to withdraw
            </span>
          </div>
          <Button variant="primary" onClick={() => void onExecuteClick()} disabled={busy}>
            {busy ? 'Unstaking…' : 'Execute unstake'}
          </Button>
        </div>
      )}

      {phase === 'gated' && (
        <div className="stake-unstake__gated" role="status">
          <p className="stake-unstake__gated-msg">
            Solvency guard: your capital is backing{' '}
            <strong>{formatMotes(locked.toString())}</strong> of outstanding coverage. You can
            withdraw up to <strong>{formatMotes(withdrawableMotes.toString())}</strong> now — the
            rest unlocks as coverage expires or new capital arrives.
          </p>
          <div className="stake-unstake__row">
            <Button
              variant="primary"
              onClick={onWithdrawAvailable}
              disabled={withdrawableMotes <= 0n}
            >
              Withdraw available ({formatMotes(withdrawableMotes.toString())})
            </Button>
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="stake-unstake__done" role="status">
          <p className="stake-unstake__metric stake-unstake__metric--ok">
            ✓ Unstaked {formatMotes(requestedMotes.toString())}
          </p>
          {deployHash && (
            <p className="stake-unstake__deploy mono">deploy {shorten(deployHash)}</p>
          )}
          <Button variant="ghost" size="sm" onClick={reset}>
            Unstake more
          </Button>
        </div>
      )}

      {error && (
        <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--cp-space-md)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** The pulsing phase badge. */
function PhaseBadge({ phase }: { phase: UnstakePhase }): JSX.Element {
  const map: Record<UnstakePhase, { label: string; cls: string; pulse: boolean }> = {
    idle: { label: 'Awaiting request', cls: 'stake-phase--idle', pulse: false },
    checking: { label: 'Checking solvency', cls: 'stake-phase--checking', pulse: true },
    executable: { label: 'Ready to execute', cls: 'stake-phase--ok', pulse: true },
    gated: { label: 'Solvency-gated', cls: 'stake-phase--gated', pulse: true },
    done: { label: 'Complete', cls: 'stake-phase--done', pulse: false },
  };
  const c = map[phase];
  return (
    <span className={`stake-phase ${c.cls}${c.pulse ? ' cp-pulse' : ''}`}>{c.label}</span>
  );
}

/** Step indicator: Request → Solvency check → Execute, with animated connectors. */
function StepRow({ phase, progress }: { phase: UnstakePhase; progress: number }): JSX.Element {
  const steps: { label: string; sub: string; state: StepState }[] = [
    {
      label: 'Request',
      sub: 'Choose amount',
      state: phase === 'idle' ? 'active' : 'done',
    },
    {
      label: 'Solvency check',
      sub: 'Guard floor 120%',
      state:
        phase === 'checking'
          ? 'active'
          : phase === 'gated'
            ? 'gated'
            : phase === 'idle'
              ? 'pending'
              : 'done',
    },
    {
      label: 'Execute',
      sub: 'Withdraw CSPR',
      state: phase === 'executable' ? 'active' : phase === 'done' ? 'done' : 'pending',
    },
  ];

  return (
    <div className="stake-steps">
      {steps.map((s, i) => {
        // The connector after step i flows into step i+1. During the check it
        // animates (0→1) into the active solvency node; otherwise it is full
        // once the preceding step is done.
        const checkingFirst = phase === 'checking' && i === 0;
        const fill = checkingFirst ? progress : s.state === 'done' ? 1 : 0;
        return (
          <Fragment key={s.label}>
            <StepNode index={i + 1} label={s.label} sub={s.sub} state={s.state} />
            {i < steps.length - 1 && <StepConnector fill={fill} active={checkingFirst} />}
          </Fragment>
        );
      })}
    </div>
  );
}

function StepNode({
  index,
  label,
  sub,
  state,
}: {
  index: number;
  label: string;
  sub: string;
  state: StepState;
}): JSX.Element {
  const icon = state === 'done' ? '✓' : state === 'gated' ? '!' : index;
  return (
    <div className="stake-step">
      <div className={`stake-step__node stake-step__node--${state}`} aria-hidden="true">
        {icon}
      </div>
      <div className="stake-step__text">
        <span className="stake-step__label">{label}</span>
        <span className="stake-step__sub">{sub}</span>
      </div>
    </div>
  );
}

function StepConnector({ fill, active }: { fill: number; active: boolean }): JSX.Element {
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  return (
    <div className="stake-connector">
      <i style={{ width: `${pct}%` }} className={active ? 'cp-pulse' : undefined} />
    </div>
  );
}

/** Short hash for the deploy line (no copy button needed in this compact spot). */
function shorten(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;
}
