import { createClient } from '@casperproof/casper-sdk';
import { createStore, defaultConfig } from '@casperproof/agent';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buyPolicyTool,
  challengeTool,
  createToolContext,
  getAttestationTool,
  getRiskScoreTool,
  submitAttestationTool,
  submitClaimTool,
  TOOLS,
  verifyTool,
} from './tools.js';
import type { ToolContext } from './tools.js';

function newCtx(): ToolContext {
  return {
    sdk: createClient({ mode: 'mock' }),
    store: createStore({ region: 'us-east-1', bucket: 'casperproof-payloads', forcePathStyle: true }),
    config: defaultConfig,
  };
}

/** Parse the structuredContent from a tool result. */
function structured(result: { structuredContent?: Record<string, unknown> }): Record<string, unknown> {
  return result.structuredContent ?? {};
}

describe('TOOLS registry', () => {
  it('registers all seven CasperProof tools by name', () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      'get_attestation',
      'verify',
      'submit_attestation',
      'get_risk_score',
      'buy_policy',
      'submit_claim',
      'challenge',
    ]);
  });

  it('every tool has a description and an input schema', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeTruthy();
    }
  });
});

describe('createToolContext', () => {
  it('defaults to a mock SDK and in-memory store', () => {
    const ctx = createToolContext();
    expect(ctx.sdk.mode).toBe('mock');
    expect(ctx.store.backendKind).toBe('memory');
    expect(ctx.config).toBe(defaultConfig);
  });

  it('honors overrides', () => {
    const sdk = createClient({ mode: 'mock' });
    const ctx = createToolContext({ sdk });
    expect(ctx.sdk).toBe(sdk);
  });
});

describe('get_risk_score', () => {
  it('returns a deterministic score, tier, decision, and 15 signals', async () => {
    const ctx = newCtx();
    const result = await getRiskScoreTool.handler({ address: 'account-hash-risk' }, ctx);
    const body = structured(result);
    expect(result.isError).toBeUndefined();
    expect(body.address).toBe('account-hash-risk');
    expect(body.score).toBeGreaterThanOrEqual(0);
    expect(['LOW', 'MEDIUM', 'HIGH', 'EXTREME']).toContain(body.tier);
    expect(Object.keys(body.signals as object)).toHaveLength(15);
    expect(result.content[0]?.type).toBe('text');
  });
});

