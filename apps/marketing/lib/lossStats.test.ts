import { describe, it, expect } from 'vitest';
import { INCIDENTS, MARKET_STATS, CATEGORY_LABELS, type LossCategory } from './lossStats.js';

const CATEGORIES: LossCategory[] = ['oracle', 'bridge', 'flash-loan', 'agent'];

describe('loss incidents', () => {
  it('lists the cited real incidents with complete, well-formed fields', () => {
    expect(INCIDENTS.length).toBeGreaterThanOrEqual(6);
    for (const incident of INCIDENTS) {
      expect(incident.name.length).toBeGreaterThan(0);
      // Amounts are pre-formatted currency strings ("$117M", "$47K").
      expect(incident.amount).toMatch(/^\$[\d.,]+[KMB]?$/);
      expect(incident.date.length).toBeGreaterThan(0);
      expect(incident.cause.length).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(incident.category);
      // Every incident is attributed to a named source...
      expect(incident.source.name.length).toBeGreaterThan(0);
      // ...and any source URL is an absolute https link (no fabricated paths).
      if (incident.source.url !== undefined) {
        expect(incident.source.url).toMatch(/^https:\/\//);
      }
    }
  });

  it('includes the headline oracle/bridge/agent cases', () => {
    const byName = Object.fromEntries(INCIDENTS.map((i) => [i.name, i]));
    expect(byName['Mango Markets']?.amount).toBe('$117M');
    expect(byName['Wormhole']?.amount).toBe('$326M');
    expect(byName['Freysa']?.amount).toBe('$47K');
    expect(byName['Freysa']?.category).toBe('agent');
  });

  it('covers the full set of failure categories', () => {
    const seen = new Set(INCIDENTS.map((i) => i.category));
    expect(seen.has('oracle')).toBe(true);
    expect(seen.has('bridge')).toBe(true);
    expect(seen.has('flash-loan')).toBe(true);
    expect(seen.has('agent')).toBe(true);
  });

  it('labels every category', () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0);
    }
  });
});

describe('market stats (stat band)', () => {
  it('has 3-4 cited figures with count-up + canonical value fields', () => {
    expect(MARKET_STATS.length).toBeGreaterThanOrEqual(3);
    expect(MARKET_STATS.length).toBeLessThanOrEqual(4);
    for (const stat of MARKET_STATS) {
      expect(stat.label.length).toBeGreaterThan(0);
      expect(stat.value.length).toBeGreaterThan(0);
      expect(stat.note.length).toBeGreaterThan(0);
      expect(Number.isFinite(stat.to)).toBe(true);
      expect(stat.to).toBeGreaterThan(0);
      expect(stat.decimals).toBeGreaterThanOrEqual(0);
      expect(stat.source.name.length).toBeGreaterThan(0);
      expect(stat.source.url).toMatch(/^https:\/\//);
    }
  });

  it('surfaces the canonical Chainalysis figures', () => {
    const values = MARKET_STATS.map((s) => s.value);
    expect(values).toContain('$2.2B');
    expect(values).toContain('$200M+');
    // All market stats are attributed to Chainalysis.
    expect(MARKET_STATS.every((s) => s.source.name === 'Chainalysis')).toBe(true);
  });
});
