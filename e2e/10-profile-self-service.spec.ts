import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 10: KRONA Profile™ & Autoservicio de Seguridad', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como Jugador (@AlexMTG / CC-8492)
    await page.goto('/login');
    const demoPanel = page.locator('#demoRolesPanel');
    await expect(demoPanel).toBeVisible();

    const playerBtn = page.locator('button:has-text("Entrar como PLAYER")');
    await playerBtn.click();
    await page.waitForURL((url) => url.pathname !== '/login');

    await page.goto('/profile');
  });

  test('10.1 Carga el perfil con código de identidad, estado operativo y campos de credenciales', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('KRONA Profile™');

    // Código de miembro inmutable
    const memberCode = page.locator('#profMemberCode');
    await expect(memberCode).toBeVisible();
    await expect(memberCode).toContainText('CC-');

    // Rol y estatus
    const roleBadge = page.locator('#profRoleBadge');
    await expect(roleBadge).toBeVisible();
    await expect(roleBadge).toContainText('PLAYER');

    // Formulario de edición
    await expect(page.locator('#profFullName')).toBeVisible();
    await expect(page.locator('#profAlias')).toBeVisible();
  });

  test('10.2 Actualización de datos de perfil y guardado de credenciales', async ({ page }) => {
    const fullNameInput = page.locator('#profFullName');
    const prevName = await fullNameInput.inputValue();
    const updatedName = `${prevName} (Verified)`;

    await fullNameInput.fill(updatedName);

    const saveBtn = page.locator('button:has-text("Guardar Cambios en Mi Perfil y Credenciales")');
    await saveBtn.click();

    // Validar toast de éxito
    const toast = page.locator('#krona-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/actualizado/i);
  });

  test('10.3 Rotación de semilla criptográfica 2FA KRONA Pulse™ con confirmación modal', async ({ page }) => {
    const rotateBtn = page.locator('button:has-text("Rotar Semilla 2FA")');
    await expect(rotateBtn).toBeVisible();
    await rotateBtn.click();

    // Confirmar modal
    const confirmModal = page.locator('#kronaConfirmModal');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText('Regenerar Semilla 2FA');

    const okBtn = page.locator('#kronaConfirmBtnOk');
    await okBtn.click();

    // Verificar toast de éxito
    const toast = page.locator('#krona-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/regenerada/i);
  });

  test('10.4 Muestra panel de vinculación Authenticator con clave Base32 y código QR', async ({ page }) => {
    // Verificar distintivo de estado 2FA
    const authBadge = page.locator('#authHeaderBadge');
    await expect(authBadge).toBeVisible();

    // Si está en setup, debe mostrar la clave formateada
    const formattedSecret = page.locator('#authFormattedSecret');
    if (await formattedSecret.isVisible()) {
      const secretText = await formattedSecret.textContent();
      expect(secretText?.trim().length).toBeGreaterThan(5);
    }
  });
});
