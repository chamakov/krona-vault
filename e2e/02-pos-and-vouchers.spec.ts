import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 2: Terminal POS, Redención Mixta y Vouchers Térmicos Anti-Doble Uso', () => {
  test.beforeEach(async ({ page }) => {
    // Autenticar como Cajero oficial para operar en caja
    await page.goto('/login');
    const demoPanel = page.locator('#demoRolesPanel');
    await expect(demoPanel).toBeVisible();

    const cashierBtn = page.locator('button:has-text("Entrar como CASHIER")');
    await cashierBtn.click();
    await page.waitForURL('**/pos');
  });

  test('2.1 Carga la Terminal POS con selector de jugador y cálculo de desglose mixto en tiempo real', async ({ page }) => {
    await page.goto('/pos');

    // Comprobar elementos principales de la interfaz táctica
    await expect(page.locator('#posStoreSelect')).toBeVisible();
    await expect(page.locator('#posPlayerSelector')).toBeVisible();

    // Seleccionar un jugador con saldo disponible
    const playerSelect = page.locator('#posPlayerSelector');
    const options = await playerSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(0);

    // Seleccionar la primera opción de jugador con saldo
    await playerSelect.selectOption({ index: 0 });

    // Ingresar importes: Venta Total $400, Crédito $150
    const totalInput = page.locator('#posTotalMxn');
    const creditInput = page.locator('#posCreditMxn');

    await totalInput.fill('400');
    await creditInput.fill('150');

    // Verificar previsualización de pago mixto en tiempo real
    const splitCredit = page.locator('#splitCreditPreview');
    const splitCash = page.locator('#splitCashPreview');

    await expect(splitCredit).toContainText('$150.00');
    await expect(splitCash).toContainText('$250.00');
  });

  test('2.2 Ejecuta cobro con PIN 2FA, emite Voucher Original y audita reimpresión anti-fraude', async ({ page }) => {
    await page.goto('/pos');

    // Seleccionar jugador con PIN activo (@AlexMTG / CC-8492)
    const playerSelect = page.locator('#posPlayerSelector');
    await playerSelect.selectOption({ value: 'u_player_1' });

    // Definir monto a cobrar: $200 total, $100 de crédito
    await page.locator('#posTotalMxn').fill('200');
    await page.locator('#posCreditMxn').fill('100');

    // Cambiar método de autenticación a PIN_OFFLINE_2FA
    const authMethodSelect = page.locator('#posAuthMethod');
    await authMethodSelect.selectOption('PIN_OFFLINE_2FA');

    // Ingresar el PIN 2FA del jugador (123456 por defecto en cuentas semilla)
    const pinInput = page.locator('#posAuthPinInput');
    await expect(pinInput).toBeVisible();
    await pinInput.fill('123456');

    // Ejecutar cobro y emisión
    const redeemBtn = page.locator('#posRedeemBtn');
    await expect(redeemBtn).toBeVisible();
    await redeemBtn.click();

    // Verificar que la tirilla térmica original se proyecte en pantalla
    const thermalBox = page.locator('#thermalOutputBox');
    await expect(thermalBox).toBeVisible();
    await expect(thermalBox).toContainText('[ ORIGINAL - PÓLIZA DE CAJA ]', { timeout: 8000 });
    await expect(thermalBox).toContainText('SELLO CRIPTOGRÁFICO:');
    await expect(thermalBox).toContainText('CRÉDITO TOMADO:');

    // Probar reimpresión auditada de copia
    const reprintBtn = page.locator('button:has-text("Reimprimir Copia Auditada")');
    await expect(reprintBtn).toBeVisible();
    await reprintBtn.click();

    // La segunda emisión debe llevar explícitamente la alerta anti-doble arqueo
    await expect(thermalBox).toContainText('COPIA REIMPRESA #2', { timeout: 8000 });
    await expect(thermalBox).toContainText('NO VÁLIDA PARA ARQUEO');
  });

  test('2.3 Selector de ancho térmico alterna estilos entre 80mm y 58mm', async ({ page }) => {
    await page.goto('/pos');

    const paperSelect = page.locator('#thermalPaperSelect');
    await expect(paperSelect).toBeVisible();

    // Cambiar a 58mm
    await paperSelect.selectOption('58mm');
    const thermalBox = page.locator('#thermalOutputBox');
    await expect(thermalBox).toHaveClass(/thermal-receipt-58mm/);

    // Volver a 80mm
    await paperSelect.selectOption('80mm');
    await expect(thermalBox).toHaveClass(/thermal-receipt-80mm/);
  });

  test('2.4 Rechaza cobro en mostrador si se ingresa un PIN incorrecto o se omite la prueba de autorización', async ({ page }) => {
    await page.goto('/pos');

    // Seleccionar jugador (@AlexMTG / CC-8492)
    const playerSelect = page.locator('#posPlayerSelector');
    await playerSelect.selectOption({ value: 'u_player_1' });

    // Llenar monto de compra
    await page.locator('#posTotalMxn').fill('150');
    await page.locator('#posCreditMxn').fill('50');

    // Seleccionar PIN_OFFLINE_2FA e ingresar PIN erróneo
    const authMethodSelect = page.locator('#posAuthMethod');
    await authMethodSelect.selectOption('PIN_OFFLINE_2FA');

    const pinInput = page.locator('#posAuthPinInput');
    await expect(pinInput).toBeVisible();
    await pinInput.fill('000000'); // PIN inválido

    // Intentar autorizar
    const redeemBtn = page.locator('#posRedeemBtn');
    await redeemBtn.click();

    // Debe mostrar toast de error y no emitir voucher original
    const toast = page.locator('#krona-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/PIN.*INCORRECTO/i);

    const thermalBox = page.locator('#thermalOutputBox');
    await expect(thermalBox).not.toContainText('#POS-');
  });

  test('2.5 Procesa Devolución / Reembolso con regla Anti-Cash-Out restaurando Crédito de Tienda', async ({ page }) => {
    await page.goto('/pos');

    // 1. Emitir primero un cobro para asegurar un voucher elegible
    const playerSelect = page.locator('#posPlayerSelector');
    await playerSelect.selectOption({ value: 'u_player_1' });
    await page.locator('#posTotalMxn').fill('200');
    await page.locator('#posCreditMxn').fill('100');
    await page.locator('#posAuthMethod').selectOption('PIN_OFFLINE_2FA');
    await page.locator('#posAuthPinInput').fill('123456');
    await page.locator('#posRedeemBtn').click();

    // Esperar a que el voucher se emita
    const thermalBox = page.locator('#thermalOutputBox');
    await expect(thermalBox).toContainText('[ ORIGINAL - PÓLIZA DE CAJA ]', { timeout: 8000 });

    // 2. Conmutar a la pestaña de Devolución Anti-Cash-Out
    const tabRefund = page.locator('#posTabRefund');
    await expect(tabRefund).toBeVisible();
    await tabRefund.click();

    const refundView = page.locator('#posViewRefund');
    await expect(refundView).toBeVisible();

    // 3. Seleccionar voucher emitido y definir monto
    const refundSelect = page.locator('#refundVoucherSelect');
    const voucherOptions = await refundSelect.locator('option').allTextContents();
    expect(voucherOptions.length).toBeGreaterThan(0);

    await page.locator('#refundAmountMxn').fill('50');
    await page.locator('#refundReason').fill('Devolución por defecto de empaque');

    // 4. Hacer clic en procesar reembolso
    const refundBtn = page.locator('button:has-text("Ejecutar Reembolso Auditado Anti-Cash-Out")');
    await refundBtn.click();

    // 5. Confirmar modal de KronaCore
    const confirmBtn = page.locator('#kronaConfirmBtnOk');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 6. Verificar que la tirilla térmica de devolución se proyecte
    await expect(thermalBox).toContainText('PÓLIZA DEVOLUCIÓN', { timeout: 8000 });
    await expect(thermalBox).toContainText('ANTI-CASH-OUT');
    await expect(thermalBox).toContainText('RESTITUIDO A CRÉDITO:');
  });
});
