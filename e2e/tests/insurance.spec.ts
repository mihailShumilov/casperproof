/**
 * Insurance view — happy path: score an address → buy a covered policy →
 * simulate a covered trigger → automatic payout, with the live feed reflecting
 * the ClaimPaid event and the vault solvency tiles updating.
 */
import { test, expect } from '@playwright/test';
import { connectWallet } from './helpers';
import { INSURANCE_DEFAULTS } from '../fixtures/demo-data';

test.beforeEach(async ({ page }) => {
  await page.goto('/insurance');
  await expect(page.getByRole('heading', { name: 'Insurance', level: 1 })).toBeVisible();
});

test('score an address (no wallet required)', async ({ page }) => {
  const scoreCard = page.locator('.cp-card', { hasText: '1 · Risk score' }).first();
  await scoreCard.getByRole('button', { name: 'Get risk score' }).click();
  // Deterministic mock score → Score + Tier stat tiles and a `/100` value render.
  await expect(scoreCard.getByText('Score', { exact: true })).toBeVisible();
  await expect(scoreCard.getByText('Tier', { exact: true })).toBeVisible();
  await expect(scoreCard.getByText(/\d+\/100/)).toBeVisible();
});

test('buy a policy is gated on a connected wallet', async ({ page }) => {
  await expect(page.getByText('Connect your wallet to sign', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buy policy' })).toBeDisabled();

  await connectWallet(page);
  await expect(page.getByRole('button', { name: 'Buy policy' })).toBeEnabled();
});

test('score → buy → simulate covered trigger → automatic payout', async ({ page }) => {
  await connectWallet(page);

  // 1 · Risk score
  await page.getByRole('button', { name: 'Get risk score' }).click();
  await expect(page.getByText(/\d+\/100/)).toBeVisible();

  // 2 · Buy a policy with the default covered trigger (oracle_failure).
  await page.getByRole('button', { name: 'Buy policy' }).click();

  // The policy row appears with its coverage and an Active badge.
  const policyRow = page.locator('.cp-card', { hasText: /Policy #\d+ ·/ }).first();
  await expect(policyRow).toBeVisible();
  await expect(policyRow.getByText('Active')).toBeVisible();
  await expect(policyRow.getByText(INSURANCE_DEFAULTS.triggerLabel)).toBeVisible();

  // 3 · Simulate a covered trigger → auto-payout.
  await policyRow.getByRole('button', { name: 'Simulate trigger' }).click();

  // The success notice confirms the policy paid out its coverage.
  await expect(page.getByText(/Auto-payout: policy #\d+ paid/)).toBeVisible();
  // The policy flips to Claimed.
  await expect(policyRow.getByText('Claimed')).toBeVisible();

  // The live feed shows the ClaimPaid event (and the earlier AttestationSubmitted).
  const feed = page.locator('.cp-card', { hasText: 'Live feed' }).first();
  await expect(feed.getByText('ClaimPaid').first()).toBeVisible();
});

test('vault solvency tiles reflect a purchased policy', async ({ page }) => {
  await connectWallet(page);
  await page.getByRole('button', { name: 'Buy policy' }).click();
  await expect(page.locator('.cp-card', { hasText: /Policy #\d+ ·/ }).first()).toBeVisible();

  // Solvency section renders coverage-out / premiums / free-reserve tiles. Scope to the
  // StatTile labels — the Recharts axis renders the same names as SVG <tspan> nodes.
  const solvency = page.locator('.cp-card', { hasText: 'Vault solvency' }).first();
  await expect(solvency.locator('.cp-stattile__label', { hasText: 'Coverage out' })).toBeVisible();
  await expect(solvency.locator('.cp-stattile__label', { hasText: 'Premiums' })).toBeVisible();
  await expect(solvency.locator('.cp-stattile__label', { hasText: 'Free reserve' })).toBeVisible();
  // With a 50 CSPR seed reserve and a 5 CSPR active policy, the vault stays solvent.
  await expect(solvency.getByText('solvent')).toBeVisible();
});
