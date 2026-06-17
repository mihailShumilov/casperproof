import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses working defaults + mock mode with an empty env (local/dev)', () => {
    const c = loadConfig({});
    expect(c.port).toBe(8402);
    expect(c.priceUsd).toBe('0.01');
    expect(c.payTo).toBe('casperproof-treasury');
    expect(c.facilitatorUrl).toBe('');
    expect(c.mock).toBe(true);
  });

  it('reads overrides from env', () => {
    const c = loadConfig({
      X402_SERVER_PORT: '9999',
      X402_PRICE_USD: '0.05',
      X402_PAY_TO: 'treasury-x',
      X402_FACILITATOR_URL: 'https://f',
    });
    expect(c.port).toBe(9999);
    expect(c.priceUsd).toBe('0.05');
    expect(c.payTo).toBe('treasury-x');
    expect(c.facilitatorUrl).toBe('https://f');
    expect(c.mock).toBe(false); // facilitator set ⇒ not mock
  });

  it('honors an explicit X402_MOCK=true even with a facilitator url', () => {
    expect(loadConfig({ X402_FACILITATOR_URL: 'https://f', X402_MOCK: 'true' }).mock).toBe(true);
  });

  it('fails closed in production with no facilitator and no explicit mock', () => {
    expect(loadConfig({ NODE_ENV: 'production' }).mock).toBe(false);
  });
});
