/**
 * @casperproof/ui — shared dark-theme design system.
 *
 * Re-exports every component plus the design-token helpers. The tokens are
 * also reachable directly via the `@casperproof/ui/tokens` subpath export,
 * and the base stylesheet via `@casperproof/ui/styles.css`.
 */

// Components
export { Button } from './components/Button.js';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button.js';

export { Card } from './components/Card.js';
export type { CardProps } from './components/Card.js';

export { Badge } from './components/Badge.js';
export type { BadgeProps, BadgeStatus } from './components/Badge.js';

export { StatTile } from './components/StatTile.js';
export type { StatTileProps, StatDeltaDirection } from './components/StatTile.js';

export { HashDisplay, truncateHash } from './components/HashDisplay.js';
export type { HashDisplayProps } from './components/HashDisplay.js';

export { VerdictPill } from './components/VerdictPill.js';
export type { VerdictPillProps, Verdict } from './components/VerdictPill.js';

export { Tag } from './components/Tag.js';
export type { TagProps } from './components/Tag.js';

export { Spinner } from './components/Spinner.js';
export type { SpinnerProps, SpinnerSize } from './components/Spinner.js';

export { CodeBlock } from './components/CodeBlock.js';
export type { CodeBlockProps } from './components/CodeBlock.js';

export { ThemeProvider } from './components/ThemeProvider.js';
export type { ThemeProviderProps } from './components/ThemeProvider.js';

// Animated primitives
export { RingGauge } from './components/RingGauge.js';
export type { RingGaugeProps } from './components/RingGauge.js';

export { Reveal } from './components/Reveal.js';
export type { RevealProps } from './components/Reveal.js';

// Hooks + motion + risk helpers
export { useCountUp } from './useCountUp.js';
export type { UseCountUpOptions } from './useCountUp.js';

export { prefersReducedMotion } from './motion.js';

export { tierForScore, tierColor, tierBg } from './risk.js';
export type { Tier } from './risk.js';

// Tokens + helpers
export {
  tokens,
  colors,
  spacing,
  radii,
  fonts,
  fontSizes,
  fontWeights,
  shadows,
  zIndex,
  tokensToCssVars,
  tokensToCssVarsString,
} from './tokens.js';
export type { Tokens, ColorToken, SpacingToken, RadiusToken } from './tokens.js';
