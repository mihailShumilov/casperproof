import { hashPayload } from '@casperproof/commitment';
import { describe, expect, it, vi } from 'vitest';
import { CasperProofSdk, createClient } from './client.js';
import { MockBackend } from './mock-backend.js';
import { RestBackend } from './rest-backend.js';
import type { Backend, FetchLike } from './types.js';

const STAKE = '2000000000';

describe('createClient mode selection', () => {
  it('returns a mock client by default (no token)', () => {
    const client = createClient({ env: {} });
    expect(client.mode).toBe('mock');
    // @ts-expect-error reach into the private backend for the assertion
    expect(client.backend).toBeInstanceOf(MockBackend);
  });

  it('returns a live (REST) client when a token is present', () => {
    const fetchImpl: FetchLike = vi.fn();
    const client = createClient({ csprCloudToken: 'tok', fetch: fetchImpl, env: {} });
    expect(client.mode).toBe('live');
    // @ts-expect-error reach into the private backend for the assertion
    expect(client.backend).toBeInstanceOf(RestBackend);
  });

  it('honors an explicit mock mode override', () => {
    const client = createClient({ mode: 'mock', csprCloudToken: 'tok', env: {} });
    expect(client.mode).toBe('mock');
  });

  it('constructs with no config at all', () => {
    expect(createClient()).toBeInstanceOf(CasperProofSdk);
  });
});

describe('CasperProofSdk.verify', () => {
  it('returns valid=true when the payload matches the on-chain output (PASS)', async () => {
    const client = createClient({ env: {} });
    const output = { score: 73, tier: 'HIGH' };
    const { id } = await client.submitAttestation({
      modelId: 'casperproof-riskscorer-v1',
      input: { address: 'account-hash-aabbcc' },
      output,
      uri: 's3://x',
      stake: STAKE,
    });
    const result = await client.verify(id, output);
    expect(result.valid).toBe(true);
    expect(result.recomputedHash).toBe(hashPayload(output));
    expect(result.onchainHash).toBe(result.recomputedHash);
    expect(result.attestor).toBeDefined();
    expect(result.stake).toBe(STAKE);
    expect(result.reputation.score).toBe(1);
  });

  it('returns valid=false when the payload was tampered (FAIL)', async () => {
    const client = createClient({ env: {} });
    const { id } = await client.submitAttestation({
      modelId: 'm',
      input: {},
      output: { score: 73 },
      uri: 's3://x',
      stake: STAKE,
    });
    const result = await client.verify(id, { score: 9999 });
    expect(result.valid).toBe(false);
    expect(result.recomputedHash).not.toBe(result.onchainHash);
  });

  it('propagates ATTESTATION_NOT_FOUND from verify', async () => {
    const client = createClient({ env: {} });
    await expect(client.verify(999, {})).rejects.toMatchObject({ code: 'ATTESTATION_NOT_FOUND' });
  });
});

describe('CasperProofSdk delegation', () => {
  it('delegates every method to the backend', async () => {
    const calls: string[] = [];
    const unsub = vi.fn();
    const stub: Backend = {
      mode: 'mock',
      submitAttestation: vi.fn(async () => {
        calls.push('submitAttestation');
        return {
          id: 1,
          deployHash: 'd',
          commitment: 'c',
          inputHash: 'i',
          outputHash: 'o',
          status: 'Active' as const,
        };
      }),
      getAttestation: vi.fn(async () => {
        calls.push('getAttestation');
        return {
          id: 1,
          attestor: 'a',
          modelId: 'm',
          inputHash: 'i',
          outputHash: 'o',
          commitment: 'c',
          uri: 'u',
          stake: '1',
          createdAt: 0,
          status: 'Active' as const,
        };
      }),
      attestationCount: vi.fn(async () => {
        calls.push('attestationCount');
        return 3;
      }),
      attestorReputation: vi.fn(async () => {
        calls.push('attestorReputation');
        return { address: 'a', successful: 0, slashed: 0, challengesDefended: 0, score: 1 };
      }),
      challenge: vi.fn(async () => {
        calls.push('challenge');
        return { deployHash: 'd', id: 1, status: 'Challenged' as const };
      }),
      resolve: vi.fn(async () => {
        calls.push('resolve');
        return { deployHash: 'd', id: 1, status: 'Slashed' as const };
      }),
      createPolicy: vi.fn(async () => {
        calls.push('createPolicy');
        return {
          id: 1,
          holder: 'h',
          coverage: '1',
          premium: '1',
          triggerTypes: [],
          expiry: 0,
          status: 'Active' as const,
        };
      }),
      getPolicy: vi.fn(async () => {
        calls.push('getPolicy');
        return {
          id: 1,
          holder: 'h',
          coverage: '1',
          premium: '1',
          triggerTypes: [],
          expiry: 0,
          status: 'Active' as const,
        };
      }),
      submitClaim: vi.fn(async () => {
        calls.push('submitClaim');
        return { deployHash: 'd', policyId: 1, attestationId: 2, paid: true, amount: '1' };
      }),
      getRiskScore: vi.fn(async () => {
        calls.push('getRiskScore');
        return { address: 'a', score: 1, tier: 'LOW' as const };
      }),
      stake: vi.fn(async () => {
        calls.push('stake');
        return { deployHash: 'd' };
      }),
      unstake: vi.fn(async () => {
        calls.push('unstake');
        return { deployHash: 'd' };
      }),
      subscribeEvents: vi.fn(() => {
        calls.push('subscribeEvents');
        return unsub;
      }),
    };

    const client = new CasperProofSdk(stub);
    expect(client.mode).toBe('mock');

    await client.submitAttestation({ modelId: 'm', input: {}, output: {}, uri: 'u', stake: '1' });
    await client.getAttestation(1);
    await client.attestationCount();
    await client.attestorReputation('a');
    await client.challenge(1);
    await client.resolve(1, true);
    await client.createPolicy({ coverage: '1', premium: '1', triggerTypes: [], expiry: 0 });
    await client.getPolicy(1);
    await client.submitClaim(1, 2);
    await client.getRiskScore('a');
    await client.stake('1');
    await client.unstake('1');
    const off = client.subscribeEvents(() => undefined);
    off();

    expect(calls).toEqual([
      'submitAttestation',
      'getAttestation',
      'attestationCount',
      'attestorReputation',
      'challenge',
      'resolve',
      'createPolicy',
      'getPolicy',
      'submitClaim',
      'getRiskScore',
      'stake',
      'unstake',
      'subscribeEvents',
    ]);
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('drives the full demo flow end-to-end in mock mode', async () => {
    const client = createClient({ env: {} });
    const att = await client.submitAttestation({
      modelId: 'casperproof-claimoracle-v1',
      input: { policyId: 7 },
      output: { decision: 'payout' },
      uri: 's3://payload#trigger=oracle_failure',
      stake: STAKE,
    });
    const policy = await client.createPolicy({
      coverage: '5000000000',
      premium: '100000000',
      triggerTypes: ['oracle_failure'],
      expiry: Math.floor(Date.now() / 1000) + 100000,
    });
    const claim = await client.submitClaim(policy.id, att.id);
    expect(claim.paid).toBe(true);

    // tamper -> verify FAIL -> challenge -> resolve(fraudulent) slash
    const verifyFail = await client.verify(att.id, { decision: 'denied' });
    expect(verifyFail.valid).toBe(false);
    await client.challenge(att.id);
    const slashed = await client.resolve(att.id, true);
    expect(slashed.status).toBe('Slashed');
    const stored = await client.getAttestation(att.id);
    expect((await client.attestorReputation(stored.attestor)).slashed).toBe(1);
  });
});
