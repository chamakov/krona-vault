import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 1: Autenticación, Navegación y Control de Acceso RBAC', () => {
  test('1.1 Carga la portada KRONA Nexus™ con identidad visual, branding y accesos rápidos', async ({ page }) => {
    await page.goto('/');

    // Verificar título canónico y metadatos
    await expect(page).toHaveTitle(/KRONA VAULT/i);

    // Verificar presencia de elementos clave de la portada
    const heroHeading = page.locator('h1');
    await expect(heroHeading).toBeVisible();

    // Comprobar enlaces principales hacia los portales
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink.first()).toBeVisible();
  });

  test('1.2 Autenticación con Conmutador Demo de 1-Clic para roles oficiales', async ({ page }) => {
    await page.goto('/login');

    // Esperar a que el selector demo cargue los 6 roles
    const demoPanel = page.locator('#demoRolesPanel');
    await expect(demoPanel).toBeVisible();

    // Localizar el botón para entrar como CASHIER
    const cashierBtn = page.locator('button:has-text("Entrar como CASHIER")');
    await expect(cashierBtn).toBeVisible();

    // Hacer clic en entrar como CASHIER
    await cashierBtn.click();

    // Debe guardar la sesión y redirigir al portal asignado (/pos) o actualizar la sesión
    await page.waitForURL('**/pos');
    await expect(page).toHaveURL(/\/pos/);

    // Verificar que en el POS se identifique la sesión
    await expect(page.locator('#posStoreSelect')).toBeVisible();
  });

  test('1.3 Bloqueo de Acceso RBAC: Cajero no puede acceder a Auditoría Forense (/audit)', async ({ page }) => {
    // Autenticar primero como CASHIER en /login
    await page.goto('/login');
    const demoPanel = page.locator('#demoRolesPanel');
    await expect(demoPanel).toBeVisible();

    const cashierBtn = page.locator('button:has-text("Entrar como CASHIER")');
    await cashierBtn.click();
    await page.waitForURL('**/pos');
    await expect(page.locator('#posStoreSelect')).toBeVisible();

    // Intentar acceder al módulo restringido /audit mediante atajo táctico de teclado ('Alt+4')
    await page.keyboard.press('Alt+4');

    // Debe interceptar inmediatamente y desplegar el modal de Acceso Denegado por RBAC
    const deniedModal = page.locator('#kronaAccessDeniedModal');
    await expect(deniedModal).toBeVisible({ timeout: 5000 });

    // Verificar contenido del modal
    await expect(deniedModal).toContainText('Acceso Restringido');
    await expect(deniedModal).toContainText('CASHIER');

    // Cerrar modal haciendo clic en Entendido
    const okBtn = deniedModal.locator('button:has-text("Entendido")');
    await expect(okBtn).toBeVisible();
    await okBtn.click();
    await expect(deniedModal).toBeHidden();
  });

  test('1.4 Cierre de sesión (Logout) restaura estado desautenticado', async ({ page }) => {
    await page.goto('/login');
    const cashierBtn = page.locator('button:has-text("Entrar como CASHIER")');
    await cashierBtn.click();
    await page.waitForURL('**/pos');

    // Volver a login y presionar Cerrar Sesión
    await page.goto('/login');
    const logoutBtn = page.locator('#logoutBtn');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Debe reflejar badge NO AUTENTICADO
    const badge = page.locator('#loginCurrentRoleBadge');
    await expect(badge).toContainText('NO AUTENTICADO');
  });
});
