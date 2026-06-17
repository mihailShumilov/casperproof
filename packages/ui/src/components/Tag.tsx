import { clsx } from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
}

/** A low-emphasis label chip (categories, keywords, metadata). */
export function Tag({ className, children, ...rest }: TagProps): JSX.Element {
  return (
    <span className={clsx('cp-tag', className)} {...rest}>
      {children}
    </span>
  );
}
