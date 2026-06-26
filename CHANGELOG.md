# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Real Casper Testnet deploy via an Odra livenet binary (`contracts/bin/livenet.rs`, `livenet`
  feature): deploys the 4 contracts + runs the on-chain demo arc; `scripts/deploy-testnet.ts` live
  mode captures real package hashes into `.env.local`. ADR `0007`. Mock mode unchanged.
- `make deploy-testnet-local` / `make livenet-build`; submission deploy runbook
  (`docs/submission/DEPLOY_RUNBOOK.md`) and the DoraHacks submission package under `docs/submission/`.
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
- `apps/x402-server`: x402-gated `GET /attestation/:id` + `POST /verify` (mock + facilitator).
- Full dockerization (`docker compose up`), Makefile, GitHub Actions CI/e2e/release.
- Documentation set (`docs/` + ADRs), deploy/seed scripts, Playwright e2e, `SETUP_NEEDED.md`.

### Security

- `Insurance.claim` binds the backing attestation to the configured `claim_model_id`.
- Checks-effects-interactions ordering in `claim`/`resolve`/`finalize`/`unstake`.
- Verifier recomputes the full commitment (input + output + model + timestamp), not just output.
- x402 server fails closed in production absent a facilitator or explicit mock opt-in.

[Unreleased]: https://github.com/mihailShumilov/casperproof
