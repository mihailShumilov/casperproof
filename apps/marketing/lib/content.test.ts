import { describe, it, expect } from 'vitest';
import {
  NAV_LINKS,
  PROBLEMS,
  HOW_IT_WORKS,
  BUILDER_FEATURES,
  USE_CASES,
  ROADMAP,
  TEAM_LINKS,
} from './content.js';

describe('content data', () => {
  it('has exactly three how-it-works steps, numbered 1..3', () => {
    expect(HOW_IT_WORKS).toHaveLength(3);
    expect(HOW_IT_WORKS.map((s) => s.step)).toEqual([1, 2, 3]);
    for (const step of HOW_IT_WORKS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it('frames both problems', () => {
    expect(PROBLEMS).toHaveLength(2);
    const titles = PROBLEMS.map((p) => p.title.toLowerCase()).join(' ');
    expect(titles).toContain('unverifiable');
    expect(titles).toContain('uninsured');
  });

  it('covers SDK, MCP, and x402 for builders', () => {
    const titles = BUILDER_FEATURES.map((b) => b.title).join(' ');
    expect(titles).toMatch(/SDK/);
    expect(titles).toMatch(/MCP/);
    expect(titles).toMatch(/x402/);
    for (const feature of BUILDER_FEATURES) {
      expect(feature.code.trim().length).toBeGreaterThan(0);
      expect(feature.language.length).toBeGreaterThan(0);
    }
  });

  it('lists the three pitched use cases', () => {
    expect(USE_CASES).toHaveLength(3);
    const tags = USE_CASES.map((u) => u.tag);
    expect(tags).toContain('RWA');
    expect(tags).toContain('DeFi');
    expect(tags).toContain('Compliance');
  });

  it('uses only valid roadmap statuses', () => {
    const valid = new Set(['shipped', 'in-progress', 'planned']);
    for (const item of ROADMAP) {
      expect(valid.has(item.status)).toBe(true);
    }
  });

  it('exposes X/Twitter and GitHub team links', () => {
    const labels = TEAM_LINKS.map((t) => t.label).join(' ');
    expect(labels).toMatch(/Twitter/i);
    expect(labels).toMatch(/GitHub/i);
    for (const link of TEAM_LINKS) {
      expect(link.href).toMatch(/^https:\/\//);
    }
  });

  it('navigation anchors all point to in-page sections', () => {
    for (const link of NAV_LINKS) {
      expect(link.href.startsWith('#')).toBe(true);
    }
  });
});
