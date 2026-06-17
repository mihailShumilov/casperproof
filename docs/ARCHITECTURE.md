# Architecture

CasperProof is a **verifiable AI oracle** with a DeFi insurance layer on top. An AI agent
publishes a stake-backed, tamper-evident proof (an _attestation_) of its output; anyone can pay
a small x402 micropayment to fetch and independently verify it; bad proofs are challenged and
slashed. A parametric insurance vault pays out against verified attestations — the flagship demo
that proves the oracle in DeFi.

This document covers the components, how data flows between them, and the four core flows as
sequence diagrams. The byte-level commitment scheme is specified separately in
[`COMMITMENT.md`](./COMMITMENT.md); the on-chain contracts in [`CONTRACTS.md`](./CONTRACTS.md).

## Two layers

CasperProof is built as two layers that share one trust anchor:

1. **Oracle layer** — `AttestationRegistry` (`contracts/src/attestation_registry.rs`). The
   reusable trust primitive: commit → stake → verify → challenge → slash → reputation. It stores
   **hashes + metadata + stake only** and never recomputes hashes on-chain; it just compares the
   bytes that off-chain components produced. Economic security comes from a CEP-18 **STAKE** token
   locked behind each attestation and forfeited if the proof is shown to be fraudulent.

2. **Insurance layer** — `Insurance` (`contracts/src/insurance.rs`). A parametric agent-insurance
   vault denominated in mock **USDC** (CEP-18, 6 decimals). `claim()` reads the registry
   **cross-contract** (`AttestationRegistryContractRef::get_attestation`) and pays coverage only
   when the backing attestation is `Active`/`Finalized` (not slashed/challenged), the trigger is
   covered, the policy is live, and a solvency guard holds. The insurance layer consumes the
   oracle layer — it does not duplicate any trust logic.

```
                       ┌──────────────────────── trust anchor (§8) ────────────────────────┐
                       │  @casperproof/commitment (TS)  ⇆  contracts/src/commitment.rs       │
                       │  blake2b-256 + canonical JSON, byte-for-byte parity via golden vecs │
                       └────────────────────────────────────────────────────────────────────┘
                                         ▲                              ▲
   Oracle layer ──────────────────────── │ ──────────  Insurance layer  │
   AttestationRegistry (stake/slash)      │             Insurance (vault) ┘ reads registry cross-contract
   CEP-18 STAKE                                          CEP-18 mock USDC
```

## Components

| Component         | Path                                       | Role                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Commitment**    | `packages/commitment`                      | The trust anchor (§8): blake2b-256 commitment + canonical JSON. Imported everywhere; never reimplemented. Rust mirror in `contracts/src/commitment.rs`.                                                                             |
| **Contracts**     | `contracts/src`                            | Odra contracts: `attestation_registry`, `insurance`, CEP-18 `tokens` (STAKE + mock USDC). RFC 7807 mapping in `contracts/problem`.                                                                                                  |
| **SDK**           | `packages/sdk` (`@casperproof/casper-sdk`) | The single typed client. Mock backend (in-memory, deterministic) by default; REST backend over CSPR.cloud when `CSPR_CLOUD_TOKEN` is set. All hashing flows through the commitment package.                                         |
| **Agent**         | `packages/agent` (`@casperproof/agent`)    | Zero-cost runtime: deterministic risk-scorer + claim-oracle, the content-addressed payload **store**, the **attestor** (commit → store → submit), the **verifier** (refetch → recompute → PASS/FAIL), and a pluggable runtime loop. |
| **x402 server**   | `apps/x402-server`                         | Fastify resource server. `GET /attestation/:id` and `POST /verify`, both x402-gated; unpaid/invalid requests get a `402` with an RFC 7807 body.                                                                                     |
| **MCP server**    | `apps/mcp-server`                          | Exposes the oracle/insurance tools over the Model Context Protocol (stdio by default, HTTP in compose), backed by the SDK + agent.                                                                                                  |
| **Web dApp**      | `apps/web`                                 | Next.js dashboard: oracle, insurance, and slash demo views; CSPR.click wallet; live event feed.                                                                                                                                     |
| **Marketing**     | `apps/marketing`                           | Static site exported and served by nginx → `casperproof.com`.                                                                                                                                                                       |
| **UI / Config**   | `packages/ui`, `packages/config`           | Shared React components / shared tooling presets.                                                                                                                                                                                   |
| **Payload store** | MinIO (local) / R2 / S3 (prod)             | Off-chain, content-addressed payloads keyed by their blake2b-256 hash.                                                                                                                                                              |
| **LLM runtime**   | Ollama (local)                             | Optional. The demo path runs in `LLM_BACKEND=none` (pure deterministic); model quality never gates a demo.                                                                                                                          |

