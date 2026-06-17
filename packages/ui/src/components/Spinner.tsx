import { clsx } from 'clsx';
import type { HTMLAttributes } from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Size. Defaults to `md`. */
  size?: SpinnerSize;
  /** Accessible label announced to screen readers. Defaults to "Loading". */
  label?: string;
}

/**
 * An accessible loading spinner. Renders `role="status"` with a visually
 * hidden label and respects `prefers-reduced-motion` (via `styles.css`).
 */
export function Spinner({
  size = 'md',
  label = 'Loading',
  className,
  ...rest
}: SpinnerProps): JSX.Element {
  return (
    <span
      className={clsx('cp-spinner', `cp-spinner--${size}`, className)}
      role="status"
      aria-live="polite"
      {...rest}
    >
      <span className="cp-sr-only">{label}</span>
    </span>
  );
}
