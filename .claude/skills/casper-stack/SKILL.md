---
name: casper-stack
description: How CasperProof uses the Casper stack — CSPR.cloud REST + streaming, CSPR.click wallet, the x402 facilitator flow, the MCP server pattern, testnet faucet/keys, and the local mock-mode fallbacks when secrets/network are absent.
---

# Casper stack usage

Pull current docs before each integration (docs MCP `resolve-library-id` → `query-docs`, or
the URLs in §6). APIs move faster than training data — verify syntax. When the docs MCP or a
network endpoint is unreachable, implement against the documented shapes and fall back to
**mock mode** (below); never block.

## Mock-mode principle (zero-secret local dev)

Every external dependency has a local/mock fallback so `make up` and the test suite run with
no secrets:

| Dependency | Local / mock | Real |
|---|---|---|
| Casper node + deploy | mock deploy returns deterministic hashes; `SETUP_NEEDED.md` lists keys | CSPR.cloud node + PEM key |
| CSPR.cloud REST/stream | in-memory fixture store + a local SSE emitter | `CSPR_CLOUD_TOKEN` |
| CSPR.click wallet | mock connector (fixed test account) | real app id |
| x402 facilitator | local verifier that accepts a signed mock `X-PAYMENT` | facilitator URL |
| S3 | MinIO (in compose) | Cloudflare R2 / AWS S3 |
| LLM | Ollama (local) | — (no paid keys, ever) |

The SDK selects mock vs live from env (`CSPR_CLOUD_TOKEN` present ⇒ live).

## CSPR.cloud REST (queries)

Base `https://api.testnet.cspr.cloud`. Auth header `Authorization: <CSPR_CLOUD_TOKEN>`.
Used for: contract dictionary/state reads, account balances, deploy status, event history.
Wrap all calls in `packages/sdk` with retries + typed responses; map failures to RFC 7807.

## CSPR.cloud Streaming (live events)

WS `wss://streaming.testnet.cspr.cloud`. Subscribe to **contract-level events** for the
registry/insurance package hashes; forward to the dApp as SSE/WS. Events drive the live
dashboard (AttestationSubmitted, Challenged, Resolved, ClaimPaid).

## CSPR.click (wallet / auth)

One integration for all Casper wallets. `NEXT_PUBLIC_CSPR_CLICK_APP_ID`. The dApp uses it to
connect and to **sign deploys** for `submit_attestation`, `challenge`, `buy_policy`, `claim`.
Provide a mock connector for tests/e2e (deterministic account, no extension needed).

## x402 facilitator (agent micropayments)

Pay-per-request over HTTP (Casper is the first WASM-native L1 with HTTP micropayments live).
Flow: client `GET /attestation/:id` → server `402 Payment Required` (RFC 7807 body, price +
pay-to) → client pays + retries with `X-PAYMENT` → server verifies with the facilitator →
serves the resource. Implement the verify step behind an interface with a local mock verifier.

## MCP server (agent ↔ chain)

Expose tools `get_attestation`, `verify`, `submit_attestation`, `get_risk_score`,
`buy_policy`, `submit_claim`, `challenge`, backed by `packages/sdk`. stdio transport by
default (`MCP_TRANSPORT=stdio`); also runnable over HTTP for the dApp. Each tool input/output
is JSON-schema typed.

## Testnet faucet & keys

Faucet: `https://testnet.cspr.live/tools/faucet`. Deploy needs a PEM secret key
(`CASPER_SECRET_KEY_PATH`) + `CSPR_CLOUD_TOKEN`. If absent, `scripts/deploy-testnet.ts` runs
in mock mode and records the exact missing secrets in `SETUP_NEEDED.md`. Explorer:
`https://testnet.cspr.live`.
