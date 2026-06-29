import { describe, expect, it, vi } from 'vitest';
import { challengeCall } from '@casperproof/casper-sdk';
import { getCsprClick, signAndSend, type CsprClickClient } from './csprclick.js';
import { liveWritesEnabled, onchainContextFor } from './onchain-config.js';
import { signAndSendCall } from './writes.js';

const PUBKEY = '0119bf44096984cdfe8541bac167dc3b96c85086aa30b6b6cb0c5c38ad703166e1';
const REGISTRY = 'hash-' + 'a'.repeat(64);

const liveEnv = {
  NEXT_PUBLIC_CSPR_CLICK_APP_ID: 'casperproof',
  NEXT_PUBLIC_ATTESTATION_REGISTRY_HASH: REGISTRY,
  NEXT_PUBLIC_CASPER_CHAIN_NAME: 'casper-test',
};

/** A fake CSPR.click client returning a fixed hash, recording the args it was called with. */
function fakeClient(result: Partial<Awaited<ReturnType<CsprClickClient['send']>>> = {}) {
  const send = vi.fn(
    async (
      _json: object | string,
      _pk: string,
      _cb?: (status: string, data: unknown) => void,
    ) => ({ transactionHash: 'deadbeef', ...result }),
  );
  return { client: { send } as unknown as CsprClickClient, send };
}

describe('onchain-config', () => {
  it('liveWritesEnabled requires both app id and registry hash', () => {
    expect(liveWritesEnabled(liveEnv)).toBe(true);
    expect(liveWritesEnabled({ NEXT_PUBLIC_CSPR_CLICK_APP_ID: 'x' })).toBe(false);
    expect(liveWritesEnabled({})).toBe(false);
  });

  it('onchainContextFor maps configured hashes + defaults the chain', () => {
    const ctx = onchainContextFor(PUBKEY, { ...liveEnv, NEXT_PUBLIC_INSURANCE_HASH: 'hash-x' });
    expect(ctx.senderPublicKeyHex).toBe(PUBKEY);
    expect(ctx.chainName).toBe('casper-test');
    expect(ctx.packageHashes.registry).toBe(REGISTRY);
    expect(ctx.packageHashes.insurance).toBe('hash-x');
    expect(ctx.packageHashes.usdcToken).toBeUndefined();
  });

  it('onchainContextFor defaults chain name when unset', () => {
    expect(onchainContextFor(PUBKEY, {}).chainName).toBe('casper-test');
  });
});

describe('getCsprClick', () => {
  it('reads the global client when present, undefined otherwise', () => {
    const client = {} as CsprClickClient;
    expect(getCsprClick({ csprclick: client })).toBe(client);
    expect(getCsprClick({})).toBeUndefined();
  });
});

describe('signAndSend', () => {
  it('returns the transaction hash', async () => {
    const { client } = fakeClient();
    await expect(signAndSend(client, {}, PUBKEY)).resolves.toBe('deadbeef');
  });

  it('lower-cases the signing public key passed to send', async () => {
    const { client, send } = fakeClient();
    await signAndSend(client, {}, PUBKEY.toUpperCase());
    expect(send).toHaveBeenCalledWith({}, PUBKEY.toLowerCase(), undefined);
  });

  it('falls back to a legacy deploy hash', async () => {
    const send = vi.fn(async () => ({ deployHash: 'abc123' }));
    await expect(signAndSend({ send } as unknown as CsprClickClient, {}, PUBKEY)).resolves.toBe(
      'abc123',
    );
  });

  it('throws a clear error when cancelled', async () => {
    const send = vi.fn(async () => ({ cancelled: true }));
    await expect(signAndSend({ send } as unknown as CsprClickClient, {}, PUBKEY)).rejects.toThrow(
      /cancelled/i,
    );
  });

  it('throws on a send error', async () => {
    const send = vi.fn(async () => ({ error: 'node down' }));
    await expect(signAndSend({ send } as unknown as CsprClickClient, {}, PUBKEY)).rejects.toThrow(
      /node down/,
    );
  });
});

describe('signAndSendCall', () => {
  it('builds the tx from the call and sends it via the client', async () => {
    const { client, send } = fakeClient();
    const hash = await signAndSendCall(challengeCall(7), PUBKEY, { client, env: liveEnv });
    expect(hash).toBe('deadbeef');
    // The tx JSON object + lower-cased key are forwarded to the client.
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![1]).toBe(PUBKEY.toLowerCase());
  });

  it('throws when no CSPR.click client is available', async () => {
    await expect(signAndSendCall(challengeCall(1), PUBKEY, { env: liveEnv })).rejects.toThrow(
      /CSPR\.click is not available/,
    );
  });

  it('throws when the target contract has no configured package hash', async () => {
    const { client } = fakeClient();
    await expect(signAndSendCall(challengeCall(1), PUBKEY, { client, env: {} })).rejects.toThrow(
      /no package hash configured/,
    );
  });
});
