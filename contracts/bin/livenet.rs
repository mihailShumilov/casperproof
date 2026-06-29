//! CasperProof — Odra **livenet** deploy + demo-seed binary.
//!
//! Deploys the four CasperProof contracts to a real Casper network (testnet by default) using
//! Odra's native livenet environment (`odra_casper_livenet_env`), then optionally drives the
//! on-chain demo arc (attest → buy policy → claim payout → tamper-attest → challenge → slash).
//!
//! Odra's livenet env handles deploy construction, signing, submission, and package-hash
//! capture — the same `Deployer`/`HostRef`/`InitArgs` API the MockVM tests use, so this binary
//! mirrors `tests/registry_tests.rs` exactly. The TypeScript `scripts/deploy-testnet.ts` (live
//! branch) spawns this binary and parses the `CP_RESULT <KEY>=<VALUE>` lines into `.env.local`.
//!
//! This target is gated behind the `livenet` feature and is **never** compiled to wasm
//! (`cargo odra build` builds the contracts only). Build/run on a machine with network + a
//! funded key:
//!
//! ```bash
//! ODRA_CASPER_LIVENET_SECRET_KEY_PATH=/path/secret_key.pem \
//! ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.cspr.cloud \
//! ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test \
//! ODRA_CASPER_LIVENET_EVENTS_URL=https://node.testnet.cspr.cloud/events \
//! CSPR_CLOUD_AUTH_TOKEN=<token> \
//! cargo run --bin livenet --features livenet
//! ```
//!
//! All demo parameters are configurable via `CP_*` env vars (see the helpers below); defaults
//! produce a complete, self-consistent run from a single funded account.

use std::str::FromStr;

use odra::casper_types::U256;
use odra::host::Deployer;
use odra::prelude::*;

use casperproof_contracts::attestation_registry::{
    AttestationRegistry, AttestationRegistryInitArgs,
};
use casperproof_contracts::insurance::{Insurance, InsuranceInitArgs};
use casperproof_contracts::tokens::{
    MockUsdc, MockUsdcInitArgs, StakeToken, StakeTokenInitArgs,
};

// ── env helpers ──────────────────────────────────────────────────────────────

/// Read a non-empty env var or fall back to `default`.
fn env_str(key: &str, default: &str) -> String {
    std::env::var(key)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| default.to_string())
}

/// Read a decimal `U256` amount (stringified base units) or fall back to `default`.
fn env_u256(key: &str, default: &str) -> U256 {
    U256::from_dec_str(&env_str(key, default))
        .unwrap_or_else(|_| panic!("CP env `{key}` must be a base-10 integer"))
}

/// Read a `u64` or fall back to `default`.
fn env_u64(key: &str, default: u64) -> u64 {
    env_str(key, &default.to_string())
        .parse()
        .unwrap_or_else(|_| panic!("CP env `{key}` must be a u64"))
}

/// Read a 32-byte hash from a hex env var (`0x`-prefix optional), or synthesize a deterministic
/// `[fill; 32]` placeholder. `scripts/deploy-testnet.ts` passes the real §8 hashes (computed by
/// `@casperproof/commitment`, the single canonical implementation) so the on-chain `output_hash`
/// matches what the off-chain verifier recomputes; the fallback keeps the binary runnable alone.
fn env_hash(key: &str, fill: u8) -> [u8; 32] {
    match std::env::var(key).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        Some(h) => {
            let bytes = hex::decode(h.trim_start_matches("0x")).expect("CP hash env must be hex");
            assert_eq!(bytes.len(), 32, "CP hash env `{key}` must be 32 bytes");
            let mut out = [0u8; 32];
            out.copy_from_slice(&bytes);
            out
        }
        None => [fill; 32],
    }
}

