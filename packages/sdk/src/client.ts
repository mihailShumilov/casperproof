/**
 * The CasperProof client — the single typed entry point used by the agents, the x402 / MCP
 * servers, the dApp, and the deploy scripts.
 *
 * {@link createClient} resolves config from explicit overrides → environment → local defaults,
 * picks a {@link MockBackend} or {@link RestBackend} based on `CSPR_CLOUD_TOKEN` presence, and
 * returns a {@link CasperProofSdk} whose method surface is identical in both modes. The chosen
 * mode is exposed as {@link CasperProofSdk.mode}.
 *
 * All hashing flows through `@casperproof/commitment`; the SDK never reimplements the
 * commitment scheme (§8).
 */
import { hashPayload, verifyOutputHash } from '@casperproof/commitment';
import { resolveConfig } from './config.js';
import { MockBackend } from './mock-backend.js';
import { RestBackend } from './rest-backend.js';
import type {
  Attestation,
  Backend,
  CasperProofConfig,
  ClaimResult,
  CreatePolicyArgs,
  DeployResult,
  EventHandler,
  JsonValue,
  Policy,
  Reputation,
  RiskScore,
  SdkMode,
  SubmitAttestationArgs,
  SubmitAttestationResult,
  Unsubscribe,
  VerifyResult,
} from './types.js';

/**
 * The CasperProof SDK client. Thin, fully-typed wrapper over a {@link Backend}; construct it
 * with {@link createClient} rather than directly so config resolution and mode selection are
 * handled for you.
 */
export class CasperProofSdk {
  /** Whether this client is wired to live CSPR.cloud (`live`) or the in-memory mock (`mock`). */
  readonly mode: SdkMode;

  /**
   * @param backend The chosen backend (mock or REST). Prefer {@link createClient}.
   */
  constructor(private readonly backend: Backend) {
    this.mode = backend.mode;
  }

  /**
   * Submit a stake-backed attestation. Computes `input_hash`, `output_hash`, and the full
   * commitment via `@casperproof/commitment`, then writes `submit_attestation`.
   *
   * @throws {@link CasperProofSdkError} `INSUFFICIENT_STAKE` if `stake` is below the minimum.
   */
  submitAttestation(args: SubmitAttestationArgs): Promise<SubmitAttestationResult> {
    return this.backend.submitAttestation(args);
  }

  /**
   * Fetch a stored attestation by id.
   *
   * @throws {@link CasperProofSdkError} `ATTESTATION_NOT_FOUND` if no such attestation exists.
   */
  getAttestation(id: number): Promise<Attestation> {
    return this.backend.getAttestation(id);
  }

  /**
   * Verify a payload against an on-chain attestation (§8 verification): recompute the output
   * hash from `payload` and compare it byte-for-byte to the on-chain commitment.
   *
   * Returns `{ valid, recomputedHash, onchainHash, attestor, stake, reputation }`. `valid` is
   * `false` (a tamper) when the hashes diverge — this is a normal verification result and is
   * **not** thrown; callers that prefer an exception can inspect `valid` and throw
   * {@link tamperedPayload} themselves.
   *
   * @param id The attestation to verify against.
   * @param payload The off-chain output payload to recompute the hash from.
   * @throws {@link CasperProofSdkError} `ATTESTATION_NOT_FOUND` if the attestation is missing.
   */
  async verify(id: number, payload: JsonValue): Promise<VerifyResult> {
    const attestation = await this.backend.getAttestation(id);
    const recomputedHash = hashPayload(payload);
    const valid = verifyOutputHash(recomputedHash, attestation.outputHash);
    const reputation = await this.backend.attestorReputation(attestation.attestor);
    return {
      valid,
      recomputedHash,
      onchainHash: attestation.outputHash,
      attestor: attestation.attestor,
      stake: attestation.stake,
      reputation,
    };
  }

  /** Total number of attestations in the registry. */
  attestationCount(): Promise<number> {
    return this.backend.attestationCount();
  }

  /** Reputation record for an attestor address. */
  attestorReputation(address: string): Promise<Reputation> {
    return this.backend.attestorReputation(address);
  }

