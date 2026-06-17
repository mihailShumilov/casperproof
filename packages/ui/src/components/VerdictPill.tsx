import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export type Verdict = 'pass' | 'fail';

export interface VerdictPillProps extends HTMLAttributes<HTMLSpanElement> {
  /** The verification verdict. */
  verdict: Verdict;
  /** Override the visible label (defaults to PASS / FAIL). */
  children?: ReactNode;
}

const LABELS: Record<Verdict, string> = {
  pass: 'PASS',
  fail: 'FAIL',
};

/** A high-emphasis PASS (proof green) / FAIL (fail red) verdict pill. */
export function VerdictPill({
  verdict,
  className,
  children,
  ...rest
}: VerdictPillProps): JSX.Element {
  return (
    <span
      className={clsx('cp-verdict', `cp-verdict--${verdict}`, className)}
      role="status"
      {...rest}
    >
      <span aria-hidden="true">{verdict === 'pass' ? '✓' : '✕'}</span>
      {children ?? LABELS[verdict]}
    </span>
  );
}
