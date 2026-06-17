# NOTICE

CasperProof is **original work** created for the **Casper Agentic Buildathon 2026**
(June 2026), conceptually informed by the author's prior independent agent-risk work,
with **all contracts, agents, SDKs, and interfaces newly authored for Casper**.

## Originality statement

- This repository was created greenfield with a **fresh git history**. The first commit is
  the monorepo scaffold; there is no imported history from any prior project.
- No source file was copied verbatim from any other repository. Where a concept (e.g. the
  parametric-insurance flow, the risk-signal taxonomy, or the claim-trigger model) is shared
  with the author's earlier Solana project, it has been **reimplemented from understanding**
  using Casper-native primitives (Odra, CEP-18, CSPR.cloud, CSPR.click, x402, MCP).
- The verifiable-oracle trust layer (commitment scheme, attestation registry, challenge /
  slash / reputation mechanics, x402-gated verification) is **new and Casper-native**.

## Conceptual reference (read-only, not copied)

The author's prior Solana project ("Covantic" — parametric insurance for AI agents) served
only as a **domain-knowledge reference** for risk signals, the trigger taxonomy, and the
vault/staking/claim pipeline. See `docs/adr/0001-oracle-first-pivot.md` for the design
rationale and the Solana → Casper translation.

## Third-party software

CasperProof depends on open-source software under their respective licenses, including
Odra, the Casper Rust SDK, `@noble/hashes`, Fastify, Next.js, and others declared in
`package.json` / `Cargo.toml` manifests. This project is released under the MIT License
(see `LICENSE`).
