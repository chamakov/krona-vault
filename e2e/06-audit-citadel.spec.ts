import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 6: Citadel Audit, Libro Diario y Arqueo Corte Z', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como Director / SuperAdmin (@chamakov / CC-0002) que tiene permisos totales en /audit
    await page.goto('/login');
    await page.fill('#loginIdentifier', 'CC-0002');
    await page.fill('#loginSecret', 'krona2026');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL((url) => url.pathname !== '/login');
    await page.goto('/audit');
  });

  test('6.1 Libro Diario Contable: Valida ecuación fundamental Σ DEBE = Σ HABER y pólizas', async ({ page }) => {
    // Distintivo de balance invariante
    const balanceBadge = page.locator('#ledgerBalanceBadge');
    await expect(balanceBadge).toBeVisible();
    await expect(balanceBadge).toContainText('Σ DEBE');
    await expect(balanceBadge).toContainText('Σ HABER');

    // Tabla del libro diario contable
    const journalTable = page.locator('table.krona-table').first();
    await expect(journalTable).toBeVisible();
    const rows = page.locator('#citadelJournalBody tr');
    await expect(rows.first()).toBeVisible({ timeout: 6000 });
  });

  test('6.2 Generación y proyección de Cierre de Turno / Arqueo (Corte Z)', async ({ page }) => {
    // Disparar generación de Cierre de Turno
    const closeBtn = page.locator('button:has-text("Actualizar Arqueo de Turno")');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Validar tirilla térmica emitida
    const closureOutput = page.locator('#citadelClosureOutput');
    await expect(closureOutput).toBeVisible();
    await expect(closureOutput).toContainText(/CORTE Z|CIERRE DE TURNO|ARQUEO/i, { timeout: 8000 });
    await expect(closureOutput).toContainText('SUCURSAL:');
  });

  test('6.3 Auditoría Forense de Tickets Físicos: Distingue tickets genuinos de adulterados', async ({ page }) => {
    // 1. Autocompletar con el último voucher emitido
    const autofillBtn = page.locator('button:has-text("Autocompletar Último Voucher")');
    await expect(autofillBtn).toBeVisible();
    await autofillBtn.click();

    // 2. Verificar autenticidad con datos genuinos
    const verifyBtn = page.locator('button:has-text("Auditar Autenticidad del Ticket")');
    await verifyBtn.click();

    const resultBox = page.locator('#verifyResultBox');
    await expect(resultBox).toBeVisible();
    await expect(resultBox).toContainText(/AUTÉNTICO/i, { timeout: 6000 });

    // 3. Modificar intencionalmente el sello criptográfico para simular alteración física
    const sealInput = page.locator('#verifySealInput');
    await sealInput.fill('TAMPERED-HASH-0000');
    await verifyBtn.click();

    // 4. El motor debe detonar la alerta forense
    await expect(resultBox).toContainText('ALERTA FORENSE', { timeout: 6000 });
  });

  test('6.4 Selector de formato térmico alterna estilos entre 80mm y 58mm en Corte Z', async ({ page }) => {
    const paperSelect = page.locator('#corteZPaperSelect');
    await expect(paperSelect).toBeVisible();

    // Cambiar a 58mm
    await paperSelect.selectOption('58mm');
    const closureOutput = page.locator('#citadelClosureOutput');
    await expect(closureOutput).toHaveClass(/thermal-receipt-58mm/);

    // Regresar a 80mm
    await paperSelect.selectOption('80mm');
    await expect(closureOutput).toHaveClass(/thermal-receipt-80mm/);
  });
});
