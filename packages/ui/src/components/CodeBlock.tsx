import { clsx } from 'clsx';
import { useCallback, useState } from 'react';
import type { HTMLAttributes } from 'react';

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLPreElement>, 'children'> {
  /** The source code to render (preserves whitespace). */
  code: string;
  /** Optional language label shown in the corner, e.g. "bash". */
  language?: string;
  /** Render a copy-to-clipboard button. Defaults to `true`. */
  copyable?: boolean;
}

/** A monospaced, scrollable code block with an optional copy affordance. */
export function CodeBlock({
  code,
  language,
  copyable = true,
  className,
  ...rest
}: CodeBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard?.writeText) {
      void clipboard.writeText(code).then(
        () => setCopied(true),
        () => setCopied(false),
      );
    }
  }, [code]);

  return (
    <pre className={clsx('cp-codeblock', className)} {...rest}>
      {language && (
        <span className="cp-codeblock__lang" aria-hidden="true">
          {language}
        </span>
      )}
      {copyable && (
        <button
          type="button"
          className="cp-hash__copy"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          style={{ position: 'absolute', top: 'var(--cp-space-sm)', right: 'var(--cp-space-sm)' }}
        >
          <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
        </button>
      )}
      <code className="cp-codeblock__code">{code}</code>
    </pre>
  );
}
