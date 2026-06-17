import { describe, expect, it } from 'vitest';
import {
  APPLICATION_PROBLEM_JSON,
  attestationNotFound,
  badRequest,
  internalError,
  paymentRequired,
  payloadUnavailable,
} from './problem.js';

describe('problem builders (RFC 7807)', () => {
  it('paymentRequired carries price + pay-to and a 402 status', () => {
    const p = paymentRequired('0.01', 'treasury', '/attestation/1');
    expect(p).toMatchObject({
      status: 402,
      code: 'PAYMENT_REQUIRED',
      price_usd: '0.01',
      pay_to: 'treasury',
      instance: '/attestation/1',
      type: 'https://casperproof.com/problems/payment-required',
    });
  });

  it('attestationNotFound is a 404 with the id', () => {
    const p = attestationNotFound(7);
    expect(p.status).toBe(404);
    expect(p.code).toBe('ATTESTATION_NOT_FOUND');
    expect(p.attestation_id).toBe(7);
  });

  it('payloadUnavailable is a 502 with the uri', () => {
    const p = payloadUnavailable('memory://b/k');
    expect(p.status).toBe(502);
    expect(p.code).toBe('PAYLOAD_UNAVAILABLE');
    expect(p.uri).toBe('memory://b/k');
  });

  it('badRequest is a 400', () => {
    expect(badRequest('bad').status).toBe(400);
    expect(badRequest('bad').code).toBe('BAD_REQUEST');
  });

  it('internalError is a 500 with no leaked detail', () => {
    const p = internalError();
    expect(p.status).toBe(500);
    expect(p.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(p)).not.toContain('stack');
  });

  it('exposes the problem+json content type', () => {
    expect(APPLICATION_PROBLEM_JSON).toBe('application/problem+json');
  });
});
