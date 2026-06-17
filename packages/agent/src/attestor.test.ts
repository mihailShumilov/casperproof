import { createClient } from '@casperproof/casper-sdk';
import { computeCommitment } from '@casperproof/commitment';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from './agent.config.js';
import { attest } from './attestor.js';
import { createStore, loadStoreConfig } from './store.js';

function newSdk() {
  return createClient({ mode: 'mock' });
}

describe('attest', () => {
  it('stores the payload, submits on-chain, and returns id + uri + hashes', async () => {
    const sdk = newSdk();
    const store = createStore(loadStoreConfig({}));
    const result = await attest(
      sdk,
      store,
      {
        modelId: 'casperproof-riskscorer-v1',
        input: { address: 'account-hash-abc' },
        output: { score: 73, tier: 'HIGH' },
        timestamp: 1_700_000_000,
      },
      defaultConfig,
    );

    expect(result.id).toBeGreaterThan(0);
    expect(result.uri).toMatch(/^s3:\/\/casperproof-payloads\/[0-9a-f]{64}$/);
    expect(result.status).toBe('Active');

    // The on-chain output hash equals the commitment over the same output.
    const expected = computeCommitment({
      input: { address: 'account-hash-abc' },
      output: { score: 73, tier: 'HIGH' },
      modelId: 'casperproof-riskscorer-v1',
      timestamp: 1_700_000_000,
    });
    expect(result.outputHash).toBe(expected.outputHash);

    // The stored payload is a wrapper carrying the output we can re-derive from.
    const stored = (await store.getJson(result.uri)) as { output: unknown; modelId: string };
    expect(stored.output).toEqual({ score: 73, tier: 'HIGH' });
    expect(stored.modelId).toBe('casperproof-riskscorer-v1');
  });

  it('defaults stake from the agent config and timestamp to now', async () => {
    const sdk = newSdk();
    const store = createStore(loadStoreConfig({}));
    const before = Math.floor(Date.now() / 1000);
    const result = await attest(sdk, store, {
      modelId: 'm',
      input: { a: 1 },
      output: { b: 2 },
    });
    const attestation = await sdk.getAttestation(result.id);
    expect(attestation.stake).toBe(defaultConfig.attestationStake);
    expect(attestation.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('honors an explicit attestor address', async () => {
    const sdk = newSdk();
    const store = createStore(loadStoreConfig({}));
    const attestor =
      'account-hash-1111111111111111111111111111111111111111111111111111111111111111';
    const result = await attest(sdk, store, {
      modelId: 'm',
      input: { a: 1 },
      output: { b: 2 },
      attestor,
      stake: '3000000000',
    });
    const attestation = await sdk.getAttestation(result.id);
    expect(attestation.attestor).toBe(attestor);
    expect(attestation.stake).toBe('3000000000');
  });
});
