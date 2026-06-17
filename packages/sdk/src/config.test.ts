import { describe, expect, it, vi } from 'vitest';
import { resolveConfig } from './config.js';
import { CasperProofSdkError } from './errors.js';
import type { FetchLike } from './types.js';

describe('resolveConfig', () => {
  it('defaults to mock mode with no token', () => {
    const c = resolveConfig({ env: {} });
    expect(c.mode).toBe('mock');
    expect(c.csprCloudToken).toBeUndefined();
    expect(c.csprCloudRestUrl).toBe('https://api.testnet.cspr.cloud');
    expect(c.casperNodeUrl).toBe('https://node.testnet.casper.network/rpc');
    expect(c.casperNetworkName).toBe('casper-test');
    expect(c.timeoutMs).toBe(10_000);
    expect(c.retries).toBe(2);
    expect(c.retryBaseDelayMs).toBe(50);
  });

  it('selects live mode when a token is present in env', () => {
    const c = resolveConfig({ env: { CSPR_CLOUD_TOKEN: 'tok' } });
    expect(c.mode).toBe('live');
    expect(c.csprCloudToken).toBe('tok');
  });

  it('selects live mode when a token is passed explicitly', () => {
    expect(resolveConfig({ csprCloudToken: 'tok', env: {} }).mode).toBe('live');
  });

  it('treats whitespace-only token as unset (stays mock)', () => {
    const c = resolveConfig({ env: { CSPR_CLOUD_TOKEN: '   ' } });
    expect(c.mode).toBe('mock');
    expect(c.csprCloudToken).toBeUndefined();
  });

  it('honors an explicit mode override even with a token', () => {
    expect(resolveConfig({ mode: 'mock', csprCloudToken: 'tok', env: {} }).mode).toBe('mock');
  });

  it('reads contract hashes from env', () => {
    const c = resolveConfig({
      env: {
        ATTESTATION_REGISTRY_HASH: 'hash-contract-aaa',
        INSURANCE_HASH: 'hash-contract-bbb',
        STAKE_TOKEN_HASH: 'hash-contract-ccc',
        CSPR_CLOUD_REST_URL: 'https://rest.example',
        CSPR_CLOUD_STREAMING_URL: 'wss://stream.example',
        CASPER_NODE_URL: 'https://node.example',
        CASPER_NETWORK_NAME: 'casper-net',
      },
    });
    expect(c.attestationRegistryHash).toBe('hash-contract-aaa');
    expect(c.insuranceHash).toBe('hash-contract-bbb');
    expect(c.stakeTokenHash).toBe('hash-contract-ccc');
    expect(c.csprCloudRestUrl).toBe('https://rest.example');
    expect(c.csprCloudStreamingUrl).toBe('wss://stream.example');
    expect(c.casperNodeUrl).toBe('https://node.example');
    expect(c.casperNetworkName).toBe('casper-net');
  });

  it('explicit config overrides env', () => {
    const c = resolveConfig({
      csprCloudRestUrl: 'https://override',
      env: { CSPR_CLOUD_REST_URL: 'https://env' },
    });
    expect(c.csprCloudRestUrl).toBe('https://override');
  });

  it('accepts custom numeric tuning knobs', () => {
    const c = resolveConfig({ env: {}, timeoutMs: 500, retries: 5, retryBaseDelayMs: 10 });
    expect(c.timeoutMs).toBe(500);
    expect(c.retries).toBe(5);
    expect(c.retryBaseDelayMs).toBe(10);
  });

  it('rejects invalid numeric config', () => {
    expect(() => resolveConfig({ env: {}, retries: -1 })).toThrow(CasperProofSdkError);
    expect(() => resolveConfig({ env: {}, timeoutMs: 1.5 })).toThrow(/Invalid config/);
  });

  it('uses the injected fetch implementation', async () => {
    const fakeFetch: FetchLike = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    }));
    const c = resolveConfig({ env: {}, fetch: fakeFetch });
    expect(c.fetch).toBe(fakeFetch);
  });

  it('binds the global fetch when available', () => {
    const original = (globalThis as { fetch?: unknown }).fetch;
    const stub = vi.fn();
    (globalThis as { fetch?: unknown }).fetch = stub;
    try {
      const c = resolveConfig({ env: {} });
      expect(typeof c.fetch).toBe('function');
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
  });

  it('returns a throwing fetch stub when no global fetch exists', async () => {
    const original = (globalThis as { fetch?: unknown }).fetch;
    // @ts-expect-error simulate an environment without fetch
    delete (globalThis as { fetch?: unknown }).fetch;
    try {
      const c = resolveConfig({ env: {} });
      await expect(c.fetch('https://x')).rejects.toThrow(/No global `fetch`/);
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
  });

  it('falls back to process.env when no env is supplied', () => {
    const prev = process.env['CASPER_NETWORK_NAME'];
    process.env['CASPER_NETWORK_NAME'] = 'casper-from-process';
    try {
      const c = resolveConfig();
      expect(c.casperNetworkName).toBe('casper-from-process');
    } finally {
      if (prev === undefined) delete process.env['CASPER_NETWORK_NAME'];
      else process.env['CASPER_NETWORK_NAME'] = prev;
    }
  });
});
