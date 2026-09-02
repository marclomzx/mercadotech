import { BUYER1, SELLER2 } from "@/e2e/data/users";
import { expect, test } from "@/e2e/fixtures/test";
import { SellerKanbanPage } from "@/e2e/pages/SellerKanbanPage";

// c…03 es el único pedido que YA nace 'enviado' en el seed, y sus dos ítems
// son de seller2 (a…05) — verificado en supabase/seed.sql. Se usa este
// vendedor a propósito: así el negativo no depende de que seller-flow.spec
// haya movido antes ningún pedido (los archivos corren en paralelo).
const SHIPPED_ORDER_ID = "c0000000-0000-0000-0000-000000000003";

test.describe("vendedor — negativos", () => {
  test("un comprador no entra al panel del vendedor", async ({ page, loginAs }) => {
    await loginAs(BUYER1);
    await page.goto("/vendedor/productos");

    // SellerGuard: hay sesión pero el rol no alcanza → toast + replace("/").
    await expect(page.getByText("Necesitas una cuenta de vendedor")).toBeVisible();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Mis productos" })).toHaveCount(0);
  });

  test("retroceder 'enviado' → 'pagado' se rechaza y la tarjeta no se mueve", async ({
    page,
    loginAs,
  }) => {
    await loginAs(SELLER2);

    const kanban = new SellerKanbanPage(page);
    await kanban.goto();
    await expect(kanban.isCardInColumn(SHIPPED_ORDER_ID, "enviado")).toBeVisible();

    // Mismo camino de teclado, pero hacia la columna anterior.
    await kanban.moveOrderBackward(SHIPPED_ORDER_ID, "pagado");

    // La regla vive en useSellerOrders.canMove y rechaza ANTES de llamar al
    // service: el toast lleva el mensaje literal del hook.
    await expect(
      page.getByText(
        'No puedes mover un pedido de "enviado" a "pagado": solo se avanza un paso a la vez.',
      ),
    ).toBeVisible();

    // Se rechaza antes de la actualización optimista, así que la tarjeta ni
    // siquiera parpadea a la columna anterior.
    await expect(kanban.isCardInColumn(SHIPPED_ORDER_ID, "enviado")).toBeVisible();
    await expect(kanban.isCardInColumn(SHIPPED_ORDER_ID, "pagado")).toHaveCount(0);
  });
});
