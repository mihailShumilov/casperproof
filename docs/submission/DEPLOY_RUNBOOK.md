# CasperProof — Testnet Deploy & Hosting Runbook

The single step-by-step guide to take CasperProof from **mock mode** to a **live Casper Testnet
deployment** with a hosted dApp, then fill every `TODO(deploy)` placeholder in the submission
package. _Testnet-only, unaudited — not for mainnet value._

> **State of the deploy path (updated).**
> The real deploy is now **implemented**: a Rust **Odra livenet binary** (`contracts/bin/livenet.rs`,
> `--features livenet`) deploys the four contracts and runs the on-chain demo arc using Odra's native
> signing/submission (ADR [`0007`](../adr/0007-livenet-deploy-via-odra.md)). `scripts/deploy-testnet.ts`
> keeps the zero-secret **mock** path and, in **live** mode, spawns the binary and captures the real
> package hashes → `.env.local`. Verified to **compile** here (odra `2.8.1` / `odra-casper-livenet-env
> 2.8.1`); the live run itself needs a funded key + node access on the deploy machine (Phase 3).
> The TS SDK in-dApp write path (`casper-js-sdk` + CSPR.click) is a documented follow-up — not needed
> for on-chain activity, which the binary produces.

---

## Working model (who does what)

| Phase | Owner | What |
| --- | --- | --- |
| **1. Implement real deploy + signing** | **Me (Claude)** | ✅ **Done** — Odra livenet binary (`contracts/bin/livenet.rs`) deploys the 4 contracts in order, sets CEP-18 allowances, runs the demo arc, reports real package hashes; `deploy-testnet.ts` parses them → `.env.local`. Compiles clean (ADR [`0007`](../adr/0007-livenet-deploy-via-odra.md)). |
| **2. Provision accounts + secrets** | **You** | Create & **fund** a testnet key (faucet has a human captcha); get a CSPR.cloud token; (optional) CSPR.click app id; choose where it runs. |
| **3. Deploy + seed** | **Me on your VPS (SSH), or you run my exact commands** | `make livenet-build` → set the two secrets → `make deploy-testnet-local` → capture package hashes + demo-tx links. |
| **4. Host the dApp** | **Me on your server (SSH) / you via Docker** | `make up-prod` behind nginx + TLS, DNS for `app.casperproof.com`. |
| **5. Fill submission placeholders** | **Me** | Replace every `TODO(deploy)` / `TODO(video)` / `TODO(cspr.fans)` across `docs/submission/`. |
| **6. Record video + create CSPR.fans listing** | **You** | The faucet captcha, the screen recording, and the CSPR.fans/CSPR.click account actions are yours. |

**Can we do "you give me `.env` and I deploy everything"?** Now yes, with one caveat: the **faucet
funding** and **CSPR.cloud signup** are human steps you can't delegate (Phase 2). The deploy code is
written (Phase 1 ✅). Once you hand me a **funded key PEM + CSPR.cloud token** and SSH to a VPS, I can
drive build → deploy → seed → host → fill placeholders end-to-end.

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

> ⚠️ This Claude sandbox has previously had **GitHub/CDN blocked** ([`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §6),
> so building WASM and reaching the Casper node **from here may fail**. If so, Phase 3 runs on your
> machine/VPS (I provide exact commands) or over SSH.

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

---

## Phase 5 — Fill the submission placeholders [mine]

Once Phase 3/4 succeed, I replace these across `docs/submission/` (tracked in
[`CHECKLIST.md`](./CHECKLIST.md)):

- 4× `TODO(deploy): real package hash` ← `.env.local`
- 3× `TODO(deploy): real cspr.live link` ← `make seed` output
- `TODO(video): hosted demo video URL` ← your recording
- `TODO(cspr.fans): listing URL` ← your listing
- `TODO(cspr.click): app id` ← if you registered one

---

## What to hand me to start

1. **Go/no-go on Phase 1** — should I implement the real deploy + signing code now? (Recommended yes.)
2. **A funded testnet key PEM + CSPR.cloud token** (when ready, via a secure channel) — or tell me
   you'll run Phase 3 yourself and I'll hand you the exact commands.
3. **Where it runs** — this environment, your Mac, or a VPS (SSH or you-run-commands).

I cannot do for you: the faucet captcha, the CSPR.cloud/CSPR.click/CSPR.fans account signups, or the
screen recording. Everything else I can build and drive.

---

## Fallback: stay in mock mode

If a live deploy isn't feasible before the deadline, the project still demos fully in mock mode
(`make up` + `make seed`) and the submission package already documents that honestly. The only items
that would remain `TODO(deploy)` are the on-chain links — which is the eligibility risk called out in
[`CHECKLIST.md`](./CHECKLIST.md) (Final Round wants on-chain activity). _Testnet-only, unaudited._
