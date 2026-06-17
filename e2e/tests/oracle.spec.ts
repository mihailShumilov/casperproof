/**
 * Oracle view — happy path + the verify PASS / FAIL assertion.
 *
 * Covers: connect wallet → submit a stake-backed attestation → it appears in the
 * list and the live feed → verify the unedited payload (PASS, hashes equal) →
 * tamper the payload and verify again (FAIL, hashes diverge).
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
import { ORACLE_DEFAULTS, prettyJson } from '../fixtures/demo-data';

test.beforeEach(async ({ page }) => {
  await page.goto('/oracle');
  await expect(page.getByRole('heading', { name: 'Oracle', level: 1 })).toBeVisible();
});

test('submit is gated on a connected wallet', async ({ page }) => {
  // Before connecting, the submit form shows the connect prompt and the button is disabled.
  await expect(
    page.getByText('Connect your wallet to sign the', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit attestation' })).toBeDisabled();

  await connectWallet(page);
  await expect(page.getByRole('button', { name: 'Submit attestation' })).toBeEnabled();
});

test('submit an attestation and see it in the list and live feed', async ({ page }) => {
  await connectWallet(page);
  const id = await submitOracleAttestation(page);

  // The attestation appears in the list with its model id.
  await expect(
    page.getByText(`#${id} · ${ORACLE_DEFAULTS.modelId}`),
  ).toBeVisible();

  // The live feed streams an AttestationSubmitted event for the submit.
  const feed = page.locator('.cp-card', { hasText: 'Live feed' }).first();
  await expect(feed.getByText('AttestationSubmitted').first()).toBeVisible();
});

test('verify the unedited payload PASSes with equal hashes', async ({ page }) => {
  await connectWallet(page);
  const id = await submitOracleAttestation(page);

  const row = await openVerifyPanel(page, id);
  // The panel pre-fills the canonical output, so an unchanged verify PASSes.
  await row.getByRole('button', { name: 'Verify proof' }).click();
  await expectVerifyPass(row);
  await expect(
    row.getByText('Recomputed hash matches the on-chain commitment.'),
  ).toBeVisible();
});

test('tampering the payload flips the verdict to FAIL with diverging hashes', async ({
  page,
}) => {
  await connectWallet(page);
  const id = await submitOracleAttestation(page);

  const row = await openVerifyPanel(page, id);
  // Tamper the payload (the panel label is the JsonField <label> text).
  await fillJsonField(
    page,
    'Payload to verify (recomputed hash is compared to on-chain)',
    prettyJson(ORACLE_DEFAULTS.tamperedOutput),
  );
  await row.getByRole('button', { name: 'Verify proof' }).click();
  await expectVerifyFail(row);
  await expect(
    row.getByText('Tampered — recomputed hash diverges from the on-chain commitment.'),
  ).toBeVisible();
});
