import { describe, expect, it } from 'vitest';
import { evaluateClaim } from './claim-oracle.js';
import type { ClaimEvidence, TriggerType } from './claim-oracle.js';

const ALL: TriggerType[] = ['exploit', 'oracle_failure', 'agent_error', 'governance_attack'];

function base(overrides: Partial<ClaimEvidence> = {}): ClaimEvidence {
  return {
    policyId: 1,
    coveredTriggers: ALL,
    coverage: '1000000000',
    ...overrides,
  };
}

describe('evaluateClaim — triggers', () => {
  it('classifies and pays out a high-confidence exploit', () => {
    const r = evaluateClaim(base({ exploitDetected: true, fundsDrained: true }));
    expect(r.triggerType).toBe('exploit');
    expect(r.decision).toBe('payout');
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
    expect(r.amount).toBe('1000000000');
  });

  it('classifies and pays out an oracle_failure (stale + deviation)', () => {
    const r = evaluateClaim(base({ oracleStale: true, oracleDeviationBps: 1500 }));
    expect(r.triggerType).toBe('oracle_failure');
    expect(r.decision).toBe('payout');
  });

  it('caps oracle deviation contribution at extreme deviation', () => {
    const r = evaluateClaim(base({ oracleStale: true, oracleDeviationBps: 100000 }));
    expect(r.triggerType).toBe('oracle_failure');
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('classifies and pays out an agent_error (slashed + misbehaved)', () => {
    const r = evaluateClaim(base({ agentSlashed: true, agentMisbehaved: true }));
    expect(r.triggerType).toBe('agent_error');
    expect(r.decision).toBe('payout');
  });

  it('classifies and pays out a governance_attack', () => {
    const r = evaluateClaim(base({ maliciousProposal: true, governanceTakeover: true }));
    expect(r.triggerType).toBe('governance_attack');
    expect(r.decision).toBe('payout');
  });
});

describe('evaluateClaim — decisions', () => {
  it('rejects with no trigger when there is no positive evidence', () => {
    const r = evaluateClaim(base());
    expect(r.decision).toBe('reject');
    expect(r.triggerType).toBeNull();
    expect(r.confidence).toBe(0);
    expect(r.amount).toBe('0');
  });

  it('sends a mid-confidence single-signal incident to review', () => {
    const r = evaluateClaim(base({ agentMisbehaved: true }));
    expect(r.decision).toBe('review');
    expect(r.triggerType).toBe('agent_error');
    expect(r.confidence).toBeGreaterThanOrEqual(0.4);
    expect(r.confidence).toBeLessThan(0.7);
  });

  it('rejects a low-confidence incident', () => {
    // Single weak deviation just below the 5% floor scores 0 → reject.
    const r = evaluateClaim(base({ oracleDeviationBps: 100 }));
    expect(r.decision).toBe('reject');
  });

  it('rejects (with the classified trigger) a positive-but-below-review incident', () => {
    // 5% deviation alone contributes exactly 0.3 (< 0.4 review floor) → reject, trigger kept.
    const r = evaluateClaim(base({ oracleDeviationBps: 500 }));
    expect(r.decision).toBe('reject');
    expect(r.triggerType).toBe('oracle_failure');
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThan(0.4);
  });

  it('escalates a confident-but-uncovered trigger to review with no payout', () => {
    const r = evaluateClaim(
      base({ coveredTriggers: ['oracle_failure'], exploitDetected: true, fundsDrained: true }),
    );
    expect(r.triggerType).toBe('exploit');
    expect(r.decision).toBe('review');
    expect(r.amount).toBe('0');
  });
});

describe('evaluateClaim — payout amount', () => {
  it('caps the payout at the loss amount when below coverage', () => {
    const r = evaluateClaim(
      base({ exploitDetected: true, fundsDrained: true, lossAmount: '250000000' }),
    );
    expect(r.amount).toBe('250000000');
  });

  it('pays full coverage when the loss meets or exceeds it', () => {
    const r = evaluateClaim(
      base({ exploitDetected: true, fundsDrained: true, lossAmount: '9999999999' }),
    );
    expect(r.amount).toBe('1000000000');
  });
});
