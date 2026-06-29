# CasperProof — CSPR.fans Voting Pack

Share-ready copy for the **community vote on CSPR.fans** (Casper Agentic Buildathon 2026). Drop the
listing URL into the placeholder once the project is live on CSPR.fans, then ship.

> **Listing URL:** `TODO(cspr.fans): listing URL`
> **Repo:** https://github.com/mihailShumilov/casperproof · **Video:** `TODO(video): hosted demo video URL`
> _Testnet-only, unaudited prototype._

## One-line hook

> **CasperProof — the verifiable AI oracle for the agent economy on Casper. Proof your agents can't fake.**

## 280-character blurb

> CasperProof is a verifiable AI oracle on Casper. Agents publish stake-backed, tamper-evident
> proofs; anyone pays a tiny x402 fee to verify; bad proofs get slashed; an insurance vault pays out
> on verified triggers. A reusable trust layer for the agent economy. Vote 👇

_(266 characters; ~267 Twitter-weighted — under the 280 limit.)_

## Value proposition

- **The problem:** autonomous agents produce outputs nobody can verify, and the capital they manage
  is uninsured.
- **The primitive:** a byte-exact blake2b-256 commitment + an on-chain registry with real economic
  security — commit → stake → verify → challenge → slash → reputation.
- **Monetized & agent-native:** verification is **x402**-gated (pay-per-verify) and the whole oracle
  is exposed to agents over **MCP** (7 tools).
- **Proven in DeFi:** a parametric agent-insurance vault reads the registry **cross-contract** and
  auto-pays coverage on verified triggers — refusing payouts backed by slashed proofs.
- **Casper-native:** Odra contracts, CEP-18 (STAKE + mock USDC), CSPR.cloud, CSPR.click, x402, MCP.
- **Real, not slideware:** ~400 TS tests + 40 Rust tests, a cross-language commitment parity test in
  CI, and both security + QA gates returned GO.

## Social posts

### Post 1 — the pitch
> Meet **CasperProof** 🛡️ — the verifiable AI oracle for the agent economy on @Casper_Network.
>
> AI agents publish stake-backed, tamper-evident proofs of their output. Anyone pays a tiny x402
> micropayment to independently verify. Tamper with a proof? It gets **challenged and slashed**.
>
> Built for the Casper Agentic Buildathon. Vote 👉 `TODO(cspr.fans): listing URL`

### Post 2 — the slash demo
> Why "proof your agents can't fake"? 🔒
>
> 1️⃣ Agent attests its output → locks stake on Casper
> 2️⃣ You pay via x402 → verifier recomputes the blake2b-256 commitment → **PASS**
> 3️⃣ Someone tampers the payload → **verify FAIL** → challenge → **slash**
>
> The stake is gone, split between the challenger and the treasury. Bad proofs are expensive.
>
> 🗳️ `TODO(cspr.fans): listing URL`

### Post 3 — the DeFi payoff
> CasperProof isn't just an oracle — it's a trust layer other contracts consume. ⚙️
>
> Our parametric **agent-insurance vault** reads the attestation registry cross-contract and
> auto-pays coverage in USDC on verified triggers — and refuses any payout backed by a slashed
> proof.
>
> Odra · CEP-18 · CSPR.cloud · CSPR.click · x402 · MCP. All open source, all tested.
>
> Back us in the Buildathon 👉 `TODO(cspr.fans): listing URL`

## Call to vote

> **Help us win the Casper Agentic Buildathon.** If a trust layer for AI agents — stake-backed
> proofs, pay-to-verify, slash-the-fakes — is something Casper should have, cast your vote on
> CSPR.fans: `TODO(cspr.fans): listing URL`. Then star the repo:
> https://github.com/mihailShumilov/casperproof 🌟

---

### Placeholders to fill before posting
- `TODO(cspr.fans): listing URL` — the CSPR.fans project page (replace in every post above).
- `TODO(video): hosted demo video URL` — the walkthrough video.
- Social handle for the project, if a dedicated account is created (posts currently tag
  `@Casper_Network` only).

All claims above trace to [`BUIDL.md`](./BUIDL.md). Keep the
"testnet-only, unaudited" framing in any long-form description per
[`../../SECURITY.md`](../../SECURITY.md).
