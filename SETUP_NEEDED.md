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

**Done.** CasperProof is **live on Casper testnet** (network `casper-test`, Casper 2.2.2). The four
contracts are installed and the three demo-arc writes are on-chain — the real package hashes and
CSPR.live links are recorded below (and in [`deploy-out/onchain.json`](deploy-out/onchain.json) /
[`deploy-out/arc.json`](deploy-out/arc.json)). Deployer account:
`0172d6cdabe89d79827153d6c4974e28d11d17c4ef05267bf63541fff600dc6aa4`.

The secrets below are what's needed to re-run a deploy from scratch:

| Secret                        | Env var                  | Where to get it                                          |
| ----------------------------- | ------------------------ | -------------------------------------------------------- |
| Deploy account PEM secret key | `CASPER_SECRET_KEY_PATH` | Generate a key pair, then fund it at the faucet (below). |
| CSPR.cloud access token       | `CSPR_CLOUD_TOKEN`       | https://console.cspr.cloud (free tier).                  |

- **Faucet (testnet CSPR for gas):** https://testnet.cspr.live/tools/faucet
- **Explorer:** https://testnet.cspr.live
- **Working deploy path:** a **casper-js-sdk v5** script — `apps/web/deploy-onchain.cjs` does the
  four installs, `apps/web/arc-onchain.cjs` runs the on-chain demo arc. The released Odra 2.8.x
  **livenet binary** (`contracts/bin/livenet.rs`) is **incompatible** with the current Casper 2.2.2
  testnet (its casper-client 4.x `TransactionV1` serialization is rejected), so the js-sdk script is
  used instead. The compiled wasm is post-processed with
  `wasm-opt --signext-lowering --llvm-memory-copy-fill-lowering` because the Casper VM rejects
  bulk-memory/sign-ext ops. Step-by-step: [`docs/submission/DEPLOY_RUNBOOK.md`](docs/submission/DEPLOY_RUNBOOK.md).
- Without the secrets, `make deploy-testnet` still runs a deterministic **mock deploy** so downstream
  services bind to something offline.

### Deployed addresses (live on `casper-test`)

Real package hashes from the live deploy (also in [`deploy-out/onchain.json`](deploy-out/onchain.json)):

| Contract                    | Env var                     | Value                                                                   |
| --------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `AttestationRegistry`       | `ATTESTATION_REGISTRY_HASH` | `hash-7ff02eedc0159d2ad2567d939812a56f52979e6f07a11f6741e6ceb72c1658e7` |
| `Insurance`                 | `INSURANCE_HASH`            | `hash-97734727898835d7f99b280f5705e878d54e7ad5ade90620ed8b0fc74f6d9d07` |
| `StakeToken` (CEP-18 STAKE) | `STAKE_TOKEN_HASH`          | `hash-54aa1e56d38f5f3f1ec4488ff2304d9c81520ff99dcbfd20f59d053a7d578dfd` |
| `MockUsdc` (CEP-18 USDC)    | `USDC_TOKEN_HASH`           | `hash-369561bdba8e59e2716124bc0bcbad7e7eb035cb44d275aa54fc94b182b6f229` |

