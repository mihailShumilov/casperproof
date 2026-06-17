import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Add hover affordance (border + shadow) for clickable cards. */
  interactive?: boolean;
  children?: ReactNode;
}

/** A bordered surface container for grouping related content. */
export function Card({
  interactive = false,
  className,
  children,
  ...rest
}: CardProps): JSX.Element {
  return (
    <div
      className={clsx('cp-card', interactive && 'cp-card--interactive', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
