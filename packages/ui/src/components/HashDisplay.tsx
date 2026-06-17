import { clsx } from 'clsx';
import { useCallback, useState } from 'react';
import type { HTMLAttributes } from 'react';

export interface HashDisplayProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The full hash value (e.g. a 64-char hex digest). */
  hash: string;
  /** Number of leading chars to keep. Defaults to 6. */
  lead?: number;
  /** Number of trailing chars to keep. Defaults to 6. */
  tail?: number;
  /** Optional `0x` (or other) prefix that is always shown in full. */
  prefix?: string;
  /** Render a copy-to-clipboard button. Defaults to `true`. */
  copyable?: boolean;
}

/**
 * Truncate a hash to `lead` + ellipsis + `tail` characters.
 *
 * If the hash is short enough that truncating would not save space, the full
 * value is returned unchanged. Exported for direct unit testing.
 */
export function truncateHash(hash: string, lead = 6, tail = 6): string {
  // Truncation only helps when the ellipsis is shorter than the part removed.
  if (hash.length <= lead + tail + 1) {
    return hash;
  }
  return `${hash.slice(0, lead)}…${hash.slice(hash.length - tail)}`;
}

/**
 * Displays a (possibly long) hash truncated in the middle, with the full
 * value available via the `title` attribute and an optional copy button.
 */
export function HashDisplay({
  hash,
  lead = 6,
  tail = 6,
  prefix = '',
  copyable = true,
  className,
  ...rest
}: HashDisplayProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const full = `${prefix}${hash}`;
  const truncated = `${prefix}${truncateHash(hash, lead, tail)}`;

  const handleCopy = useCallback(() => {
    const clipboard = globalThis.navigator?.clipboard;
    if (clipboard?.writeText) {
      void clipboard.writeText(full).then(
        () => setCopied(true),
        () => setCopied(false),
      );
    }
  }, [full]);

  return (
    <span className={clsx('cp-hash', className)} {...rest}>
      <span className="cp-hash__value" title={full}>
        {truncated}
      </span>
      {copyable && (
        <button
          type="button"
          className="cp-hash__copy"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : `Copy ${full}`}
        >
          <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
        </button>
      )}
    </span>
  );
}
