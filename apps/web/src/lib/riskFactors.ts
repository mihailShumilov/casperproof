/**
 * The CasperProof 15-factor risk model — a local mirror of the agent's
 * risk-scorer taxonomy.
 *
 * The on-chain SDK only exposes a coarse `RiskScore { score, tier }`; the
 * individual sub-signals that produce that score live in the off-chain agent.
 * This module reconstructs a *plausible, deterministic* per-factor breakdown
 * from the same inputs so the dApp can show the underwriting detail behind a
 * score. Given the same `(seed, overallScore)` it always returns the same
 * factor values, and the weighted mean of those values reconciles back to the
 * overall score — so a shared result link reproduces an identical assessment.
 *
 * Pure data + math: no React, no SDK, no randomness. Trivially unit-testable.
 */
// Type-only import: erased at build time, so this module stays free of the UI
// barrel's client components and is safe to import from Server Components
// (e.g. the result page's `generateMetadata`).
import type { Tier } from '@casperproof/ui';

/**
 * Bucket a 0–100 risk score into a {@link Tier}. Mirrors `tierForScore` in
 * `@casperproof/ui` exactly (LOW 0–39, MEDIUM 40–59, HIGH 60–79, EXTREME 80+)
 * but is inlined here so this pure data module never pulls in client code.
 */
function tierForScore(score: number): Tier {
  if (score < 40) return 'LOW';
  if (score < 60) return 'MEDIUM';
  if (score < 80) return 'HIGH';
  return 'EXTREME';
}

/** The four scoring groups the 15 factors are organised into. */
export type FactorGroup = 'TRANSACTION' | 'PROTOCOL' | 'SECURITY' | 'IDENTITY';

/** Display metadata for each {@link FactorGroup}. */
export const FACTOR_GROUPS: Record<FactorGroup, { label: string; blurb: string }> = {
  TRANSACTION: {
    label: 'Transaction & Behavior',
    blurb: 'How the agent transacts — reliability, cadence, and output stability.',
  },
  PROTOCOL: {
    label: 'Protocol & DeFi',
    blurb: 'Exposure taken on through the protocols and positions the agent touches.',
  },
  SECURITY: {
    label: 'Security & History',
    blurb: 'Track record across exploits, slashing, audits, and mutable code.',
  },
  IDENTITY: {
    label: 'Identity & Portfolio',
    blurb: 'Account maturity and the composition of what it holds.',
  },
};

/** Static definition of a single risk factor. */
export interface FactorDef {
  /** Stable machine key (matches the agent's risk-scorer signal name). */
  key: string;
  /** Human label shown in the UI. */
  label: string;
  /** Scoring group this factor belongs to. */
  group: FactorGroup;
  /** Weight in whole percentage points; the 15 weights sum to 100. */
  weight: number;
  /** One-line description of what the factor measures. */
  explanation: string;
  /** Three cycling micro-explanations shown while the factor is "scanning". */
  scan: readonly [string, string, string];
}

/** Build the three cycling scan lines for a factor from a per-group template. */
function scanFor(group: FactorGroup, label: string): readonly [string, string, string] {
  const f = label.toLowerCase();
  const t = GROUP_SCAN[group];
  return [t[0].replace('{f}', f), t[1].replace('{f}', f), t[2].replace('{f}', f)] as const;
}

const GROUP_SCAN: Record<FactorGroup, readonly [string, string, string]> = {
  TRANSACTION: [
    'indexing deploys & transfers…',
    'computing {f} from on-chain history…',
    'scoring {f} against the agent baseline…',
  ],
  PROTOCOL: [
    'mapping protocol & counterparty graph…',
    'modeling {f}…',
    'stress-testing {f} exposure…',
  ],
  SECURITY: [
    'cross-referencing audit & exploit registries…',
    'evaluating {f}…',
    'weighting {f} into the security score…',
  ],
  IDENTITY: [
    'tracing account lineage & balances…',
    'measuring {f}…',
    'finalizing {f} contribution…',
  ],
};

