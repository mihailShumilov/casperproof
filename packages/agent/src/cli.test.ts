import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './cli.js';

describe('runCli', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attests and verifies a default demo address, defaulting LLM_BACKEND=none', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const out = await runCli([], {});
    expect(out.attestationId).toBeGreaterThan(0);
    expect(out.verified).toBe(true);
    expect(log).toHaveBeenCalledOnce();
    const printed = JSON.parse((log.mock.calls[0]?.[0] as string) ?? '{}');
    expect(printed.backend).toBe('none');
    expect(printed.sdkMode).toBe('mock');
    expect(printed.store).toBe('memory');
    expect(printed.verified).toBe(true);
  });

  it('accepts an explicit address argument and respects an explicit backend env', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const out = await runCli(['account-hash-cli-explicit'], { LLM_BACKEND: 'none' });
    expect(out.verified).toBe(true);
    expect(out.attestationId).toBeGreaterThan(0);
  });
});
