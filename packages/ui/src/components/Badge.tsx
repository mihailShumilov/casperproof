import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

/** Lifecycle + verdict status variants for an oracle claim. */
export type BadgeStatus = 'active' | 'challenged' | 'slashed' | 'finalized' | 'pass' | 'fail';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Status variant. Drives color + default label. */
  status: BadgeStatus;
  /** Render a leading status dot. Defaults to `true`. */
  dot?: boolean;
  /** Override the visible label (defaults to the capitalized status). */
  children?: ReactNode;
}

const DEFAULT_LABELS: Record<BadgeStatus, string> = {
  active: 'Active',
  challenged: 'Challenged',
  slashed: 'Slashed',
  finalized: 'Finalized',
  pass: 'Pass',
  fail: 'Fail',
};

/** A small status pill for claim lifecycle / verdict state. */
export function Badge({
  status,
  dot = true,
  className,
  children,
  ...rest
}: BadgeProps): JSX.Element {
  return (
    <span className={clsx('cp-badge', `cp-badge--${status}`, className)} {...rest}>
      {dot && <span className="cp-badge__dot" aria-hidden="true" />}
      {children ?? DEFAULT_LABELS[status]}
    </span>
  );
}
