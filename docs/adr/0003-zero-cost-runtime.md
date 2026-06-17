# ADR 0003: Zero-cost, mock-first runtime

- Status: accepted
- Date: 2026

## Context

The project must be cloneable and runnable by anyone — judges, contributors, CI — without paid
API keys, funded testnet accounts, or provisioned infrastructure. At the same time, the demo and
tests must be **reproducible**: the same inputs always produce the same proofs, regardless of
network or model availability.

## Decision

Every external dependency has a **zero-secret local/mock fallback**, and the agent's decision
logic is **deterministic**:

- **SDK** picks mock vs live from `CSPR_CLOUD_TOKEN` presence; the mock backend is in-memory with
  deterministic deploy hashes.
- **Deploy** runs a deterministic mock when testnet secrets are absent (placeholder package
  hashes), so the whole stack still boots.
- **x402** uses a local verifier that accepts a signed mock `X-PAYMENT` when no facilitator URL is
  set.
- **Storage** falls back to in-memory when `S3_ENDPOINT` is unset.
- **LLM** defaults to local **Ollama**; `LLM_BACKEND=none` is a pure deterministic policy. The
  `openai`/`anthropic` backends are **disabled by default and throw** — no paid keys, ever.
- The **risk-scorer** (15 weighted signals derived deterministically from address bytes) and the
  **claim-oracle** (evidence → trigger classification) are pure: no randomness, no clocks, no
  network.

**The demo never depends on LLM quality.** It runs end-to-end with `LLM_BACKEND=none` and the
mock SDK.

## Consequences

- `cp .env.example .env && make up` works offline with no secrets; CI and the test suite run the
  same way.
- Reproducible proofs make the golden-vector parity test and the e2e demo flow stable.
- Going live is purely additive: supply tokens/keys (see
  [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md)) and the same code switches to live mode.
- Determinism caps what the "AI" can claim — the value is the verifiable trust layer, not model
  cleverness, which is exactly the product thesis.
