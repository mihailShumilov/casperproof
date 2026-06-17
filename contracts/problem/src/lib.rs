//! # casperproof-problem
//!
//! RFC 7807 ([Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc7807))
//! mapping for the **CasperProof** error taxonomy, built on the [`rust-rfc7807`] crate.
//!
//! The CasperProof oracle and insurance contracts surface a fixed set of errors
//! (`NotFound`, `InsufficientStake`, `WindowClosed`, `AlreadyChallenged`,
//! `Unauthorized`, …) plus off-chain verification outcomes (tampered / unavailable
//! payloads) and the x402 `402 Payment Required` challenge. Every HTTP surface in the
//! repo — the x402 resource server and the MCP server — returns the **same**
//! `application/problem+json` body for a given failure. This crate is the single Rust
//! source of truth for that mapping so the on-chain error codes, the SDK, and the
//! services never drift.
//!
//! ```
//! use casperproof_problem::{CasperProofError, to_problem_json};
//!
//! let body = to_problem_json(&CasperProofError::AttestationNotFound { id: 42 });
//! assert!(body.contains("\"status\":404"));
//! assert!(body.contains("ATTESTATION_NOT_FOUND"));
//! assert!(body.contains("https://casperproof.com/problems/attestation-not-found"));
//! ```

use rust_rfc7807::{IntoProblem, Problem};
use serde::{Deserialize, Serialize};

pub use rust_rfc7807::APPLICATION_PROBLEM_JSON;

/// Base URI namespace for every CasperProof problem `type`.
pub const PROBLEM_BASE: &str = "https://casperproof.com/problems/";

/// Build the canonical problem `type` URI for a slug.
fn type_uri(slug: &str) -> String {
    format!("{PROBLEM_BASE}{slug}")
}

/// The complete CasperProof failure taxonomy surfaced over HTTP / MCP.
///
/// Mirrors the on-chain contract errors (`§8`) plus off-chain verification outcomes
/// and the x402 payment challenge. Each variant maps deterministically to a single
/// RFC 7807 [`Problem`] via [`IntoProblem`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CasperProofError {
    // ── AttestationRegistry (oracle) ────────────────────────────────────────
    /// No attestation exists for the given id (`NotFound`).
    AttestationNotFound { id: u64 },
    /// Attached stake is below the configured minimum (`InsufficientStake`).
    InsufficientStake { required: String, provided: String },
    /// The dispute window has elapsed; the attestation can no longer be challenged
    /// (`WindowClosed`).
    DisputeWindowClosed { id: u64 },
    /// The attestation is already under challenge (`AlreadyChallenged`).
    AlreadyChallenged { id: u64 },
    /// Caller is not permitted to perform the action (`Unauthorized`).
    Unauthorized { action: String },
    /// The attestation is not in an `Active` state (e.g. already slashed / finalized).
    AttestationNotActive { id: u64, status: String },

    // ── Off-chain verification (verifier / x402 POST /verify) ────────────────
    /// Recomputed `output_hash` does not match the on-chain commitment — the payload
    /// was tampered with. This is a verification **FAIL**.
    TamperedPayload {
        id: u64,
        onchain_hash: String,
        recomputed_hash: String,
    },
    /// The off-chain payload could not be fetched from the S3-compatible store.
    PayloadUnavailable { uri: String },

    // ── Insurance ────────────────────────────────────────────────────────────
    /// No policy exists for the given id.
    PolicyNotFound { id: u64 },
    /// The policy has expired and cannot be claimed against.
    PolicyExpired { id: u64 },
    /// The claim's trigger type is not covered by the policy.
    TriggerNotCovered { policy_id: u64, trigger: String },
    /// The vault cannot cover the payout without breaching its solvency guard.
    VaultInsolvent { required: String, available: String },

    // ── x402 facilitator ──────────────────────────────────────────────────────
    /// The resource is gated; an x402 micropayment is required before access.
    PaymentRequired { price_usd: String, pay_to: String },

    // ── Catch-all ──────────────────────────────────────────────────────────────
    /// An unexpected internal error. The `detail` is attached as an internal cause and
    /// is **never** serialized to clients (see `rust-rfc7807` security note).
    Internal { detail: String },
}

