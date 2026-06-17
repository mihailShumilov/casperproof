# ADR 0004: Odra storage model — CEP-18 stake, U256 amounts, bytes-only registry

- Status: accepted
- Date: 2026

## Context

The contracts are written with [Odra](https://odra.dev) 2.8.1. Two design questions had to be
settled up front: how value (stake, bonds, premiums, payouts) is represented and moved, and what
the registry actually stores.

## Decision

**Value moves through CEP-18 tokens, not native CSPR attached value.**

- The registry locks a CEP-18 **STAKE** token; insurance uses CEP-18 **mock USDC**. Both wrap the
  audited `odra_modules::cep18_token::Cep18` submodule and re-expose the standard entry points so
  they're callable cross-contract via `Cep18ContractRef`.
- The lock pattern is `approve` (by the caller) then `transfer_from(caller, self, amount)` (by the
  contract); refunds/payouts/slashes use `transfer`. CSPR is used only for gas.
- Amounts are **`U256`** end-to-end (config, stored fields, events, math), because CEP-18 balances
  are `U256`. (Native CSPR motes would be `U512`; the contracts don't take native value, so they
  don't use `U512`.) STAKE has 9 decimals; mock USDC has 6.

**The registry is bytes-only.** It stores `Attestation` = hashes (`[u8; 32]`) + metadata + stake,
and **never recomputes hashes on-chain** — it compares the bytes the off-chain attestor produced.
Storage uses Odra `Var`/`Mapping`; the records are `#[odra::odra_type]` (which already derives the
equality/serde traits, so manual `#[derive(PartialEq, Eq)]` is omitted to avoid an E0119
conflict). `[u8; 32]` and `Option<Address>` are valid `odra_type` fields.

## Consequences

- The asset at risk / paid out is cleanly separated from gas, and the same token can be read and
  moved cross-contract — which is what makes the insurance → registry integration possible.
- On-chain compute stays minimal (compare 32 bytes), keeping the registry cheap and making the
  off-chain commitment package the single hashing implementation.
- Callers must `approve` before `submit_attestation` / `challenge` / `buy_policy` / `stake` —
  documented in the SDK and dApp flows.
- The `U256`/CEP-18 choice is the reason [`CONTRACTS.md`](../CONTRACTS.md) shows `U256` everywhere
  even though some data-model descriptions of native motes use `U512`.
