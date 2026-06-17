#!/usr/bin/env node
/**
 * The CasperProof MCP server.
 *
 * Exposes the CasperProof oracle + insurance tools (`get_attestation`, `verify`,
 * `submit_attestation`, `get_risk_score`, `buy_policy`, `submit_claim`, `challenge`) over the
 * stdio transport, backed by `@casperproof/casper-sdk` (mock mode by default — no secrets) and
 * `@casperproof/agent`.
 *
 * The tool *handlers* live in `tools.ts` so they are unit-testable without a live transport;
 * this module only wires them into an `McpServer` and connects stdio. It starts cleanly with no
 * secrets (the SDK selects mock mode when `CSPR_CLOUD_TOKEN` is absent).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createToolContext, TOOLS } from './tools.js';
import type { ToolContext } from './tools.js';

/** Build an {@link McpServer} with every CasperProof tool registered against `ctx`. */
export function buildServer(ctx: ToolContext = createToolContext()): McpServer {
  const server = new McpServer({
    name: 'casperproof-mcp',
    version: '0.1.0',
  });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      async (args: unknown) => {
        const result = await tool.handler(args as never, ctx);
        return result as never;
      },
    );
  }

  return server;
}

/** Start the server on the stdio transport. */
export async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Start when run directly (not when imported by tests).
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
