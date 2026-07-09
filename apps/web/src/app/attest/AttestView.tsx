/**
 * Attest view — the headline attestation experience.
 *
 * Enter an address (or any input), run the animated risk-assessment pipeline,
 * and land on a shareable percentage result. The overall score is read from the
 * SDK (`getRiskScore`, deterministic in mock mode); the 15-factor breakdown is
 * reconstructed locally by `computeFactors`. The result is fully determined by
 * the input, so its link reproduces the same assessment for anyone.
 */
'use client';

import { useCallback, useState } from 'react';
import { Button, Card, Tag } from '@casperproof/ui';
import { AttestationPipeline } from '@/components/AttestationPipeline';
import { LiveFeed } from '@/components/LiveFeed';
import { FACTORS, encodeSeed } from '@/lib/riskFactors';

const DEFAULT_ADDRESS =
  'account-hash-1f4c0a9e2b7d6f8a3c5e1b0d9a7f6e4c2b1a0d9e8f7c6b5a4d3e2f1a0b9c8d7e';

export function AttestView(): JSX.Element {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  // The seed locked in for the current run (null = not started). Keying the
  // pipeline on `runId` restarts the animation cleanly on each run.
  const [seed, setSeed] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  const run = useCallback(() => {
    setSeed(address.trim());
    setRunId((n) => n + 1);
  }, [address]);

  const canRun = address.trim().length > 0;

  return (
    <div className="stack" style={{ gap: 'var(--cp-space-2xl)' }}>
      <header className="page-header">
        <h1>Risk assessment</h1>
        <p>
          Score any agent or address across {FACTORS.length} on-chain factors, then anchor the
          verdict as a stake-backed attestation. Watch the model run live, then share the percentage
          result.
        </p>
      </header>

      <div className="grid grid--2">
        <Card>
          <h2 className="section-title">Assess an agent</h2>
          <div className="stack">
            <label className="field">
              <span className="field__label">Address or input</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                spellCheck={false}
                aria-label="Address or input to assess"
              />
            </label>
            <div className="row">
              <Button variant="primary" onClick={run} disabled={!canRun}>
                {seed === null ? 'Run risk assessment' : 'Re-run assessment'}
              </Button>
              <Tag>{FACTORS.length} factors · 4 categories</Tag>
            </div>
            <p className="muted" style={{ fontSize: 'var(--cp-fontsize-sm)' }}>
              Read-only — scoring needs no wallet. Anchoring the result on-chain is signed from the
              Oracle.
            </p>
          </div>
        </Card>

        <LiveFeed />
      </div>

      {seed !== null && (
        <section>
          <h2 className="section-title">Assessment pipeline</h2>
          <AttestationPipeline
            key={runId}
            input={seed}
            resultHref={`/attestation/${encodeSeed(seed)}`}
          />
        </section>
      )}
    </div>
  );
}