impl CasperProofError {
    /// Machine-readable error code (stable across the SDK, contracts, and services).
    pub fn code(&self) -> &'static str {
        match self {
            CasperProofError::AttestationNotFound { .. } => "ATTESTATION_NOT_FOUND",
            CasperProofError::InsufficientStake { .. } => "INSUFFICIENT_STAKE",
            CasperProofError::DisputeWindowClosed { .. } => "DISPUTE_WINDOW_CLOSED",
            CasperProofError::AlreadyChallenged { .. } => "ALREADY_CHALLENGED",
            CasperProofError::Unauthorized { .. } => "UNAUTHORIZED",
            CasperProofError::AttestationNotActive { .. } => "ATTESTATION_NOT_ACTIVE",
            CasperProofError::TamperedPayload { .. } => "TAMPERED_PAYLOAD",
            CasperProofError::PayloadUnavailable { .. } => "PAYLOAD_UNAVAILABLE",
            CasperProofError::PolicyNotFound { .. } => "POLICY_NOT_FOUND",
            CasperProofError::PolicyExpired { .. } => "POLICY_EXPIRED",
            CasperProofError::TriggerNotCovered { .. } => "TRIGGER_NOT_COVERED",
            CasperProofError::VaultInsolvent { .. } => "VAULT_INSOLVENT",
            CasperProofError::PaymentRequired { .. } => "PAYMENT_REQUIRED",
            CasperProofError::Internal { .. } => "INTERNAL_ERROR",
        }
    }

    /// URL slug used in the problem `type` URI.
    fn slug(&self) -> &'static str {
        match self {
            CasperProofError::AttestationNotFound { .. } => "attestation-not-found",
            CasperProofError::InsufficientStake { .. } => "insufficient-stake",
            CasperProofError::DisputeWindowClosed { .. } => "dispute-window-closed",
            CasperProofError::AlreadyChallenged { .. } => "already-challenged",
            CasperProofError::Unauthorized { .. } => "unauthorized",
            CasperProofError::AttestationNotActive { .. } => "attestation-not-active",
            CasperProofError::TamperedPayload { .. } => "tampered-payload",
            CasperProofError::PayloadUnavailable { .. } => "payload-unavailable",
            CasperProofError::PolicyNotFound { .. } => "policy-not-found",
            CasperProofError::PolicyExpired { .. } => "policy-expired",
            CasperProofError::TriggerNotCovered { .. } => "trigger-not-covered",
            CasperProofError::VaultInsolvent { .. } => "vault-insolvent",
            CasperProofError::PaymentRequired { .. } => "payment-required",
            CasperProofError::Internal { .. } => "internal-error",
        }
    }

    /// HTTP status code for this error.
    pub fn status(&self) -> u16 {
        match self {
            CasperProofError::AttestationNotFound { .. }
            | CasperProofError::PolicyNotFound { .. } => 404,
            CasperProofError::InsufficientStake { .. }
            | CasperProofError::TamperedPayload { .. }
            | CasperProofError::TriggerNotCovered { .. } => 422,
            CasperProofError::DisputeWindowClosed { .. }
            | CasperProofError::AlreadyChallenged { .. }
            | CasperProofError::AttestationNotActive { .. }
            | CasperProofError::PolicyExpired { .. }
            | CasperProofError::VaultInsolvent { .. } => 409,
            CasperProofError::Unauthorized { .. } => 403,
            CasperProofError::PayloadUnavailable { .. } => 502,
            CasperProofError::PaymentRequired { .. } => 402,
            CasperProofError::Internal { .. } => 500,
        }
    }
}

