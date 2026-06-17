/**
 * The agent runtime — decides *when* to score, attest, verify, and challenge.
 *
 * The decision is driven by a pluggable {@link LlmBackend}:
 * - `none` — a **pure deterministic policy**: picks actions by fixed rules, no network, no
 *   model. With `LLM_BACKEND=none` the whole loop runs fully offline and reproducibly. **The
 *   demo never depends on LLM quality.**
 * - `ollama` — a tool-calling loop over the local Ollama HTTP API (`/api/chat` with `tools`),
 *   via `fetch`. No paid keys.
 * - `openai` / `anthropic` — disabled by default; constructing them throws. No paid keys, ever.
 *
 * The runtime exposes {@link AgentRuntime.runOnce} (one decision + execution cycle) and
 * {@link AgentRuntime.runLoop} (poll forever on the configured interval). The actual side
 * effects (score / attest / verify / challenge) flow through the SDK + store + attestor /
 * verifier, so a single cycle is fully testable with the deterministic backend.
 */
import type { CasperProofSdk } from '@casperproof/casper-sdk';
import { createClient } from '@casperproof/casper-sdk';
import type { AgentConfig } from './agent.config.js';
import { defaultConfig, loadConfig } from './agent.config.js';
import { attest } from './attestor.js';
import { evaluateClaim } from './claim-oracle.js';
import type { ClaimEvidence } from './claim-oracle.js';
import { scoreRisk } from './risk-scorer.js';
import { createStore } from './store.js';
import type { PayloadStore } from './store.js';
import { verify } from './verifier.js';

/** The actions the runtime can decide to take in a cycle. */
export type AgentAction = 'score' | 'attest' | 'verify' | 'challenge' | 'noop';

/** A single decision: which action, plus optional structured arguments. */
export interface AgentDecision {
  action: AgentAction;
  /** Address to score (for `score` / `attest`). */
  address?: string;
  /** Attestation id (for `verify` / `challenge`). */
  attestationId?: number;
  /** Free-form rationale, surfaced for logging / the demo. */
  reason: string;
}

/** The context handed to a backend (and to {@link AgentRuntime.runOnce}). */
export interface RuntimeContext {
  /** Address under consideration this cycle. */
  address?: string;
  /** An attestation to (re)verify this cycle. */
  attestationId?: number;
  /** Whether the last verification of `attestationId` failed (a tamper) — drives `challenge`. */
  lastVerifyFailed?: boolean;
  /** Optional claim evidence to evaluate this cycle. */
  claim?: ClaimEvidence;
}

/** The outcome of executing a decision. */
export interface CycleResult {
  decision: AgentDecision;
  /** The executed action's structured result (shape depends on the action). */
  result: unknown;
}

/** A backend that, given a context, decides the next action. */
export interface LlmBackend {
  /** Backend kind, for diagnostics. */
  readonly kind: 'none' | 'ollama' | 'openai' | 'anthropic';
  /** Decide the next action for the given context. */
  decide(ctx: RuntimeContext): Promise<AgentDecision>;
}

/**
 * Pure deterministic policy backend. Picks an action by fixed rules:
 * - a failed verification → `challenge`;
 * - an attestation id present → `verify`;
 * - an address present → `attest`;
 * - otherwise → `noop`.
 *
 * No network, no model: the reproducible default for tests, CI, and the demo.
 */
export class NoneBackend implements LlmBackend {
  readonly kind = 'none' as const;

  async decide(ctx: RuntimeContext): Promise<AgentDecision> {
    if (ctx.attestationId !== undefined && ctx.lastVerifyFailed) {
      return {
        action: 'challenge',
        attestationId: ctx.attestationId,
        reason: 'Verification failed (tampered payload); challenge the attestation.',
      };
    }
    if (ctx.attestationId !== undefined) {
      return {
        action: 'verify',
        attestationId: ctx.attestationId,
        reason: 'Attestation present; verify its payload against the on-chain hash.',
      };
    }
    if (ctx.address !== undefined) {
      return {
        action: 'attest',
        address: ctx.address,
        reason: 'Address present; score its risk and anchor the result on-chain.',
      };
    }
    return { action: 'noop', reason: 'No work to do this cycle.' };
  }
}

/** The subset of `fetch` the Ollama backend relies on. */
export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

