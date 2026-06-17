---
name: attestation-oracle
description: The CasperProof trust mechanics — attestation data model, AttestationRegistry entry points, the challenge/slash/reputation economic layer, and the verification algorithm. The spec every component agrees with.
---

# Attestation oracle — trust mechanics

CasperProof's core product is a **verifiable AI oracle**: an agent publishes a stake-backed,
tamper-evident proof of its output; anyone can pay to verify it; bad proofs are slashed.
This skill is the contract every component (contract, agent, SDK, servers, dApp) agrees to.
Pairs with [`commitment-scheme`](../commitment-scheme/SKILL.md).

## Data model — `Attestation`

| Field | Type | Notes |
|---|---|---|
| `id` | `u64` | monotonic counter |
| `attestor` | `Address` | who submitted |
| `model_id` | `String` | e.g. `casperproof-riskscorer-v1` |
| `input_hash` | `[u8;32]` | blake2b-256(canonical(input)) |
| `output_hash` | `[u8;32]` | blake2b-256(canonical(output)) |
| `commitment` | `[u8;32]` | full commitment (§8) |
| `uri` | `String` | S3 URL of the off-chain payload (content-addressed) |
| `stake` | `U512` | locked behind the attestation |
| `created_at` | `u64` | submit timestamp |
| `status` | `Active \| Challenged \| Slashed \| Finalized` | lifecycle |
| `challenger`, `challenge_bond`, `challenged_at` | dispute state |

On-chain stores **hashes + metadata + stake only**. Full payload lives off-chain (S3) by `uri`.
**The contract compares bytes; it never recomputes hashes.**

## `AttestationRegistry` entry points

- `submit_attestation(model_id, input_hash, output_hash, commitment, uri)` — **payable**;
  requires `stake >= min_stake`; stores `Active`; emits `AttestationSubmitted`.
- `get_attestation(id) -> Attestation` — read; reverts `NotFound`.
- `challenge(id)` — **payable** bond; only while `Active` **and** within the dispute window;
  sets `Challenged`; emits `Challenged`. Reverts `WindowClosed`, `AlreadyChallenged`.
- `resolve(id, fraudulent: bool)` — **resolver-only**:
  - `fraudulent=true` → **slash**: stake split challenger reward (`reward_bps`) + treasury;
    bond returned to challenger; status `Slashed`; reputation `slashed += 1`; emit `Resolved`.
  - `fraudulent=false` → **honest**: stake returned to attestor; bond forfeited to treasury;
    status `Finalized`; reputation `successful += 1`, `challenges_defended += 1`.
- `finalize(id)` — after the window with no challenge: returns stake, status `Finalized`.
- Reads: `attestation_count()`, `attestor_reputation(addr) -> Reputation`, `get_config()`.

**Errors:** `NotFound`, `InsufficientStake`, `WindowClosed`, `AlreadyChallenged`,
`Unauthorized`, `NotActive`, `AlreadyResolved`. **Every state change emits an event** so the
dashboard updates live from CSPR.cloud streaming.

RFC 7807 mapping for these errors lives in `contracts/problem` (`CasperProofError`) and is the
canonical body returned by the x402 / MCP HTTP surfaces.

## Verification algorithm (`POST /verify` + verifier agent)

1. Load attestation by `id` (on-chain).
2. Fetch payload by `uri` from the S3 store.
3. Recompute `output_hash'` (and `commitment'`) from the payload via `@casperproof/commitment`.
4. Assert `output_hash' == onchain.output_hash`. Mismatch ⇒ **FAIL** (tampered).
5. Return `{ valid, recomputed_hash, onchain_hash, attestor, stake, reputation }`.

## Insurance app (proves the oracle in DeFi)

`Insurance` reads `AttestationRegistry.get_attestation` inside `claim(policy_id, attestation_id)`
and pays USDC from the vault when the attested decision is a covered payout. Policy:
`{id, holder, coverage, premium, trigger_types, expiry, status}`. Vault has a solvency guard;
stakers earn from premiums. Trigger taxonomy: `exploit`, `oracle_failure`, `agent_error`,
`governance_attack`.

## Demo flow (the video climax)

attest → pay x402 → verify **PASS** (both hashes) → insurance trigger → `claim` pays USDC →
tamper payload → verify **FAIL** → `challenge` + `resolve(fraudulent)` **slash** → dashboard
updates live. Three on-chain txs: submit, claim, slash.
