import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export type StatDeltaDirection = 'up' | 'down' | 'neutral';

export interface StatTileProps extends HTMLAttributes<HTMLDivElement> {
  /** The metric name. */
  label: ReactNode;
  /** The metric value (usually a number or formatted string). */
  value: ReactNode;
  /** Optional change indicator, e.g. "+12%". */
  delta?: ReactNode;
  /** Direction of the delta — colors the text. Defaults to `neutral`. */
  deltaDirection?: StatDeltaDirection;
}

/** A labelled metric tile with an optional delta indicator. */
export function StatTile({
  label,
  value,
  delta,
  deltaDirection = 'neutral',
  className,
  ...rest
}: StatTileProps): JSX.Element {
  return (
    <div className={clsx('cp-stattile', className)} {...rest}>
      <span className="cp-stattile__label">{label}</span>
      <span className="cp-stattile__value">{value}</span>
      {delta != null && (
        <span className={clsx('cp-stattile__delta', `cp-stattile__delta--${deltaDirection}`)}>
          {delta}
        </span>
      )}
    </div>
  );
}
