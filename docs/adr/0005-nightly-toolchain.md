# ADR 0005: Pinned nightly Rust toolchain

- Status: accepted
- Date: 2026

## Context

Odra's procedural macros (the `#[odra::module]` / `#[odra::odra_type]` / `#[odra::event]`
machinery) expand to code that uses the unstable `box_patterns` feature. That feature is only
available on **nightly** Rust. Builds must also be reproducible across contributors and CI, and
the WASM target (`wasm32`) plus `rustfmt` and `clippy` must be present.

## Decision

Pin a **specific nightly** in `rust-toolchain.toml`: `nightly-2026-01-01`, which ships `rustfmt`,
`clippy`, and the `wasm32` std component. Pinning (rather than tracking `nightly`) means every
machine and CI run resolves the same compiler, so a future nightly can't silently break the Odra
macro expansion.

`cargo test` / `cargo odra test` run modules natively against Odra's MockVM (fast, no WASM);
`cargo odra build` compiles each contract to WASM via the `bin/build_contract.rs` harness.

## Consequences

- Contributors need the pinned nightly; `rustup` installs it automatically from
  `rust-toolchain.toml`.
- Reproducible contract builds and a stable macro-expansion surface; toolchain upgrades are a
  deliberate, reviewed change to one file.
- `cargo odra new` (which fetches a template from GitHub) won't run offline in the sandbox — the
  project is already scaffolded, so this is a non-issue for normal development.
