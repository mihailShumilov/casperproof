import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { UnstakeFlow } from './UnstakeFlow';
import { render, flush, click } from '@/test/render';

const CSPR = 1_000_000_000n;

// Reduced motion makes the animated solvency check settle synchronously, so the
// idle → checking → executable/gated transition resolves within a single flush.
function stubReducedMotion(): void {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
}

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text),
  );
  if (!btn) throw new Error(`button containing "${text}" not found`);
  return btn as HTMLButtonElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('UnstakeFlow', () => {
  it('renders the three-step indicator and gates the request without a wallet', () => {
    const { container, unmount } = render(
      <UnstakeFlow
        userStakedMotes={20_000n * CSPR}
        withdrawableMotes={15_000n * CSPR}
        walletConnected={false}
        onExecute={vi.fn()}
      />,
    );
    // Step indicator nodes.
    for (const label of ['Request', 'Solvency check', 'Execute']) {
      expect(container.textContent).toContain(label);
    }
    // Idle phase badge.
    expect(container.textContent).toContain('Awaiting request');
    // Request is disabled until a wallet is connected.
    expect(buttonByText(container, 'Request unstake').disabled).toBe(true);
    unmount();
  });

  it('passes the solvency check and executes a withdrawable amount', async () => {
    stubReducedMotion();
    const onExecute = vi.fn().mockResolvedValue('deadbeefdeadbeefcafe');
    const { container, unmount } = render(
      <UnstakeFlow
        userStakedMotes={20_000n * CSPR}
        withdrawableMotes={15_000n * CSPR}
        walletConnected
        onExecute={onExecute}
      />,
    );

    const input = container.querySelector('input') as HTMLInputElement;
    typeInto(input, '10000');

    const request = buttonByText(container, 'Request unstake');
    expect(request.disabled).toBe(false);
    click(request);
    await flush();

    // Solvency check passed → executable.
    expect(container.textContent).toContain('Solvency check passed');
    expect(container.textContent).toContain('10,000 CSPR free to withdraw');

    click(buttonByText(container, 'Execute unstake'));
    await flush();

    expect(onExecute).toHaveBeenCalledWith((10_000n * CSPR).toString());
    expect(container.textContent).toContain('Unstaked 10,000 CSPR');
    expect(container.textContent).toContain('Complete');
    unmount();
  });

  it('gates a request that breaches the solvency guard and offers the available amount', async () => {
    stubReducedMotion();
    const onExecute = vi.fn().mockResolvedValue('abc123');
    const { container, unmount } = render(
      <UnstakeFlow
        userStakedMotes={20_000n * CSPR}
        withdrawableMotes={15_000n * CSPR}
        walletConnected
        onExecute={onExecute}
      />,
    );

    const input = container.querySelector('input') as HTMLInputElement;
    typeInto(input, '18000');
    click(buttonByText(container, 'Request unstake'));
    await flush();

    // Gated: 18,000 requested but only 15,000 withdrawable → 3,000 locked.
    expect(container.textContent).toContain('Solvency-gated');
    expect(container.textContent).toContain('3,000 CSPR');
    expect(container.textContent).toContain('15,000 CSPR');

    // Taking the offered available amount moves to the executable state.
    click(buttonByText(container, 'Withdraw available'));
    await flush();
    expect(container.textContent).toContain('15,000 CSPR free to withdraw');

    click(buttonByText(container, 'Execute unstake'));
    await flush();
    expect(onExecute).toHaveBeenCalledWith((15_000n * CSPR).toString());
    unmount();
  });
});
