import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveConfig } from './config.js';
import { CasperProofSdkError } from './errors.js';
import { createRestBackend, RestBackend } from './rest-backend.js';
import type { FetchLike, FetchResponseLike, ResolvedConfig } from './types.js';

/** A queued response or a thrown error for the mock fetch. */
type Step =
  | { ok: true; status?: number; json?: unknown; text?: string }
  | {
      ok: false;
      status: number;
      json?: unknown;
      jsonThrows?: boolean;
      text?: string;
      textThrows?: boolean;
    }
  | { throw: Error };

function mockFetch(steps: Step[]): FetchLike & ReturnType<typeof vi.fn> {
  let i = 0;
  return vi.fn(async (): Promise<FetchResponseLike> => {
    const step = steps[Math.min(i, steps.length - 1)];
    i++;
    if (step && 'throw' in step) throw step.throw;
    const s = step as Extract<Step, { ok: boolean }>;
    return {
      ok: s.ok,
      status: s.status ?? (s.ok ? 200 : 500),
      json: async () => {
        if ('jsonThrows' in s && s.jsonThrows) throw new Error('not json');
        return s.json ?? {};
      },
      text: async () => {
        if ('textThrows' in s && s.textThrows) throw new Error('no text');
        return s.text ?? '';
      },
    };
  }) as FetchLike & ReturnType<typeof vi.fn>;
}

function liveConfig(fetchImpl: FetchLike, overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return resolveConfig({
    csprCloudToken: 'test-token',
    csprCloudRestUrl: 'https://api.testnet.cspr.cloud/',
    fetch: fetchImpl,
    retries: 2,
    retryBaseDelayMs: 1,
    timeoutMs: 50,
    env: {},
    ...overrides,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RestBackend reads', () => {
  it('exposes live mode and is constructible via the factory', () => {
    const b = createRestBackend(liveConfig(mockFetch([{ ok: true }])));
    expect(b).toBeInstanceOf(RestBackend);
    expect(b.mode).toBe('live');
  });

  it('sends the Authorization header and strips a trailing slash from the base URL', async () => {
    const f = mockFetch([{ ok: true, json: { attestor: 'a', status: 'Active' } }]);
    const b = new RestBackend(liveConfig(f));
    await b.getAttestation(5);
    expect(f).toHaveBeenCalledWith(
      'https://api.testnet.cspr.cloud/attestations/5',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'test-token' }),
      }),
    );
  });

  it('maps a full attestation, including the challenger', async () => {
    const f = mockFetch([
      {
        ok: true,
        json: {
          attestor: 'account-hash-a',
          model_id: 'casperproof-riskscorer-v1',
          input_hash: 'aa',
          output_hash: 'bb',
          commitment: 'cc',
          uri: 's3://x',
          stake: '2000000000',
          created_at: 1718600000,
          status: 'Challenged',
          challenger: 'account-hash-c',
        },
      },
    ]);
    const att = await new RestBackend(liveConfig(f)).getAttestation(9);
    expect(att).toMatchObject({
      id: 9,
      attestor: 'account-hash-a',
      modelId: 'casperproof-riskscorer-v1',
      inputHash: 'aa',
      outputHash: 'bb',
      status: 'Challenged',
      challenger: 'account-hash-c',
    });
  });

  it('defaults missing attestation fields and an unknown status', async () => {
    const f = mockFetch([{ ok: true, json: { challenger: '' } }]);
    const att = await new RestBackend(liveConfig(f)).getAttestation(1);
    expect(att.attestor).toBe('');
    expect(att.status).toBe('Active');
    expect(att.stake).toBe('0');
    expect(att.challenger).toBeUndefined();
  });

  it('reads the attestation count (numeric and string forms)', async () => {
    expect(
      await new RestBackend(
        liveConfig(mockFetch([{ ok: true, json: { count: 12 } }])),
      ).attestationCount(),
    ).toBe(12);
    expect(
      await new RestBackend(
        liveConfig(mockFetch([{ ok: true, json: { count: '7' } }])),
      ).attestationCount(),
    ).toBe(7);
    expect(
      await new RestBackend(liveConfig(mockFetch([{ ok: true, json: {} }]))).attestationCount(),
    ).toBe(0);
  });

  it('reads reputation (camelCase and snake_case challenges field)', async () => {
    const camel = await new RestBackend(
      liveConfig(
        mockFetch([{ ok: true, json: { successful: 3, slashed: 1, challengesDefended: 2 } }]),
      ),
    ).attestorReputation('account-hash-a');
    expect(camel).toMatchObject({ successful: 3, slashed: 1, challengesDefended: 2 });
    expect(camel.score).toBeCloseTo(0.75);

    const snake = await new RestBackend(
      liveConfig(mockFetch([{ ok: true, json: { challenges_defended: 5 } }])),
    ).attestorReputation('account-hash-b');
    expect(snake.challengesDefended).toBe(5);
    expect(snake.score).toBe(1); // no resolved attestations
  });

  it('reads a policy with snake_case triggers and filters unknown triggers', async () => {
    const f = mockFetch([
      {
        ok: true,
        json: {
          holder: 'account-hash-h',
          coverage: '5000000000',
          premium: '100',
          trigger_types: ['oracle_failure', 'nonsense', 'exploit'],
          expiry: 1900000000,
          status: 'Active',
        },
      },
    ]);
    const policy = await new RestBackend(liveConfig(f)).getPolicy(3);
    expect(policy.triggerTypes).toEqual(['oracle_failure', 'exploit']);
    expect(policy.status).toBe('Active');
  });

  it('defaults policy fields and non-array triggers', async () => {
    const policy = await new RestBackend(
      liveConfig(mockFetch([{ ok: true, json: { status: 'weird' } }])),
    ).getPolicy(1);
    expect(policy.holder).toBe('');
    expect(policy.coverage).toBe('0');
    expect(policy.triggerTypes).toEqual([]);
    expect(policy.status).toBe('Active');
  });

  it('reads a risk score honoring an explicit tier', async () => {
    const f = mockFetch([{ ok: true, json: { score: 10, tier: 'HIGH' } }]);
    expect((await new RestBackend(liveConfig(f)).getRiskScore('a')).tier).toBe('HIGH');
  });

  it('derives the risk tier when none is provided (all three branches)', async () => {
    expect(
      (
        await new RestBackend(
          liveConfig(mockFetch([{ ok: true, json: { score: 10 } }])),
        ).getRiskScore('a')
      ).tier,
    ).toBe('LOW');
    expect(
      (
        await new RestBackend(
          liveConfig(mockFetch([{ ok: true, json: { score: 50 } }])),
        ).getRiskScore('a')
      ).tier,
    ).toBe('MEDIUM');
    expect(
      (
        await new RestBackend(
          liveConfig(mockFetch([{ ok: true, json: { score: 90 } }])),
        ).getRiskScore('a')
      ).tier,
    ).toBe('HIGH');
  });
});

