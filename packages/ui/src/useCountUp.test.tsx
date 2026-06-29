import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { useCountUp } from './useCountUp.js';
import { render } from './test-utils.js';

/** Probe component that surfaces the hook's string output into the DOM. */
function Probe({
  target,
  durationMs,
  decimals,
}: {
  target: number;
  durationMs?: number;
  decimals?: number;
}): JSX.Element {
  const out = useCountUp(target, { durationMs, decimals });
  return <span data-testid="out">{out}</span>;
}

/** Capture queued RAF callbacks so the test can drive frames deterministically. */
function setupRaf(): { flush: (time: number) => void; pending: () => number } {
  let next = 0;
  const queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    next += 1;
    queue.push({ id: next, cb });
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    const i = queue.findIndex((q) => q.id === id);
    if (i >= 0) queue.splice(i, 1);
  });
  return {
    flush(time: number) {
      const batch = queue.splice(0, queue.length);
      act(() => {
        for (const { cb } of batch) cb(time);
      });
    },
    pending: () => queue.length,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useCountUp', () => {
  it('jumps straight to the target when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container, unmount } = render(<Probe target={42} />);
    expect(container.querySelector('[data-testid="out"]')!.textContent).toBe('42');
    unmount();
  });

  it('eases up to the target across animation frames', () => {
    const raf = setupRaf();
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const { container, unmount } = render(<Probe target={100} durationMs={1000} />);
    const out = container.querySelector('[data-testid="out"]')!;

    // Mount schedules the first frame; nothing has run yet.
    expect(out.textContent).toBe('0');
    expect(raf.pending()).toBe(1);

    // Halfway: cubic-out of p=0.5 -> 1-(0.5)^3 = 0.875 -> 87.5 -> "88".
    raf.flush(500);
    expect(out.textContent).toBe('88');
    expect(raf.pending()).toBe(1); // still animating

    // End: p=1 -> exactly target, no further frame requested.
    raf.flush(1000);
    expect(out.textContent).toBe('100');
    expect(raf.pending()).toBe(0);

    unmount();
  });

  it('formats with the requested number of decimals', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container, unmount } = render(<Probe target={3.14159} decimals={2} />);
    expect(container.querySelector('[data-testid="out"]')!.textContent).toBe('3.14');
    unmount();
  });
});
