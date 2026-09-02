import { formatPrice } from "@/lib/utils";

import { BUYER1 } from "@/e2e/data/users";
import { expect, test } from "@/e2e/fixtures/test";
import { CartPage } from "@/e2e/pages/CartPage";
import { CatalogPage } from "@/e2e/pages/CatalogPage";
import { OrdersPage } from "@/e2e/pages/OrdersPage";
import { ProductPage } from "@/e2e/pages/ProductPage";

// Producto real del seed (supabase/seed.sql, categoría Laptops, con stock):
// b0000000-…-0002, "Laptop HP Pavilion 15…", S/ 2,399.00, stock 5. Se ancla
// por título y precio reales — nunca un número inventado a mano.
const PRODUCT_TITLE = 'Laptop HP Pavilion 15 Intel Core i5 8GB 512GB SSD';
const UNIT_PRICE = 2399;
const QUANTITY = 2;

const ORDER_ID_IN_URL = /\/pedidos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

test.describe("flujo comprador", () => {
  // Decisión 8 de la spec: cero aserciones de IA. Este flujo no visita
  // /asistente ni la pestaña "Resultados con IA" de /buscar.
  test("login, filtra, compra y revisa el pedido recién creado", async ({ page, loginAs }) => {
    const catalog = new CatalogPage(page);
    const product = new ProductPage(page);
    const cart = new CartPage(page);
    const orders = new OrdersPage(page);

    await test.step("1. login buyer1 → catálogo con su menú de usuario", async () => {
      await loginAs(BUYER1);
      await expect(page).toHaveURL("/");
      await expect(catalog.userMenu()).toBeVisible();
    });

    await test.step('2. filtra "Laptops" → el grid solo muestra laptops', async () => {
      await catalog.filterByCategory("Laptops");
      await expect(page).toHaveURL(/\/categoria\/laptops/);

      await expect.poll(() => catalog.productCount()).toBeGreaterThan(0);
      const titles = await catalog.productTitles();
      for (const title of titles) {
        expect(title).toContain("Laptop");
      }
    });

    await test.step("3. abre un producto CON stock → título y precio", async () => {
      await catalog.openProduct(PRODUCT_TITLE);
      await expect(product.title()).toHaveText(PRODUCT_TITLE);
      // formatPrice real (S/ y decimales) — nunca un string reformateado a mano.
      await expect(product.price()).toHaveText(formatPrice(UNIT_PRICE));
    });

    await test.step(`4. agrega ${QUANTITY} unidades → contador del navbar = ${QUANTITY}`, async () => {
      await product.addToCart(QUANTITY);
      await expect.poll(() => catalog.cartItemCount()).toBe(QUANTITY);
    });

    await test.step('5. carrito → subtotal correcto → "Finalizar compra"', async () => {
      await cart.goto();
      await expect(cart.subtotal()).toHaveText(formatPrice(UNIT_PRICE * QUANTITY));
      await expect(cart.checkoutButton()).toBeEnabled();
    });

    let orderId = "";
    await test.step("6. checkout → redirige a /pedidos/[id], pendiente, ítems snapshot", async () => {
      await cart.checkout();

      const match = page.url().match(ORDER_ID_IN_URL);
      expect(match, `la URL tras el checkout debería ser /pedidos/<uuid>, fue ${page.url()}`).not.toBeNull();
      orderId = match![1];

      await expect(orders.status()).toHaveText("Pendiente");
      // Snapshot del ítem: título y cantidad tal como quedaron en order_items,
      // no lo que diga el producto actual (podría cambiar después).
      await expect(page.getByRole("cell", { name: PRODUCT_TITLE })).toBeVisible();
      await expect(page.getByRole("cell", { name: String(QUANTITY), exact: true })).toBeVisible();
    });

    await test.step('7. "Mis pedidos" lista ESE pedido (por id, no "el primero")', async () => {
      await orders.gotoFromUserMenu();
      await expect(orders.orderCard(orderId)).toBeVisible();
    });

    await test.step("8. logout → navbar anónimo", async () => {
      await page.getByTestId("user-menu").click();
      await page.getByTestId("user-menu-logout").click();
      await expect(catalog.anonymousLoginLink()).toBeVisible();
    });
  });
});
