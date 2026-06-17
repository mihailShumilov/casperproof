# Contracts

The CasperProof on-chain layer is a set of [Odra](https://odra.dev) (2.8.1) contracts in
`contracts/src`, compiled to WASM for Casper. Signatures below are taken directly from the Rust
source; types use Odra's prelude (`Address`, `Var`, `Mapping`, `String`, `Vec`) and
`odra::casper_types::U256`.

- Build WASM: `cargo odra build` (compiles each contract via `bin/build_contract.rs`).
- Test (MockVM, native, no WASM): `cargo odra test` / `cargo test`.
- Cross-language parity test: `cargo test --lib` (see [`COMMITMENT.md`](./COMMITMENT.md)).
- Deploy to testnet: `make deploy-testnet`.

| Contract              | Module                         | Purpose                                                         |
| --------------------- | ------------------------------ | --------------------------------------------------------------- |
| `AttestationRegistry` | `attestation_registry.rs`      | The core verifiable-oracle contract.                            |
| `Insurance`           | `insurance.rs`                 | Parametric agent insurance (policy / vault / staking / claim).  |
| `StakeToken` (STAKE)  | `tokens.rs`                    | CEP-18 token attestors lock as stake; challengers post as bond. |
| `MockUsdc` (USDC)     | `tokens.rs`                    | CEP-18 test stablecoin for insurance premiums/coverage/payouts. |
| `casperproof-problem` | `contracts/problem/src/lib.rs` | RFC 7807 mapping of the error taxonomy.                         |

Shared storage types live in `contracts/src/commitment.rs`: `Hash = [u8; 32]`, `Attestation`,
`AttestationStatus { Active, Challenged, Slashed, Finalized }`, `Reputation`, `RegistryConfig`.

## `AttestationRegistry`

Stores hashes + metadata + stake only; **never recomputes hashes on-chain**. Every state change
emits an event for the live dashboard.

### Entry points

```rust
fn init(stake_token: Address, min_stake: U256, challenge_bond: U256,
        dispute_window: u64, treasury: Address, resolver: Address, reward_bps: u64)

fn submit_attestation(model_id: String, input_hash: Hash, output_hash: Hash,
                      commitment: Hash, uri: String, stake: U256) -> u64
fn get_attestation(id: u64) -> Attestation
fn challenge(id: u64)
fn resolve(id: u64, fraudulent: bool)
fn finalize(id: u64)

fn attestation_count() -> u64
fn attestor_reputation(attestor: Address) -> Reputation
fn get_config() -> RegistryConfig
fn stake_token() -> Address
```

- `submit_attestation` — requires `stake >= min_stake`; locks `stake` via CEP-18
  `transfer_from(caller, self, stake)` (caller must have approved the registry first); stores the
  record `Active`; bumps `reputation.total`; returns the new id.
- `challenge` — only while `Active` **and** within `dispute_window` (configured in seconds; block
  time is in ms, so the contract multiplies by 1000); locks `challenge_bond` via `transfer_from`;
  sets `Challenged`.
- `resolve` — **resolver-only**. If `fraudulent`: slash — the challenger gets
  `stake * reward_bps / 10000` **plus** their bond back, the remainder goes to the treasury,
  status `Slashed`, `reputation.slashed += 1`. If not fraudulent: refund stake to the attestor,
  forfeit the bond to the treasury, status `Finalized`, `reputation.successful += 1` and
  `challenges_defended += 1`.
- `finalize` — after the window with no challenge: returns the stake, status `Finalized`,
  `reputation.successful += 1`.

### Events

```rust
AttestationSubmitted { id: u64, attestor: Address, model_id: String, commitment: Hash, stake: U256, created_at: u64 }
Challenged           { id: u64, challenger: Address, bond: U256, challenged_at: u64 }
Resolved             { id: u64, fraudulent: bool, challenger: Address, slashed_amount: U256, challenger_reward: U256 }
Finalized            { id: u64, attestor: Address, stake_returned: U256 }
```

### Errors (`attestation_registry::Error`)

| Variant             | Code | Meaning                                                        |
| ------------------- | ---- | -------------------------------------------------------------- |
| `NotFound`          | 1    | No attestation with that id.                                   |
| `InsufficientStake` | 2    | Declared stake below `min_stake`.                              |
| `WindowClosed`      | 3    | Dispute window elapsed.                                        |
| `AlreadyChallenged` | 4    | Already under challenge.                                       |
| `Unauthorized`      | 5    | Caller not the resolver.                                       |
| `NotActive`         | 6    | Attestation not in the required state.                         |
| `AlreadyResolved`   | 7    | Challenge already resolved.                                    |
| `BadConfig`         | 8    | Misconfiguration (e.g. `reward_bps > 10000`) / missing config. |

## `Insurance`

Reads `AttestationRegistry.get_attestation` **cross-contract** before paying a claim. Premiums,
coverage, LP stake, and payouts are all in mock USDC; the vault has a solvency guard.

### Entry points

```rust
fn init(usdc_token: Address, registry: Address, premium_bps: u64, claim_model_id: String)

fn buy_policy(coverage: U256, trigger_types: Vec<String>, expiry: u64) -> u64
fn claim(policy_id: u64, attestation_id: u64, trigger_type: String)
fn stake(amount: U256)
fn unstake(amount: U256)

fn get_policy(id: u64) -> Policy
fn policy_count() -> u64
fn total_staked() -> U256
fn staked_of(staker: Address) -> U256
fn vault_balance() -> U256
fn premium_bps() -> u64
```

- `buy_policy` — premium = `coverage * premium_bps / 10000`, pulled via USDC `transfer_from`;
  stores the policy `Active`; returns the id.
- `claim` — caller must be the holder; policy must be `Active` and unexpired; `trigger_type` must
  be in the policy's `trigger_types`. Reads the backing attestation cross-contract; it must be
  `Active` or `Finalized` (a `Slashed`/`Challenged` attestation cannot back a payout). Pays
  `coverage` in USDC if `vault_balance >= coverage`; sets the policy `Claimed`.
- `stake` / `unstake` — LPs add/withdraw USDC capital; `unstake` is bounded by the position and
  the vault solvency guard.

Policy: `Policy { id, holder, coverage, premium, trigger_types: Vec<String>, expiry, status }`
with `PolicyStatus { Active, Claimed, Expired }`. Trigger taxonomy: `exploit`, `oracle_failure`,
`agent_error`, `governance_attack`.

### Events

```rust
PolicyPurchased { id: u64, holder: Address, coverage: U256, premium: U256, expiry: u64 }
ClaimPaid       { policy_id: u64, attestation_id: u64, holder: Address, amount: U256, trigger_type: String }
Staked          { staker: Address, amount: U256, total_staked: U256 }
Unstaked        { staker: Address, amount: U256, total_staked: U256 }
```

### Errors (`insurance::Error`)

| Variant                     | Code | Meaning                                        |
| --------------------------- | ---- | ---------------------------------------------- |
| `PolicyNotFound`            | 20   | No policy with that id.                        |
| `PolicyExpired`             | 21   | Policy past its expiry.                        |
| `TriggerNotCovered`         | 22   | Trigger not in the policy's covered set.       |
| `PolicyNotActive`           | 23   | Policy not in `Active` state.                  |
| `Unauthorized`              | 24   | Caller is not the holder.                      |
| `VaultInsolvent`            | 25   | Vault cannot cover the payout / withdrawal.    |
| `AttestationNotActive`      | 26   | Backing attestation is slashed/challenged.     |
| `InsufficientStakedBalance` | 27   | Unstake exceeds the LP position.               |
| `BadConfig`                 | 28   | Misconfiguration (e.g. `premium_bps > 10000`). |
| `ZeroAmount`                | 29   | Zero coverage / stake / unstake amount.        |

## CEP-18 tokens (`tokens.rs`)

Both wrap the audited `odra_modules` `Cep18` submodule and re-expose the standard CEP-18 entry
points (`name`, `symbol`, `decimals`, `total_supply`, `balance_of`, `allowance`, `approve`,
`transfer`, `transfer_from`) so they can be called cross-contract via `Cep18ContractRef`. The
deployer receives `initial_supply` at `init` and distributes it (see `scripts/seed-demo.ts`).

| Token        | Symbol  | Decimals | Used for                                                      |
| ------------ | ------- | -------- | ------------------------------------------------------------- |
| `StakeToken` | `STAKE` | 9        | Attestation stake + challenge bonds in the registry.          |
| `MockUsdc`   | `USDC`  | 6        | Insurance premiums, vault capital, LP staking, claim payouts. |

## The U256 stake / USDC decision

Stake, bonds, coverage, premiums, and payouts are all **`U256` amounts moved through CEP-18
tokens** — not native CSPR attached value. Two consequences:

- **Why CEP-18, not native CSPR `attached_value`.** Using CEP-18 STAKE for stake/bond and CEP-18
  USDC for insurance keeps the asset (the thing at risk / the thing paid out) cleanly separate
  from CSPR (which pays gas). It also lets the registry and insurance vault _hold_ and _move_
  balances with `transfer` / `transfer_from`, and lets the same token be read cross-contract.
  The flow is: caller `approve`s the contract, then the contract `transfer_from`s into itself to
  lock funds, and `transfer`s on refund/payout/slash. See ADR
  [`0001`](./adr/0001-oracle-first-pivot.md) and [`0004`](./adr/0004-odra-storage-model.md).
- **Why `U256` (the registry/insurance amounts) vs `U512` (native CSPR motes).** CEP-18 balances
  are `U256`; native CSPR motes are `U512`. Because all value here flows through CEP-18 tokens,
  the registry and insurance use `U256` end-to-end (config, stored amounts, events, math). The
  data-model docs that describe native motes use `U512`; the on-chain contract uses `U256`
  because the asset is a CEP-18 token.

`StakeToken` uses 9 decimals; `MockUsdc` uses 6 (like real USDC). The default attestation stake
is `2000000000` (2 STAKE at 9 decimals), above the mock registry minimum.

## RFC 7807 error mapping (`contracts/problem`)

Every HTTP/MCP surface returns the same `application/problem+json` body for a given failure. The
crate maps each `CasperProofError` variant to a stable `code`, a `type` URI under
`https://casperproof.com/problems/<slug>`, an HTTP status, and a title/detail. This is the single
source of truth so on-chain error codes, the SDK, and the services never drift.

| Variant                | Code                     | HTTP | Maps from                                                 |
| ---------------------- | ------------------------ | ---- | --------------------------------------------------------- |
| `AttestationNotFound`  | `ATTESTATION_NOT_FOUND`  | 404  | registry `NotFound`                                       |
| `InsufficientStake`    | `INSUFFICIENT_STAKE`     | 422  | registry `InsufficientStake`                              |
| `DisputeWindowClosed`  | `DISPUTE_WINDOW_CLOSED`  | 409  | registry `WindowClosed`                                   |
| `AlreadyChallenged`    | `ALREADY_CHALLENGED`     | 409  | registry `AlreadyChallenged`                              |
| `Unauthorized`         | `UNAUTHORIZED`           | 403  | registry/insurance `Unauthorized`                         |
| `AttestationNotActive` | `ATTESTATION_NOT_ACTIVE` | 409  | registry `NotActive` / insurance `AttestationNotActive`   |
| `TamperedPayload`      | `TAMPERED_PAYLOAD`       | 422  | off-chain verification FAIL (`valid: false`, both hashes) |
| `PayloadUnavailable`   | `PAYLOAD_UNAVAILABLE`    | 502  | payload missing from the object store                     |
| `PolicyNotFound`       | `POLICY_NOT_FOUND`       | 404  | insurance `PolicyNotFound`                                |
| `PolicyExpired`        | `POLICY_EXPIRED`         | 409  | insurance `PolicyExpired`                                 |
| `TriggerNotCovered`    | `TRIGGER_NOT_COVERED`    | 422  | insurance `TriggerNotCovered`                             |
| `VaultInsolvent`       | `VAULT_INSOLVENT`        | 409  | insurance `VaultInsolvent`                                |
| `PaymentRequired`      | `PAYMENT_REQUIRED`       | 402  | x402 gate (price + pay-to)                                |
| `Internal`             | `INTERNAL_ERROR`         | 500  | catch-all; the cause is never serialized to clients       |

Example body (`AttestationNotFound { id: 42 }`):

```json
{
  "type": "https://casperproof.com/problems/attestation-not-found",
  "status": 404,
  "code": "ATTESTATION_NOT_FOUND",
  "title": "Attestation not found",
  "detail": "No attestation exists with id 42.",
  "attestation_id": 42
}
```

See ADR [`0006`](./adr/0006-rfc7807-errors.md) for why RFC 7807.

## Deployed addresses

`make deploy-testnet` writes the package hashes into `.env.local`. Until a real testnet deploy is
run with the required secrets, the deploy script emits **deterministic mock placeholder hashes**
(`hash-<blake2b256("casperproof:<network>:<name>")>`) so the rest of the stack boots. Replace the
placeholders below with the real values after a live deploy — see
[`../SETUP_NEEDED.md`](../SETUP_NEEDED.md).

| Contract              | Env var                     | Package hash                |
| --------------------- | --------------------------- | --------------------------- |
| `AttestationRegistry` | `ATTESTATION_REGISTRY_HASH` | `TBD — see SETUP_NEEDED.md` |
| `Insurance`           | `INSURANCE_HASH`            | `TBD — see SETUP_NEEDED.md` |
| `StakeToken`          | `STAKE_TOKEN_HASH`          | `TBD — see SETUP_NEEDED.md` |
| `MockUsdc`            | `USDC_TOKEN_HASH`           | `TBD — see SETUP_NEEDED.md` |

On-chain demo transactions (CSPR.live deploy links — `submit_attestation`, `claim`, slash
`resolve`): `TBD — see SETUP_NEEDED.md`. Explorer base: https://testnet.cspr.live.

## Documentation generation (rustdoc)

Generate the Rust API docs (does not require a deploy; not run as part of the docs build):

```bash
cargo doc -p casperproof-contracts --no-deps
```

The TypeScript API docs are generated separately with TypeDoc — see [`API.md`](./API.md).
