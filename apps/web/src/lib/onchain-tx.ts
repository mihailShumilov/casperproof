/**
 * Translate a CasperProof {@link ContractCall} descriptor (from `@casperproof/casper-sdk`) into a
 * signed-ready `casper-js-sdk` **TransactionV1**, then to the JSON shape CSPR.click's `send()`
 * expects. This is the one place that depends on `casper-js-sdk`; the SDK core stays offline.
 *
 * Flow: `submitAttestationCall(...)` (SDK, typed args) → `buildTransactionJson(call, ctx)` (here) →
 * `clickRef.send(json, publicKey)` (CSPR.click, in `live-wallet.tsx`).
 *
 * ⚠️ Browser-validated, not testable offline end-to-end: the CLValue arg encoding (esp. the CEP-18
 * `approve` spender, an Odra contract `Address` → `Key`) must be confirmed against the **deployed**
 * contracts on testnet. The structural translation + error paths are unit-tested here.
 */
import { Args, CLTypeString, CLValue, ContractCallBuilder, Key, PublicKey } from 'casper-js-sdk';
import type { AbiArg, ContractCall, OnchainContract } from '@casperproof/casper-sdk';

/** Per-session context needed to address + pay for a contract call. */
export interface OnchainContext {
  /** Active account public key (hex), from CSPR.click `getActiveAccount().public_key`. */
  senderPublicKeyHex: string;
  /** Chain name, e.g. `casper-test`. */
  chainName: string;
  /** Deployed package hashes per contract (`hash-…`/`contract-package-…`/64-hex). */
  packageHashes: Partial<Record<OnchainContract, string>>;
  /** Gas payment in motes. Contract calls (incl. CEP-18 cross-contract) default to 10 CSPR. */
  paymentMotes?: number;
}

/** Default gas for a contract-call transaction (10 CSPR). */
export const DEFAULT_CALL_PAYMENT_MOTES = 10_000_000_000;

/** Parse a 32-byte hex string (no `0x`) into bytes. */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Extract the trailing 64-hex from a package-hash string (strips any `…-` prefix). */
export function packageHex(addr: string): string {
  const match = /([0-9a-fA-F]{64})$/.exec(addr);
  if (!match) throw new Error(`invalid package hash: ${addr}`);
  return match[1]!.toLowerCase();
}

/** Translate one typed ABI arg into a `casper-js-sdk` CLValue. */
export function toCLValue(arg: AbiArg): CLValue {
  switch (arg.type) {
    case 'string':
      return CLValue.newCLString(arg.value as string);
    case 'u64':
      return CLValue.newCLUint64(arg.value as string);
    case 'u256':
      return CLValue.newCLUInt256(arg.value as string);
    case 'byte_array':
      return CLValue.newCLByteArray(hexToBytes(arg.value as string));
    case 'bool':
      return CLValue.newCLValueBool(arg.value as boolean);
    case 'key':
      // Odra `Address` ⇄ CLValue `Key`; the spender string carries its own type prefix.
      return CLValue.newCLKey(Key.newKey(arg.value as string));
    case 'string_list':
      return CLValue.newCLList(
        CLTypeString,
        (arg.value as string[]).map((s) => CLValue.newCLString(s)),
      );
    default:
      throw new Error(`unsupported arg type: ${(arg as AbiArg).type}`);
  }
}

/** Build the `casper-js-sdk` TransactionV1 for a CasperProof contract call. */
export function buildTransaction(call: ContractCall, ctx: OnchainContext) {
  const pkg = ctx.packageHashes[call.contract];
  if (!pkg) throw new Error(`no package hash configured for contract "${call.contract}"`);

  const runtimeArgs = Args.fromMap(
    Object.fromEntries(call.args.map((a) => [a.name, toCLValue(a)])),
  );

  return new ContractCallBuilder()
    .from(PublicKey.fromHex(ctx.senderPublicKeyHex))
    .byPackageHash(packageHex(pkg))
    .entryPoint(call.entryPoint)
    .runtimeArgs(runtimeArgs)
    .chainName(ctx.chainName)
    .payment(ctx.paymentMotes ?? DEFAULT_CALL_PAYMENT_MOTES)
    .build();
}

/** Build the call and serialize it to the JSON object CSPR.click `send()` accepts. */
export function buildTransactionJson(call: ContractCall, ctx: OnchainContext): object {
  return buildTransaction(call, ctx).toJSON() as object;
}
