/**
 * In-memory mock backend for `@casperproof/casper-sdk`.
 *
 * Implements the full {@link Backend} surface with no secrets and no network so `make up`,
 * unit tests, and CI all run offline (casper-stack mock-mode principle). The store is seeded
 * empty; all state lives in memory for the lifetime of the instance.
 *
 * Deterministic mock deploy hashes are computed as `blake2b256(label || le_u64(counter) ||
 * utf8(canonical(payload)))` via `@casperproof/commitment` — so the same write produces the
 * same hash, which keeps tests and the demo reproducible. Real signing requires
 * `casper-js-sdk`, which is intentionally not a dependency here (see `docs/DEPLOYMENT.md`).
 */
import {
  blake2b256,
  canonicalize,
  computeCommitment,
  concatBytes,
  leU64,
  toHex,
} from '@casperproof/commitment';
import {
  alreadyChallenged,
  attestationNotActive,
  attestationNotFound,
  insufficientStake,
  policyExpired,
  policyNotFound,
  triggerNotCovered,
} from './errors.js';
import type {
  Attestation,
  Backend,
  CasperProofEvent,
  ClaimResult,
  CreatePolicyArgs,
  DeployResult,
  EventHandler,
  Hex,
  JsonValue,
  Policy,
  Reputation,
  RiskScore,
  SubmitAttestationArgs,
  SubmitAttestationResult,
  TriggerType,
  Unsubscribe,
} from './types.js';

/** Default mock test account used when no attestor / holder is supplied. */
export const MOCK_ACCOUNT =
  'account-hash-0000000000000000000000000000000000000000000000000000000000000001';

/** Minimum stake the mock registry enforces (motes), mirroring a deployed `min_stake`. */
export const MOCK_MIN_STAKE = 1_000_000_000n;

/** Mutable reputation counters keyed by address. */
interface RepCounters {
  successful: number;
  slashed: number;
  challengesDefended: number;
}

/**
 * A deterministic, in-memory implementation of {@link Backend}. Suitable for local dev,
 * tests, and the demo; never talks to the network.
 */
export class MockBackend implements Backend {
  readonly mode = 'mock' as const;

  private readonly attestations = new Map<number, Attestation>();
  private readonly policies = new Map<number, Policy>();
  private readonly reputations = new Map<string, RepCounters>();
  private readonly handlers = new Set<EventHandler>();
  /** Recent local events, replayed to new subscribers (most-recent-last). */
  private readonly recentEvents: CasperProofEvent[] = [];
  private nextAttestationId = 1;
  private nextPolicyId = 1;
  private deployCounter = 0;
  /** Total staked motes (for the stake/unstake bookkeeping). */
  private stakedTotal = 0n;

  /** Optional clock injection for deterministic timestamps in tests. Defaults to `Date.now`. */
  constructor(private readonly now: () => number = () => Math.floor(Date.now() / 1000)) {}

  /** Compute a deterministic mock deploy hash for a labelled write. */
  private deployHash(label: string, payload: JsonValue): Hex {
    this.deployCounter += 1;
    const bytes = concatBytes(
      new TextEncoder().encode(label),
      leU64(this.deployCounter),
      new TextEncoder().encode(canonicalize(payload)),
    );
    return toHex(blake2b256(bytes));
  }

  private rep(address: string): RepCounters {
    let counters = this.reputations.get(address);
    if (!counters) {
      counters = { successful: 0, slashed: 0, challengesDefended: 0 };
      this.reputations.set(address, counters);
    }
    return counters;
  }

  private emit(event: CasperProofEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > 100) {
      this.recentEvents.shift();
    }
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  async submitAttestation(args: SubmitAttestationArgs): Promise<SubmitAttestationResult> {
    if (BigInt(args.stake) < MOCK_MIN_STAKE) {
      throw insufficientStake(MOCK_MIN_STAKE.toString(), args.stake);
    }
    const timestamp = args.timestamp ?? this.now();
    const { inputHash, outputHash, commitment } = computeCommitment({
      input: args.input,
      output: args.output,
      modelId: args.modelId,
      timestamp,
    });
    const id = this.nextAttestationId++;
    const attestor = args.attestor ?? MOCK_ACCOUNT;
    const attestation: Attestation = {
      id,
      attestor,
      modelId: args.modelId,
      inputHash,
      outputHash,
      commitment,
      uri: args.uri,
      stake: args.stake,
      createdAt: timestamp,
      status: 'Active',
    };
    this.attestations.set(id, attestation);
    const deployHash = this.deployHash('submit_attestation', { id, commitment });
    this.emit({
      name: 'AttestationSubmitted',
      id,
      timestamp,
      data: { attestor, modelId: args.modelId },
    });
    return { id, deployHash, commitment, inputHash, outputHash, status: 'Active' };
  }

  async getAttestation(id: number): Promise<Attestation> {
    const found = this.attestations.get(id);
    if (!found) throw attestationNotFound(id);
    return { ...found };
  }

  async attestationCount(): Promise<number> {
    return this.attestations.size;
  }

