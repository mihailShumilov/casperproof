'use client';

import { CodeBlock } from './ui';

/**
 * Client boundary around the shared `CodeBlock`.
 *
 * `CodeBlock` uses React state (for the copy affordance) but the shared UI
 * package ships without a `'use client'` directive, so it must be rendered
 * inside a client boundary. This thin wrapper provides exactly that, keeping
 * the rest of the page as Server Components.
 */
export function ClientCode({
  code,
  language,
}: {
  code: string;
  language?: string;
}): JSX.Element {
  return <CodeBlock code={code} language={language} />;
}
