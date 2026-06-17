/**
 * Client-component re-export of `@casperproof/ui`.
 *
 * The shared UI package ships prebuilt ESM without `"use client"` directives,
 * and several components (CodeBlock, HashDisplay, Spinner, ThemeProvider) use
 * React hooks. Importing them directly from a Server Component fails the Next
 * build ("you're importing a component that needs useState…"). This module
 * carries the `"use client"` boundary so every UI component renders on the
 * client, and is the single import surface the app uses for design-system
 * components. (Pure-data exports like `tokens`/`colors` are imported straight
 * from `@casperproof/ui/tokens` where needed — they have no hooks.)
 */
'use client';

export {
  Button,
  Card,
  Badge,
  StatTile,
  HashDisplay,
  truncateHash,
  VerdictPill,
  Tag,
  Spinner,
  CodeBlock,
  ThemeProvider,
} from '@casperproof/ui';
export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  CardProps,
  BadgeProps,
  BadgeStatus,
  StatTileProps,
  StatDeltaDirection,
  HashDisplayProps,
  VerdictPillProps,
  Verdict,
  TagProps,
  SpinnerProps,
  SpinnerSize,
  CodeBlockProps,
  ThemeProviderProps,
} from '@casperproof/ui';
