# @casperproof/e2e

Playwright **end-to-end** tests for the full CasperProof demo flow. The suite
drives the dApp (`apps/web`, `@casperproof/web`), which runs **fully offline**
against the SDK mock backend — no secrets, no network, deterministic.

## What it covers

| Spec                      | Asserts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/demo-flow.spec.ts` | The full §20 climax in one continuous session: connect wallet (mock) → score an address → submit/attest → **verify PASS** (on-chain hash == recomputed hash, both shown and equal) → buy a covered policy → simulate a covered trigger → claim payout → tamper a payload → **verify FAIL** (hashes diverge) → challenge → resolve fraudulent → slash. Asserts the live feed accumulates `AttestationSubmitted`, `ClaimPaid`, `Challenged`, and `Resolved` (fraudulent → slashed) events across in-app navigation. |
| `tests/oracle.spec.ts`    | Oracle happy path: submit gated on a connected wallet; submit appears in the list + live feed; unedited verify → **PASS** with equal hashes; tampered payload → **FAIL** with diverging hashes.                                                                                                                                                                                                                                                                                                                   |
| `tests/insurance.spec.ts` | Insurance happy path: score an address (no wallet needed); buy gated on a connected wallet; score → buy → simulate covered trigger → **auto-payout** (`ClaimPaid` in feed, policy flips to `Claimed`); vault solvency tiles reflect the policy.                                                                                                                                                                                                                                                                   |
| `tests/slash.spec.ts`     | Slash happy path: flow gated on a connected wallet; submit → tamper & **verify FAIL** → challenge → resolve fraudulent → **slash**, stake split between challenger and treasury; `Challenged` + `Resolved` stream into the feed.                                                                                                                                                                                                                                                                                  |

Shared steps live in `tests/helpers.ts` (connect wallet, submit attestation,
open the verify panel, read the full hash behind a `HashDisplay`, assert
PASS/FAIL with hash equality). Deterministic fixture data is in
`fixtures/demo-data.ts`.

### Selector strategy

Selectors come from the real DOM in `apps/web/src`:

- **Buttons** render visible text via `@casperproof/ui` → `getByRole('button', { name })`.
- **Form fields** expose `aria-label` (inputs) or are associated to a `<label htmlFor>`
  (the `JsonField` textareas) → `getByLabel`.
- The **verdict pill** (`VerdictPill`) renders the literal text `PASS` / `FAIL`.
- **Hashes**: `HashDisplay` truncates the value in the visible DOM but keeps the
  full hash in the `title` attribute of its `.cp-hash__value` span — so the
  PASS/FAIL hash-equality assertion reads `title`, not the truncated text.
- Cards are scoped via the `.cp-card` class (filtered by their section heading text).

## Running

From the repo root, **install the Chromium browser binary once**, then run:

```bash
pnpm --filter @casperproof/e2e exec playwright install chromium
pnpm --filter @casperproof/e2e test
```

The Playwright `webServer` builds the dApp and serves the production build on
`http://localhost:29300` automatically before the tests run:

```
pnpm --filter @casperproof/web build && pnpm --filter @casperproof/web start
```

`reuseExistingServer` is enabled outside CI, so if you already have
`pnpm --filter @casperproof/web start` running on :3000 it will be reused.

Other scripts:

```bash
pnpm --filter @casperproof/e2e test:ui     # Playwright UI mode
pnpm --filter @casperproof/e2e report      # open the last HTML report
```

To typecheck the specs without running them:

```bash
pnpm --filter @casperproof/e2e exec tsc --noEmit -p tsconfig.json
```

## Going live

- **Chromium browser binary.** `playwright install chromium` downloads the
  browser from the Playwright CDN. In a network-restricted sandbox that download
  is blocked, so the suite cannot _execute_ there — but the specs are written and
  typechecked to run green in CI / locally where the binary is available. Run the
  two commands under [Running](#running) on a machine with network access (CI
  installs the binary as a normal step).
- Nothing else: the dApp is offline-first in mock mode, so no env vars, secrets,
  wallet extension, or running services are required.
