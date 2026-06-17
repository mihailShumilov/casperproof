# API documentation

CasperProof ships generated API reference for both the TypeScript packages and the Rust
contracts. Neither generator runs as part of the normal build (they can be heavy); generate them
on demand.

## TypeScript (TypeDoc)

Config lives in `typedoc.json` at the repo root. Entry points are the three published source
packages, and output goes to `docs/api`:

- `packages/commitment/src/index.ts` — the trust anchor (§8) primitives.
- `packages/sdk/src/index.ts` — `@casperproof/casper-sdk`, the typed client.
- `packages/agent/src/index.ts` — `@casperproof/agent`, the zero-cost runtime.

Generate:

```bash
npx typedoc
# output: docs/api/  (open docs/api/index.html)
```

The sources are heavily TSDoc-annotated (`@example`, `@throws`, `@param`, `@packageDocumentation`),
so the generated reference is self-contained. `docs/api` is generated output — not committed
source.

## Rust (rustdoc)

Generate the contract API docs (no deploy required):

```bash
cargo doc -p casperproof-contracts --no-deps
# output: contracts/target/doc/casperproof_contracts/index.html
```

The crate root (`contracts/src/lib.rs`) and each module carry doc comments describing the
oracle/insurance/token contracts and the commitment types. The RFC 7807 mapping crate documents
separately:

```bash
cargo doc -p casperproof-problem --no-deps
```

## See also

- [`COMMITMENT.md`](./COMMITMENT.md) — the §8 scheme the SDK/agent/commitment APIs implement.
- [`CONTRACTS.md`](./CONTRACTS.md) — contract entry-point signatures, events, and errors.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how the packages fit together.