impl IntoProblem for CasperProofError {
    fn into_problem(self) -> Problem {
        let slug = self.slug();
        let code = self.code();
        let status = self.status();
        let base = Problem::new(status)
            .type_(type_uri(slug))
            .code(code);

        match self {
            CasperProofError::AttestationNotFound { id } => base
                .title("Attestation not found")
                .detail(format!("No attestation exists with id {id}."))
                .extension("attestation_id", id),
            CasperProofError::InsufficientStake { required, provided } => base
                .title("Insufficient stake")
                .detail(format!(
                    "Attached stake {provided} is below the required minimum {required}."
                ))
                .extension("required_stake", required)
                .extension("provided_stake", provided),
            CasperProofError::DisputeWindowClosed { id } => base
                .title("Dispute window closed")
                .detail(format!(
                    "The dispute window for attestation {id} has elapsed; it can no longer be challenged."
                ))
                .extension("attestation_id", id),
            CasperProofError::AlreadyChallenged { id } => base
                .title("Attestation already challenged")
                .detail(format!("Attestation {id} is already under challenge."))
                .extension("attestation_id", id),
            CasperProofError::Unauthorized { action } => base
                .title("Unauthorized")
                .detail(format!("Caller is not permitted to perform action `{action}`."))
                .extension("action", action),
            CasperProofError::AttestationNotActive { id, status: st } => base
                .title("Attestation not active")
                .detail(format!(
                    "Attestation {id} is in state `{st}` and cannot be acted upon."
                ))
                .extension("attestation_id", id)
                .extension("attestation_status", st),
            CasperProofError::TamperedPayload {
                id,
                onchain_hash,
                recomputed_hash,
            } => base
                .title("Tampered payload — verification failed")
                .detail(
                    "The recomputed output hash does not match the on-chain commitment. \
                     The off-chain payload has been altered.",
                )
                .extension("attestation_id", id)
                .extension("onchain_hash", onchain_hash)
                .extension("recomputed_hash", recomputed_hash)
                .extension("valid", false),
            CasperProofError::PayloadUnavailable { uri } => base
                .title("Payload unavailable")
                .detail("The off-chain payload could not be fetched from the object store.")
                .extension("uri", uri),
            CasperProofError::PolicyNotFound { id } => base
                .title("Policy not found")
                .detail(format!("No insurance policy exists with id {id}."))
                .extension("policy_id", id),
            CasperProofError::PolicyExpired { id } => base
                .title("Policy expired")
                .detail(format!("Policy {id} has expired and cannot be claimed against."))
                .extension("policy_id", id),
            CasperProofError::TriggerNotCovered { policy_id, trigger } => base
                .title("Trigger not covered")
                .detail(format!(
                    "Trigger `{trigger}` is not covered by policy {policy_id}."
                ))
                .extension("policy_id", policy_id)
                .extension("trigger", trigger),
            CasperProofError::VaultInsolvent { required, available } => base
                .title("Vault insolvent")
                .detail(format!(
                    "Vault cannot cover payout of {required}; only {available} is available \
                     above the solvency guard."
                ))
                .extension("required", required)
                .extension("available", available),
            CasperProofError::PaymentRequired { price_usd, pay_to } => base
                .title("Payment required")
                .detail(format!(
                    "This resource is x402-gated. Pay {price_usd} USD to `{pay_to}` then retry \
                     with an X-PAYMENT header."
                ))
                .extension("price_usd", price_usd)
                .extension("pay_to", pay_to),
            CasperProofError::Internal { detail } => base
                .title("Internal error")
                .with_cause(std::io::Error::other(detail)),
        }
    }
}

/// Convert a [`CasperProofError`] into its RFC 7807 `application/problem+json` body.
pub fn to_problem_json(err: &CasperProofError) -> String {
    let problem = err.clone().into_problem();
    serde_json::to_string(&problem).expect("Problem serializes to JSON")
}