### Mock-first design

Every external dependency has a zero-secret local/mock fallback, so `make up` and the test suite
run with no secrets and no network:

| Dependency             | Local / mock                                                   | Real                      |
| ---------------------- | -------------------------------------------------------------- | ------------------------- |
| Casper node + deploy   | deterministic mock deploy hashes (`scripts/deploy-testnet.ts`) | CSPR.cloud node + PEM key |
| CSPR.cloud REST/stream | in-memory fixture store + local event emitter                  | `CSPR_CLOUD_TOKEN`        |
| CSPR.click wallet      | mock connector (fixed test account)                            | real app id               |
| x402 facilitator       | local verifier accepting a signed mock `X-PAYMENT`             | facilitator URL           |
| Object storage         | MinIO (compose)                                                | Cloudflare R2 / AWS S3    |
| LLM                    | Ollama (local)                                                 | — (no paid keys, ever)    |

The SDK selects mock vs live from env: `CSPR_CLOUD_TOKEN` present ⇒ live.

## Data flow (high level)

1. An agent produces an `{ input, output }` for a `modelId`. The attestor computes
   `input_hash`, `output_hash`, and the full `commitment` (§8), stores the full payload in the
   content-addressed store (key = blake2b-256 of the bytes, returns an `s3://…` URI), and submits
   the attestation on-chain (hashes + metadata + stake + uri).
2. The chain stores only hashes + metadata + stake. The payload stays off-chain by URI.
3. A buyer pays per request (x402) to fetch the attestation and/or `POST /verify`. The verifier
   refetches the payload by URI, recomputes the output hash, and compares it byte-for-byte to the
   on-chain value: **match ⇒ PASS, mismatch ⇒ FAIL (tampered)**.
4. A tampered payload fails verification; anyone can `challenge` it within the dispute window, and
   the resolver `resolve(fraudulent)` **slashes** the stake to the challenger + treasury.
5. The insurance vault's `claim()` reads the registry cross-contract and pays coverage in USDC
   when a covered, attested trigger fires.

Every contract state change emits an event (`AttestationSubmitted`, `Challenged`, `Resolved`,
`Finalized`, `PolicyPurchased`, `ClaimPaid`, `Staked`, `Unstaked`) so the dashboard updates live
from CSPR.cloud streaming.

## Sequence diagrams

### (a) Attest → submit

```mermaid
sequenceDiagram
    autonumber
    participant Agent as Agent (risk-scorer / claim-oracle)
    participant Att as attestor (@casperproof/agent)
    participant Cmt as @casperproof/commitment
    participant Store as Payload store (S3 / memory)
    participant SDK as @casperproof/casper-sdk
    participant Reg as AttestationRegistry (Casper)

    Agent->>Att: attest({ input, output, modelId, stake })
    Att->>Cmt: computeCommitment(input, output, modelId, timestamp)
    Cmt-->>Att: { inputHash, outputHash, commitment }
    Att->>Store: put(payload)  %% key = blake2b-256(bytes)
    Store-->>Att: s3://bucket/<contentKey>  (uri)
    Att->>SDK: submitAttestation({ modelId, input, output, timestamp, uri, stake })
    Note over SDK: STAKE locked via CEP-18 transfer_from (requires prior allowance)
    SDK->>Reg: submit_attestation(model_id, input_hash, output_hash, commitment, uri, stake)
    Reg->>Reg: store Active; reputation.total += 1
    Reg-->>SDK: id  +  emit AttestationSubmitted
    SDK-->>Att: { id, deployHash, commitment, status: Active }
    Att-->>Agent: AttestResult { id, uri, … }
```

### (b) Pay x402 → verify PASS

