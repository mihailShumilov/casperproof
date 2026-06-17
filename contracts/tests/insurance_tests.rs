//! Integration tests for `Insurance` (MockVM): buy_policy, claim (cross-contract read of the
//! registry), staking, and the solvency / authorization / trigger / expiry edge cases.

use casperproof_contracts::attestation_registry::{
    AttestationRegistry, AttestationRegistryHostRef, AttestationRegistryInitArgs,
};
use casperproof_contracts::insurance::{
    Error as InsError, Insurance, InsuranceHostRef, InsuranceInitArgs, PolicyStatus,
};
use casperproof_contracts::tokens::{
    MockUsdc, MockUsdcHostRef, MockUsdcInitArgs, StakeToken, StakeTokenInitArgs,
};
use odra::casper_types::U256;
use odra::host::{Deployer, HostEnv};
use odra::prelude::*;

const PREMIUM_BPS: u64 = 500; // 5%
const COVERAGE: u64 = 100_000;
const LP_CAPITAL: u64 = 300_000;
const WINDOW_SECS: u64 = 3_600;
const CLAIM_MODEL: &str = "casperproof-claimoracle-v1";
const TRIGGER: &str = "oracle_failure";
const FAR_FUTURE: u64 = 10_000_000_000;

struct Fixture {
    env: HostEnv,
    usdc: MockUsdcHostRef,
    registry: AttestationRegistryHostRef,
    insurance: InsuranceHostRef,
    holder: Address,
    lp: Address,
    oracle: Address,
    resolver: Address,
}

fn setup() -> Fixture {
    let env = odra_test::env();
    let deployer = env.get_account(0);
    let holder = env.get_account(1);
    let lp = env.get_account(2);
    let oracle = env.get_account(3);
    let resolver = env.get_account(4);

    env.set_caller(deployer);
    let mut usdc = MockUsdc::deploy(
        &env,
        MockUsdcInitArgs {
            initial_supply: U256::from(10_000_000u64),
        },
    );
    let mut stake = StakeToken::deploy(
        &env,
        StakeTokenInitArgs {
            initial_supply: U256::from(10_000_000u64),
        },
    );
    let registry = AttestationRegistry::deploy(
        &env,
        AttestationRegistryInitArgs {
            stake_token: stake.address(),
            min_stake: U256::from(1_000u64),
            challenge_bond: U256::from(500u64),
            dispute_window: WINDOW_SECS,
            treasury: deployer,
            resolver,
            reward_bps: 5_000,
        },
    );
    let insurance = Insurance::deploy(
        &env,
        InsuranceInitArgs {
            usdc_token: usdc.address(),
            registry: registry.address(),
            premium_bps: PREMIUM_BPS,
            claim_model_id: String::from(CLAIM_MODEL),
        },
    );

    // Fund holder (premium) + LP (capital) with USDC and let them approve the vault.
    env.set_caller(deployer);
    usdc.transfer(&holder, &U256::from(1_000_000u64));
    usdc.transfer(&lp, &U256::from(1_000_000u64));
    // Fund the oracle with STAKE so it can submit attestations.
    stake.transfer(&oracle, &U256::from(100_000u64));

    env.set_caller(holder);
    usdc.approve(&insurance.address(), &U256::from(1_000_000u64));
    env.set_caller(lp);
    usdc.approve(&insurance.address(), &U256::from(1_000_000u64));
    env.set_caller(oracle);
    stake.approve(&registry.address(), &U256::from(100_000u64));

    Fixture {
        env,
        usdc,
        registry,
        insurance,
        holder,
        lp,
        oracle,
        resolver,
    }
}

/// Oracle submits a claim attestation; returns its id.
fn attest_claim(f: &mut Fixture) -> u64 {
    f.env.set_caller(f.oracle);
    f.registry.submit_attestation(
        String::from(CLAIM_MODEL),
        [9u8; 32],
        [8u8; 32],
        [7u8; 32],
        String::from("s3://casperproof/claim"),
        U256::from(1_000u64),
    )
}

fn buy(f: &mut Fixture) -> u64 {
    f.env.set_caller(f.holder);
    f.insurance.buy_policy(
        U256::from(COVERAGE),
        vec![String::from(TRIGGER)],
        FAR_FUTURE,
    )
}

fn lp_stake(f: &mut Fixture, amount: u64) {
    f.env.set_caller(f.lp);
    f.insurance.stake(U256::from(amount));
}

#[test]
fn buy_policy_collects_premium_into_vault() {
    let mut f = setup();
    let holder_before = f.usdc.balance_of(&f.holder);
    let id = buy(&mut f);
    assert_eq!(id, 0);
    assert_eq!(f.insurance.policy_count(), 1);

    let policy = f.insurance.get_policy(id);
    let premium = COVERAGE * PREMIUM_BPS / 10_000;
    assert_eq!(policy.premium, U256::from(premium));
    assert_eq!(policy.coverage, U256::from(COVERAGE));
    assert_eq!(policy.status, PolicyStatus::Active);
    assert_eq!(
        f.usdc.balance_of(&f.holder),
        holder_before - U256::from(premium)
    );
    assert_eq!(f.insurance.vault_balance(), U256::from(premium));
}

