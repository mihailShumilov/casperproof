/**
 * Minimal typed wrapper over the CSPR.click browser client (`window.csprclick`).
 *
 * We integrate via the CDN/global client rather than the heavy `@make-software/csprclick-ui`
 * npm package (which drags styled-components/react-modal peers) — the wallet UI loads from the
 * CSPR.click provider script, and we only need `getActiveAccount()` + `send()`. The `send()`
 * method takes a `casper-js-sdk` `Transaction.toJSON()`, prompts the wallet to sign, submits it
 * via CSPR.cloud, and resolves a `transactionHash`.
 *
 * The client is injectable so the sign/send logic is unit-tested without a real wallet.
 */
'use client';

/** The active account shape CSPR.click exposes. */
export interface CsprClickAccount {
  /** Active account public key (hex). */
  public_key: string;
}

/** Result of a `send()` call. */
export interface CsprClickSendResult {
  /** Casper 2.0 transaction hash on success. */
  transactionHash?: string;
  /** Legacy deploy hash on success (Deploy path). */
  deployHash?: string;
  /** `true` when the user rejected signing in the wallet. */
  cancelled?: boolean;
  /** Error message when the send failed. */
  error?: string;
  /** Extra error data. */
  errorData?: unknown;
  /** Processing status, if a status callback / wait was used. */
  status?: string;
}

/** The subset of the CSPR.click client surface the dApp relies on. */
export interface CsprClickClient {
  /** The currently-active account, or null/undefined when disconnected. */
  getActiveAccount?(): CsprClickAccount | null | undefined;
  /** Chain name the client is configured for. */
  chainName?: string;
  /**
   * Request the active wallet to sign `transactionJSON` and submit it. Pass `transaction.toJSON()`
   * from `casper-js-sdk`. `signingPublicKey` MUST be the lower-cased active public key.
   */
  send(
    transactionJSON: object | string,
    signingPublicKey: string,
    onStatusUpdate?: (status: string, data: unknown) => void,
    timeout?: number,
  ): Promise<CsprClickSendResult | undefined>;
}

/** Read the global CSPR.click client if the provider script has loaded. */
export function getCsprClick(
  scope: { csprclick?: CsprClickClient } = globalThis as { csprclick?: CsprClickClient },
): CsprClickClient | undefined {
  return scope.csprclick;
}

/**
 * Sign + send a transaction via CSPR.click, returning the resulting tx hash. Throws a
 * user-facing error on cancellation or failure.
 */
export async function signAndSend(
  client: CsprClickClient,
  transactionJSON: object,
  publicKeyHex: string,
  onStatusUpdate?: (status: string, data: unknown) => void,
): Promise<string> {
  const res = await client.send(transactionJSON, publicKeyHex.toLowerCase(), onStatusUpdate);
  if (res?.transactionHash) return res.transactionHash;
  if (res?.deployHash) return res.deployHash;
  if (res?.cancelled) throw new Error('Transaction signing was cancelled in the wallet.');
  throw new Error(`Transaction failed: ${res?.error ?? 'unknown error from CSPR.click'}`);
}
