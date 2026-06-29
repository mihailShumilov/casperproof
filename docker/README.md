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

| Service       | Image / Dockerfile            | Host port     | Role                                                                           |
| ------------- | ----------------------------- | ------------- | ------------------------------------------------------------------------------ |
| `ollama`      | `ollama/ollama`               | 29434         | Local LLM backend; pulls `${OLLAMA_MODEL}` on first run.                       |
| `minio`       | `minio/minio`                 | 29900 / 29901 | S3-compatible payload store (+ web console).                                   |
| `minio-init`  | `minio/mc`                    | —             | One-shot: creates `${S3_BUCKET}`, then exits.                                  |
| `deployer`    | `docker/Dockerfile.contracts` | —             | One-shot: builds wasm + deploys contracts (mock unless keys), then exits.      |
| `agent`       | `docker/Dockerfile.node`      | —             | Zero-cost runtime; loops one attest→verify cycle every 30s (Ollama/none).      |
| `x402-server` | `docker/Dockerfile.node`      | 29402         | Pay-per-request resource server (`/health`, `/attestation/:id`, `/verify`).    |
| `mcp-server`  | `docker/Dockerfile.node`      | — (stdio)     | Agent ↔ chain MCP tools over the **stdio** transport (an MCP client pipes it). |
| `web`         | `docker/Dockerfile.web`       | 29300         | Next.js dApp dashboard (standalone).                                           |
| `marketing`   | `docker/Dockerfile.marketing` | 29301         | Static marketing site served by nginx.                                         |

> **Host ports** use a unique `29xxx` block (so they don't collide with other local
> stacks on 3000/9000/11434/…). They're parameterized in `docker-compose.yml`
> (`${WEB_PORT:-29300}`, `${MINIO_API_PORT:-29900}`, …) — override any in `.env`.
> In-container ports stay standard (ollama 11434, minio 9000), so the on-network
> service URLs (`http://ollama:11434`, `http://minio:9000`) are unchanged.

> **Fast local boot (skip the heavy Rust build):** `make up` builds **every** image
> including the `deployer` (`Dockerfile.contracts` = Rust nightly + `cargo install
cargo-odra` + `cargo odra build`), which is a long first build. Since the stack
> runs fully in mock mode without it, you can boot only the long-lived services and
> run the deployer separately:
>
> ```bash
> docker compose up -d --build \
>   ollama minio minio-init agent x402-server mcp-server web marketing
> make deploy-testnet      # build wasm + (mock) deploy on demand
> ```

Open:

- dApp → http://localhost:29300
- Marketing → http://localhost:29301
- x402 server → http://localhost:29402 (e.g. `GET /health`)
- MinIO console → http://localhost:29901 (user/pass = `S3_ACCESS_KEY` / `S3_SECRET_KEY`)
- MCP server → **no HTTP port** (stdio); an MCP client launches `node apps/mcp-server/dist/server.js`.

Stop with `Ctrl-C`, or `make down` from another shell.

## Images

All Dockerfiles are multi-stage and pin their base image tags; the pnpm store
and the cargo registry/git are mounted as BuildKit caches so re-builds are fast.

- **`Dockerfile.node`** — pnpm + Turborepo base (`corepack pnpm@9.15.4`,
  `node:20.18.1-slim`). `deps` (frozen install) → `builder` (`turbo run build
--filter=$APP...` + a `--prod` prune) → non-root `runner`. The `APP` build arg
  (a pnpm filter scope) selects which workspace is built; one image powers
  `agent`, `x402-server`, and `mcp-server`. At **runtime the container execs
  `node "$ENTRY"` directly — never pnpm** (the non-root runner has no access to
  the root-prepared corepack cache, so invoking `pnpm` would make corepack try to
  fetch a package manager online and fail). Each service sets its `ENTRY` build
  arg (e.g. `apps/x402-server/dist/server.js`); the `agent` overrides `command`
  to loop its one-shot cycle, and `mcp-server` runs with `stdin_open`/`tty` so the
  stdio transport stays attached.
- **`Dockerfile.web`** — builds the Next.js **standalone** output and runs it
  with `node apps/web/server.js` (no pnpm at runtime), non-root. Copies
  `apps/web/public` (brand favicon) + `.next/static` alongside the server.
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
`CSPR_CLOUD_TOKEN`, the scripts run in **mock mode** (the live-deploy env vars are
documented in [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)). The deployer writes
the deployed contract hashes into the shared `contracts-out` volume (`.env.local`).

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

## Notes & going live

The local stack is verified to boot end-to-end with **no secrets**: all 7 services
come up (the 5 with healthchecks report `healthy`), the dApp + marketing serve over
HTTP, the x402 gate returns its 402 → opens on `X-PAYMENT`, and the agent logs a
completed `attest → verify (verified:true)` cycle.

Implementation notes wired into the compose stack:

- **`apps/web/next.config.mjs`** sets `output: 'standalone'` and **`apps/web/public/`**
  exists (favicon) — both required by `Dockerfile.web`'s copies. ✔
- **`apps/marketing/next.config.mjs`** sets `output: 'export'` (+ `images.unoptimized`),
  copied by `Dockerfile.marketing`. ✔
- **`scripts/deploy-testnet.ts` / `scripts/seed-demo.ts`** exist and run in mock mode
  with no secrets. ✔
- **`x402-server`** exposes `/health` (used by its healthcheck); **`X402_FACILITATOR_URL`
  is empty by default ⇒ the local mock payment verifier** (offline `402 → pay → serve`).
  Set it to the Casper facilitator URL for real micropayments. ✔

Only real-infrastructure items remain (see [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)):

- **Testnet deploy (real, not mock):** `CASPER_SECRET_KEY_PATH` (PEM) + `CSPR_CLOUD_TOKEN`.
  Get test CSPR from https://testnet.cspr.live/tools/faucet. Local `make up` needs none.
- **Live data / micropayments / object storage:** `CSPR_CLOUD_TOKEN`, `X402_FACILITATOR_URL`,
  real `S3_*` — each falls back to mock/in-memory when unset.
