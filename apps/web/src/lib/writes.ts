/**
 * Live on-chain write helper for the dApp: turn a CasperProof {@link ContractCall} descriptor into
 * a signed, submitted transaction and return its hash.
 *
 * Composition: `challengeCall(id)` (SDK ABI) → {@link buildTransactionJson} (casper-js-sdk) →
 * {@link signAndSend} (CSPR.click). Gated by {@link liveWritesEnabled}; views fall back to the
 * SDK's mock writes when live mode is off (offline demo, tests).
 *
 * @example
 * ```ts
 * import { challengeCall } from '@casperproof/casper-sdk';
 * import { liveWritesEnabled } from '@/lib/onchain-config';
 * import { signAndSendCall } from '@/lib/writes';
 *
 * const hash = liveWritesEnabled() && account
 *   ? await signAndSendCall(challengeCall(id), account.publicKey)   // live, in-wallet signature
 *   : (await getSdk().challenge(id)).deployHash;                    // mock fallback
 * ```
 *
 * ⚠️ Browser-validated: `signAndSendCall` is unit-tested with a stubbed client, but the real
 * sign→submit round-trip must be confirmed in a wallet against the deployed contracts. Note that
 * a live `submit_attestation` additionally requires the payload to be uploaded to the object store
 * (a server attestor endpoint) so verification can refetch it — challenge/resolve/claim/stake need
 * no payload and are the natural first live actions.
 */
'use client';

import type { ContractCall } from '@casperproof/casper-sdk';
import { buildTransactionJson } from './onchain-tx.js';
import { onchainContextFor } from './onchain-config.js';
import { getCsprClick, signAndSend, type CsprClickClient } from './csprclick.js';

/** Options for {@link signAndSendCall} (injectable client/env for tests). */
export interface SignAndSendOptions {
  /** Override the CSPR.click client (defaults to the global `window.csprclick`). */
  client?: CsprClickClient;
  /** Override the env used to resolve the on-chain context (defaults to `process.env`). */
  env?: Record<string, string | undefined>;
  /** Status callback forwarded to CSPR.click `send()`. */
  onStatusUpdate?: (status: string, data: unknown) => void;
}

/** Build, sign (in-wallet via CSPR.click), and submit a contract call; resolves the tx hash. */
export async function signAndSendCall(
  call: ContractCall,
  publicKeyHex: string,
  opts: SignAndSendOptions = {},
): Promise<string> {
  const client = opts.client ?? getCsprClick();
  if (!client) {
    throw new Error('CSPR.click is not available — connect a wallet to sign on-chain.');
  }
  const ctx = onchainContextFor(publicKeyHex, opts.env);
  const json = buildTransactionJson(call, ctx);
  return signAndSend(client, json, publicKeyHex, opts.onStatusUpdate);
}
