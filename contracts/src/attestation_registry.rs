//! `AttestationRegistry` — the CORE verifiable-oracle contract (§8, `attestation-oracle` skill).
//!
//! An agent locks STAKE (CEP-18) behind a tamper-evident commitment to its output. Anyone
//! may `challenge` within the dispute window; the resolver settles disputes, **slashing** a
//! fraudulent attestor's stake to the challenger + treasury, or refunding an honest one.
//!
//! Bytes-only: the contract stores and compares the hashes from `commitment.rs`; it **never**
//! recomputes them (off-chain attestor/verifier do that). Every state change emits an event
//! for the live dashboard.

use crate::commitment::{Attestation, AttestationStatus, Hash, RegistryConfig, Reputation};
use odra::casper_types::U256;
use odra::prelude::*;
use odra::ContractRef;
use odra_modules::cep18_token::Cep18ContractRef;

/// Basis-points denominator.
const BPS_DENOM: u64 = 10_000;

#[odra::odra_error]
pub enum Error {
    /// No attestation with the given id.
    NotFound = 1,
    /// Attached/declared stake is below the configured minimum.
    InsufficientStake = 2,
    /// The dispute window has elapsed.
    WindowClosed = 3,
    /// The attestation is already under challenge.
    AlreadyChallenged = 4,
    /// Caller is not authorized for this action.
    Unauthorized = 5,
    /// The attestation is not in the required state.
    NotActive = 6,
    /// The challenge has already been resolved.
    AlreadyResolved = 7,
    /// Misconfiguration (e.g. reward_bps > 10000).
    BadConfig = 8,
}

/// Emitted when an attestation is submitted.
#[odra::event]
pub struct AttestationSubmitted {
    pub id: u64,
    pub attestor: Address,
    pub model_id: String,
    pub commitment: Hash,
    pub stake: U256,
    pub created_at: u64,
}

/// Emitted when an attestation is challenged.
#[odra::event]
pub struct Challenged {
    pub id: u64,
    pub challenger: Address,
    pub bond: U256,
    pub challenged_at: u64,
}

/// Emitted when a challenge is resolved.
#[odra::event]
pub struct Resolved {
    pub id: u64,
    pub fraudulent: bool,
    pub challenger: Address,
    pub slashed_amount: U256,
    pub challenger_reward: U256,
}

/// Emitted when an attestation is finalized after its window with no successful challenge.
#[odra::event]
pub struct Finalized {
    pub id: u64,
    pub attestor: Address,
    pub stake_returned: U256,
}

#[odra::module(events = [AttestationSubmitted, Challenged, Resolved, Finalized])]
pub struct AttestationRegistry {
    count: Var<u64>,
    attestations: Mapping<u64, Attestation>,
    reputations: Mapping<Address, Reputation>,
    config: Var<RegistryConfig>,
    stake_token: Var<Address>,
}

#[odra::module]
impl AttestationRegistry {
    /// Deploy-time configuration. `stake_token` is the CEP-18 STAKE contract address.
    #[allow(clippy::too_many_arguments)]
    pub fn init(
        &mut self,
        stake_token: Address,
        min_stake: U256,
        challenge_bond: U256,
        dispute_window: u64,
        treasury: Address,
        resolver: Address,
        reward_bps: u64,
    ) {
        if reward_bps > BPS_DENOM {
            self.env().revert(Error::BadConfig);
        }
        self.count.set(0);
        self.stake_token.set(stake_token);
        self.config.set(RegistryConfig {
            min_stake,
            challenge_bond,
            dispute_window,
            treasury,
            resolver,
            reward_bps,
        });
    }

    /// Submit a stake-backed attestation. The caller must have approved this contract to
    /// spend `stake` STAKE tokens. Emits [`AttestationSubmitted`]. Returns the new id.
    pub fn submit_attestation(
        &mut self,
        model_id: String,
        input_hash: Hash,
        output_hash: Hash,
        commitment: Hash,
        uri: String,
        stake: U256,
    ) -> u64 {
        let cfg = self.cfg();
        if stake < cfg.min_stake {
            self.env().revert(Error::InsufficientStake);
        }
        let attestor = self.env().caller();
        // Lock stake into this contract (requires prior allowance).
        self.token()
            .transfer_from(&attestor, &self.env().self_address(), &stake);

        let id = self.count.get_or_default();
        let created_at = self.env().get_block_time();
        let attestation = Attestation {
            id,
            attestor,
            model_id: model_id.clone(),
            input_hash,
            output_hash,
            commitment,
            uri,
            stake,
            created_at,
            status: AttestationStatus::Active,
            challenger: None,
            challenge_bond: U256::zero(),
            challenged_at: 0,
        };
        self.attestations.set(&id, attestation);
        self.count.set(id + 1);

        let mut rep = self.reputations.get(&attestor).unwrap_or_default();
        rep.total += 1;
        self.reputations.set(&attestor, rep);

        self.env().emit_event(AttestationSubmitted {
            id,
            attestor,
            model_id,
            commitment,
            stake,
            created_at,
        });
        id
    }

    /// Read an attestation, reverting [`Error::NotFound`] if absent.
    pub fn get_attestation(&self, id: u64) -> Attestation {
        self.attestations
            .get(&id)
            .unwrap_or_revert_with(self, Error::NotFound)
    }