```mermaid
sequenceDiagram
    autonumber
    participant Client as Buyer / agent
    participant X402 as x402-server (Fastify)
    participant Fac as x402 facilitator (or mock)
    participant Verifier as verifier (@casperproof/agent)
    participant SDK as @casperproof/casper-sdk
    participant Store as Payload store
    participant Reg as AttestationRegistry

    Client->>X402: POST /verify { id }
    X402-->>Client: 402 Payment Required (application/problem+json: price, pay_to)
    Client->>Fac: pay price → settlement proof
    Client->>X402: POST /verify { id }  + X-PAYMENT header
    X402->>Fac: verify(X-PAYMENT)  %% mock accepts any signed header
    Fac-->>X402: ok (settlement ref)
    X402->>Verifier: verify(sdk, store, id)
    Verifier->>SDK: getAttestation(id)
    SDK->>Reg: get_attestation(id)
    Reg-->>SDK: Attestation { output_hash, uri, attestor, stake, … }
    SDK-->>Verifier: Attestation
    Verifier->>Store: getJson(uri)
    Store-->>Verifier: payload
    Verifier->>Verifier: recomputedHash = hashPayload(output);  recomputed == onchain ⇒ valid=true
    Verifier-->>X402: { valid: true, recomputedHash, onchainHash, attestor, stake, reputation }
    X402-->>Client: 200 { valid: true, recomputedHash, onchainHash, … }
```

### (c) Tamper → verify FAIL → challenge → slash

```mermaid
sequenceDiagram
    autonumber
    participant Attacker as Tamperer (dev demo)
    participant Store as Payload store
    participant Verifier as verifier
    participant Challenger
    participant SDK as @casperproof/casper-sdk
    participant Reg as AttestationRegistry
    participant Resolver
    participant Treasury

    Attacker->>Store: corrupt(uri)  %% overwrite bytes, key unchanged (in-memory dev only)
    Challenger->>Verifier: verify(id)
    Verifier->>SDK: getAttestation(id)
    SDK->>Reg: get_attestation(id)
    Reg-->>Verifier: output_hash (on-chain)
    Verifier->>Store: getJson(uri)
    Store-->>Verifier: tampered payload
    Verifier->>Verifier: recomputedHash != onchainHash
    Verifier-->>Challenger: { valid: false }  (FAIL — tampered)
    Challenger->>SDK: challenge(id)
    Note over SDK,Reg: requires Active + within dispute window; bond locked (CEP-18)
    SDK->>Reg: challenge(id)
    Reg->>Reg: status = Challenged; emit Challenged
    Resolver->>SDK: resolve(id, fraudulent = true)
    SDK->>Reg: resolve(id, true)
    Reg->>Challenger: stake * reward_bps/10000 + bond  (CEP-18 transfer)
    Reg->>Treasury: stake - reward  (treasury cut)
    Reg->>Reg: status = Slashed; reputation.slashed += 1; emit Resolved
    Reg-->>SDK: ok
    SDK-->>Resolver: { status: Slashed }
```

### (d) Insurance claim reading the registry

```mermaid
sequenceDiagram
    autonumber
    participant Holder as Policyholder
    participant SDK as @casperproof/casper-sdk
    participant Ins as Insurance (Casper)
    participant Reg as AttestationRegistry (Casper)
    participant USDC as MockUsdc (CEP-18)

    Note over Holder,Ins: earlier: buy_policy(coverage, trigger_types, expiry) — premium → vault
    Holder->>SDK: submitClaim(policyId, attestationId)
    SDK->>Ins: claim(policy_id, attestation_id, trigger_type)
    Ins->>Ins: caller == holder? policy Active & unexpired? trigger covered?
    Ins->>Reg: get_attestation(attestation_id)  %% cross-contract read
    Reg-->>Ins: Attestation { status, … }
    Ins->>Ins: status in {Active, Finalized}?  vault_balance >= coverage?
    Ins->>USDC: transfer(holder, coverage)
    Ins->>Ins: policy.status = Claimed; emit ClaimPaid
    Ins-->>SDK: ok
    SDK-->>Holder: { paid: true, amount, deployHash }
```

## Trust boundaries and key invariants

- **The contract compares bytes; it never recomputes hashes.** All hashing happens off-chain in
  the TypeScript attestor/verifier via `@casperproof/commitment`. The Rust side recomputes the
  scheme in exactly one place: a host-only golden-vector parity test (see [`COMMITMENT.md`](./COMMITMENT.md)).
- **Single commitment implementation.** TS (`packages/commitment`) and Rust
  (`contracts/src/commitment.rs`) must agree byte-for-byte; CI runs both and fails on divergence.
- **Content addressing.** A payload's store key is the blake2b-256 of its bytes, so any
  modification changes the key — tampering at the same URI is what the demo exploits, and the
  verifier catches it because the recomputed output hash no longer matches the on-chain value.
- **Cross-contract solvency.** Insurance never trusts a claim on its own; it reads the registry
  and refuses payouts backed by slashed/challenged attestations, behind a vault solvency guard.
