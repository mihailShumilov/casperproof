import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Size. Defaults to `md`. */
  size?: ButtonSize;
  /** Stretch to fill the available width. */
  block?: boolean;
  children?: ReactNode;
}

/**
 * Primary action button. Renders a semantic `<button>` with a brand-tinted
 * focus ring (see `styles.css`).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={clsx(
        'cp-button',
        `cp-button--${variant}`,
        `cp-button--${size}`,
        block && 'cp-button--block',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
