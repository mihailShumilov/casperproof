# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Real Casper Testnet deploy via an Odra livenet binary (`contracts/bin/livenet.rs`, `livenet`
  feature): deploys the 4 contracts + runs the on-chain demo arc; `scripts/deploy-testnet.ts` live
  mode captures real package hashes into `.env.local`. ADR `0007`. Mock mode unchanged.
- Live in-dApp write path (env-gated, mock fallback): a typed contract-call ABI in
  `@casperproof/casper-sdk` (`submitAttestationCall`/`challengeCall`/… + `approveCall`), a
  `casper-js-sdk` transaction builder (`apps/web/.../onchain-tx.ts`), and CSPR.click
  sign+submit (`csprclick.ts`/`writes.ts`). Unit-tested; in-browser signing validated on deploy.
- `make deploy-testnet-local` / `make livenet-build`; submission deploy runbook
  and the DoraHacks submission package under `docs/submission/`.
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
- Documentation set (`docs/` + ADRs), deploy/seed scripts, Playwright e2e.

### Fixed

- Playwright e2e suite now passes 11/11 against a real chromium run. Hardened brittle locators
  exposed once the dApp DOM grew: scope attestation-id assertions to `.list-item__id` (the live
  feed renders the same `#id · model` text), scope the verdict assertion to the `.cp-verdict--*`
  modifier (the pill's glyph defeats exact-text matching), match the verify row by its
  `.list-item__id` (not a `hasText` filter that also matched the feed card), use `exact` for the
  "Verify" toggle, scope solvency tiles to `.cp-stattile__label` (the Recharts axis repeats the
  labels as SVG `<tspan>`), and read the staked amount from the `Stake` definition value.

### Security

- `Insurance.claim` binds the backing attestation to the configured `claim_model_id`.
- Checks-effects-interactions ordering in `claim`/`resolve`/`finalize`/`unstake`.
- Verifier recomputes the full commitment (input + output + model + timestamp), not just output.
- x402 server fails closed in production absent a facilitator or explicit mock opt-in.

[Unreleased]: https://github.com/mihailShumilov/casperproof