    /// Open a challenge against an `Active` attestation within its dispute window. The caller
    /// must have approved this contract to spend the challenge bond. Emits [`Challenged`].
    pub fn challenge(&mut self, id: u64) {
        let mut att = self.get_attestation(id);
        match att.status {
            AttestationStatus::Challenged => self.env().revert(Error::AlreadyChallenged),
            AttestationStatus::Active => {}
            _ => self.env().revert(Error::NotActive),
        }
        if self.window_closed(&att) {
            self.env().revert(Error::WindowClosed);
        }
        let cfg = self.cfg();
        let challenger = self.env().caller();
        self.token()
            .transfer_from(&challenger, &self.env().self_address(), &cfg.challenge_bond);

        let challenged_at = self.env().get_block_time();
        att.status = AttestationStatus::Challenged;
        att.challenger = Some(challenger);
        att.challenge_bond = cfg.challenge_bond;
        att.challenged_at = challenged_at;
        self.attestations.set(&id, att);

        self.env().emit_event(Challenged {
            id,
            challenger,
            bond: cfg.challenge_bond,
            challenged_at,
        });
    }

    /// Resolver-only. Settle a challenged attestation. If `fraudulent`, the attestor's stake
    /// is split between the challenger (reward) and treasury, and the bond is returned to the
    /// challenger; otherwise the stake is refunded to the attestor and the bond is forfeited
    /// to the treasury. Emits [`Resolved`].
    pub fn resolve(&mut self, id: u64, fraudulent: bool) {
        let cfg = self.cfg();
        if self.env().caller() != cfg.resolver {
            self.env().revert(Error::Unauthorized);
        }
        let mut att = self.get_attestation(id);
        match att.status {
            AttestationStatus::Challenged => {}
            AttestationStatus::Slashed | AttestationStatus::Finalized => {
                self.env().revert(Error::AlreadyResolved)
            }
            _ => self.env().revert(Error::NotActive),
        }
        let challenger = att.challenger.unwrap_or_revert_with(self, Error::NotActive);
        let attestor = att.attestor;
        let stake = att.stake;
        let bond = att.challenge_bond;

        // Compute payouts, then write terminal state + reputation BEFORE any external token
        // transfer (Checks-Effects-Interactions), so a hook-bearing token can't re-enter.
        let reward = stake * U256::from(cfg.reward_bps) / U256::from(BPS_DENOM);
        let treasury_cut = stake - reward;
        let (slashed_amount, challenger_reward) = if fraudulent {
            att.status = AttestationStatus::Slashed;
            (stake, reward)
        } else {
            att.status = AttestationStatus::Finalized;
            (U256::zero(), U256::zero())
        };
        self.attestations.set(&id, att);
        if fraudulent {
            self.bump_reputation(attestor, |r| r.slashed += 1);
        } else {
            self.bump_reputation(attestor, |r| {
                r.successful += 1;
                r.challenges_defended += 1;
            });
        }

        // Interactions last.
        let mut token = self.token();
        if fraudulent {
            // Slash: reward + bond to challenger, remainder to treasury.
            token.transfer(&challenger, &(reward + bond));
            if treasury_cut > U256::zero() {
                token.transfer(&cfg.treasury, &treasury_cut);
            }
        } else {
            // Honest: refund stake to attestor; bond forfeited to treasury.
            token.transfer(&attestor, &stake);
            if bond > U256::zero() {
                token.transfer(&cfg.treasury, &bond);
            }
        }

        self.env().emit_event(Resolved {
            id,
            fraudulent,
            challenger,
            slashed_amount,
            challenger_reward,
        });
    }

    /// Finalize an unchallenged attestation after its dispute window, returning the stake.
    /// Emits [`Finalized`].
    pub fn finalize(&mut self, id: u64) {
        let mut att = self.get_attestation(id);
        if att.status != AttestationStatus::Active {
            self.env().revert(Error::NotActive);
        }
        if !self.window_closed(&att) {
            self.env().revert(Error::WindowClosed);
        }
        // Checks-Effects-Interactions: write terminal state + reputation before the transfer.
        let attestor = att.attestor;
        let stake = att.stake;
        att.status = AttestationStatus::Finalized;
        self.attestations.set(&id, att);
        self.bump_reputation(attestor, |r| r.successful += 1);
        self.token().transfer(&attestor, &stake);

        self.env().emit_event(Finalized {
            id,
            attestor,
            stake_returned: stake,
        });
    }

    /// Total number of attestations submitted.
    pub fn attestation_count(&self) -> u64 {
        self.count.get_or_default()
    }

    /// Reputation for an attestor (zeroed if unknown).
    pub fn attestor_reputation(&self, attestor: Address) -> Reputation {
        self.reputations.get(&attestor).unwrap_or_default()
    }

    /// The registry configuration.
    pub fn get_config(&self) -> RegistryConfig {
        self.cfg()
    }

    /// The STAKE token address.
    pub fn stake_token(&self) -> Address {
        self.stake_token
            .get()
            .unwrap_or_revert_with(self, Error::BadConfig)
    }

    // ── internals ───────────────────────────────────────────────────────────────
    fn cfg(&self) -> RegistryConfig {
        self.config
            .get()
            .unwrap_or_revert_with(self, Error::BadConfig)
    }

    fn token(&self) -> Cep18ContractRef {
        Cep18ContractRef::new(self.env(), self.stake_token())
    }

    /// Dispute window is configured in seconds; block time is milliseconds.
    fn window_closed(&self, att: &Attestation) -> bool {
        let window_ms = self.cfg().dispute_window.saturating_mul(1000);
        let now = self.env().get_block_time();
        now > att.created_at.saturating_add(window_ms)
    }

    fn bump_reputation(&mut self, attestor: Address, f: impl FnOnce(&mut Reputation)) {
        let mut rep = self.reputations.get(&attestor).unwrap_or_default();
        f(&mut rep);
        self.reputations.set(&attestor, rep);
    }
}
