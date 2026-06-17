# Contributing to CasperProof

Thanks for your interest! CasperProof is a monorepo (pnpm + Turborepo for TypeScript,
Cargo workspace for Odra contracts).

## Prerequisites

- Node.js `>= 20` (see `.nvmrc`) and `pnpm >= 9`
- Rust toolchain pinned in `rust-toolchain.toml` + `cargo-odra` (`cargo install cargo-odra`)
- Docker + Docker Compose (for the full local stack)

## Getting started

```bash
pnpm install
cp .env.example .env
make up          # boots ollama, minio, agent, x402, mcp, web, marketing
```

## Workflow

1. Branch from `main`: `git checkout -b feat/<scope>-<short-desc>`.
2. Keep the build green: `pnpm lint && pnpm typecheck && pnpm test`.
3. Contracts: `cd contracts && cargo odra test && cargo clippy -- -D warnings && cargo fmt --check`.
4. The **commitment scheme** (`packages/commitment` + `contracts/src/commitment.rs`) is the
   trust anchor. Any change MUST keep the cross-language golden-vector parity test green.
5. Write tests for new code — the TS coverage gate is **>90% line + branch**.

## Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `ci:`, `build:`.
Scope by package, e.g. `feat(contracts): add challenge window guard`.

## Code style

- TypeScript strict everywhere; ESLint + Prettier (`pnpm format`).
- Rust: `cargo fmt` + `clippy` with zero warnings.
- Every public surface is documented (typedoc for SDK, rustdoc for contracts).

## Reporting issues

Use GitHub issues. For security reports, see `SECURITY.md`.
