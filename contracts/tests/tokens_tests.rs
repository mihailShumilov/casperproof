//! Integration tests for the CEP-18 token wrappers (`StakeToken`, `MockUsdc`).

use casperproof_contracts::tokens::{MockUsdc, MockUsdcInitArgs, StakeToken, StakeTokenInitArgs};
use odra::casper_types::U256;
use odra::host::{Deployer, HostEnv};
use odra::prelude::*;

fn env_with_accounts() -> (HostEnv, Address, Address, Address) {
    let env = odra_test::env();
    (
        env.clone(),
        env.get_account(0),
        env.get_account(1),
        env.get_account(2),
    )
}

#[test]
fn stake_token_metadata_and_initial_supply() {
    let (env, deployer, _a, _b) = env_with_accounts();
    let token = StakeToken::deploy(
        &env,
        StakeTokenInitArgs {
            initial_supply: U256::from(1_000u64),
        },
    );
    assert_eq!(token.symbol(), "STAKE");
    assert_eq!(token.name(), "CasperProof Stake");
    assert_eq!(token.decimals(), 9);
    assert_eq!(token.total_supply(), U256::from(1_000u64));
    assert_eq!(token.balance_of(&deployer), U256::from(1_000u64));
}

#[test]
fn usdc_metadata_and_transfer() {
    let (env, deployer, alice, _b) = env_with_accounts();
    let mut usdc = MockUsdc::deploy(
        &env,
        MockUsdcInitArgs {
            initial_supply: U256::from(1_000u64),
        },
    );
    assert_eq!(usdc.symbol(), "USDC");
    assert_eq!(usdc.decimals(), 6);

    env.set_caller(deployer);
    usdc.transfer(&alice, &U256::from(400u64));
    assert_eq!(usdc.balance_of(&alice), U256::from(400u64));
    assert_eq!(usdc.balance_of(&deployer), U256::from(600u64));
}

#[test]
fn approve_then_transfer_from_moves_allowance() {
    let (env, deployer, alice, _bob) = env_with_accounts();
    let mut token = StakeToken::deploy(
        &env,
        StakeTokenInitArgs {
            initial_supply: U256::from(1_000u64),
        },
    );

    env.set_caller(deployer);
    token.approve(&alice, &U256::from(250u64));
    assert_eq!(token.allowance(&deployer, &alice), U256::from(250u64));

    // The approved spender pulls the deployer's tokens to itself — exactly how the registry
    // and insurance vault lock funds (`transfer_from(owner, self, amount)`).
    env.set_caller(alice);
    token.transfer_from(&deployer, &alice, &U256::from(250u64));
    assert_eq!(token.balance_of(&alice), U256::from(250u64));
    assert_eq!(token.allowance(&deployer, &alice), U256::zero());
}

#[test]
fn transfer_from_without_allowance_reverts() {
    let (env, deployer, alice, bob) = env_with_accounts();
    let mut token = StakeToken::deploy(
        &env,
        StakeTokenInitArgs {
            initial_supply: U256::from(1_000u64),
        },
    );
    env.set_caller(alice);
    let res = token.try_transfer_from(&deployer, &bob, &U256::from(10u64));
    assert!(res.is_err());
}
