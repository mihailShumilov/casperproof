/**
 * Slash demo — the economic-security climax.
 *
 * A guided five-step flow over the SDK:
 *   1. Submit a stake-backed attestation (status Active).
 *   2. Tamper the payload and verify → FAIL (recomputed hash ≠ on-chain).
 *   3. Challenge (posts a bond) → status Challenged.
 *   4. Resolve fraudulent → status Slashed: stake is split between the
 *      challenger reward and the treasury; the attestor's reputation takes the hit.
 *
 * The slash split shown (reward_bps) mirrors the on-chain economics described in
 * the attestation-oracle skill; the amounts are computed from the actual stake.
 */
'use client';

import { useCallback, useState } from 'react';
import { Badge, Button, Card, HashDisplay, Spinner, StatTile, VerdictPill } from '@casperproof/ui';
import type { Attestation, VerifyResult } from '@casperproof/casper-sdk';
import { CasperProofSdkError } from '@casperproof/casper-sdk';
import { getSdk } from '@/lib/sdk';
import { useWallet } from '@/lib/wallet';
import { LiveFeed } from '@/components/LiveFeed';
import { JsonField } from '@/components/JsonField';
import { formatMotes, parseJson, prettyJson, statusToBadge } from '@/lib/format';

/** Challenger reward share of a slashed stake (basis points). Demo economics. */
const REWARD_BPS = 5000n; // 50% to challenger, 50% to treasury.
const HONEST_OUTPUT = { score: 42, tier: 'MEDIUM' };
const TAMPERED_OUTPUT = { score: 5, tier: 'LOW' };

type Step = 'idle' | 'submitted' | 'verified' | 'challenged' | 'slashed';

