# @casperproof/agent

The CasperProof **zero-cost product runtime**: a deterministic risk scorer and claim oracle, a
content-addressed payload store, the attestor/verifier that anchor and prove outputs on-chain,
and a pluggable runtime loop that decides *when* to act. It runs fully offline with no secrets
and no paid API keys — `LLM_BACKEND=none` makes every cycle reproducible (the demo never depends
on LLM quality).

All hashing flows through the locked `@casperproof/commitment` scheme (§8); on-chain writes go
through `@casperproof/casper-sdk` (mock mode by default).

## Modules

| Module | Purpose |
|---|---|
| `agent.config.ts` | Typed config from env (`LLM_BACKEND`, `OLLAMA_*`, poll interval, thresholds, model ids). |
| `risk-scorer.ts` | Deterministic **15-signal** model → `{ score 0..100, tier, decision, signals }`. Pure. |
| `claim-oracle.ts` | Deterministic trigger taxonomy → `{ decision, triggerType, confidence, amount }`. Pure. |
| `store.ts` | Content-addressed S3 store (MinIO/R2/S3) with an **in-memory fallback** + dev-only `corrupt`. |
| `attestor.ts` | `commit → store.put → sdk.submitAttestation`. |
| `verifier.ts` | `getAttestation → store.get → recompute hash → PASS/FAIL`. |
| `runtime.ts` | Ollama / `none` / (disabled) openai+anthropic backends + the decision loop. |
| `cli.ts` | Headless entry (`casperproof-agent`): runs one attest+verify cycle in mock mode. |

## The 15 risk signals

`liquidity`, `volatility`, `concentration`, `counterpartyRisk`, `oracleDeviation`,
`governanceActivity`, `exploitHistory`, `age`, `txVelocity`, `failureRate`, `bridgeExposure`,
`leverageRatio`, `slashingHistory`, `upgradeRisk`, `auditCoverage` — each normalized to `0..100`,
combined by fixed weights (sum = 1) into a `0..100` score. Tiers: `LOW` < `MEDIUM` (≥34) <
`HIGH` (≥67) < `EXTREME` (≥85); decisions: `allow` / `monitor` / `restrict` / `block`. When
on-chain signals are unavailable, they are derived deterministically from the address bytes.

## Claim trigger taxonomy

`exploit`, `oracle_failure`, `agent_error`, `governance_attack`. `evaluateClaim(evidence)`
classifies the incident, computes a confidence, and decides: `payout` (≥0.7 and covered),
`review` (≥0.4, or confident-but-uncovered), or `reject`.

## Quick start

```ts
import { createRuntime, scoreRisk, evaluateClaim } from '@casperproof/agent';

// Deterministic, offline runtime (mock SDK + in-memory store).
const runtime = createRuntime({ LLM_BACKEND: 'none' });
const { result } = await runtime.runOnce({ address: 'account-hash-…' }); // attests + returns id/uri
const verified = await runtime.runOnce({ attestationId: (result as { id: number }).id }); // PASS

scoreRisk('account-hash-…');                 // → { score, tier, decision, signals }
evaluateClaim({ policyId: 1, coveredTriggers: ['exploit'], coverage: '1000000000',
  exploitDetected: true, fundsDrained: true }); // → { decision: 'payout', … }
```

CLI (headless, mock mode):

```bash
LLM_BACKEND=none node dist/cli.js [address]
```

## Configuration (env)

`LLM_BACKEND` (`ollama` default | `none` | `openai`/`anthropic` — paid backends disabled),
`OLLAMA_HOST`, `OLLAMA_MODEL` (default `llama3.1:8b`), `AGENT_POLL_INTERVAL_MS`,
`RISK_SCORER_MODEL_ID` (default `casperproof-riskscorer-v1`),
`CLAIM_ORACLE_MODEL_ID` (default `casperproof-claimoracle-v1`), `ATTESTATION_STAKE`,
`RISK_THRESHOLD_{MEDIUM,HIGH,EXTREME}`, and the `S3_*` vars consumed by `store.ts`
(in-memory backend is used when `S3_ENDPOINT` is unset).

## Scripts

```bash
pnpm --filter @casperproof/agent build       # tsc → dist
pnpm --filter @casperproof/agent test         # vitest
pnpm --filter @casperproof/agent test:coverage
pnpm --filter @casperproof/agent typecheck
```
