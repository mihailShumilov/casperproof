/**
 * Public types for `@casperproof/casper-sdk`.
 *
 * The SDK is the single typed client used by the agents, the x402 / MCP servers, the dApp,
 * and the deploy scripts to talk to the CasperProof on-chain registry + insurance contracts
 * (read paths over CSPR.cloud REST, write paths over Casper deploys). All hashing flows
 * through `@casperproof/commitment` — the SDK never reimplements the commitment scheme (§8).
 *
 * Every external dependency has a zero-secret mock fallback (see {@link SdkMode}); the SDK
 * picks live mode only when a `CSPR_CLOUD_TOKEN` is present.
 */
import type { Hex, JsonValue } from '@casperproof/commitment';

export type { Hex, JsonValue } from '@casperproof/commitment';

/**
 * Whether the client is wired to live CSPR.cloud infrastructure or the in-memory mock.
 *
 * - `mock` — deterministic in-memory store + deterministic mock deploy hashes; no secrets,
 *   no network. The default for local dev, tests, and CI.
 * - `live` — CSPR.cloud REST for reads and (documented) streaming for events. Selected
 *   automatically when {@link CasperProofConfig.csprCloudToken} is set.
 */
export type SdkMode = 'mock' | 'live';

/**
 * Lifecycle state of an attestation, mirroring the on-chain `AttestationRegistry` status
 * (`Active | Challenged | Slashed | Finalized`).
 */
export type AttestationStatus = 'Active' | 'Challenged' | 'Slashed' | 'Finalized';

/**
 * Lifecycle state of an insurance policy.
 */
export type PolicyStatus = 'Active' | 'Claimed' | 'Expired';

/**
 * The insurance trigger taxonomy covered by policies and asserted by claims.
 *
 * @see attestation-oracle skill — Insurance app.
 */
export type TriggerType = 'exploit' | 'oracle_failure' | 'agent_error' | 'governance_attack';

/**
 * Configuration for {@link createClient}. Every field is optional; unset fields fall back to
 * the corresponding environment variable, and then to a documented local default.
 */
export interface CasperProofConfig {
  /** Force a mode regardless of token presence. Mostly for tests. */
  mode?: SdkMode;
  /** CSPR.cloud REST base URL (`CSPR_CLOUD_REST_URL`). */
  csprCloudRestUrl?: string;
  /** CSPR.cloud streaming WebSocket URL (`CSPR_CLOUD_STREAMING_URL`). */
  csprCloudStreamingUrl?: string;
  /** CSPR.cloud access token (`CSPR_CLOUD_TOKEN`). Presence flips the client to live mode. */
  csprCloudToken?: string;
  /** Casper node RPC URL used by write/deploy paths (`CASPER_NODE_URL`). */
  casperNodeUrl?: string;
  /** Casper network name (`CASPER_NETWORK_NAME`), e.g. `casper-test`. */
  casperNetworkName?: string;
  /** Deployed `AttestationRegistry` contract hash (`ATTESTATION_REGISTRY_HASH`). */
  attestationRegistryHash?: string;
  /** Deployed `Insurance` contract hash (`INSURANCE_HASH`). */
  insuranceHash?: string;
  /** Deployed staking token contract hash (`STAKE_TOKEN_HASH`). */
  stakeTokenHash?: string;
  /** Per-request timeout in milliseconds for REST calls. Default 10000. */
  timeoutMs?: number;
  /** Number of retry attempts for retryable REST failures. Default 2. */
  retries?: number;
  /** Base backoff delay (ms) between REST retries. Default 50. */
  retryBaseDelayMs?: number;
  /**
   * `fetch` implementation for the REST backend. Defaults to the global `fetch`. Injectable
   * so tests can supply a `vi.fn()` and Node environments without a global can pass one in.
   */
  fetch?: FetchLike;
  /**
   * Environment source. Defaults to `process.env`. Injectable so config resolution is fully
   * testable without mutating the real environment.
   */
  env?: Record<string, string | undefined>;
}

