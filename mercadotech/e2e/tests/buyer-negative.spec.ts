import { BUYER1, BUYER2 } from "@/e2e/data/users";
import { expect, test } from "@/e2e/fixtures/test";
import { CartPage } from "@/e2e/pages/CartPage";
import { ProductPage } from "@/e2e/pages/ProductPage";

// Producto activo con stock 0 del seed REAL (supabase/seed.sql).
//
// OJO: la spec da por hecho "b…06", pero ese producto (Placa Madre ASUS
// Prime B550M-A) tiene stock 10. El que de verdad está en 0 es
// b0000000-…-0005 (Xiaomi Redmi Note 13 Pro 256GB) — misma discrepancia ya
// anotada en la bitácora de la sesión 3. Se ancla al dato real del seed.
const OUT_OF_STOCK_PRODUCT_ID = "b0000000-0000-0000-0000-000000000005";

test.describe("comprador — negativos", () => {
  test("producto sin stock: botón deshabilitado con motivo visible", async ({ page, loginAs }) => {
    await loginAs(BUYER1);

    const product = new ProductPage(page);
    await product.goto(OUT_OF_STOCK_PRODUCT_ID);

    await expect(product.addToCartButton()).toBeDisabled();
    // BuyBox.tsx: stock <= 0 (y activo, y no es tu propio producto) → "Sin stock".
    await expect(product.blockedReason()).toHaveText("Sin stock");
  });

  // BUYER2, no BUYER1: este archivo corre en paralelo con buyer-flow.spec.ts
  // (otro worker), que agrega y luego vacía el carrito de buyer1 durante SU
  // propia corrida — usar la misma cuenta acá sería una carrera real entre
  // specs, no una hipótesis.
  test("carrito vacío: no hay checkout posible", async ({ page, loginAs }) => {
    await loginAs(BUYER2);

    const cart = new CartPage(page);
    await cart.goto();

    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
    // CartView ni siquiera renderiza el botón sin items (no es solo
    // "disabled") — se verificó contra el código real, no se asumió.
    await expect(cart.checkoutButton()).toHaveCount(0);
  });

  test("anónimo en /carrito: redirige a /login con el redirectTo", async ({ page }) => {
    await page.goto("/carrito");
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcarrito/);
  });
});
