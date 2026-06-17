/**
 * Oracle view: submit an attestation, list attestations, and verify one.
 *
 * Submit → `sdk.submitAttestation` computes the input/output hashes + commitment
 * and writes `submit_attestation`. Verify → `sdk.verify(id, payload)` recomputes
 * the output hash from a (possibly edited) payload and compares it byte-for-byte
 * to the on-chain commitment, yielding PASS or FAIL plus both hashes.
 */
'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  HashDisplay,
  Spinner,
  Tag,
  VerdictPill,
} from '@casperproof/ui';
import type { Attestation, VerifyResult } from '@casperproof/casper-sdk';
import { CasperProofSdkError } from '@casperproof/casper-sdk';
import { getSdk } from '@/lib/sdk';
import { useAttestations } from '@/lib/useAttestations';
import { useWallet } from '@/lib/wallet';
import { LiveFeed } from '@/components/LiveFeed';
import { JsonField } from '@/components/JsonField';
import { formatMotes, parseJson, prettyJson, statusToBadge } from '@/lib/format';

const DEFAULT_MODEL = 'casperproof-riskscorer-v1';
const DEFAULT_INPUT = prettyJson({ address: 'account-hash-abc123', features: { txCount: 412 } });
const DEFAULT_OUTPUT = prettyJson({ score: 73, tier: 'HIGH' });
const DEFAULT_STAKE = '2000000000'; // 2 CSPR, above the 1 CSPR mock minimum.

