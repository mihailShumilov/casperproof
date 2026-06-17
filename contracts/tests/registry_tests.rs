//! Integration tests for `AttestationRegistry` (MockVM). Covers every entry point + edge case.

use casperproof_contracts::attestation_registry::{
    AttestationRegistry, AttestationRegistryHostRef, AttestationRegistryInitArgs, Error as RegError,
};
use casperproof_contracts::commitment::AttestationStatus;
use casperproof_contracts::tokens::{StakeToken, StakeTokenHostRef, StakeTokenInitArgs};
use odra::casper_types::U256;
use odra::host::{Deployer, HostEnv};
use odra::prelude::*;

const MIN_STAKE: u64 = 1_000;
const BOND: u64 = 500;
const WINDOW_SECS: u64 = 3_600;
const REWARD_BPS: u64 = 5_000; // 50% to challenger

struct Fixture {
    env: HostEnv,
    token: StakeTokenHostRef,
    registry: AttestationRegistryHostRef,
    attestor: Address,
    challenger: Address,
    treasury: Address,
    resolver: Address,
}

fn setup() -> Fixture {
    let env = odra_test::env();
    let deployer = env.get_account(0);
    let attestor = env.get_account(1);
    let challenger = env.get_account(2);
    let treasury = env.get_account(3);
    let resolver = env.get_account(4);

    env.set_caller(deployer);
    let token = StakeToken::deploy(
        &env,
        StakeTokenInitArgs {
            initial_supply: U256::from(1_000_000u64),
        },
    );
    let registry = AttestationRegistry::deploy(
        &env,
        AttestationRegistryInitArgs {
            stake_token: token.address(),
            min_stake: U256::from(MIN_STAKE),
            challenge_bond: U256::from(BOND),
            dispute_window: WINDOW_SECS,
            treasury,
            resolver,
            reward_bps: REWARD_BPS,
        },
    );

    // Fund attestor + challenger and let them approve the registry to pull stake/bond.
    let mut token = token;
    env.set_caller(deployer);
    token.transfer(&attestor, &U256::from(10_000u64));
    token.transfer(&challenger, &U256::from(10_000u64));
    env.set_caller(attestor);
    token.approve(&registry.address(), &U256::from(10_000u64));
    env.set_caller(challenger);
    token.approve(&registry.address(), &U256::from(10_000u64));

    Fixture {
        env,
        token,
        registry,
        attestor,
        challenger,
        treasury,
        resolver,
    }
}

fn submit(f: &mut Fixture, stake: u64) -> u64 {
    f.env.set_caller(f.attestor);
    f.registry.submit_attestation(
        String::from("casperproof-riskscorer-v1"),
        [1u8; 32],
        [2u8; 32],
        [3u8; 32],
        String::from("s3://casperproof/abc"),
        U256::from(stake),
    )
}

#[test]
fn submit_locks_stake_increments_count_and_reputation() {
    let mut f = setup();
    let before = f.token.balance_of(&f.attestor);
    let id = submit(&mut f, MIN_STAKE);
    assert_eq!(id, 0);
    assert_eq!(f.registry.attestation_count(), 1);

    let att = f.registry.get_attestation(id);
    assert_eq!(att.attestor, f.attestor);
    assert_eq!(att.stake, U256::from(MIN_STAKE));
    assert_eq!(att.status, AttestationStatus::Active);
    assert_eq!(att.input_hash, [1u8; 32]);

    // Stake moved from attestor to the registry.
    assert_eq!(
        f.token.balance_of(&f.attestor),
        before - U256::from(MIN_STAKE)
    );
    assert_eq!(
        f.token.balance_of(&f.registry.address()),
        U256::from(MIN_STAKE)
    );

    let rep = f.registry.attestor_reputation(f.attestor);
    assert_eq!(rep.total, 1);
    assert_eq!(rep.slashed, 0);
}

#[test]
fn submit_below_min_stake_reverts() {
    let mut f = setup();
    f.env.set_caller(f.attestor);
    let res = f.registry.try_submit_attestation(
        String::from("m"),
        [0u8; 32],
        [0u8; 32],
        [0u8; 32],
        String::from("uri"),
        U256::from(MIN_STAKE - 1),
    );
    assert_eq!(res, Err(RegError::InsufficientStake.into()));
}

#[test]
fn get_unknown_attestation_reverts_not_found() {
    let f = setup();
    assert_eq!(
        f.registry.try_get_attestation(99),
        Err(RegError::NotFound.into())
    );
}

#[test]
fn challenge_then_resolve_fraudulent_slashes_stake() {
    let mut f = setup();
    let id = submit(&mut f, MIN_STAKE);

    let challenger_before = f.token.balance_of(&f.challenger);
    let treasury_before = f.token.balance_of(&f.treasury);

    f.env.set_caller(f.challenger);
    f.registry.challenge(id);
    let att = f.registry.get_attestation(id);
    assert_eq!(att.status, AttestationStatus::Challenged);
    assert_eq!(att.challenger, Some(f.challenger));

    // Resolver rules it fraudulent → slash.
    f.env.set_caller(f.resolver);
    f.registry.resolve(id, true);
    let att = f.registry.get_attestation(id);
    assert_eq!(att.status, AttestationStatus::Slashed);

    // Challenger gets 50% reward + bond back; treasury gets the other 50%.
    let reward = MIN_STAKE * REWARD_BPS / 10_000;
    assert_eq!(
        f.token.balance_of(&f.challenger),
        challenger_before + U256::from(reward), // bond was pulled then returned → net +reward
    );
    assert_eq!(
        f.token.balance_of(&f.treasury),
        treasury_before + U256::from(MIN_STAKE - reward),
    );
    assert_eq!(f.registry.attestor_reputation(f.attestor).slashed, 1);
}

