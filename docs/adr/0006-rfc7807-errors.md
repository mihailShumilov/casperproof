# ADR 0006: RFC 7807 problem details for all HTTP/MCP errors

- Status: accepted
- Date: 2026

## Context

CasperProof surfaces the same failures through several boundaries: on-chain contract errors, the
x402 resource server, the MCP server, and the SDK. Without a shared format, each surface would
invent its own error shape and the meaning of a given failure would drift between the contract,
the services, and clients. The x402 flow also needs a standard way to express "payment required"
with the price and pay-to.

## Decision

Adopt **RFC 7807 (Problem Details for HTTP APIs)** as the single error contract, implemented once
in the `casperproof-problem` Rust crate (`contracts/problem/src/lib.rs`) on top of `rust-rfc7807`,
and mirrored by the SDK's error helpers. Every HTTP surface returns
`application/problem+json` with:

- a stable machine-readable `code` (e.g. `ATTESTATION_NOT_FOUND`, `TAMPERED_PAYLOAD`),
- a `type` URI under `https://casperproof.com/problems/<slug>`,
- a deterministic HTTP `status`, and a human `title`/`detail` plus typed extensions.

The taxonomy covers the registry/insurance contract errors, off-chain verification outcomes
(`TamperedPayload`, `PayloadUnavailable`), and the x402 `402 PaymentRequired` challenge (carrying
`price_usd` + `pay_to`). A verification **FAIL** is `TamperedPayload` (HTTP 422, `valid: false`,
both hashes attached). The catch-all `Internal` (500) **never serializes its cause** to clients.

## Consequences

- One body per failure across contracts, SDK, x402, and MCP — codes and slugs are asserted unique
  in the crate's tests, so they can't collide or drift.
- The full mapping (variant → code → HTTP status) is documented in
  [`../CONTRACTS.md`](../CONTRACTS.md#rfc-7807-error-mapping-contractsproblem).
- The x402 `402` response is a first-class, well-typed challenge clients can program against.
- Internal errors are safe to surface (no leaked connection strings or stack details).