/** The tool schema advertised to Ollama. */
const OLLAMA_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'score_and_attest',
      description: 'Score an address risk and anchor it on-chain.',
      parameters: {
        type: 'object',
        properties: { address: { type: 'string' } },
        required: ['address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verify_attestation',
      description: 'Verify an attestation payload against its on-chain hash.',
      parameters: {
        type: 'object',
        properties: { attestationId: { type: 'number' } },
        required: ['attestationId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'challenge_attestation',
      description: 'Challenge a tampered / fraudulent attestation.',
      parameters: {
        type: 'object',
        properties: { attestationId: { type: 'number' } },
        required: ['attestationId'],
      },
    },
  },
] as const;

/** Map an Ollama tool-call name + args to an {@link AgentDecision}. */
function decisionFromToolCall(name: string, args: Record<string, unknown>): AgentDecision {
  switch (name) {
    case 'score_and_attest':
      return {
        action: 'attest',
        ...(typeof args['address'] === 'string' ? { address: args['address'] } : {}),
        reason: 'Ollama chose score_and_attest.',
      };
    case 'verify_attestation':
      return {
        action: 'verify',
        ...(typeof args['attestationId'] === 'number'
          ? { attestationId: args['attestationId'] }
          : {}),
        reason: 'Ollama chose verify_attestation.',
      };
    case 'challenge_attestation':
      return {
        action: 'challenge',
        ...(typeof args['attestationId'] === 'number'
          ? { attestationId: args['attestationId'] }
          : {}),
        reason: 'Ollama chose challenge_attestation.',
      };
    default:
      return { action: 'noop', reason: `Ollama returned unknown tool ${name}.` };
  }
}

/**
 * Ollama tool-calling backend. POSTs to `${host}/api/chat` with the runtime tools and maps the
 * model's first tool call back to a decision. Falls back to the deterministic policy when the
 * model returns no tool call (so the loop never stalls).
 */
export class OllamaBackend implements LlmBackend {
  readonly kind = 'ollama' as const;
  private readonly fallback = new NoneBackend();

  constructor(
    private readonly host: string,
    private readonly model: string,
    private readonly fetchImpl: FetchLike,
  ) {}

  async decide(ctx: RuntimeContext): Promise<AgentDecision> {
    const body = JSON.stringify({
      model: this.model,
      stream: false,
      tools: OLLAMA_TOOLS,
      messages: [
        {
          role: 'system',
          content:
            'You are the CasperProof oracle agent. Decide the single best next action and call exactly one tool.',
        },
        { role: 'user', content: JSON.stringify(ctx) },
      ],
    });

    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchImpl(`${this.host}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
    } catch {
      return this.fallback.decide(ctx);
    }
    if (!response.ok) {
      return this.fallback.decide(ctx);
    }

    const data = (await response.json()) as {
      message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: unknown } }> };
    };
    const call = data.message?.tool_calls?.[0]?.function;
    if (!call?.name) {
      return this.fallback.decide(ctx);
    }
    const rawArgs = call.arguments;
    const args =
      typeof rawArgs === 'string'
        ? (JSON.parse(rawArgs) as Record<string, unknown>)
        : ((rawArgs as Record<string, unknown>) ?? {});
    return decisionFromToolCall(call.name, args);
  }
}

/** Placeholder for the OpenAI backend. Disabled — no paid keys, ever. */
export class OpenAiBackend implements LlmBackend {
  readonly kind = 'openai' as const;
  constructor() {
    throw new Error('paid backends disabled');
  }
  async decide(_ctx: RuntimeContext): Promise<AgentDecision> {
    throw new Error('paid backends disabled');
  }
}

/** Placeholder for the Anthropic backend. Disabled — no paid keys, ever. */
export class AnthropicBackend implements LlmBackend {
  readonly kind = 'anthropic' as const;
  constructor() {
    throw new Error('paid backends disabled');
  }
  async decide(_ctx: RuntimeContext): Promise<AgentDecision> {
    throw new Error('paid backends disabled');
  }
}

/** Build the configured {@link LlmBackend}. */
export function createBackend(config: AgentConfig, fetchImpl?: FetchLike): LlmBackend {
  switch (config.llmBackend) {
    case 'none':
      return new NoneBackend();
    case 'ollama': {
      const f = fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
      if (!f) throw new Error('Ollama backend requires a global `fetch` or an injected one.');
      return new OllamaBackend(config.ollamaHost, config.ollamaModel, f);
    }
    case 'openai':
      return new OpenAiBackend();
    case 'anthropic':
      return new AnthropicBackend();
  }
}

/** Dependencies for an {@link AgentRuntime}. All optional; defaults are wired for offline use. */
export interface RuntimeDeps {
  config?: AgentConfig;
  sdk?: CasperProofSdk;
  store?: PayloadStore;
  backend?: LlmBackend;
  /** Injected `fetch` (only consulted when building the Ollama backend). */
  fetchImpl?: FetchLike;
}

/** A small sleep helper, injectable so the loop is testable without real timers. */
export type Sleep = (ms: number) => Promise<void>;

const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The agent runtime: a decision backend plus the SDK / store / attestor / verifier wiring. */
export class AgentRuntime {
  readonly config: AgentConfig;
  readonly sdk: CasperProofSdk;
  readonly store: PayloadStore;
  readonly backend: LlmBackend;
  private running = false;

  constructor(deps: RuntimeDeps = {}) {
    this.config = deps.config ?? defaultConfig;
    this.sdk = deps.sdk ?? createClient();
    this.store = deps.store ?? createStore();
    this.backend = deps.backend ?? createBackend(this.config, deps.fetchImpl);
  }

  /** Decide and execute exactly one action for the given context. */
  async runOnce(ctx: RuntimeContext = {}): Promise<CycleResult> {
    const decision = await this.backend.decide(ctx);
    const result = await this.execute(decision, ctx);
    return { decision, result };
  }

  /** Execute a decided action against the SDK / store. */
  private async execute(decision: AgentDecision, ctx: RuntimeContext): Promise<unknown> {
    switch (decision.action) {
      case 'score': {
        const address = decision.address ?? ctx.address;
        if (address === undefined) return null;
        return scoreRisk(address, { config: this.config });
      }
      case 'attest': {
        const address = decision.address ?? ctx.address;
        if (address === undefined) return null;
        const score = scoreRisk(address, { config: this.config });
        return attest(
          this.sdk,
          this.store,
          {
            modelId: this.config.riskScorerModelId,
            input: { address },
            output: { score: score.score, tier: score.tier, decision: score.decision },
          },
          this.config,
        );
      }
      case 'verify': {
        const id = decision.attestationId ?? ctx.attestationId;
        if (id === undefined) return null;
        return verify(this.sdk, this.store, id);
      }
      case 'challenge': {
        const id = decision.attestationId ?? ctx.attestationId;
        if (id === undefined) return null;
        return this.sdk.challenge(id);
      }
      case 'noop':
        return null;
    }
  }

  /** Evaluate a claim deterministically (exposed for the runtime / MCP layers). */
  evaluateClaim(evidence: ClaimEvidence): ReturnType<typeof evaluateClaim> {
    return evaluateClaim(evidence);
  }

  /** Stop a running {@link runLoop}. */
  stop(): void {
    this.running = false;
  }

  /**
   * Poll forever (until {@link stop}), running one cycle per `pollIntervalMs`.
   *
   * @param next A generator of per-cycle contexts. Defaults to empty contexts (noop cycles).
   * @param options Injectable `sleep` (for tests) and an optional `maxCycles` cap.
   */
  async runLoop(
    next: (cycle: number) => RuntimeContext = () => ({}),
    options: { sleep?: Sleep; maxCycles?: number } = {},
  ): Promise<CycleResult[]> {
    const sleep = options.sleep ?? realSleep;
    const results: CycleResult[] = [];
    this.running = true;
    let cycle = 0;
    while (this.running) {
      if (options.maxCycles !== undefined && cycle >= options.maxCycles) break;
      results.push(await this.runOnce(next(cycle)));
      cycle += 1;
      if (this.running && (options.maxCycles === undefined || cycle < options.maxCycles)) {
        await sleep(this.config.pollIntervalMs);
      }
    }
    this.running = false;
    return results;
  }
}

/** Convenience: build a runtime from an environment record (defaults to `process.env`). */
export function createRuntime(
  env: Record<string, string | undefined> = process.env,
  deps: Omit<RuntimeDeps, 'config'> = {},
): AgentRuntime {
  return new AgentRuntime({ ...deps, config: loadConfig(env) });
}