  /**
   * Challenge an attestation (posts a dispute bond on-chain).
   *
   * @throws {@link CasperProofSdkError} `ATTESTATION_NOT_FOUND`, `ALREADY_CHALLENGED`, or
   *   `ATTESTATION_NOT_ACTIVE`.
   */
  challenge(id: number): Promise<DeployResult> {
    return this.backend.challenge(id);
  }

  /**
   * Resolve a challenged attestation (resolver-only). `fraudulent=true` slashes the stake;
   * `fraudulent=false` finalizes it honestly.
   *
   * @throws {@link CasperProofSdkError} `ATTESTATION_NOT_FOUND` or `ATTESTATION_NOT_ACTIVE`.
   */
  resolve(id: number, fraudulent: boolean): Promise<DeployResult> {
    return this.backend.resolve(id, fraudulent);
  }

  /** Create an insurance policy. */
  createPolicy(args: CreatePolicyArgs): Promise<Policy> {
    return this.backend.createPolicy(args);
  }

  /** Fetch an insurance policy by id. */
  getPolicy(id: number): Promise<Policy> {
    return this.backend.getPolicy(id);
  }

  /**
   * File a claim against a policy, backed by an attestation.
   *
   * @throws {@link CasperProofSdkError} `POLICY_NOT_FOUND`, `POLICY_EXPIRED`,
   *   `ATTESTATION_NOT_FOUND`, or `TRIGGER_NOT_COVERED`.
   */
  submitClaim(policyId: number, attestationId: number): Promise<ClaimResult> {
    return this.backend.submitClaim(policyId, attestationId);
  }

  /** Get the (off-chain-derived) risk score for an address. */
  getRiskScore(address: string): Promise<RiskScore> {
    return this.backend.getRiskScore(address);
  }

  /** Stake tokens behind the attestor. */
  stake(amount: string): Promise<DeployResult> {
    return this.backend.stake(amount);
  }

  /**
   * Unstake tokens.
   *
   * @throws {@link CasperProofSdkError} `INSUFFICIENT_STAKE` if more than the staked total is
   *   requested (mock mode bookkeeping).
   */
  unstake(amount: string): Promise<DeployResult> {
    return this.backend.unstake(amount);
  }

  /**
   * Subscribe to live contract events (`AttestationSubmitted`, `Challenged`, `Resolved`,
   * `ClaimPaid`). In mock mode this replays recent local events and emits new ones as they
   * occur; in live mode events arrive over CSPR.cloud streaming (see `docs/DEPLOYMENT.md`).
   *
   * @returns An unsubscribe function.
   */
  subscribeEvents(handler: EventHandler): Unsubscribe {
    return this.backend.subscribeEvents(handler);
  }
}

/**
 * Create a CasperProof client. Reads config from `config` overrides, then the environment
 * (`CSPR_CLOUD_*`, `CASPER_*`, `ATTESTATION_REGISTRY_HASH`, `INSURANCE_HASH`, …), then local
 * defaults. Selects **live** mode when a `CSPR_CLOUD_TOKEN` is present, otherwise **mock**.
 *
 * @example
 * ```ts
 * import { createClient } from '@casperproof/casper-sdk';
 *
 * const client = createClient(); // mock unless CSPR_CLOUD_TOKEN is set
 * const { id, commitment } = await client.submitAttestation({
 *   modelId: 'casperproof-riskscorer-v1',
 *   input: { address: 'account-hash-aabbcc' },
 *   output: { score: 73, tier: 'HIGH' },
 *   uri: 's3://casperproof-payloads/abc.json',
 *   stake: '2000000000',
 * });
 * const result = await client.verify(id, { score: 73, tier: 'HIGH' });
 * console.log(result.valid); // true
 * ```
 */
export function createClient(config: CasperProofConfig = {}): CasperProofSdk {
  const resolved = resolveConfig(config);
  const backend: Backend = resolved.mode === 'live' ? new RestBackend(resolved) : new MockBackend();
  return new CasperProofSdk(backend);
}
