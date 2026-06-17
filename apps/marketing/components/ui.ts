'use client';

/**
 * Client boundary re-export of the `@casperproof/ui` components used by the
 * site.
 *
 * The shared UI package ships without `'use client'` directives, and its barrel
 * (`@casperproof/ui`) eagerly pulls in components that use React state
 * (`CodeBlock`, `HashDisplay`). Importing that barrel from a Server Component
 * therefore fails the build. Re-exporting through this `'use client'` module
 * establishes a single client boundary so the page tree can use the components
 * freely while `app/page.tsx` stays a Server Component (and resolves the SDK
 * stats at build time).
 */
export { Button, Card, Badge, StatTile, Tag, CodeBlock } from '@casperproof/ui';
