/**
 * The full CasperProof demo flow — the spec's §20 climax, end to end.
 *
 * One continuous session drives the whole arc across all three views. Because
 * the dApp's SDK client is a per-session singleton (`apps/web/src/lib/sdk.ts`)
 * over the in-memory mock backend, navigating with the in-app nav links (Next
 * `<Link>` client navigation, *not* a hard reload) preserves the store — so an
 * action on one view streams into the live feed on every view, exactly as the
 * demo shows.
 *
 * Arc:
 *   1. Connect the mock wallet.
 *   2. Insurance: score an address.
 *   3. Oracle: submit an attestation, then verify it → PASS (on-chain hash ==
 *      recomputed hash, both shown and equal).
 *   4. Insurance: buy a covered policy, simulate the covered trigger, claim →
 *      automatic payout.
 *   5. Oracle: tamper a payload and verify → FAIL (hashes diverge).
 *   6. Slash: submit → tamper & verify FAIL → challenge → resolve fraudulent →
 *      slash, stake split between challenger and treasury.
 *   7. Assert the live feed / dashboard reflects the events throughout.
 */
import { test, expect } from '@playwright/test';
import {
  connectWallet,
  submitOracleAttestation,
  openVerifyPanel,
  fillJsonField,
  expectVerifyPass,
  expectVerifyFail,
} from './helpers';
import {
  ORACLE_DEFAULTS,
  INSURANCE_DEFAULTS,
  SLASH_DEFAULTS,
  prettyJson,
} from '../fixtures/demo-data';

/** Click an in-app nav link (preserves the singleton SDK store across views). */
async function navTo(page: import('@playwright/test').Page, label: string, heading: string) {
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: label })
    .click();
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
}

test('full demo flow: connect → score → attest → verify PASS → policy → payout → tamper → FAIL → challenge → slash', async ({
  page,
}) => {
  // Start at the Oracle view and connect the mock wallet (persists across nav).
  await page.goto('/oracle');
  await expect(page.getByRole('heading', { name: 'Oracle', level: 1 })).toBeVisible();
  await connectWallet(page);

  // ── 1 · Score an address (Insurance) ───────────────────────────────────────
  await navTo(page, 'Insurance', 'Insurance');
  await page.getByRole('button', { name: 'Get risk score' }).click();
  await expect(page.getByText(/\d+\/100/)).toBeVisible();

  // ── 2 · Submit + attest, then verify PASS (Oracle) ──────────────────────────
  await navTo(page, 'Oracle', 'Oracle');
  const attestationId = await submitOracleAttestation(page);
  await expect(page.getByText(`#${attestationId} · ${ORACLE_DEFAULTS.modelId}`)).toBeVisible();

  const passRow = await openVerifyPanel(page, attestationId);
  await passRow.getByRole('button', { name: 'Verify proof' }).click();
  // PASS: both the on-chain and recomputed hashes are shown and equal.
  await expectVerifyPass(passRow);

  // ── 3 · Buy a policy, simulate covered trigger, claim payout (Insurance) ─────
  await navTo(page, 'Insurance', 'Insurance');
  await page.getByRole('button', { name: 'Buy policy' }).click();
  const policyRow = page.locator('.cp-card', { hasText: /Policy #\d+ ·/ }).first();
  await expect(policyRow).toBeVisible();
  await expect(policyRow.getByText('Active')).toBeVisible();
  await expect(policyRow.getByText(INSURANCE_DEFAULTS.triggerLabel)).toBeVisible();

  await policyRow.getByRole('button', { name: 'Simulate trigger' }).click();
  await expect(page.getByText(/Auto-payout: policy #\d+ paid/)).toBeVisible();
  await expect(policyRow.getByText('Claimed')).toBeVisible();
  // The dashboard live feed shows the payout.
  let feed = page.locator('.cp-card', { hasText: 'Live feed' }).first();
  await expect(feed.getByText('ClaimPaid').first()).toBeVisible();

  // ── 4 · Tamper a payload → verify FAIL (Oracle) ─────────────────────────────
  await navTo(page, 'Oracle', 'Oracle');
  const failRow = await openVerifyPanel(page, attestationId);
  await fillJsonField(
    page,
    'Payload to verify (recomputed hash is compared to on-chain)',
    prettyJson(ORACLE_DEFAULTS.tamperedOutput),
  );
  await failRow.getByRole('button', { name: 'Verify proof' }).click();
  // FAIL: recomputed hash diverges from the on-chain commitment.
  await expectVerifyFail(failRow);

  // ── 5 · Challenge + slash (Slash demo) ──────────────────────────────────────
  await navTo(page, 'Slash demo', 'Slash demo');

  await page.getByRole('button', { name: 'Submit attestation' }).click();
  const step1 = page.locator('.cp-card', { hasText: '1 · Submit attestation' }).first();
  await expect(step1.getByText('Active')).toBeVisible();
  await expect(step1.getByText(SLASH_DEFAULTS.stakeCspr)).toBeVisible();

  const step2 = page.locator('.cp-card', { hasText: '2 · Tamper & verify' }).first();
  await step2.getByRole('button', { name: 'Verify (expect FAIL)' }).click();
  await expectVerifyFail(step2);

  const step3 = page.locator('.cp-card', { hasText: '3 · Challenge' }).first();
  await step3.getByRole('button', { name: 'Challenge attestation' }).click();
  await expect(step1.getByText('Challenged')).toBeVisible();

  const step4 = page.locator('.cp-card', { hasText: '4 · Resolve & slash' }).first();
  await step4.getByRole('button', { name: 'Resolve fraudulent → slash' }).click();
  await expect(step1.getByText('Slashed')).toBeVisible();

  // The stake is split between the challenger and the treasury.
  const econ = page.locator('.cp-card', { hasText: 'Slash economics' }).first();
  await expect(econ.getByText('→ Challenger')).toBeVisible();
  await expect(econ.getByText('→ Treasury')).toBeVisible();
  await expect(econ.getByText(/Slashed\. .* moved to the challenger/)).toBeVisible();

  // ── 6 · Live feed reflects the whole arc ────────────────────────────────────
  feed = page.locator('.cp-card', { hasText: 'Live feed' }).first();
  await expect(feed.getByText('AttestationSubmitted').first()).toBeVisible();
  await expect(feed.getByText('ClaimPaid').first()).toBeVisible();
  await expect(feed.getByText('Challenged').first()).toBeVisible();
  await expect(feed.getByText('Resolved').first()).toBeVisible();
  await expect(feed.getByText('fraudulent → slashed').first()).toBeVisible();
});
