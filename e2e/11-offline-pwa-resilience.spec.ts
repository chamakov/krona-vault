import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 11: Resiliencia PWA & Modo Sótano Offline', () => {
  test('11.1 Detecta pérdida de conexión a internet y activa Banner de Modo Sótano sin bloquear la UI', async ({ page }) => {
    // 1. Ingresar autenticado a la Billetera PWA
    await page.goto('/login');
    await page.locator('button:has-text("Entrar como PLAYER")').click();
    await page.waitForURL((url) => url.pathname !== '/login');
    await page.goto('/wallet');

    // Comprobar que cargó en línea
    const offlineBanner = page.locator('#krona-offline-banner');
    await expect(offlineBanner).toBeHidden();

    // 2. Simular desconexión de red (evento offline)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // 3. El banner de contingencia debe activarse inmediatamente
    await expect(offlineBanner).toBeVisible();
    await expect(offlineBanner).toContainText('MODO SÓTANO ACTIVO');

    // 4. Los elementos esenciales de la cartera siguen interactivos (Pase QR, saldo)
    await expect(page.locator('#passAvailableBalance')).toBeVisible();

    // 5. Simular restauración de red (evento online)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // 6. El banner debe ocultarse automáticamente
    await expect(offlineBanner).toBeHidden();
  });
});
