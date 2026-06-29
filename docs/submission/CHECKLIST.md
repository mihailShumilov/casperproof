# CasperProof — Submission Checklist

Maps each DoraHacks BUIDL submission field to its current status and the file/link that satisfies
it. **Legend:** ✅ done · 🟡 pending (needs a real value) · ⚙️ runs in CI / on a dev machine.

> **Provenance:** the DoraHacks BUIDL detail page is a client-rendered SPA and was **not
> machine-readable** here (HTTP 405). Field names below follow the **standard DoraHacks BUIDL
> submission form** plus the buildathon rules confirmed via official Casper/DoraHacks announcements
> (Qualification Round **June 1–30, 2026**; tracks Agentic AI / DeFi & Payments / Cross-Chain / RWA;
> **CSPR.fans** community vote; **functional prototype with on-chain activity** required for Final
> Round eligibility). Re-verify exact field labels against the live form before final submit.

## Required submission fields

| #   | DoraHacks field                                      | Status              | Satisfied by                                                                                                                                                                          |
| --- | ---------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | BUIDL name                                           | ✅ done             | "CasperProof" — [`BUIDL.md`](./BUIDL.md)                                                                                                                                              |
| 2   | Tagline / short intro                                | ✅ done             | "The verifiable AI oracle and trust layer for the agent economy on Casper. Proof your agents can't fake." — [`BUIDL.md`](./BUIDL.md)                                                  |
| 3   | Full description (problem / solution / how it works) | ✅ done             | [`BUIDL.md`](./BUIDL.md) (Problem, Solution, How it works, Architecture)                                                                                                              |
| 4   | Track / category selection                           | ✅ done (selection) | **Agentic AI** (DeFi & Payments secondary) — [`BUIDL.md`](./BUIDL.md). Confirm track names on the live form.                                                                          |
| 5   | Architecture / technical detail                      | ✅ done             | [`BUIDL.md`](./BUIDL.md) diagram + [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../COMMITMENT.md`](../COMMITMENT.md), [`../CONTRACTS.md`](../CONTRACTS.md)                           |
| 6   | Source code / GitHub repo                            | ✅ done             | https://github.com/mihailShumilov/casperproof (public, MIT)                                                                                                                           |
| 7   | Open-source license                                  | ✅ done             | MIT — [`../../LICENSE`](../../LICENSE); originality in [`../../NOTICE.md`](../../NOTICE.md)                                                                                           |
| 8   | Demo video                                           | 🟡 pending          | `TODO(video): hosted demo video URL` — script ready in [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md); record after testnet deploy. Source: [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §5 |
| 9   | Live demo / app URL                                  | ✅ done             | dApp **https://app.casperproof.com** · marketing **https://casperproof.com** (Cloudflare-fronted HTTPS, verified 200). Local stack also runs via `make up` → http://localhost:29300.  |
| 10  | Team members                                         | ✅ done             | Mihail Shumilov (solo) — [`BUIDL.md`](./BUIDL.md) Team section                                                                                                                        |
| 11  | Progress / milestones during hackathon               | ✅ done             | [`../../STATUS.md`](../../STATUS.md) + [`../../CHANGELOG.md`](../../CHANGELOG.md)                                                                                                     |
| 12  | Logo / cover image                                   | 🟡 pending          | Brand favicon exists (`apps/web/public`); production **OG image** pending — [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §5                                                       |
| 13  | On-chain activity (Final Round eligibility)          | ✅ done             | **Deployed to `casper-test` (Casper 2.2.2).** 4 contracts installed + the 3 demo txs (`submit_attestation`, `claim`, `resolve`/slash) on-chain — see the artifacts table below and [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 |

## On-chain deploy artifacts (live on `casper-test`, Casper 2.2.2)

> Deployer account: `0172d6cdabe89d79827153d6c4974e28d11d17c4ef05267bf63541fff600dc6aa4`.
> Captured artifacts: [`../../deploy-out/onchain.json`](../../deploy-out/onchain.json) (installs) and
> [`../../deploy-out/arc.json`](../../deploy-out/arc.json) (demo arc). Step-by-step procedure and the
> `.env` to fill: [`DEPLOY_RUNBOOK.md`](./DEPLOY_RUNBOOK.md).
> Note: the released Odra 2.8.x **livenet binary** is incompatible with the current Casper 2.2.2
> testnet (its casper-client 4.x `TransactionV1` serialization is rejected). The working deploy path
> is a **casper-js-sdk v5** script (`apps/web/deploy-onchain.cjs` for the 4 installs,
> `apps/web/arc-onchain.cjs` for the demo arc); the wasm is post-processed with
> `wasm-opt --signext-lowering --llvm-memory-copy-fill-lowering` because the Casper VM rejects
> bulk-memory/sign-ext ops. Contracts are Odra 2.8.1, verified via 30 MockVM tests + the TS⇆Rust
> commitment parity test.

| Item                                | Status   | Value                                                                | Explorer                                                                                                                                                                                                                            |
| ----------------------------------- | -------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AttestationRegistry` package hash  | ✅ done  | `hash-7ff02eedc0159d2ad2567d939812a56f52979e6f07a11f6741e6ceb72c1658e7` | [package](https://testnet.cspr.live/contract-package/7ff02eedc0159d2ad2567d939812a56f52979e6f07a11f6741e6ceb72c1658e7) · [install tx](https://testnet.cspr.live/transaction/05c2ce231cdd6fc55dd8c2a86436ae0b431a0f8944dd07a42c48b4abae5e85ee) |
| `Insurance` package hash            | ✅ done  | `hash-97734727898835d7f99b280f5705e878d54e7ad5ade90620ed8b0fc74f6d9d07` | [package](https://testnet.cspr.live/contract-package/97734727898835d7f99b280f5705e878d54e7ad5ade90620ed8b0fc74f6d9d07) · [install tx](https://testnet.cspr.live/transaction/c9a08188db9b15760715035326afa8e128ef1e65e6f155d89175b0b196037ac8) |
| `StakeToken` (STAKE) package hash   | ✅ done  | `hash-54aa1e56d38f5f3f1ec4488ff2304d9c81520ff99dcbfd20f59d053a7d578dfd` | [package](https://testnet.cspr.live/contract-package/54aa1e56d38f5f3f1ec4488ff2304d9c81520ff99dcbfd20f59d053a7d578dfd) · [install tx](https://testnet.cspr.live/transaction/08566ebb66d9eafcc7c8fbf28650929d985ccc5e3526fcfdd54e32c6c89e3f46) |
| `MockUsdc` (USDC) package hash      | ✅ done  | `hash-369561bdba8e59e2716124bc0bcbad7e7eb035cb44d275aa54fc94b182b6f229` | [package](https://testnet.cspr.live/contract-package/369561bdba8e59e2716124bc0bcbad7e7eb035cb44d275aa54fc94b182b6f229) · [install tx](https://testnet.cspr.live/transaction/958c6e24c630455ba0b9cfc0d06f49fb611a538e6d3cd9d787091d28e826df45) |
| `submit_attestation` tx (cspr.live) | ✅ done  | demo arc tx #1                                                       | [cspr.live](https://testnet.cspr.live/transaction/fcf7e82bf36d71d4ea42b116ead4e889e3f83af4c59f2b4d4bb9f743b9c0e8fa)                                                                                                                |
| `claim` tx (cspr.live)              | ✅ done  | demo arc tx #2                                                       | [cspr.live](https://testnet.cspr.live/transaction/14073730f6156cb14f6416cf309dfb203261745c95d7ecb5300c8a2f83dfabe0)                                                                                                                |
| `resolve` / slash tx (cspr.live)    | ✅ done  | demo arc tx #3                                                       | [cspr.live](https://testnet.cspr.live/transaction/29744fd1253cf76ac6206ae8afd27c1b82ebc91556fd7e344bc73bd4f6fb30ea)                                                                                                                |
| Contract WASM (`cargo odra build`)  | ⚙️ CI / dev machine | wasm-opt post-processed for the Casper VM                            | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §6 (logic verified via 30 MockVM tests + parity)                                                                                                                                  |

## Community vote (CSPR.fans)

| Item                            | Status     | Placeholder                    | Source                               |
| ------------------------------- | ---------- | ------------------------------ | ------------------------------------ |
| CSPR.fans listing created       | 🟡 pending | `TODO(cspr.fans): listing URL` | [`VOTING_PACK.md`](./VOTING_PACK.md) |
| Share copy (hook, blurb, posts) | ✅ done    | —                              | [`VOTING_PACK.md`](./VOTING_PACK.md) |

## Configuration placeholders (for a live demo / production)

| Item                                 | Status     | Placeholder                                                  | Source                                                |
| ------------------------------------ | ---------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| CSPR.click app id                    | 🟡 pending | `TODO(cspr.click): app id` (`NEXT_PUBLIC_CSPR_CLICK_APP_ID`) | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §4   |
| x402 facilitator URL                 | 🟡 pending | `X402_FACILITATOR_URL` (mock until set)                      | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §2   |
| CSPR.cloud token (live reads/stream) | 🟡 pending | `CSPR_CLOUD_TOKEN` (mock until set)                          | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1–2 |
| Object storage creds (R2 / S3)       | 🟡 pending | `S3_*` (in-memory/MinIO until set)                           | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §3   |

## Build-quality evidence (no action needed — already done)

| Item                                    | Status       | Evidence                                                                                      |
| --------------------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| Cross-language commitment parity        | ✅ done      | TS ⇆ Rust golden vectors; runs in CI — [`../COMMITMENT.md`](../COMMITMENT.md)                 |
| Test coverage (>90% line + branch gate) | ✅ done      | ~400 TS tests + 40 Rust tests — [`../../STATUS.md`](../../STATUS.md)                          |
| Security review gate                    | ✅ done (GO) | [`../../STATUS.md`](../../STATUS.md) "Final gates" + [`../../SECURITY.md`](../../SECURITY.md) |
| QA gate                                 | ✅ done (GO) | [`../../STATUS.md`](../../STATUS.md) "Final gates"                                            |
| Docker one-command up                   | ✅ done      | `cp .env.example .env && make up` — [`../../README.md`](../../README.md)                      |

---

## Open TODO placeholders (remaining before a complete submission)

The testnet deploy and on-chain demo arc are now **done** (see the artifacts table above). The only
remaining items are human-provided assets:

1. `TODO(video): hosted demo video URL` — record using [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md), then host.
2. `TODO(cspr.fans): listing URL` — create the CSPR.fans listing, paste into [`VOTING_PACK.md`](./VOTING_PACK.md) posts.
3. `TODO(cspr.click): app id` — register the CSPR.click app id (for a live-wallet demo).
4. Production **OG image** (optional polish — [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §5).

Everything else is ✅ and traceable to repo code/tests + on-chain artifacts. _Testnet-only, unaudited._
