/**
 * Vitest global setup. Registers `@testing-library`-style matchers via the DOM
 * and stubs the bits of the browser environment jsdom omits (clipboard,
 * matchMedia) so components that touch them don't throw under test.
 */
import { afterEach, vi } from 'vitest';

// Tell React this is an act()-aware test environment so `act(...)` from
// `react`/`react-dom` flushes effects without the "not configured" warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lacks matchMedia; provide a no-op that reports "no preference".
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// jsdom's navigator.clipboard is not writable by default; stub it.
if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});
