# CasperProof — DoraHacks BUIDL

**The verifiable AI oracle and trust layer for the agent economy on Casper.**
_Proof your agents can't fake._

Built for the **Casper Agentic Buildathon 2026** (Qualification Round, June 1–30, 2026).

> **Status:** Testnet-only, **unaudited** — not for mainnet value. See [`../../SECURITY.md`](../../SECURITY.md).
> Contracts are **not yet deployed to testnet**; on-chain addresses/links in this submission are
> marked `TODO(deploy)` and tracked in [`CHECKLIST.md`](./CHECKLIST.md) → [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1.

---

## Problem

Autonomous agents produce outputs nobody can independently verify, and the capital those agents
manage is uninsured. When an agent says "this address scored 73/HIGH risk" or "this trigger
fired," a downstream consumer has no tamper-evident, economically-backed way to check that the
claim is real — or to be made whole when it isn't.

## Solution

CasperProof is a reusable **trust primitive**: a byte-exact commitment scheme plus an on-chain
registry with economic security (stake → challenge → slash → reputation), exposed to agents over
**MCP** and monetized via **x402** micropayments. An AI agent publishes a stake-backed,
tamper-evident proof (an _attestation_) of its output; anyone can pay a tiny x402 fee to fetch and
**independently verify** it; bad attestations are **challenged and slashed**. A parametric
**agent-insurance** vault pays out against verified attestations — the flagship demo that proves
the oracle in DeFi.

The oracle is the core product; insurance is the demonstration, not a parallel trust system
(see ADR [`0001`](../adr/0001-oracle-first-pivot.md)).

## How it works

### 1 · Attest
An agent canonicalizes its `input`/`output`, computes a `blake2b-256` commitment (the §8 scheme),
uploads the full payload to a content-addressed (S3-compatible) store keyed by the payload's own
hash, and calls `submit_attestation` — locking CEP-18 **STAKE** on-chain. The contract stores
**hashes + metadata + stake only**; the payload stays off-chain by URI.

### 2 · Pay & verify
A buyer pays per request (x402) to `GET /attestation/:id` and `POST /verify`. The flow is a real
`402 Payment Required` (RFC 7807 body) → pay → retry with `X-PAYMENT`. The verifier refetches the
payload, **recomputes the full commitment** (input + output + model + timestamp), and returns
**PASS/FAIL** with both the on-chain hash and the recomputed hash side by side.

### 3 · Challenge & slash
A tampered payload fails verification. Anyone can `challenge` within the dispute window (posting a
bond); the resolver `resolve(fraudulent)` **slashes** the attestor's stake — split **to the
challenger and the treasury** — and records `slashed +1` against the attestor's reputation.

The contract **never recomputes hashes on-chain**: it compares the bytes the off-chain components
produced. TS (`packages/commitment`) and Rust (`contracts/src/commitment.rs`) are held byte-for-byte
identical by a cross-language **golden-vector parity test** that runs in CI.

## Architecture

```
Agent runtime (zero-cost, Ollama)   x402 + MCP        Casper Testnet (Odra)
  risk-scorer · claim-oracle    →   pay-per-verify  →  AttestationRegistry (oracle)
  attestor · verifier               agent ↔ chain      Insurance (policy/vault/claim)
        │                                              CEP-18: STAKE + mock USDC
        └── payload → S3 (blake2b key) ──────────────────────────┘
```

Two layers over one trust anchor:

- **Oracle layer** — `AttestationRegistry`: commit → stake → verify → challenge → slash →
  reputation. Economic security via a CEP-18 **STAKE** token locked behind each attestation.
- **Insurance layer** — `Insurance`: a parametric vault in mock **USDC**. `claim()` reads the
  registry **cross-contract** and pays out only when the backing attestation is `Active`/`Finalized`
  (never slashed/challenged), the trigger is covered, the policy is live, and a solvency guard holds.

Full diagrams and the four sequence flows: [`../ARCHITECTURE.md`](../ARCHITECTURE.md). Commitment
spec: [`../COMMITMENT.md`](../COMMITMENT.md). Contract signatures/events/errors:
[`../CONTRACTS.md`](../CONTRACTS.md).

## What's live vs mock

Everything below boots and is exercised by tests with **zero secrets and no network**
(`cp .env.example .env && make up`). "Mock" means a zero-secret local fallback that flips to live
when the corresponding credential/URL is supplied (see [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md)).

| Capability | State | Evidence (traces to repo) |
| --- | --- | --- |
| **Commitment scheme** (blake2b-256 + canonical JSON, §8) | ✅ **Live & verified** | `packages/commitment` (TS) + `contracts/src/commitment.rs` (Rust); cross-language golden-vector parity test passes; 30 TS tests + 2 parity tests |
| **Odra contracts logic** (registry, insurance, CEP-18) | ✅ **Live in MockVM** | `contracts/src`; 40 Rust tests (registry 12, insurance 12, tokens 4, parity 2, RFC 7807 `problem` 9 + doctest); clippy `-D warnings` clean |
| **Agent runtime** (15-signal risk-scorer, claim-oracle, attestor, verifier, store) | ✅ **Live** | `packages/agent`; 97 tests; `LLM_BACKEND=none` (deterministic) or local Ollama — no paid keys |
| **SDK** (`@casperproof/casper-sdk`) | ✅ **Live (mock + REST backends)** | `packages/sdk`; 103 tests |
| **x402 resource server** (`GET /attestation/:id`, `POST /verify`) | ✅ **Live code; mock verifier** | `apps/x402-server`; 27 tests; real facilitator via `X402_FACILITATOR_URL` |
| **MCP server** (7 tools over stdio) | ✅ **Live** | `apps/mcp-server`; 20 tests |
| **dApp** (Oracle / Insurance / Slash + live feed) | ✅ **Live; mock CSPR.click connector** | `apps/web`; 27 tests; real wallet via `NEXT_PUBLIC_CSPR_CLICK_APP_ID` |
| **Marketing site** | ✅ **Live (static export)** | `apps/marketing`; 29 tests |
| **Contract WASM build** (`cargo odra build`) | ⚙️ **Runs in CI / dev machine** | Not produced in the build sandbox (CDN/GitHub blocked); logic fully verified via MockVM ([`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §6) |
| **Testnet deploy + on-chain txs** | 🔴 **Mock (no keys)** | `scripts/deploy-testnet.ts` emits **deterministic mock package hashes**; real deploy needs `CASPER_SECRET_KEY_PATH` + `CSPR_CLOUD_TOKEN` ([`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1) |
| **CSPR.cloud reads/streaming** | 🔴 **Mock by default** | In-memory fixtures + local event emitter; live with `CSPR_CLOUD_TOKEN` |
| **x402 micropayments** | 🔴 **Mock by default** | Local verifier accepts a signed `X-PAYMENT`; live with `X402_FACILITATOR_URL` |
| **Object storage** | 🔴 **In-memory / MinIO** | Live with `S3_*` (Cloudflare R2 / AWS S3) |
| **E2E (Playwright)** | ⚙️ **Specs written; run in CI** | `e2e/`; browser binaries install in CI (`playwright install chromium`) |

Aggregate: **~400 TypeScript tests** across packages and **40 Rust tests**, every threshold-gated
package clearing **>90% line + branch**; both submission gates (security review + QA) returned
**GO** (see [`../../STATUS.md`](../../STATUS.md)).

## Casper stack used

- **Odra (2.8.1)** — the `attestation_registry`, `insurance`, and CEP-18 token contracts, with
  events, package-hash export, and exhaustive MockVM tests.
- **CEP-18** — `StakeToken` (STAKE, 9 decimals) for stake/bonds; `MockUsdc` (USDC, 6 decimals) for
  premiums/coverage/payouts, moved via `transfer` / `transfer_from` and read cross-contract.
- **CSPR.cloud** — REST + streaming reads through the SDK (live with `CSPR_CLOUD_TOKEN`, mock
  fixtures + local emitter otherwise).
- **CSPR.click** — wallet connect in the dApp (mock connector by default; real app id via
  `NEXT_PUBLIC_CSPR_CLICK_APP_ID`).
- **x402** — a gated resource server integrated with the Casper facilitator flow (`402` → pay →
  serve), with a local mock verifier for offline runs.
- **MCP** — a Casper MCP server exposing 7 oracle/insurance tools
  (get / verify / submit / score / policy / claim / challenge) over stdio.

## What we'd ship next (roadmap)

1. **Real testnet deploy** — wire deploy signing (`casper-js-sdk` / `casper-client`), publish the
   four package hashes, and run the three demo transactions on-chain
   ([`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1).
2. **Live x402 facilitator + CSPR.click wallet** on testnet (replace the mock verifier/connector).
3. **More model adapters and trigger types** — beyond the risk-scorer and claim-oracle, and beyond
   the `exploit` / `oracle_failure` / `agent_error` / `governance_attack` taxonomy.
4. **Richer reputation & insurance economics** — per-LP capital reservation across the vault
   (documented as a mainnet item in [`../../STATUS.md`](../../STATUS.md)), tiered reputation, and
   dynamic premiums.
5. **More registry consumers** — lending, escrow, and agent marketplaces reading the same registry
   the same way the insurance vault does.
6. **Security audit** before any mainnet value.

## Team

- **Mihail Shumilov** — solo builder. GitHub: [@mihailShumilov](https://github.com/mihailShumilov).

Originality: greenfield, fresh git history; all contracts/agents/SDKs/interfaces newly authored for
Casper. Domain concepts informed by the author's prior independent agent-risk work, reimplemented
from understanding on Casper-native primitives — see [`../../NOTICE.md`](../../NOTICE.md) and ADR
[`0001`](../adr/0001-oracle-first-pivot.md).

## Repo & links

- **Repository:** https://github.com/mihailShumilov/casperproof
- **Demo video:** `TODO(video): hosted demo video URL` — see [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md)
- **CSPR.fans listing:** `TODO(cspr.fans): listing URL` — see [`VOTING_PACK.md`](./VOTING_PACK.md)
- **On-chain demo txs (cspr.live):** `TODO(deploy): real cspr.live link` (×3 — `submit_attestation`,
  `claim`, slash `resolve`) — tracked in [`CHECKLIST.md`](./CHECKLIST.md)

## License

MIT — see [`../../LICENSE`](../../LICENSE).

---

### Provenance note on the buildathon rules

The DoraHacks BUIDL detail page is a client-rendered SPA and could not be machine-fetched here
(HTTP 405). The rules referenced above — **Qualification Round June 1–30, 2026**; tracks spanning
**Agentic AI, DeFi & Payments, Cross-Chain, RWA Tokenization**; community voting via **CSPR.fans**;
and the requirement that projects have a **fully functional prototype generating on-chain activity**
to be eligible in the Final Round — were confirmed from official Casper Network announcements and
the DoraHacks listing via web search, not from the live detail page. CasperProof targets the
**Agentic AI** track (with a DeFi & Payments angle via the x402-gated verification and the insurance
vault). The on-chain-activity requirement is the open gating item, tracked as `TODO(deploy)` in
[`CHECKLIST.md`](./CHECKLIST.md).
