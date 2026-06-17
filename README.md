<div align="center">

# CasperProof

**The verifiable AI oracle and trust layer for the agent economy on Casper.**

_Proof your agents can't fake._

[![CI](https://github.com/mihailShumilov/casperproof/actions/workflows/ci.yml/badge.svg)](https://github.com/mihailShumilov/casperproof/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-%3E90%25-brightgreen)](#testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Casper Testnet](https://img.shields.io/badge/Casper-Testnet-red)](https://testnet.cspr.live)

</div>

> Built for the **Casper Agentic Buildathon 2026**. CasperProof lets an AI agent publish a
> tamper-evident, **stake-backed** proof (an _attestation_) of its output. Anyone can pay a
> tiny x402 micropayment to fetch and **independently verify** it; bad attestations are
> **challenged and slashed**. A parametric **agent-insurance** vault pays out against verified
> attestations — the flagship demo of the oracle.

---

## Why

Autonomous agents produce outputs nobody can verify, and the capital they manage is
uninsured. CasperProof is a reusable **trust primitive**: a commitment scheme + an on-chain
registry with economic security (stake, challenge, slash, reputation), exposed to agents via
**MCP** and monetized via **x402**.

## How it works (3 steps)

1. **Attest** — an agent canonicalizes its `input`/`output`, computes a `blake2b-256`
   commitment (§8), uploads the payload to an S3-compatible store, and calls
   `submit_attestation` — locking stake on-chain.
2. **Pay & verify** — a buyer pays per request (x402) to `GET /attestation/:id` and
   `POST /verify`. The verifier refetches the payload, recomputes the hash, and returns
   **PASS/FAIL** with both the on-chain and recomputed hashes.
3. **Challenge & slash** — a tampered payload fails verification; anyone can `challenge`
   within the dispute window, and `resolve(fraudulent)` **slashes** the attestor's stake to
   the challenger and treasury.

## Architecture

```
Agent runtime (zero-cost, Ollama)   x402 + MCP        Casper Testnet (Odra)
  risk-scorer · claim-oracle    →   pay-per-verify  →  AttestationRegistry (oracle)
  attestor · verifier               agent ↔ chain      Insurance (policy/vault/claim)
        │                                              CEP-18: STAKE + mock USDC
        └── payload → S3 (blake2b key) ──────────────────────────┘
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and the commitment spec in
[`docs/COMMITMENT.md`](./docs/COMMITMENT.md).

## Quickstart

```bash
git clone https://github.com/mihailShumilov/casperproof && cd casperproof
cp .env.example .env
make up          # boots ollama, minio, agent, x402, mcp, web, marketing
```

- dApp → http://localhost:3000 · Marketing → http://localhost:3001
- x402 server → http://localhost:8402 · MinIO console → http://localhost:9001

Deploy contracts to Casper Testnet and seed the demo:

```bash
make deploy-testnet   # builds wasm + deploys (needs testnet keys; see SETUP_NEEDED.md)
make seed             # seeds demo attestations + policies
```

## Monorepo layout

| Path                              | What                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/commitment`             | **Trust anchor** — blake2b-256 commitment + canonical JSON + golden vectors (§8).        |
| `packages/agent`                  | Zero-cost runtime: risk-scorer, claim-oracle, attestor, verifier, S3 store, Ollama loop. |
| `packages/sdk`                    | `@casperproof/casper-sdk` — typed client over CSPR.cloud + deploys.                      |
| `packages/ui` / `packages/config` | Shared React components / shared tooling presets.                                        |
| `apps/web`                        | dApp dashboard (Next.js + CSPR.click).                                                   |
| `apps/marketing`                  | Marketing site (static export → casperproof.com).                                        |
| `apps/x402-server`                | x402-gated resource server (Fastify).                                                    |
| `apps/mcp-server`                 | Casper MCP server.                                                                       |
| `contracts/`                      | Odra contracts: `attestation_registry`, `insurance`, CEP-18 + RFC 7807 `problem` crate.  |

## Testing

- TS: `pnpm test` (Vitest, **>90% line + branch** gate).
- Contracts: `cd contracts && cargo odra test` (all entry points + edge cases) and the
  cross-language commitment **parity** test (`cargo test --lib`).
- E2E: `pnpm --filter @casperproof/e2e test` (Playwright, full demo flow).

## Documentation

[`docs/`](./docs) — ARCHITECTURE, COMMITMENT, CONTRACTS, DEPLOYMENT, DEMO_SCRIPT, ADRs.
Per-package READMEs live alongside each package.

## License

MIT — see [`LICENSE`](./LICENSE). Originality statement in [`NOTICE.md`](./NOTICE.md).
