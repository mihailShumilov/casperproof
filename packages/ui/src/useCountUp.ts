'use client';

/**
 * `useCountUp` — a requestAnimationFrame count-up hook.
 *
 * Animates from 0 to `target` with a cubic-out ease, returning the current
 * value formatted to `decimals` fixed places. Jumps straight to `target` when
 * the user prefers reduced motion. Pure React + RAF — no dependencies.
 */

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './motion.js';

export interface UseCountUpOptions {
  /** Animation duration in milliseconds. Defaults to `1200`. */
  durationMs?: number;
  /** Decimal places in the returned string. Defaults to `0`. */
  decimals?: number;
}

/**
 * Animate a number up to `target`.
 *
 * @returns The current value as a fixed-decimal string (e.g. `"42"`,`"3.14"`).
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): string {
  const { durationMs = 1200, decimals = 0 } = options;
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // cubic-out
      setValue(target * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, durationMs]);

  return value.toFixed(decimals);
}
