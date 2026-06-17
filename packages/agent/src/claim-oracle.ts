/**
 * Deterministic claim-oracle over the insurance trigger taxonomy.
 *
 * Pure: given observed evidence about an incident, classify it into one of the four covered
 * trigger types (`exploit`, `oracle_failure`, `agent_error`, `governance_attack`), compute a
 * confidence, and decide whether to `payout`, `reject`, or send for human `review`. The
 * resulting decision is what the attestor anchors on-chain and the insurance contract reads.
 *
 * No randomness, no clocks, no network — the same evidence always yields the same decision.
 */
import type { TriggerType } from '@casperproof/casper-sdk';

export type { TriggerType } from '@casperproof/casper-sdk';

/** The decision outcome of the claim oracle. */
export type ClaimDecision = 'payout' | 'reject' | 'review';

/**
 * Observed evidence about a potential insurance incident.
 *
 * All fields are optional; the oracle scores whatever evidence is present. An incident with no
 * positive evidence is rejected.
 */
export interface ClaimEvidence {
  /** The policy being claimed against. */
  policyId: number;
  /** The trigger types the policy covers. */
  coveredTriggers: TriggerType[];
  /** Coverage amount (stringified motes / base units). */
  coverage: string;
  /**
   * Funds confirmed lost / drained (stringified base units). When `>= coverage`, the full
   * coverage is paid; otherwise the loss amount caps the payout.
   */
  lossAmount?: string;
  /** A confirmed unauthorized withdrawal / drain occurred (exploit signal). */
  fundsDrained?: boolean;
  /** A reentrancy / unauthorized-call exploit was detected on the protocol. */
  exploitDetected?: boolean;
  /** The oracle price feed deviated beyond tolerance from reference feeds. */
  oracleDeviationBps?: number;
  /** The oracle feed stopped updating (stale) past the staleness window. */
  oracleStale?: boolean;
  /** An automated agent produced a provably wrong action / decision. */
  agentMisbehaved?: boolean;
  /** A failed attestation was challenged and slashed (agent fraud). */
  agentSlashed?: boolean;
  /** A malicious governance proposal passed or seized control. */
  maliciousProposal?: boolean;
  /** Governance voting power suddenly concentrated (takeover signal). */
  governanceTakeover?: boolean;
}

/** Result of {@link evaluateClaim}. */
export interface ClaimOracleResult {
  /** Whether to pay, reject, or escalate the claim. */
  decision: ClaimDecision;
  /** The classified trigger type, or `null` when no trigger matched. */
  triggerType: TriggerType | null;
  /** Confidence in `[0, 1]` that the classified trigger occurred. */
  confidence: number;
  /** Payout amount (stringified base units). `"0"` when not paying out. */
  amount: string;
}

/** Per-trigger confidence contributions, summed and clamped to `[0, 1]`. */
interface TriggerScore {
  trigger: TriggerType;
  confidence: number;
}

const PAYOUT_THRESHOLD = 0.7;
const REVIEW_THRESHOLD = 0.4;

/** Round a confidence to 2 decimals (stable, language-portable). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Score the `exploit` trigger from drain / exploit evidence. */
function scoreExploit(e: ClaimEvidence): number {
  let c = 0;
  if (e.exploitDetected) c += 0.6;
  if (e.fundsDrained) c += 0.5;
  return c;
}

/** Score the `oracle_failure` trigger from deviation / staleness evidence. */
function scoreOracleFailure(e: ClaimEvidence): number {
  let c = 0;
  if (e.oracleStale) c += 0.55;
  if (typeof e.oracleDeviationBps === 'number' && e.oracleDeviationBps >= 500) {
    // 500 bps == 5% deviation; scale up to a cap of +0.6 at ~50% deviation.
    c += Math.min(0.6, 0.3 + (e.oracleDeviationBps - 500) / 10_000);
  }
  return c;
}

/** Score the `agent_error` trigger from agent-misbehavior evidence. */
function scoreAgentError(e: ClaimEvidence): number {
  let c = 0;
  if (e.agentSlashed) c += 0.6;
  if (e.agentMisbehaved) c += 0.45;
  return c;
}

/** Score the `governance_attack` trigger from governance-capture evidence. */
function scoreGovernanceAttack(e: ClaimEvidence): number {
  let c = 0;
  if (e.maliciousProposal) c += 0.55;
  if (e.governanceTakeover) c += 0.5;
  return c;
}

/** Compute the best-matching trigger and its (uncapped) confidence. */
function classify(e: ClaimEvidence): TriggerScore {
  const scores: TriggerScore[] = [
    { trigger: 'exploit', confidence: scoreExploit(e) },
    { trigger: 'oracle_failure', confidence: scoreOracleFailure(e) },
    { trigger: 'agent_error', confidence: scoreAgentError(e) },
    { trigger: 'governance_attack', confidence: scoreGovernanceAttack(e) },
  ];
  // Deterministic argmax: highest confidence wins; ties broken by taxonomy order (stable sort).
  return scores.reduce((best, current) => (current.confidence > best.confidence ? current : best));
}

/** Compute the payout amount, capping at the loss amount when one is supplied. */
function payoutAmount(e: ClaimEvidence): string {
  if (e.lossAmount === undefined) return e.coverage;
  const loss = BigInt(e.lossAmount);
  const coverage = BigInt(e.coverage);
  return (loss < coverage ? loss : coverage).toString();
}

/**
 * Deterministically evaluate a claim from observed evidence.
 *
 * Classifies the incident, then decides:
 * - `payout` when confidence `>= 0.7` **and** the trigger is covered by the policy;
 * - `review` when confidence `>= 0.4` (or a high-confidence trigger is not covered);
 * - `reject` otherwise.
 *
 * @param evidence The observed incident evidence.
 */
export function evaluateClaim(evidence: ClaimEvidence): ClaimOracleResult {
  const best = classify(evidence);
  const confidence = round2(Math.min(1, best.confidence));

  // No positive evidence at all → reject with no trigger.
  if (confidence <= 0) {
    return { decision: 'reject', triggerType: null, confidence: 0, amount: '0' };
  }

  const covered = evidence.coveredTriggers.includes(best.trigger);

  if (confidence >= PAYOUT_THRESHOLD) {
    if (!covered) {
      // Confident in a trigger the policy does not cover → escalate rather than auto-reject.
      return { decision: 'review', triggerType: best.trigger, confidence, amount: '0' };
    }
    return {
      decision: 'payout',
      triggerType: best.trigger,
      confidence,
      amount: payoutAmount(evidence),
    };
  }

  if (confidence >= REVIEW_THRESHOLD) {
    return { decision: 'review', triggerType: best.trigger, confidence, amount: '0' };
  }

  return { decision: 'reject', triggerType: best.trigger, confidence, amount: '0' };
}