/** Raw factor table (label, group, weight, explanation). Scan lines are derived. */
const FACTOR_TABLE: ReadonlyArray<Omit<FactorDef, 'scan'>> = [
  // ── Transaction & Behavior — 19% ────────────────────────────────────────
  {
    key: 'failureRate',
    label: 'Failure rate',
    group: 'TRANSACTION',
    weight: 5,
    explanation: "Share of the agent's recent deploys that reverted or errored on-chain.",
  },
  {
    key: 'txVelocity',
    label: 'Transaction velocity',
    group: 'TRANSACTION',
    weight: 5,
    explanation: 'Burstiness of throughput versus the account’s own activity baseline.',
  },
  {
    key: 'volatility',
    label: 'Output volatility',
    group: 'TRANSACTION',
    weight: 9,
    explanation: 'Variance in position sizes and decision outputs across recent activity.',
  },
  // ── Protocol & DeFi — 30% ───────────────────────────────────────────────
  {
    key: 'oracleDeviation',
    label: 'Oracle deviation',
    group: 'PROTOCOL',
    weight: 9,
    explanation: 'How far the agent’s reads drift from reference oracle price/risk feeds.',
  },
  {
    key: 'counterpartyRisk',
    label: 'Counterparty risk',
    group: 'PROTOCOL',
    weight: 8,
    explanation: 'Risk concentration in the protocols and addresses it transacts with.',
  },
  {
    key: 'bridgeExposure',
    label: 'Bridge exposure',
    group: 'PROTOCOL',
    weight: 6,
    explanation: 'Value routed through cross-chain bridges, a frequent exploit surface.',
  },
  {
    key: 'leverageRatio',
    label: 'Leverage ratio',
    group: 'PROTOCOL',
    weight: 7,
    explanation: 'Borrowed-to-collateral ratio across the agent’s open positions.',
  },
  // ── Security & History — 24% ────────────────────────────────────────────
  {
    key: 'exploitHistory',
    label: 'Exploit history',
    group: 'SECURITY',
    weight: 10,
    explanation: 'Prior involvement in exploited contracts or compromised flows.',
  },
  {
    key: 'slashingHistory',
    label: 'Slashing history',
    group: 'SECURITY',
    weight: 6,
    explanation: 'Past attestations this account has had slashed for fraud.',
  },
  {
    key: 'upgradeRisk',
    label: 'Upgrade risk',
    group: 'SECURITY',
    weight: 4,
    explanation: 'Exposure to mutable or recently-upgraded contract code.',
  },
  {
    key: 'auditCoverage',
    label: 'Audit coverage',
    group: 'SECURITY',
    weight: 4,
    explanation: 'Fraction of touched contracts covered by a published audit.',
  },
  // ── Identity & Portfolio — 27% ──────────────────────────────────────────
  {
    key: 'age',
    label: 'Account age',
    group: 'IDENTITY',
    weight: 4,
    explanation: 'Maturity of the account, measured from its first on-chain activity.',
  },
  {
    key: 'liquidity',
    label: 'Liquidity',
    group: 'IDENTITY',
    weight: 10,
    explanation: 'Liquid reserves available to honor obligations and stakes.',
  },
  {
    key: 'concentration',
    label: 'Concentration',
    group: 'IDENTITY',
    weight: 8,
    explanation: 'Single-asset concentration of the agent’s portfolio.',
  },
  {
    key: 'governanceActivity',
    label: 'Governance activity',
    group: 'IDENTITY',
    weight: 5,
    explanation: 'Consistency of governance participation and key rotation.',
  },
];

/** The full, ordered 15-factor model. */
export const FACTORS: ReadonlyArray<FactorDef> = FACTOR_TABLE.map((f) => ({
  ...f,
  scan: scanFor(f.group, f.label),
}));

/** A factor enriched with its derived value + tier for a specific assessment. */
export interface FactorResult extends FactorDef {
  /** Risk value in `[0, 100]` for this factor (higher = riskier). */
  value: number;
  /** Tier bucket for {@link value}. */
  tier: Tier;
}

/** A group rolled up to a single weighted score + tier. */
export interface CategoryResult {
  group: FactorGroup;
  label: string;
  /** Weighted mean of the group's factor values, `[0, 100]`. */
  score: number;
  /** Sum of the group's factor weights (percentage points). */
  weight: number;
  tier: Tier;
}