/// Convert a [`CasperProofError`] into a [`Problem`] for framework integration.
pub fn to_problem(err: &CasperProofError) -> Problem {
    err.clone().into_problem()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn json(err: CasperProofError) -> Value {
        serde_json::from_str(&to_problem_json(&err)).unwrap()
    }

    #[test]
    fn not_found_maps_to_404_with_type_and_code() {
        let v = json(CasperProofError::AttestationNotFound { id: 7 });
        assert_eq!(v["status"], 404);
        assert_eq!(v["code"], "ATTESTATION_NOT_FOUND");
        assert_eq!(v["type"], "https://casperproof.com/problems/attestation-not-found");
        assert_eq!(v["attestation_id"], 7);
        assert_eq!(v["title"], "Attestation not found");
    }

    #[test]
    fn insufficient_stake_is_422_and_carries_amounts() {
        let v = json(CasperProofError::InsufficientStake {
            required: "1000000000".into(),
            provided: "5".into(),
        });
        assert_eq!(v["status"], 422);
        assert_eq!(v["code"], "INSUFFICIENT_STAKE");
        assert_eq!(v["required_stake"], "1000000000");
        assert_eq!(v["provided_stake"], "5");
    }

    #[test]
    fn conflict_errors_are_409() {
        for err in [
            CasperProofError::DisputeWindowClosed { id: 1 },
            CasperProofError::AlreadyChallenged { id: 1 },
            CasperProofError::AttestationNotActive { id: 1, status: "Slashed".into() },
            CasperProofError::PolicyExpired { id: 1 },
            CasperProofError::VaultInsolvent { required: "9".into(), available: "1".into() },
        ] {
            assert_eq!(err.status(), 409, "{:?}", err);
            assert_eq!(json(err)["status"], 409);
        }
    }

    #[test]
    fn unauthorized_is_403() {
        let v = json(CasperProofError::Unauthorized { action: "resolve".into() });
        assert_eq!(v["status"], 403);
        assert_eq!(v["action"], "resolve");
    }

    #[test]
    fn tampered_payload_is_422_and_marks_invalid() {
        let v = json(CasperProofError::TamperedPayload {
            id: 3,
            onchain_hash: "aa".into(),
            recomputed_hash: "bb".into(),
        });
        assert_eq!(v["status"], 422);
        assert_eq!(v["code"], "TAMPERED_PAYLOAD");
        assert_eq!(v["valid"], false);
        assert_eq!(v["onchain_hash"], "aa");
        assert_eq!(v["recomputed_hash"], "bb");
    }

    #[test]
    fn payment_required_is_402() {
        let v = json(CasperProofError::PaymentRequired {
            price_usd: "0.01".into(),
            pay_to: "casperproof-treasury".into(),
        });
        assert_eq!(v["status"], 402);
        assert_eq!(v["price_usd"], "0.01");
        assert_eq!(v["pay_to"], "casperproof-treasury");
    }

    #[test]
    fn payload_unavailable_is_502() {
        assert_eq!(json(CasperProofError::PayloadUnavailable { uri: "s3://x".into() })["status"], 502);
    }

    #[test]
    fn internal_error_never_leaks_cause() {
        let body = to_problem_json(&CasperProofError::Internal {
            detail: "secret db:5432 connection string".into(),
        });
        assert!(!body.contains("db:5432"), "internal cause must not serialize");
        let v: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["status"], 500);
        assert_eq!(v["code"], "INTERNAL_ERROR");
    }

    #[test]
    fn every_variant_has_unique_code_and_slug() {
        let errs = [
            CasperProofError::AttestationNotFound { id: 1 },
            CasperProofError::InsufficientStake { required: "1".into(), provided: "0".into() },
            CasperProofError::DisputeWindowClosed { id: 1 },
            CasperProofError::AlreadyChallenged { id: 1 },
            CasperProofError::Unauthorized { action: "x".into() },
            CasperProofError::AttestationNotActive { id: 1, status: "Slashed".into() },
            CasperProofError::TamperedPayload { id: 1, onchain_hash: "a".into(), recomputed_hash: "b".into() },
            CasperProofError::PayloadUnavailable { uri: "u".into() },
            CasperProofError::PolicyNotFound { id: 1 },
            CasperProofError::PolicyExpired { id: 1 },
            CasperProofError::TriggerNotCovered { policy_id: 1, trigger: "t".into() },
            CasperProofError::VaultInsolvent { required: "1".into(), available: "0".into() },
            CasperProofError::PaymentRequired { price_usd: "0.01".into(), pay_to: "t".into() },
            CasperProofError::Internal { detail: "d".into() },
        ];
        let codes: std::collections::HashSet<_> = errs.iter().map(|e| e.code()).collect();
        let slugs: std::collections::HashSet<_> = errs.iter().map(|e| e.slug()).collect();
        assert_eq!(codes.len(), errs.len(), "codes must be unique");
        assert_eq!(slugs.len(), errs.len(), "slugs must be unique");
    }
}
