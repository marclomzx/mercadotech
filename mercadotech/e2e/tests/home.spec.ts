import { expect, test } from "@/e2e/fixtures/test";
import { CatalogPage } from "@/e2e/pages/CatalogPage";

// Smoke test de la Fase 6.4: prueba la TUBERÍA (config, webServer, alias,
// Page Object), no un flujo de negocio — eso llega en la Fase 6.5.
test.describe("home", () => {
  test("la home carga y muestra el grid de productos del catálogo", async ({ page }) => {
    const catalog = new CatalogPage(page);
    await catalog.goto();

    await expect(page).toHaveTitle(/MercadoTech/);
    await expect(catalog.productCards().first()).toBeVisible();

    // .count() no reintenta como las aserciones normales: en dev local,
    // React StrictMode duplica el efecto de carga (loading→false→true→false),
    // y un .count() de un solo disparo puede leerse justo en ese hueco.
    // expect.poll sí reintenta hasta que el número se estabilice.
    await expect.poll(() => catalog.productCount()).toBeGreaterThan(0);
  });
});
