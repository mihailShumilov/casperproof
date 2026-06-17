/**
 * Live CSPR.cloud REST backend for `@casperproof/casper-sdk`.
 *
 * Read paths (get attestation, count, reputation, policy, risk score) hit the CSPR.cloud REST
 * API (`Authorization: <CSPR_CLOUD_TOKEN>`) with per-request timeouts and bounded retries, and
 * map any RFC 7807 failure to a typed {@link CasperProofSdkError}.
 *
 * Write paths (submit, challenge, resolve, claim, stake, unstake) require signing a Casper
 * deploy. `casper-js-sdk` is **not** a dependency of this package, so — exactly as in mock
 * mode — these methods compute the commitment locally and return a deterministic placeholder
 * deploy hash. Wiring real signing is tracked in `SETUP_NEEDED.md`; the read surface is fully
 * live.
 *
 * Event streaming (`subscribeEvents`) is a documented stub here: real live events arrive over
 * the CSPR.cloud streaming WebSocket; in the absence of that wiring it is a no-op subscription.
 */
import { computeCommitment } from '@casperproof/commitment';
import { resolveConfig } from './config.js';
import { errorFromProblem, internalError } from './errors.js';
import { MockBackend } from './mock-backend.js';
import type {
  Attestation,
  AttestationStatus,
  Backend,
  CreatePolicyArgs,
  ClaimResult,
  DeployResult,
  EventHandler,
  Policy,
  Reputation,
  ResolvedConfig,
  RiskScore,
  SubmitAttestationArgs,
  SubmitAttestationResult,
  TriggerType,
  Unsubscribe,
} from './types.js';

/** Retryable HTTP statuses (transient server / rate-limit conditions). */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

/**
 * Live CSPR.cloud-backed implementation of {@link Backend}. Reads are live; writes use the
 * shared deterministic deploy-hash placeholder until `casper-js-sdk` signing is wired in.
 */
export class RestBackend implements Backend {
  readonly mode = 'live' as const;

  /** Shared deterministic write-path helper (deploy hashes only; no in-memory store reads). */
  private readonly writer: MockBackend;

  constructor(private readonly config: ResolvedConfig) {
    this.writer = new MockBackend();
  }

