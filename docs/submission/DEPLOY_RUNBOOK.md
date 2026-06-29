# CasperProof — Testnet Deploy & Hosting Runbook

The step-by-step guide that took CasperProof from **mock mode** to a **live Casper Testnet
deployment** with a hosted dApp. _Testnet-only, unaudited — not for mainnet value._

> **State of the deploy path — done.**
> CasperProof is **live on `casper-test`** (Casper 2.2.2): the four contracts are installed and the
> three demo-arc txs are on-chain. The Odra **livenet binary** (`contracts/bin/livenet.rs`,
> `--features livenet`) compiles (odra `2.8.1`) but is **incompatible** with the current testnet
> (casper-client 4.x `TransactionV1` serialization rejected by node 2.2.2). The deploy was done with a
> **casper-js-sdk v5** script instead — see the next section for exactly how, and `SETUP_NEEDED.md` §1
> + [`CHECKLIST.md`](./CHECKLIST.md) for the real hashes/links. `scripts/deploy-testnet.ts` still keeps
> the zero-secret **mock** path for offline runs.

> ## How it was actually deployed (Casper 2.2.2 / Condor)
> The released **odra 2.8.x livenet binary does NOT work against the current testnet**: its
> casper-client 4.x `TransactionV1` serialization is rejected by node 2.2.2 ("invalid pricing
> mode"); the fix exists only in unreleased odra git HEAD (casper-client 5.0.0). The contracts were
> instead deployed with a **casper-js-sdk v5** script:
> - `apps/web/deploy-onchain.cjs` — installs the 4 contracts (`SessionBuilder` + the odra install-arg
>   convention `odra_cfg_*` + init args), reads each package hash from the deployer account's
>   `<Name>_package_hash` named key (raw RPC `state_get_account_info`).
> - `apps/web/arc-onchain.cjs` — runs the on-chain demo arc (approve, seed vault, attest, buy policy,
>   claim, challenge, resolve/slash) via `ContractCallBuilder`.
> - Node: the **public** `https://node.testnet.casper.network` (cspr.cloud's node proxy 404s on the
>   SSE `/events` the deploy watcher needs).
> - **Mandatory wasm post-processing:** `cargo odra build` then
>   `wasm-opt --signext-lowering --llvm-memory-copy-fill-lowering` (Casper VM rejects bulk-memory /
>   sign-ext). Needs the wasm build harness `contracts/bin/build_contract.rs` + the contract lib `no_std`.
> - Gotcha: Casper `get_block_time()` is **milliseconds**; policy `expiry` must be ms.
>
> Deployed hashes + the 3 demo-tx links live in `deploy-out/{onchain,arc}.json` and are filled into
> [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 + [`CHECKLIST.md`](./CHECKLIST.md).

---

## Working model (who does what)

| Phase | Owner | What |
| --- | --- | --- |
| **1. Implement real deploy + signing** | Builder | ✅ **Done** — deployed with a **casper-js-sdk v5** script (`apps/web/deploy-onchain.cjs` installs, `apps/web/arc-onchain.cjs` demo arc); the Odra livenet binary compiles (ADR [`0007`](../adr/0007-livenet-deploy-via-odra.md)) but is rejected by node 2.2.2, so the js-sdk path is the working one. |
| **2. Provision accounts + secrets** | You | ✅ **Done** — funded testnet key + CSPR.cloud token provisioned; CSPR.click app id still optional/pending. |
| **3. Deploy + seed** | Builder | ✅ **Done** — 4 contracts installed + the 3 demo-arc txs on-chain; hashes/links captured to `deploy-out/{onchain,arc}.json`. |
| **4. Host the dApp** | Builder | ✅ **Done** — `app.casperproof.com` (dApp) + `casperproof.com` (marketing), Cloudflare-fronted HTTPS (verified 200). |
| **5. Fill submission placeholders** | Builder | ✅ **Done** — package hashes + the 3 cspr.live links filled across `docs/submission/`; `TODO(video)` / `TODO(cspr.fans)` / `TODO(cspr.click)` remain. |
| **6. Record video + create CSPR.fans listing** | You | Pending — the screen recording and the CSPR.fans/CSPR.click account actions. |

The faucet funding and CSPR.cloud signup were the only non-delegable human steps (Phase 2). With
those provisioned, build → deploy → seed → host → fill-placeholders ran end-to-end; the deployer
account is `0172d6cdabe89d79827153d6c4974e28d11d17c4ef05267bf63541fff600dc6aa4`.

---

## Requirements

### Accounts / external services

| Need | Where | Required for | Notes |
| --- | --- | --- | --- |
| Casper Testnet key pair, **funded** | `casper-client keygen` + faucet https://testnet.cspr.live/tools/faucet | On-chain deploy | Faucet has a captcha — **human step**. ~1000 test CSPR is plenty for gas. |
| CSPR.cloud access token | https://console.cspr.cloud (free tier) | Live reads + deploy submission | Free signup. |
| CSPR.click app id | https://cspr.click | Live wallet in the dApp (optional) | dApp works with a mock connector without it. |
| Domain DNS control | your registrar | Public hosting | `casperproof.com` + `app.casperproof.com` → server IP. |
| Video host | YouTube / Loom / etc. | Submission video | Unlisted is fine. |
| CSPR.fans listing | https://cspr.fans | Community vote | Their account/app flow. |

### Software (build + deploy machine)

| Tool | Version | Why |
| --- | --- | --- |
| Docker + Compose v2 | current | Runs the whole stack incl. the `deployer` (Rust+Node) image — **the easy path** (no host Rust needed). |
| Node.js | ≥ 20 | TS scripts/SDK if running outside Docker. |
| pnpm | 9.15.4 (pinned) | Workspace install. |
| Rust nightly | **nightly-2026-01-01** (pinned in `rust-toolchain.toml`) | `cargo odra build` — only if building WASM **outside** Docker. |
| `cargo-odra` | `--locked` | Drives `cargo odra build` / `test`. |
| `casper-client` | current | Keygen, account-address, optional manual `put-deploy`. |
| `make`, `git`, `wabt`, `binaryen` | current | Build helpers (already in `Dockerfile.contracts`). |

> **Recommended:** use the **Docker path**. `Dockerfile.contracts` already pins nightly-2026-01-01,
> installs `cargo-odra`, `wabt`, `binaryen`, and Node — so you don't install a Rust toolchain on the
> host. `make deploy-testnet` runs the build+deploy inside that container.

### Network egress (from the deploy/runtime machine)

Outbound HTTPS/WSS to:
- `https://node.testnet.casper.network/rpc` (deploys)
- `https://api.testnet.cspr.cloud` + `wss://streaming.testnet.cspr.cloud` (reads/stream)
- `https://testnet.cspr.live` (faucet/explorer, browser)
- crates.io + npm registry + GitHub (first build only)

> ⚠️ The build sandbox has previously had **GitHub/CDN blocked** ([`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §6),
> so building WASM and reaching the Casper node **from there may fail**. If so, the deploy runs on a
> normal dev machine/VPS or over SSH.

### Server sizing

| Profile | vCPU | RAM | Disk | Runs | When |
| --- | --- | --- | --- | --- | --- |
| **Build (Docker)** | 2 | 6–8 GB (Docker allocation) | 15 GB | `Dockerfile.contracts` WASM build | One-time; first build 10–30 min. |
| **Host — lean (no Ollama)** | 2 | 2–4 GB | 10 GB | web + marketing + x402 + agent + minio, `LLM_BACKEND=none` | **Recommended for the demo** — deterministic, no model. |
| **Host — with Ollama** | 4 | 12–16 GB | 25 GB | adds `llama3.1:8b` (~4.7 GB model) | Only if you want live LLM in the loop. |
| **Prod (public)** | 2–4 | 4–8 GB | 20 GB | prod overlay + nginx + certbot on ports 80/443 | `app.casperproof.com` |

A **$12–24/mo VPS** (e.g. 2 vCPU / 4 GB, Ubuntu 22.04) with Docker is enough for the lean public
demo. Keep the demo on `LLM_BACKEND=none` so the box stays small and the demo never depends on model
quality.

---

## The `.env` you fill in

Start from the template and edit only the lines below — every other value has a working default:

```bash
cp .env.example .env
```

```dotenv
# ── REQUIRED for a real testnet deploy ───────────────────────────────────────
CASPER_SECRET_KEY_PATH=/abs/path/to/secret_key.pem   # funded testnet account PEM
CSPR_CLOUD_TOKEN=                                     # from console.cspr.cloud

# ── Network (defaults are correct for testnet; change only if needed) ─────────
CASPER_NODE_URL=https://node.testnet.casper.network/rpc
CASPER_NETWORK_NAME=casper-test
CSPR_CLOUD_REST_URL=https://api.testnet.cspr.cloud
CSPR_CLOUD_STREAMING_URL=wss://streaming.testnet.cspr.cloud

# ── Populated automatically by `make deploy-testnet` → .env.local. Leave blank.
ATTESTATION_REGISTRY_HASH=
INSURANCE_HASH=
STAKE_TOKEN_HASH=
USDC_TOKEN_HASH=

# ── OPTIONAL — live wallet (dApp uses a mock connector if unset) ──────────────
NEXT_PUBLIC_CSPR_CLICK_APP_ID=        # from cspr.click
NEXT_PUBLIC_CSPR_CLICK_APP_NAME=CasperProof

# ── OPTIONAL — real micropayments (mock verifier if unset) ────────────────────
X402_FACILITATOR_URL=                 # e.g. https://facilitator.testnet.casper.network
X402_PAY_TO=                          # treasury account that receives micropayments

# ── OPTIONAL — real object storage (in-memory/MinIO if unset) ─────────────────
S3_ENDPOINT=                          # Cloudflare R2 / AWS S3 endpoint
S3_ACCESS_KEY=
S3_SECRET_KEY=

# ── Production hosting ────────────────────────────────────────────────────────
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.casperproof.com
NEXT_PUBLIC_SITE_URL=https://casperproof.com
LLM_BACKEND=none                      # keep the demo deterministic + the box small
```

**The only two hard-required values are `CASPER_SECRET_KEY_PATH` and `CSPR_CLOUD_TOKEN`.** The full
variable reference (every var + default) is in [`../DEPLOYMENT.md`](../DEPLOYMENT.md#environment-variable-reference).

> 🔐 **Secret handling:** never commit `.env` / the PEM (both are gitignored). If you hand me the key
> to drive the deploy, use a one-time secret channel and **rotate/de-fund it after the demo** — it's
> a throwaway testnet account.

---

## Phase 1 — Code (the real deploy path) [✅ done]

Implemented via Odra's native livenet env (ADR [`0007`](../adr/0007-livenet-deploy-via-odra.md)):

- **`contracts/bin/livenet.rs`** (`--features livenet`) — deploys the 4 contracts in dependency
  order (`StakeToken` → `MockUsdc` → `AttestationRegistry` → `Insurance`) with the init args below,
  sets the CEP-18 allowances, seeds vault capital, and runs the demo arc (attest → buy policy →
  claim → tamper-attest → challenge → slash), printing `CP_RESULT <KEY>=<VALUE>` lines.
- **`scripts/deploy-testnet.ts`** — mock path unchanged; live path spawns the binary, maps the
  `ODRA_CASPER_LIVENET_*` env, and writes the real package hashes (+ best-effort demo-tx links) to
  `.env.local`.
- **§8 hashes** stay in the single TS implementation; the binary takes them via `CP_*` env (with
  deterministic fallbacks), so no canonicalization is duplicated in Rust.
- Verified: `make livenet-build` compiles against odra `2.8.1` / `odra-casper-livenet-env 2.8.1`.

The TS SDK in-dApp write path (`casper-js-sdk` + CSPR.click signing) is a **follow-up** — not
required for on-chain activity (the binary produces it); the dApp reads live state over CSPR.cloud.

Deploy parameters (config defaults baked into the binary; override via `CP_*` env):

| Param | Value | Meaning |
| --- | --- | --- |
| `min_stake` | `1000000000` | 1 STAKE (9 decimals) minimum per attestation |
| `challenge_bond` | `1000000000` | 1 STAKE dispute bond |
| `dispute_window` | `86400` | 24 h (seconds) |
| `reward_bps` | `5000` | 50% of slashed stake → challenger, 50% → treasury |
| `premium_bps` | `500` | 5% premium (0.25 USDC on 5 USDC coverage) |
| `claim_model_id` | `casperproof-claimoracle-v1` | Model the insurance binds claims to |

These match `docs/DEMO_SCRIPT.md` (1-STAKE minimum, 50/50 slash split, 5% premium).

---

## Phase 2 — Provision (you) 

```bash
# 1. Generate a key pair
casper-client keygen ./keys
#    → ./keys/secret_key.pem  (set CASPER_SECRET_KEY_PATH to its absolute path)

# 2. Get the public account address to fund
casper-client account-address --public-key ./keys/public_key.pem

# 3. Fund it at the faucet (browser, captcha):  https://testnet.cspr.live/tools/faucet
# 4. Create a CSPR.cloud token:                 https://console.cspr.cloud
# 5. Put both into .env (CASPER_SECRET_KEY_PATH, CSPR_CLOUD_TOKEN)
```

Helper that prints what to fund: `pnpm fund:testnet` (`scripts/fund-testnet.ts`).

---

## Phase 3 — Deploy + seed

```bash
# 0. (once) verify the deploy binary compiles on this machine:
make livenet-build

# 1. Dry-run — print the exact command + env mapping without touching the chain:
CP_DRY_RUN=true make deploy-testnet-local

# 2. Deploy the 4 contracts + run the on-chain demo arc (real, because the 2 secrets are set).
#    The demo arc produces the three headline txs: submit_attestation, claim, resolve(slash).
make deploy-testnet-local
#   → writes real ATTESTATION_REGISTRY_HASH / INSURANCE_HASH / STAKE_TOKEN_HASH / USDC_TOKEN_HASH
#     and best-effort `# TX <step>=<hash> -> <cspr.live>` lines to .env.local

# Deploy-only (skip the demo arc), e.g. for a first smoke test:
CP_LIVENET_STEP=deploy make deploy-testnet-local
```

`make deploy-testnet-local` runs on the host (needs cargo + the nightly toolchain — both on the
VPS). `make deploy-testnet` does the same inside the `deployer` Docker container if you prefer.

Verify on the explorer (https://testnet.cspr.live): each package hash resolves to a contract, and
the `submit_attestation` / `claim` / `resolve` transactions show as `Success` under the deployer
account. Record those three as the cspr.live submission links.

> **Tx-link note:** package hashes are captured deterministically. The three demo-tx hashes are
> scraped best-effort from the binary's logs; if any are missing, read them from the deployer
> account's transaction list on the explorer. The `casper-client` keygen/faucet steps in Phase 2
> are the only places `casper-client` is needed — the deploy itself uses the Odra livenet binary.

---

## Phase 4 — Host the dApp

**Option A — your Mac / a laptop (quick demo):**
```bash
make up                      # full stack, foreground; dApp at http://localhost:29300
```

**Option B — public VPS (recommended for judging):**
```bash
# On an Ubuntu VPS with Docker, DNS A-records for casperproof.com + app.casperproof.com → its IP:
make up-prod                 # prod overlay: nginx fronts marketing + web on :80
# Enable TLS: drop certs at docker/nginx/certs (or enable the certbot sidecar in
# docker-compose.prod.yml), uncomment the :443 blocks in docker/nginx/nginx.prod.conf,
# switch the :80 location to a 301 → https.
```

nginx routing (from [`../DEPLOYMENT.md`](../DEPLOYMENT.md#production-overlay)):
`casperproof.com` → marketing, `app.casperproof.com` → web (Next.js).

### Live in-dApp writes (sign on-chain via CSPR.click)

Built and unit-tested (the dApp can sign real transactions in the browser), gated by env so the
offline demo is untouched:

- **`@casperproof/casper-sdk`** exposes a typed contract-call ABI (`submitAttestationCall`,
  `challengeCall`, … + `approveCall`) — pure, 100% tested.
- **`apps/web/src/lib/onchain-tx.ts`** turns a call into a `casper-js-sdk` `TransactionV1`
  (`buildTransactionJson`); **`writes.ts`** signs + submits it via CSPR.click `send()`.
- Turn it on by setting, in `.env` (then rebuild the web image): `NEXT_PUBLIC_CSPR_CLICK_APP_ID`
  and the `NEXT_PUBLIC_*_HASH` package hashes (copy from `.env.local` after Phase 3). When unset,
  the dApp stays on the zero-secret mock path.

**Last mile — needs a real wallet + the deployed contracts (I can't browser-test it here):**

1. Mount the **CSPR.click provider/script** in the dApp so `window.csprclick` is available (per
   CSPR.click docs; we read it through `getCsprClick()`), and connect a wallet.
2. Wire the view buttons to `signAndSendCall(challengeCall(id), publicKey)` etc. with the mock
   call as fallback — **challenge / resolve / claim / stake** need no payload and are the natural
   first live actions.
3. A live **`submit_attestation`** additionally needs the payload uploaded to the object store (a
   small server attestor endpoint) so verification can refetch it — until then, drive submits from
   the server attestor / livenet binary and let the dApp read live state.
4. Confirm the CLValue encoding (esp. the CEP-18 `approve` spender `Address`→`Key`) against the
   deployed contracts on a first real signature.

I'll do steps 1–2 (and 3 if you want browser submit) on the VPS once contracts are live and a
wallet is connected.

---

## Phase 5 — Fill the submission placeholders [✅ done]

With Phase 3/4 complete, the on-chain values are filled across `docs/submission/` (tracked in
[`CHECKLIST.md`](./CHECKLIST.md)):

- ✅ 4× package hash ← `deploy-out/onchain.json` (filled in `SETUP_NEEDED.md` §1 + `CHECKLIST.md`)
- ✅ 3× cspr.live link ← `deploy-out/arc.json` (`submit_attestation` / `claim` / `resolve`)
- ⏳ `TODO(video): hosted demo video URL` ← the recording
- ⏳ `TODO(cspr.fans): listing URL` ← the listing
- ⏳ `TODO(cspr.click): app id` ← if a CSPR.click app is registered

---

## What's left

Phases 1–5 are done (contracts live, dApp hosted, on-chain values filled). The only remaining items
are human-provided assets that can't be automated:

1. **Demo video** — the screen recording (`TODO(video)`), per [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).
2. **CSPR.fans listing** — the community-vote listing (`TODO(cspr.fans)`).
3. **CSPR.click app id** — optional, to enable the in-dApp live-wallet write path (`TODO(cspr.click)`).

---

## Offline mode (still available)

The live deploy is done, but the project also demos fully in **mock mode** (`make up` + `make seed`)
with zero secrets and no network — useful for offline development and the test suites. The Final
Round on-chain-activity requirement is **satisfied** by the live `casper-test` deploy (hashes/links in
[`CHECKLIST.md`](./CHECKLIST.md)). _Testnet-only, unaudited._
