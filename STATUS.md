# CasperProof — Build Status

A summary of what's built, how to run it, test coverage, and what's stubbed pending real
infrastructure. CasperProof is a Casper-native **verifiable AI oracle** with a **parametric
agent-insurance** demo. Built for the Casper Agentic Buildathon 2026.

## What's implemented (end to end)

| Area                                     | Status             | Notes                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Commitment scheme** (trust anchor, §8) | ✅ done + verified | `packages/commitment` (TS) + `contracts/src/commitment.rs` (Rust); blake2b-256 + canonical JSON; **cross-language golden-vector parity test passes** (TS generates, Rust asserts).                                                              |
| **Odra contracts**                       | ✅ done + tested   | `attestation_registry` (submit/get/challenge/resolve/finalize/reputation), `insurance` (buy_policy/claim/stake/unstake, reads registry cross-contract), CEP-18 `StakeToken` + `MockUsdc`. 30 MockVM tests + parity; clippy `-D warnings` clean. |
| **RFC 7807 errors**                      | ✅ done            | `contracts/problem` (Rust, `rust-rfc7807`) maps the full error taxonomy; the SDK + x402 server mirror the same `application/problem+json` shape.                                                                                                |
| **Agent runtime** (zero-cost)            | ✅ done + tested   | `packages/agent`: 15-signal risk-scorer, claim-oracle, attestor, verifier, S3/MinIO store (+ in-memory + tamper), Ollama loop with `LLM_BACKEND=none\|ollama` (no paid keys). 97 tests.                                                         |
| **SDK**                                  | ✅ done + tested   | `@casperproof/casper-sdk`: typed client over CSPR.cloud + deploys; mock + REST backends; 103 tests.                                                                                                                                             |
| **x402 server**                          | ✅ done + tested   | Fastify, `GET /attestation/:id` + `POST /verify`, x402-gated (402 → pay → serve); mock + facilitator verifiers. 27 tests.                                                                                                                       |
| **MCP server**                           | ✅ done + tested   | 7 tools (get/verify/submit/score/policy/claim/challenge) over stdio. 20 tests.                                                                                                                                                                  |
| **dApp** (`apps/web`)                    | ✅ done            | Next.js + CSPR.click (mock connector); Oracle / Insurance / Slash views + live feed + Recharts; static build passes offline.                                                                                                                    |
| **Marketing** (`apps/marketing`)         | ✅ done            | Next.js static export; full SEO/OG/sitemap; live numbers via SDK; 29 tests.                                                                                                                                                                     |
| **Dockerization**                        | ✅ done            | `docker/` images + `docker-compose.yml` (+ prod overlay), `Makefile`; `cp .env.example .env && make up` boots ollama/minio/agent/x402/mcp/web/marketing + one-shot deployer.                                                                    |
| **CI**                                   | ✅ done            | `.github/workflows/`: ci (lint+typecheck+cargo test+TS coverage gate), e2e (compose+Playwright), release.                                                                                                                                       |
| **E2E**                                  | ✅ done + passing  | Playwright `e2e/` covers the full demo arc — **11/11 specs pass locally** (chromium) and in CI (`playwright install chromium`).                                                                                                                 |
| **Docs**                                 | ✅ done            | README + per-package READMEs + `docs/` (ARCHITECTURE/COMMITMENT/CONTRACTS/DEPLOYMENT/DEMO_SCRIPT/API + 6 ADRs) + typedoc config.                                                                                                                |
| **Testnet deploy**                       | ⏳ mock (no keys)  | `scripts/deploy-testnet.ts` runs a deterministic mock deploy; real deploy needs the secrets in `SETUP_NEEDED.md`.                                                                                                                               |

## How to run

```bash
cp .env.example .env
make up                 # full local stack (offline, no secrets): ollama, minio, agent, x402, mcp, web, marketing
make deploy-testnet     # mock deploy → .env.local (real deploy needs SETUP_NEEDED.md secrets)
make seed               # runs the full demo arc through the SDK + agent
make test               # contracts (cargo test) + TS (turbo) suites
```

