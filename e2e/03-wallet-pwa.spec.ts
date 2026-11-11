import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 3: KRONA Pass™ PWA y Credenciales Dinámicas', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como Jugador (@AlexMTG / CC-8492)
    await page.goto('/login');
    await page.fill('#loginIdentifier', 'CC-8492');
    await page.fill('#loginSecret', 'krona2026');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL('**/wallet');
  });

  test('3.1 Muestra identidad de jugador, saldo disponible y distintivo ACTIVE', async ({ page }) => {
    // Validar encabezado de identidad del pase
    const playerName = page.locator('#passPlayerName');
    await expect(playerName).toBeVisible();
    await expect(playerName).toContainText('Alejandro Gómez');

    const playerMeta = page.locator('#passPlayerMeta');
    await expect(playerMeta).toContainText('CC-8492');
    await expect(playerMeta).toContainText('@AlexMTG');

    const statusBadge = page.locator('#passStatusBadge');
    await expect(statusBadge).toHaveText('ACTIVE');

    // Validar saldo disponible en moneda local
    const availableBalance = page.locator('#passAvailableBalance');
    await expect(availableBalance).toBeVisible();
    await expect(availableBalance).toContainText('$');
    await expect(availableBalance).toContainText('MXN');
  });

  test('3.2 Renderiza Dynamic Pulse QR™ SVG y rota contador de vigencia TOTP', async ({ page }) => {
    // Verificar que el tab por defecto es QR
    const tabQr = page.locator('#tabPulseQr');
    await expect(tabQr).toHaveClass(/active/);

    // Verificar contenedor SVG del QR dinámico
    const qrSvg = page.locator('#qrSvgContainer svg');
    await expect(qrSvg).toBeVisible({ timeout: 6000 });

    // Verificar token preview criptográfico
    const tokenPreview = page.locator('#qrTokenPreview');
    await expect(tokenPreview).toBeVisible();
    const tokenText = await tokenPreview.innerText();
    expect(tokenText.length).toBeGreaterThan(10);

    // Verificar timer regresivo de expiración
    const timerSec = page.locator('#passTimerSec');
    await expect(timerSec).toBeVisible();
    await expect(timerSec).toContainText('s');
  });

  test('3.3 Modo Búnker Offline: Alterna a PIN TOTP de 6 dígitos con máscara visual', async ({ page }) => {
    // Cambiar a la pestaña Modo Búnker PIN
    const tabPin = page.locator('#tabBunkerPin');
    await tabPin.click();
    await expect(tabPin).toHaveClass(/active/);

    // El contenedor del PIN debe proyectarse
    const viewPin = page.locator('#viewBunkerPin');
    await expect(viewPin).toBeVisible();

    // Validar el PIN visual formateado (ej. 123 • 456)
    const pinDisplay = page.locator('#bunkerPinDisplay');
    await expect(pinDisplay).toBeVisible();
    await expect(pinDisplay).toContainText('•');

    // La vista QR debe ocultarse
    const viewQr = page.locator('#viewPulseQr');
    await expect(viewQr).not.toBeVisible();
  });

  test('3.4 Carga y desglosa lotes Smart-Burn Tranches™ con prioridad FEFO', async ({ page }) => {
    const lotsContainer = page.locator('#passLotsContainer');
    await expect(lotsContainer).toBeVisible();

    // Debe mostrar al menos un lote activo del jugador con sede y saldo
    const lots = lotsContainer.locator('div');
    await expect(lots.first()).toBeVisible({ timeout: 6000 });
    await expect(lotsContainer).toContainText('Prioridad FEFO');
    await expect(lotsContainer).toContainText('$');
  });
});
