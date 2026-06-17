import { describe, expect, it } from 'vitest';
import { defaultConfig } from './agent.config.js';
import {
  decisionForTier,
  deriveSignals,
  scoreRisk,
  SIGNAL_NAMES,
  SIGNAL_WEIGHTS,
  tierForScore,
} from './risk-scorer.js';
import type { RiskSignals } from './risk-scorer.js';

const T = defaultConfig.thresholds;

/** Build a full signals object with every signal set to the same value. */
function uniform(value: number): RiskSignals {
  const s = {} as RiskSignals;
  for (const name of SIGNAL_NAMES) s[name] = value;
  return s;
}

describe('signal definitions', () => {
  it('defines exactly 15 named signals', () => {
    expect(SIGNAL_NAMES).toHaveLength(15);
  });

  it('has weights that sum to 1', () => {
    const sum = SIGNAL_NAMES.reduce((acc, name) => acc + SIGNAL_WEIGHTS[name], 0);
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe('deriveSignals', () => {
  it('is deterministic for the same address', () => {
    expect(deriveSignals('account-hash-aabb')).toEqual(deriveSignals('account-hash-aabb'));
  });

  it('differs across addresses', () => {
    expect(deriveSignals('account-hash-aaaa')).not.toEqual(deriveSignals('account-hash-bbbb'));
  });

  it('produces all 15 signals in [0, 100]', () => {
    const signals = deriveSignals('account-hash-xyz');
    expect(Object.keys(signals).sort()).toEqual([...SIGNAL_NAMES].sort());
    for (const name of SIGNAL_NAMES) {
      expect(signals[name]).toBeGreaterThanOrEqual(0);
      expect(signals[name]).toBeLessThanOrEqual(100);
    }
  });
});

describe('tierForScore', () => {
  it('maps each band to the right tier (boundaries inclusive)', () => {
    expect(tierForScore(0, T)).toBe('LOW');
    expect(tierForScore(T.medium - 1, T)).toBe('LOW');
    expect(tierForScore(T.medium, T)).toBe('MEDIUM');
    expect(tierForScore(T.high - 1, T)).toBe('MEDIUM');
    expect(tierForScore(T.high, T)).toBe('HIGH');
    expect(tierForScore(T.extreme - 1, T)).toBe('HIGH');
    expect(tierForScore(T.extreme, T)).toBe('EXTREME');
    expect(tierForScore(100, T)).toBe('EXTREME');
  });
});

describe('decisionForTier', () => {
  it('maps every tier to an action', () => {
    expect(decisionForTier('LOW')).toBe('allow');
    expect(decisionForTier('MEDIUM')).toBe('monitor');
    expect(decisionForTier('HIGH')).toBe('restrict');
    expect(decisionForTier('EXTREME')).toBe('block');
  });
});

describe('scoreRisk', () => {
  it('produces every tier from explicit uniform signals (LOW → EXTREME)', () => {
    expect(scoreRisk('a', { signals: uniform(10) }).tier).toBe('LOW');
    expect(scoreRisk('a', { signals: uniform(50) }).tier).toBe('MEDIUM');
    expect(scoreRisk('a', { signals: uniform(75) }).tier).toBe('HIGH');
    expect(scoreRisk('a', { signals: uniform(95) }).tier).toBe('EXTREME');
  });

  it('emits the matching decision for the tier', () => {
    expect(scoreRisk('a', { signals: uniform(10) }).decision).toBe('allow');
    expect(scoreRisk('a', { signals: uniform(95) }).decision).toBe('block');
  });

  it('returns the full signal set and an integer score in range', () => {
    const result = scoreRisk('account-hash-demo');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(result.score)).toBe(true);
    expect(Object.keys(result.signals)).toHaveLength(15);
    expect(result.address).toBe('account-hash-demo');
  });

  it('is deterministic for the same address', () => {
    expect(scoreRisk('account-hash-stable')).toEqual(scoreRisk('account-hash-stable'));
  });

  it('overlays partial explicit signals on derived ones', () => {
    const derived = scoreRisk('account-hash-overlay');
    const overlaid = scoreRisk('account-hash-overlay', { signals: { exploitHistory: 100 } });
    expect(overlaid.signals.exploitHistory).toBe(100);
    // Non-overridden signals stay equal to the derived values.
    expect(overlaid.signals.liquidity).toBe(derived.signals.liquidity);
  });

  it('clamps out-of-range and NaN explicit signals into [0, 100]', () => {
    const result = scoreRisk('a', {
      signals: { liquidity: 999, volatility: -50, concentration: Number.NaN },
    });
    expect(result.signals.liquidity).toBe(100);
    expect(result.signals.volatility).toBe(0);
    expect(result.signals.concentration).toBe(0);
  });

  it('honors explicit thresholds passed directly', () => {
    const tier = scoreRisk('a', {
      signals: uniform(50),
      thresholds: { medium: 10, high: 20, extreme: 30 },
    }).tier;
    expect(tier).toBe('EXTREME');
  });

  it('honors thresholds from a supplied config', () => {
    const config = { ...defaultConfig, thresholds: { medium: 5, high: 8, extreme: 9 } };
    expect(scoreRisk('a', { signals: uniform(50), config }).tier).toBe('EXTREME');
  });
});
