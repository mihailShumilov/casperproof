# CasperProof — Docker & Deployment

This directory holds the container build + orchestration for CasperProof. The
whole stack runs locally with **one command** and **no host dependency beyond
Docker** — fully offline / mock, no secrets required.

## One-command local stack

```bash
cp .env.example .env
make up        # build + start every service in the foreground
```

What boots (all on one bridge network, `.env`-driven):

| Service       | Image / Dockerfile            | Host port   | Role                                                                      |
| ------------- | ----------------------------- | ----------- | ------------------------------------------------------------------------- |
| `ollama`      | `ollama/ollama`               | 11434       | Local LLM backend; pulls `${OLLAMA_MODEL}` on first run.                  |
| `minio`       | `minio/minio`                 | 9000 / 9001 | S3-compatible payload store (+ web console).                              |
| `minio-init`  | `minio/mc`                    | —           | One-shot: creates `${S3_BUCKET}`, then exits.                             |
| `deployer`    | `docker/Dockerfile.contracts` | —           | One-shot: builds wasm + deploys contracts (mock unless keys), then exits. |
| `agent`       | `docker/Dockerfile.node`      | —           | Zero-cost runtime (risk-scorer, attestor, verifier, Ollama loop).         |
| `x402-server` | `docker/Dockerfile.node`      | 8402        | Pay-per-request resource server.                                          |
| `mcp-server`  | `docker/Dockerfile.node`      | 8405        | Agent ↔ chain MCP tools (HTTP transport in compose).                      |
| `web`         | `docker/Dockerfile.web`       | 3000        | Next.js dApp dashboard (standalone).                                      |
| `marketing`   | `docker/Dockerfile.marketing` | 3001        | Static marketing site served by nginx.                                    |

Open:

- dApp → http://localhost:3000
- Marketing → http://localhost:3001
- x402 server → http://localhost:8402
- MCP server → http://localhost:8405
- MinIO console → http://localhost:9001 (user/pass = `S3_ACCESS_KEY` / `S3_SECRET_KEY`)

Stop with `Ctrl-C`, or `make down` from another shell.

## Images

All Dockerfiles are multi-stage and pin their base image tags; the pnpm store
and the cargo registry/git are mounted as BuildKit caches so re-builds are fast.

- **`Dockerfile.node`** — pnpm + Turborepo base (`corepack pnpm@9.15.4`,
  `node:20.18.1-slim`). `deps` (frozen install) → `builder` (`turbo run build
--filter=$APP...` + a `--prod` prune) → non-root `runner`. The `APP` build
  arg (a pnpm filter scope) selects which workspace runs; one image powers
  `agent`, `x402-server`, and `mcp-server`.
- **`Dockerfile.web`** — builds the Next.js **standalone** output and runs it
  with `node apps/web/server.js` (no pnpm at runtime), non-root.
- **`Dockerfile.marketing`** — `next build` **static export** → `out/`, served
  by `nginx:alpine` using `docker/nginx/marketing.conf`.
- **`Dockerfile.contracts`** — Rust `nightly-2026-01-01` (rustfmt, clippy,
  `wasm32-unknown-unknown`) + `cargo install cargo-odra` + Node/pnpm. Builds
  the wasm contracts and runs `tsx scripts/deploy-testnet.ts` /
  `scripts/seed-demo.ts`. Cargo registry/git and the contracts target dir are
  cached.

### nginx configs (`docker/nginx/`)

- `marketing.conf` — static-serve config baked into the marketing image
  (gzip, immutable caching for `/_next/static`, `.html` fallback, `/healthz`).
- `nginx.prod.conf` — production reverse proxy (mounted by the prod overlay):
  `casperproof.com` → marketing, `app.casperproof.com` → web. TLS-ready — drop
  certs into the `certbot-certs` volume and uncomment the 443 blocks.

## Deploy + seed

```bash
make deploy-testnet   # build wasm + deploy (mock unless testnet keys present)
make seed             # seed demo attestations + insurance policies
```

