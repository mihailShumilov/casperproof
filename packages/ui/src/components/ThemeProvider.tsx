import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { tokens, tokensToCssVars } from '../tokens.js';
import type { Tokens } from '../tokens.js';

export interface ThemeProviderProps extends HTMLAttributes<HTMLDivElement> {
  /** Token set to inject. Defaults to the CasperProof tokens. */
  theme?: Tokens;
  children?: ReactNode;
}

/**
 * Wraps children in a container that declares the design-token CSS custom
 * properties inline, so any subtree can consume `var(--cp-*)` without the
 * global stylesheet. Useful for embedding the theme in isolated trees
 * (Storybook, email previews, tests) or overriding tokens locally.
 */
export function ThemeProvider({
  theme = tokens,
  style,
  children,
  ...rest
}: ThemeProviderProps): JSX.Element {
  const vars = tokensToCssVars(theme) as CSSProperties;
  return (
    <div data-cp-theme="" style={{ ...vars, ...style }} {...rest}>
      {children}
    </div>
  );
}
