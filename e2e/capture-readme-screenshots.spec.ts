import { test, expect } from '@playwright/test';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/assets/screenshots');

test.describe('KRONA VAULT™ — Automated Visual Asset Pipeline for README', () => {
  test.use({
    viewport: { width: 1366, height: 860 },
    colorScheme: 'dark',
  });

  test('Capture 01: Nexus Command Hub (Landing)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForTimeout(500); // allow font & animation settling
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'nexus-hub.png'),
      fullPage: false,
    });
  });

  test('Capture 02: POS Terminal Portal', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#loginIdentifier', 'CC-0002');
    await page.fill('#loginSecret', 'krona2026');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL((url) => url.pathname !== '/login');

    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#posStoreSelect')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'pos-terminal.png'),
      fullPage: false,
    });
  });

  test('Capture 03: Citadel Audit & Accounting Ledger', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#loginIdentifier', 'CC-0002');
    await page.fill('#loginSecret', 'krona2026');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL((url) => url.pathname !== '/login');

    await page.goto('/audit');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#citadelJournalBody tr').first()).toBeVisible({ timeout: 6000 });
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'citadel-audit.png'),
      fullPage: false,
    });
  });

  test('Capture 04: Custody Escrow Vault', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#loginIdentifier', 'CC-0002');
    await page.fill('#loginSecret', 'krona2026');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL((url) => url.pathname !== '/login');

    await page.goto('/custody');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#kpiInVaultCount')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'custody-vault.png'),
      fullPage: false,
    });
  });

  test('Capture 05: Tournament Arena & Prize Dispersion', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#loginIdentifier', 'CC-0002');
    await page.fill('#loginSecret', 'krona2026');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL((url) => url.pathname !== '/login');

    await page.goto('/tournaments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'tournaments-arena.png'),
      fullPage: false,
    });
  });

  test('Capture 06: Player Wallet KRONA Pass™ PWA', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#loginIdentifier', 'CC-8492');
    await page.fill('#loginSecret', 'krona2026');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL('**/wallet');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#passPlayerName')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'wallet-pass.png'),
      fullPage: false,
    });
  });
});
