import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StakingView } from './StakingView';
import { WalletProvider } from '@/lib/wallet';
import { render, flush } from '@/test/render';

// Reduced motion so the KPI count-ups settle to their final values immediately.
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderView() {
  return render(
    <WalletProvider>
      <StakingView />
    </WalletProvider>,
  );
}

describe('StakingView', () => {
  it('renders the pool-health KPIs from the seeded vault snapshot', async () => {
    const { container, unmount } = renderView();
    await flush();

    expect(container.textContent).toContain('Pool health');
    expect(container.textContent).toContain('Total staked');
    expect(container.textContent).toContain('Coverage outstanding');
    expect(container.textContent).toContain('Solvency ratio');
    expect(container.textContent).toContain('Stakers');

    // Seeded pool: 55,000 staked against 50,000 coverage → CAUTION, 1.10x.
    expect(container.textContent).toContain('55,000 CSPR');
    expect(container.textContent).toContain('50,000 CSPR');
    expect(container.textContent).toContain('CAUTION');
    expect(container.textContent).toContain('1.10x');
    unmount();
  });

  it('disables Stake until a wallet is connected', async () => {
    const { container, unmount } = renderView();
    await flush();

    const stake = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Stake',
    ) as HTMLButtonElement | undefined;
    expect(stake).toBeTruthy();
    expect(stake!.disabled).toBe(true);
    expect(container.textContent).toContain('Connect your wallet to sign');
    unmount();
  });

  it('shows the empty position state and embeds the unstake flow', async () => {
    const { container, unmount } = renderView();
    await flush();

    expect(container.textContent).toContain('No position yet');
    // The animated unstake flow is present with its step indicator.
    expect(container.textContent).toContain('Unstake flow');
    expect(container.textContent).toContain('Solvency check');
    // With no stake, the request action is disabled.
    const request = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Request unstake'),
    ) as HTMLButtonElement | undefined;
    expect(request).toBeTruthy();
    expect(request!.disabled).toBe(true);
    unmount();
  });
});
