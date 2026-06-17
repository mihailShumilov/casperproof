/**
 * Seed the CasperProof demo by driving the full oracle + insurance arc through the public
 * SDK + agent runtime — the same path the dApp and the demo video follow:
 *
 *   score → attest → verify PASS → buy policy → claim payout → tamper → verify FAIL →
 *   challenge → resolve(fraudulent) → slash.
 *
 * Runs against mock mode by default (no secrets) and against Casper Testnet when
 * `CSPR_CLOUD_TOKEN` is set. Also serves as an end-to-end integration check.
 * Run: `pnpm seed` or `make seed`.
 */
import { createClient } from '@casperproof/casper-sdk';
import {
  attest,
  createStore,
  evaluateClaim,
  loadStoreConfig,
  scoreRisk,
  verify,
} from '@casperproof/agent';

const STAKE = '1000000000000';
const RISK_MODEL = 'casperproof-riskscorer-v1';
const CLAIM_MODEL = 'casperproof-claimoracle-v1';

const ADDRESSES = [
  'account-hash-1111111111111111111111111111111111111111111111111111111111111111',
  'account-hash-2222222222222222222222222222222222222222222222222222222222222222',
  'account-hash-3333333333333333333333333333333333333333333333333333333333333333',
];

async function main(): Promise<void> {
  const sdk = createClient();
  const store = createStore(loadStoreConfig());
  console.log(`\n▶ Seeding CasperProof demo — SDK mode: ${sdk.mode}\n`);

  // 1. Risk-score + attest several addresses.
  const attestationIds: number[] = [];
  for (const address of ADDRESSES) {
    const score = scoreRisk(address);
    const res = await attest(sdk, store, {
      modelId: RISK_MODEL,
      input: { address },
      output: { score: score.score, tier: score.tier, decision: score.decision },
      stake: STAKE,
    });
    attestationIds.push(res.id);
    console.log(`  attest #${res.id}  ${address.slice(0, 20)}…  → ${score.tier} (${score.score})`);
  }

  // 2. Verify the first attestation → PASS.
  const firstId = attestationIds[0]!;
  const pass = await verify(sdk, store, firstId);
  console.log(`\n  verify #${firstId} → ${pass.valid ? 'PASS ✅' : 'FAIL ❌'} (onchain=${pass.onchainHash.slice(0, 12)}…)`);

  // 3. Claim-oracle decision → attest it.
  const claim = evaluateClaim({
    policyId: 0,
    coveredTriggers: ['oracle_failure'],
    coverage: '5000000000',
    lossAmount: '5000000000',
    oracleStale: true,
    oracleDeviationBps: 750,
  });
  // Store the claim payload, then submit with the trigger tagged in the uri fragment so the
  // (payload-less) mock backend can route the claim deterministically (live mode reads the
  // attested output instead).
  const claimUri = await store.put({
    modelId: CLAIM_MODEL,
    input: { policyId: 0, trigger: claim.triggerType },
    output: { decision: claim.decision, triggerType: claim.triggerType, amount: claim.amount },
  });
  const claimAttest = await sdk.submitAttestation({
    modelId: CLAIM_MODEL,
    input: { policyId: 0, trigger: claim.triggerType },
    output: { decision: claim.decision, triggerType: claim.triggerType, amount: claim.amount },
    uri: `${claimUri}#trigger=${claim.triggerType}`,
    stake: STAKE,
  });
  console.log(`  claim-oracle → ${claim.decision} (${claim.triggerType}) attested as #${claimAttest.id}`);

  // 4. Buy a policy + submit a claim against the claim attestation.
  const policy = await sdk.createPolicy({
    coverage: '5000000000',
    premium: '250000000',
    triggerTypes: ['oracle_failure', 'exploit'],
    expiry: 4_102_444_800, // 2100-01-01
  });
  const claimResult = await sdk.submitClaim(policy.id, claimAttest.id);
  console.log(`  policy #${policy.id} bought → claim paid: ${JSON.stringify(claimResult)}`);

  // 5. Tamper the second attestation's payload → verify FAIL → challenge → slash.
  const tamperId = attestationIds[1]!;
  const tampered = await sdk.getAttestation(tamperId);
  try {
    store.corrupt(tampered.uri);
    const fail = await verify(sdk, store, tamperId);
    console.log(`\n  tampered #${tamperId} → verify ${fail.valid ? 'PASS ❌(unexpected)' : 'FAIL ✅'}`);
  } catch (err) {
    console.log(`  (tamper only supported on the in-memory store: ${(err as Error).message})`);
  }
  await sdk.challenge(tamperId);
  await sdk.resolve(tamperId, true);
  console.log(`  challenged + resolved(fraudulent) #${tamperId} → stake slashed`);

  // 6. Summary.
  const count = await sdk.attestationCount();
  console.log(`\n✓ Demo seeded. attestation_count=${count}, policies=1, slashed=1.\n`);
  if (sdk.mode === 'mock') {
    console.log('  (mock mode: state lives in-process. Set CSPR_CLOUD_TOKEN for on-chain seeding.)\n');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
