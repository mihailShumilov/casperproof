/**
 * Insurance view: the oracle proving itself in DeFi.
 *
 * Flow: (1) `getRiskScore(address)` for an address; (2) `createPolicy` for a
 * chosen coverage + covered trigger; (3) "simulate trigger" submits an
 * attestation whose off-chain payload is tagged `#trigger=<type>`, then files a
 * `submitClaim(policyId, attestationId)`. The mock backend derives the trigger
 * from the attestation and, if covered, pays the policy's coverage — the
 * auto-payout. StatTiles + Recharts visualise the score and the vault solvency.
 *
 * No metrics are fabricated: the score, payout, and solvency numbers are all
 * derived from SDK results and the policies the user actually created.
 */
'use client';

import { useCallback, useMemo, useState } from 'react';
import { Badge, Button, Card, HashDisplay, Spinner, StatTile, Tag } from '@casperproof/ui';
import type { ClaimResult, Policy, RiskScore, TriggerType } from '@casperproof/casper-sdk';
import { CasperProofSdkError } from '@casperproof/casper-sdk';
import { getSdk } from '@/lib/sdk';
import { useWallet } from '@/lib/wallet';
import { LiveFeed } from '@/components/LiveFeed';
import { RiskGauge, SolvencyChart } from '@/components/SolvencyChart';
import { formatMotes, statusToBadge } from '@/lib/format';

const TRIGGER_LABELS: Record<TriggerType, string> = {
  exploit: 'Exploit',
  oracle_failure: 'Oracle failure',
  agent_error: 'Agent error',
  governance_attack: 'Governance attack',
};
const TRIGGERS = Object.keys(TRIGGER_LABELS) as TriggerType[];

const DEFAULT_ADDRESS =
  'account-hash-1f4c0a9e2b7d6f8a3c5e1b0d9a7f6e4c2b1a0d9e8f7c6b5a4d3e2f1a0b9c8d7e';
const DEFAULT_COVERAGE = '5000000000'; // 5 CSPR
const DEFAULT_PREMIUM = '250000000'; // 0.25 CSPR