/// Read an `Address` (`hash-…`) from an env var, or fall back to `default` (the deployer).
fn env_addr(key: &str, default: Address) -> Address {
    match std::env::var(key).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        Some(s) => Address::from_str(&s).expect("CP address env must be a valid `hash-…` address"),
        None => default,
    }
}

/// Emit a machine-parseable result line consumed by `scripts/deploy-testnet.ts`.
fn result(key: &str, value: &str) {
    println!("CP_RESULT {key}={value}");
}

/// Emit a banner before a headline on-chain transaction, so the operator (and the TS wrapper)
/// can associate the deploy hash Odra logs with the demo step it belongs to.
fn step(name: &str) {
    println!("\n>>> CP_STEP {name}");
}

// ── main ─────────────────────────────────────────────────────────────────────

fn main() {
    // Surface odra's `log::error!` deploy diagnostics (real RPC/node errors are otherwise
    // swallowed into a generic ContractDeploymentError). Defaults to `info` if RUST_LOG unset.
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .try_init()
        .ok();

    let env = odra_casper_livenet_env::env();

    // Gas budgets (motes). Deploys install wasm and cost more than entry-point calls.
    let deploy_gas = env_u64("CP_DEPLOY_GAS", 400_000_000_000);
    let call_gas = env_u64("CP_CALL_GAS", 20_000_000_000);
    // `deploy` = install the 4 contracts only; `all` = also run the demo arc.
    let step_mode = env_str("CP_LIVENET_STEP", "all");

    let deployer = env.caller();
    result("DEPLOYER", &deployer.to_string());
    result("NETWORK", &env_str("ODRA_CASPER_LIVENET_CHAIN_NAME", "casper-test"));

    // ── 1. CEP-18 tokens (deployer receives the full initial supply) ───────────
    let stake_supply = env_u256("CP_STAKE_SUPPLY", "1000000000000000"); // 1e6 STAKE @ 9 decimals
    let usdc_supply = env_u256("CP_USDC_SUPPLY", "1000000000000"); // 1e6 USDC @ 6 decimals

    env.set_gas(deploy_gas);
    let mut stake = StakeToken::deploy(&env, StakeTokenInitArgs { initial_supply: stake_supply });
    result("STAKE_TOKEN_HASH", &stake.address().to_string());

    env.set_gas(deploy_gas);
    let mut usdc = MockUsdc::deploy(&env, MockUsdcInitArgs { initial_supply: usdc_supply });
    result("USDC_TOKEN_HASH", &usdc.address().to_string());

    // ── 2. Registry + Insurance ────────────────────────────────────────────────
    let min_stake = env_u256("CP_MIN_STAKE", "1000000000"); // 1 STAKE
    let challenge_bond = env_u256("CP_CHALLENGE_BOND", "1000000000"); // 1 STAKE
    let dispute_window = env_u64("CP_DISPUTE_WINDOW", 86_400); // 24h (seconds)
    let reward_bps = env_u64("CP_REWARD_BPS", 5_000); // 50% challenger / 50% treasury
    let treasury = env_addr("CP_TREASURY", deployer);
    let resolver = env_addr("CP_RESOLVER", deployer);

    env.set_gas(deploy_gas);
    let mut registry = AttestationRegistry::deploy(
        &env,
        AttestationRegistryInitArgs {
            stake_token: stake.address(),
            min_stake,
            challenge_bond,
            dispute_window,
            treasury,
            resolver,
            reward_bps,
        },
    );
    result("ATTESTATION_REGISTRY_HASH", &registry.address().to_string());

    let premium_bps = env_u64("CP_PREMIUM_BPS", 500); // 5%
    let claim_model_id = env_str("CP_CLAIM_MODEL_ID", "casperproof-claimoracle-v1");

    env.set_gas(deploy_gas);
    let mut insurance = Insurance::deploy(
        &env,
        InsuranceInitArgs {
            usdc_token: usdc.address(),
            registry: registry.address(),
            premium_bps,
            claim_model_id: claim_model_id.clone(),
        },
    );
    result("INSURANCE_HASH", &insurance.address().to_string());

    if step_mode == "deploy" {
        println!("\nCP_RESULT MODE=deploy-only");
        return;
    }

    // ── 3. Allowances + vault capital ──────────────────────────────────────────
    // The registry pulls STAKE (stake + bond) and insurance pulls USDC (premium + LP capital)
    // via CEP-18 `transfer_from`, so the deployer must approve both up front.
    let approve_amount = env_u256("CP_APPROVE_AMOUNT", "1000000000000000");
    env.set_gas(call_gas);
    stake.approve(&registry.address(), &approve_amount);
    env.set_gas(call_gas);
    usdc.approve(&insurance.address(), &approve_amount);

    // Seed the vault so a claim can pay coverage in full.
    let coverage = env_u256("CP_COVERAGE", "5000000"); // 5 USDC
    let vault_capital = env_u256("CP_VAULT_CAPITAL", "20000000"); // 20 USDC
    env.set_gas(call_gas);
    insurance.stake(vault_capital);

    // ── 4. Headline risk attestation (tx #1: submit_attestation) ───────────────
    let risk_model_id = env_str("CP_RISK_MODEL_ID", "casperproof-riskscorer-v1");
    step("submit_attestation");
    env.set_gas(call_gas);
    let risk_id = registry.submit_attestation(
        risk_model_id.clone(),
        env_hash("CP_RISK_INPUT_HASH", 1),
        env_hash("CP_RISK_OUTPUT_HASH", 2),
        env_hash("CP_RISK_COMMITMENT", 3),
        env_str("CP_RISK_URI", "s3://casperproof-payloads/demo-risk"),
        min_stake,
    );
    result("ATT_RISK_ID", &risk_id.to_string());

    // ── 5. Claim-oracle attestation backing the policy claim ───────────────────
    // Its model_id MUST equal the insurance `claim_model_id`, else `claim` reverts Unauthorized.
    let trigger = env_str("CP_TRIGGER", "oracle_failure");
    env.set_gas(call_gas);
    let claim_att_id = registry.submit_attestation(
        claim_model_id.clone(),
        env_hash("CP_CLAIM_INPUT_HASH", 4),
        env_hash("CP_CLAIM_OUTPUT_HASH", 5),
        env_hash("CP_CLAIM_COMMITMENT", 6),
        env_str("CP_CLAIM_URI", "s3://casperproof-payloads/demo-claim"),
        min_stake,
    );
    result("ATT_CLAIM_ID", &claim_att_id.to_string());

    // ── 6. Buy a policy + claim payout (tx #2: claim) ──────────────────────────
    let expiry = env_u64("CP_POLICY_EXPIRY", 4_102_444_800); // 2100-01-01
    env.set_gas(call_gas);
    let policy_id = insurance.buy_policy(coverage, vec![trigger.clone()], expiry);
    result("POLICY_ID", &policy_id.to_string());

    step("claim");
    env.set_gas(call_gas);
    insurance.claim(policy_id, claim_att_id, trigger);

    // ── 7. Tamper-attestation → challenge → slash (tx #3: resolve) ─────────────
    env.set_gas(call_gas);
    let slash_id = registry.submit_attestation(
        risk_model_id,
        env_hash("CP_SLASH_INPUT_HASH", 7),
        env_hash("CP_SLASH_OUTPUT_HASH", 8),
        env_hash("CP_SLASH_COMMITMENT", 9),
        env_str("CP_SLASH_URI", "s3://casperproof-payloads/demo-slash"),
        min_stake,
    );
    result("ATT_SLASH_ID", &slash_id.to_string());

    env.set_gas(call_gas);
    registry.challenge(slash_id);

    step("resolve");
    env.set_gas(call_gas);
    registry.resolve(slash_id, true);

    println!("\nCP_RESULT MODE=full-demo-complete");
}
