import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { AttestationResult } from './AttestationResult';
import { encodeSeed } from '@/lib/riskFactors';
import { render, flush, click } from '@/test/render';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement('a', { href, className }, children),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Force reduced motion so the gauge + reveals render synchronously. */
function reduceMotion(): void {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
}

describe('AttestationResult', () => {
  it('renders the gauge, all four categories, and the 15-factor breakdown', async () => {
    reduceMotion();
    const id = encodeSeed('account-hash-result');
    const { container, unmount } = render(<AttestationResult id={id} />);
    await flush();

    expect(container.querySelector('svg.cp-ring')).not.toBeNull();

    for (const cat of [
      'Transaction & Behavior',
      'Protocol & DeFi',
      'Security & History',
      'Identity & Portfolio',
    ]) {
      expect(container.textContent).toContain(cat);
    }
    // A couple of representative factor labels from different groups.
    expect(container.textContent).toContain('Oracle deviation');
    expect(container.textContent).toContain('Concentration');
    unmount();
  });

  it('toggles the share button to "✓ copied" when clicked', async () => {
    reduceMotion();
    const id = encodeSeed('account-hash-share');
    const { container, unmount } = render(<AttestationResult id={id} />);
    await flush();

    const shareBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Share result'),
    );
    expect(shareBtn).toBeTruthy();

    click(shareBtn!);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(shareBtn!.textContent).toContain('copied');
    unmount();
  });

  it('shows a not-found state for an undecodable id', async () => {
    reduceMotion();
    // A control character cannot survive UTF-8 base64url decoding cleanly; an
    // empty id decodes to an empty seed → not found.
    const { container, unmount } = render(<AttestationResult id="" />);
    await flush();
    expect(container.textContent).toContain('Assessment not found');
    unmount();
  });
});
