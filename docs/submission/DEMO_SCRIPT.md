# CasperProof — Demo Script (~4 min)

A spoken, scene-by-scene walkthrough for the submission video. Leads with the loss hook, makes the
**animated attestation** the visual centerpiece, and ends on the economic-security climax
(tamper → verify FAIL → challenge → slash) plus the LP/staking side. Condensed beat sheet:
[`../DEMO_SCRIPT.md`](../DEMO_SCRIPT.md).

**Record on the live hosted demo** (preferred): **https://app.casperproof.com** (dApp) +
**https://casperproof.com** (marketing). Contracts are live on **`casper-test`** (Casper 2.2.2); the
three on-chain demo-arc txs are linked in the table at the bottom. Everything also runs locally in
mock mode (`make up`) with no secrets if you'd rather record offline.

> **Label on screen / in the description:** _Testnet-only, unaudited prototype — Casper Agentic
> Buildathon 2026._ The risk assessment + dashboards run in mock mode (deterministic, no LLM
> dependency); the four contracts + the three demo-arc transactions are real on `casper-test`.

## Pre-roll setup (not recorded)

- Open **https://casperproof.com** (marketing) and **https://app.casperproof.com** (dApp) in two tabs.
  - Local fallback: `cp .env.example .env && make up` → dApp http://localhost:29300 · marketing http://localhost:29301.
- In the dApp, click **Connect** in the nav (mock CSPR.click connector → deterministic test account).
- Have the cspr.live transaction tabs (table below) ready to cut to for the on-chain proof.

---

## Spoken script with timestamps

### 0:00–0:25 — Hook: the money already lost
**Show:** `casperproof.com` → scroll to the **"Real money lost"** section: the count-up stat band,
the incident marquee (Mango Markets **$117M** oracle manipulation, BonqDAO $120M, Wormhole $326M…),
and the live "uncovered losses" feed ticking.
> "Manipulated oracles and unverifiable inputs have drained billions from DeFi — over two hundred
> million from oracle manipulation alone. Autonomous agents are next: they produce outputs nobody can
> verify, and the capital they move is uninsured. CasperProof fixes both — on Casper."

### 0:25–0:45 — What it is
**Show:** cut to the dApp home (`app.casperproof.com`).
> "CasperProof is a verifiable AI oracle and trust layer for agents. Stake-backed, tamper-evident
> attestations; an animated risk assessment anyone can run; insurance that pays out on verified
> triggers; and slashing that makes bad proofs expensive."

### 0:45–1:30 — The attestation (the centerpiece)
**Show:** `/attest`. Paste an agent address, click **Run risk assessment**. Let the **animated
pipeline** play: the collect phase (data sources lighting up), then the **15-factor scan** — each
signal steps from pending → scanning (progress bar + plain-English explanation) → a tier-colored
rating — grouped across transaction, protocol, security, and identity categories.
> "It scores fifteen on-chain risk factors — oracle deviation, exploit history, leverage, liquidity,
> concentration — each explained as it runs. No black box: you watch the assessment happen."

Land on the **ring gauge**: the overall risk score as a percentage with its tier.
> "Out comes a single verifiable score, committed on-chain with the attestor's stake behind it."

### 1:30–1:50 — Shareable result
**Show:** click through to `/attestation/[id]` — the full result: ring-gauge percentage, the
per-factor breakdown cards, the tier verdict. Click **Share result** (copies the link) and show the
**Post on X** option.
> "Every assessment is a shareable, reproducible attestation — one link reproduces the exact result,
> ready to drop into a report or a pull request."

### 1:50–2:20 — Verify PASS + on-chain proof (tx #1)
**Show:** `/oracle` — the attestation is on the registry. Expand it → **Verify → Verify proof**.
> "Verification is x402-gated — a 402 with a standard problem body, you pay, then retry. The verifier
> refetches the payload and recomputes the full commitment: input, output, model, and timestamp."