Explorer (drop the `hash-` prefix): `https://testnet.cspr.live/contract-package/<64hex>` — e.g.
[AttestationRegistry](https://testnet.cspr.live/contract-package/7ff02eedc0159d2ad2567d939812a56f52979e6f07a11f6741e6ceb72c1658e7).
Install txs: [AttestationRegistry](https://testnet.cspr.live/transaction/05c2ce231cdd6fc55dd8c2a86436ae0b431a0f8944dd07a42c48b4abae5e85ee) ·
[Insurance](https://testnet.cspr.live/transaction/c9a08188db9b15760715035326afa8e128ef1e65e6f155d89175b0b196037ac8) ·
[StakeToken](https://testnet.cspr.live/transaction/08566ebb66d9eafcc7c8fbf28650929d985ccc5e3526fcfdd54e32c6c89e3f46) ·
[MockUsdc](https://testnet.cspr.live/transaction/958c6e24c630455ba0b9cfc0d06f49fb611a538e6d3cd9d787091d28e826df45).

### On-chain demo transactions (CSPR.live links)

The demo arc produces three on-chain writes (`submit_attestation`, `claim`, `resolve`/slash). Their
live CSPR.live links (also in [`deploy-out/arc.json`](deploy-out/arc.json)):

| Tx                         | CSPR.live link                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `submit_attestation`       | https://testnet.cspr.live/transaction/fcf7e82bf36d71d4ea42b116ead4e889e3f83af4c59f2b4d4bb9f743b9c0e8fa              |
| `claim` (insurance payout) | https://testnet.cspr.live/transaction/14073730f6156cb14f6416cf309dfb203261745c95d7ecb5300c8a2f83dfabe0              |
| `resolve` (slash)          | https://testnet.cspr.live/transaction/29744fd1253cf76ac6206ae8afd27c1b82ebc91556fd7e344bc73bd4f6fb30ea              |

### Live hosted demo

Cloudflare-fronted HTTPS (verified HTTP 200): dApp **https://app.casperproof.com** · marketing
**https://casperproof.com**.

## 2. x402 facilitator (real micropayments)

| Var                    | Default (mock)                                       | Real                                             |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `X402_FACILITATOR_URL` | empty ⇒ mock verifier accepts any signed `X-PAYMENT` | `https://facilitator.testnet.casper.network`     |
| `X402_PAY_TO`          | `casperproof-treasury`                               | the treasury account that receives micropayments |

With `X402_FACILITATOR_URL` unset (or `X402_MOCK=true`), the server uses the local mock verifier.

## 3. Object storage (payloads)

| Var                               | Local (MinIO, in compose)            | Prod                            |
| --------------------------------- | ------------------------------------ | ------------------------------- |
| `S3_ENDPOINT`                     | `http://minio:9000`                  | Cloudflare R2 / AWS S3 endpoint |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `casperproof` / `casperproof-secret` | provider credentials            |

When `S3_ENDPOINT` is unset, the agent/SDK use an in-memory store (offline/tests).

## 4. Wallet (CSPR.click)

| Var                             | Default       | Real                                  |
| ------------------------------- | ------------- | ------------------------------------- |
| `NEXT_PUBLIC_CSPR_CLICK_APP_ID` | `casperproof` | the app id registered with CSPR.click |

The dApp ships with a mock connector (deterministic test account) so it works with no extension.

## 5. Demo video

| Asset                 | Value                                                                             |
| --------------------- | --------------------------------------------------------------------------------- |
| Walkthrough video URL | `<SET: hosted demo video URL>` — see [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) |

## 6. Build-environment notes (what couldn't run in the build sandbox)

The build sandbox could reach the npm registry and crates.io but **GitHub and most CDNs were
blocked**, and `casper-client` was not installed. None of this blocks the codebase — the items
below are run on a normal dev machine or in CI, where they work.

| Item                                   | Status in sandbox     | What a human / CI does                                                                                                                                                                                                                       |
| -------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cargo odra build` → contract **wasm** | not produced here     | Run on a machine with network for the Casper backend crates; `make deploy-testnet` / `docker build -f docker/Dockerfile.contracts` does this. Contracts are fully verified via `cargo test` (MockVM, 30 tests) + the commitment parity test. |
| Real on-chain **deploy signing**       | done (on testnet)     | Deployed to `casper-test` via a **casper-js-sdk v5** script (`apps/web/deploy-onchain.cjs` installs, `apps/web/arc-onchain.cjs` demo arc). The Odra livenet binary (`contracts/bin/livenet.rs`) compiles but its casper-client 4.x `TransactionV1` serialization is rejected by Casper 2.2.2, so the js-sdk path is used. Real hashes/links in §1. |
| **Playwright** browser binaries        | could not download    | `pnpm --filter @casperproof/e2e exec playwright install chromium` then `pnpm --filter @casperproof/e2e test` (CI `e2e.yml` does this). Specs are written + typechecked against the real dApp DOM.                                            |
| **Ollama** model pull                  | n/a (no model pulled) | `docker compose up ollama` pulls `${OLLAMA_MODEL}` (default `llama3.1:8b`) on first run. The agent runs fully without it via `LLM_BACKEND=none` (deterministic).                                                                             |
| `cargo odra new` template              | failed (GitHub)       | Not needed — the contract crate is already scaffolded.                                                                                                                                                                                       |
| GitHub Actions live run                | n/a                   | Workflows under `.github/workflows/` run on GitHub's infra where network is available.                                                                                                                                                       |

**Bottom line:** `cp .env.example .env && make up`, the full TS + contract test suites, and the
`make seed` demo arc all run with **zero secrets**. The §1–§5 items unlock live testnet data,
real micropayments/storage, and the published video.
