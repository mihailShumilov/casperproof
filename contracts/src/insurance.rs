//! `Insurance` — parametric agent insurance (the flagship demo that proves the oracle in DeFi).
//!
//! Policyholders buy coverage (premium in mock USDC). When a covered event fires, the claim
//! oracle attests its decision through the [`crate::attestation_registry`]; the holder then
//! calls [`Insurance::claim`], which **reads the attestation cross-contract** and pays the
//! coverage from the vault in USDC — but only if the backing attestation is not slashed and a
//! solvency guard holds. LPs `stake` USDC capital into the vault and earn from premiums.

use crate::attestation_registry::AttestationRegistryContractRef;
use crate::commitment::AttestationStatus;
use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;
use odra_modules::cep18_token::Cep18ContractRef;

const BPS_DENOM: u64 = 10_000;

#[odra::odra_error]
pub enum Error {
    PolicyNotFound = 20,
    PolicyExpired = 21,
    TriggerNotCovered = 22,
    PolicyNotActive = 23,
    Unauthorized = 24,
    VaultInsolvent = 25,
    AttestationNotActive = 26,
    InsufficientStakedBalance = 27,
    BadConfig = 28,
    ZeroAmount = 29,
}

/// Lifecycle of a policy.
#[odra::odra_type]
pub enum PolicyStatus {
    Active,
    Claimed,
    Expired,
}

/// An insurance policy.
#[odra::odra_type]
pub struct Policy {
    pub id: u64,
    pub holder: Address,
    pub coverage: U256,
    pub premium: U256,
    pub trigger_types: Vec<String>,
    pub expiry: u64,
    pub status: PolicyStatus,
}

#[odra::event]
pub struct PolicyPurchased {
    pub id: u64,
    pub holder: Address,
    pub coverage: U256,
    pub premium: U256,
    pub expiry: u64,
}

#[odra::event]
pub struct ClaimPaid {
    pub policy_id: u64,
    pub attestation_id: u64,
    pub holder: Address,
    pub amount: U256,
    pub trigger_type: String,
}

#[odra::event]
pub struct Staked {
    pub staker: Address,
    pub amount: U256,
    pub total_staked: U256,
}

#[odra::event]
pub struct Unstaked {
    pub staker: Address,
    pub amount: U256,
    pub total_staked: U256,
}

#[odra::module(events = [PolicyPurchased, ClaimPaid, Staked, Unstaked])]
pub struct Insurance {
    policy_count: Var<u64>,
    policies: Mapping<u64, Policy>,
    positions: Mapping<Address, U256>,
    total_staked: Var<U256>,
    usdc_token: Var<Address>,
    registry: Var<Address>,
    premium_bps: Var<u64>,
    claim_model_id: Var<String>,
}

#[odra::module]
impl Insurance {
    /// Deploy-time config. `usdc_token` is the CEP-18 currency; `registry` is the
    /// `AttestationRegistry` the claim oracle attests through; `premium_bps` is the premium as
    /// basis points of coverage; `claim_model_id` is the expected claim-oracle model id.
    pub fn init(
        &mut self,
        usdc_token: Address,
        registry: Address,
        premium_bps: u64,
        claim_model_id: String,
    ) {
        if premium_bps > BPS_DENOM {
            self.env().revert(Error::BadConfig);
        }
        self.policy_count.set(0);
        self.total_staked.set(U256::zero());
        self.usdc_token.set(usdc_token);
        self.registry.set(registry);
        self.premium_bps.set(premium_bps);
        self.claim_model_id.set(claim_model_id);
    }

    /// Buy a policy. The caller must have approved this contract to spend the premium. The
    /// premium flows into the vault. Emits [`PolicyPurchased`]. Returns the policy id.
    pub fn buy_policy(&mut self, coverage: U256, trigger_types: Vec<String>, expiry: u64) -> u64 {
        if coverage.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
        let holder = self.env().caller();
        let premium = coverage * U256::from(self.premium_bps_value()) / U256::from(BPS_DENOM);
        self.usdc()
            .transfer_from(&holder, &self.env().self_address(), &premium);

        let id = self.policy_count.get_or_default();
        self.policies.set(
            &id,
            Policy {
                id,
                holder,
                coverage,
                premium,
                trigger_types,
                expiry,
                status: PolicyStatus::Active,
            },
        );
        self.policy_count.set(id + 1);

        self.env().emit_event(PolicyPurchased {
            id,
            holder,
            coverage,
            premium,
            expiry,
        });
        id
    }

