# @casperproof/x402-server

x402-gated resource server (Fastify) for the CasperProof oracle. Buyers pay a tiny
micropayment per request to fetch an attestation's payload or to verify it.

## Routes

| Method & path                 | Gated    | Purpose                                                                  |
| ----------------------------- | -------- | ------------------------------------------------------------------------ |
| `GET /healthz`, `GET /health` | no       | liveness + SDK mode                                                      |
| `GET /attestation/:id`        | **x402** | on-chain metadata + the off-chain payload (from S3)                      |
| `POST /verify` `{ id }`       | **x402** | recompute + compare hashes → `{ valid, recomputedHash, onchainHash, … }` |

## x402 flow

1. Client requests a gated route with no (or an invalid) `X-PAYMENT` header.
2. Server replies **`402 Payment Required`** with an RFC 7807 `application/problem+json`
   body (`code: PAYMENT_REQUIRED`, `price_usd`, `pay_to`).
3. Client pays and retries with `X-PAYMENT`.
4. Server verifies the payment with the **Casper facilitator** (or the local mock) and serves
   the resource, echoing an `x-payment-settlement` header.

All error bodies are RFC 7807, mirroring the `contracts/problem` (`CasperProofError`) taxonomy.

## Configuration (env)

| Var                    | Default                | Meaning                                     |
| ---------------------- | ---------------------- | ------------------------------------------- |
| `X402_SERVER_PORT`     | `8402`                 | listen port                                 |
| `X402_PRICE_USD`       | `0.01`                 | price per gated request                     |
| `X402_PAY_TO`          | `casperproof-treasury` | payee                                       |
| `X402_FACILITATOR_URL` | _(empty)_              | facilitator base URL; empty ⇒ mock verifier |
| `X402_MOCK`            | —                      | `true` forces the mock verifier             |

With no facilitator URL the server runs fully offline against the mock verifier, the SDK mock
backend, and the in-memory payload store — so `make up` and the test suite need no secrets.

## Develop & test

```bash
pnpm --filter @casperproof/x402-server dev     # tsx watch
pnpm --filter @casperproof/x402-server test     # vitest (100% lines, >90% branches)
```

## SETUP_NEEDED

- Real payments require a reachable `X402_FACILITATOR_URL` (the Casper x402 facilitator).
- Live attestation reads require `CSPR_CLOUD_TOKEN` (the SDK flips to live mode automatically).
- Serving real payloads requires the S3/MinIO env (`S3_*`); otherwise the in-memory store is used.
