/**
 * CasperProof MCP tool handlers, factored out of the transport so they are unit-testable
 * without a live stdio connection.
 *
 * Each tool is `{ name, description, inputSchema (zod raw shape), handler }`. The handler takes
 * the validated args plus a {@link ToolContext} (SDK + store) and returns a `CallToolResult`
 * with both human-readable `content` and machine-readable `structuredContent`.
 *
 * The tools wrap `@casperproof/casper-sdk` (mock by default — no secrets) and `@casperproof/agent`
 * (the attestor / verifier / risk scorer). Typed `CasperProofSdkError`s are mapped to MCP error
 * results (`isError: true`) carrying the stable error code, never thrown across the boundary.
 */
import type { CasperProofSdk, TriggerType } from '@casperproof/casper-sdk';
import { CasperProofSdkError, createClient } from '@casperproof/casper-sdk';
import { attest, createStore, scoreRisk, verify } from '@casperproof/agent';
import type { AgentConfig, PayloadStore } from '@casperproof/agent';
import { defaultConfig } from '@casperproof/agent';
import { z } from 'zod';

/** A minimal MCP tool result (matches the SDK `CallToolResult` we return). */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/** Shared dependencies for every tool handler. */
export interface ToolContext {
  sdk: CasperProofSdk;
  store: PayloadStore;
  config: AgentConfig;
}

/** A registered tool: name, description, zod input shape, and a handler. */
export interface ToolDefinition<Shape extends z.ZodRawShape> {
  name: string;
  description: string;
  inputSchema: Shape;
  handler: (args: z.infer<z.ZodObject<Shape>>, ctx: ToolContext) => Promise<ToolResult>;
}

/** Build a default {@link ToolContext} (mock SDK + in-memory store) when none is supplied. */
export function createToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    sdk: overrides.sdk ?? createClient(),
    store: overrides.store ?? createStore(),
    config: overrides.config ?? defaultConfig,
  };
}

/** Wrap a JSON-serializable value as a tool result with text + structured content. */
function ok(structured: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
  };
}

/** Build an MCP error result from a thrown error (maps typed SDK errors to their code). */
function fail(error: unknown): ToolResult {
  if (CasperProofSdkError.is(error)) {
    return {
      content: [{ type: 'text', text: `${error.code}: ${error.message}` }],
      structuredContent: { code: error.code, status: error.status, message: error.message, detail: error.detail },
      isError: true,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: `INTERNAL_ERROR: ${message}` }],
    structuredContent: { code: 'INTERNAL_ERROR', message },
    isError: true,
  };
}

/** Run a handler body, converting any thrown error into a structured MCP error result. */
async function guard(body: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await body();
  } catch (error) {
    return fail(error);
  }
}

const triggerEnum = z.enum(['exploit', 'oracle_failure', 'agent_error', 'governance_attack']);

/** Coerce a JSON payload (string or object) into a JSON value, defaulting to `{}`. */
function parsePayload(raw: unknown): unknown {
  if (raw === undefined) return {};
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
}

/** `get_attestation` — read an attestation by id. */
export const getAttestationTool: ToolDefinition<{ id: z.ZodNumber }> = {
  name: 'get_attestation',
  description: 'Fetch a stored CasperProof attestation by its numeric id.',
  inputSchema: { id: z.number().int().nonnegative() },
  handler: (args, ctx) =>
    guard(async () => {
      const attestation = await ctx.sdk.getAttestation(args.id);
      return ok(attestation as unknown as Record<string, unknown>);
    }),
};

/** `verify` — verify an attestation's off-chain payload against its on-chain hash (PASS/FAIL). */
export const verifyTool: ToolDefinition<{ id: z.ZodNumber }> = {
  name: 'verify',
  description:
    'Verify an attestation: refetch its off-chain payload, recompute the output hash, and compare to the on-chain hash. Returns PASS or FAIL.',
  inputSchema: { id: z.number().int().nonnegative() },
  handler: (args, ctx) =>
    guard(async () => {
      const result = await verify(ctx.sdk, ctx.store, args.id);
      return ok(result as unknown as Record<string, unknown>);
    }),
};