  /** Build the auth + content headers for a CSPR.cloud REST call. */
  private headers(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.config.csprCloudToken) {
      headers['Authorization'] = this.config.csprCloudToken;
    }
    return headers;
  }

  /**
   * Perform a GET against the CSPR.cloud REST API with timeout + bounded retries. Non-OK
   * responses are decoded as RFC 7807 and rethrown as a typed {@link CasperProofSdkError}.
   */
  private async get<T>(path: string): Promise<T> {
    const url = `${this.config.csprCloudRestUrl.replace(/\/$/, '')}${path}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const res = await this.config.fetch(url, {
          method: 'GET',
          headers: this.headers(),
          signal: controller.signal,
        });
        if (res.ok) {
          return (await res.json()) as T;
        }
        // Non-OK: decode the problem body once.
        const body = await this.safeJson(res.json.bind(res), res.text.bind(res));
        if (RETRYABLE_STATUSES.has(res.status) && attempt < this.config.retries) {
          lastError = errorFromProblem(res.status, body);
          await this.backoff(attempt);
          continue;
        }
        throw errorFromProblem(res.status, body);
      } catch (err) {
        // AbortError / network errors are retryable; typed problem errors are not.
        if (this.isTyped(err)) throw err;
        lastError = err;
        if (attempt < this.config.retries) {
          await this.backoff(attempt);
          continue;
        }
        throw internalError(
          `CSPR.cloud request to ${path} failed after ${attempt + 1} attempt(s): ${this.describe(err)}`,
        );
      } finally {
        clearTimeout(timer);
      }
    }
    // Exhausted retries on retryable status codes.
    if (this.isTyped(lastError)) throw lastError;
    throw internalError(`CSPR.cloud request to ${path} exhausted retries.`);
  }

  private isTyped(err: unknown): err is { code: string; status: number } {
    return (
      Boolean(err) &&
      typeof err === 'object' &&
      err instanceof Error &&
      err.name === 'CasperProofSdkError'
    );
  }

  private describe(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }

  private async safeJson(
    json: () => Promise<unknown>,
    text: () => Promise<string>,
  ): Promise<unknown> {
    try {
      return await json();
    } catch {
      try {
        return { detail: await text() };
      } catch {
        return {};
      }
    }
  }

  private backoff(attempt: number): Promise<void> {
    const delay = this.config.retryBaseDelayMs * 2 ** attempt;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  // ── Reads (live CSPR.cloud) ────────────────────────────────────────────────

  async getAttestation(id: number): Promise<Attestation> {
    const raw = await this.get<Record<string, unknown>>(`/attestations/${id}`);
    return this.toAttestation(id, raw);
  }

  async attestationCount(): Promise<number> {
    const raw = await this.get<Record<string, unknown>>('/attestations/count');
    const count = raw['count'];
    return typeof count === 'number' ? count : Number(count ?? 0);
  }

  async attestorReputation(address: string): Promise<Reputation> {
    const raw = await this.get<Record<string, unknown>>(
      `/attestors/${encodeURIComponent(address)}/reputation`,
    );
    const successful = this.num(raw['successful']);
    const slashed = this.num(raw['slashed']);
    const challengesDefended = this.num(raw['challengesDefended'] ?? raw['challenges_defended']);
    const resolved = successful + slashed;
    return {
      address,
      successful,
      slashed,
      challengesDefended,
      score: resolved === 0 ? 1 : successful / resolved,
    };
  }

  async getPolicy(id: number): Promise<Policy> {
    const raw = await this.get<Record<string, unknown>>(`/policies/${id}`);
    return {
      id,
      holder: String(raw['holder'] ?? ''),
      coverage: String(raw['coverage'] ?? '0'),
      premium: String(raw['premium'] ?? '0'),
      triggerTypes: this.toTriggers(raw['triggerTypes'] ?? raw['trigger_types']),
      expiry: this.num(raw['expiry']),
      status: this.toPolicyStatus(raw['status']),
    };
  }

  async getRiskScore(address: string): Promise<RiskScore> {
    const raw = await this.get<Record<string, unknown>>(
      `/risk-scores/${encodeURIComponent(address)}`,
    );
    const score = this.num(raw['score']);
    const rawTier = raw['tier'];
    const tier: RiskScore['tier'] =
      rawTier === 'LOW' || rawTier === 'MEDIUM' || rawTier === 'HIGH'
        ? rawTier
        : score < 34
          ? 'LOW'
          : score < 67
            ? 'MEDIUM'
            : 'HIGH';
    return { address, score, tier };
  }

  // ── Writes (deterministic placeholder deploy hashes; see SETUP_NEEDED) ──────

  async submitAttestation(args: SubmitAttestationArgs): Promise<SubmitAttestationResult> {
    // Hashes are computed locally via @casperproof/commitment regardless of mode (§8 anchor).
    const timestamp = args.timestamp ?? Math.floor(Date.now() / 1000);
    const { inputHash, outputHash, commitment } = computeCommitment({
      input: args.input,
      output: args.output,
      modelId: args.modelId,
      timestamp,
    });
    const { deployHash } = await this.writer.stake('0'); // reuse deterministic hash generator
    return { id: 0, deployHash, commitment, inputHash, outputHash, status: 'Active' };
  }

  async challenge(id: number): Promise<DeployResult> {
    const { deployHash } = await this.writer.stake('0');
    return { deployHash, id, status: 'Challenged' };
  }

  async resolve(id: number, fraudulent: boolean): Promise<DeployResult> {
    const { deployHash } = await this.writer.stake('0');
    const status: AttestationStatus = fraudulent ? 'Slashed' : 'Finalized';
    return { deployHash, id, status };
  }

  async createPolicy(args: CreatePolicyArgs): Promise<Policy> {
    return {
      id: 0,
      holder: args.holder ?? '',
      coverage: args.coverage,
      premium: args.premium,
      triggerTypes: [...args.triggerTypes],
      expiry: args.expiry,
      status: 'Active',
    };
  }

  async submitClaim(policyId: number, attestationId: number): Promise<ClaimResult> {
    const { deployHash } = await this.writer.stake('0');
    return { deployHash, policyId, attestationId, paid: true, amount: '0' };
  }

  async stake(amount: string): Promise<DeployResult> {
    return this.writer.stake(amount);
  }

  async unstake(amount: string): Promise<DeployResult> {
    const { deployHash } = await this.writer.stake(amount);
    return { deployHash };
  }

  subscribeEvents(_handler: EventHandler): Unsubscribe {
    // Live events arrive over the CSPR.cloud streaming WebSocket; wiring is tracked in
    // SETUP_NEEDED.md. Until then this is a documented no-op subscription.
    void _handler;
    return () => {
      /* no-op */
    };
  }

  // ── Mapping helpers ─────────────────────────────────────────────────────────

  private toAttestation(id: number, raw: Record<string, unknown>): Attestation {
    const attestation: Attestation = {
      id,
      attestor: String(raw['attestor'] ?? ''),
      modelId: String(raw['modelId'] ?? raw['model_id'] ?? ''),
      inputHash: String(raw['inputHash'] ?? raw['input_hash'] ?? ''),
      outputHash: String(raw['outputHash'] ?? raw['output_hash'] ?? ''),
      commitment: String(raw['commitment'] ?? ''),
      uri: String(raw['uri'] ?? ''),
      stake: String(raw['stake'] ?? '0'),
      createdAt: this.num(raw['createdAt'] ?? raw['created_at']),
      status: this.toAttestationStatus(raw['status']),
    };
    const challenger = raw['challenger'];
    if (typeof challenger === 'string' && challenger.length > 0) {
      attestation.challenger = challenger;
    }
    return attestation;
  }

  private num(value: unknown): number {
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toAttestationStatus(value: unknown): AttestationStatus {
    return value === 'Active' ||
      value === 'Challenged' ||
      value === 'Slashed' ||
      value === 'Finalized'
      ? value
      : 'Active';
  }

  private toPolicyStatus(value: unknown): Policy['status'] {
    return value === 'Active' || value === 'Claimed' || value === 'Expired' ? value : 'Active';
  }

  private toTriggers(value: unknown): TriggerType[] {
    if (!Array.isArray(value)) return [];
    const known: TriggerType[] = ['exploit', 'oracle_failure', 'agent_error', 'governance_attack'];
    return value.filter((v): v is TriggerType => known.includes(v as TriggerType));
  }
}

/** Construct a {@link RestBackend} from a (possibly partial) config, resolving env + defaults. */
export function createRestBackend(config: ResolvedConfig): RestBackend {
  return new RestBackend(config);
}

/** Re-export for callers that want to resolve config independently. */
export { resolveConfig };
