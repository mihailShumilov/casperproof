# ADR 0007: Live testnet deploy via Odra's native livenet env

- Status: accepted
- Date: 2026-06

## Context

Until now the on-chain **write path was unimplemented**: `scripts/deploy-testnet.ts` and the SDK
"live" REST backend (`packages/sdk/src/rest-backend.ts`) returned deterministic placeholder hashes
for every write, and `casper-js-sdk` was intentionally not a dependency (kept the build offline).
To produce real on-chain activity for the Buildathon — deploy the four contracts and run the demo
arc (attest → claim → slash) so the submission can cite real package hashes + cspr.live links — we
needed a real, signed deploy path.

Two options:

1. **Wire `casper-js-sdk` (TS).** Construct/sign/submit Casper 2.0 transactions in TypeScript,
   re-encoding every entry point's `CLValue` args (incl. CEP-18 `approve`/`transfer_from`) and the
   Odra `odra_cfg_*` install args by hand. High surface area, version-sensitive, and easy to get
   subtly wrong (Casper 2.0 moved from `Deploy` to `Transaction`; CLValue encoding must match the
   contract exactly).
2. **Use Odra's native livenet env (`odra_casper_livenet_env`, Rust).** `Contract::deploy(&env,
InitArgs)` handles deploy construction, signing, submission, and package-hash capture, and the
   returned `HostRef` calls entry points natively — the **same `Deployer`/`HostRef`/`InitArgs` API
   the MockVM tests already use**. Odra maintains it in lockstep with the contracts and the network
   protocol.

## Decision

Deploy and seed via a Rust **livenet binary** (`contracts/bin/livenet.rs`) using
`odra_casper_livenet_env`, gated behind a `livenet` Cargo feature and **never compiled to wasm**
(`cargo odra build` builds the contracts only; the bin is `required-features = ["livenet"]`).

- The binary deploys `StakeToken`, `MockUsdc`, `AttestationRegistry`, `Insurance` (in dependency
  order, with the same init args the tests use), sets the CEP-18 allowances, seeds vault capital,
  and runs the demo arc, printing machine-parseable `CP_RESULT <KEY>=<VALUE>` lines.
- `scripts/deploy-testnet.ts` keeps the **mock** path byte-for-byte (deterministic placeholder
  hashes, zero-secret) and, in **live** mode (both testnet secrets present), spawns the binary,
  maps the `ODRA_CASPER_LIVENET_*` env vars Odra expects, parses the package hashes into
  `.env.local`, and extracts the demo-tx hashes → cspr.live links (best-effort from the logs).
- §8 commitment hashes stay in the **single TypeScript implementation** (`@casperproof/commitment`):
  the binary accepts the real hashes via `CP_*` env vars (with deterministic fallbacks), so no
  canonical-JSON logic is reimplemented in Rust and TS⇄Rust parity is preserved.

The TS SDK write path (live in-dApp writes via `casper-js-sdk` + CSPR.click signing) remains a
**follow-up** — it is not needed for the on-chain-activity requirement, which the livenet binary
satisfies, and the dApp reads live state over CSPR.cloud regardless.

## Consequences

- One deploy path, maintained by Odra, mirroring the verified test API → low correctness risk.
- The heavy casper/livenet dependency tree is **opt-in** (the `livenet` feature); mock mode, the
  test suites, CI, and `cargo odra build` are completely unaffected. Verified: baseline
  `cargo check` and `cargo build --features livenet --bin livenet` both compile against
  odra `2.8.1` / `odra-casper-livenet-env 2.8.1`.
- Requires a funded key + a Casper RPC endpoint (CSPR.cloud node proxy) at deploy time, plus the
  nightly toolchain — all present in `docker/Dockerfile.contracts` and on the deploy VPS.
- cspr.live tx-link extraction from the binary's stdout is best-effort; the exact log format is
  confirmed against live output on the deploy machine. Package hashes are captured deterministically
  from `host.address()` and are never faked.
- A clean extension path: the same binary can drive future on-chain flows; the TS `casper-js-sdk`
  write path can be added later for live wallet writes without disturbing this deploy mechanism.