#[test]
fn resolve_honest_refunds_attestor_and_forfeits_bond() {
    let mut f = setup();
    let id = submit(&mut f, MIN_STAKE);
    let attestor_before = f.token.balance_of(&f.attestor);
    let treasury_before = f.token.balance_of(&f.treasury);

    f.env.set_caller(f.challenger);
    f.registry.challenge(id);
    f.env.set_caller(f.resolver);
    f.registry.resolve(id, false);

    let att = f.registry.get_attestation(id);
    assert_eq!(att.status, AttestationStatus::Finalized);
    // Attestor refunded the full stake.
    assert_eq!(
        f.token.balance_of(&f.attestor),
        attestor_before + U256::from(MIN_STAKE)
    );
    // Treasury keeps the forfeited bond.
    assert_eq!(
        f.token.balance_of(&f.treasury),
        treasury_before + U256::from(BOND)
    );
    let rep = f.registry.attestor_reputation(f.attestor);
    assert_eq!(rep.successful, 1);
    assert_eq!(rep.challenges_defended, 1);
}

#[test]
fn resolve_requires_resolver() {
    let mut f = setup();
    let id = submit(&mut f, MIN_STAKE);
    f.env.set_caller(f.challenger);
    f.registry.challenge(id);
    // Non-resolver cannot resolve.
    f.env.set_caller(f.attestor);
    assert_eq!(
        f.registry.try_resolve(id, true),
        Err(RegError::Unauthorized.into())
    );
}

#[test]
fn cannot_challenge_twice() {
    let mut f = setup();
    let id = submit(&mut f, MIN_STAKE);
    f.env.set_caller(f.challenger);
    f.registry.challenge(id);
    f.env.set_caller(f.challenger);
    assert_eq!(
        f.registry.try_challenge(id),
        Err(RegError::AlreadyChallenged.into())
    );
}

#[test]
fn cannot_challenge_after_window_closes() {
    let mut f = setup();
    let id = submit(&mut f, MIN_STAKE);
    // Advance beyond the dispute window (ms).
    f.env.advance_block_time(WINDOW_SECS * 1000 + 1);
    f.env.set_caller(f.challenger);
    assert_eq!(
        f.registry.try_challenge(id),
        Err(RegError::WindowClosed.into())
    );
}

#[test]
fn resolve_unchallenged_reverts_not_active() {
    let mut f = setup();
    let id = submit(&mut f, MIN_STAKE);
    f.env.set_caller(f.resolver);
    assert_eq!(
        f.registry.try_resolve(id, true),
        Err(RegError::NotActive.into())
    );
}

#[test]
fn finalize_after_window_returns_stake() {
    let mut f = setup();
    let id = submit(&mut f, MIN_STAKE);
    let attestor_before = f.token.balance_of(&f.attestor);

    // Cannot finalize before the window closes.
    assert_eq!(
        f.registry.try_finalize(id),
        Err(RegError::WindowClosed.into())
    );

    f.env.advance_block_time(WINDOW_SECS * 1000 + 1);
    f.registry.finalize(id);
    let att = f.registry.get_attestation(id);
    assert_eq!(att.status, AttestationStatus::Finalized);
    assert_eq!(
        f.token.balance_of(&f.attestor),
        attestor_before + U256::from(MIN_STAKE)
    );
    assert_eq!(f.registry.attestor_reputation(f.attestor).successful, 1);

    // Cannot finalize a finalized attestation.
    assert_eq!(f.registry.try_finalize(id), Err(RegError::NotActive.into()));
}

#[test]
fn config_and_stake_token_readable() {
    let f = setup();
    let cfg = f.registry.get_config();
    assert_eq!(cfg.min_stake, U256::from(MIN_STAKE));
    assert_eq!(cfg.dispute_window, WINDOW_SECS);
    assert_eq!(cfg.reward_bps, REWARD_BPS);
    assert_eq!(f.registry.stake_token(), f.token.address());
}

#[test]
fn bad_config_reward_bps_reverts_on_deploy() {
    let env = odra_test::env();
    let token = StakeToken::deploy(
        &env,
        StakeTokenInitArgs {
            initial_supply: U256::from(1u64),
        },
    );
    let res = AttestationRegistry::try_deploy(
        &env,
        AttestationRegistryInitArgs {
            stake_token: token.address(),
            min_stake: U256::from(1u64),
            challenge_bond: U256::from(1u64),
            dispute_window: 1,
            treasury: env.get_account(3),
            resolver: env.get_account(4),
            reward_bps: 10_001,
        },
    );
    assert!(res.is_err());
}
