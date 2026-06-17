import { computeCommitment } from '@casperproof/commitment';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { CasperProofSdkError } from './errors.js';
import { MOCK_ACCOUNT, MOCK_MIN_STAKE, MockBackend } from './mock-backend.js';
import type { CasperProofEvent } from './types.js';

const require = createRequire(import.meta.url);

/** Load the committed golden vectors via the package export. */
function loadGoldenVectors(): {
  vectors: Array<{
    name: string;
    input: unknown;
    output: unknown;
    modelId: string;
    timestamp: number;
    inputHash: string;
    outputHash: string;
    commitment: string;
  }>;
} {
  const path = require.resolve('@casperproof/commitment/golden-vectors.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

const FIXED_NOW = 1_900_000_000;
function backend(): MockBackend {
  return new MockBackend(() => FIXED_NOW);
}

describe('MockBackend.submitAttestation', () => {
  it('exposes mock mode', () => {
    expect(backend().mode).toBe('mock');
  });

  it('computes the same hashes as @casperproof/commitment golden vectors', async () => {
    const { vectors } = loadGoldenVectors();
    const b = backend();
    for (const v of vectors) {
      const res = await b.submitAttestation({
        modelId: v.modelId,
        input: v.input as never,
        output: v.output as never,
        timestamp: v.timestamp,
        uri: `s3://payloads/${v.name}.json`,
        stake: MOCK_MIN_STAKE.toString(),
      });
      expect(res.inputHash, v.name).toBe(v.inputHash);
      expect(res.outputHash, v.name).toBe(v.outputHash);
      expect(res.commitment, v.name).toBe(v.commitment);
      expect(res.status).toBe('Active');
      expect(res.deployHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('assigns monotonic ids and counts them', async () => {
    const b = backend();
    const a = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    const c = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://y',
      stake: '2000000000',
    });
    expect(a.id).toBe(1);
    expect(c.id).toBe(2);
    expect(await b.attestationCount()).toBe(2);
  });

  it('defaults the timestamp to the injected clock', async () => {
    const b = backend();
    const res = await b.submitAttestation({
      modelId: 'm',
      input: { a: 1 },
      output: { b: 2 },
      uri: 's3://x',
      stake: '2000000000',
    });
    const stored = await b.getAttestation(res.id);
    expect(stored.createdAt).toBe(FIXED_NOW);
    const expected = computeCommitment({
      input: { a: 1 },
      output: { b: 2 },
      modelId: 'm',
      timestamp: FIXED_NOW,
    });
    expect(stored.commitment).toBe(expected.commitment);
  });

  it('defaults attestor to the mock account', async () => {
    const b = backend();
    const res = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    expect((await b.getAttestation(res.id)).attestor).toBe(MOCK_ACCOUNT);
  });

  it('honors an explicit attestor', async () => {
    const b = backend();
    const res = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
      attestor: 'account-hash-zzz',
    });
    expect((await b.getAttestation(res.id)).attestor).toBe('account-hash-zzz');
  });

  it('rejects stake below the minimum', async () => {
    await expect(
      backend().submitAttestation({
        modelId: 'm',
        input: {},
        output: {},
        uri: 's3://x',
        stake: '1',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STAKE' });
  });
});

describe('MockBackend.getAttestation', () => {
  it('throws ATTESTATION_NOT_FOUND for missing ids', async () => {
    await expect(backend().getAttestation(999)).rejects.toBeInstanceOf(CasperProofSdkError);
    await expect(backend().getAttestation(999)).rejects.toMatchObject({
      code: 'ATTESTATION_NOT_FOUND',
    });
  });

  it('returns a copy, not the internal record', async () => {
    const b = backend();
    const { id } = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    const a = await b.getAttestation(id);
    a.status = 'Slashed';
    expect((await b.getAttestation(id)).status).toBe('Active');
  });
});

describe('MockBackend reputation', () => {
  it('returns a neutral score for an unknown address', async () => {
    const rep = await backend().attestorReputation('account-hash-unknown');
    expect(rep).toMatchObject({ successful: 0, slashed: 0, challengesDefended: 0, score: 1 });
  });

  it('tracks slashing and honest resolution', async () => {
    const b = backend();
    const honest = await b.submitAttestation({
      modelId: 'm',
      input: { a: 1 },
      output: {},
      uri: 's3://h',
      stake: '2000000000',
    });
    const fraud = await b.submitAttestation({
      modelId: 'm',
      input: { a: 2 },
      output: {},
      uri: 's3://f',
      stake: '2000000000',
    });
    await b.challenge(honest.id);
    await b.resolve(honest.id, false);
    await b.challenge(fraud.id);
    await b.resolve(fraud.id, true);
    const rep = await b.attestorReputation(MOCK_ACCOUNT);
    expect(rep.successful).toBe(1);
    expect(rep.slashed).toBe(1);
    expect(rep.challengesDefended).toBe(1);
    expect(rep.score).toBeCloseTo(0.5);
  });
});

describe('MockBackend challenge/resolve', () => {
  it('challenge sets Challenged and records the challenger', async () => {
    const b = backend();
    const { id } = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    const res = await b.challenge(id);
    expect(res.status).toBe('Challenged');
    expect((await b.getAttestation(id)).challenger).toBe(MOCK_ACCOUNT);
  });

  it('challenge throws ATTESTATION_NOT_FOUND', async () => {
    await expect(backend().challenge(7)).rejects.toMatchObject({ code: 'ATTESTATION_NOT_FOUND' });
  });

  it('challenge throws ALREADY_CHALLENGED on a second challenge', async () => {
    const b = backend();
    const { id } = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    await b.challenge(id);
    await expect(b.challenge(id)).rejects.toMatchObject({ code: 'ALREADY_CHALLENGED' });
  });

  it('challenge throws ATTESTATION_NOT_ACTIVE when already resolved', async () => {
    const b = backend();
    const { id } = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    await b.challenge(id);
    await b.resolve(id, true);
    await expect(b.challenge(id)).rejects.toMatchObject({ code: 'ATTESTATION_NOT_ACTIVE' });
  });

  it('resolve(false) finalizes', async () => {
    const b = backend();
    const { id } = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    await b.challenge(id);
    const res = await b.resolve(id, false);
    expect(res.status).toBe('Finalized');
  });

  it('resolve(true) slashes', async () => {
    const b = backend();
    const { id } = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    await b.challenge(id);
    const res = await b.resolve(id, true);
    expect(res.status).toBe('Slashed');
  });

  it('resolve throws ATTESTATION_NOT_FOUND', async () => {
    await expect(backend().resolve(7, true)).rejects.toMatchObject({
      code: 'ATTESTATION_NOT_FOUND',
    });
  });

  it('resolve throws ATTESTATION_NOT_ACTIVE when not challenged', async () => {
    const b = backend();
    const { id } = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    await expect(b.resolve(id, true)).rejects.toMatchObject({ code: 'ATTESTATION_NOT_ACTIVE' });
  });
});

describe('MockBackend policies + claims', () => {
  const future = FIXED_NOW + 100_000;

  it('creates and reads a policy', async () => {
    const b = backend();
    const policy = await b.createPolicy({
      coverage: '5000000000',
      premium: '100000000',
      triggerTypes: ['oracle_failure', 'exploit'],
      expiry: future,
    });
    expect(policy.id).toBe(1);
    expect(policy.holder).toBe(MOCK_ACCOUNT);
    const fetched = await b.getPolicy(policy.id);
    expect(fetched.triggerTypes).toEqual(['oracle_failure', 'exploit']);
    // returned arrays are copies
    fetched.triggerTypes.push('agent_error');
    expect((await b.getPolicy(policy.id)).triggerTypes).toEqual(['oracle_failure', 'exploit']);
  });

  it('honors an explicit holder', async () => {
    const b = backend();
    const policy = await b.createPolicy({
      coverage: '1',
      premium: '1',
      triggerTypes: [],
      expiry: future,
      holder: 'account-hash-holder',
    });
    expect(policy.holder).toBe('account-hash-holder');
  });

  it('getPolicy throws POLICY_NOT_FOUND', async () => {
    await expect(backend().getPolicy(1)).rejects.toMatchObject({ code: 'POLICY_NOT_FOUND' });
  });

  it('pays a claim when the attested trigger is covered', async () => {
    const b = backend();
    const policy = await b.createPolicy({
      coverage: '5000000000',
      premium: '1',
      triggerTypes: ['oracle_failure'],
      expiry: future,
    });
    const att = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: { decision: 'payout' },
      uri: 's3://x#trigger=oracle_failure',
      stake: '2000000000',
    });
    const claim = await b.submitClaim(policy.id, att.id);
    expect(claim.paid).toBe(true);
    expect(claim.amount).toBe('5000000000');
    expect((await b.getPolicy(policy.id)).status).toBe('Claimed');
  });

  it('claim throws POLICY_NOT_FOUND', async () => {
    await expect(backend().submitClaim(1, 1)).rejects.toMatchObject({ code: 'POLICY_NOT_FOUND' });
  });

  it('claim throws POLICY_EXPIRED for an expired policy', async () => {
    const b = backend();
    const policy = await b.createPolicy({
      coverage: '1',
      premium: '1',
      triggerTypes: ['exploit'],
      expiry: FIXED_NOW - 1,
    });
    await expect(b.submitClaim(policy.id, 1)).rejects.toMatchObject({ code: 'POLICY_EXPIRED' });
    // and the status is flipped to Expired
    expect((await b.getPolicy(policy.id)).status).toBe('Expired');
  });

  it('claim re-throws POLICY_EXPIRED when status already Expired', async () => {
    const b = backend();
    const policy = await b.createPolicy({
      coverage: '1',
      premium: '1',
      triggerTypes: ['exploit'],
      expiry: FIXED_NOW - 1,
    });
    await b.submitClaim(policy.id, 1).catch(() => undefined); // first call flips to Expired
    await expect(b.submitClaim(policy.id, 1)).rejects.toMatchObject({ code: 'POLICY_EXPIRED' });
  });

  it('claim throws ATTESTATION_NOT_FOUND for a missing attestation', async () => {
    const b = backend();
    const policy = await b.createPolicy({
      coverage: '1',
      premium: '1',
      triggerTypes: ['exploit'],
      expiry: future,
    });
    await expect(b.submitClaim(policy.id, 999)).rejects.toMatchObject({
      code: 'ATTESTATION_NOT_FOUND',
    });
  });

  it('claim throws TRIGGER_NOT_COVERED when the trigger is not in the policy', async () => {
    const b = backend();
    const policy = await b.createPolicy({
      coverage: '1',
      premium: '1',
      triggerTypes: ['exploit'],
      expiry: future,
    });
    const att = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x#trigger=oracle_failure',
      stake: '2000000000',
    });
    await expect(b.submitClaim(policy.id, att.id)).rejects.toMatchObject({
      code: 'TRIGGER_NOT_COVERED',
    });
  });

  it('claim throws TRIGGER_NOT_COVERED (unknown) when the uri has no trigger tag', async () => {
    const b = backend();
    const policy = await b.createPolicy({
      coverage: '1',
      premium: '1',
      triggerTypes: ['exploit'],
      expiry: future,
    });
    const att = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    await expect(b.submitClaim(policy.id, att.id)).rejects.toMatchObject({
      code: 'TRIGGER_NOT_COVERED',
      detail: { trigger: 'unknown' },
    });
  });
});

describe('MockBackend risk score + staking', () => {
  it('produces a deterministic risk score and tier', async () => {
    const b = backend();
    const a = await b.getRiskScore('account-hash-aabbcc');
    const again = await b.getRiskScore('account-hash-aabbcc');
    expect(a).toEqual(again);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(a.tier);
  });

  it('covers all three tiers across a sweep of addresses', async () => {
    const b = backend();
    const tiers = new Set<string>();
    for (let i = 0; i < 300 && tiers.size < 3; i++) {
      tiers.add((await b.getRiskScore(`account-hash-${i}`)).tier);
    }
    expect(tiers).toEqual(new Set(['LOW', 'MEDIUM', 'HIGH']));
  });

  it('stakes and unstakes', async () => {
    const b = backend();
    const s = await b.stake('1000000000');
    expect(s.deployHash).toMatch(/^[0-9a-f]{64}$/);
    const u = await b.unstake('500000000');
    expect(u.deployHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('unstake throws INSUFFICIENT_STAKE when over-withdrawing', async () => {
    const b = backend();
    await b.stake('100');
    await expect(b.unstake('200')).rejects.toMatchObject({ code: 'INSUFFICIENT_STAKE' });
  });
});

describe('MockBackend events', () => {
  it('emits events to subscribers and replays recent events to late subscribers', async () => {
    const b = backend();
    const live: CasperProofEvent[] = [];
    const unsub = b.subscribeEvents((e) => live.push(e));
    const att = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    await b.challenge(att.id);
    expect(live.map((e) => e.name)).toEqual(['AttestationSubmitted', 'Challenged']);

    const late: CasperProofEvent[] = [];
    b.subscribeEvents((e) => late.push(e));
    expect(late.map((e) => e.name)).toEqual(['AttestationSubmitted', 'Challenged']);

    unsub();
    await b.resolve(att.id, true);
    // unsubscribed handler no longer receives events
    expect(live.map((e) => e.name)).toEqual(['AttestationSubmitted', 'Challenged']);
    // late subscriber still active
    expect(late.map((e) => e.name)).toContain('Resolved');
  });

  it('caps the recent-events buffer at 100', async () => {
    const b = backend();
    for (let i = 0; i < 120; i++) {
      await b.stake('1'); // stake emits no events, use submit to push events
    }
    for (let i = 0; i < 120; i++) {
      await b.submitAttestation({
        modelId: 'm',
        input: { i },
        output: {},
        uri: 's3://x',
        stake: '2000000000',
      });
    }
    const replayed: CasperProofEvent[] = [];
    b.subscribeEvents((e) => replayed.push(e));
    expect(replayed.length).toBe(100);
  });

  it('uses the real clock by default', async () => {
    const b = new MockBackend();
    const before = Math.floor(Date.now() / 1000);
    const res = await b.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    const stored = await b.getAttestation(res.id);
    expect(stored.createdAt).toBeGreaterThanOrEqual(before);
  });
});