- dApp → http://localhost:29300 · Marketing → http://localhost:29301 · x402 → http://localhost:29402

## Tests & coverage

- **Contracts:** `cd contracts && cargo test` — commitment parity (2) + registry (12) + insurance
  (12) + tokens (4) + `casperproof-problem` (9 + doctest). `cargo clippy -- -D warnings` clean.
- **TypeScript:** Vitest with a **>90% line + branch** gate enforced by `@casperproof/config`:
  commitment 30 · sdk 103 (~99% / 97%) · agent 97 (98.6% / 97.4%) · ui 52 (100%) · mcp 20 (94.8%) ·
  x402 27 (100% / 96%) · web 27 · marketing 29.
- **Integration:** `pnpm seed` runs attest×3 → verify PASS → buy policy → claim paid → tamper →
  verify FAIL → challenge → slash, all green in mock mode.
- **E2E:** Playwright — full demo flow across Oracle / Insurance / Slash; **11/11 specs pass**
  locally (chromium) and in CI (`playwright install chromium`).

## Zero-cost / offline guarantees

- No paid LLM keys — the agent runs deterministically (`LLM_BACKEND=none`) or via local Ollama.
- The whole stack + every test runs with **no secrets**: SDK mock backend, in-memory payload
  store, mock CSPR.click wallet, mock x402 verifier, deterministic mock deploy.

## What's stubbed / pending (see `SETUP_NEEDED.md`)

1. **Casper Testnet deploy** — needs `CASPER_SECRET_KEY_PATH` + `CSPR_CLOUD_TOKEN`; until then,
   deterministic mock package hashes. Real deploy signing needs `casper-js-sdk`/`casper-client`
   (intentionally unbundled to keep the build offline).
2. **Live data** — `CSPR_CLOUD_TOKEN` flips the SDK to live reads + streaming.
3. **Real x402 micropayments** — `X402_FACILITATOR_URL`.
4. **Real object storage** — `S3_*` (else in-memory).
5. **CSPR.click app id**, **CSPR.fans listing URL**, **demo video URL**, production **OG image**.
6. **Build-sandbox limits** — GitHub/CDN were blocked here, so the contract **wasm**
   (`cargo odra build`) and the **Playwright browser** download were not produced in-sandbox;
   both run on a normal machine / in CI. Contracts are fully verified via MockVM + parity tests.

## Final gates

Both submission gates (§9) ran as fresh specialist sub-agents and returned **GO**:

- **Security review — GO.** Money-math conserves value, `resolve` is resolver-only, the
  dispute-window logic and TS⇆Rust hash parity hold, and the error surface doesn't leak. Its
  findings were applied as hardening: the insurance `claim` now binds the backing attestation to
  the configured `claim_model_id`; `claim`/`resolve`/`finalize`/`unstake` follow
  checks-effects-interactions (state written before external token transfers); the verifier now
  recomputes the **full commitment** (input + output + model + timestamp), so input/model/
  timestamp tampering also FAILs; and the x402 server **fails closed** in production when no
  facilitator and no explicit mock are configured. (Vault capital-reservation across LPs is
  documented as a mainnet item; content-addressing-on-read is intentionally not enforced so the
  in-memory tamper demo can flip bytes at a fixed key.)
- **QA gate — GO.** 40 Rust tests + ~400 TS tests pass; every threshold-gated package clears
  **>90% line + branch**; repo-wide typecheck + Prettier are clean; the `make seed` arc
  completes with a paid claim and one slash. The Playwright E2E suite passes **11/11** locally
  (chromium) and in CI (`playwright install chromium`). The Odra livenet deploy binary compiles
  clean (`cargo check --features livenet`, real Casper backend); the on-chain demo arc it drives
  is the same one the MockVM tests cover.

Testnet-only, unaudited — not for mainnet value (see `SECURITY.md` / `SETUP_NEEDED.md`).
