import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion } from './motion.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  it('returns false when matchMedia is unavailable', () => {
    // jsdom provides no matchMedia by default.
    expect(prefersReducedMotion()).toBe(false);
  });

  it('reflects the matchMedia result when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
    }));
    expect(prefersReducedMotion()).toBe(true);
  });

  it('returns false when matchMedia reports no preference', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });
});
