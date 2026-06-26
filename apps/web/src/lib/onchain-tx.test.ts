import { describe, expect, it } from 'vitest';
import {
  approveCall,
  buyPolicyCall,
  resolveCall,
  submitAttestationCall,
} from '@casperproof/casper-sdk';
import {
  buildTransaction,
  buildTransactionJson,
  packageHex,
  toCLValue,
  type OnchainContext,
} from './onchain-tx.js';

// A structurally-valid ed25519 public key (01 prefix + 32 bytes).
const PUBKEY = '0119bf44096984cdfe8541bac167dc3b96c85086aa30b6b6cb0c5c38ad703166e1';
const PKG = 'hash-' + 'a'.repeat(64);
const HASH = 'b'.repeat(64);

const ctx: OnchainContext = {
  senderPublicKeyHex: PUBKEY,
  chainName: 'casper-test',
  packageHashes: {
    registry: PKG,
    insurance: 'hash-' + 'c'.repeat(64),
    stakeToken: 'hash-' + 'd'.repeat(64),
    usdcToken: 'hash-' + 'e'.repeat(64),
  },
};

describe('packageHex', () => {
  it('strips a hash- prefix to 64-hex', () => {
    expect(packageHex(PKG)).toBe('a'.repeat(64));
  });
  it('accepts a bare 64-hex', () => {
    expect(packageHex('f'.repeat(64))).toBe('f'.repeat(64));
  });
  it('rejects a non-hash', () => {
    expect(() => packageHex('nope')).toThrow(/invalid package hash/);
  });
});

describe('toCLValue', () => {
  it('encodes every supported arg type without throwing', () => {
    expect(toCLValue({ name: 's', type: 'string', value: 'x' })).toBeDefined();
    expect(toCLValue({ name: 'a', type: 'u64', value: '7' })).toBeDefined();
    expect(toCLValue({ name: 'b', type: 'u256', value: '2000000000' })).toBeDefined();
    expect(toCLValue({ name: 'h', type: 'byte_array', value: HASH })).toBeDefined();
    expect(toCLValue({ name: 'f', type: 'bool', value: true })).toBeDefined();
    expect(toCLValue({ name: 'k', type: 'key', value: PKG })).toBeDefined();
    expect(toCLValue({ name: 'l', type: 'string_list', value: ['a', 'b'] })).toBeDefined();
  });

  it('throws on an unknown type', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => toCLValue({ name: 'x', type: 'nope', value: '1' })).toThrow(/unsupported arg type/);
  });
});

describe('buildTransaction', () => {
  it('builds a submit_attestation transaction and serializes to JSON', () => {
    const call = submitAttestationCall({
      modelId: 'casperproof-riskscorer-v1',
      inputHash: HASH,
      outputHash: HASH,
      commitment: HASH,
      uri: 's3://casperproof-payloads/x',
      stake: '2000000000',
    });
    const json = buildTransactionJson(call, ctx);
    expect(json).toBeTypeOf('object');
    expect(json).not.toBeNull();
  });

  it('builds buy_policy (string_list arg) and resolve (bool arg)', () => {
    expect(
      buildTransaction(
        buyPolicyCall({ coverage: '5000000', triggerTypes: ['oracle_failure'], expiry: 4102444800 }),
        ctx,
      ),
    ).toBeDefined();
    expect(buildTransaction(resolveCall(1, true), ctx)).toBeDefined();
  });

  it('builds a CEP-18 approve (key spender) against the stake token', () => {
    const call = approveCall('stakeToken', PKG, '2000000000');
    expect(buildTransactionJson(call, ctx)).toBeTypeOf('object');
  });

  it('throws when the target contract has no configured package hash', () => {
    expect(() => buildTransaction(resolveCall(1, false), { ...ctx, packageHashes: {} })).toThrow(
      /no package hash configured/,
    );
  });
});
