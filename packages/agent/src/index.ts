/**
 * `@casperproof/agent` — the zero-cost product runtime.
 *
 * Deterministic risk scoring + claim oracle, a content-addressed S3/in-memory payload store,
 * the attestor (commit → store → submit) and verifier (refetch → recompute → PASS/FAIL), and a
 * pluggable runtime loop that decides *when* to score / attest / verify / challenge. Runs fully
 * offline with `LLM_BACKEND=none` and the mock SDK — no secrets, no paid keys, ever.
 *
 * @packageDocumentation
 */

export type { AgentConfig, LlmBackendKind, RiskTier, RiskThresholds } from './agent.config.js';
export { loadConfig, defaultConfig } from './agent.config.js';

export type {
  RiskSignals,
  RiskDecision,
  RiskScoreResult,
  ScoreRiskOptions,
} from './risk-scorer.js';
export {
  scoreRisk,
  deriveSignals,
  tierForScore,
  decisionForTier,
  SIGNAL_WEIGHTS,
  SIGNAL_NAMES,
} from './risk-scorer.js';

export type {
  ClaimDecision,
  ClaimEvidence,
  ClaimOracleResult,
  TriggerType,
} from './claim-oracle.js';
export { evaluateClaim } from './claim-oracle.js';

export type { StoreConfig, StoreBackend } from './store.js';
export {
  PayloadStore,
  MemoryBackend,
  S3Backend,
  createStore,
  loadStoreConfig,
  contentKey,
  parseUri,
} from './store.js';

export type { AttestArgs, AttestResult, AttestationPayload } from './attestor.js';
export { attest } from './attestor.js';

export type { VerifyResult } from './verifier.js';
export { verify } from './verifier.js';

export type {
  AgentAction,
  AgentDecision,
  RuntimeContext,
  CycleResult,
  LlmBackend,
  RuntimeDeps,
  FetchLike,
  Sleep,
} from './runtime.js';
export {
  AgentRuntime,
  NoneBackend,
  OllamaBackend,
  OpenAiBackend,
  AnthropicBackend,
  createBackend,
  createRuntime,
} from './runtime.js';

export { runCli } from './cli.js';
