import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { buildServer } from './server.js';
import { createToolContext, TOOLS } from './tools.js';

describe('buildServer', () => {
  it('builds an McpServer and registers every tool without a live transport', () => {
    const server = buildServer(createToolContext());
    expect(server).toBeTruthy();
    // The underlying Server is available for advanced operations.
    expect(server.server).toBeTruthy();
    expect(server.isConnected()).toBe(false);
  });

  it('registers exactly the seven CasperProof tools', () => {
    expect(() => buildServer(createToolContext())).not.toThrow();
    expect(TOOLS).toHaveLength(7);
  });
});

describe('server <-> client round-trip (in-memory transport)', () => {
  it('lists the tools and calls get_risk_score through the protocol', async () => {
    const server = buildServer(createToolContext());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual(
      [
        'buy_policy',
        'challenge',
        'get_attestation',
        'get_risk_score',
        'submit_attestation',
        'submit_claim',
        'verify',
      ].sort(),
    );

    const result = (await client.callTool({
      name: 'get_risk_score',
      arguments: { address: 'account-hash-roundtrip' },
    })) as { structuredContent?: { score?: number; tier?: string } };

    expect(result.structuredContent?.score).toBeGreaterThanOrEqual(0);
    expect(['LOW', 'MEDIUM', 'HIGH', 'EXTREME']).toContain(result.structuredContent?.tier);

    await client.close();
    await server.close();
  });

  it('surfaces a structured error result for a missing attestation', async () => {
    const server = buildServer(createToolContext());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = (await client.callTool({ name: 'get_attestation', arguments: { id: 4242 } })) as {
      isError?: boolean;
      structuredContent?: { code?: string };
    };
    expect(result.isError).toBe(true);
    expect(result.structuredContent?.code).toBe('ATTESTATION_NOT_FOUND');

    await client.close();
    await server.close();
  });
});