#[test]
fn buy_policy_zero_coverage_reverts() {
    let mut f = setup();
    f.env.set_caller(f.holder);
    let res = f
        .insurance
        .try_buy_policy(U256::zero(), vec![String::from(TRIGGER)], FAR_FUTURE);
    assert_eq!(res, Err(InsError::ZeroAmount.into()));
}

#[test]
fn full_claim_pays_coverage_from_vault() {
    let mut f = setup();
    lp_stake(&mut f, LP_CAPITAL);
    let att = attest_claim(&mut f);
    let id = buy(&mut f);

    let holder_before = f.usdc.balance_of(&f.holder);
    let vault_before = f.insurance.vault_balance();

    f.env.set_caller(f.holder);
    f.insurance.claim(id, att, String::from(TRIGGER));

    assert_eq!(
        f.usdc.balance_of(&f.holder),
        holder_before + U256::from(COVERAGE)
    );
    assert_eq!(
        f.insurance.vault_balance(),
        vault_before - U256::from(COVERAGE)
    );
    assert_eq!(f.insurance.get_policy(id).status, PolicyStatus::Claimed);
}

#[test]
fn claim_with_uncovered_trigger_reverts() {
    let mut f = setup();
    lp_stake(&mut f, LP_CAPITAL);
    let att = attest_claim(&mut f);
    let id = buy(&mut f);
    f.env.set_caller(f.holder);
    let res = f
        .insurance
        .try_claim(id, att, String::from("governance_attack"));
    assert_eq!(res, Err(InsError::TriggerNotCovered.into()));
}

#[test]
fn claim_by_non_holder_reverts() {
    let mut f = setup();
    lp_stake(&mut f, LP_CAPITAL);
    let att = attest_claim(&mut f);
    let id = buy(&mut f);
    f.env.set_caller(f.lp);
    let res = f.insurance.try_claim(id, att, String::from(TRIGGER));
    assert_eq!(res, Err(InsError::Unauthorized.into()));
}

#[test]
fn claim_on_expired_policy_reverts() {
    let mut f = setup();
    lp_stake(&mut f, LP_CAPITAL);
    let att = attest_claim(&mut f);
    f.env.set_caller(f.holder);
    let id = f
        .insurance
        .buy_policy(U256::from(COVERAGE), vec![String::from(TRIGGER)], 1_000);
    f.env.advance_block_time(2_000);
    f.env.set_caller(f.holder);
    let res = f.insurance.try_claim(id, att, String::from(TRIGGER));
    assert_eq!(res, Err(InsError::PolicyExpired.into()));
}

#[test]
fn claim_backed_by_slashed_attestation_reverts() {
    let mut f = setup();
    lp_stake(&mut f, LP_CAPITAL);
    let att = attest_claim(&mut f);
    let id = buy(&mut f);

    // Slash the backing attestation. The oracle still has a STAKE allowance to the registry
    // from setup, so it can post the challenge bond; the resolver then rules it fraudulent.
    f.env.set_caller(f.oracle);
    f.registry.challenge(att);
    f.env.set_caller(f.resolver);
    f.registry.resolve(att, true);

    // A claim backed by a slashed attestation must be rejected.
    f.env.set_caller(f.holder);
    let res = f.insurance.try_claim(id, att, String::from(TRIGGER));
    assert_eq!(res, Err(InsError::AttestationNotActive.into()));
}

#[test]
fn claim_without_vault_capital_reverts_insolvent() {
    let mut f = setup();
    // No LP stake → vault holds only the premium, far below coverage.
    let att = attest_claim(&mut f);
    let id = buy(&mut f);
    f.env.set_caller(f.holder);
    let res = f.insurance.try_claim(id, att, String::from(TRIGGER));
    assert_eq!(res, Err(InsError::VaultInsolvent.into()));
}

#[test]
fn stake_and_unstake_update_positions_and_vault() {
    let mut f = setup();
    lp_stake(&mut f, LP_CAPITAL);
    assert_eq!(f.insurance.total_staked(), U256::from(LP_CAPITAL));
    assert_eq!(f.insurance.staked_of(f.lp), U256::from(LP_CAPITAL));
    assert_eq!(f.insurance.vault_balance(), U256::from(LP_CAPITAL));

    f.env.set_caller(f.lp);
    f.insurance.unstake(U256::from(100_000u64));
    assert_eq!(f.insurance.total_staked(), U256::from(LP_CAPITAL - 100_000));
    assert_eq!(
        f.insurance.staked_of(f.lp),
        U256::from(LP_CAPITAL - 100_000)
    );
}

#[test]
fn unstake_more_than_staked_reverts() {
    let mut f = setup();
    lp_stake(&mut f, 50_000);
    f.env.set_caller(f.lp);
    let res = f.insurance.try_unstake(U256::from(50_001u64));
    assert_eq!(res, Err(InsError::InsufficientStakedBalance.into()));
}

#[test]
fn claim_unknown_policy_reverts_not_found() {
    let mut f = setup();
    let att = attest_claim(&mut f);
    f.env.set_caller(f.holder);
    assert_eq!(
        f.insurance.try_claim(404, att, String::from(TRIGGER)),
        Err(InsError::PolicyNotFound.into())
    );
}

#[test]
fn premium_bps_readable() {
    let f = setup();
    assert_eq!(f.insurance.premium_bps(), PREMIUM_BPS);
}