    /// Claim against a covered trigger, backed by an attestation in the registry. Reads the
    /// attestation cross-contract; requires it is not slashed/challenged, the trigger is
    /// covered, the policy is active and unexpired, and the vault is solvent. Pays coverage in
    /// USDC. Emits [`ClaimPaid`].
    pub fn claim(&mut self, policy_id: u64, attestation_id: u64, trigger_type: String) {
        let mut policy = self
            .policies
            .get(&policy_id)
            .unwrap_or_revert_with(self, Error::PolicyNotFound);

        if self.env().caller() != policy.holder {
            self.env().revert(Error::Unauthorized);
        }
        if policy.status != PolicyStatus::Active {
            self.env().revert(Error::PolicyNotActive);
        }
        if self.env().get_block_time() > policy.expiry {
            self.env().revert(Error::PolicyExpired);
        }
        if !policy.trigger_types.iter().any(|t| t == &trigger_type) {
            self.env().revert(Error::TriggerNotCovered);
        }

        // Cross-contract read of the backing attestation (reverts NotFound if absent).
        let registry = AttestationRegistryContractRef::new(self.env(), self.registry_addr());
        let attestation = registry.get_attestation(attestation_id);
        // The backing attestation must be produced by the configured claim oracle model, so a
        // holder cannot self-manufacture an unrelated attestation to drain coverage.
        let claim_model = self
            .claim_model_id
            .get()
            .unwrap_or_revert_with(self, Error::BadConfig);
        if attestation.model_id != claim_model {
            self.env().revert(Error::Unauthorized);
        }
        // A slashed or still-challenged attestation cannot back a payout.
        if !matches!(
            attestation.status,
            AttestationStatus::Active | AttestationStatus::Finalized
        ) {
            self.env().revert(Error::AttestationNotActive);
        }

        let payout = policy.coverage;
        let vault_balance = self.vault_balance();
        if vault_balance < payout {
            self.env().revert(Error::VaultInsolvent);
        }

        // Checks-Effects-Interactions: mark the policy claimed and persist BEFORE the external
        // token transfer, so a hook-bearing CEP-18 cannot re-enter and double-pay.
        let holder = policy.holder;
        policy.status = PolicyStatus::Claimed;
        self.policies.set(&policy_id, policy);
        self.usdc().transfer(&holder, &payout);

        self.env().emit_event(ClaimPaid {
            policy_id,
            attestation_id,
            holder,
            amount: payout,
            trigger_type,
        });
    }

    /// Stake USDC capital into the vault (LP). Caller must have approved the premium amount.
    /// Emits [`Staked`].
    pub fn stake(&mut self, amount: U256) {
        if amount.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
        let staker = self.env().caller();
        self.usdc()
            .transfer_from(&staker, &self.env().self_address(), &amount);
        let pos = self.positions.get(&staker).unwrap_or_default() + amount;
        self.positions.set(&staker, pos);
        let total = self.total_staked.get_or_default() + amount;
        self.total_staked.set(total);
        self.env().emit_event(Staked {
            staker,
            amount,
            total_staked: total,
        });
    }

    /// Withdraw staked capital, subject to the solvency guard. Emits [`Unstaked`].
    pub fn unstake(&mut self, amount: U256) {
        if amount.is_zero() {
            self.env().revert(Error::ZeroAmount);
        }
        let staker = self.env().caller();
        let pos = self.positions.get(&staker).unwrap_or_default();
        if pos < amount {
            self.env().revert(Error::InsufficientStakedBalance);
        }
        if self.vault_balance() < amount {
            self.env().revert(Error::VaultInsolvent);
        }
        // Checks-Effects-Interactions: reduce the recorded position + total before paying out.
        self.positions.set(&staker, pos - amount);
        let total = self.total_staked.get_or_default() - amount;
        self.total_staked.set(total);
        self.usdc().transfer(&staker, &amount);
        self.env().emit_event(Unstaked {
            staker,
            amount,
            total_staked: total,
        });
    }

    /// Read a policy, reverting [`Error::PolicyNotFound`] if absent.
    pub fn get_policy(&self, id: u64) -> Policy {
        self.policies
            .get(&id)
            .unwrap_or_revert_with(self, Error::PolicyNotFound)
    }

    pub fn policy_count(&self) -> u64 {
        self.policy_count.get_or_default()
    }

    pub fn total_staked(&self) -> U256 {
        self.total_staked.get_or_default()
    }

    pub fn staked_of(&self, staker: Address) -> U256 {
        self.positions.get(&staker).unwrap_or_default()
    }

    /// Current USDC balance held by the vault (premiums + stake − payouts).
    pub fn vault_balance(&self) -> U256 {
        self.usdc().balance_of(&self.env().self_address())
    }

    pub fn premium_bps(&self) -> u64 {
        self.premium_bps_value()
    }

    // ── internals ───────────────────────────────────────────────────────────────
    fn premium_bps_value(&self) -> u64 {
        self.premium_bps.get_or_default()
    }

    fn registry_addr(&self) -> Address {
        self.registry
            .get()
            .unwrap_or_revert_with(self, Error::BadConfig)
    }

    fn usdc(&self) -> Cep18ContractRef {
        let addr = self
            .usdc_token
            .get()
            .unwrap_or_revert_with(self, Error::BadConfig);
        Cep18ContractRef::new(self.env(), addr)
    }
}
