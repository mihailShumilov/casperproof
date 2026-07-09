## What & why

<!-- What changes, and what problem it solves. Link the issue or ADR if there is one. -->

## How it was verified

<!-- Delete the lines that don't apply. CI runs all of these, but say what you ran locally. -->

- [ ] `pnpm turbo run lint typecheck` and `pnpm format:check`
- [ ] `pnpm turbo run test:coverage` (>90% line + branch gate)
- [ ] `cd contracts && cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test`
- [ ] Exercised against `casper-test` (paste deploy hashes below)

## Trust-model impact

<!--
CasperProof is a trust primitive. Anything touching the commitment scheme, contract storage,
or the stake/challenge/slash economics needs extra scrutiny and usually an ADR in docs/adr/.
-->

- [ ] No change to the commitment scheme, on-chain storage layout, or slashing economics
- [ ] Changes one of the above — ADR added or updated: `docs/adr/____`

If the commitment scheme changed, the TS ⇆ Rust golden-vector parity test must still pass
(`packages/commitment` and `contracts/src/commitment.rs`).

## Notes for the reviewer

<!-- Anything surprising: a workaround, a dependency bump, a behavior change in mock vs live mode. -->
