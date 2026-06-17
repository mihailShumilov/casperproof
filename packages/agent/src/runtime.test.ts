import { createClient } from '@casperproof/casper-sdk';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from './agent.config.js';
import { createStore, loadStoreConfig } from './store.js';
import {
  AgentRuntime,
  AnthropicBackend,
  createBackend,
  createRuntime,
  NoneBackend,
  OllamaBackend,
  OpenAiBackend,
} from './runtime.js';
import type { FetchLike, RuntimeContext } from './runtime.js';

const noneConfig = loadConfig({ LLM_BACKEND: 'none' });

function deps(extra: Partial<ConstructorParameters<typeof AgentRuntime>[0]> = {}) {
  return {
    config: noneConfig,
    sdk: createClient({ mode: 'mock' }),
    store: createStore(loadStoreConfig({})),
    backend: new NoneBackend(),
    ...extra,
  };
}

describe('NoneBackend.decide', () => {
  const backend = new NoneBackend();

  it('challenges when verification failed', async () => {
    const d = await backend.decide({ attestationId: 5, lastVerifyFailed: true });
    expect(d.action).toBe('challenge');
    expect(d.attestationId).toBe(5);
  });

  it('verifies when an attestation id is present', async () => {
    const d = await backend.decide({ attestationId: 7 });
    expect(d.action).toBe('verify');
  });

  it('attests when only an address is present', async () => {
    const d = await backend.decide({ address: 'account-hash-x' });
    expect(d.action).toBe('attest');
    expect(d.address).toBe('account-hash-x');
  });

  it('noops on an empty context', async () => {
    expect((await backend.decide({})).action).toBe('noop');
  });
});

describe('createBackend', () => {
  it('builds the none backend', () => {
    expect(createBackend(loadConfig({ LLM_BACKEND: 'none' })).kind).toBe('none');
  });

  it('builds the ollama backend with an injected fetch', () => {
    const f: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
    expect(createBackend(loadConfig({ LLM_BACKEND: 'ollama' }), f).kind).toBe('ollama');
  });

  it('throws building ollama with no fetch available', () => {
    const original = globalThis.fetch;
    // @ts-expect-error force-remove for the test
    delete globalThis.fetch;
    try {
      expect(() => createBackend(loadConfig({ LLM_BACKEND: 'ollama' }))).toThrow(/requires a global/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('throws building the openai backend (paid disabled)', () => {
    expect(() => createBackend(loadConfig({ LLM_BACKEND: 'openai' }))).toThrow(/paid backends disabled/);
  });

  it('throws building the anthropic backend (paid disabled)', () => {
    expect(() => createBackend(loadConfig({ LLM_BACKEND: 'anthropic' }))).toThrow(
      /paid backends disabled/,
    );
  });
});

describe('paid backend stubs', () => {
  it('OpenAiBackend constructor throws', () => {
    expect(() => new OpenAiBackend()).toThrow(/paid backends disabled/);
  });
  it('AnthropicBackend constructor throws', () => {
    expect(() => new AnthropicBackend()).toThrow(/paid backends disabled/);
  });
});

describe('OllamaBackend.decide', () => {
  function backendWith(fetchImpl: FetchLike) {
    return new OllamaBackend('http://ollama:11434', 'llama3.1:8b', fetchImpl);
  }

  it('maps a score_and_attest tool call (object args)', async () => {
    const f: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        message: { tool_calls: [{ function: { name: 'score_and_attest', arguments: { address: 'a1' } } }] },
      }),
    });
    const d = await backendWith(f).decide({ address: 'a1' });
    expect(d.action).toBe('attest');
    expect(d.address).toBe('a1');
  });

  it('maps a verify_attestation tool call (string args)', async () => {
    const f: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        message: {
          tool_calls: [{ function: { name: 'verify_attestation', arguments: '{"attestationId":3}' } }],
        },
      }),
    });
    const d = await backendWith(f).decide({ attestationId: 3 });
    expect(d.action).toBe('verify');
    expect(d.attestationId).toBe(3);
  });

  it('maps a challenge_attestation tool call', async () => {
    const f: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        message: { tool_calls: [{ function: { name: 'challenge_attestation', arguments: { attestationId: 9 } } }] },
      }),
    });
    const d = await backendWith(f).decide({ attestationId: 9 });
    expect(d.action).toBe('challenge');
    expect(d.attestationId).toBe(9);
  });

  it('falls back to deterministic policy on an unknown tool', async () => {
    const f: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ message: { tool_calls: [{ function: { name: 'mystery', arguments: {} } }] } }),
    });
    const d = await backendWith(f).decide({ address: 'a' });
    expect(d.action).toBe('noop');
  });

  it('falls back to the deterministic policy when no tool call is returned', async () => {
    const f: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ message: { content: 'no tools here' } }),
    });
    const d = await backendWith(f).decide({ address: 'a' });
    expect(d.action).toBe('attest');
  });

  it('falls back when the model returns a tool call with no name', async () => {
    const f: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ message: { tool_calls: [{ function: { arguments: {} } }] } }),
    });
    const d = await backendWith(f).decide({ attestationId: 1 });
    expect(d.action).toBe('verify');
  });

  it('falls back when fetch throws (network error)', async () => {
    const f: FetchLike = async () => {
      throw new Error('ECONNREFUSED');
    };
    const d = await backendWith(f).decide({ address: 'a' });
    expect(d.action).toBe('attest');
  });

  it('falls back on a non-ok HTTP response', async () => {
    const f: FetchLike = async () => ({ ok: false, status: 500, text: async () => 'err', json: async () => ({}) });
    const d = await backendWith(f).decide({ attestationId: 2 });
    expect(d.action).toBe('verify');
  });

  it('handles missing arguments by omitting them', async () => {
    const f: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ message: { tool_calls: [{ function: { name: 'score_and_attest' } }] } }),
    });
    const d = await backendWith(f).decide({});
    expect(d.action).toBe('attest');
    expect(d.address).toBeUndefined();
  });
});

