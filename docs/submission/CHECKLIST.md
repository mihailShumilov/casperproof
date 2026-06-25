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

| # | DoraHacks field | Status | Satisfied by |
| - | --- | --- | --- |
| 1 | BUIDL name | ✅ done | "CasperProof" — [`BUIDL.md`](./BUIDL.md) |
| 2 | Tagline / short intro | ✅ done | "The verifiable AI oracle and trust layer for the agent economy on Casper. Proof your agents can't fake." — [`BUIDL.md`](./BUIDL.md) |
| 3 | Full description (problem / solution / how it works) | ✅ done | [`BUIDL.md`](./BUIDL.md) (Problem, Solution, How it works, Architecture) |
| 4 | Track / category selection | ✅ done (selection) | **Agentic AI** (DeFi & Payments secondary) — [`BUIDL.md`](./BUIDL.md). Confirm track names on the live form. |
| 5 | Architecture / technical detail | ✅ done | [`BUIDL.md`](./BUIDL.md) diagram + [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../COMMITMENT.md`](../COMMITMENT.md), [`../CONTRACTS.md`](../CONTRACTS.md) |
| 6 | Source code / GitHub repo | ✅ done | https://github.com/mihailShumilov/casperproof (public, MIT) |
| 7 | Open-source license | ✅ done | MIT — [`../../LICENSE`](../../LICENSE); originality in [`../../NOTICE.md`](../../NOTICE.md) |
| 8 | Demo video | 🟡 pending | `TODO(video): hosted demo video URL` — script ready in [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md); record after testnet deploy. Source: [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §5 |
| 9 | Live demo / app URL | 🟡 pending | Local stack runs now (`make up` → http://localhost:29300). Public `app.casperproof.com` not yet hosted. |
| 10 | Team members | ✅ done | Mihail Shumilov (solo) — [`BUIDL.md`](./BUIDL.md) Team section |
| 11 | Progress / milestones during hackathon | ✅ done | [`../../STATUS.md`](../../STATUS.md) + [`../../CHANGELOG.md`](../../CHANGELOG.md) |
| 12 | Logo / cover image | 🟡 pending | Brand favicon exists (`apps/web/public`); production **OG image** pending — [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §5 |
| 13 | On-chain activity (Final Round eligibility) | 🟡 pending | **Contracts not yet deployed to testnet.** Deploy + run the 3 demo txs — [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 |

## On-chain deploy artifacts (all pending — blocked on testnet deploy)

| Item | Status | Placeholder | Source of truth |
| --- | --- | --- | --- |
| `AttestationRegistry` package hash | 🟡 pending | `TODO(deploy): real package hash` | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 |
| `Insurance` package hash | 🟡 pending | `TODO(deploy): real package hash` | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 |
| `StakeToken` (STAKE) package hash | 🟡 pending | `TODO(deploy): real package hash` | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 |
| `MockUsdc` (USDC) package hash | 🟡 pending | `TODO(deploy): real package hash` | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 |
| `submit_attestation` tx (cspr.live) | 🟡 pending | `TODO(deploy): real cspr.live link` | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 |
| `claim` tx (cspr.live) | 🟡 pending | `TODO(deploy): real cspr.live link` | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 |
| `resolve` / slash tx (cspr.live) | 🟡 pending | `TODO(deploy): real cspr.live link` | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1 |
| Contract WASM (`cargo odra build`) | ⚙️ CI / dev machine | — | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §6 (logic verified via 40 MockVM tests) |

## Community vote (CSPR.fans)

| Item | Status | Placeholder | Source |
| --- | --- | --- | --- |
| CSPR.fans listing created | 🟡 pending | `TODO(cspr.fans): listing URL` | [`VOTING_PACK.md`](./VOTING_PACK.md) |
| Share copy (hook, blurb, posts) | ✅ done | — | [`VOTING_PACK.md`](./VOTING_PACK.md) |

## Configuration placeholders (for a live demo / production)

| Item | Status | Placeholder | Source |
| --- | --- | --- | --- |
| CSPR.click app id | 🟡 pending | `TODO(cspr.click): app id` (`NEXT_PUBLIC_CSPR_CLICK_APP_ID`) | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §4 |
| x402 facilitator URL | 🟡 pending | `X402_FACILITATOR_URL` (mock until set) | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §2 |
| CSPR.cloud token (live reads/stream) | 🟡 pending | `CSPR_CLOUD_TOKEN` (mock until set) | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §1–2 |
| Object storage creds (R2 / S3) | 🟡 pending | `S3_*` (in-memory/MinIO until set) | [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §3 |

## Build-quality evidence (no action needed — already done)

| Item | Status | Evidence |
| --- | --- | --- |
| Cross-language commitment parity | ✅ done | TS ⇆ Rust golden vectors; runs in CI — [`../COMMITMENT.md`](../COMMITMENT.md) |
| Test coverage (>90% line + branch gate) | ✅ done | ~400 TS tests + 40 Rust tests — [`../../STATUS.md`](../../STATUS.md) |
| Security review gate | ✅ done (GO) | [`../../STATUS.md`](../../STATUS.md) "Final gates" + [`../../SECURITY.md`](../../SECURITY.md) |
| QA gate | ✅ done (GO) | [`../../STATUS.md`](../../STATUS.md) "Final gates" |
| Docker one-command up | ✅ done | `cp .env.example .env && make up` — [`../../README.md`](../../README.md) |

---

## Open TODO placeholders (fill after testnet deploy + video)

These are the **only** blockers between this package and a complete submission:

1. `TODO(deploy): real package hash` ×4 — the four contract package hashes (after `make deploy-testnet` with §1 secrets).
2. `TODO(deploy): real cspr.live link` ×3 — `submit_attestation`, `claim`, `resolve`/slash deploy links (after `make seed` on the live deploy).
3. `TODO(video): hosted demo video URL` — record using [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md), then host.
4. `TODO(cspr.fans): listing URL` — create the CSPR.fans listing, paste into [`VOTING_PACK.md`](./VOTING_PACK.md) posts.
5. `TODO(cspr.click): app id` — register the CSPR.click app id (for a live-wallet demo).
6. Production **OG image** + public **app URL** (optional polish — [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md) §5).

Everything else is ✅ and traceable to repo code/tests. _Testnet-only, unaudited._
