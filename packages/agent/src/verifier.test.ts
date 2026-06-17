import { createClient } from '@casperproof/casper-sdk';
import { hashPayload } from '@casperproof/commitment';
import { describe, expect, it } from 'vitest';
import { attest } from './attestor.js';
import { createStore, loadStoreConfig, PayloadStore, MemoryBackend } from './store.js';
import { verify } from './verifier.js';

function setup() {
  const sdk = createClient({ mode: 'mock' });
  const store = createStore(loadStoreConfig({}));
  return { sdk, store };
}

describe('verify', () => {
  it('PASS: recomputed output hash matches the on-chain hash', async () => {
    const { sdk, store } = setup();
    const { id, outputHash } = await attest(sdk, store, {
      modelId: 'casperproof-riskscorer-v1',
      input: { address: 'account-hash-pass' },
      output: { score: 50, tier: 'MEDIUM' },
    });

    const result = await verify(sdk, store, id);
    expect(result.valid).toBe(true);
    expect(result.recomputedHash).toBe(outputHash);
    expect(result.onchainHash).toBe(outputHash);
    expect(result.attestor).toBeTruthy();
    expect(result.stake).toBeTruthy();
    expect(result.reputation.address).toBe(result.attestor);
    expect(result.uri).toMatch(/^s3:\/\//);
  });

  it('FAIL: tampered payload yields a hash mismatch', async () => {
    const { sdk, store } = setup();
    const { id, uri, outputHash } = await attest(sdk, store, {
      modelId: 'casperproof-riskscorer-v1',
      input: { address: 'account-hash-fail' },
      output: { score: 90, tier: 'EXTREME' },
    });

    await store.corrupt(uri, { output: { score: 1, tier: 'LOW' } });

    const result = await verify(sdk, store, id);
    expect(result.valid).toBe(false);
    expect(result.recomputedHash).not.toBe(outputHash);
    expect(result.onchainHash).toBe(outputHash);
  });

  it('handles a raw (non-wrapped) stored payload by hashing it directly', async () => {
    const sdk = createClient({ mode: 'mock' });
    const backend = new MemoryBackend();
    const store = new PayloadStore(backend, 'casperproof-payloads');

    // Store a raw output (no { output } wrapper) and submit an attestation pointing at it.
    const rawOutput = { score: 12, tier: 'LOW' };
    const uri = await store.put(rawOutput);
    const submit = await sdk.submitAttestation({
      modelId: 'm',
      input: { a: 1 },
      output: rawOutput,
      uri,
      stake: '2000000000',
    });

    const result = await verify(sdk, store, submit.id);
    expect(result.valid).toBe(true);
    expect(result.recomputedHash).toBe(hashPayload(rawOutput));
  });
});
