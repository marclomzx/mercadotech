import path from "node:path";

import { BUYER1, SELLER1 } from "@/e2e/data/users";
import { expect, test } from "@/e2e/fixtures/test";
import { CatalogPage } from "@/e2e/pages/CatalogPage";
import { LoginPage } from "@/e2e/pages/LoginPage";
import { OrdersPage } from "@/e2e/pages/OrdersPage";
import { SellerKanbanPage } from "@/e2e/pages/SellerKanbanPage";
import { SellerProductsPage } from "@/e2e/pages/SellerProductsPage";

// Datos LEÍDOS de supabase/seed.sql, no asumidos:
//   c…02 es el ÚNICO pedido 'pagado' del seed. Es multi-vendedor (ítem
//   f…02 de seller1 + f…03 de seller2) y su comprador es buyer1 (a…01).
// Por eso seller1 puede moverlo y buyer1 es quien debe verlo 'enviado'.
//
// Limitación conocida y documentada (bitácora S3, deuda #3): al ser
// multi-vendedor, mover la tarjeta cambia orders.status del pedido COMPLETO,
// no solo de los ítems de seller1. El test afirma ese comportamiento real.
const PAID_ORDER_ID = "c0000000-0000-0000-0000-000000000002";

const IMAGE_PATH = path.join(__dirname, "..", "data", "product-image.jpg");

test.describe("flujo vendedor", () => {
  test("publica un producto y avanza el kanban por teclado", async ({
    page,
    browser,
    loginAs,
  }) => {
    const sellerProducts = new SellerProductsPage(page);
    const kanban = new SellerKanbanPage(page);
    const catalog = new CatalogPage(page);

    // Título único por corrida: los productos publicados quedan en la BD
    // local hasta el próximo `supabase db reset`, así que dos corridas
    // seguidas no deben pisarse.
    const productTitle = `Laptop de prueba E2E ${Date.now()}`;

    await test.step("1. login seller1 → panel del vendedor", async () => {
      await loginAs(SELLER1);
      await sellerProducts.goto();
      await expect(page.getByRole("heading", { name: "Mis productos" })).toBeVisible();
    });

    await test.step("2. publica un producto con imagen", async () => {
      await sellerProducts.gotoPublish();
      await sellerProducts.publishProduct({
        title: productTitle,
        description: "Producto creado por el E2E del flujo vendedor.",
        brand: "MarcaE2E",
        categoryName: "Laptops",
        price: "1234.00",
        stock: "3",
        imagePath: IMAGE_PATH,
      });
    });

    await test.step("3. aparece en su tabla Y en el catálogo público", async () => {
      await expect(sellerProducts.rowByTitle(productTitle)).toBeVisible();

      await catalog.goto();
      // Recién publicado ⇒ el catálogo ordena por created_at desc, así que
      // entra en la primera página sin necesidad de paginar.
      await expect.poll(() => catalog.productCount()).toBeGreaterThan(0);
      await expect(catalog.productCards().filter({ hasText: productTitle })).toBeVisible();
    });

    await test.step("4. kanban: mueve el pedido 'pagado' a 'enviado' POR TECLADO", async () => {
      await kanban.goto();
      // Punto de partida verificado contra el seed, no contra la posición.
      await expect(kanban.isCardInColumn(PAID_ORDER_ID, "pagado")).toBeVisible();

      // focus en el asa → Space → ArrowRight → Space (decisión 9).
      await kanban.moveOrderForward(PAID_ORDER_ID);

      await expect(kanban.isCardInColumn(PAID_ORDER_ID, "enviado")).toBeVisible();
      await expect(kanban.isCardInColumn(PAID_ORDER_ID, "pagado")).toHaveCount(0);
    });

    await test.step("5. la tarjeta PERSISTE tras recargar (no solo en el DOM)", async () => {
      // useSellerOrders mueve la tarjeta de forma optimista: sin este reload
      // la aserción anterior pasaría igual si el PATCH hubiera fallado. El
      // reload re-consulta Postgres a través de la RLS.
      await page.reload();
      await expect(kanban.isCardInColumn(PAID_ORDER_ID, "enviado")).toBeVisible();
    });

    await test.step("6. el comprador de ESE pedido ve 'enviado' en su detalle", async () => {
      // Contexto aparte: sesión limpia de buyer1, sin arrastrar la cookie
      // del vendedor ni depender de un logout intermedio.
      const buyerContext = await browser.newContext();
      const buyerPage = await buyerContext.newPage();
      try {
        await new LoginPage(buyerPage).login(BUYER1);
        const orders = new OrdersPage(buyerPage);
        await orders.gotoOrder(PAID_ORDER_ID);
        await expect(orders.status()).toHaveText("Enviado");
      } finally {
        await buyerContext.close();
      }
    });
  });
});
