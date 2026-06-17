# @casperproof/casper-sdk

The typed CasperProof client. A single, stable, fully-documented surface over the CasperProof
on-chain registry + insurance contracts — used by the agents, the x402 / MCP servers, the dApp,
and the deploy scripts.

- **Reads** go over the CSPR.cloud REST API.
- **Writes** sign Casper deploys (placeholder deploy hashes today — see [Mock vs live](#mock-vs-live)).
- **Hashing** always flows through [`@casperproof/commitment`](../commitment); the SDK never
  reimplements the commitment scheme (§8).
- **Errors** mirror the Rust `CasperProofError` RFC 7807 taxonomy, one-to-one.

The SDK runs in **mock mode** by default (zero secrets, in-memory, deterministic) and flips to
**live mode** automatically when `CSPR_CLOUD_TOKEN` is set.

## Install

The package is part of the CasperProof monorepo and is consumed as a workspace dependency:

```jsonc
// package.json
{
  "dependencies": {
    "@casperproof/casper-sdk": "workspace:*"
  }
}
```

```ts
import { createClient } from '@casperproof/casper-sdk';
```

## Quick start

```ts
import { createClient } from '@casperproof/casper-sdk';

// Reads config from the environment; mock unless CSPR_CLOUD_TOKEN is set.
const client = createClient();
console.log(client.mode); // 'mock' | 'live'

// 1. Attest — commitment computed via @casperproof/commitment.
const att = await client.submitAttestation({
  modelId: 'casperproof-riskscorer-v1',
  input: { address: 'account-hash-aabbcc' },
  output: { score: 73, tier: 'HIGH' },
  uri: 's3://casperproof-payloads/abc.json',
  stake: '2000000000', // motes; must meet the registry minimum
});

// 2. Verify — recompute the output hash and compare to on-chain.
const result = await client.verify(att.id, { score: 73, tier: 'HIGH' });
console.log(result.valid); // true  (PASS)

// 3. A tampered payload fails verification.
const tampered = await client.verify(att.id, { score: 9999 });
console.log(tampered.valid); // false (FAIL)
```

## Configuration

`createClient(config?)` resolves each field from, in order: the explicit `config`, the
environment, then a documented local default.

| Field | Env var | Default |
|---|---|---|
| `mode` | — | `live` if a token is present, else `mock` |
| `csprCloudRestUrl` | `CSPR_CLOUD_REST_URL` | `https://api.testnet.cspr.cloud` |
| `csprCloudStreamingUrl` | `CSPR_CLOUD_STREAMING_URL` | `wss://streaming.testnet.cspr.cloud` |
| `csprCloudToken` | `CSPR_CLOUD_TOKEN` | _(unset → mock mode)_ |
| `casperNodeUrl` | `CASPER_NODE_URL` | `https://node.testnet.casper.network/rpc` |
| `casperNetworkName` | `CASPER_NETWORK_NAME` | `casper-test` |
| `attestationRegistryHash` | `ATTESTATION_REGISTRY_HASH` | _(unset)_ |
| `insuranceHash` | `INSURANCE_HASH` | _(unset)_ |
| `stakeTokenHash` | `STAKE_TOKEN_HASH` | _(unset)_ |
| `timeoutMs` | — | `10000` |
| `retries` | — | `2` |
| `retryBaseDelayMs` | — | `50` |
| `fetch` | — | global `fetch` |
| `env` | — | `process.env` |

```ts
// Force live mode with an injected fetch (e.g. in tests):
const client = createClient({ csprCloudToken: 'token', fetch: myFetch });
```

## API

`createClient(config?): CasperProofSdk`. The `CasperProofSdk` instance exposes `mode` plus:

| Method | Returns | Notes |
|---|---|---|
| `submitAttestation({ modelId, input, output, timestamp?, uri, stake })` | `{ id, deployHash, commitment, inputHash, outputHash, status }` | Computes hashes via `@casperproof/commitment`. |
| `getAttestation(id)` | `Attestation` | Throws `ATTESTATION_NOT_FOUND`. |
| `verify(id, payload)` | `{ valid, recomputedHash, onchainHash, attestor, stake, reputation }` | Recomputes the output hash and compares to on-chain. `valid:false` is a normal tamper result (not thrown). |
| `attestationCount()` | `number` | Registry size. |
| `attestorReputation(addr)` | `Reputation` | `{ successful, slashed, challengesDefended, score }`. |
| `challenge(id)` | `DeployResult` | Posts a dispute bond. Throws `ALREADY_CHALLENGED`, `ATTESTATION_NOT_ACTIVE`. |
| `resolve(id, fraudulent)` | `DeployResult` | `true` slashes, `false` finalizes honestly (resolver-only). |
| `createPolicy({ coverage, premium, triggerTypes, expiry })` | `Policy` | Insurance policy. |
| `getPolicy(id)` | `Policy` | Throws `POLICY_NOT_FOUND`. |
| `submitClaim(policyId, attestationId)` | `ClaimResult` | Throws `POLICY_EXPIRED`, `TRIGGER_NOT_COVERED`, … |
| `getRiskScore(address)` | `RiskScore` | `{ score, tier }`. |
| `stake(amount)` | `DeployResult` | Lock stake. |
| `unstake(amount)` | `DeployResult` | Throws `INSUFFICIENT_STAKE` if over-withdrawing. |
| `subscribeEvents(handler)` | `Unsubscribe` | Live contract events; mock mode replays recent local events. |

### Errors

Every recoverable failure is thrown as a typed `CasperProofSdkError`:

```ts
import { CasperProofSdkError } from '@casperproof/casper-sdk';

try {
  await client.getAttestation(999);
} catch (err) {
  if (CasperProofSdkError.is(err)) {
    console.log(err.code);   // 'ATTESTATION_NOT_FOUND'
    console.log(err.status); // 404
    console.log(err.detail); // { attestation_id: 999 }
  }
}
```

The codes mirror the Rust `CasperProofError` taxonomy exactly: `ATTESTATION_NOT_FOUND`,
`INSUFFICIENT_STAKE`, `DISPUTE_WINDOW_CLOSED`, `ALREADY_CHALLENGED`, `UNAUTHORIZED`,
`ATTESTATION_NOT_ACTIVE`, `TAMPERED_PAYLOAD`, `PAYLOAD_UNAVAILABLE`, `POLICY_NOT_FOUND`,
`POLICY_EXPIRED`, `TRIGGER_NOT_COVERED`, `VAULT_INSOLVENT`, `PAYMENT_REQUIRED`, `INTERNAL_ERROR`.
`errorFromProblem(status, body)` maps any RFC 7807 `application/problem+json` body returned by
the services back to a `CasperProofSdkError`.

## Mock vs live

| Path | Mock (default) | Live (`CSPR_CLOUD_TOKEN` set) |
|---|---|---|
| Reads | in-memory store, seeded empty | CSPR.cloud REST + bounded retries + timeouts |
| Writes (deploys) | deterministic mock deploy hashes | deterministic placeholder hashes — see below |
| Events | replays recent local events + emits new ones | no-op stub (streaming not yet wired) |

Mock deploy hashes are `blake2b256(label ‖ le_u64(counter) ‖ utf8(canonical(payload)))` via
`@casperproof/commitment`, so the same write produces the same hash — keeping the demo and the
tests reproducible. **The attestation hashes (`inputHash`, `outputHash`, `commitment`) are
real** in both modes; they are computed from the canonical commitment scheme and match the
`@casperproof/commitment` golden vectors byte-for-byte.

> **Real deploy signing requires `casper-js-sdk`**, which is intentionally not a dependency of
> this package. Until it is wired in, write methods return deterministic placeholder deploy
> hashes in both modes, and live event streaming over CSPR.cloud is a no-op stub. See
> `SETUP_NEEDED.md` at the repo root.

## Scripts

```bash
pnpm --filter @casperproof/casper-sdk build      # emit dist + .d.ts
pnpm --filter @casperproof/casper-sdk test        # vitest
pnpm --filter @casperproof/casper-sdk test:coverage
pnpm --filter @casperproof/casper-sdk typecheck
```
