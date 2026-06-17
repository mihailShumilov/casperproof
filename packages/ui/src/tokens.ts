/**
 * CasperProof design tokens.
 *
 * A small, typed, dark-theme token set shared by `apps/web` and
 * `apps/marketing`. Tokens are plain data so they can be consumed in
 * TypeScript (for inline styles / charts) and emitted as CSS custom
 * properties via {@link tokensToCssVars} / {@link tokensToCssVarsString}.
 *
 * Brand: dark theme, Casper-red accent, with a semantic "proof green" /
 * "fail red" pair used by verdict and status surfaces.
 */

/** Brand + UI color palette (all values are CSS color strings). */
export const colors = {
  /** App background (near-black). */
  bg: '#0a0b0e',
  /** Slightly raised surface (cards, tiles). */
  surface: '#121419',
  /** Elevated surface (popovers, hover). */
  surfaceRaised: '#1a1d24',
  /** Hairline borders / dividers. */
  border: '#262a33',
  /** Primary text. */
  text: '#e8eaed',
  /** Secondary / muted text. */
  textMuted: '#9aa0aa',
  /** Disabled / faint text. */
  textFaint: '#5d636e',

  /** Casper-red brand accent. */
  accent: '#ff2d2d',
  /** Hover state for the accent. */
  accentHover: '#ff4d4d',
  /** Pressed / active state for the accent. */
  accentActive: '#d61f1f',

  /** "Proof green" — a verified / passing semantic color. */
  proof: '#2fd47a',
  /** Muted proof tint for backgrounds. */
  proofMuted: '#16331f',
  /** "Fail red" — a failing / tampered semantic color. */
  fail: '#ff5a5f',
  /** Muted fail tint for backgrounds. */
  failMuted: '#3a1416',
  /** Warning / challenged. */
  warn: '#ffb020',
  /** Muted warning tint for backgrounds. */
  warnMuted: '#3a2c0c',
  /** Informational / neutral highlight. */
  info: '#4aa3ff',
  /** Muted info tint for backgrounds. */
  infoMuted: '#0f2438',
} as const;

/** Spacing scale (rem-based, 4px grid). */
export const spacing = {
  none: '0',
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
  '3xl': '3rem',
} as const;

/** Corner radii. */
export const radii = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

/** Font family stacks. */
export const fonts = {
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', 'Menlo', monospace",
} as const;

/** Type scale (font sizes). */
export const fontSizes = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.5rem',
  '2xl': '2rem',
  '3xl': '3rem',
} as const;

/** Font weights. */
export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Box shadows (tuned for a dark surface). */
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  md: '0 4px 12px rgba(0, 0, 0, 0.5)',
  lg: '0 12px 32px rgba(0, 0, 0, 0.6)',
  /** Accent glow used for primary CTAs / focus rings. */
  glow: '0 0 0 1px rgba(255, 45, 45, 0.4), 0 0 16px rgba(255, 45, 45, 0.25)',
} as const;

/** Z-index layers. */
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
} as const;

/** The full, typed token object. */
export const tokens = {
  colors,
  spacing,
  radii,
  fonts,
  fontSizes,
  fontWeights,
  shadows,
  zIndex,
} as const;

export type Tokens = typeof tokens;
export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;

/**
 * A flat map of CSS custom property name -> value, derived from the tokens.
 *
 * Naming convention: `--cp-<group>-<key>`, e.g. `--cp-color-accent`,
 * `--cp-space-lg`, `--cp-radius-md`. Numeric tokens (z-index) are stringified.
 */
export function tokensToCssVars(t: Tokens = tokens): Record<string, string> {
  const vars: Record<string, string> = {};

  const assign = (group: string, source: Record<string, string | number>): void => {
    for (const [key, value] of Object.entries(source)) {
      vars[`--cp-${group}-${key}`] = String(value);
    }
  };

  assign('color', t.colors);
  assign('space', t.spacing);
  assign('radius', t.radii);
  assign('font', t.fonts);
  assign('fontsize', t.fontSizes);
  assign('fontweight', t.fontWeights);
  assign('shadow', t.shadows);
  assign('z', t.zIndex);

  return vars;
}

/**
 * Render the token CSS variables as a declaration string suitable for
 * injection inside a `:root { ... }` (or any selector) block.
 *
 * @example
 * const css = `:root {\n${tokensToCssVarsString()}\n}`;
 */
export function tokensToCssVarsString(t: Tokens = tokens): string {
  return Object.entries(tokensToCssVars(t))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
}
