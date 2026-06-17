/**
 * Shared, deterministic fixture data for the CasperProof e2e suite.
 *
 * These values mirror the defaults the dApp views ship with (see
 * `apps/web/src/app/**` and `apps/web/src/lib/wallet.tsx`) so the specs assert
 * against the exact text the mock backend and components render. Keeping them in
 * one place means a UI default change is updated once.
 */

/** The mock CSPR.click demo account label rendered by `WalletButton`. */
export const DEMO_ACCOUNT_LABEL = 'Demo Attestor';

/**
 * Oracle view defaults. The submit form pre-fills these, and the VerifyPanel
 * pre-fills the same output — so an unedited verify recomputes a matching hash
 * and yields PASS.
 */
export const ORACLE_DEFAULTS = {
  modelId: 'casperproof-riskscorer-v1',
  /** Canonical output the submit form ships and the verify panel pre-fills. */
  output: { score: 73, tier: 'HIGH' },
  /** A tampered output that diverges from the commitment → FAIL. */
  tamperedOutput: { score: 99, tier: 'LOW' },
} as const;

/**
 * Slash view constants (see `SlashView.tsx`). The honest output goes on-chain;
 * the pre-filled tampered payload diverges → FAIL → challenge → slash.
 */
export const SLASH_DEFAULTS = {
  honestOutput: { score: 42, tier: 'MEDIUM' },
  tamperedOutput: { score: 5, tier: 'LOW' },
  /** 3 CSPR staked behind the slash-demo attestation. */
  stakeCspr: '3 CSPR',
} as const;

/**
 * Insurance view defaults (see `InsuranceView.tsx`). The default trigger
 * (`oracle_failure`) is covered by the default policy, so a simulated trigger
 * pays out.
 */
export const INSURANCE_DEFAULTS = {
  /** Default trigger select value + its visible label. */
  trigger: 'oracle_failure',
  triggerLabel: 'Oracle failure',
  /** Default coverage in CSPR as `formatMotes` renders it (5,000,000,000 motes). */
  coverageCspr: '5 CSPR',
} as const;

/** Pretty-print a value exactly as the dApp's `prettyJson` helper does. */
export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