Show the **PASS** pill with **on-chain hash == recomputed hash**. Cut to the cspr.live
`submit_attestation` transaction.
> "Byte-for-byte match — and it's real on Casper testnet. This attestation is transaction one."

### 2:20–2:45 — Insurance pays out (tx #2)
**Show:** `/insurance`. Get a risk score (gauge), **Buy policy** (5 CSPR coverage, `Oracle failure`
trigger), then **Simulate trigger**.
> "The vault reads the backing attestation cross-contract — covered and active — and auto-pays the
> coverage. No claims adjuster, no paperwork."

Show the green **Auto-payout** notice + the **Vault solvency** tiles. Cut to the cspr.live `claim` tx.
> "That payout is transaction two."

### 2:45–3:25 — Tamper → FAIL → challenge → slash (tx #3, the climax)
**Show:** `/slash`. Submit a stake-backed attestation (**3 CSPR**), then the pre-filled **tampered**
payload. **Verify (expect FAIL)** → the recomputed hash diverges. **Challenge** (post a bond) →
**Resolve & slash**.
> "Now someone tampers with the payload and we verify again — FAIL. The hash no longer matches.
> Anyone can challenge within the dispute window; the resolver rules it fraudulent, and the stake is
> slashed — split fifty-fifty between the challenger who caught it and the treasury."

Show the **Slash economics** tiles (`slashed +1`). Cut to the cspr.live `resolve` tx.
> "Bad proofs are expensive. The stake is gone — that's transaction three."

### 3:25–3:45 — Be the house (staking)
**Show:** `/staking` — pool-health KPIs, **Stake**, and the solvency-gated **unstake** flow animating
through its steps.
> "And anyone can back the vault. LPs stake capital, earn from premiums, and unstake through a
> solvency guard that protects outstanding coverage — the economic engine behind the guarantees."

### 3:45–4:00 — Close
**Show:** the live event feed with all three events; then `casperproof.com` + the GitHub repo.
> "Four contracts and three real transactions on Casper testnet — attest, claim, slash — every state
> change streaming live. A reusable trust primitive for the agent economy: exposed via MCP, monetized
> via x402, secured by stake and slashing. Testnet-only and unaudited today — but the trust layer is
> real, tested, and live."

---

## The three on-chain transactions (cut to these for proof)

| # | Action | Where | Contract call | Live link |
| - | --- | --- | --- | --- |
| 1 | Attest | `/oracle` → Verify | `submit_attestation` | https://testnet.cspr.live/transaction/fcf7e82bf36d71d4ea42b116ead4e889e3f83af4c59f2b4d4bb9f743b9c0e8fa |
| 2 | Claim payout | `/insurance` → Simulate trigger | `claim` | https://testnet.cspr.live/transaction/14073730f6156cb14f6416cf309dfb203261745c95d7ecb5300c8a2f83dfabe0 |
| 3 | Slash | `/slash` → Resolve fraudulent | `resolve(id, true)` | https://testnet.cspr.live/transaction/29744fd1253cf76ac6206ae8afd27c1b82ebc91556fd7e344bc73bd4f6fb30ea |

The four contract package hashes + these demo-arc txs are in
[`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 / [`../../deploy-out/arc.json`](../../deploy-out/arc.json).

## Shot list (what to capture)

1. `casperproof.com` — "Real money lost" section (marquee + live feed).
2. `/attest` — the full animated pipeline run (the money shot — let it breathe ~20s).
3. `/attestation/[id]` — ring-gauge result + Share.
4. `/oracle` — Verify PASS (both hashes equal) + the cspr.live `submit_attestation` tab.
5. `/insurance` — buy policy → Simulate trigger → Auto-payout + the cspr.live `claim` tab.
6. `/slash` — tamper → FAIL → Challenge → Slash + the cspr.live `resolve` tab.
7. `/staking` — pool health + stake + unstake flow.
8. Close — live feed with all events + the repo.

Hosted video URL: `TODO(video): hosted demo video URL`.
