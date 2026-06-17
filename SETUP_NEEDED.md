# SETUP_NEEDED

This file is the single checklist of values that are **not known until you provision real
infrastructure**. Everything in this repo boots and runs end-to-end in **mock mode** with none
of these — `cp .env.example .env && make up` works offline with zero secrets. Supply the items
below only when you want live Casper Testnet data, real micropayments, real object storage, or
the published demo assets.

Anywhere the docs show a value like `<SET: …>` or `TBD — see SETUP_NEEDED.md`, the concrete
value lands here once provisioned. **Do not hand-edit placeholder hashes into the docs** — the
deploy/seed scripts emit the real ones.

## 1. Casper Testnet deploy (real on-chain contracts)

Required to replace the deterministic mock package hashes with real ones.

| Secret | Env var | Where to get it |
|---|---|---|
| Deploy account PEM secret key | `CASPER_SECRET_KEY_PATH` | Generate a key pair, then fund it at the faucet (below). |
| CSPR.cloud access token | `CSPR_CLOUD_TOKEN` | https://console.cspr.cloud (free tier). |

- **Faucet (testnet CSPR for gas):** https://testnet.cspr.live/tools/faucet
- **Explorer:** https://testnet.cspr.live
- Run: `make deploy-testnet` (builds wasm via `cargo odra build`, deploys, writes hashes to
  `.env.local`). Without the two secrets above the deployer runs a **mock deploy** and writes
  deterministic placeholder hashes so downstream services still bind to something.

### Deployed addresses (fill in after a real deploy)

`make deploy-testnet` writes these into `.env.local` (one-shot `deployer` container). Copy the
real package hashes here once a live deploy succeeds:

| Contract | Env var | Value |
|---|---|---|
| `AttestationRegistry` | `ATTESTATION_REGISTRY_HASH` | `<SET: package hash from deploy receipt>` |
| `Insurance` | `INSURANCE_HASH` | `<SET: package hash from deploy receipt>` |
| `StakeToken` (CEP-18 STAKE) | `STAKE_TOKEN_HASH` | `<SET: package hash from deploy receipt>` |
| `MockUsdc` (CEP-18 USDC) | `USDC_TOKEN_HASH` | `<SET: package hash from deploy receipt>` |

### On-chain demo transactions (CSPR.live links)

The demo produces three on-chain writes (`submit_attestation`, `claim`, `resolve`/slash). After
running `make seed` against a live deploy, record their CSPR.live deploy links here:

| Tx | CSPR.live link |
|---|---|
| `submit_attestation` | `<SET: https://testnet.cspr.live/deploy/…>` |
| `claim` (insurance payout) | `<SET: https://testnet.cspr.live/deploy/…>` |
| `resolve` (slash) | `<SET: https://testnet.cspr.live/deploy/…>` |

## 2. x402 facilitator (real micropayments)

| Var | Default (mock) | Real |
|---|---|---|
| `X402_FACILITATOR_URL` | empty ⇒ mock verifier accepts any signed `X-PAYMENT` | `https://facilitator.testnet.casper.network` |
| `X402_PAY_TO` | `casperproof-treasury` | the treasury account that receives micropayments |

With `X402_FACILITATOR_URL` unset (or `X402_MOCK=true`), the server uses the local mock verifier.

## 3. Object storage (payloads)

| Var | Local (MinIO, in compose) | Prod |
|---|---|---|
| `S3_ENDPOINT` | `http://minio:9000` | Cloudflare R2 / AWS S3 endpoint |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `casperproof` / `casperproof-secret` | provider credentials |

When `S3_ENDPOINT` is unset, the agent/SDK use an in-memory store (offline/tests).

## 4. Wallet (CSPR.click)

| Var | Default | Real |
|---|---|---|
| `NEXT_PUBLIC_CSPR_CLICK_APP_ID` | `casperproof` | the app id registered with CSPR.click |

The dApp ships with a mock connector (deterministic test account) so it works with no extension.

## 5. Demo video

| Asset | Value |
|---|---|
| Walkthrough video URL | `<SET: hosted demo video URL>` — see [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) |

## 6. Build-environment notes (what couldn't run in the build sandbox)

The build sandbox could reach the npm registry and crates.io but **GitHub and most CDNs were
blocked**, and `casper-client` was not installed. None of this blocks the codebase — the items
below are run on a normal dev machine or in CI, where they work.

| Item | Status in sandbox | What a human / CI does |
|---|---|---|
| `cargo odra build` → contract **wasm** | not produced here | Run on a machine with network for the Casper backend crates; `make deploy-testnet` / `docker build -f docker/Dockerfile.contracts` does this. Contracts are fully verified via `cargo test` (MockVM, 30 tests) + the commitment parity test. |
| Real on-chain **deploy signing** | not bundled | `casper-js-sdk` is intentionally **not** a dependency (kept the build lean/offline). Wire it (or `casper-client put-deploy`) in `scripts/deploy-testnet.ts` for live submission; needs the §1 secrets. |
| **Playwright** browser binaries | could not download | `pnpm --filter @casperproof/e2e exec playwright install chromium` then `pnpm --filter @casperproof/e2e test` (CI `e2e.yml` does this). Specs are written + typechecked against the real dApp DOM. |
| **Ollama** model pull | n/a (no model pulled) | `docker compose up ollama` pulls `${OLLAMA_MODEL}` (default `llama3.1:8b`) on first run. The agent runs fully without it via `LLM_BACKEND=none` (deterministic). |
| `cargo odra new` template | failed (GitHub) | Not needed — the contract crate is already scaffolded. |
| GitHub Actions live run | n/a | Workflows under `.github/workflows/` run on GitHub's infra where network is available. |

**Bottom line:** `cp .env.example .env && make up`, the full TS + contract test suites, and the
`make seed` demo arc all run with **zero secrets**. The §1–§5 items unlock live testnet data,
real micropayments/storage, and the published video.
