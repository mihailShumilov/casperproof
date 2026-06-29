/* eslint-disable */
/**
 * CasperProof — on-chain demo arc via casper-js-sdk v5 against the deployed contracts.
 * Reads package hashes from deploy-out/onchain.json, then runs:
 *   approve STAKE->registry, approve USDC->insurance, stake vault,
 *   submit risk attestation (id0) [HEADLINE submit_attestation],
 *   submit claim attestation (id1), buy policy (id0),
 *   claim(policy0, att1, trigger) [HEADLINE claim],
 *   submit slash attestation (id2), challenge(2), resolve(2,true) [HEADLINE resolve/slash].
 * Run from apps/web: node arc-onchain.cjs
 */
const fs = require('fs');
const path = require('path');
const {
  RpcClient, HttpHandler, PrivateKey, KeyAlgorithm, ContractCallBuilder, Args, CLValue, Key, CLTypeString,
} = require('casper-js-sdk');

const NODE = process.env.CP_NODE || 'https://node.testnet.casper.network/rpc';
const CHAIN = process.env.CASPER_NETWORK_NAME || 'casper-test';
const KEY_PEM = process.env.CASPER_SECRET_KEY_PATH || path.resolve(__dirname, '../../keys/secret_key.pem');
const HASHES = require(path.resolve(__dirname, '../../deploy-out/onchain.json'));
const CALL_MOTES = Number(process.env.CP_CALL_MOTES || 40_000_000_000); // 40 CSPR
const OUT = path.resolve(__dirname, '../../deploy-out/arc.json');
const EXPLORER = 'https://testnet.cspr.live';

const u256 = (v) => CLValue.newCLUInt256(String(v));
const u64 = (v) => CLValue.newCLUint64(String(v));
const sstr = (v) => CLValue.newCLString(v);
const sbool = (v) => CLValue.newCLValueBool(v);
const kkey = (s) => CLValue.newCLKey(Key.newKey(s));
const slist = (arr) => CLValue.newCLList(CLTypeString, arr.map((s) => CLValue.newCLString(s)));
const ba = (hex) => CLValue.newCLByteArray(Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16))));
const h32 = (byte) => byte.repeat(32);
const pkgHex = (s) => /([0-9a-f]{64})$/.exec(s)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params) {
  const res = await fetch(NODE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
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
      if (ei && ei.execution_result) { const v2 = ei.execution_result.Version2 || ei.execution_result; return { block: ei.block_height, error: v2.error_message ?? null, cost: v2.cost }; }
    } catch (e) {}
    await sleep(4000);
  }
  throw new Error(`timeout ${txHashHex}`);
}

async function main() {
  const pem = fs.readFileSync(KEY_PEM, 'utf8');
  const sk = await PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  const pub = typeof sk.publicKey === 'function' ? sk.publicKey() : sk.publicKey;
  const client = new RpcClient(new HttpHandler(NODE));

  const REG = pkgHex(HASHES.AttestationRegistry.pkg);
  const INS = pkgHex(HASHES.Insurance.pkg);
  const STK = pkgHex(HASHES.StakeToken.pkg);
  const USDC = pkgHex(HASHES.MockUsdc.pkg);

  async function call(label, pkg, entryPoint, argMap) {
    const tx = new ContractCallBuilder().from(pub).byPackageHash(pkg).entryPoint(entryPoint)
      .runtimeArgs(Args.fromMap(argMap)).chainName(CHAIN).payment(CALL_MOTES).build();
    tx.sign(sk);
    const put = await client.putTransaction(tx);
    const txHashHex = JSON.parse(JSON.stringify(put)).transactionHash;
    process.stdout.write(`  ${label} (${entryPoint}) -> ${txHashHex} ... `);
    const exec = await waitExec(txHashHex);
    if (exec.error) throw new Error(`${label} reverted: ${exec.error}`);
    console.log(`ok (block ${exec.block})`);
    await sleep(1500);
    return txHashHex;
  }

  const head = {};
  console.log('=== setup ===');
  await call('approve STAKE->registry', STK, 'approve', { spender: kkey(HASHES.AttestationRegistry.pkg), amount: u256('1000000000000000') });
  await call('approve USDC->insurance', USDC, 'approve', { spender: kkey(HASHES.Insurance.pkg), amount: u256('1000000000000') });
  await call('seed vault stake', INS, 'stake', { amount: u256('20000000') });

  console.log('=== arc ===');
  head.submit_attestation = await call('submit risk att (id0)', REG, 'submit_attestation', {
    model_id: sstr('casperproof-riskscorer-v1'), input_hash: ba(h32('01')), output_hash: ba(h32('02')),
    commitment: ba(h32('03')), uri: sstr('s3://casperproof-payloads/demo-risk'), stake: u256('1000000000'),
  });
  await call('submit claim att (id1)', REG, 'submit_attestation', {
    model_id: sstr('casperproof-claimoracle-v1'), input_hash: ba(h32('04')), output_hash: ba(h32('05')),
    commitment: ba(h32('06')), uri: sstr('s3://casperproof-payloads/demo-claim'), stake: u256('1000000000'),
  });
  await call('buy policy (id0)', INS, 'buy_policy', {
    coverage: u256('5000000'), trigger_types: slist(['oracle_failure']), expiry: u64('4102444800000'),
  });
  head.claim = await call('claim payout', INS, 'claim', {
    policy_id: u64('0'), attestation_id: u64('1'), trigger_type: sstr('oracle_failure'),
  });
  await call('submit slash att (id2)', REG, 'submit_attestation', {
    model_id: sstr('casperproof-riskscorer-v1'), input_hash: ba(h32('07')), output_hash: ba(h32('08')),
    commitment: ba(h32('09')), uri: sstr('s3://casperproof-payloads/demo-slash'), stake: u256('1000000000'),
  });
  await call('challenge att2', REG, 'challenge', { id: u64('2') });
  head.resolve = await call('resolve slash', REG, 'resolve', { id: u64('2'), fraudulent: sbool(true) });

  fs.writeFileSync(OUT, JSON.stringify(head, null, 2));
  console.log('\n=== HEADLINE TXS ===');
  for (const [k, v] of Object.entries(head)) console.log(`${k}: ${EXPLORER}/transaction/${v}`);
  console.log(`\nwrote ${OUT}`);
}
main().catch((e) => { console.error('FATAL', e.message || e); process.exit(1); });
