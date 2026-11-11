import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 4: Torneos, Calculadora Multi-TCG y Dispersión Zero-Sum', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como Organizador de Torneos / Juez L2 (@JudgeRob / CC-0010)
    await page.goto('/login');
    await page.fill('#loginIdentifier', 'CC-0010');
    await page.fill('#loginSecret', 'krona2026');
    await page.click('button:has-text("Iniciar Sesión")');
    await page.waitForURL('**/tournaments');
  });

  test('4.1 Interfaz inicial muestra tab Pokémon TOM activo y permite alternar a Calculadora Multi-TCG', async ({ page }) => {
    const tabPoke = page.locator('#trnTabPoke');
    const tabQuick = page.locator('#trnTabQuick');

    await expect(tabPoke).toHaveClass(/active/);
    await expect(page.locator('#trnViewPoke')).toBeVisible();

    // Cambiar a Calculadora Rápida Multi-TCG
    await tabQuick.click();
    await expect(tabQuick).toHaveClass(/active/);
    await expect(page.locator('#trnViewQuick')).toBeVisible();
    await expect(page.locator('#trnViewPoke')).not.toBeVisible();
  });

  test('4.2 Calculadora Rápida: Cálculos reactivos de Recaudado, Margen de Tienda y Pozo a Premiar', async ({ page }) => {
    await page.click('#trnTabQuick');

    // Configurar 8 jugadores, $150 de inscripción y $100 de contribución a pozo
    const playersInput = page.locator('#quickTotalPlayers');
    const entryInput = page.locator('#quickEntryMxn');
    const contribInput = page.locator('#quickContribMxn');

    await playersInput.fill('8');
    await entryInput.fill('150');
    await contribInput.fill('100');

    // Trigger update if oninput doesn't auto-fire on fill
    await playersInput.dispatchEvent('input');
    await entryInput.dispatchEvent('input');
    await contribInput.dispatchEvent('input');

    // 8 jugadores * $150 = $1,200.00 MXN recaudado
    const kpiCollected = page.locator('#quickKpiCollected');
    await expect(kpiCollected).toContainText('$1,200.00 MXN');

    // Margen tienda = 8 * ($150 - $100) = $400.00 MXN
    const kpiMargin = page.locator('#quickKpiMargin');
    await expect(kpiMargin).toContainText('$400.00 MXN');

    // Pozo efectivo = 8 * $100 = $800.00 MXN
    const kpiPool = page.locator('#quickKpiPool');
    await expect(kpiPool).toContainText('$800.00 MXN');

    // Verificar balance zero-sum matemático
    const zeroSum = page.locator('#quickZeroSumCheck');
    await expect(zeroSum).toContainText('Cuadrado');
  });

  test('4.3 Esquema Equal Split (Reparto Equitativo): Equilibra porcentajes entre posiciones del Top Cut', async ({ page }) => {
    await page.click('#trnTabQuick');

    await page.fill('#quickTotalPlayers', '8');
    await page.fill('#quickContribMxn', '100');
    await page.locator('#quickTotalPlayers').dispatchEvent('input');

    // Seleccionar esquema de reparto equitativo
    const schemeSelect = page.locator('#quickPayoutScheme');
    await schemeSelect.selectOption('EQUAL_SPLIT');

    // La tabla de pagos debe reflejar badges de Split Equitativo (25.0%)
    const tableBody = page.locator('#quickPayoutsTableBody');
    await expect(tableBody).toBeVisible();
    await expect(tableBody).toContainText('Split Equitativo (25.0%)');

    // Los premios de cada posición del Top 4 deben ser idénticos ($200.00 cada uno)
    const rows = tableBody.locator('tr');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('$200.00 MXN');
    await expect(rows.nth(3)).toContainText('$200.00 MXN');
  });

  test('4.4 Ejecuta Dispersión Multi-Juego en Lote con Partida Doble', async ({ page }) => {
    await page.click('#trnTabQuick');

    // Nombrar el torneo
    await page.fill('#quickTrnName', 'Torneo Modern FNM E2E');
    await page.fill('#quickTotalPlayers', '4');
    await page.fill('#quickEntryMxn', '100');
    await page.fill('#quickContribMxn', '100');
    await page.locator('#quickTotalPlayers').dispatchEvent('input');

    // Seleccionar Top 2
    await page.selectOption('#quickTopCutSize', '2');

    // Asignar ganadores por nombre
    const winner1Name = page.locator('#quickWinnerName_1');
    await expect(winner1Name).toBeVisible();
    await winner1Name.fill('Campeón E2E 1');

    const winner2Name = page.locator('#quickWinnerName_2');
    await expect(winner2Name).toBeVisible();
    await winner2Name.fill('Finalista E2E 2');

    // Liquidar torneo
    const disperseBtn = page.locator('button:has-text("Liquidar Torneo Rápido")');
    await disperseBtn.click();

    // Debe mostrar toast de liquidación exitosa o modal de impresión de acta
    const modalTitle = page.locator('.krona-modal-backdrop');
    await expect(page.locator('body')).toContainText(/liquidado con éxito|Acta Térmica/i, { timeout: 8000 });
  });
});
