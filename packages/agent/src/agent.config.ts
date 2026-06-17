/**
 * Typed configuration for the CasperProof zero-cost agent runtime.
 *
 * Every knob is read from the environment with a documented local default so the runtime
 * boots offline, with no secrets, in `LLM_BACKEND=none` deterministic mode. The defaults
 * mirror `.env.example` (Ollama at `http://ollama:11434`, MinIO at `http://minio:9000`).
 *
 * Config resolution is pure: pass an explicit `env` record to make it fully testable without
 * mutating `process.env`.
 */
import { z } from 'zod';

/**
 * The LLM backend driving the runtime decision loop.
 *
 * - `ollama` — local Ollama over HTTP (the documented default for `make up`).
 * - `none` — pure deterministic policy; no network, no model. Used for tests, CI, and the
 *   reproducible demo video. **The demo never depends on LLM quality.**
 * - `openai` / `anthropic` — paid backends, **disabled by default** (they throw). No paid
 *   API keys, ever.
 */
export type LlmBackendKind = 'ollama' | 'none' | 'openai' | 'anthropic';

/** The risk tiers, coarsest classification of a 0..100 score. */
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

/** Documented local defaults (match `.env.example`). */
const DEFAULTS = {
  llmBackend: 'ollama' as LlmBackendKind,
  ollamaHost: 'http://ollama:11434',
  ollamaModel: 'llama3.1:8b',
  pollIntervalMs: 5_000,
  riskScorerModelId: 'casperproof-riskscorer-v1',
  claimOracleModelId: 'casperproof-claimoracle-v1',
  /** Default stake locked behind an attestation (motes); above the mock registry minimum. */
  attestationStake: '2000000000',
  /** Tier thresholds (inclusive lower bounds) over a 0..100 score. */
  thresholds: { medium: 34, high: 67, extreme: 85 },
} as const;

/** Inclusive lower-bound score thresholds that separate the four risk tiers. */
export interface RiskThresholds {
  /** Score `>= medium` (and `< high`) is `MEDIUM`; below is `LOW`. */
  medium: number;
  /** Score `>= high` (and `< extreme`) is `HIGH`. */
  high: number;
  /** Score `>= extreme` is `EXTREME`. */
  extreme: number;
}

/** Fully-resolved agent configuration consumed by the runtime modules. */
export interface AgentConfig {
  /** Selected LLM backend. */
  llmBackend: LlmBackendKind;
  /** Ollama HTTP base URL (used only when `llmBackend === 'ollama'`). */
  ollamaHost: string;
  /** Ollama model id (used only when `llmBackend === 'ollama'`). */
  ollamaModel: string;
  /** Poll interval (ms) for the long-running runtime loop. */
  pollIntervalMs: number;
  /** Model id stamped onto risk-score attestations. */
  riskScorerModelId: string;
  /** Model id stamped onto claim-oracle attestations. */
  claimOracleModelId: string;
  /** Default stake (stringified motes) locked behind a submitted attestation. */
  attestationStake: string;
  /** Tier thresholds over the 0..100 risk score. */
  thresholds: RiskThresholds;
}

const backendSchema = z.enum(['ollama', 'none', 'openai', 'anthropic']);

/** Treat empty / whitespace-only env values as unset. */
function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Parse a non-negative integer env value, falling back to `fallback` when unset/invalid. */
function intEnv(value: string | undefined, fallback: number): number {
  const cleaned = clean(value);
  if (cleaned === undefined) return fallback;
  const parsed = Number(cleaned);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

/**
 * Resolve the agent configuration from an environment record.
 *
 * @param env Environment source. Defaults to `process.env`. Injectable for tests.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AgentConfig {
  const rawBackend = clean(env['LLM_BACKEND']);
  const backend = backendSchema.safeParse(rawBackend);
  const llmBackend: LlmBackendKind = backend.success ? backend.data : DEFAULTS.llmBackend;

  return {
    llmBackend,
    ollamaHost: clean(env['OLLAMA_HOST']) ?? DEFAULTS.ollamaHost,
    ollamaModel: clean(env['OLLAMA_MODEL']) ?? DEFAULTS.ollamaModel,
    pollIntervalMs: intEnv(env['AGENT_POLL_INTERVAL_MS'], DEFAULTS.pollIntervalMs),
    riskScorerModelId: clean(env['RISK_SCORER_MODEL_ID']) ?? DEFAULTS.riskScorerModelId,
    claimOracleModelId: clean(env['CLAIM_ORACLE_MODEL_ID']) ?? DEFAULTS.claimOracleModelId,
    attestationStake: clean(env['ATTESTATION_STAKE']) ?? DEFAULTS.attestationStake,
    thresholds: {
      medium: intEnv(env['RISK_THRESHOLD_MEDIUM'], DEFAULTS.thresholds.medium),
      high: intEnv(env['RISK_THRESHOLD_HIGH'], DEFAULTS.thresholds.high),
      extreme: intEnv(env['RISK_THRESHOLD_EXTREME'], DEFAULTS.thresholds.extreme),
    },
  };
}

/** The default config resolved once from `process.env`, for convenience. */
export const defaultConfig: AgentConfig = loadConfig();
