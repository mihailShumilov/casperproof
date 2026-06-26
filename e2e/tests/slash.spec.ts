/**
 * Slash view — the economic-security flow: connect → submit a stake-backed
 * attestation → tamper & verify (FAIL, hashes diverge) → challenge → resolve
 * fraudulent → slash, with the stake split between challenger and treasury and
 * the live feed streaming Challenged + Resolved events.
 */
import { test, expect } from '@playwright/test';
import { connectWallet, expectVerifyFail } from './helpers';
import { SLASH_DEFAULTS } from '../fixtures/demo-data';

test.beforeEach(async ({ page }) => {
  await page.goto('/slash');
  await expect(page.getByRole('heading', { name: 'Slash demo', level: 1 })).toBeVisible();
});

test('the slash flow is gated on a connected wallet', async ({ page }) => {
  await expect(page.getByText('Connect your wallet to drive the slash flow.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit attestation' })).toBeDisabled();
});

test('submit → tamper & verify FAIL → challenge → resolve → slash', async ({ page }) => {
  await connectWallet(page);

  // 1 · Submit the honest-looking attestation (3 CSPR staked).
  await page.getByRole('button', { name: 'Submit attestation' }).click();
  // The step-1 card shows the new id, commitment, and an Active badge.
  const step1 = page.locator('.cp-card', { hasText: '1 · Submit attestation' }).first();
  await expect(step1.getByText('Active')).toBeVisible();
  // The staked amount, scoped to the Stake definition value (the card prose also says "3 CSPR").
  await expect(step1.locator('dt:has-text("Stake") + dd')).toHaveText(SLASH_DEFAULTS.stakeCspr);

  // 2 · Tamper & verify — the payload is pre-filled tampered, so verify FAILs.
  const step2 = page.locator('.cp-card', { hasText: '2 · Tamper & verify' }).first();
  await step2.getByRole('button', { name: 'Verify (expect FAIL)' }).click();
  // The verdict pill + hashes live in the result sub-card; assert on the step card scope.
  await expectVerifyFail(step2);
  await expect(step2.getByText('Tamper detected.')).toBeVisible();

  // 3 · Challenge the tampered proof.
  const step3 = page.locator('.cp-card', { hasText: '3 · Challenge' }).first();
  await step3.getByRole('button', { name: 'Challenge attestation' }).click();
  // The attestation status flips to Challenged (step-1 badge).
  await expect(step1.getByText('Challenged')).toBeVisible();

  // 4 · Resolve fraudulent → slash.
  const step4 = page.locator('.cp-card', { hasText: '4 · Resolve & slash' }).first();
  await step4.getByRole('button', { name: 'Resolve fraudulent → slash' }).click();
  await expect(step1.getByText('Slashed')).toBeVisible();

  // The economics card shows the stake split between challenger and treasury.
  const econ = page.locator('.cp-card', { hasText: 'Slash economics' }).first();
  await expect(econ.getByText('Stake at risk')).toBeVisible();
  await expect(econ.getByText('→ Challenger')).toBeVisible();
  await expect(econ.getByText('→ Treasury')).toBeVisible();
  await expect(econ.getByText(/Slashed\. .* moved to the challenger/)).toBeVisible();

  // The "Run again" affordance appears once slashed.
  await expect(page.getByRole('button', { name: 'Run again' })).toBeVisible();

  // The live feed streamed the Challenged and Resolved (fraudulent → slashed) events.
  const feed = page.locator('.cp-card', { hasText: 'Live feed' }).first();
  await expect(feed.getByText('Challenged').first()).toBeVisible();
  await expect(feed.getByText('Resolved').first()).toBeVisible();
  await expect(feed.getByText('fraudulent → slashed').first()).toBeVisible();
});
