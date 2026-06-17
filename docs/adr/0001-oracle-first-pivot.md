# ADR 0001: Oracle-first product, with insurance as the proof

- Status: accepted
- Date: 2026

## Context

Two products were on the table: a verifiable AI **oracle** (stake-backed, tamper-evident proofs
of agent output) and a parametric **agent-insurance** vault. Building both fully would dilute
focus; building only insurance would leave its trust assumptions unproven; building only the
oracle risks looking like a primitive with no application.

## Decision

Make the **oracle the core product** and the trust primitive everything else depends on:
`AttestationRegistry` implements commit → stake → verify → challenge → slash → reputation. Build
the **insurance vault as the flagship demonstration** of the oracle in DeFi, not as a parallel
trust system. `Insurance.claim()` reads `AttestationRegistry.get_attestation` **cross-contract**
and refuses payouts backed by slashed/challenged attestations — it consumes the oracle's
guarantees instead of re-implementing them.

The economic layers stay deliberately separate: the registry uses a CEP-18 **STAKE** token
(amounts in `U256`) for stake and challenge bonds; insurance uses CEP-18 **mock USDC** for
premiums, coverage, LP capital, and payouts.

## Consequences

- One trust mechanism to reason about and test; insurance inherits it for free.
- The cross-contract read is the load-bearing integration — covered by both contract MockVM
  tests and the dApp insurance flow.
- The repo can demo a complete narrative (attest → verify → claim → tamper → slash) with the
  oracle at the center; insurance makes the value tangible without splitting the codebase.
- A clean extension path: any other consumer (lending, escrow, agent marketplaces) can read the
  same registry the same way.
