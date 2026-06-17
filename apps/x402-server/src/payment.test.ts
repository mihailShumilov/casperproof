import { describe, expect, it, vi } from 'vitest';
import {
  createPaymentVerifier,
  FacilitatorPaymentVerifier,
  MockPaymentVerifier,
} from './payment.js';

const ctx = { resource: 'GET /attestation/1', priceUsd: '0.01' };

describe('MockPaymentVerifier', () => {
  it('accepts a non-empty X-PAYMENT header', async () => {
    const r = await new MockPaymentVerifier().verify('mock:tok', ctx);
    expect(r.ok).toBe(true);
    expect(r.settlement).toContain('mock-');
  });
  it('rejects a missing or empty header', async () => {
    expect((await new MockPaymentVerifier().verify(undefined, ctx)).ok).toBe(false);
    expect((await new MockPaymentVerifier().verify('   ', ctx)).ok).toBe(false);
  });
});

describe('FacilitatorPaymentVerifier', () => {
  const url = 'https://facilitator.example';

  it('rejects when no header is present', async () => {
    const v = new FacilitatorPaymentVerifier(url, vi.fn());
    expect((await v.verify(undefined, ctx)).ok).toBe(false);
  });

  it('accepts when the facilitator validates the payment', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ valid: true, settlement: 'stl-1' }), { status: 200 }),
    );
    const v = new FacilitatorPaymentVerifier(url, fetchImpl as unknown as typeof fetch);
    const r = await v.verify('proof', ctx);
    expect(r.ok).toBe(true);
    expect(r.settlement).toBe('stl-1');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('rejects when the facilitator says the payment is invalid', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ valid: false }), { status: 200 }));
    const v = new FacilitatorPaymentVerifier(url, fetchImpl as unknown as typeof fetch);
    expect((await v.verify('proof', ctx)).ok).toBe(false);
  });

  it('rejects on a non-2xx facilitator response', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }));
    const v = new FacilitatorPaymentVerifier(url, fetchImpl as unknown as typeof fetch);
    const r = await v.verify('proof', ctx);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('500');
  });

  it('never throws when the facilitator is unreachable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const v = new FacilitatorPaymentVerifier(url, fetchImpl as unknown as typeof fetch);
    const r = await v.verify('proof', ctx);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('unreachable');
  });
});

describe('createPaymentVerifier', () => {
  it('returns the mock verifier when mock=true', () => {
    expect(createPaymentVerifier({ mock: true, facilitatorUrl: 'x' })).toBeInstanceOf(MockPaymentVerifier);
  });
  it('returns the mock verifier when no facilitator url', () => {
    expect(createPaymentVerifier({ mock: false, facilitatorUrl: '' })).toBeInstanceOf(MockPaymentVerifier);
  });
  it('returns the facilitator verifier when configured', () => {
    expect(
      createPaymentVerifier({ mock: false, facilitatorUrl: 'https://f' }),
    ).toBeInstanceOf(FacilitatorPaymentVerifier);
  });
});