/** The subset of the `fetch` signature the SDK relies on. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<FetchResponseLike>;

/** The subset of the `Response` shape the SDK relies on. */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** Fully-resolved configuration (every field defaulted) used internally by the backends. */
export interface ResolvedConfig {
  mode: SdkMode;
  csprCloudRestUrl: string;
  csprCloudStreamingUrl: string;
  csprCloudToken: string | undefined;
  casperNodeUrl: string;
  casperNetworkName: string;
  attestationRegistryHash: string | undefined;
  insuranceHash: string | undefined;
  stakeTokenHash: string | undefined;
  timeoutMs: number;
  retries: number;
  retryBaseDelayMs: number;
  fetch: FetchLike;
}

/** Reputation record for an attestor (mirrors the on-chain `Reputation`). */
export interface Reputation {
  /** Address the reputation belongs to. */
  address: string;
  /** Count of attestations finalized honestly. */
  successful: number;
  /** Count of attestations slashed as fraudulent. */
  slashed: number;
  /** Count of challenges the attestor successfully defended. */
  challengesDefended: number;
  /**
   * Convenience score in `[0, 1]`: `successful / (successful + slashed)`. `1` when the
   * attestor has no resolved attestations yet.
   */
  score: number;
}

/** A stored attestation as returned by the SDK. */
export interface Attestation {
  /** Monotonic attestation id. */
  id: number;
  /** Address that submitted the attestation. */
  attestor: string;
  /** Model identifier, e.g. `casperproof-riskscorer-v1`. */
  modelId: string;
  /** `blake2b_256(canonical_bytes(input))`. */
  inputHash: Hex;
  /** `blake2b_256(canonical_bytes(output))`. */
  outputHash: Hex;
  /** Full commitment (§8). */
  commitment: Hex;
  /** S3 URL of the off-chain payload (content-addressed). */
  uri: string;
  /** Stake locked behind the attestation, as a stringified motes amount. */
  stake: string;
  /** Submit timestamp (unix seconds). */
  createdAt: number;
  /** Lifecycle state. */
  status: AttestationStatus;
  /** Challenger address, set once the attestation is challenged. */
  challenger?: string;
}

/** Arguments to {@link CasperProofSdk.submitAttestation}. */
export interface SubmitAttestationArgs {
  /** Model identifier hashed into the commitment as UTF-8 bytes. */
  modelId: string;
  /** The agent's input payload (canonicalizable JSON). */
  input: JsonValue;
  /** The agent's output payload (canonicalizable JSON). */
  output: JsonValue;
  /** Unix timestamp (u64) hashed little-endian into the commitment. Defaults to now. */
  timestamp?: number;
  /** S3 URL of the off-chain payload. */
  uri: string;
  /** Stake to lock, as a stringified motes amount. Must meet the registry minimum. */
  stake: string;
  /** Optional attestor address override (mock mode). Defaults to the mock test account. */
  attestor?: string;
}

/** Result of {@link CasperProofSdk.submitAttestation}. */
export interface SubmitAttestationResult {
  /** The new attestation id. */
  id: number;
  /** Casper deploy hash for the `submit_attestation` write. Deterministic in mock mode. */
  deployHash: Hex;
  /** Full commitment (§8). */
  commitment: Hex;
  /** Input payload hash. */
  inputHash: Hex;
  /** Output payload hash. */
  outputHash: Hex;
  /** Lifecycle state immediately after submit (`Active`). */
  status: AttestationStatus;
}

/** Result of {@link CasperProofSdk.verify}. */
export interface VerifyResult {
  /** `true` when the recomputed output hash matches the on-chain commitment (PASS). */
  valid: boolean;
  /** Output hash recomputed from the supplied payload. */
  recomputedHash: Hex;
  /** Output hash currently stored on-chain. */
  onchainHash: Hex;
  /** Attestor address. */
  attestor: string;
  /** Stake locked behind the attestation (stringified motes). */
  stake: string;
  /** Attestor reputation snapshot. */
  reputation: Reputation;
}