export function OracleView(): JSX.Element {
  const { isConnected, account } = useWallet();
  const { attestations, loading, refresh } = useAttestations();

  // --- submit form state ---
  const [modelId, setModelId] = useState(DEFAULT_MODEL);
  const [inputText, setInputText] = useState(DEFAULT_INPUT);
  const [outputText, setOutputText] = useState(DEFAULT_OUTPUT);
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmittedId, setLastSubmittedId] = useState<number | null>(null);

  const inputValid = parseJson(inputText).ok;
  const outputValid = parseJson(outputText).ok;
  const canSubmit = isConnected && inputValid && outputValid && modelId.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    const input = parseJson(inputText);
    const output = parseJson(outputText);
    if (!input.ok || !output.ok) return;
    setSubmitting(true);
    try {
      const sdk = getSdk();
      const result = await sdk.submitAttestation({
        modelId: modelId.trim(),
        input: input.value as never,
        output: output.value as never,
        stake,
        // Tag the off-chain URI so the insurance demo can derive a covered trigger.
        uri: `s3://casperproof-payloads/${Date.now()}.json#trigger=oracle_failure`,
        attestor: account?.publicKey,
      });
      setLastSubmittedId(result.id);
      await refresh();
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [account?.publicKey, inputText, modelId, outputText, refresh, stake]);

  return (
    <div className="stack" style={{ gap: 'var(--cp-space-2xl)' }}>
      <header className="page-header">
        <h1>Oracle</h1>
        <p>
          Publish a stake-backed proof of an AI decision, then verify any attestation against its
          on-chain commitment. The contract stores hashes only — verification recomputes them
          from the payload.
        </p>
      </header>

      <div className="grid grid--2">
        {/* Submit */}
        <Card>
          <h2 className="section-title">Submit an attestation</h2>
          {!isConnected && (
            <p className="notice notice--info" role="status">
              Connect your wallet to sign the <span className="mono">submit_attestation</span>{' '}
              deploy.
            </p>
          )}
          <div className="stack" style={{ marginTop: 'var(--cp-space-md)' }}>
            <label className="field">
              <span className="field__label">Model ID</span>
              <input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                spellCheck={false}
                aria-label="Model ID"
              />
            </label>
            <JsonField label="Input JSON" value={inputText} onChange={setInputText} />
            <JsonField label="Output JSON" value={outputText} onChange={setOutputText} />
            <label className="field">
              <span className="field__label">Stake (motes · min 1,000,000,000)</span>
              <input
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                inputMode="numeric"
                spellCheck={false}
                aria-label="Stake in motes"
              />
            </label>
            {submitError && (
              <p className="notice notice--error" role="alert">
                {submitError}
              </p>
            )}
            <Button variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Spinner size="sm" label="Submitting" /> Submitting…
                </>
              ) : (
                'Submit attestation'
              )}
            </Button>
            {lastSubmittedId !== null && !submitError && (
              <p className="notice notice--success" role="status">
                Attestation <span className="mono">#{lastSubmittedId}</span> submitted and staked.
              </p>
            )}
          </div>
        </Card>

        {/* Live feed */}
        <LiveFeed />
      </div>

      {/* List + verify */}
      <section>
        <h2 className="section-title">Attestations</h2>
        {loading ? (
          <div className="empty">
            <Spinner label="Loading attestations" />
          </div>
        ) : attestations.length === 0 ? (
          <p className="empty">No attestations yet. Submit one above to anchor your first proof.</p>
        ) : (
          <div className="list">
            {attestations.map((a) => (
              <AttestationRow key={a.id} attestation={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** A single attestation row with an inline verify affordance. */
function AttestationRow({ attestation }: { attestation: Attestation }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="row row--between">
        <div className="list-item__main">
          <span className="list-item__id">
            #{attestation.id} · {attestation.modelId}
          </span>
          <span className="list-item__meta">
            stake {formatMotes(attestation.stake)} ·{' '}
            <HashDisplay hash={attestation.commitment} prefix="" copyable={false} /> commitment
          </span>
        </div>
        <div className="row">
          <Badge status={statusToBadge(attestation.status)}>{attestation.status}</Badge>
          <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Verify'}
          </Button>
        </div>
      </div>
      {open && <VerifyPanel attestation={attestation} />}
    </Card>
  );
}

/** Inline verification: edit the payload, recompute, compare to on-chain. */
export function VerifyPanel({ attestation }: { attestation: Attestation }): JSX.Element {
  // Pre-fill with the canonical output the demo submits, so an unchanged verify
  // PASSes; editing it (tampering) flips the verdict to FAIL.
  const [payloadText, setPayloadText] = useState(() => prettyJson({ score: 73, tier: 'HIGH' }));
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payloadValid = useMemo(() => parseJson(payloadText).ok, [payloadText]);

  const handleVerify = useCallback(async () => {
    setError(null);
    const parsed = parseJson(payloadText);
    if (!parsed.ok) return;
    setVerifying(true);
    try {
      const sdk = getSdk();
      const res = await sdk.verify(attestation.id, parsed.value as never);
      setResult(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setVerifying(false);
    }
  }, [attestation.id, payloadText]);

  return (
    <div className="stack" style={{ marginTop: 'var(--cp-space-lg)' }}>
      <JsonField
        label="Payload to verify (recomputed hash is compared to on-chain)"
        value={payloadText}
        onChange={setPayloadText}
      />
      <div className="row">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleVerify()}
          disabled={!payloadValid || verifying}
        >
          {verifying ? 'Verifying…' : 'Verify proof'}
        </Button>
        <Tag>recompute → compare</Tag>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <Card style={{ background: 'var(--cp-color-bg)' }}>
          <div className="row" style={{ marginBottom: 'var(--cp-space-md)' }}>
            <VerdictPill verdict={result.valid ? 'pass' : 'fail'} />
            <span className="muted">
              {result.valid
                ? 'Recomputed hash matches the on-chain commitment.'
                : 'Tampered — recomputed hash diverges from the on-chain commitment.'}
            </span>
          </div>
          <dl className="kv">
            <dt>On-chain hash</dt>
            <dd>
              <HashDisplay hash={result.onchainHash} prefix="" />
            </dd>
            <dt>Recomputed hash</dt>
            <dd>
              <HashDisplay hash={result.recomputedHash} prefix="" />
            </dd>
            <dt>Attestor</dt>
            <dd>
              <HashDisplay hash={result.attestor} prefix="" lead={12} tail={6} />
            </dd>
            <dt>Stake</dt>
            <dd>{formatMotes(result.stake)}</dd>
            <dt>Reputation</dt>
            <dd>
              {result.reputation.successful} ok / {result.reputation.slashed} slashed
            </dd>
          </dl>
        </Card>
      )}
    </div>
  );
}

/** Render an SDK / generic error as a user-facing string (RFC 7807 detail when present). */
function errorMessage(err: unknown): string {
  if (err instanceof CasperProofSdkError) {
    return `${err.code}: ${err.message}`;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}
