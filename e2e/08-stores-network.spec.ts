import { test, expect } from '@playwright/test';

test.describe('KRONA VAULT™ — E2E Suite 8: KRONA Stores™ & Administración de Red Multi-Sede', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión como SUPER_ADMIN (@chamakov / CC-0002)
    await page.goto('/login');
    const demoPanel = page.locator('#demoRolesPanel');
    await expect(demoPanel).toBeVisible();

    const superAdminBtn = page.locator('button:has-text("Entrar como SUPER_ADMIN")');
    await superAdminBtn.click();
    await page.waitForURL((url) => url.pathname !== '/login');

    await page.goto('/stores');
  });

  test('8.1 Carga el portal de sedes con KPIs de red y selector de pestañas tácticas', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('KRONA Stores™');

    // Verificar las 3 pestañas principales
    const tabStores = page.locator('#tabBtnStores');
    const tabCategories = page.locator('#tabBtnCategories');
    const tabSources = page.locator('#tabBtnCreditSources');

    await expect(tabStores).toBeVisible();
    await expect(tabCategories).toBeVisible();
    await expect(tabSources).toBeVisible();

    // Directorio de sedes existentes
    const list = page.locator('#storesDirectoryList');
    await expect(list).toBeVisible();
    const rows = await list.locator('strong').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('8.2 Conmutación fluida entre pestañas de Sedes, Categorías FEFO y Orígenes de Crédito', async ({ page }) => {
    const tabCategories = page.locator('#tabBtnCategories');
    await tabCategories.click();

    // La sección de categorías debe desplegarse
    const catSection = page.locator('#categoriesStoreSection');
    await expect(catSection).toBeVisible();

    // Conmutar a Orígenes de Crédito
    const tabSources = page.locator('#tabBtnCreditSources');
    await tabSources.click();

    const sourceSection = page.locator('#creditSourcesStoreSection');
    await expect(sourceSection).toBeVisible();

    // Volver a registro de sedes
    const tabStores = page.locator('#tabBtnStores');
    await tabStores.click();
    await expect(page.locator('#createStoreSection')).toBeVisible();
  });

  test('8.3 Registra una nueva sucursal en el consorcio con prefijo de voucher térmico', async ({ page }) => {
    const storeCode = `SUC-TEST-${Date.now().toString().slice(-4)}`;
    const storeName = `Krona Plaza Satélite ${storeCode}`;

    await page.locator('#newStoreName').fill(storeName);
    await page.locator('#newStoreCode').fill(storeCode);
    await page.locator('#newStoreTaxId').fill('SAT260101XYZ');
    await page.locator('#newStoreVoucherPrefix').fill('SAT-');
    await page.locator('#newStoreAddress').fill('Periférico Manuel Ávila Camacho #100, Naucalpan');

    const submitBtn = page.locator('button:has-text("Registrar Sucursal en la Red Comercial")');
    await submitBtn.click();

    // Validar toast de confirmación
    const toast = page.locator('#krona-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/dada de alta/i);

    // Verificar presencia de la nueva sede en el directorio
    const list = page.locator('#storesDirectoryList');
    await expect(list).toContainText(storeName);
  });

  test('8.4 Agrega una nueva categoría FEFO al catálogo de la sede', async ({ page }) => {
    // Abrir pestaña de categorías
    await page.locator('#tabBtnCategories').click();
    const catSection = page.locator('#categoriesStoreSection');
    await expect(catSection).toBeVisible();

    // Diligenciar nueva categoría
    const catCode = `MINIS_${Date.now().toString().slice(-4)}`;
    await page.locator('#newCatCode').fill(catCode);
    await page.locator('#newCatName').fill('Miniaturas & Pinturas');
    await page.locator('#newCatDesc').fill('Warhammer 40K, Citadel Paints, Vallejo');

    // Añadir al catálogo local
    await page.locator('button:has-text("+ Añadir al Catálogo")').click();

    // Confirmar que aparezca en el contenedor de categorías
    const catItems = page.locator('#catItemsContainer');
    await expect(catItems).toContainText('Miniaturas & Pinturas');

    // Guardar catálogo persistente
    const saveBtn = page.locator('button:has-text("Guardar Catálogo de la Sede")');
    await saveBtn.click();

    const toast = page.locator('#krona-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(/actualizado/i);
  });
});
