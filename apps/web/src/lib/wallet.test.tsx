import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MOCK_WALLET_ACCOUNT,
  initialWalletState,
  useWallet,
  walletReducer,
  WalletProvider,
  type WalletContextValue,
  type WalletState,
} from './wallet';

describe('walletReducer', () => {
  it('starts disconnected with no account or error', () => {
    expect(initialWalletState).toEqual({
      status: 'disconnected',
      account: null,
      error: null,
    });
  });

  it('transitions to connecting on connect/start', () => {
    const next = walletReducer(initialWalletState, { type: 'connect/start' });
    expect(next.status).toBe('connecting');
    expect(next.account).toBeNull();
    expect(next.error).toBeNull();
  });

  it('transitions to connected with the account on success', () => {
    const next = walletReducer(
      { status: 'connecting', account: null, error: null },
      { type: 'connect/success', account: MOCK_WALLET_ACCOUNT },
    );
    expect(next.status).toBe('connected');
    expect(next.account).toEqual(MOCK_WALLET_ACCOUNT);
  });

  it('records the error and stays disconnected on connect/error', () => {
    const next = walletReducer(
      { status: 'connecting', account: null, error: null },
      { type: 'connect/error', error: 'boom' },
    );
    expect(next.status).toBe('disconnected');
    expect(next.error).toBe('boom');
    expect(next.account).toBeNull();
  });

  it('resets to the initial state on disconnect', () => {
    const connected: WalletState = {
      status: 'connected',
      account: MOCK_WALLET_ACCOUNT,
      error: null,
    };
    expect(walletReducer(connected, { type: 'disconnect' })).toEqual(initialWalletState);
  });

  it('returns the state unchanged for an unknown action', () => {
    const state: WalletState = { status: 'connected', account: MOCK_WALLET_ACCOUNT, error: null };
    // @ts-expect-error — exercising the default branch with an invalid action.
    expect(walletReducer(state, { type: 'nope' })).toBe(state);
  });
});

/**
 * Render `<WalletProvider>` with a probe that captures the live context value,
 * using only React + react-dom (no @testing-library, which isn't installed).
 */
function mountWallet(): {
  get: () => WalletContextValue;
  unmount: () => void;
} {
  let latest: WalletContextValue | undefined;
  function Probe(): null {
    latest = useWallet();
    return null;
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(WalletProvider, null, createElement(Probe)));
  });
  return {
    get: () => {
      if (!latest) throw new Error('probe not rendered');
      return latest;
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('WalletProvider / useWallet', () => {
  it('connects to the deterministic demo account, then disconnects', async () => {
    const harness = mountWallet();
    expect(harness.get().status).toBe('disconnected');
    expect(harness.get().isConnected).toBe(false);

    await act(async () => {
      await harness.get().connect();
    });

    expect(harness.get().status).toBe('connected');
    expect(harness.get().isConnected).toBe(true);
    expect(harness.get().account).toEqual(MOCK_WALLET_ACCOUNT);

    act(() => {
      harness.get().disconnect();
    });
    expect(harness.get().status).toBe('disconnected');
    expect(harness.get().account).toBeNull();

    harness.unmount();
  });

  it('throws when useWallet is used outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare(): null {
      useWallet();
      return null;
    }
    const container = document.createElement('div');
    const root = createRoot(container);
    expect(() =>
      act(() => {
        root.render(createElement(Bare));
      }),
    ).toThrow(/within a <WalletProvider>/);
    spy.mockRestore();
  });
});
