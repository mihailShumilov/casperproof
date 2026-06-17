/** x402-server configuration, resolved from env with working local defaults. */
export interface X402Config {
  port: number;
  /** Price per gated request, in USD (string to avoid float drift). */
  priceUsd: string;
  /** Account that receives the micropayment. */
  payTo: string;
  /** Casper x402 facilitator base URL (empty ⇒ mock verifier). */
  facilitatorUrl: string;
  /** Force the mock payment verifier even if a facilitator URL is set. */
  mock: boolean;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): X402Config {
  const facilitatorUrl = env.X402_FACILITATOR_URL ?? '';
  // Fail closed in production: only use the mock verifier when explicitly opted in, or when no
  // facilitator is configured outside production (local dev / tests). A production deploy with
  // neither a facilitator URL nor `X402_MOCK=true` will deny all gated requests rather than
  // silently serve them ungated.
  const mock = env.X402_MOCK === 'true' || (facilitatorUrl === '' && env.NODE_ENV !== 'production');
  return {
    port: Number.parseInt(env.X402_SERVER_PORT ?? '8402', 10),
    priceUsd: env.X402_PRICE_USD ?? '0.01',
    payTo: env.X402_PAY_TO ?? 'casperproof-treasury',
    facilitatorUrl,
    mock,
  };
}
