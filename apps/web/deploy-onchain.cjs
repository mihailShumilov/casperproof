/* eslint-disable */
/**
 * CasperProof — direct testnet deploy via casper-js-sdk v5 (Casper 2.x Condor).
 * Installs the 4 Odra contracts with the exact odra install-arg convention, reads each
 * package hash from the deployer account's `<Name>_package_hash` named key (raw RPC
 * state_get_entity), and chains dependents. Run from apps/web: node deploy-onchain.cjs
 */
const fs = require('fs');
const path = require('path');
const {
  RpcClient, HttpHandler, PrivateKey, KeyAlgorithm, SessionBuilder, Args, CLValue, Key,
} = require('casper-js-sdk');

const NODE = process.env.CP_NODE || 'https://node.testnet.casper.network/rpc';
const CHAIN = process.env.CASPER_NETWORK_NAME || 'casper-test';
const KEY_PEM = process.env.CASPER_SECRET_KEY_PATH || path.resolve(__dirname, '../../keys/secret_key.pem');
const WASM_DIR = path.resolve(__dirname, '../../contracts/wasm');
const DEPLOY_MOTES = Number(process.env.CP_DEPLOY_MOTES || 350_000_000_000); // 350 CSPR
const LIMIT = Number(process.env.CP_LIMIT || 4);
const OUT = path.resolve(__dirname, '../../deploy-out/onchain.json');
const EXPLORER = 'https://testnet.cspr.live';

const u256 = (v) => CLValue.newCLUInt256(String(v));
const u64 = (v) => CLValue.newCLUint64(String(v));
const str = (v) => CLValue.newCLString(v);
const bool = (v) => CLValue.newCLValueBool(v);
const kkey = (s) => CLValue.newCLKey(Key.newKey(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params) {
  const res = await fetch(NODE, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function waitExec(txHashHex, timeoutMs = 240000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await rpc('info_get_transaction', { transaction_hash: { Version1: txHashHex } });
      const ei = r.execution_info;
      if (ei && ei.execution_result) {
        const v2 = ei.execution_result.Version2 || ei.execution_result;
        return { block: ei.block_height, error: v2.error_message ?? null, cost: v2.cost };
      }
    } catch (e) { /* not yet */ }
    await sleep(4000);
  }
  throw new Error(`timeout waiting for ${txHashHex}`);
}

async function readNamedKey(accountIdentifier, name) {
  // Odra registers contracts under legacy account named keys (name => `hash-<package>`).
  const r = await rpc('state_get_account_info', { account_identifier: accountIdentifier });
  const nks = (r.account && r.account.named_keys) || [];
  const hit = nks.find((nk) => nk.name === name);
  return hit ? hit.key : null;
}

async function main() {
  const pem = fs.readFileSync(KEY_PEM, 'utf8');
  const sk = await PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  const pub = typeof sk.publicKey === 'function' ? sk.publicKey() : sk.publicKey;
  const ah = pub.accountHash();
  const accountHashStr = ah.toPrefixedString ? ah.toPrefixedString() : `account-hash-${ah.toHex()}`;
  console.log('DEPLOYER:', pub.toHex(), '/', accountHashStr);
  const client = new RpcClient(new HttpHandler(NODE));

  async function install(name, initArgs) {
    console.log(`\n=== install ${name} ===`);
    const wasm = new Uint8Array(fs.readFileSync(path.join(WASM_DIR, `${name}.wasm`)));
    const args = Args.fromMap({
      ...initArgs,
      odra_cfg_is_upgradable: bool(false),
      odra_cfg_is_upgrade: bool(false),
      odra_cfg_allow_key_override: bool(true),
      odra_cfg_package_hash_key_name: str(`${name}_package_hash`),
    });
    const tx = new SessionBuilder().from(pub).wasm(wasm).installOrUpgrade()
      .runtimeArgs(args).chainName(CHAIN).payment(DEPLOY_MOTES).build();
    tx.sign(sk);
    const put = await client.putTransaction(tx);
    const txHashHex = JSON.parse(JSON.stringify(put)).transactionHash; // toJSON yields hex
    console.log(`  tx: ${EXPLORER}/transaction/${txHashHex}`);
    const exec = await waitExec(txHashHex);
    if (exec.error) throw new Error(`${name} install reverted: ${exec.error} (cost ${exec.cost})`);
    console.log(`  ✓ executed (block ${exec.block}, cost ${exec.cost})`);
    await sleep(2000);
    const pkg = await readNamedKey(pub.toHex(), `${name}_package_hash`);
    if (!pkg) throw new Error(`${name} installed but ${name}_package_hash named key not found`);
    console.log(`  package: ${pkg}`);
    return { txHashHex, pkg };
  }

  const r = {};
  if (LIMIT >= 1) r.StakeToken = await install('StakeToken', { initial_supply: u256('1000000000000000') });
  if (LIMIT >= 2) r.MockUsdc = await install('MockUsdc', { initial_supply: u256('1000000000000') });
  if (LIMIT >= 3) r.AttestationRegistry = await install('AttestationRegistry', {
    stake_token: kkey(r.StakeToken.pkg),
    min_stake: u256('1000000000'),
    challenge_bond: u256('1000000000'),
    dispute_window: u64('86400'),
    treasury: kkey(accountHashStr),
    resolver: kkey(accountHashStr),
    reward_bps: u64('5000'),
  });
  if (LIMIT >= 4) r.Insurance = await install('Insurance', {
    usdc_token: kkey(r.MockUsdc.pkg),
    registry: kkey(r.AttestationRegistry.pkg),
    premium_bps: u64('500'),
    claim_model_id: str('casperproof-claimoracle-v1'),
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(r, null, 2));
  console.log('\n=== DEPLOYED ===');
  for (const [k, v] of Object.entries(r)) console.log(`${k}: ${v.pkg}  (${EXPLORER}/transaction/${v.txHashHex})`);
  console.log(`\nwrote ${OUT}`);
}

main().catch((e) => { console.error('FATAL', e.message || e); process.exit(1); });