describe('RestBackend error mapping + retries', () => {
  it('maps a non-retryable RFC 7807 problem to a typed error', async () => {
    const f = mockFetch([
      { ok: false, status: 404, json: { code: 'ATTESTATION_NOT_FOUND', detail: 'gone' } },
    ]);
    await expect(new RestBackend(liveConfig(f)).getAttestation(1)).rejects.toMatchObject({
      code: 'ATTESTATION_NOT_FOUND',
      status: 404,
    });
    expect(f).toHaveBeenCalledTimes(1); // not retried
  });

  it('falls back to text when the error body is not JSON', async () => {
    const f = mockFetch([{ ok: false, status: 422, jsonThrows: true, text: 'bad input' }]);
    const err = await new RestBackend(liveConfig(f))
      .getAttestation(1)
      .catch((e) => e as CasperProofSdkError);
    expect(err.status).toBe(422);
    // the text is wrapped as the RFC 7807 `detail` member, which becomes the message
    expect(err.message).toBe('bad input');
  });

  it('falls back to an empty body when both json and text throw', async () => {
    const f = mockFetch([{ ok: false, status: 500, jsonThrows: true, textThrows: true }]);
    const err = await new RestBackend(liveConfig(f))
      .getAttestation(1)
      .catch((e) => e as CasperProofSdkError);
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  it('retries retryable statuses then succeeds', async () => {
    vi.useFakeTimers();
    const f = mockFetch([
      { ok: false, status: 503, json: { code: 'INTERNAL_ERROR' } },
      { ok: true, json: { count: 4 } },
    ]);
    const p = new RestBackend(liveConfig(f)).attestationCount();
    await vi.runAllTimersAsync();
    expect(await p).toBe(4);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on a retryable status', async () => {
    vi.useFakeTimers();
    const f = mockFetch([{ ok: false, status: 429, json: { code: 'INTERNAL_ERROR' } }]);
    const p = new RestBackend(
      liveConfig(f, { retries: 2, retryBaseDelayMs: 1 }),
    ).attestationCount();
    const assertion = expect(p).rejects.toBeInstanceOf(CasperProofSdkError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(f).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('retries network/abort errors then surfaces INTERNAL_ERROR', async () => {
    vi.useFakeTimers();
    const f = mockFetch([{ throw: new Error('socket hang up') }]);
    const p = new RestBackend(
      liveConfig(f, { retries: 1, retryBaseDelayMs: 1 }),
    ).attestationCount();
    const assertion = expect(p).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    await vi.runAllTimersAsync();
    await assertion;
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('describes a non-Error thrown value when surfacing INTERNAL_ERROR', async () => {
    vi.useFakeTimers();
    // fetch rejects with a non-Error value to exercise the String() branch of describe().
    const f = vi.fn(() => Promise.reject('socket-string-failure')) as unknown as FetchLike;
    const p = new RestBackend(liveConfig(f, { retries: 0 })).attestationCount();
    const assertion = expect(p).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('retries a network error then succeeds on the next attempt', async () => {
    vi.useFakeTimers();
    const f = mockFetch([{ throw: new Error('transient') }, { ok: true, json: { count: 9 } }]);
    const p = new RestBackend(
      liveConfig(f, { retries: 2, retryBaseDelayMs: 1 }),
    ).attestationCount();
    await vi.runAllTimersAsync();
    expect(await p).toBe(9);
  });

  it('does not retry when retries is 0', async () => {
    const f = mockFetch([{ ok: false, status: 503, json: { code: 'INTERNAL_ERROR' } }]);
    await expect(
      new RestBackend(liveConfig(f, { retries: 0 })).attestationCount(),
    ).rejects.toBeInstanceOf(CasperProofSdkError);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('RestBackend writes (deterministic placeholder deploy hashes)', () => {
  const noFetch = mockFetch([{ throw: new Error('should not be called') }]);

  it('submitAttestation computes commitment locally and returns a deploy hash', async () => {
    const b = new RestBackend(liveConfig(noFetch));
    const res = await b.submitAttestation({
      modelId: 'casperproof-riskscorer-v1',
      input: { a: 1 },
      output: { score: 42, tier: 'LOW' },
      timestamp: 1718600000,
      uri: 's3://x',
      stake: '2000000000',
    });
    // outputHash matches the golden vector for {score:42,tier:'LOW'}
    expect(res.outputHash).toBe('0aa28e94eaa6845edec84af8a6c77121a0a3f21815ff09c49733f04af52f5e9e');
    expect(res.deployHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.status).toBe('Active');
  });

  it('submitAttestation defaults the timestamp', async () => {
    const res = await new RestBackend(liveConfig(noFetch)).submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://x',
      stake: '2000000000',
    });
    expect(res.deployHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('challenge/resolve/createPolicy/submitClaim/stake/unstake return deploy hashes', async () => {
    const b = new RestBackend(liveConfig(noFetch));
    expect((await b.challenge(1)).status).toBe('Challenged');
    expect((await b.resolve(1, true)).status).toBe('Slashed');
    expect((await b.resolve(1, false)).status).toBe('Finalized');
    const policy = await b.createPolicy({
      coverage: '1',
      premium: '1',
      triggerTypes: ['exploit'],
      expiry: 1,
      holder: 'h',
    });
    expect(policy.holder).toBe('h');
    const policy2 = await b.createPolicy({
      coverage: '1',
      premium: '1',
      triggerTypes: [],
      expiry: 1,
    });
    expect(policy2.holder).toBe('');
    const claim = await b.submitClaim(1, 2);
    expect(claim).toMatchObject({ policyId: 1, attestationId: 2, paid: true });
    expect((await b.stake('100')).deployHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await b.unstake('50')).deployHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('subscribeEvents is a no-op unsubscribe in live mode', () => {
    const unsub = new RestBackend(liveConfig(noFetch)).subscribeEvents(() => undefined);
    expect(() => unsub()).not.toThrow();
  });
});
