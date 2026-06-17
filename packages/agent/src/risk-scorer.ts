/**
 * Deterministic 15-signal risk model.
 *
 * Pure and reproducible: the same address (or the same explicit signals) always yields the
 * same score, tier, and decision. No randomness, no clocks, no network — when on-chain
 * signals are unavailable, they are derived deterministically from the address bytes via the
 * locked blake2b-256 hash (`@casperproof/commitment`), so tests and the demo are repeatable.
 *
 * The 15 named signals are each normalized to `0..100` (higher == riskier), combined by fixed
 * weights into a `0..100` score, then mapped to a tier and an action decision.
 */
import { blake2b256 } from '@casperproof/commitment';
import type { AgentConfig, RiskThresholds, RiskTier } from './agent.config.js';
import { defaultConfig } from './agent.config.js';

/**
 * The 15 named risk signals. Each is normalized to `0..100`, where higher means riskier.
 */
export interface RiskSignals {
  /** Depth of liquidity backing the address / protocol (inverted: thin == risky). */
  liquidity: number;
  /** Price / position volatility. */
  volatility: number;
  /** Holdings concentration (whale / single-counterparty exposure). */
  concentration: number;
  /** Aggregate counterparty default risk. */
  counterpartyRisk: number;
  /** Oracle price deviation from reference feeds. */
  oracleDeviation: number;
  /** Unusual governance activity (proposal spam, sudden voting power). */
  governanceActivity: number;
  /** Historical association with known exploits. */
  exploitHistory: number;
  /** Account age (inverted: new == risky). */
  age: number;
  /** Transaction velocity (burstiness). */
  txVelocity: number;
  /** Failed-transaction rate. */
  failureRate: number;
  /** Cross-chain bridge exposure. */
  bridgeExposure: number;
  /** Leverage ratio. */
  leverageRatio: number;
  /** Validator slashing history. */
  slashingHistory: number;
  /** Pending / recent contract-upgrade risk. */
  upgradeRisk: number;
  /** Audit coverage (inverted: unaudited == risky). */
  auditCoverage: number;
}

/** The fixed signal weights (sum to 1). Tuned so each named signal contributes meaningfully. */
export const SIGNAL_WEIGHTS: Readonly<Record<keyof RiskSignals, number>> = {
  liquidity: 0.1,
  volatility: 0.09,
  concentration: 0.08,
  counterpartyRisk: 0.08,
  oracleDeviation: 0.09,
  governanceActivity: 0.05,
  exploitHistory: 0.1,
  age: 0.04,
  txVelocity: 0.05,
  failureRate: 0.05,
  bridgeExposure: 0.06,
  leverageRatio: 0.07,
  slashingHistory: 0.06,
  upgradeRisk: 0.04,
  auditCoverage: 0.04,
};

/** The canonical ordering of the 15 signals (also the order they are derived from bytes). */
export const SIGNAL_NAMES = Object.keys(SIGNAL_WEIGHTS) as Array<keyof RiskSignals>;

/** The action a downstream agent should take given a risk tier. */
export type RiskDecision = 'allow' | 'monitor' | 'restrict' | 'block';

/** Result of {@link scoreRisk}. */
export interface RiskScoreResult {
  /** The scored address. */
  address: string;
  /** Aggregate risk score in `[0, 100]` (higher == riskier). Integer. */
  score: number;
  /** Coarse risk tier. */
  tier: RiskTier;
  /** Recommended action for the tier. */
  decision: RiskDecision;
  /** The 15 normalized signals that produced the score. */
  signals: RiskSignals;
}

/** Optional inputs to {@link scoreRisk}. */
export interface ScoreRiskOptions {
  /** Explicit signals to score. When omitted, signals are derived from the address bytes. */
  signals?: Partial<RiskSignals>;
  /** Tier thresholds. Defaults to the agent config thresholds. */
  thresholds?: RiskThresholds;
  /** Agent config (only `thresholds` is consulted). Defaults to {@link defaultConfig}. */
  config?: AgentConfig;
}

/** Clamp a value into `[0, 100]` and round to an integer. */
function clamp100(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

/**
 * Derive deterministic `0..100` signal values from an address.
 *
 * Each of the 15 signals reads a distinct byte from `blake2b256(utf8(address))`, mapped into
 * `0..100`. Stable per address, no randomness — the mock-mode fallback for on-chain data.
 */
export function deriveSignals(address: string): RiskSignals {
  const digest = blake2b256(new TextEncoder().encode(address));
  const partial: Partial<RiskSignals> = {};
  SIGNAL_NAMES.forEach((name, index) => {
    const byte = digest[index] ?? 0;
    partial[name] = Math.round((byte / 255) * 100);
  });
  return partial as RiskSignals;
}

/** Map a score to a tier using the supplied thresholds. */
export function tierForScore(score: number, thresholds: RiskThresholds): RiskTier {
  if (score >= thresholds.extreme) return 'EXTREME';
  if (score >= thresholds.high) return 'HIGH';
  if (score >= thresholds.medium) return 'MEDIUM';
  return 'LOW';
}

/** Map a tier to its recommended action. */
export function decisionForTier(tier: RiskTier): RiskDecision {
  switch (tier) {
    case 'LOW':
      return 'allow';
    case 'MEDIUM':
      return 'monitor';
    case 'HIGH':
      return 'restrict';
    case 'EXTREME':
      return 'block';
  }
}

/**
 * Deterministically score an address's risk from 15 weighted signals.
 *
 * @param address The address (account / contract hash) to score.
 * @param options Optional explicit signals, thresholds, and config.
 */
export function scoreRisk(address: string, options: ScoreRiskOptions = {}): RiskScoreResult {
  const thresholds = options.thresholds ?? options.config?.thresholds ?? defaultConfig.thresholds;
  const derived = deriveSignals(address);

  // Overlay any explicit signals; clamp all values into [0, 100].
  const signals = {} as RiskSignals;
  for (const name of SIGNAL_NAMES) {
    const provided = options.signals?.[name];
    signals[name] = clamp100(provided ?? derived[name]);
  }

  let weighted = 0;
  for (const name of SIGNAL_NAMES) {
    weighted += signals[name] * SIGNAL_WEIGHTS[name];
  }
  const score = clamp100(weighted);
  const tier = tierForScore(score, thresholds);
  const decision = decisionForTier(tier);

  return { address, score, tier, decision, signals };
}
