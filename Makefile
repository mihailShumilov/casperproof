# ─────────────────────────────────────────────────────────────────────────────
# CasperProof Makefile — one-command dev workflow over Docker + pnpm + Cargo.
#
# Quickstart:  cp .env.example .env && make up
# Run `make` (or `make help`) for the full target list.
# ─────────────────────────────────────────────────────────────────────────────

# Use bash with strict flags for recipe reliability.
SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

# Compose invocation (base + prod overlay).
COMPOSE      := docker compose
COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: help install up up-prod down logs deploy-testnet seed test coverage lint \
        build config clean

## help: Show this help (default target).
help:
	@echo "CasperProof — make targets:"
	@echo ""
	@grep -E '^## [a-zA-Z_-]+:.*$$' $(MAKEFILE_LIST) \
		| sed -E 's/^## ([a-zA-Z_-]+): (.*)$$/  \1|\2/' \
		| awk -F'|' '{ printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' \
		| sed 's/^  //'
	@echo ""
	@echo "Quickstart: cp .env.example .env && make up"

## install: Install JS deps (pnpm) and prefetch Cargo crates.
install:
	pnpm install
	cd contracts && cargo fetch

## up: Build + start the full local stack in the foreground (Ctrl-C to stop).
up:
	@test -f .env || { echo "No .env found — run: cp .env.example .env"; exit 1; }
	$(COMPOSE) up --build

## up-prod: Start the production overlay, detached (restart-on-failure, nginx, TLS-ready).
up-prod:
	@test -f .env || { echo "No .env found — run: cp .env.example .env"; exit 1; }
	$(COMPOSE_PROD) up --build -d

## down: Stop and remove all containers, networks (keeps named volumes).
down:
	$(COMPOSE) down

## logs: Tail logs from all running services.
logs:
	$(COMPOSE) logs -f --tail=100

## deploy-testnet: Build wasm + deploy contracts (mock unless testnet keys set).
deploy-testnet:
	$(COMPOSE) run --rm deployer pnpm exec tsx scripts/deploy-testnet.ts

## seed: Seed demo attestations + insurance policies into the deployed contracts.
seed:
	$(COMPOSE) run --rm deployer pnpm exec tsx scripts/seed-demo.ts

## test: Run contract (cargo) + TS (turbo) test suites. E2E runs via CI / e2e.yml.
test:
	cd contracts && cargo test
	pnpm turbo run test
	@echo "note: Playwright e2e runs in CI (e2e.yml) or: pnpm --filter @casperproof/e2e test"

## coverage: Run the TS coverage suite with the >90% gate enforced.
coverage:
	pnpm turbo run test:coverage

## lint: Lint + typecheck (turbo) and check Prettier + cargo fmt formatting.
lint:
	pnpm turbo run lint typecheck
	pnpm format:check
	cd contracts && cargo fmt --check

## build: Build all JS workspaces (turbo) and the wasm contracts.
build:
	pnpm turbo run build
	cd contracts && cargo odra build

## config: Validate the merged docker compose configuration.
config:
	$(COMPOSE) config -q && echo "docker-compose.yml: OK"
	$(COMPOSE_PROD) config -q && echo "prod overlay: OK"

## clean: Remove build artifacts and stop the stack (keeps volumes).
clean:
	$(COMPOSE) down --remove-orphans || true
	pnpm turbo run clean || true
	cd contracts && cargo clean || true
