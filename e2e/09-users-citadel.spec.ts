import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 9: KRONA IAM™ & Padrón de Usuarios RBAC', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como SUPER_ADMIN (@chamakov / CC-0002)
    await page.goto('/login');
    const demoPanel = page.locator('#demoRolesPanel');
    await expect(demoPanel).toBeVisible();

    const superAdminBtn = page.locator('button:has-text("Entrar como SUPER_ADMIN")');
    await superAdminBtn.click();
    await page.waitForURL((url) => url.pathname !== '/login');

    await page.goto('/users');
  });

  test('9.1 Carga el padrón general de usuarios y permite filtrado táctico por rol', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('KRONA IAM™');

    // Verificar pestañas de filtro táctico
    const tabAll = page.locator('#filterTabAll');
    const tabStaff = page.locator('#filterTabStaff');
    const tabPlayers = page.locator('#filterTabPlayers');

    await expect(tabAll).toHaveClass(/active/);
    await expect(tabStaff).toBeVisible();
    await expect(tabPlayers).toBeVisible();

    // Tabla de usuarios
    const tbody = page.locator('#usersDirectoryBody');
    await expect(tbody).toBeVisible();
    const rows = await tbody.locator('tr').count();
    expect(rows).toBeGreaterThan(0);

    // Filtrar solo Staff
    await tabStaff.click();
    await expect(tabStaff).toHaveClass(/active/);
    await expect(tbody).toContainText('SUPER_ADMIN');

    // Filtrar solo Jugadores
    await tabPlayers.click();
    await expect(tabPlayers).toHaveClass(/active/);
    await expect(tbody).toContainText('PLAYER');
  });

  test('9.2 Registra nuevo personal operativo (CASHIER) con credenciales y PIN inicial', async ({ page }) => {
    const timestamp = Date.now().toString().slice(-4);
    const cashierName = `Cajero Turno Matutino ${timestamp}`;
    const cashierAlias = `@cajero_${timestamp}`;

    await page.locator('#newUserFullName').fill(cashierName);
    await page.locator('#newUserAlias').fill(cashierAlias);
    await page.locator('#newUserRole').selectOption('CASHIER');
    await page.locator('#newUserEmail').fill(`cajero${timestamp}@kronavault.mx`);
    await page.locator('#newUserPhone').fill('+52 55 5555 1234');
    await page.locator('#newUserPass').fill('krona2026');
    await page.locator('#newUserPin').fill('123456');

    const submitBtn = page.locator('button:has-text("Registrar Usuario en Padrón y Generar Semilla Criptográfica")');
    await submitBtn.click();

    // Verificar toast de éxito
    const toast = page.locator('#krona-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/creado con rol CASHIER/i);

    // Verificar en la tabla que el usuario fue agregado
    const tbody = page.locator('#usersDirectoryBody');
    await expect(tbody).toContainText(cashierName);
  });

  test('9.3 Valida formulario de fusión de cuentas duplicadas de jugador con confirmación', async ({ page }) => {
    const mergeCard = page.locator('#accountMergeCard');
    await expect(mergeCard).toBeVisible();

    const primarySelect = page.locator('#mergePrimarySelect');
    const secondarySelect = page.locator('#mergeSecondarySelect');

    const primaryOpts = await primarySelect.locator('option').allTextContents();
    const secOpts = await secondarySelect.locator('option').allTextContents();

    expect(primaryOpts.length).toBeGreaterThan(0);
    expect(secOpts.length).toBeGreaterThan(0);

    // Si hay al menos dos jugadores distintos, verificar flujo de confirmación
    if (primaryOpts.length > 1) {
      await primarySelect.selectOption({ index: 0 });
      await secondarySelect.selectOption({ index: 1 });

      const mergeBtn = page.locator('button:has-text("Fusionar Cuentas y Consolidar Lotes FEFO")');
      await mergeBtn.click();

      // Debe abrirse el modal de confirmación con alerta irreversible
      const confirmModal = page.locator('#kronaConfirmModal');
      await expect(confirmModal).toBeVisible();
      await expect(confirmModal).toContainText('Fusión Irreversible de Cuentas');

      // Cancelar para preservar el estado de datos de la suite
      const cancelBtn = page.locator('#kronaConfirmBtnCancel');
      await cancelBtn.click();
      await expect(confirmModal).toBeHidden();
    }
  });
});
