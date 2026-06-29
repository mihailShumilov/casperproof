# @casperproof/web

The CasperProof dApp dashboard — a dark, offline-first Next.js 14 (App Router)
front end for the verifiable AI oracle and parametric insurance layer on Casper.

> Proof your agents can't fake.

Everything runs against `@casperproof/casper-sdk` in **mock mode**: a
deterministic, in-memory backend with no secrets and no network. The whole demo
works offline, and `next build` produces a fully static set of pages.

## Routes

| Route        | View       | What it does                                                                                                                                                          |
| ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`          | Home       | Hero, the three-step explainer, and the live event feed.                                                                                                              |
| `/oracle`    | Oracle     | Submit a stake-backed attestation (model id + input/output JSON), list attestations, and **Verify** any one → PASS/FAIL with both the on-chain and recomputed hashes. |
| `/insurance` | Insurance  | Score an address → buy a parametric policy → simulate a covered trigger → automatic payout. Risk gauge + vault-solvency charts (Recharts) + StatTiles.                |
| `/slash`     | Slash demo | Submit → tamper the payload → Verify **FAIL** → challenge → resolve(fraudulent) → slash, with the stake split between challenger and treasury.                        |

Every page embeds the **live feed** (`AttestationSubmitted`, `Challenged`,
`Resolved`, `ClaimPaid`) via `sdk.subscribeEvents`. Because the SDK client is a
shared singleton (see below), an action on one page streams into the feed on
every page within the session.

## Layout

```
src/
  app/
    layout.tsx            Root layout: UI styles + ThemeProvider + WalletProvider + Nav + metadata/OG
    page.tsx              Home (Server Component)
    globals.css           App chrome built on the @casperproof/ui --cp-* tokens (no web fonts)
    oracle/{page,OracleView}.tsx
    insurance/{page,InsuranceView}.tsx
    slash/{page,SlashView}.tsx
  components/
    Nav.tsx               Top nav + active route + wallet button
    WalletButton.tsx      Connect / disconnect (mock CSPR.click)
    LiveFeed.tsx          Streaming event list from sdk.subscribeEvents
    JsonField.tsx         JSON textarea with inline validation
    SolvencyChart.tsx     Recharts wrappers (solvency bars + risk gauge)
    ui.tsx                "use client" re-export of @casperproof/ui (see notes)
  lib/
    sdk.ts                Shared singleton SDK client
    wallet.tsx            Mock CSPR.click connector (context + pure reducer)
    format.ts             Pure helpers: JSON parse/validate, hash + motes formatting, status mapping
    useAttestations.ts    Hook: load/refresh the attestation list
    *.test.{ts,tsx}       Vitest unit tests
```

## Mock wallet approach

`src/lib/wallet.tsx` provides a **mock CSPR.click connector**: a React context
exposing `connect()` / `disconnect()` and a deterministic test account
(`MOCK_ACCOUNT` from the SDK, labelled "Demo Attestor"). `connect()` simulates
the brief async handshake the real SDK performs, then resolves the fixed
account — no browser extension and no app id required, so the app and any e2e
run work fully offline.

The state machine lives in a **pure reducer** (`walletReducer`), exported
separately and unit-tested without React. The context shape
(`WalletContextValue`) is the only thing the views depend on, so swapping in the
real SDK touches just this one file.

## Design system integration

UI primitives come from the prebuilt `@casperproof/ui` package. That package
ships ESM **without** `"use client"` directives, and several components use
React hooks — importing them from a Server Component fails the Next build.
`src/components/ui.tsx` is a `"use client"` re-export that establishes the
client boundary; the app imports design-system components from there. Pure-data
exports (`tokens`, `colors`) are imported straight from `@casperproof/ui/tokens`
(no hooks) for use in chart fills.

No `next/font/google` is used — the `--cp-font-*` token stacks fall back to
system fonts so the build never touches the network.

## Scripts

```bash
pnpm --filter @casperproof/web dev         # next dev on :3000
pnpm --filter @casperproof/web build       # production build (offline)
pnpm --filter @casperproof/web start        # serve the production build on :3000
pnpm --filter @casperproof/web typecheck   # tsc --noEmit
pnpm --filter @casperproof/web test        # vitest run
```

## Accessibility

Semantic HTML (`<nav>`, `<main>`, `<header>`, `<dl>`, lists), labelled form
fields, `aria-current` on the active nav link, `aria-live` on the feed,
`role="alert"`/`role="status"` on notices, visible focus rings from the UI
stylesheet, and `prefers-reduced-motion` honoured (UI stylesheet + the feed
animation).

## Going live

The dApp is wired for mock mode by default. To run against real Casper testnet
infrastructure:

- **CSPR.click wallet** — install `@make-software/csprclick-ui` +
  `@make-software/csprclick-core-client`, set `NEXT_PUBLIC_CSPR_CLICK_APP_ID`,
  and replace the body of `connect()` / `disconnect()` in `src/lib/wallet.tsx`
  with calls into the real client (source the active key from
  `getActiveAccount()`; sign deploys via `send(deployJson, publicKey)`). No view
  changes needed — they depend only on `WalletContextValue`.
- **SDK live mode** — set `CSPR_CLOUD_TOKEN` (plus `CSPR_CLOUD_REST_URL` /
  `CSPR_CLOUD_STREAMING_URL`, `CASPER_NODE_URL`, `ATTESTATION_REGISTRY_HASH`,
  `INSURANCE_HASH`). The SDK flips to live automatically; `getSdk()` needs no
  change. Live events then arrive over CSPR.cloud streaming through the same
  `subscribeEvents` handler in `LiveFeed`.
- **Deploy keys** — the on-chain write paths need a PEM secret key and deployed
  contract hashes; see the repo-root deploy scripts and
  [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).

The unit suite here covers the pure helpers and the wallet reducer/context; the
full attest → verify → claim → slash demo flow is exercised by Playwright in
`e2e/`.
