/**
 * x402 payment verification. The Casper facilitator verifies an `X-PAYMENT` header before a
 * gated resource is served. The interface is mockable so the server runs fully offline.
 */
export interface PaymentContext {
  /** The resource being paid for (e.g. `GET /attestation/1`). */
  resource: string;
  /** Price in USD. */
  priceUsd: string;
}

export interface PaymentResult {
  ok: boolean;
  reason?: string;
  /** Opaque settlement reference echoed back to the client. */
  settlement?: string;
}

export interface PaymentVerifier {
  verify(header: string | undefined, ctx: PaymentContext): Promise<PaymentResult>;
}

/**
 * Local mock verifier: accepts any non-empty `X-PAYMENT` header (optionally `mock:<token>`),
 * so the 402 → pay → 200 round-trip works without a live facilitator.
 */
export class MockPaymentVerifier implements PaymentVerifier {
  async verify(header: string | undefined, _ctx: PaymentContext): Promise<PaymentResult> {
    if (typeof header === 'string' && header.trim().length > 0) {
      return { ok: true, settlement: `mock-${header.replace(/^mock:/, '').slice(0, 16)}` };
    }
    return { ok: false, reason: 'missing X-PAYMENT header' };
  }
}

/**
 * Real verifier: posts the payment proof to the Casper x402 facilitator. Falls back to a clear
 * failure (never throws) if the facilitator is unreachable, so the route returns a 402 rather
 * than a 500.
 */
export class FacilitatorPaymentVerifier implements PaymentVerifier {
  constructor(
    private readonly facilitatorUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verify(header: string | undefined, ctx: PaymentContext): Promise<PaymentResult> {
    if (!header) {
      return { ok: false, reason: 'missing X-PAYMENT header' };
    }
    try {
      const res = await this.fetchImpl(`${this.facilitatorUrl.replace(/\/$/, '')}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payment: header, resource: ctx.resource, priceUsd: ctx.priceUsd }),
      });
      if (!res.ok) {
        return { ok: false, reason: `facilitator returned ${res.status}` };
      }
      const body = (await res.json()) as { valid?: boolean; settlement?: string };
      return body.valid
        ? { ok: true, settlement: body.settlement }
        : { ok: false, reason: 'facilitator rejected payment' };
    } catch (err) {
      return { ok: false, reason: `facilitator unreachable: ${(err as Error).message}` };
    }
  }
}

/** Fail-closed verifier: rejects every payment. Used in production when neither a facilitator
 * URL nor an explicit mock opt-in is configured, so a misconfigured deploy never serves ungated. */
export class DenyPaymentVerifier implements PaymentVerifier {
  async verify(): Promise<PaymentResult> {
    return { ok: false, reason: 'no payment verifier configured (fail closed)' };
  }
}

/** Pick a verifier based on config. Mock only when explicitly enabled (config decides);
 * otherwise a facilitator if configured, else fail closed. */
export function createPaymentVerifier(opts: {
  mock: boolean;
  facilitatorUrl: string;
}): PaymentVerifier {
  if (opts.mock) {
    return new MockPaymentVerifier();
  }
  if (opts.facilitatorUrl) {
    return new FacilitatorPaymentVerifier(opts.facilitatorUrl);
  }
  return new DenyPaymentVerifier();
}
