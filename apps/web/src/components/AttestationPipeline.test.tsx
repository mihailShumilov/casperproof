import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { AttestationPipeline } from './AttestationPipeline';
import { render, flush } from '@/test/render';

// next/link needs an App Router context that jsdom doesn't provide; render a
// plain anchor so the CTA href is still assertable.
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) =>
    createElement('a', { href }, children),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AttestationPipeline', () => {
  it('renders the collect phase first (orb + data-source badges)', () => {
    const { container, unmount } = render(
      <AttestationPipeline input="account-hash-collect" resultHref="/attestation/x" />,
    );
    expect(container.textContent).toContain('Collecting on-chain data');
    // All five on-chain data sources are surfaced as badges.
    for (const source of ['deploys', 'balances', 'transfers', 'events', 'reputation']) {
      expect(container.textContent).toContain(source);
    }
    // No gauge yet — the summary hasn't been reached.
    expect(container.querySelector('svg.cp-ring')).toBeNull();
    unmount();
  });

  it('jumps to the summary (gauge + factors + CTA) under reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container, unmount } = render(
      <AttestationPipeline input="account-hash-summary" resultHref="/attestation/encoded-id" />,
    );
    await flush();

    // The overall gauge is revealed.
    const gauge = container.querySelector('svg.cp-ring');
    expect(gauge).not.toBeNull();

    // The 15 factors are shown, each resolved (e.g. the first factor's label).
    expect(container.textContent).toContain('Failure rate');
    expect(container.textContent).toContain('Liquidity');

    // The CTA links to the full result.
    const cta = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('View full result'),
    );
    expect(cta).toBeTruthy();
    expect(cta?.getAttribute('href')).toBe('/attestation/encoded-id');
    unmount();
  });
});
