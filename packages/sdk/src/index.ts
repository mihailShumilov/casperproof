/**
 * `@casperproof/casper-sdk` — the typed CasperProof client.
 *
 * A stable, fully-documented client over the CasperProof on-chain registry + insurance
 * contracts: attest, verify, challenge, resolve, create policies, file claims, score risk,
 * stake/unstake, and subscribe to live events. Used by the agents, the x402 / MCP servers,
 * the dApp, and the deploy scripts.
 *
 * It operates in **mock mode** by default (zero-secret, in-memory, deterministic) and **live
 * mode** over CSPR.cloud when `CSPR_CLOUD_TOKEN` is set. All hashing flows through
 * `@casperproof/commitment`; the SDK never reimplements the commitment scheme (§8).
 *
 * @example
 * ```ts
 * import { createClient } from '@casperproof/casper-sdk';
 * const client = createClient();
 * console.log(client.mode); // 'mock' | 'live'
 * ```
 *
 * @packageDocumentation
 */

export { createClient, CasperProofSdk } from './client.js';
export { MockBackend, MOCK_ACCOUNT, MOCK_MIN_STAKE } from './mock-backend.js';
export { RestBackend, createRestBackend } from './rest-backend.js';
export { resolveConfig } from './config.js';

export {
  CasperProofSdkError,
  ERROR_CODES,
  PROBLEM_BASE,
  statusForCode,
  typeUriForCode,
  isErrorCode,
  errorFromProblem,
  attestationNotFound,
  policyNotFound,
  insufficientStake,
  tamperedPayload,
  alreadyChallenged,
  attestationNotActive,
  policyExpired,
  triggerNotCovered,
  vaultInsolvent,
  internalError,
} from './errors.js';
export type { CasperProofErrorCode } from './errors.js';

export type {
  // config + mode
  CasperProofConfig,
  ResolvedConfig,
  SdkMode,
  FetchLike,
  FetchResponseLike,
  // domain models
  Attestation,
  AttestationStatus,
  Policy,
  PolicyStatus,
  TriggerType,
  Reputation,
  RiskScore,
  CasperProofEvent,
  // method args + results
  SubmitAttestationArgs,
  SubmitAttestationResult,
  VerifyResult,
  DeployResult,
  CreatePolicyArgs,
  ClaimResult,
  // events
  EventHandler,
  Unsubscribe,
  // backend interface
  Backend,
  // re-exported commitment types
  Hex,
  JsonValue,
} from './types.js';
