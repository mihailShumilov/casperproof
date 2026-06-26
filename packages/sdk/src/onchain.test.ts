import { describe, expect, it } from 'vitest';
import {
  approveCall,
  buyPolicyCall,
  challengeCall,
  claimCall,
  finalizeCall,
  resolveCall,
  stakeCall,
  submitAttestationCall,
  unstakeCall,
  type ContractCall,
} from './onchain.js';

const HASH = 'a'.repeat(64);

/** Convenience: find an arg by name. */
function arg(call: ContractCall, name: string) {
  return call.args.find((a) => a.name === name);
}

describe('approveCall', () => {
  it('targets the chosen token with a key spender + u256 amount', () => {
    const call = approveCall('stakeToken', 'hash-' + 'b'.repeat(64), 2000000000n);
    expect(call.contract).toBe('stakeToken');
    expect(call.entryPoint).toBe('approve');
    expect(arg(call, 'spender')).toEqual({
      name: 'spender',
      type: 'key',
      value: 'hash-' + 'b'.repeat(64),
    });
    expect(arg(call, 'amount')).toEqual({ name: 'amount', type: 'u256', value: '2000000000' });
  });

  it('supports the usdc token', () => {
    expect(approveCall('usdcToken', 'acct', '5').contract).toBe('usdcToken');
  });
});

describe('submitAttestationCall', () => {
  const base = {
    modelId: 'casperproof-riskscorer-v1',
    inputHash: HASH,
    outputHash: HASH,
    commitment: HASH,
    uri: 's3://casperproof-payloads/x',
    stake: '2000000000',
  };

  it('maps every field to a typed arg in order', () => {
    const call = submitAttestationCall(base);
    expect(call.contract).toBe('registry');
    expect(call.entryPoint).toBe('submit_attestation');
    expect(call.args.map((a) => [a.name, a.type])).toEqual([
      ['model_id', 'string'],
      ['input_hash', 'byte_array'],
      ['output_hash', 'byte_array'],
      ['commitment', 'byte_array'],
      ['uri', 'string'],
      ['stake', 'u256'],
    ]);
  });

  it('normalizes a 0x-prefixed, upper-case hash to lower-case hex', () => {
    const call = submitAttestationCall({ ...base, inputHash: '0x' + 'A'.repeat(64) });
    expect(arg(call, 'input_hash')!.value).toBe('a'.repeat(64));
  });

  it('rejects a non-32-byte hash', () => {
    expect(() => submitAttestationCall({ ...base, outputHash: 'abc' })).toThrow(/32-byte hex/);
  });

  it('rejects a non-integer stake', () => {
    expect(() => submitAttestationCall({ ...base, stake: '1.5' })).toThrow(/integer amount/);
  });
});

describe('registry id calls', () => {
  it('challenge encodes the id as u64', () => {
    expect(challengeCall(7)).toEqual({
      contract: 'registry',
      entryPoint: 'challenge',
      args: [{ name: 'id', type: 'u64', value: '7' }],
    });
  });

  it('resolve carries the fraudulent bool', () => {
    const call = resolveCall(3, true);
    expect(arg(call, 'id')).toEqual({ name: 'id', type: 'u64', value: '3' });
    expect(arg(call, 'fraudulent')).toEqual({ name: 'fraudulent', type: 'bool', value: true });
  });

  it('finalize encodes the id', () => {
    expect(finalizeCall(0).args).toEqual([{ name: 'id', type: 'u64', value: '0' }]);
  });
});

describe('insurance calls', () => {
  it('buy_policy carries coverage, trigger list, expiry', () => {
    const call = buyPolicyCall({
      coverage: '5000000',
      triggerTypes: ['oracle_failure', 'exploit'],
      expiry: 4102444800,
    });
    expect(call.contract).toBe('insurance');
    expect(arg(call, 'trigger_types')).toEqual({
      name: 'trigger_types',
      type: 'string_list',
      value: ['oracle_failure', 'exploit'],
    });
    expect(arg(call, 'expiry')!.value).toBe('4102444800');
  });

  it('buy_policy copies the trigger array (no aliasing)', () => {
    const triggers = ['oracle_failure'];
    const call = buyPolicyCall({ coverage: '1', triggerTypes: triggers, expiry: 1 });
    triggers.push('exploit');
    expect(arg(call, 'trigger_types')!.value).toEqual(['oracle_failure']);
  });

  it('claim carries policy id, attestation id, trigger', () => {
    const call = claimCall(1, 2, 'oracle_failure');
    expect(call.args.map((a) => a.value)).toEqual(['1', '2', 'oracle_failure']);
  });

  it('stake / unstake encode a u256 amount', () => {
    expect(stakeCall(100n).args[0]).toEqual({ name: 'amount', type: 'u256', value: '100' });
    expect(unstakeCall('250').args[0]).toEqual({ name: 'amount', type: 'u256', value: '250' });
  });

  it('rejects a negative / non-numeric amount', () => {
    expect(() => stakeCall('-1')).toThrow(/integer amount/);
  });
});
