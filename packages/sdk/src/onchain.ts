/**
 * On-chain **call descriptors** for the CasperProof contracts — the typed ABI of every write.
 *
 * This module is **framework- and signer-agnostic**: it describes each contract entry-point
 * call as a plain {@link ContractCall} (which contract, which entry point, which typed runtime
 * args) and contains **no `casper-js-sdk` dependency**. That keeps the SDK core offline/mock and
 * lets any caller translate a descriptor into a real transaction where signing actually happens:
 *
 * - the **dApp** turns each descriptor into a `casper-js-sdk` `TransactionV1` and signs it in the
 *   browser via CSPR.click (`clickRef.send`);
 * - a **Node** caller (seed/agent) could sign the same descriptor with a key file.
 *
 * Keeping the ABI in one tested place means the arg names/types match the Rust contract
 * signatures exactly (see `contracts/src/{attestation_registry,insurance,tokens}.rs`), so the two
 * translators can't drift. Amounts (`u256`/`u64`) are passed as **strings** to avoid precision
 * loss; 32-byte hashes are passed as hex; addresses (CEP-18 `approve` spender) are `key` values.
 */

/** The CLValue kind of a runtime arg, mapped from the Rust entry-point signature. */
export type AbiArgType = 'string' | 'u64' | 'u256' | 'byte_array' | 'string_list' | 'key' | 'bool';

/** A single named runtime argument with its CLValue kind and value. */
export interface AbiArg {
  /** Arg name, matching the Rust entry-point parameter. */
  name: string;
  /** CLValue kind the dApp/Node translator must produce. */
  type: AbiArgType;
  /**
   * The value: stringified integer for `u64`/`u256`, hex (no `0x`) for `byte_array`, the raw
   * string for `string`, a `string[]` for `string_list`, an address (`hash-…`/account-hash) for
   * `key`, and a `boolean` for `bool`.
   */
  value: string | string[] | boolean;
}

/** Which deployed contract a call targets (resolved to a package hash by the translator). */
export type OnchainContract = 'registry' | 'insurance' | 'stakeToken' | 'usdcToken';

/** A fully-described contract entry-point call, ready to be turned into a transaction. */
export interface ContractCall {
  /** Target contract (the translator maps this to a configured package hash). */
  contract: OnchainContract;
  /** Entry-point name on the target contract. */
  entryPoint: string;
  /** Ordered runtime args. */
  args: AbiArg[];
}

/** Normalize a 32-byte hash hex (strip an optional `0x`, lowercase). */
function normalizeHash(hex: string): string {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{64}$/.test(h)) {
    throw new Error(`expected a 32-byte hex hash, got: ${hex}`);
  }
  return h.toLowerCase();
}

/** Stringify a u64/u256 amount (accepts number, bigint, or numeric string). */
function amount(value: string | number | bigint): string {
  const s = typeof value === 'string' ? value.trim() : value.toString();
  if (!/^\d+$/.test(s)) throw new Error(`expected a non-negative integer amount, got: ${value}`);
  return s;
}

// ── CEP-18 ───────────────────────────────────────────────────────────────────

/**
 * CEP-18 `approve(spender, amount)` — required before the registry pulls STAKE
 * (submit/challenge) or insurance pulls USDC (buy_policy/stake) via `transfer_from`.
 */
export function approveCall(
  token: 'stakeToken' | 'usdcToken',
  spender: string,
  value: string | number | bigint,
): ContractCall {
  return {
    contract: token,
    entryPoint: 'approve',
    args: [
      { name: 'spender', type: 'key', value: spender },
      { name: 'amount', type: 'u256', value: amount(value) },
    ],
  };
}

// ── AttestationRegistry ────────────────────────────────────────────────────────

/** Args for {@link submitAttestationCall} (hashes are the §8 outputs as hex). */
export interface SubmitAttestationCallArgs {
  modelId: string;
  inputHash: string;
  outputHash: string;
  commitment: string;
  uri: string;
  stake: string | number | bigint;
}

/** `submit_attestation(model_id, input_hash, output_hash, commitment, uri, stake)`. */
export function submitAttestationCall(args: SubmitAttestationCallArgs): ContractCall {
  return {
    contract: 'registry',
    entryPoint: 'submit_attestation',
    args: [
      { name: 'model_id', type: 'string', value: args.modelId },
      { name: 'input_hash', type: 'byte_array', value: normalizeHash(args.inputHash) },
      { name: 'output_hash', type: 'byte_array', value: normalizeHash(args.outputHash) },
      { name: 'commitment', type: 'byte_array', value: normalizeHash(args.commitment) },
      { name: 'uri', type: 'string', value: args.uri },
      { name: 'stake', type: 'u256', value: amount(args.stake) },
    ],
  };
}

/** `challenge(id)`. */
export function challengeCall(id: number): ContractCall {
  return {
    contract: 'registry',
    entryPoint: 'challenge',
    args: [{ name: 'id', type: 'u64', value: amount(id) }],
  };
}

/** `resolve(id, fraudulent)` — resolver-only on-chain. */
export function resolveCall(id: number, fraudulent: boolean): ContractCall {
  return {
    contract: 'registry',
    entryPoint: 'resolve',
    args: [
      { name: 'id', type: 'u64', value: amount(id) },
      { name: 'fraudulent', type: 'bool', value: fraudulent },
    ],
  };
}

/** `finalize(id)`. */
export function finalizeCall(id: number): ContractCall {
  return {
    contract: 'registry',
    entryPoint: 'finalize',
    args: [{ name: 'id', type: 'u64', value: amount(id) }],
  };
}

// ── Insurance ──────────────────────────────────────────────────────────────────

/** Args for {@link buyPolicyCall}. */
export interface BuyPolicyCallArgs {
  coverage: string | number | bigint;
  triggerTypes: string[];
  expiry: number;
}

/** `buy_policy(coverage, trigger_types, expiry)`. */
export function buyPolicyCall(args: BuyPolicyCallArgs): ContractCall {
  return {
    contract: 'insurance',
    entryPoint: 'buy_policy',
    args: [
      { name: 'coverage', type: 'u256', value: amount(args.coverage) },
      { name: 'trigger_types', type: 'string_list', value: [...args.triggerTypes] },
      { name: 'expiry', type: 'u64', value: amount(args.expiry) },
    ],
  };
}

/** `claim(policy_id, attestation_id, trigger_type)`. */
export function claimCall(
  policyId: number,
  attestationId: number,
  triggerType: string,
): ContractCall {
  return {
    contract: 'insurance',
    entryPoint: 'claim',
    args: [
      { name: 'policy_id', type: 'u64', value: amount(policyId) },
      { name: 'attestation_id', type: 'u64', value: amount(attestationId) },
      { name: 'trigger_type', type: 'string', value: triggerType },
    ],
  };
}

/** `stake(amount)` — LP adds USDC capital to the vault. */
export function stakeCall(value: string | number | bigint): ContractCall {
  return {
    contract: 'insurance',
    entryPoint: 'stake',
    args: [{ name: 'amount', type: 'u256', value: amount(value) }],
  };
}

/** `unstake(amount)` — LP withdraws USDC, subject to the solvency guard. */
export function unstakeCall(value: string | number | bigint): ContractCall {
  return {
    contract: 'insurance',
    entryPoint: 'unstake',
    args: [{ name: 'amount', type: 'u256', value: amount(value) }],
  };
}