/** Clamp `n` into the inclusive `[min, max]` range. */
function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/**
 * Deterministic 32-bit hash of a string (xmur3). Stable across runs and
 * platforms — the basis for the per-factor jitter so a seed is reproducible.
 */
function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Map a string to a deterministic unit float in `[0, 1)`. */
function unit(str: string): number {
  return hashString(str) / 4294967296;
}

/** Weighted mean of `values` using each factor's weight (weights sum to 100). */
function weightedMean(values: ReadonlyArray<number>): number {
  let sum = 0;
  for (let i = 0; i < FACTORS.length; i++) {
    sum += (values[i] ?? 0) * (FACTORS[i]!.weight / 100);
  }
  return sum;
}

const JITTER_SPREAD = 22;

/**
 * Derive the 15 per-factor values for an assessment.
 *
 * Each factor gets a deterministic value centred on `overallScore` with a
 * seed-derived jitter, then the whole set is biased so its weighted mean
 * reconciles back to `overallScore` (within rounding / clamping at the
 * extremes). Identical `(seed, overallScore)` ⇒ identical output.
 *
 * @param seed         The assessment seed (address or input text).
 * @param overallScore The SDK's overall risk score, `[0, 100]`.
 */
export function computeFactors(seed: string, overallScore: number): FactorResult[] {
  const target = clamp(Math.round(overallScore), 0, 100);

  // 1. Seed-derived value per factor, centred on the overall score.
  let values = FACTORS.map((f) => {
    const u = unit(`${seed}::${f.key}`);
    return clamp(target + (u * 2 - 1) * JITTER_SPREAD, 0, 100);
  });

  // 2. Reconcile the weighted mean back to the overall score. A few passes
  //    absorb the bias re-introduced by clamping near 0 / 100.
  for (let pass = 0; pass < 6; pass++) {
    const bias = target - weightedMean(values);
    if (Math.abs(bias) < 0.05) break;
    values = values.map((v) => clamp(v + bias, 0, 100));
  }

  return FACTORS.map((f, i) => {
    const value = Math.round(values[i]!);
    return { ...f, value, tier: tierForScore(value) };
  });
}

/** Roll the per-factor results up into one weighted score per group. */
export function computeCategories(factors: ReadonlyArray<FactorResult>): CategoryResult[] {
  const order: FactorGroup[] = ['TRANSACTION', 'PROTOCOL', 'SECURITY', 'IDENTITY'];
  return order.map((group) => {
    const members = factors.filter((f) => f.group === group);
    const weight = members.reduce((sum, f) => sum + f.weight, 0);
    const score =
      weight === 0 ? 0 : members.reduce((sum, f) => sum + f.value * f.weight, 0) / weight;
    const rounded = Math.round(score);
    return {
      group,
      label: FACTOR_GROUPS[group].label,
      score: rounded,
      weight,
      tier: tierForScore(rounded),
    };
  });
}

/** Underwriting verdict for an overall tier. */
export interface Verdict {
  tier: Tier;
  /** Whether the agent qualifies for parametric coverage at all. */
  insurable: boolean;
  /** Short tier-coloured verdict line. */
  detail: string;
}

/** Map an overall tier to its insurance verdict. */
export function verdictForTier(tier: Tier): Verdict {
  switch (tier) {
    case 'LOW':
      return { tier, insurable: true, detail: 'qualifies for low-premium parametric coverage.' };
    case 'MEDIUM':
      return {
        tier,
        insurable: true,
        detail: 'insurable at a standard premium with routine monitoring.',
      };
    case 'HIGH':
      return {
        tier,
        insurable: true,
        detail: 'insurable only at an elevated premium and tighter limits.',
      };
    case 'EXTREME':
      return {
        tier,
        insurable: false,
        detail: 'exceeds acceptable risk thresholds — not insurable.',
      };
  }
}

/**
 * Encode an assessment seed into a URL-safe id (base64url, UTF-8 safe).
 * The id fully determines the assessment, so a shared link reproduces it.
 */
export function encodeSeed(seed: string): string {
  const bytes = new TextEncoder().encode(seed);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a base64url assessment id back into its original seed string. */
export function decodeSeed(id: string): string {
  const b64 = id.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
