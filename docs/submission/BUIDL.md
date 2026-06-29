# CasperProof — DoraHacks BUIDL

**The verifiable AI oracle and trust layer for the agent economy on Casper.**
_Proof your agents can't fake._

Built for the **Casper Agentic Buildathon 2026** (Qualification Round, June 1–30, 2026).

> **Status:** Testnet-only, **unaudited** — not for mainnet value. See [`../../SECURITY.md`](../../SECURITY.md).
> Contracts are **live on Casper testnet** (network `casper-test`, Casper 2.2.2): `AttestationRegistry`
> [`hash-7ff0…58e7`](https://testnet.cspr.live/contract-package/7ff02eedc0159d2ad2567d939812a56f52979e6f07a11f6741e6ceb72c1658e7),
> `Insurance` [`hash-9773…9d07`](https://testnet.cspr.live/contract-package/97734727898835d7f99b280f5705e878d54e7ad5ade90620ed8b0fc74f6d9d07),
> `StakeToken` [`hash-54aa…8dfd`](https://testnet.cspr.live/contract-package/54aa1e56d38f5f3f1ec4488ff2304d9c81520ff99dcbfd20f59d053a7d578dfd),
> `MockUsdc` [`hash-3695…f229`](https://testnet.cspr.live/contract-package/369561bdba8e59e2716124bc0bcbad7e7eb035cb44d275aa54fc94b182b6f229).
> Live dApp: **https://app.casperproof.com** · site: **https://casperproof.com**. Full package hashes
> + install txs in [`../../deploy-out/onchain.json`](../../deploy-out/onchain.json) and the three
> on-chain demo txs in [`../../deploy-out/arc.json`](../../deploy-out/arc.json) (see also
> [`../CONTRACTS.md`](../CONTRACTS.md)).

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
when the corresponding credential/URL is supplied (see [`../DEPLOYMENT.md`](../DEPLOYMENT.md)).

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
| **Contract WASM build** (`cargo odra build`) | ⚙️ **Runs in CI / dev machine** | Not produced in the build sandbox (CDN/GitHub blocked); logic fully verified via MockVM |
| **Testnet deploy + on-chain txs** | ✅ **Live on `casper-test`** | 4 contracts installed + 3 demo txs (`submit_attestation`/`claim`/`resolve`) on-chain via a casper-js-sdk v5 script; hashes/links in [`../../deploy-out/onchain.json`](../../deploy-out/onchain.json) + [`../../deploy-out/arc.json`](../../deploy-out/arc.json) |
| **CSPR.cloud reads/streaming** | 🔴 **Mock by default** | In-memory fixtures + local event emitter; live with `CSPR_CLOUD_TOKEN` |
| **x402 micropayments** | 🔴 **Mock by default** | Local verifier accepts a signed `X-PAYMENT`; live with `X402_FACILITATOR_URL` |
| **Object storage** | 🔴 **In-memory / MinIO** | Live with `S3_*` (Cloudflare R2 / AWS S3) |
| **E2E (Playwright)** | ⚙️ **Specs written; run in CI** | `e2e/`; browser binaries install in CI (`playwright install chromium`) |

Aggregate: **~400 TypeScript tests** across packages and **40 Rust tests**, every threshold-gated
package clearing **>90% line + branch**; both submission gates (security review + QA) returned
**GO**.

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

1. **Harden the live deploy path** — the four contracts and the three demo txs are already on
   `casper-test` (via a casper-js-sdk v5 script; [`../../deploy-out/onchain.json`](../../deploy-out/onchain.json));
   next is a CI-driven redeploy and wiring the in-dApp write path against the live packages.
2. **Live x402 facilitator + CSPR.click wallet** on testnet (replace the mock verifier/connector).
3. **More model adapters and trigger types** — beyond the risk-scorer and claim-oracle, and beyond
   the `exploit` / `oracle_failure` / `agent_error` / `governance_attack` taxonomy.
4. **Richer reputation & insurance economics** — per-LP capital reservation across the vault
   (documented as a mainnet item), tiered reputation, and
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
- **Live dApp:** https://app.casperproof.com · **Marketing:** https://casperproof.com
- **Demo video:** `TODO(video): hosted demo video URL`
- **CSPR.fans listing:** `TODO(cspr.fans): listing URL` — see [`VOTING_PACK.md`](./VOTING_PACK.md)
- **On-chain demo txs (cspr.live):** [`submit_attestation`](https://testnet.cspr.live/transaction/fcf7e82bf36d71d4ea42b116ead4e889e3f83af4c59f2b4d4bb9f743b9c0e8fa) ·
  [`claim`](https://testnet.cspr.live/transaction/14073730f6156cb14f6416cf309dfb203261745c95d7ecb5300c8a2f83dfabe0) ·
  slash [`resolve`](https://testnet.cspr.live/transaction/29744fd1253cf76ac6206ae8afd27c1b82ebc91556fd7e344bc73bd4f6fb30ea) — recorded in [`../../deploy-out/arc.json`](../../deploy-out/arc.json)

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
vault). The on-chain-activity requirement is **satisfied** — four contracts are installed on
`casper-test` and the three demo transactions are on-chain (hashes/links in
[`../../deploy-out/onchain.json`](../../deploy-out/onchain.json) +
[`../../deploy-out/arc.json`](../../deploy-out/arc.json)).
