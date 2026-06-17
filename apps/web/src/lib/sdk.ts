/**
 * Shared CasperProof SDK client for the dApp.
 *
 * The whole dApp talks to the chain exclusively through `@casperproof/casper-sdk`.
 * In mock mode (the default — no `CSPR_CLOUD_TOKEN`) the backend is an in-memory,
 * deterministic store, so a **single shared client instance** is essential: every
 * view must read and write the same store, and the live-event feed must observe
 * writes made by other views. Constructing a fresh client per render would give
 * each component its own empty store.
 *
 * The client is a browser-side singleton, lazily created on first use so it is
 * never instantiated during SSR/prerender (the store is per-session anyway).
 */
'use client';

import { createClient, type CasperProofSdk } from '@casperproof/casper-sdk';

let client: CasperProofSdk | null = null;

/**
 * Return the process-wide shared SDK client, creating it on first call.
 *
 * Mode is selected by the SDK from the environment; in the browser there is no
 * `CSPR_CLOUD_TOKEN`, so this is always `mock` for the offline demo.
 */
export function getSdk(): CasperProofSdk {
  if (!client) {
    client = createClient();
  }
  return client;
}

/** Convenience re-export of the active mode (`'mock'` | `'live'`). */
export function getSdkMode(): 'mock' | 'live' {
  return getSdk().mode;
}