describe('AgentRuntime.runOnce', () => {
  it('attests for an address (full attest + verify happy path)', async () => {
    const runtime = new AgentRuntime(deps());
    const attestCycle = await runtime.runOnce({ address: 'account-hash-runtime' });
    expect(attestCycle.decision.action).toBe('attest');
    const result = attestCycle.result as { id: number; uri: string };
    expect(result.id).toBeGreaterThan(0);

    const verifyCycle = await runtime.runOnce({ attestationId: result.id });
    expect(verifyCycle.decision.action).toBe('verify');
    expect((verifyCycle.result as { valid: boolean }).valid).toBe(true);
  });

  it('scores when the backend chooses score', async () => {
    const runtime = new AgentRuntime(
      deps({ backend: { kind: 'none', async decide() {
        return { action: 'score', address: 'account-hash-s', reason: 'test' };
      } } }),
    );
    const cycle = await runtime.runOnce({ address: 'account-hash-s' });
    expect(cycle.decision.action).toBe('score');
    expect((cycle.result as { tier: string }).tier).toBeTruthy();
  });

  it('challenges a verified-failed attestation', async () => {
    const runtime = new AgentRuntime(deps());
    const { result } = await runtime.runOnce({ address: 'account-hash-chal' });
    const id = (result as { id: number }).id;
    const cycle = await runtime.runOnce({ attestationId: id, lastVerifyFailed: true });
    expect(cycle.decision.action).toBe('challenge');
    expect((cycle.result as { status: string }).status).toBe('Challenged');
  });

  it('noops on an empty context', async () => {
    const runtime = new AgentRuntime(deps());
    const cycle = await runtime.runOnce({});
    expect(cycle.decision.action).toBe('noop');
    expect(cycle.result).toBeNull();
  });

  it.each([
    [{ action: 'score' as const, reason: 'r' }],
    [{ action: 'attest' as const, reason: 'r' }],
    [{ action: 'verify' as const, reason: 'r' }],
    [{ action: 'challenge' as const, reason: 'r' }],
  ])('returns null when a %s decision lacks its required argument', async (decision) => {
    const runtime = new AgentRuntime(
      deps({ backend: { kind: 'none', async decide() {
        return decision;
      } } }),
    );
    const cycle = await runtime.runOnce({});
    expect(cycle.result).toBeNull();
  });

  it('delegates claim evaluation', () => {
    const runtime = new AgentRuntime(deps());
    const r = runtime.evaluateClaim({
      policyId: 1,
      coveredTriggers: ['exploit'],
      coverage: '100',
      exploitDetected: true,
      fundsDrained: true,
    });
    expect(r.decision).toBe('payout');
  });
});

describe('AgentRuntime.runLoop', () => {
  it('runs maxCycles times with an injected sleep, then stops', async () => {
    const runtime = new AgentRuntime(deps());
    const sleep = vi.fn(async () => {});
    const results = await runtime.runLoop(() => ({}), { sleep, maxCycles: 3 });
    expect(results).toHaveLength(3);
    // Sleeps between cycles only (2 sleeps for 3 cycles).
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('stops early when stop() is called from the context generator', async () => {
    const runtime = new AgentRuntime(deps());
    const sleep = vi.fn(async () => {});
    const next = (cycle: number): RuntimeContext => {
      if (cycle === 1) runtime.stop();
      return {};
    };
    const results = await runtime.runLoop(next, { sleep, maxCycles: 10 });
    expect(results).toHaveLength(2);
  });
});

describe('createRuntime', () => {
  it('builds a runtime from an env record (deterministic offline)', () => {
    const runtime = createRuntime({ LLM_BACKEND: 'none' });
    expect(runtime.backend.kind).toBe('none');
    expect(runtime.sdk.mode).toBe('mock');
    expect(runtime.store.backendKind).toBe('memory');
  });
});
