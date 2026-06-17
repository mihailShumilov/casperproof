# ADR 0002: Off-chain, content-addressed payload store (S3)

- Status: accepted
- Date: 2026

## Context

An attestation commits to an agent's full `{ input, output }` payload, but storing arbitrary
JSON on-chain is expensive and unbounded. The chain only needs enough to verify integrity later.
The verifier, however, must be able to re-fetch the exact bytes that were attested to recompute
the hash.

## Decision

Store **only hashes + metadata + stake on-chain**; keep the full payload **off-chain** in an
S3-compatible object store, referenced by a `uri`. The object **key is the blake2b-256 hash of
the payload bytes** (the same hash primitive as the commitment, via `@casperproof/commitment`),
so storage is **content-addressed**: changing any byte changes the key.

Backend selection is automatic (`packages/agent/src/store.ts`):

- **In-memory** when `S3_ENDPOINT` is unset — offline/test default, no MinIO, no secrets.
- **S3** via `@aws-sdk/client-s3` — MinIO locally (in compose), Cloudflare R2 / AWS S3 in prod.

A dev-only `PayloadStore.corrupt()` (in-memory backend only) overwrites bytes **without** changing
the key, which powers the tamper demo.

## Consequences

- On-chain cost stays flat regardless of payload size; the chain compares 32-byte hashes.
- Content addressing makes the store tamper-evident on its own and makes the verifier's job a
  pure recompute-and-compare.
- The tamper demo is honest: it mutates bytes at a fixed URI (something a real attacker would do
  to the off-chain copy), and the verifier catches it because the recomputed hash no longer
  matches the on-chain commitment.
- Real storage needs credentials (see [`../../SETUP_NEEDED.md`](../../SETUP_NEEDED.md)); without
  them everything runs in-memory.
