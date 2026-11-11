import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 7: KRONA Trade-In™ & Valuador de Singles', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como STORE_ADMIN (@AlexJudge / CC-0003) para operar módulo de Trade-In
    await page.goto('/login');
    const demoPanel = page.locator('#demoRolesPanel');
    await expect(demoPanel).toBeVisible();

    const storeAdminBtn = page.locator('button:has-text("Entrar como STORE_ADMIN")');
    await storeAdminBtn.click();
    await page.waitForURL((url) => url.pathname !== '/login');

    await page.goto('/trade-in');
  });

  test('7.1 Carga el portal de Trade-In con formulario de valuación, orígenes y guía GAAP', async ({ page }) => {
    // Verificar encabezado y títulos
    await expect(page.locator('h1')).toContainText('KRONA Trade-In™');

    // Verificar selectores principales
    await expect(page.locator('#issueStore')).toBeVisible();
    await expect(page.locator('#issueSourceType')).toBeVisible();
    await expect(page.locator('#issuePlayerSelect')).toBeVisible();
    await expect(page.locator('#issueAmountMxn')).toBeVisible();

    // Origen contable por defecto: Cta 1105
    const badge = page.locator('#issueSourceBadge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('1105');
  });

  test('7.2 Alta rápida de cliente en mostrador e inicio inmediato de valuación', async ({ page }) => {
    const timestamp = Date.now().toString().slice(-4);
    const regName = `Rodrigo TradeIn ${timestamp}`;
    const regAlias = `@rodrigo_${timestamp}`;

    await page.locator('#regFullName').fill(regName);
    await page.locator('#regAlias').fill(regAlias);

    const regBtn = page.locator('button:has-text("Dar de Alta e Iniciar Valuación")');
    await regBtn.click();

    // Verificar toast de éxito
    const toast = page.locator('#krona-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/registrado exitosamente/i);

    // El selector de jugador debe haberse actualizado automáticamente
    const playerSelect = page.locator('#issuePlayerSelect');
    await expect(playerSelect).toContainText(regName);
  });

  test('7.3 Emisión de crédito en partida doble por compra de cartas singles con tirilla térmica', async ({ page }) => {
    // Seleccionar cliente y monto
    const playerSelect = page.locator('#issuePlayerSelect');
    await expect(playerSelect).toBeVisible();
    await playerSelect.selectOption({ index: 0 });
    await page.locator('#issueAmountMxn').fill('350');
    await page.locator('#issueLabel').fill('Compra 2x The One Ring (NM)');

    // Ejecutar abono en partida doble
    const submitBtn = page.locator('button:has-text("Abonar Crédito en Partida Doble al Cliente")');
    await submitBtn.click();

    // Confirmar toast de éxito
    const toast = page.locator('#krona-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/Abono de \$350\.00.*acreditado/i);

    // Probar impresión térmica de recepción
    const printBtn = page.locator('button:has-text("Imprimir Último Comprobante de Recepción")');
    await expect(printBtn).toBeVisible();
    await printBtn.click();

    // Debe mostrar notificación de impresión térmica en mostrador
    await expect(toast).toContainText(/Imprimiendo comprobante/i);
  });

  test('7.4 Alerta preventiva de umbral Four-Eyes ante montos elevados o ajustes contables manuales', async ({ page }) => {
    const fourEyesBox = page.locator('#fourEyesContainer');
    await expect(fourEyesBox).toBeHidden();

    // Ingresar un monto elevado que supere el umbral gerencial ($1,500 MXN)
    await page.locator('#issueAmountMxn').fill('1500');
    await page.locator('#issueAmountMxn').dispatchEvent('input');

    // Debe mostrarse el contenedor de Four-Eyes
    await expect(fourEyesBox).toBeVisible();
    await expect(fourEyesBox).toContainText('AUTORIZACIÓN DUAL REQUERIDA');

    // Cambiar origen a AJUSTE MANUAL (Cta 5105) que exige Four-Eyes sin importar el monto
    await page.locator('#issueAmountMxn').fill('50');
    await page.locator('#issueSourceType').selectOption('MANUAL_ADJUSTMENT');
    await expect(fourEyesBox).toBeVisible();
    await expect(fourEyesBox).toContainText('ajuste manual');
  });
});