/** `submit_attestation` — store the payload off-chain and anchor a stake-backed attestation. */
export const submitAttestationTool: ToolDefinition<{
  modelId: z.ZodString;
  input: z.ZodUnknown;
  output: z.ZodUnknown;
  stake: z.ZodOptional<z.ZodString>;
  timestamp: z.ZodOptional<z.ZodNumber>;
}> = {
  name: 'submit_attestation',
  description:
    'Compute the commitment, store the payload in the content-addressed store, and submit a stake-backed attestation on-chain.',
  inputSchema: {
    modelId: z.string().min(1),
    input: z.unknown(),
    output: z.unknown(),
    stake: z.string().optional(),
    timestamp: z.number().int().nonnegative().optional(),
  },
  handler: (args, ctx) =>
    guard(async () => {
      const result = await attest(
        ctx.sdk,
        ctx.store,
        {
          modelId: args.modelId,
          input: parsePayload(args.input) as never,
          output: parsePayload(args.output) as never,
          ...(args.stake !== undefined ? { stake: args.stake } : {}),
          ...(args.timestamp !== undefined ? { timestamp: args.timestamp } : {}),
        },
        ctx.config,
      );
      return ok(result as unknown as Record<string, unknown>);
    }),
};

/** `get_risk_score` — deterministic 15-signal risk score for an address. */
export const getRiskScoreTool: ToolDefinition<{ address: z.ZodString }> = {
  name: 'get_risk_score',
  description: 'Compute the deterministic 15-signal risk score, tier, and decision for an address.',
  inputSchema: { address: z.string().min(1) },
  handler: (args, ctx) =>
    guard(async () => {
      const result = scoreRisk(args.address, { config: ctx.config });
      return ok(result as unknown as Record<string, unknown>);
    }),
};

/** `buy_policy` — create an insurance policy over a set of trigger types. */
export const buyPolicyTool: ToolDefinition<{
  coverage: z.ZodString;
  premium: z.ZodString;
  triggerTypes: z.ZodArray<typeof triggerEnum>;
  expiry: z.ZodNumber;
  holder: z.ZodOptional<z.ZodString>;
}> = {
  name: 'buy_policy',
  description: 'Create a parametric insurance policy covering the given trigger types.',
  inputSchema: {
    coverage: z.string().min(1),
    premium: z.string().min(1),
    triggerTypes: z.array(triggerEnum).min(1),
    expiry: z.number().int().nonnegative(),
    holder: z.string().optional(),
  },
  handler: (args, ctx) =>
    guard(async () => {
      const policy = await ctx.sdk.createPolicy({
        coverage: args.coverage,
        premium: args.premium,
        triggerTypes: args.triggerTypes as TriggerType[],
        expiry: args.expiry,
        ...(args.holder !== undefined ? { holder: args.holder } : {}),
      });
      return ok(policy as unknown as Record<string, unknown>);
    }),
};

/** `submit_claim` — file a claim against a policy, backed by an attestation. */
export const submitClaimTool: ToolDefinition<{
  policyId: z.ZodNumber;
  attestationId: z.ZodNumber;
}> = {
  name: 'submit_claim',
  description: 'File an insurance claim against a policy, backed by an attestation id.',
  inputSchema: {
    policyId: z.number().int().nonnegative(),
    attestationId: z.number().int().nonnegative(),
  },
  handler: (args, ctx) =>
    guard(async () => {
      const result = await ctx.sdk.submitClaim(args.policyId, args.attestationId);
      return ok(result as unknown as Record<string, unknown>);
    }),
};

/** `challenge` — challenge a (suspected tampered / fraudulent) attestation. */
export const challengeTool: ToolDefinition<{ id: z.ZodNumber }> = {
  name: 'challenge',
  description: 'Challenge an attestation, posting a dispute bond on-chain.',
  inputSchema: { id: z.number().int().nonnegative() },
  handler: (args, ctx) =>
    guard(async () => {
      const result = await ctx.sdk.challenge(args.id);
      return ok(result as unknown as Record<string, unknown>);
    }),
};

/**
 * Every CasperProof MCP tool, in registration order. `as ToolDefinition<z.ZodRawShape>` erases
 * the per-tool shape so they share one array; the concrete shapes are preserved on each export.
 */
export const TOOLS = [
  getAttestationTool,
  verifyTool,
  submitAttestationTool,
  getRiskScoreTool,
  buyPolicyTool,
  submitClaimTool,
  challengeTool,
] as unknown as Array<ToolDefinition<z.ZodRawShape>>;