export function SlashView(): JSX.Element {
  const { isConnected, account } = useWallet();

  const [step, setStep] = useState<Step>('idle');
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [tamperedText, setTamperedText] = useState(() => prettyJson(TAMPERED_OUTPUT));
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stake = attestation ? BigInt(attestation.stake) : 0n;
  const challengerReward = (stake * REWARD_BPS) / 10000n;
  const treasuryCut = stake - challengerReward;

  const reset = useCallback(() => {
    setStep('idle');
    setAttestation(null);
    setVerifyResult(null);
    setTamperedText(prettyJson(TAMPERED_OUTPUT));
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const sdk = getSdk();
      const result = await sdk.submitAttestation({
        modelId: 'casperproof-riskscorer-v1',
        input: { address: 'account-hash-deadbeef', features: { txCount: 12 } },
        output: HONEST_OUTPUT,
        stake: '3000000000', // 3 CSPR at risk.
        uri: `s3://casperproof-payloads/slash-${Date.now()}.json#trigger=agent_error`,
        attestor: account?.publicKey,
      });
      const full = await sdk.getAttestation(result.id);
      setAttestation(full);
      setStep('submitted');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [account?.publicKey]);

  const handleVerify = useCallback(async () => {
    if (!attestation) return;
    const parsed = parseJson(tamperedText);
    if (!parsed.ok) return;
    setError(null);
    setBusy(true);
    try {
      const res = await getSdk().verify(attestation.id, parsed.value as never);
      setVerifyResult(res);
      setStep('verified');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [attestation, tamperedText]);

  const handleChallenge = useCallback(async () => {
    if (!attestation) return;
    setError(null);
    setBusy(true);
    try {
      const sdk = getSdk();
      await sdk.challenge(attestation.id);
      setAttestation(await sdk.getAttestation(attestation.id));
      setStep('challenged');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [attestation]);

  const handleResolve = useCallback(async () => {
    if (!attestation) return;
    setError(null);
    setBusy(true);
    try {
      const sdk = getSdk();
      await sdk.resolve(attestation.id, true);
      setAttestation(await sdk.getAttestation(attestation.id));
      setStep('slashed');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [attestation]);

  return (
    <div className="stack" style={{ gap: 'var(--cp-space-2xl)' }}>
      <header className="page-header">
        <h1>Slash demo</h1>
        <p>
          Bad proofs are expensive. Submit an attestation, tamper its payload until verification
          FAILs, challenge it, and resolve it fraudulent — the staked CSPR is slashed and split
          between the challenger and the treasury.
        </p>
      </header>

      {!isConnected && (
        <p className="notice notice--info" role="status">
          Connect your wallet to drive the slash flow.
        </p>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid--2">
        <div className="stack">
          {/* Step 1 */}
          <Card>
            <div className="row row--between">
              <h2 className="section-title" style={{ margin: 0 }}>
                1 · Submit attestation
              </h2>
              {attestation && (
                <Badge status={statusToBadge(attestation.status)}>{attestation.status}</Badge>
              )}
            </div>
            <p className="muted">
              An honest-looking proof goes on-chain with <strong>3 CSPR</strong> staked behind it.
            </p>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={!isConnected || busy || step !== 'idle'}
            >
              {busy && step === 'idle' ? (
                <Spinner size="sm" label="Submitting" />
              ) : (
                'Submit attestation'
              )}
            </Button>
            {attestation && (
              <dl className="kv" style={{ marginTop: 'var(--cp-space-md)' }}>
                <dt>ID</dt>
                <dd>#{attestation.id}</dd>
                <dt>Commitment</dt>
                <dd>
                  <HashDisplay hash={attestation.commitment} prefix="" />
                </dd>
                <dt>Stake</dt>
                <dd>{formatMotes(attestation.stake)}</dd>
              </dl>
            )}
          </Card>

          {/* Step 2 */}
          {attestation && (
            <Card>
              <h2 className="section-title">2 · Tamper &amp; verify</h2>
              <p className="muted">
                The honest output was <span className="mono">{prettyJson(HONEST_OUTPUT)}</span>. The
                payload below is altered — verifying it recomputes a different hash.
              </p>
              <JsonField label="Tampered payload" value={tamperedText} onChange={setTamperedText} />
              <Button
                variant="primary"
                onClick={() => void handleVerify()}
                disabled={busy || !parseJson(tamperedText).ok}
              >
                {busy && step === 'submitted' ? 'Verifying…' : 'Verify (expect FAIL)'}
              </Button>
              {verifyResult && (
                <Card style={{ background: 'var(--cp-color-bg)', marginTop: 'var(--cp-space-md)' }}>
                  <div className="row" style={{ marginBottom: 'var(--cp-space-md)' }}>
                    <VerdictPill verdict={verifyResult.valid ? 'pass' : 'fail'} />
                    <span className="muted">
                      {verifyResult.valid
                        ? 'Unexpected PASS — edit the payload.'
                        : 'Tamper detected.'}
                    </span>
                  </div>
                  <dl className="kv">
                    <dt>On-chain hash</dt>
                    <dd>
                      <HashDisplay hash={verifyResult.onchainHash} prefix="" />
                    </dd>
                    <dt>Recomputed hash</dt>
                    <dd>
                      <HashDisplay hash={verifyResult.recomputedHash} prefix="" />
                    </dd>
                  </dl>
                </Card>
              )}
            </Card>
          )}

          {/* Step 3 */}
          {verifyResult && !verifyResult.valid && (
            <Card>
              <h2 className="section-title">3 · Challenge</h2>
              <p className="muted">Post a dispute bond to challenge the tampered proof.</p>
              <Button
                variant="primary"
                onClick={() => void handleChallenge()}
                disabled={busy || step !== 'verified'}
              >
                {busy && step === 'verified' ? 'Challenging…' : 'Challenge attestation'}
              </Button>
            </Card>
          )}

          {/* Step 4 */}
          {step === 'challenged' || step === 'slashed' ? (
            <Card>
              <h2 className="section-title">4 · Resolve &amp; slash</h2>
              <p className="muted">
                The resolver rules the attestation fraudulent. The stake is slashed and split.
              </p>
              <Button
                variant="primary"
                onClick={() => void handleResolve()}
                disabled={busy || step !== 'challenged'}
              >
                {busy && step === 'challenged' ? 'Resolving…' : 'Resolve fraudulent → slash'}
              </Button>
            </Card>
          ) : null}

          {step === 'slashed' && (
            <Button variant="ghost" onClick={reset}>
              Run again
            </Button>
          )}
        </div>

        {/* Right column: economics + feed */}
        <div className="stack">
          <Card>
            <h2 className="section-title">Slash economics</h2>
            {attestation ? (
              <>
                <div className="grid grid--3">
                  <StatTile label="Stake at risk" value={formatMotes(attestation.stake)} />
                  <StatTile
                    label="→ Challenger"
                    value={formatMotes(challengerReward.toString())}
                    deltaDirection={step === 'slashed' ? 'up' : 'neutral'}
                    delta={step === 'slashed' ? 'paid' : `${Number(REWARD_BPS) / 100}%`}
                  />
                  <StatTile
                    label="→ Treasury"
                    value={formatMotes(treasuryCut.toString())}
                    deltaDirection={step === 'slashed' ? 'up' : 'neutral'}
                    delta={step === 'slashed' ? 'paid' : `${(10000 - Number(REWARD_BPS)) / 100}%`}
                  />
                </div>
                <p
                  className="notice notice--warn"
                  role="status"
                  style={{ marginTop: 'var(--cp-space-md)' }}
                >
                  {step === 'slashed'
                    ? `Slashed. ${formatMotes(challengerReward.toString())} moved to the challenger, ${formatMotes(treasuryCut.toString())} to the treasury. Attestor reputation: slashed +1.`
                    : 'On a fraudulent resolution the stake moves here.'}
                </p>
              </>
            ) : (
              <p className="empty">Submit an attestation to see the stake at risk.</p>
            )}
          </Card>
          <LiveFeed />
        </div>
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
