/**
 * Shared Playwright steps for the CasperProof e2e suite.
 *
 * Selectors are sourced from the real DOM in `apps/web/src`:
 *   - Buttons render visible text via `@casperproof/ui` `<Button>` → getByRole('button', { name }).
 *   - Form fields expose `aria-label` (inputs) or `<label htmlFor>` (JsonField textareas) → getByLabel.
 *   - The verdict pill (`VerdictPill`) renders the literal text "PASS" / "FAIL".
 *   - HashDisplay truncates the hash in the DOM but keeps the full value in the
 *     `title` attribute of its `.cp-hash__value` span — so hash equality is asserted
 *     against `title`, not the visible (truncated) text.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { DEMO_ACCOUNT_LABEL, ORACLE_DEFAULTS, prettyJson } from '../fixtures/demo-data';

/**
 * Connect the mock CSPR.click wallet from the top nav and wait for the connected
 * state (the "Demo Attestor" pill + a "Disconnect" button).
 */
export async function connectWallet(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Connect wallet' }).click();
  // The mock connector resolves the fixed demo account after a short handshake.
  await expect(page.getByText(DEMO_ACCOUNT_LABEL)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();
}

/**
 * Submit an attestation on the Oracle view using its pre-filled defaults, with
 * an optional output override. Asserts the success notice and returns the new id.
 */
export async function submitOracleAttestation(
  page: Page,
  options: { output?: unknown } = {},
): Promise<number> {
  if (options.output !== undefined) {
    await fillJsonField(page, 'Output JSON', prettyJson(options.output));
  }
  const submit = page.getByRole('button', { name: 'Submit attestation' });
  await expect(submit).toBeEnabled();
  await submit.click();

  // "Attestation #N submitted and staked." — a role="status" success notice.
  const notice = page.getByText(/Attestation #\d+ submitted and staked\./);
  await expect(notice).toBeVisible();
  const text = (await notice.textContent()) ?? '';
  const match = /#(\d+)/.exec(text);
  expect(match, 'submit notice should contain an attestation id').not.toBeNull();
  return Number(match![1]);
}

/**
 * Fill one of the JsonField textareas, located by its visible label. The
 * textarea is associated to the label via `htmlFor`, so getByLabel resolves it.
 */
export async function fillJsonField(page: Page, label: string, value: string): Promise<void> {
  const field = page.getByLabel(label);
  await field.fill(value);
}

/**
 * Read the full hash value behind a HashDisplay rendered as the `<dd>` for a
 * given `<dt>` label (e.g. "On-chain hash"). The full value lives in the
 * `title` attribute of the inner `.cp-hash__value` span.
 *
 * @param scope The container (panel/card) to scope the lookup to.
 */
export async function readHashByLabel(scope: Locator, dtLabel: string): Promise<string> {
  // dt → its following-sibling dd → the cp-hash value span carrying the full hash.
  const value = scope.locator(`dt:has-text("${dtLabel}") + dd .cp-hash__value`).first();
  await expect(value).toBeVisible();
  const title = await value.getAttribute('title');
  expect(title, `${dtLabel} should expose a full hash via title`).toBeTruthy();
  return (title ?? '').trim();
}

/**
 * Assert a verify result region shows a PASS verdict with the on-chain and
 * recomputed hashes present and byte-for-byte equal.
 */
export async function expectVerifyPass(scope: Locator): Promise<void> {
  await expect(scope.getByText('PASS', { exact: true })).toBeVisible();
  const onchain = await readHashByLabel(scope, 'On-chain hash');
  const recomputed = await readHashByLabel(scope, 'Recomputed hash');
  expect(recomputed, 'PASS: recomputed hash must equal on-chain hash').toBe(onchain);
}

/**
 * Assert a verify result region shows a FAIL verdict with the on-chain and
 * recomputed hashes present and *not* equal (tamper detected).
 */
export async function expectVerifyFail(scope: Locator): Promise<void> {
  await expect(scope.getByText('FAIL', { exact: true })).toBeVisible();
  const onchain = await readHashByLabel(scope, 'On-chain hash');
  const recomputed = await readHashByLabel(scope, 'Recomputed hash');
  expect(recomputed, 'FAIL: recomputed hash must diverge from on-chain hash').not.toBe(onchain);
}

/**
 * Locate the attestation row card for a given id on the Oracle list, and expand
 * its inline verify panel. Returns the row card locator.
 */
export async function openVerifyPanel(page: Page, attestationId: number): Promise<Locator> {
  const row = page
    .locator('.cp-card')
    .filter({ hasText: `#${attestationId} · ${ORACLE_DEFAULTS.modelId}` })
    .first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Verify' }).click();
  return row;
}
