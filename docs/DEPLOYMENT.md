# Deployment

CasperProof runs as a Docker Compose stack with one-command bring-up. Everything works offline in
mock mode with **no secrets**; real Casper Testnet data, micropayments, and storage are opt-in
via env vars (see [`../SETUP_NEEDED.md`](../SETUP_NEEDED.md)).

## Local (Docker)

```bash
cp .env.example .env
make up          # build + start the full stack in the foreground (Ctrl-C to stop)
```

`make up` boots the full stack with no host dependency beyond Docker. Postgres/Redis are
intentionally omitted — the SDK uses in-memory fixtures and MinIO for payloads.

Common targets (run `make` / `make help` for the full list):

| Target                | What it does                                                                 |
| --------------------- | ---------------------------------------------------------------------------- |
| `make up`             | Build + start the full local stack (foreground).                             |
| `make up-prod`        | Start the production overlay, detached (nginx, restart policies, TLS-ready). |
| `make down`           | Stop and remove containers/networks (keeps named volumes).                   |
| `make logs`           | Tail logs from all services.                                                 |
| `make deploy-testnet` | Build WASM + deploy contracts (mock unless testnet keys set).                |
| `make seed`           | Seed demo attestations + insurance policies.                                 |
| `make test`           | `cargo test` (contracts) + `pnpm turbo run test` (TS).                       |
| `make build`          | `pnpm turbo run build` + `cargo odra build` (WASM).                          |
| `make config`         | Validate the merged compose config (base + prod overlay).                    |
| `make clean`          | Stop the stack + remove build artifacts (keeps volumes).                     |

## Service map and ports

Defined in `docker-compose.yml`. All env values are sourced from `.env`.

| Service       | Image / build                                         | Host port                     | Role                                                                                                            |
| ------------- | ----------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ollama`      | `ollama/ollama`                                       | `11434`                       | Local LLM backend (zero-cost agent runtime). Pulls `OLLAMA_MODEL` on first run.                                 |
| `minio`       | `minio/minio`                                         | `9000` (S3), `9001` (console) | S3-compatible payload store.                                                                                    |
| `minio-init`  | `minio/mc`                                            | —                             | One-shot: creates the payload bucket, sets public-read, then exits.                                             |
| `deployer`    | `docker/Dockerfile.contracts`                         | —                             | One-shot: WASM build + testnet deploy (mock unless keys present); writes hashes to a shared volume, then exits. |
| `agent`       | `docker/Dockerfile.node` (`@casperproof/agent`)       | —                             | Zero-cost runtime: risk-scorer, attestor, verifier, Ollama loop.                                                |
| `x402-server` | `docker/Dockerfile.node` (`@casperproof/x402-server`) | `8402`                        | x402-gated resource server (Fastify).                                                                           |
| `mcp-server`  | `docker/Dockerfile.node` (`@casperproof/mcp-server`)  | `8405`                        | MCP tools (HTTP transport in compose).                                                                          |
| `web`         | `docker/Dockerfile.web`                               | `3000`                        | Next.js dApp dashboard.                                                                                         |
| `marketing`   | `docker/Dockerfile.marketing`                         | `3001` (→ container `80`)     | Static marketing site (nginx).                                                                                  |

Quick links after `make up`:

- dApp → http://localhost:3000
- Marketing → http://localhost:3001
- x402 server → http://localhost:8402 (`/health` for a readiness probe)
- MinIO console → http://localhost:9001

Startup ordering uses health/completion conditions: `agent` waits for `ollama` healthy and
`minio-init` complete; `x402-server`/`mcp-server` wait for `minio-init`; `web` waits for the
servers.

## Production overlay

```bash
make up-prod
# = docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

The overlay (`docker-compose.prod.yml`) layers production posture onto the base stack:
`NODE_ENV=production`, restart policies, CPU/memory limits, JSON log rotation, and an **nginx**
reverse proxy. In prod the app/marketing/server host ports are reset (`ports: !reset []`) — they
are reached only through nginx, not published directly.

### nginx routing (`docker/nginx/nginx.prod.conf`)

| Host                                     | Upstream                                                 |
| ---------------------------------------- | -------------------------------------------------------- |
| `casperproof.com`, `www.casperproof.com` | `marketing:80` (static export)                           |
| `app.casperproof.com`                    | `web:3000` (Next.js standalone, WebSocket-upgrade aware) |

TLS is ready to enable: drop certs at `/etc/nginx/certs` and uncomment the `443` server blocks in
`nginx.prod.conf`. An optional `certbot` sidecar (commented in `docker-compose.prod.yml`) can
issue/renew Let's Encrypt certs into the shared `certbot-certs` volume; the HTTP server already
serves the `/.well-known/acme-challenge/` path. After enabling TLS, switch the port-80 `location /`
block to a `301` redirect to https.

## Testnet deploy flow

```bash
make deploy-testnet   # docker compose run --rm deployer pnpm exec tsx scripts/deploy-testnet.ts
make seed             # docker compose run --rm deployer pnpm exec tsx scripts/seed-demo.ts
```

The deployer container builds the contract WASM (`cargo odra build`) and deploys. Behaviour
depends on whether testnet secrets are present:

- **Mock (default, no secrets):** `scripts/deploy-testnet.ts` writes deterministic placeholder
  package hashes to `.env.local` so the dApp, agents, and x402 server bind to something. Nothing
  goes on-chain.
- **Live:** requires both secrets below. Real on-chain submission is delegated to the deployer
  container / `casper-client` (`cargo odra build` → `casper-client put-deploy`). Real package
  hashes from the deploy receipts replace the placeholders.

Required env vars for a real testnet deploy (otherwise mock):

