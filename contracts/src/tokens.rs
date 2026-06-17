//! CEP-18 tokens used by CasperProof.
//!
//! - [`StakeToken`] (`STAKE`) — the asset attestors lock behind an attestation and that
//!   challengers post as a bond, in the [`crate::attestation_registry`].
//! - [`MockUsdc`] (`USDC`) — a test stablecoin used by [`crate::insurance`] for premiums,
//!   vault capital, LP staking, and claim payouts.
//!
//! Both wrap the audited `odra_modules` CEP-18 module and re-expose the standard entry
//! points so they can be called cross-contract via `Cep18ContractRef`. The deployer
//! receives the full `initial_supply` at init and distributes it (see `scripts/seed-demo.ts`).

use odra::casper_types::U256;
use odra::module::SubModule;
use odra::prelude::*;
use odra_modules::cep18_token::Cep18;

/// The CasperProof STAKE token (CEP-18). 9 decimals.
#[odra::module]
pub struct StakeToken {
    token: SubModule<Cep18>,
}

#[odra::module]
impl StakeToken {
    /// Initialize STAKE; the deployer receives `initial_supply`.
    pub fn init(&mut self, initial_supply: U256) {
        self.token.init(
            String::from("STAKE"),
            String::from("CasperProof Stake"),
            9,
            initial_supply,
        );
    }

    pub fn name(&self) -> String {
        self.token.name()
    }
    pub fn symbol(&self) -> String {
        self.token.symbol()
    }
    pub fn decimals(&self) -> u8 {
        self.token.decimals()
    }
    pub fn total_supply(&self) -> U256 {
        self.token.total_supply()
    }
    pub fn balance_of(&self, address: &Address) -> U256 {
        self.token.balance_of(address)
    }
    pub fn allowance(&self, owner: &Address, spender: &Address) -> U256 {
        self.token.allowance(owner, spender)
    }
    pub fn approve(&mut self, spender: &Address, amount: &U256) {
        self.token.approve(spender, amount);
    }
    pub fn transfer(&mut self, recipient: &Address, amount: &U256) {
        self.token.transfer(recipient, amount);
    }
    pub fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256) {
        self.token.transfer_from(owner, recipient, amount);
    }
}

/// A mock USD stablecoin (CEP-18) for the insurance demo. 6 decimals (like USDC).
#[odra::module]
pub struct MockUsdc {
    token: SubModule<Cep18>,
}

#[odra::module]
impl MockUsdc {
    /// Initialize mock USDC; the deployer receives `initial_supply`.
    pub fn init(&mut self, initial_supply: U256) {
        self.token.init(
            String::from("USDC"),
            String::from("CasperProof Mock USDC"),
            6,
            initial_supply,
        );
    }

    pub fn name(&self) -> String {
        self.token.name()
    }
    pub fn symbol(&self) -> String {
        self.token.symbol()
    }
    pub fn decimals(&self) -> u8 {
        self.token.decimals()
    }
    pub fn total_supply(&self) -> U256 {
        self.token.total_supply()
    }
    pub fn balance_of(&self, address: &Address) -> U256 {
        self.token.balance_of(address)
    }
    pub fn allowance(&self, owner: &Address, spender: &Address) -> U256 {
        self.token.allowance(owner, spender)
    }
    pub fn approve(&mut self, spender: &Address, amount: &U256) {
        self.token.approve(spender, amount);
    }
    pub fn transfer(&mut self, recipient: &Address, amount: &U256) {
        self.token.transfer(recipient, amount);
    }
    pub fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256) {
        self.token.transfer_from(owner, recipient, amount);
    }
}
