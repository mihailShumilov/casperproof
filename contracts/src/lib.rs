//! CasperProof Odra contracts.
//!
//! - [`commitment`] — shared on-chain commitment types (the trust anchor, §8).
//! - [`attestation_registry`] — the core verifiable-oracle contract.
//! - [`insurance`] — parametric agent insurance (policy / vault / staking / claim).
//! - [`tokens`] — CEP-18 STAKE token + mock USDC.
//!
//! `cargo odra build` compiles each contract to wasm in its own no_std environment;
//! `cargo test` / `cargo odra test` run the modules natively against the MockVM.

pub mod attestation_registry;
pub mod commitment;
pub mod insurance;
pub mod tokens;

pub use attestation_registry::{
    AttestationRegistry, AttestationSubmitted, Challenged, Finalized, Resolved,
};
pub use commitment::{Attestation, AttestationStatus, Hash, RegistryConfig, Reputation};
pub use insurance::{Insurance, Policy, PolicyStatus};
pub use tokens::{MockUsdc, StakeToken};
