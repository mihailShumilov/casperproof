/**
 * Minimal React render helpers for the dApp's component tests.
 *
 * Mirrors the pattern used in `@casperproof/ui` (no external testing-library):
 * render into a detached container with `react-dom/client`, wrapped in `act`
 * so effects/state flush. `flush` drains the microtask queue across a few
 * cycles so chained async state updates (SDK promise → setState → effect)
 * settle before assertions.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function render(element: ReactElement): {
  container: HTMLElement;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Drain microtasks (resolved promises + the state updates they trigger). */
export async function flush(cycles = 4): Promise<void> {
  for (let i = 0; i < cycles; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** Dispatch a native click on an element inside `act`. */
export function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}
