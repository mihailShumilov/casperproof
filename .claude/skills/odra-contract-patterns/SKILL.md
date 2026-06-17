---
name: odra-contract-patterns
description: Verified Odra 2.8.1 idioms for CasperProof — module/storage/events/payable, the MockVM test env, the nightly toolchain requirement, cargo odra build/test, and the concrete gotchas hit while building this repo.
---

# Odra contract patterns (verified on Odra 2.8.1)

These patterns are **verified to compile and test** in this repo. Pull current syntax from
`https://odra.dev/docs` (`llms.txt` supported) when in doubt, but prefer what's here.

## Toolchain (critical)

- Odra's proc-macros use unstable `box_patterns` → **nightly required**. This repo pins
  `nightly-2026-01-01` in `rust-toolchain.toml` (ships rustfmt, clippy, wasm32 std).
- `cargo test` / `cargo odra test` run modules natively against the **MockVM** (fast, no wasm).
- `cargo odra build` compiles each contract to wasm via the `bin/build_contract.rs` harness.
- GitHub is unreachable in the sandbox, so `cargo odra new` (fetches a template) won't run
  offline — the project is already scaffolded; just edit `src/` and `Odra.toml`.

## Module + storage

```rust
use odra::prelude::*;            // Address, Var, Mapping, SubModule, String, Vec, format, ...
use odra::casper_types::U512;    // U512/U256 are NOT in prelude

#[odra::module(events = [Submitted])]
pub struct Registry {
    count: Var<u64>,
    items: Mapping<u64, Attestation>,
    reputation: Mapping<Address, Reputation>,
    config: Var<RegistryConfig>,
    token: SubModule<Cep18>,      // composing the CEP-18 module
}

#[odra::module]
impl Registry {
    pub fn init(&mut self, min_stake: U512, /* ... */) { self.count.set(0); /* ... */ }
    pub fn submit(&mut self, /* ... */) -> u64 { /* ... */ }
    pub fn get(&self, id: u64) -> Attestation {
        self.items.get(&id).unwrap_or_revert_with(self, Error::NotFound)
    }
}
```

- `Var<T>`: `.get()`/`.get_or_default()`/`.set(v)`. `Mapping<K,V>`: `.get(&k)`/`.set(&k,v)`.
- `self.env()` → `ContractEnv` (caller, block time, transferred value, emit_event, revert).
- `self.env().caller()`, `self.env().get_block_time()`, `self.env().self_address()`.

## Types & events

```rust
#[odra::odra_type]                 // already derives Clone/PartialEq/Eq/serde-ish — do NOT
pub struct Attestation { /* ... */ } //   add #[derive(PartialEq, Eq)] (E0119 conflict).

#[odra::event]
pub struct AttestationSubmitted { pub id: u64, pub attestor: Address, pub stake: U512 }

self.env().emit_event(AttestationSubmitted { id, attestor, stake });
```

`[u8; 32]` works as an `odra_type` field (CLType::ByteArray(32)). `Option<Address>` is fine.

## Errors (revert)

```rust
#[odra::odra_error]
pub enum Error { NotFound = 1, InsufficientStake = 2, WindowClosed = 3,
                 AlreadyChallenged = 4, Unauthorized = 5, NotActive = 6, AlreadyResolved = 7 }

self.env().revert(Error::Unauthorized)        // or .unwrap_or_revert_with(self, Error::NotFound)
```

## Payable (attached value) + CEP-18 stake

Two valid stake models — this repo uses **CEP-18 `transfer_from`** for STAKE/USDC (testnet
stablecoin) and CSPR for gas. For native CSPR attachment use
`self.env().attached_value()` in a `#[odra::module]` method marked payable via the call.
For CEP-18: the registry calls `token.transfer_from(caller, self_address, amount)` (requires
prior allowance) to lock stake; refunds via `token.transfer(to, amount)`.

## CEP-18 module

```rust
use odra_modules::cep18_token::Cep18;        // the bundled fungible-token module
// expose as a contract by wrapping in your own module, or deploy Cep18 directly.
```

## MockVM tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, HostRef, NoArgs};

    #[test]
    fn submit_and_get() {
        let env = odra_test::env();
        let mut reg = Registry::deploy(&env, RegistryInitArgs { /* ... */ });
        env.set_caller(env.get_account(0));
        // env.advance_block_time(secs) to test the dispute window;
        // assert_eq!(reg.try_get(id).map_err(..), Err(Error::NotFound)) for revert paths.
    }
}
```

- `Module::deploy(&env, InitArgs)` returns a `HostRef`; call methods directly.
- `try_<method>()` variants return `OdraResult` for asserting reverts.
- `env.advance_block_time(ms)`, `env.set_caller(addr)`, `env.get_account(n)`, `env.emitted_event`.
- Coverage: `cargo odra test` then `cargo tarpaulin` (or grcov) for line coverage.
