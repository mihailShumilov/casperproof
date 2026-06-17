import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createClient } from '@casperproof/casper-sdk';
import { attest, createStore, loadStoreConfig, type PayloadStore } from '@casperproof/agent';
import { buildServer, createServer } from './server.js';
import { loadConfig } from './config.js';
import { MockPaymentVerifier } from './payment.js';

const PAY = { 'x-payment': 'mock:demo-token' };

async function seed(store: PayloadStore, sdk: ReturnType<typeof createClient>) {
  // Store a payload + submit an attestation through the same store/sdk the server uses.
  return attest(sdk, store, {
    modelId: 'casperproof-riskscorer-v1',
    input: { address: 'acct-1', signals: 15 },
    output: { score: 73, tier: 'HIGH', decision: 'review' },
    timestamp: 1_718_600_000,
    stake: '1000000000000',
  });
}

describe('x402-server', () => {
  let app: FastifyInstance;
  let store: PayloadStore;
  let sdk: ReturnType<typeof createClient>;
  let uri: string;
  let id: number;

  beforeEach(async () => {
    sdk = createClient({ env: {} });
    store = createStore(loadStoreConfig({})); // empty env ⇒ in-memory backend
    const res = await seed(store, sdk);
    uri = res.uri;
    id = res.id;
    app = buildServer({
      sdk,
      store,
      paymentVerifier: new MockPaymentVerifier(),
      config: loadConfig({}),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('healthz reports ok + mock mode', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', mode: 'mock' });
  });

  it('returns 402 with an RFC 7807 body when unpaid', async () => {
    const res = await app.inject({ method: 'GET', url: '/attestation/0' });
    expect(res.statusCode).toBe(402);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json();
    expect(body.code).toBe('PAYMENT_REQUIRED');
    expect(body.status).toBe(402);
    expect(body.price_usd).toBe('0.01');
    expect(body.pay_to).toBe('casperproof-treasury');
  });

  it('serves the attestation + payload when paid', async () => {
    const res = await app.inject({ method: 'GET', url: `/attestation/${id}`, headers: PAY });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-payment-settlement']).toBeTruthy();
    const body = res.json();
    expect(body.attestation.id).toBe(id);
    expect(body.attestation.uri).toBe(uri);
    expect(body.payload.output.tier).toBe('HIGH');
  });

  it('verifies PASS for an untampered payload', async () => {
    const res = await app.inject({ method: 'POST', url: '/verify', headers: PAY, payload: { id } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(true);
    expect(body.recomputedHash).toBe(body.onchainHash);
  });

  it('verifies FAIL after the payload is tampered', async () => {
    store.corrupt(uri);
    const res = await app.inject({ method: 'POST', url: '/verify', headers: PAY, payload: { id } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.valid).toBe(false);
    expect(body.recomputedHash).not.toBe(body.onchainHash);
  });

  it('404s an unknown attestation', async () => {
    const res = await app.inject({ method: 'GET', url: '/attestation/999', headers: PAY });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('ATTESTATION_NOT_FOUND');
  });

  it('400s a verify request without a numeric id', async () => {
    const res = await app.inject({ method: 'POST', url: '/verify', headers: PAY, payload: { id: 'nope' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('BAD_REQUEST');
  });

  it('400s a bad attestation id in the path', async () => {
    const res = await app.inject({ method: 'GET', url: '/attestation/-5', headers: PAY });
    expect(res.statusCode).toBe(400);
  });

  it('502s when the on-chain attestation exists but its payload is missing', async () => {
    // Submit metadata pointing at a uri the store never received.
    const submitted = await sdk.submitAttestation({
      modelId: 'casperproof-riskscorer-v1',
      input: { a: 1 },
      output: { b: 2 },
      timestamp: 1,
      uri: 'memory://casperproof-payloads/deadbeef',
      stake: '1000000000000',
    });
    const res = await app.inject({ method: 'GET', url: `/attestation/${submitted.id}`, headers: PAY });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('PAYLOAD_UNAVAILABLE');
  });

  it('500s (internal) when verify fails for a non-not-found reason', async () => {
    const submitted = await sdk.submitAttestation({
      modelId: 'casperproof-riskscorer-v1',
      input: { a: 1 },
      output: { b: 2 },
      timestamp: 1,
      uri: 'memory://casperproof-payloads/deadbeef',
      stake: '1000000000000',
    });
    const res = await app.inject({ method: 'POST', url: '/verify', headers: PAY, payload: { id: submitted.id } });
    expect(res.statusCode).toBe(500);
    expect(res.json().code).toBe('INTERNAL_ERROR');
  });
});

describe('createServer (from env)', () => {
  it('builds a server in mock mode with no secrets', async () => {
    const app = createServer({});
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json().mode).toBe('mock');
    // Unpaid gated route still challenges with 402.
    const gated = await app.inject({ method: 'GET', url: '/attestation/1' });
    expect(gated.statusCode).toBe(402);
    await app.close();
  });
});