| Var                      | Purpose                                |
| ------------------------ | -------------------------------------- |
| `CASPER_SECRET_KEY_PATH` | PEM secret key for the deploy account. |
| `CSPR_CLOUD_TOKEN`       | CSPR.cloud access token.               |

Fund the deploy account at the faucet first: https://testnet.cspr.live/tools/faucet. Missing
secrets and the resulting placeholders are recorded in [`../SETUP_NEEDED.md`](../SETUP_NEEDED.md).

## Environment variable reference

Every value has a working local default (from `.env.example`); only the secrets marked
**(REQUIRED FOR TESTNET)** / **(REQUIRED FOR LIVE DATA)** are needed for real network use.

### Runtime

| Var         | Default       | Notes                                |
| ----------- | ------------- | ------------------------------------ |
| `NODE_ENV`  | `development` | `production` under the prod overlay. |
| `LOG_LEVEL` | `info`        |                                      |

### Casper network / deploy

| Var                         | Default                                   | Notes                                                    |
| --------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `CASPER_NODE_URL`           | `https://node.testnet.casper.network/rpc` | Node RPC for write/deploy paths.                         |
| `CASPER_NETWORK_NAME`       | `casper-test`                             |                                                          |
| `CASPER_SECRET_KEY_PATH`    | _(empty)_                                 | **(REQUIRED FOR TESTNET)** PEM key; blank ⇒ mock deploy. |
| `ATTESTATION_REGISTRY_HASH` | _(empty)_                                 | Populated by `make deploy-testnet` (→ `.env.local`).     |
| `INSURANCE_HASH`            | _(empty)_                                 | Populated by `make deploy-testnet`.                      |
| `STAKE_TOKEN_HASH`          | _(empty)_                                 | Populated by `make deploy-testnet`.                      |
| `USDC_TOKEN_HASH`           | _(empty)_                                 | Populated by `make deploy-testnet`.                      |

### CSPR.cloud (queries + streaming)

| Var                        | Default                              | Notes                                                             |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `CSPR_CLOUD_REST_URL`      | `https://api.testnet.cspr.cloud`     | REST reads.                                                       |
| `CSPR_CLOUD_STREAMING_URL` | `wss://streaming.testnet.cspr.cloud` | Live events (SSE/WS to the dApp).                                 |
| `CSPR_CLOUD_TOKEN`         | _(empty)_                            | **(REQUIRED FOR LIVE DATA)** presence flips the SDK to live mode. |

### CSPR.click (wallet)

| Var                               | Default       | Notes                         |
| --------------------------------- | ------------- | ----------------------------- |
| `NEXT_PUBLIC_CSPR_CLICK_APP_ID`   | `casperproof` | Real app id for live wallets. |
| `NEXT_PUBLIC_CSPR_CLICK_APP_NAME` | `CasperProof` |                               |

### x402 facilitator

| Var                    | Default                                      | Notes                                                             |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `X402_FACILITATOR_URL` | `https://facilitator.testnet.casper.network` | Empty ⇒ mock verifier.                                            |
| `X402_PRICE_USD`       | `0.01`                                       | Price per gated request (string).                                 |
| `X402_PAY_TO`          | `casperproof-treasury`                       | Account that receives the micropayment.                           |
| `X402_SERVER_PORT`     | `8402`                                       |                                                                   |
| `X402_MOCK`            | _(unset)_                                    | `true` forces the mock verifier even if a facilitator URL is set. |

### MCP server

| Var               | Default | Notes                                              |
| ----------------- | ------- | -------------------------------------------------- |
| `MCP_SERVER_PORT` | `8405`  |                                                    |
| `MCP_TRANSPORT`   | `stdio` | Set to `http` in compose so the dApp can reach it. |

### Agent runtime (zero-cost)

| Var                      | Default               | Notes                                                                                                           |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `LLM_BACKEND`            | `ollama`              | `ollama` \| `none` (pure deterministic) \| `openai` \| `anthropic` (paid backends off by default — they throw). |
| `OLLAMA_HOST`            | `http://ollama:11434` |                                                                                                                 |
| `OLLAMA_MODEL`           | `llama3.1:8b`         |                                                                                                                 |
| `AGENT_POLL_INTERVAL_MS` | `5000`                | Runtime loop poll interval.                                                                                     |

### S3-compatible payload store

| Var                   | Default                 | Notes                                      |
| --------------------- | ----------------------- | ------------------------------------------ |
| `S3_ENDPOINT`         | `http://minio:9000`     | Unset ⇒ in-memory backend (offline/tests). |
| `S3_REGION`           | `us-east-1`             |                                            |
| `S3_BUCKET`           | `casperproof-payloads`  |                                            |
| `S3_ACCESS_KEY`       | `casperproof`           |                                            |
| `S3_SECRET_KEY`       | `casperproof-secret`    |                                            |
| `S3_FORCE_PATH_STYLE` | `true`                  | Required by MinIO.                         |
| `S3_PUBLIC_URL`       | `http://localhost:9000` |                                            |

### Web / marketing

| Var                           | Default                   | Notes |
| ----------------------------- | ------------------------- | ----- |
| `NEXT_PUBLIC_APP_URL`         | `http://localhost:3000`   |       |
| `NEXT_PUBLIC_MARKETING_URL`   | `http://localhost:3001`   |       |
| `NEXT_PUBLIC_X402_SERVER_URL` | `http://localhost:8402`   |       |
| `NEXT_PUBLIC_SITE_URL`        | `https://casperproof.com` |       |

## API documentation generation

Both are optional and not run as part of the build (they can be heavy). See [`API.md`](./API.md)
for details.

- TypeScript (SDK + agent + commitment): `npx typedoc` (config in `typedoc.json`, output to
  `docs/api`).
- Rust (contracts): `cargo doc -p casperproof-contracts --no-deps`.