/** A generic deploy (write-path) result. */
export interface DeployResult {
  /** Casper deploy hash. Deterministic in mock mode. */
  deployHash: Hex;
  /** The affected entity id (attestation id, policy id, …) when applicable. */
  id?: number;
  /** Resulting lifecycle status when applicable. */
  status?: AttestationStatus | PolicyStatus;
}

/** Arguments to {@link CasperProofSdk.createPolicy}. */
export interface CreatePolicyArgs {
  /** Coverage amount (stringified motes / USDC base units). */
  coverage: string;
  /** Premium amount (stringified). */
  premium: string;
  /** Trigger types this policy covers. */
  triggerTypes: TriggerType[];
  /** Policy expiry (unix seconds). */
  expiry: number;
  /** Optional holder address (mock mode). Defaults to the mock test account. */
  holder?: string;
}

/** An insurance policy as returned by the SDK. */
export interface Policy {
  /** Policy id. */
  id: number;
  /** Holder address. */
  holder: string;
  /** Coverage amount (stringified). */
  coverage: string;
  /** Premium amount (stringified). */
  premium: string;
  /** Covered trigger types. */
  triggerTypes: TriggerType[];
  /** Expiry (unix seconds). */
  expiry: number;
  /** Lifecycle state. */
  status: PolicyStatus;
}

/** Result of {@link CasperProofSdk.submitClaim}. */
export interface ClaimResult {
  /** Casper deploy hash for the `claim` write. */
  deployHash: Hex;
  /** The policy the claim was filed against. */
  policyId: number;
  /** The attestation backing the claim. */
  attestationId: number;
  /** Whether the claim resulted in a payout. */
  paid: boolean;
  /** Payout amount (stringified) when `paid`. */
  amount: string;
}

/** A risk score for an address (produced off-chain, anchored on-chain via attestation). */
export interface RiskScore {
  /** Scored address. */
  address: string;
  /** Score in `[0, 100]`. */
  score: number;
  /** Coarse risk tier. */
  tier: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** A live contract event forwarded to {@link CasperProofSdk.subscribeEvents} handlers. */
export interface CasperProofEvent {
  /** Event name, e.g. `AttestationSubmitted`, `Challenged`, `Resolved`, `ClaimPaid`. */
  name: 'AttestationSubmitted' | 'Challenged' | 'Resolved' | 'ClaimPaid';
  /** The entity id the event concerns. */
  id: number;
  /** Event timestamp (unix seconds). */
  timestamp: number;
  /** Arbitrary event-specific payload. */
  data: JsonValue;
}

/** Handler invoked for each {@link CasperProofEvent}. */
export type EventHandler = (event: CasperProofEvent) => void;

/** Unsubscribe function returned by {@link CasperProofSdk.subscribeEvents}. */
export type Unsubscribe = () => void;

/**
 * The pluggable backend behind the client. {@link createClient} selects a `MockBackend` or a
 * `RestBackend` based on token presence, but the {@link CasperProofSdk} surface is identical
 * regardless of which is wired in.
 */
export interface Backend {
  /** Which mode this backend implements. */
  readonly mode: SdkMode;
  submitAttestation(args: SubmitAttestationArgs): Promise<SubmitAttestationResult>;
  getAttestation(id: number): Promise<Attestation>;
  attestationCount(): Promise<number>;
  attestorReputation(address: string): Promise<Reputation>;
  challenge(id: number): Promise<DeployResult>;
  resolve(id: number, fraudulent: boolean): Promise<DeployResult>;
  createPolicy(args: CreatePolicyArgs): Promise<Policy>;
  getPolicy(id: number): Promise<Policy>;
  submitClaim(policyId: number, attestationId: number): Promise<ClaimResult>;
  getRiskScore(address: string): Promise<RiskScore>;
  stake(amount: string): Promise<DeployResult>;
  unstake(amount: string): Promise<DeployResult>;
  subscribeEvents(handler: EventHandler): Unsubscribe;
}
