import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 5: KRONA Custody™ & Escrow Vault', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como Director / SuperAdmin (@chamakov / CC-0002)
    await page.goto('/login');
    await page.fill('#loginIdentifier', 'CC-0002');
    await page.fill('#loginSecret', 'krona2026');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL((url) => url.pathname !== '/login');

    // Navegar a /custody
    await page.goto('/custody');
  });

  test('5.1 Muestra KPIs de Bóveda y pestañas tácticas de filtrado de inventario', async ({ page }) => {
    // Verificar KPIs de inventario físico
    const kpiInVault = page.locator('#kpiInVaultCount');
    await expect(kpiInVault).toBeVisible();

    const kpiReady = page.locator('#kpiReadyCount');
    await expect(kpiReady).toBeVisible();

    // Pestañas de filtrado de estados
    const tabAll = page.locator('#tabFilterAll');
    const tabInVault = page.locator('#tabFilterInVault');
    const tabReady = page.locator('#tabFilterReady');
    const tabReleased = page.locator('#tabFilterReleased');

    await expect(tabAll).toHaveClass(/active/);
    await expect(tabInVault).toBeVisible();
    await expect(tabReady).toBeVisible();
    await expect(tabReleased).toBeVisible();
  });

  test('5.2 Filtrado por pestaña táctica y búsqueda reactiva de folios', async ({ page }) => {
    const tabInVault = page.locator('#tabFilterInVault');
    await tabInVault.click();
    await expect(tabInVault).toHaveClass(/active/);

    const tabAll = page.locator('#tabFilterAll');
    await tabAll.click();
    await expect(tabAll).toHaveClass(/active/);

    // Búsqueda reactiva por folio o nombre
    const searchInput = page.locator('#custodySearchInput');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('CUST-');
    await searchInput.dispatchEvent('input');

    const tbody = page.locator('#custodyPackagesTbody');
    await expect(tbody).toBeVisible();
  });

  test('5.3 Intake a Bóveda: Registra paquete y genera Comprobante Oficial con VaultSeal™', async ({ page }) => {
    // Diligenciar formulario de ingreso de paquete
    const depositorNameInput = page.locator('#intakeDepositorName');
    await depositorNameInput.fill('Alejandro Gómez E2E');

    const summaryInput = page.locator('#intakeItemsSummary');
    await summaryInput.fill('Carpeta con Playset de Fetchlands MH3');

    // Registrar paquete y emitir comprobante
    const submitBtn = page.locator('button:has-text("Registrar Resguardo y Emitir Comprobante")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verificar generación inmediata del Comprobante Térmico de Bóveda
    const previewBox = page.locator('#custodyThermalPreviewBox');
    await expect(previewBox).toBeVisible();
    await expect(previewBox).toContainText('COMPROBANTE OFICIAL DE RESGUARDO', { timeout: 8000 });
    await expect(previewBox).toContainText('CÓDIGO:');
    await expect(previewBox).toContainText('SELLO CRIPTOGRÁFICO:');
    await expect(previewBox).toContainText('Alejandro Gómez E2E');
  });

  test('5.4 Selector de formato térmico alterna estilos entre 80mm y 58mm', async ({ page }) => {
    const widthSelect = page.locator('#custodyPaperWidthSelect');
    await expect(widthSelect).toBeVisible();

    // Cambiar a 58mm
    await widthSelect.selectOption('58mm');
    const previewBox = page.locator('#custodyThermalPreviewBox');
    await expect(previewBox).toHaveClass(/thermal-receipt-58mm/);

    // Regresar a 80mm
    await widthSelect.selectOption('80mm');
    await expect(previewBox).toHaveClass(/thermal-receipt-80mm/);
  });

  test('5.5 Sanitización defensiva contra ataques XSS en nombres y descripciones de resguardo', async ({ page }) => {
    // Intentar inyectar markup y etiquetas HTML en el remitente y descripción
    const depositorNameInput = page.locator('#intakeDepositorName');
    await depositorNameInput.fill('<b id="xssDepositorBold">Hacker</b>');

    const summaryInput = page.locator('#intakeItemsSummary');
    await summaryInput.fill('<img id="xssMaliciousImg" src="x" onerror="window.xssExecuted=true">Cartas Seguras');

    // Registrar paquete
    const submitBtn = page.locator('button:has-text("Registrar Resguardo y Emitir Comprobante")');
    await submitBtn.click();

    // Esperar comprobante
    const previewBox = page.locator('#custodyThermalPreviewBox');
    await expect(previewBox).toBeVisible();

    // Verificar en la tabla de paquetes que los tags NO se inyectaron como elementos del DOM
    const xssBoldTag = page.locator('#xssDepositorBold');
    await expect(xssBoldTag).toHaveCount(0);

    const xssImgTag = page.locator('#xssMaliciousImg');
    await expect(xssImgTag).toHaveCount(0);

    // Verificar que la variable global window.xssExecuted nunca se haya creado
    const xssExecuted = await page.evaluate(() => (window as any).xssExecuted);
    expect(xssExecuted).toBeUndefined();
  });

  test('5.6 Flujo de Liberación y Entrega en Mostrador con cotejo de precinto y PIN del cliente', async ({ page }) => {
    // 1. Registrar un paquete para entrega
    const depositorName = 'Beatriz Valenzuela E2E';
    await page.locator('#intakeDepositorName').fill(depositorName);
    await page.locator('#intakeItemsSummary').fill('Deck Box Ultimate Guard con cartas Commander');
    await page.locator('button:has-text("Registrar Resguardo y Emitir Comprobante")').click();

    // Confirmar comprobante de ingreso
    const previewBox = page.locator('#custodyThermalPreviewBox');
    await expect(previewBox).toContainText(depositorName, { timeout: 8000 });

    // 2. Localizar el botón de entrega en la tabla de paquetes o en el panel
    const releaseBtn = page.locator('button:has-text("🤝 Entregar")').first();
    await expect(releaseBtn).toBeVisible();
    await releaseBtn.click();

    // 3. Verificar que se abra el modal de liberación
    const releaseModal = page.locator('#custodyReleaseModal');
    await expect(releaseModal).toBeVisible();

    // 4. Marcar la lista de cotejo de seguridad obligatoria
    await page.locator('#chkPackageUntampered').check();
    await page.locator('#chkClientMatch').check();

    // 5. Ingresar PIN del cliente y nombre de quien retira
    await page.locator('#releaseClientPinInput').fill('123456');
    await page.locator('#releasePickedUpByName').fill(depositorName);

    // 6. Ejecutar liberación
    const submitReleaseBtn = page.locator('button:has-text("Validar Comprobante y Liberar Entrega al Cliente")');
    await submitReleaseBtn.click();

    // 7. Verificar toast de éxito y cierre de modal
    const toast = page.locator('#krona-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/entregado/i);
    await expect(releaseModal).toBeHidden();
  });
});
