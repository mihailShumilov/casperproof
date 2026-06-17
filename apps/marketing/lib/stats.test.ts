import { describe, it, expect } from 'vitest';
import { getLiveStats } from './stats.js';

describe('getLiveStats', () => {
  it('reports mock mode with no CSPR_CLOUD_TOKEN and labels the source', async () => {
    const data = await getLiveStats();
    expect(data.mode).toBe('mock');
    expect(data.generatedAt).toBeGreaterThan(0);
    expect(data.stats.length).toBeGreaterThan(0);
  });

  it('derives non-fabricated figures from the seeded SDK flow', async () => {
    const data = await getLiveStats();
    const byKey = Object.fromEntries(data.stats.map((s) => [s.key, s.value]));

    // The seed flow submits 9 attestations, resolves 2 (1 honest, 1 fraud).
    expect(byKey.attestations).toBe('9');
    expect(byKey.resolved).toBe('2');
    expect(byKey.slashed).toBe('1');
    expect(byKey.honest).toBe('50%');
  });

  it('produces a fresh, independent snapshot per call', async () => {
    const a = await getLiveStats();
    const b = await getLiveStats();
    // Each call builds its own client + store, so counts do not accumulate.
    const countA = a.stats.find((s) => s.key === 'attestations')?.value;
    const countB = b.stats.find((s) => s.key === 'attestations')?.value;
    expect(countA).toBe(countB);
  });
});
