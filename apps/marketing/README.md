# @casperproof/marketing

The CasperProof marketing website — a fast, dark, SEO-complete, **statically
exported** Next.js 14 (App Router) site for **casperproof.com**.

> Proof your agents can't fake. — Stake-backed truth for autonomous agents.

## Stack

- **Next.js 14** App Router, `output: 'export'` → static `out/`.
- **@casperproof/ui** — shared dark design system (tokens + components).
- **@casperproof/casper-sdk** — source of the live numbers (mock mode offline).
- **vitest** — unit tests for the pure content/format/stats helpers.

No remote fonts (uses the UI token font stack), no server image optimization,
no runtime data fetching — the whole site is prerendered at build time and
serves as flat files.

## Commands

```bash
pnpm --filter @casperproof/marketing dev        # http://localhost:3001
pnpm --filter @casperproof/marketing typecheck  # tsc --noEmit
pnpm --filter @casperproof/marketing build       # static export → out/
pnpm --filter @casperproof/marketing test        # vitest run
```

The build is fully offline. `@casperproof/ui` and `@casperproof/casper-sdk`
are consumed from their built `dist/` via the workspace (turbo runs `^build`
first in the monorepo).

## Layout

```
apps/marketing/
├─ app/
│  ├─ layout.tsx        # full SEO/OG/Twitter metadata, viewport, skip link
│  ├─ page.tsx          # Server Component; assembles sections, resolves stats
│  ├─ globals.css       # mk-* page layout, layered on @casperproof/ui styles
│  ├─ robots.ts         # → out/robots.txt (points at sitemap)
│  └─ sitemap.ts        # → out/sitemap.xml (production origin)
├─ components/
│  ├─ ui.ts             # 'use client' re-export boundary for @casperproof/ui
│  ├─ ClientCode.tsx    # 'use client' wrapper around CodeBlock
│  ├─ Header.tsx        # sticky nav + Launch app CTA
│  ├─ Hero.tsx          # tagline + two CTAs
│  ├─ Problem.tsx       # unverifiable outputs / uninsured capital
│  ├─ HowItWorks.tsx    # attest → pay & verify → challenge/slash
│  ├─ LiveNumbers.tsx   # SDK-sourced stats (labelled mock vs live)
│  ├─ Builders.tsx      # SDK one-liner, MCP tools, x402 snippet
│  ├─ UseCases.tsx      # RWA oracle, DeFi insurance, compliance
│  ├─ Roadmap.tsx       # phased status
│  └─ Footer.tsx        # team/socials + buildathon + Casper attribution
├─ lib/
│  ├─ site.ts           # env-resolved URLs/brand (+ test)
│  ├─ content.ts        # typed section copy (+ test)
│  ├─ format.ts         # pure motes/count/percent helpers (+ test)
│  └─ stats.ts          # SDK-backed live numbers (+ test)
├─ public/
│  ├─ og.svg            # 1200×630 OpenGraph image (static placeholder)
│  └─ favicon.svg
├─ next.config.mjs      # output: 'export', images.unoptimized, eslint ignore
├─ tsconfig.json        # extends @casperproof/config base
├─ vitest.config.ts
└─ next-env.d.ts
```

## Sections (per §18)

Hero · The problem · How it works (3 steps) · Live numbers · For builders
(SDK / MCP / x402) · Use cases (RWA / DeFi / compliance) · Roadmap ·
Team + socials · Footer (buildathon + Casper attribution).

## How the live numbers are sourced

`lib/stats.ts` builds a real `@casperproof/casper-sdk` client and reads its
state through the **public API** — it never hard-codes a metric.

- **Mock mode** (default — no `CSPR_CLOUD_TOKEN`): the SDK's in-memory store
  starts empty, so the module drives a small, deterministic demo flow through
  the *same* methods an agent would call (submit 9 attestations across 3
  attestors, challenge 2, resolve one honestly and one as fraud, open a
  policy). It then reports `attestationCount()` and aggregated
  `attestorReputation(...)` — i.e. genuine SDK output (currently 9 / 2 / 1 /
  50%). The section is explicitly **labelled "Mock source"** so nothing implies
  real testnet activity.
- **Live mode** (`CSPR_CLOUD_TOKEN` set): the client reads CSPR.cloud; the
  numbers are real testnet reads and the section is labelled "Live · CSPR.cloud".
  No seeding happens in live mode.

Stats are resolved in the **async Server Component** (`app/page.tsx`) at build
time, so the figures are baked into the static HTML — zero client fetch.

## Environment variables (all optional, build-time)

| Var | Default | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://casperproof.com` | canonical, OG, sitemap, robots |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | "Launch app" CTA |
| `NEXT_PUBLIC_CSPR_FANS_URL` | `https://cspr.fans` | "Vote on CSPR.fans" CTA |
| `CSPR_CLOUD_TOKEN` | _(unset)_ | flips the SDK to live mode for stats |

## Accessibility & performance

- Semantic landmarks (`header`/`main`/`footer`/`nav`/`section` with
  `aria-labelledby`), an ordered list for the steps, a skip-to-content link.
- Brand-tinted `:focus-visible` rings and `prefers-reduced-motion` handling
  (from `@casperproof/ui/styles.css`).
- Responsive grids (4 → 2 → 1 columns); fluid hero type via `clamp()`.
- No remote fonts/images; ~88 kB first-load JS. Built for Lighthouse ≥ 95.

## SETUP_NEEDED

- **CSPR.fans listing** — `NEXT_PUBLIC_CSPR_FANS_URL` defaults to
  `https://cspr.fans`. Set it to the real project-vote URL once the listing is
  live.
- **Production OG image** — `public/og.svg` is a correct-dimension (1200×630)
  brand placeholder. Swap in a final designed asset (PNG/JPG also fine; update
  the `type` in `app/layout.tsx` if you change the format). OG/Twitter/canonical
  URLs already resolve to the production origin, not localhost.
- **`NEXT_PUBLIC_APP_URL`** — defaults to `http://localhost:3000` for local dev;
  set the production dApp URL for deploys (otherwise the three "Launch app" CTAs
  point at localhost).
- **Live testnet stats** — set `CSPR_CLOUD_TOKEN` to source the live-numbers
  tiles from real Casper testnet data instead of the labelled mock flow.
- **Social handles** — `@casperproof` (X/Twitter) and `github.com/casperproof`
  are placeholders in `lib/site.ts`; confirm the real handles/org.
```