describe('submit_attestation + get_attestation + verify', () => {
  let ctx: ToolContext;
  beforeEach(() => {
    ctx = newCtx();
  });

  it('submits, fetches, and verifies (PASS) a fresh attestation', async () => {
    const submit = await submitAttestationTool.handler(
      {
        modelId: 'casperproof-riskscorer-v1',
        input: { address: 'account-hash-x' },
        output: { score: 73, tier: 'HIGH' },
      },
      ctx,
    );
    const submitted = structured(submit);
    const id = submitted.id as number;
    expect(id).toBeGreaterThan(0);
    expect(submitted.uri).toMatch(/^s3:\/\//);

    const fetched = await getAttestationTool.handler({ id }, ctx);
    expect(structured(fetched).id).toBe(id);

    const verified = await verifyTool.handler({ id }, ctx);
    expect(structured(verified).valid).toBe(true);
  });

  it('accepts stringified JSON payloads for input/output', async () => {
    const submit = await submitAttestationTool.handler(
      {
        modelId: 'm',
        input: '{"a":1}',
        output: '{"b":2}',
        stake: '2000000000',
        timestamp: 1_700_000_000,
      },
      ctx,
    );
    expect(structured(submit).id).toBeGreaterThan(0);
  });

  it('verify reports FAIL after the payload is tampered', async () => {
    const submit = await submitAttestationTool.handler(
      { modelId: 'm', input: { a: 1 }, output: { score: 5 } },
      ctx,
    );
    const submitted = structured(submit);
    await ctx.store.corrupt(submitted.uri as string, { output: { score: 999 } });
    const verified = await verifyTool.handler({ id: submitted.id as number }, ctx);
    expect(structured(verified).valid).toBe(false);
  });

  it('maps a missing attestation to a structured ATTESTATION_NOT_FOUND error', async () => {
    const result = await getAttestationTool.handler({ id: 9999 }, ctx);
    expect(result.isError).toBe(true);
    expect(structured(result).code).toBe('ATTESTATION_NOT_FOUND');
    expect(result.content[0]?.text).toContain('ATTESTATION_NOT_FOUND');
  });

  it('maps a below-minimum stake to a structured INSUFFICIENT_STAKE error', async () => {
    const result = await submitAttestationTool.handler(
      { modelId: 'm', input: { a: 1 }, output: { b: 2 }, stake: '1' },
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(structured(result).code).toBe('INSUFFICIENT_STAKE');
  });

  it('maps a non-SDK error (bad JSON payload) to INTERNAL_ERROR', async () => {
    const result = await submitAttestationTool.handler(
      { modelId: 'm', input: 'not json', output: { b: 2 } },
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(structured(result).code).toBe('INTERNAL_ERROR');
  });
});

describe('buy_policy + submit_claim', () => {
  it('creates a policy and pays out a covered claim end-to-end', async () => {
    const ctx = newCtx();
    const policyResult = await buyPolicyTool.handler(
      {
        coverage: '1000000000',
        premium: '50000000',
        triggerTypes: ['exploit'],
        expiry: Math.floor(Date.now() / 1000) + 86_400,
      },
      ctx,
    );
    const policy = structured(policyResult);
    expect(policy.status).toBe('Active');
    const policyId = policy.id as number;

    // The mock claim derives its trigger from a `#trigger=` tag in the attestation URI.
    const submit = await ctx.sdk.submitAttestation({
      modelId: 'casperproof-claimoracle-v1',
      input: { incident: 'drain' },
      output: { decision: 'payout', triggerType: 'exploit' },
      uri: 's3://casperproof-payloads/abc#trigger=exploit',
      stake: '2000000000',
    });

    const claim = await submitClaimTool.handler(
      { policyId, attestationId: submit.id },
      ctx,
    );
    const body = structured(claim);
    expect(body.paid).toBe(true);
    expect(body.amount).toBe('1000000000');
  });

  it('maps an uncovered trigger claim to TRIGGER_NOT_COVERED', async () => {
    const ctx = newCtx();
    const policyResult = await buyPolicyTool.handler(
      {
        coverage: '1000000000',
        premium: '50000000',
        triggerTypes: ['oracle_failure'],
        expiry: Math.floor(Date.now() / 1000) + 86_400,
      },
      ctx,
    );
    const policyId = structured(policyResult).id as number;
    const submit = await ctx.sdk.submitAttestation({
      modelId: 'm',
      input: {},
      output: {},
      uri: 's3://casperproof-payloads/abc#trigger=exploit',
      stake: '2000000000',
    });
    const claim = await submitClaimTool.handler({ policyId, attestationId: submit.id }, ctx);
    expect(claim.isError).toBe(true);
    expect(structured(claim).code).toBe('TRIGGER_NOT_COVERED');
  });

  it('honors an explicit holder address', async () => {
    const ctx = newCtx();
    const holder = 'account-hash-2222222222222222222222222222222222222222222222222222222222222222';
    const result = await buyPolicyTool.handler(
      {
        coverage: '1',
        premium: '1',
        triggerTypes: ['agent_error'],
        expiry: Math.floor(Date.now() / 1000) + 100,
        holder,
      },
      ctx,
    );
    expect(structured(result).holder).toBe(holder);
  });
});

describe('challenge', () => {
  it('challenges an active attestation', async () => {
    const ctx = newCtx();
    const submit = await submitAttestationTool.handler(
      { modelId: 'm', input: { a: 1 }, output: { b: 2 } },
      ctx,
    );
    const id = structured(submit).id as number;
    const result = await challengeTool.handler({ id }, ctx);
    expect(structured(result).status).toBe('Challenged');
  });

  it('maps a double-challenge to ALREADY_CHALLENGED', async () => {
    const ctx = newCtx();
    const submit = await submitAttestationTool.handler(
      { modelId: 'm', input: { a: 1 }, output: { b: 2 } },
      ctx,
    );
    const id = structured(submit).id as number;
    await challengeTool.handler({ id }, ctx);
    const second = await challengeTool.handler({ id }, ctx);
    expect(second.isError).toBe(true);
    expect(structured(second).code).toBe('ALREADY_CHALLENGED');
  });
});
