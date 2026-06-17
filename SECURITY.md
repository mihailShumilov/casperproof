# Security Policy

CasperProof is a **testnet** prototype built for the Casper Agentic Buildathon 2026. It has
**not** been audited and must not be used to custody real value on mainnet.

## Reporting a vulnerability

Please report security issues privately to **security@casperproof.com** (or open a GitHub
security advisory). Do not open public issues for undisclosed vulnerabilities. We aim to
acknowledge within 72 hours.

## Trust model & known boundaries

- **Commitment scheme** (`§8`): `blake2b-256` over canonical bytes. The contract stores and
  compares **bytes only** — it never recomputes hashes. Recomputation is off-chain (attestor
  - verifier). The cross-language golden-vector parity test guards TS ⇆ Rust agreement.
- **Off-chain payloads** live in an S3-compatible store, content-addressed by `blake2b` hash.
  Integrity is enforced by recomputation at verify time; availability is **not** guaranteed
  by the chain.
- **Economic security**: attestations lock stake; bad attestations can be `challenge`d and
  `slash`ed within a dispute window. Parameters (min stake, window, treasury) are configurable
  and tuned for demo, not production.
- **Authorization**: `resolve` is restricted to the configured resolver/treasury; staking
  and vault solvency guards are enforced on-chain.

## Scope

In scope: contracts (`contracts/`), agent runtime (`packages/agent`), SDK, x402 server,
MCP server. Out of scope: third-party dependencies, testnet infrastructure, the local
Ollama model.
