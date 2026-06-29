/**
 * Mock CSPR.click wallet connector.
 *
 * CasperProof's casper-stack skill mandates a zero-secret offline path: the dApp
 * must connect, sign, and run end-to-end with **no browser extension and no app
 * id**. This module provides exactly that — a deterministic React context that
 * mimics the surface the real `@make-software/csprclick-*` SDK would expose
 * (connect / disconnect / active account) without any network or wallet.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Going live — wiring the real CSPR.click SDK
 * ──────────────────────────────────────────────────────────────────────────
 * To go live, install `@make-software/csprclick-ui` + `@make-software/csprclick-core-client`
 * and set `NEXT_PUBLIC_CSPR_CLICK_APP_ID`. Replace the body of `connect()` /
 * `disconnect()` below with calls into the real client, and source the active
 * public key from `clickRef.getActiveAccount()`. The deploy-signing helpers
 * (`submit_attestation`, `challenge`, `buy_policy`, `claim`) would call
 * `clickRef.send(deployJson, accountPublicKey)`. The rest of the app depends
 * only on the `WalletContextValue` shape, so no view changes are required.
 *
 * The reducer (`walletReducer`) is exported separately and is pure, so it is
 * unit-tested without React.
 */
'use client';

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { MOCK_ACCOUNT } from '@casperproof/casper-sdk';

/** A connected wallet account (mirrors the fields the dApp reads from CSPR.click). */
export interface WalletAccount {
  /** The account hash / public key identifier used as the on-chain address. */
  publicKey: string;
  /** Short, display-friendly label derived from the key. */
  label: string;
}

/** Connection lifecycle of the mock wallet. */
export type WalletStatus = 'disconnected' | 'connecting' | 'connected';

/** Reducer state for the wallet. */
export interface WalletState {
  status: WalletStatus;
  account: WalletAccount | null;
  error: string | null;
}

/** Reducer actions. */
export type WalletAction =
  | { type: 'connect/start' }
  | { type: 'connect/success'; account: WalletAccount }
  | { type: 'connect/error'; error: string }
  | { type: 'disconnect' };

/** The deterministic test account exposed by the mock connector. */
export const MOCK_WALLET_ACCOUNT: WalletAccount = {
  publicKey: MOCK_ACCOUNT,
  // `account-hash-0000…0001` → a stable, readable label.
  label: 'Demo Attestor',
};

/** Initial, disconnected state. */
export const initialWalletState: WalletState = {
  status: 'disconnected',
  account: null,
  error: null,
};

/**
 * Pure wallet state transition. Kept side-effect-free and exported so the
 * connect → success → disconnect flow is unit-tested without React.
 */
export function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'connect/start':
      return { status: 'connecting', account: null, error: null };
    case 'connect/success':
      return { status: 'connected', account: action.account, error: null };
    case 'connect/error':
      return { status: 'disconnected', account: null, error: action.error };
    case 'disconnect':
      return { ...initialWalletState };
    default:
      return state;
  }
}

/** The value exposed to consumers of the wallet context. */
export interface WalletContextValue extends WalletState {
  /** `true` when an account is connected. */
  isConnected: boolean;
  /** Begin a (mock) connection; resolves the deterministic demo account. */
  connect: () => Promise<void>;
  /** Drop the connection. */
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Provider for the mock wallet. Wrap the app once (in `layout.tsx`). `connect`
 * simulates the brief async handshake the real SDK performs, then resolves the
 * fixed demo account.
 */
export function WalletProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(walletReducer, initialWalletState);

  const connect = useCallback(async () => {
    dispatch({ type: 'connect/start' });
    try {
      // Simulate the async wallet handshake without any real network/extension.
      await new Promise((resolve) => setTimeout(resolve, 250));
      dispatch({ type: 'connect/success', account: MOCK_WALLET_ACCOUNT });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      dispatch({ type: 'connect/error', error: message });
    }
  }, []);

  const disconnect = useCallback(() => {
    dispatch({ type: 'disconnect' });
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      ...state,
      isConnected: state.status === 'connected',
      connect,
      disconnect,
    }),
    [state, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Consume the wallet context. Throws if used outside a {@link WalletProvider}. */
export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a <WalletProvider>');
  }
  return ctx;
}
