# @casperproof/mcp-server

The CasperProof **MCP server** — exposes the verifiable-oracle + parametric-insurance tools to
agents over the Model Context Protocol (stdio transport), backed by `@casperproof/casper-sdk`
and `@casperproof/agent`. It starts cleanly with no secrets (the SDK selects mock mode when
`CSPR_CLOUD_TOKEN` is absent).

## Tools

| Tool | Input | What it does |
|---|---|---|
| `get_attestation` | `{ id }` | Fetch a stored attestation. |
| `verify` | `{ id }` | Refetch the payload, recompute the hash, return PASS/FAIL. |
| `submit_attestation` | `{ modelId, input, output, stake?, timestamp? }` | Commit → store → submit on-chain. |
| `get_risk_score` | `{ address }` | Deterministic 15-signal score, tier, decision. |
| `buy_policy` | `{ coverage, premium, triggerTypes[], expiry, holder? }` | Create an insurance policy. |
| `submit_claim` | `{ policyId, attestationId }` | File a claim against a policy. |
| `challenge` | `{ id }` | Challenge a tampered / fraudulent attestation. |

Each tool input is zod-typed. Results carry both human-readable `content` and machine-readable
`structuredContent`. Typed `CasperProofSdkError`s are returned as MCP error results
(`isError: true`) with the stable error code (e.g. `ATTESTATION_NOT_FOUND`,
`INSUFFICIENT_STAKE`, `TRIGGER_NOT_COVERED`) — never thrown across the transport.

## Architecture

The tool **handlers** live in `src/tools.ts` and are pure functions of
`(args, ctx: { sdk, store, config })`, so they are unit-testable without a live transport.
`src/server.ts` only wires them into an `McpServer` (`@modelcontextprotocol/sdk` 1.29) and
connects `StdioServerTransport`.

```ts
import { buildServer } from '@casperproof/mcp-server'; // or run the bin
import { createToolContext } from './tools.js';

const server = buildServer(createToolContext()); // mock SDK + in-memory store by default
```

## Run

```bash
pnpm --filter @casperproof/mcp-server build
node dist/server.js            # stdio transport; no secrets needed (mock mode)
# or, during development:
pnpm --filter @casperproof/mcp-server dev
```

Register with an MCP client (`mcp.json`):

```json
{ "mcpServers": { "casperproof": { "command": "node", "args": ["dist/server.js"] } } }
```

## Scripts

```bash
pnpm --filter @casperproof/mcp-server test          # vitest (tool handlers + round-trip)
pnpm --filter @casperproof/mcp-server test:coverage
pnpm --filter @casperproof/mcp-server typecheck
```