export function InsuranceView(): JSX.Element {
  const { isConnected, account } = useWallet();

  // --- risk score ---
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [score, setScore] = useState<RiskScore | null>(null);
  const [scoring, setScoring] = useState(false);

  // --- policy ---
  const [coverage, setCoverage] = useState(DEFAULT_COVERAGE);
  const [premium, setPremium] = useState(DEFAULT_PREMIUM);
  const [trigger, setTrigger] = useState<TriggerType>('oracle_failure');
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [buying, setBuying] = useState(false);

  // --- claim ---
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScore = useCallback(async () => {
    setError(null);
    setScoring(true);
    try {
      setScore(await getSdk().getRiskScore(address.trim()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setScoring(false);
    }
  }, [address]);

  const handleBuy = useCallback(async () => {
    setError(null);
    setBuying(true);
    try {
      const sdk = getSdk();
      const policy = await sdk.createPolicy({
        coverage,
        premium,
        triggerTypes: [trigger],
        // Far-future expiry so the demo claim is always within the active window.
        expiry: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
        holder: account?.publicKey,
      });
      setPolicies((prev) => [policy, ...prev]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBuying(false);
    }
  }, [account?.publicKey, coverage, premium, trigger]);

  const handleSimulateTrigger = useCallback(
    async (policy: Policy) => {
      setError(null);
      setClaiming(true);
      try {
        const sdk = getSdk();
        // The trigger an attestation reports is encoded in its off-chain URI tag.
        const covered = policy.triggerTypes[0] ?? 'oracle_failure';
        const submitted = await sdk.submitAttestation({
          modelId: 'casperproof-claim-oracle-v1',
          input: { policyId: policy.id, event: covered },
          output: { trigger: covered, covered: true },
          stake: '1000000000',
          uri: `s3://casperproof-payloads/claim-${policy.id}-${Date.now()}.json#trigger=${covered}`,
          attestor: account?.publicKey,
        });
        const result = await sdk.submitClaim(policy.id, submitted.id);
        setClaim(result);
        // Reflect the policy's new "Claimed" status.
        setPolicies((prev) =>
          prev.map((p) => (p.id === policy.id ? { ...p, status: 'Claimed' } : p)),
        );
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setClaiming(false);
      }
    },
    [account?.publicKey],
  );

  // Vault solvency derived from the policies the user created (no fakes).
  const solvency = useMemo(() => {
    const coverageOutstanding = policies
      .filter((p) => p.status === 'Active')
      .reduce((sum, p) => sum + bigIntFromMotes(p.coverage), 0n);
    const premiumsCollected = policies.reduce((sum, p) => sum + bigIntFromMotes(p.premium), 0n);
    // A nominal vault reserve so the solvency guard is visible in the demo.
    const reserve = 50_000_000_000n; // 50 CSPR seed reserve
    const free = reserve + premiumsCollected - coverageOutstanding;
    return {
      coverageOutstanding,
      premiumsCollected,
      free,
      data: [
        { name: 'Coverage', value: motesToCspr(coverageOutstanding) },
        { name: 'Premiums', value: motesToCspr(premiumsCollected) },
        { name: 'Free reserve', value: motesToCspr(free) },
      ],
    };
  }, [policies]);

  return (
    <div className="stack" style={{ gap: 'var(--cp-space-2xl)' }}>
      <header className="page-header">
        <h1>Insurance</h1>
        <p>
          Parametric cover backed by the oracle. Score an address, buy a policy, then simulate a
          covered trigger — the vault pays out automatically the moment an attested decision matches
          the policy.
        </p>
      </header>

      <div className="grid grid--2">
        {/* Risk score */}
        <Card>
          <h2 className="section-title">1 · Risk score</h2>
          <div className="stack">
            <label className="field">
              <span className="field__label">Address</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                spellCheck={false}
                aria-label="Address to score"
              />
            </label>
            <Button variant="primary" onClick={() => void handleScore()} disabled={scoring}>
              {scoring ? 'Scoring…' : 'Get risk score'}
            </Button>
            {score && (
              <>
                <div className="grid grid--3" style={{ marginTop: 'var(--cp-space-md)' }}>
                  <StatTile label="Score" value={`${score.score}/100`} />
                  <StatTile label="Tier" value={score.tier} />
                  <StatTile
                    label="Address"
                    value={<HashDisplay hash={score.address} prefix="" copyable={false} />}
                  />
                </div>
                <RiskGauge score={score.score} tier={score.tier} />
              </>
            )}
          </div>
        </Card>

        {/* Buy policy */}
        <Card>
          <h2 className="section-title">2 · Buy a policy</h2>
          {!isConnected && (
            <p className="notice notice--info" role="status">
              Connect your wallet to sign <span className="mono">buy_policy</span>.
            </p>
          )}
          <div className="stack" style={{ marginTop: 'var(--cp-space-md)' }}>
            <label className="field">
              <span className="field__label">Coverage (motes)</span>
              <input
                value={coverage}
                onChange={(e) => setCoverage(e.target.value)}
                inputMode="numeric"
                aria-label="Coverage in motes"
              />
            </label>
            <label className="field">
              <span className="field__label">Premium (motes)</span>
              <input
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                inputMode="numeric"
                aria-label="Premium in motes"
              />
            </label>
            <label className="field">
              <span className="field__label">Covered trigger</span>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as TriggerType)}
                aria-label="Covered trigger"
              >
                {TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="primary"
              onClick={() => void handleBuy()}
              disabled={!isConnected || buying}
            >
              {buying ? 'Buying…' : 'Buy policy'}
            </Button>
          </div>
        </Card>
      </div>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {/* Policies + claim */}
      <section>
        <h2 className="section-title">3 · Policies &amp; auto-payout</h2>
        {policies.length === 0 ? (
          <p className="empty">No policies yet. Buy one above, then simulate a covered trigger.</p>
        ) : (
          <div className="list">
            {policies.map((p) => (
              <Card key={p.id}>
                <div className="row row--between">
                  <div className="list-item__main">
                    <span className="list-item__id">
                      Policy #{p.id} · {formatMotes(p.coverage)} cover
                    </span>
                    <span className="list-item__meta">
                      premium {formatMotes(p.premium)} · covers{' '}
                      {p.triggerTypes.map((t) => (
                        <Tag key={t} style={{ marginRight: 4 }}>
                          {TRIGGER_LABELS[t]}
                        </Tag>
                      ))}
                    </span>
                  </div>
                  <div className="row">
                    <Badge status={statusToBadge(p.status)}>{p.status}</Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleSimulateTrigger(p)}
                      disabled={p.status !== 'Active' || claiming}
                    >
                      {claiming ? <Spinner size="sm" label="Claiming" /> : 'Simulate trigger'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {claim && claim.paid && (
          <p
            className="notice notice--success"
            role="status"
            style={{ marginTop: 'var(--cp-space-lg)' }}
          >
            ✓ Auto-payout: policy <span className="mono">#{claim.policyId}</span> paid{' '}
            <strong>{formatMotes(claim.amount)}</strong> against attestation{' '}
            <span className="mono">#{claim.attestationId}</span>. Deploy{' '}
            <HashDisplay hash={claim.deployHash} prefix="" copyable={false} />.
          </p>
        )}
      </section>

      {/* Solvency + feed */}
      <div className="grid grid--2">
        <Card>
          <h2 className="section-title">Vault solvency</h2>
          <div className="grid grid--3" style={{ marginBottom: 'var(--cp-space-md)' }}>
            <StatTile
              label="Coverage out"
              value={`${motesToCspr(solvency.coverageOutstanding)} CSPR`}
            />
            <StatTile label="Premiums" value={`${motesToCspr(solvency.premiumsCollected)} CSPR`} />
            <StatTile
              label="Free reserve"
              value={`${motesToCspr(solvency.free)} CSPR`}
              deltaDirection={solvency.free > 0n ? 'up' : 'down'}
              delta={solvency.free > 0n ? 'solvent' : 'at risk'}
            />
          </div>
          <SolvencyChart data={solvency.data} />
        </Card>
        <LiveFeed />
      </div>
    </div>
  );
}

function bigIntFromMotes(motes: string): bigint {
  try {
    return BigInt(motes);
  } catch {
    return 0n;
  }
}

/** Convert motes to a rounded whole-CSPR number for charting. */
function motesToCspr(motes: bigint): number {
  return Number(motes / 1_000_000n) / 1000;
}

function errorMessage(err: unknown): string {
  if (err instanceof CasperProofSdkError) {
    return `${err.code}: ${err.message}`;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}
