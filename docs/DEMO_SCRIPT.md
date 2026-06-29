# Demo script (§20)

A ~2–3 minute walkthrough of CasperProof, end to end. The whole flow runs on the local stack in
mock mode (no secrets) — the demo never depends on LLM quality or live network. Routes are the
real `apps/web` pages; the on-chain writes are the three demo transactions
(`submit_attestation`, `claim`, slash `resolve`).

> **For the actual recording, use the timed, scene-by-scene script:**
> [`submission/DEMO_SCRIPT.md`](submission/DEMO_SCRIPT.md) (~4 min). It records on the **live hosted
> demo** (https://app.casperproof.com + https://casperproof.com), leads with the marketing
> "Real money lost" section, makes the **animated attestation pipeline** (`/attest`) the centerpiece,
> and adds the shareable result (`/attestation/[id]`) and **staking** (`/staking`) — the features
> added since this beat sheet was first written. The contracts are now live on `casper-test`.

## Setup (before recording)

```bash
cp .env.example .env
make up                 # boots ollama, minio, agent, x402, mcp, web, marketing
make seed               # seeds demo attestations + insurance policies (deployer container)
```

- dApp: http://localhost:29300 · Marketing: http://localhost:29301 · x402: http://localhost:29402
- Wallet: click **Connect** in the nav — the mock CSPR.click connector returns a deterministic
  test account, so no extension is needed.

(For a live testnet run, set the secrets in [`../SETUP_NEEDED.md`](../SETUP_NEEDED.md) and
`make deploy-testnet` first; the three deploy links go in that file.)

## Beats

### 1 · Problem (0:00–0:15)

> "Autonomous agents produce outputs nobody can verify, and the capital they manage is
> uninsured."

Open the marketing site (http://localhost:29301) or the dApp home (`/`). The home hero states the
one-liner and the three steps (Attest · Verify · Slash) with the live event feed already visible.

### 2 · One-liner (0:15–0:25)

> "CasperProof is the verifiable AI oracle for the agent economy on Casper — proof your agents
> can't fake. Stake-backed, tamper-evident attestations; pay to verify; bad proofs get slashed;
> insurance pays out on verified triggers."

### 3 · Attest — the on-chain tx (0:25–0:55)

Go to **`/oracle`** (Open the oracle).

- The submit form is pre-filled: model `casperproof-riskscorer-v1`, input
  `{ "address": "account-hash-abc123", "features": { "txCount": 412 } }`, output
  `{ "score": 73, "tier": "HIGH" }`, stake `2000000000` motes (2 STAKE, above the 1-STAKE mock
  minimum).
- Click **Submit attestation**. This computes the input/output hashes + commitment (§8), uploads
  the payload to the content-addressed store, and writes `submit_attestation` on-chain (tx #1).
- The new attestation appears in the list with its commitment; the live feed shows
  `AttestationSubmitted`.

### 4 · Pay x402 + verify PASS — show both hashes (0:55–1:25)

Still on **`/oracle`**, expand the new attestation and click **Verify** → **Verify proof** (the
payload pre-fills with the honest output, so an unedited verify PASSes). Behind the scenes this is
the x402-gated `POST /verify` path: a `402` with an RFC 7807 body, pay, retry with `X-PAYMENT`,
then the verifier refetches the payload and recomputes the hash.

> "Verification recomputes the hash from the payload and compares it byte-for-byte to the on-chain
> commitment."

Show the **PASS** verdict pill and the two hashes side by side: **On-chain hash** ==
**Recomputed hash**. Point out the attestor, stake, and reputation.

### 5 · Insurance trigger + claim payout — the oracle in DeFi (1:25–1:55)

Go to **`/insurance`**.

1. **Risk score** — paste/keep the default address, click **Get risk score**; the gauge and tier
   render (deterministic 15-signal model).
2. **Buy a policy** — keep coverage `5 CSPR`, premium `0.25 CSPR`, covered trigger
   `Oracle failure`; click **Buy policy**.
3. **Simulate trigger** — on the new policy click **Simulate trigger**. This submits a claim-oracle
   attestation tagged with the covered trigger and files `submitClaim(policyId, attestationId)`
   (tx #2). The contract reads the attestation cross-contract and, since it's covered and active,
   the vault **auto-pays** the coverage in USDC.

Show the green **Auto-payout** notice (amount, policy, attestation, deploy hash) and the **Vault
solvency** tiles updating.

### 6 · Tamper → verify FAIL (1:55–2:20)

Go to **`/slash`** (the economic-security climax).

1. **Submit attestation** — click it; an honest-looking proof goes on-chain with **3 CSPR** staked.
2. **Tamper & verify** — the tampered payload is pre-filled (e.g. `{ "score": 5, "tier": "LOW" }`
   instead of the honest `{ "score": 42, "tier": "MEDIUM" }`). Click **Verify (expect FAIL)**.

Show the **FAIL** verdict: the recomputed hash diverges from the on-chain hash — tamper detected.

### 7 · Challenge → slash (2:20–2:45)

Still on **`/slash`**:

3. **Challenge** — post a dispute bond; status → `Challenged`.
4. **Resolve & slash** — the resolver rules it fraudulent (tx #3). The stake is slashed and split:
   **50% to the challenger, 50% to the treasury** (the `reward_bps` demo economics), and the
   attestor's reputation takes a `slashed +1`. The **Slash economics** tiles show the split paid.

> "Bad proofs are expensive. The stake is gone, split between the challenger who caught it and the
> treasury."

### 8 · Close (2:45–3:00)

> "Three on-chain transactions: attest, claim, slash. Every state change streams to the live
> dashboard. CasperProof is a reusable trust primitive for the agent economy — exposed to agents
> via MCP, monetized via x402."

- Site: **casperproof.com** · app: **app.casperproof.com**
- Socials / repo: link as configured.
- Roadmap: more model adapters and trigger types, a real x402 facilitator + CSPR.click wallet on
  testnet, mainnet deploy, and richer reputation/insurance economics.

## The three on-chain transactions (for the recording)

| #   | Action       | Where                           | Contract call        |
| --- | ------------ | ------------------------------- | -------------------- |
| 1   | Attest       | `/oracle` → Submit attestation  | `submit_attestation` |
| 2   | Claim payout | `/insurance` → Simulate trigger | `claim`              |
| 3   | Slash        | `/slash` → Resolve fraudulent   | `resolve(id, true)`  |

CSPR.live deploy links for these (live runs only): see [`../SETUP_NEEDED.md`](../SETUP_NEEDED.md).