  async attestorReputation(address: string): Promise<Reputation> {
    const counters = this.reputations.get(address) ?? {
      successful: 0,
      slashed: 0,
      challengesDefended: 0,
    };
    const resolved = counters.successful + counters.slashed;
    const score = resolved === 0 ? 1 : counters.successful / resolved;
    return {
      address,
      successful: counters.successful,
      slashed: counters.slashed,
      challengesDefended: counters.challengesDefended,
      score,
    };
  }

  async challenge(id: number): Promise<DeployResult> {
    const attestation = this.attestations.get(id);
    if (!attestation) throw attestationNotFound(id);
    if (attestation.status === 'Challenged') throw alreadyChallenged(id);
    if (attestation.status !== 'Active') throw attestationNotActive(id, attestation.status);
    attestation.status = 'Challenged';
    attestation.challenger = MOCK_ACCOUNT;
    const deployHash = this.deployHash('challenge', { id });
    this.emit({
      name: 'Challenged',
      id,
      timestamp: this.now(),
      data: { challenger: MOCK_ACCOUNT },
    });
    return { deployHash, id, status: 'Challenged' };
  }

  async resolve(id: number, fraudulent: boolean): Promise<DeployResult> {
    const attestation = this.attestations.get(id);
    if (!attestation) throw attestationNotFound(id);
    if (attestation.status !== 'Challenged') throw attestationNotActive(id, attestation.status);
    const counters = this.rep(attestation.attestor);
    if (fraudulent) {
      attestation.status = 'Slashed';
      counters.slashed += 1;
    } else {
      attestation.status = 'Finalized';
      counters.successful += 1;
      counters.challengesDefended += 1;
    }
    const deployHash = this.deployHash('resolve', { id, fraudulent });
    this.emit({ name: 'Resolved', id, timestamp: this.now(), data: { fraudulent } });
    return { deployHash, id, status: attestation.status };
  }

  async createPolicy(args: CreatePolicyArgs): Promise<Policy> {
    const id = this.nextPolicyId++;
    const policy: Policy = {
      id,
      holder: args.holder ?? MOCK_ACCOUNT,
      coverage: args.coverage,
      premium: args.premium,
      triggerTypes: [...args.triggerTypes],
      expiry: args.expiry,
      status: 'Active',
    };
    this.policies.set(id, policy);
    return { ...policy, triggerTypes: [...policy.triggerTypes] };
  }

  async getPolicy(id: number): Promise<Policy> {
    const found = this.policies.get(id);
    if (!found) throw policyNotFound(id);
    return { ...found, triggerTypes: [...found.triggerTypes] };
  }

  async submitClaim(policyId: number, attestationId: number): Promise<ClaimResult> {
    const policy = this.policies.get(policyId);
    if (!policy) throw policyNotFound(policyId);
    if (policy.status === 'Expired' || policy.expiry <= this.now()) {
      policy.status = 'Expired';
      throw policyExpired(policyId);
    }
    const attestation = this.attestations.get(attestationId);
    if (!attestation) throw attestationNotFound(attestationId);

    // Derive the claim trigger from the attested output (the claim oracle output shape).
    const trigger = this.triggerFromOutput(attestation);
    if (trigger === undefined || !policy.triggerTypes.includes(trigger)) {
      throw triggerNotCovered(policyId, trigger ?? 'unknown');
    }
    policy.status = 'Claimed';
    const deployHash = this.deployHash('claim', { policyId, attestationId });
    this.emit({
      name: 'ClaimPaid',
      id: policyId,
      timestamp: this.now(),
      data: { attestationId, amount: policy.coverage },
    });
    return { deployHash, policyId, attestationId, paid: true, amount: policy.coverage };
  }

  /** Best-effort extraction of a trigger type from a claim-oracle attestation output URI tag. */
  private triggerFromOutput(attestation: Attestation): TriggerType | undefined {
    // In mock mode the trigger is encoded in the attestation uri as `#trigger=<type>`; this
    // keeps the mock claim deterministic without needing to fetch the off-chain payload.
    const match = /#trigger=([a-z_]+)/.exec(attestation.uri);
    const value = match?.[1];
    const known: TriggerType[] = ['exploit', 'oracle_failure', 'agent_error', 'governance_attack'];
    return known.find((t) => t === value);
  }

  async getRiskScore(address: string): Promise<RiskScore> {
    // Deterministic pseudo-score from the address bytes: stable per address, no randomness.
    const digest = blake2b256(new TextEncoder().encode(address));
    const score = (digest[0] ?? 0) % 101; // [0, 100]
    const tier: RiskScore['tier'] = score < 34 ? 'LOW' : score < 67 ? 'MEDIUM' : 'HIGH';
    return { address, score, tier };
  }

  async stake(amount: string): Promise<DeployResult> {
    this.stakedTotal += BigInt(amount);
    return { deployHash: this.deployHash('stake', { amount }) };
  }

  async unstake(amount: string): Promise<DeployResult> {
    const requested = BigInt(amount);
    if (requested > this.stakedTotal) {
      throw insufficientStake(requested.toString(), this.stakedTotal.toString());
    }
    this.stakedTotal -= requested;
    return { deployHash: this.deployHash('unstake', { amount }) };
  }

  subscribeEvents(handler: EventHandler): Unsubscribe {
    // Replay recent local events so a late subscriber still sees the demo flow.
    for (const event of this.recentEvents) {
      handler(event);
    }
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
