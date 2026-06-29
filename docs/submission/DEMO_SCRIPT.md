# CasperProof — 3-Minute Demo Script

A tightened, spoken walkthrough for the submission video. Condensed from the full beat sheet in
[`../DEMO_SCRIPT.md`](../DEMO_SCRIPT.md) — this version is timed for **3:00** and ends on the
economic-security climax (tamper → verify FAIL → challenge → slash).

The whole flow runs on the **local stack in mock mode** — no secrets, no live network, and the demo
never depends on LLM quality. The contracts are also **live on `casper-test`** (Casper 2.2.2), so the
recording can instead use the hosted dApp at **https://app.casperproof.com**; the three on-chain
demo-arc txs are linked in the steps table below and in
[`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1.

> **Label on screen / in the description:** _Testnet-only, unaudited prototype — Casper Agentic
> Buildathon 2026._ Contracts are deployed to `casper-test`; the recording can run on the live dApp
> (**app.casperproof.com**) or the local stack.

## Pre-roll setup (not recorded)

```bash
cp .env.example .env
make up      # boots ollama, minio, agent, x402, mcp, web, marketing
make seed    # seeds demo attestations + insurance policies
```

- dApp → http://localhost:29300 · Marketing → http://localhost:29301 · x402 → http://localhost:29402
- Click **Connect** in the nav — the mock CSPR.click connector returns a deterministic test account.

## Spoken script with timestamps

### 0:00–0:15 — Hook + problem
> "Autonomous agents produce outputs nobody can verify, and the capital they manage is uninsured.
> CasperProof fixes that on Casper."

**Show:** dApp home (`/`) — the one-liner, the three steps (Attest · Verify · Slash), and the live
event feed already streaming.

### 0:15–0:30 — One-liner
> "CasperProof is a verifiable AI oracle — proof your agents can't fake. Stake-backed,
> tamper-evident attestations; pay a micropayment to verify; bad proofs get slashed; and an
> insurance vault pays out on verified triggers."

### 0:30–1:00 — Attest (on-chain tx #1)
**Show:** `/oracle`. The submit form is pre-filled (model `casperproof-riskscorer-v1`, a risk
input, output `{ "score": 73, "tier": "HIGH" }`, 2 STAKE).
> "The agent canonicalizes its input and output, hashes them with blake2b-256, uploads the payload
> to a content-addressed store, and submits the attestation — locking stake on-chain."

Click **Submit attestation**. The new attestation appears with its commitment; the feed shows
`AttestationSubmitted`. _(This is `submit_attestation`, tx #1.)_

### 1:00–1:30 — Pay x402 + verify PASS (both hashes)
**Show:** still `/oracle` — expand the attestation, click **Verify → Verify proof**.
> "Verification is x402-gated: a 402 with a standard problem body, you pay, then retry. The verifier
> refetches the payload and recomputes the full commitment — input, output, model, and timestamp."

Show the **PASS** pill and the two hashes side by side: **On-chain hash == Recomputed hash.**
> "Byte-for-byte match. The contract never recomputes on-chain — it just compares the bytes."

### 1:30–1:55 — Insurance trigger + claim payout (on-chain tx #2)
**Show:** `/insurance`. Get a risk score (gauge renders), **Buy policy** (5 CSPR coverage,
`Oracle failure` trigger), then **Simulate trigger**.
> "The insurance vault is the oracle in DeFi. The claim reads the attestation cross-contract — and
> because it's covered and active, the vault auto-pays the coverage in USDC."

Show the green **Auto-payout** notice and the **Vault solvency** tiles updating. _(This is `claim`,
tx #2.)_

### 1:55–2:20 — Tamper → verify FAIL (the climax begins)
**Show:** `/slash`. Submit an honest-looking proof with **3 CSPR** staked, then the pre-filled
**tampered** payload (e.g. `{ "score": 5, "tier": "LOW" }` instead of the honest
`{ "score": 42, "tier": "MEDIUM" }`). Click **Verify (expect FAIL)**.
> "Now someone tampers with the payload. We verify again —"

Show the **FAIL** verdict: recomputed hash diverges from the on-chain hash.
> "— FAIL. The recomputed hash no longer matches. Tamper detected."

### 2:20–2:45 — Challenge → slash (on-chain tx #3)
**Show:** still `/slash`. **Challenge** (post a bond) → status `Challenged`. **Resolve & slash** →
the resolver rules it fraudulent.
> "Anyone can challenge within the dispute window. The resolver rules it fraudulent and the stake
> is slashed — split fifty-fifty between the challenger who caught it and the treasury. The
> attestor's reputation takes a permanent hit."

Show the **Slash economics** tiles: the split paid, `slashed +1`. _(This is `resolve(id, true)`,
tx #3.)_
> "Bad proofs are expensive. The stake is gone."

### 2:45–3:00 — Close
> "Three on-chain transactions — attest, claim, slash — and every state change streams live to the
> dashboard. CasperProof is a reusable trust primitive for the agent economy: exposed to agents via
> MCP, monetized via x402, secured by stake and slashing on Casper."

**Show:** the live feed with all three events; site **casperproof.com**, repo on GitHub.
> "Testnet-only and unaudited today — but the trust layer is real, tested, and ready to deploy."

## The three on-chain transactions (for the recording)

| # | Action | Where | Contract call | Live link |
| - | --- | --- | --- | --- |
| 1 | Attest | `/oracle` → Submit attestation | `submit_attestation` | https://testnet.cspr.live/transaction/fcf7e82bf36d71d4ea42b116ead4e889e3f83af4c59f2b4d4bb9f743b9c0e8fa |
| 2 | Claim payout | `/insurance` → Simulate trigger | `claim` | https://testnet.cspr.live/transaction/14073730f6156cb14f6416cf309dfb203261745c95d7ecb5300c8a2f83dfabe0 |
| 3 | Slash | `/slash` → Resolve fraudulent | `resolve(id, true)` | https://testnet.cspr.live/transaction/29744fd1253cf76ac6206ae8afd27c1b82ebc91556fd7e344bc73bd4f6fb30ea |

These are the live `casper-test` demo-arc txs (also in
[`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 / [`../../deploy-out/arc.json`](../../deploy-out/arc.json)).
Hosted video URL: `TODO(video): hosted demo video URL`.
