'use client';

/**
 * `Reveal` — a JS-driven entrance transition.
 *
 * Fades + slides its children in shortly after mount. An optional `delay`
 * staggers sequences (e.g. cards in a grid). Respects `prefers-reduced-motion`
 * by showing content immediately with no transform.
 */

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { prefersReducedMotion } from '../motion.js';

export interface RevealProps {
  /** Delay in ms before the entrance starts (for staggered sequences). */
  delay?: number;
  /** Extra class names on the wrapper `<div>`. */
  className?: string;
  /** Inline styles merged onto the wrapper (e.g. a custom target opacity). */
  style?: CSSProperties;
  /** Content to reveal. */
  children?: ReactNode;
}

const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

/** Wraps children and fades + slides them in on mount. */
export function Reveal({ delay = 0, className, style, children }: RevealProps): JSX.Element {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(true);
      return;
    }
    const id = setTimeout(() => setShown(true), delay + 30);
    return () => clearTimeout(id);
  }, [delay]);

  const targetOpacity = style?.opacity ?? 1;

  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: shown ? targetOpacity : 0,
        transform: shown ? 'none' : 'translateY(14px)',
        transition:
          (style?.transition ? `${style.transition}, ` : '') +
          `opacity 0.55s ${EASE}, transform 0.55s ${EASE}`,
      }}
    >
      {children}
    </div>
  );
}
