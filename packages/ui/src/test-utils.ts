import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';

// Opt in to React 18's act environment so state updates flush without warnings.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render a React element into a fresh detached DOM container using
 * `react-dom/client`, wrapped in `act` so effects/state flush. Returns the
 * container plus an `unmount` cleanup. No external testing-library needed.
 */
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

/** Dispatch a native click on an element inside `act`. */
export function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

/** Flush microtasks (e.g. a resolved clipboard promise) inside `act`. */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}
