# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Monorepo scaffold (pnpm + Turborepo for TS, Cargo workspace for Odra contracts).
- Claude Code build team: 9 specialist sub-agents + 4 repo skills (`.claude/`).
- `packages/commitment`: blake2b-256 commitment scheme with canonical JSON + golden vectors.
- `contracts/src/commitment.rs`: shared on-chain commitment types (bytes only).
- Cross-language golden-vector parity test (TS ⇆ Rust).
- `attestation_registry` Odra contract (submit / get / challenge / resolve / reputation).
- `insurance` Odra contract (policy / vault / staking / claim) + CEP-18 STAKE & mock USDC.
- `packages/agent`: zero-cost runtime (risk-scorer, claim-oracle, attestor, verifier, store, Ollama loop).
- `packages/sdk`: `@casperproof/casper-sdk` typed client.
- `apps/x402-server`, `apps/mcp-server`, `apps/web` (dApp), `apps/marketing`.
- Full dockerization (`docker compose up`), Makefile, GitHub Actions CI/e2e/release.
- Documentation set, deploy + seed scripts.

[Unreleased]: https://github.com/mihailShumilov/casperproof