Both run the `deployer` image. With no `CASPER_SECRET_KEY_PATH` /
`CSPR_CLOUD_TOKEN`, the scripts run in **mock mode** and record any missing
secrets in `SETUP_NEEDED.md`. The deployer writes the deployed contract hashes
into the shared `contracts-out` volume (`.env.local`).

## Production overlay

```bash
make up-prod
# = docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

The overlay adds: `NODE_ENV=production`, `restart: unless-stopped`, per-service
CPU/memory limits, JSON log rotation, and an **`nginx`** reverse proxy on
80/443 (the app/marketing host ports are unpublished via the `ports: !reset []`
override — traffic flows through nginx). The `!reset` tag requires **Docker
Compose v2.24+**. Enable TLS by dropping certs in the `certbot-certs` volume and
uncommenting the 443 blocks in `nginx.prod.conf`; an optional `certbot` sidecar
for automated Let's Encrypt issuance is sketched (commented) in the overlay.

## Make targets

Run `make help` for the self-documenting list:

| Target           | Does                                                             |
| ---------------- | ---------------------------------------------------------------- |
| `install`        | `pnpm install` + `cargo fetch`.                                  |
| `up`             | Build + start the full local stack (foreground).                 |
| `up-prod`        | Start the prod overlay, detached.                                |
| `down`           | Stop + remove containers/networks (keeps volumes).               |
| `logs`           | Tail all service logs.                                           |
| `deploy-testnet` | Build wasm + deploy contracts.                                   |
| `seed`           | Seed demo data.                                                  |
| `test`           | `cargo test` + `pnpm turbo run test` (e2e noted).                |
| `coverage`       | `pnpm turbo run test:coverage` (>90% gate).                      |
| `lint`           | turbo lint+typecheck + `prettier --check` + `cargo fmt --check`. |
| `build`          | `pnpm turbo run build` + `cargo odra build`.                     |
| `config`         | Validate the merged compose config (base + prod).                |
| `clean`          | Tear down + clean build artifacts.                               |

## CI (`.github/workflows/`)

- **`ci.yml`** — lint+typecheck → Rust (fmt check, `clippy -D warnings`,
  `cargo test`) → TS `turbo run test:coverage` with the **>90% gate** enforced
  by the shared vitest preset. Caches pnpm store + cargo.
- **`e2e.yml`** — brings the stack up via compose and runs Playwright from
  `e2e/`; gated to manual dispatch or the `e2e` PR label. Uploads the report.
- **`release.yml`** — on a `v*` tag, builds all images (matrix) with GHA layer
  cache and cuts a GitHub release. Registry push is wired but commented.

## SETUP_NEEDED

These are required for the images to build/run as designed, but are outside the
DevOps surface (they live in app/contract source, which DevOps does not edit):

1. **`apps/web/next.config.mjs` needs `output: 'standalone'`.** `Dockerfile.web`
   copies `.next/standalone` + `.next/static`. Without standalone output, add:
   ```js
   const nextConfig = { output: 'standalone' /* ...existing... */ };
   ```
2. **`apps/marketing` needs a `next.config.mjs` with `output: 'export'`** (and,
   if deployed under a subpath, `images: { unoptimized: true }`).
   `Dockerfile.marketing` copies `apps/marketing/out`.
3. **`scripts/deploy-testnet.ts` and `scripts/seed-demo.ts`** are referenced by
   the root `package.json` and the deployer but the `scripts/` directory is
   currently empty. The `deployer` service / `make deploy-testnet` will fail
   until these exist (they should run in mock mode with no secrets).
4. **Health endpoints:** the `x402-server` healthcheck hits `/health`. Ensure
   the Fastify server exposes it (the `web` check hits `/`).
5. **Testnet secrets (real deploy only):** `CASPER_SECRET_KEY_PATH` (PEM) and
   `CSPR_CLOUD_TOKEN`. Get test CSPR from https://testnet.cspr.live/tools/faucet.
   Local `make up` needs none of these.
