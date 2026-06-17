/**
 * Helper for funding the Casper Testnet deploy account from the faucet.
 *
 * The faucet is a web tool, so this script prints the account to fund and the faucet URL
 * rather than automating it. Run: `pnpm fund:testnet`.
 */
const FAUCET_URL = 'https://testnet.cspr.live/tools/faucet';

function main(): void {
  const keyPath = process.env.CASPER_SECRET_KEY_PATH;
  const network = process.env.CASPER_NETWORK_NAME ?? 'casper-test';

  console.log(`\n▶ CasperProof testnet funding — network: ${network}\n`);
  if (!keyPath) {
    console.log('  No CASPER_SECRET_KEY_PATH set. To deploy to testnet you need a key pair:');
    console.log('    1. Generate one (e.g. `casper-client keygen ./keys`).');
    console.log('    2. Set CASPER_SECRET_KEY_PATH in .env to the secret_key.pem path.');
    console.log(`    3. Fund the public key at the faucet: ${FAUCET_URL}`);
    console.log('\n  See SETUP_NEEDED.md for the full list of testnet secrets.\n');
    return;
  }
  console.log(`  Secret key: ${keyPath}`);
  console.log(`  Fund the corresponding public key (derive with casper-client account-address)`);
  console.log(`  at the faucet: ${FAUCET_URL}\n`);
}

main();
