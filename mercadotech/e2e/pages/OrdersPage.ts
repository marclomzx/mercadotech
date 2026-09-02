import type { Locator, Page } from "@playwright/test";

import { clickMenuLinkAndWaitForUrl } from "@/e2e/pages/interactions";

export class OrdersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/pedidos");
  }

  // Vía el menú de usuario ("Mis pedidos"), no goto(): es la navegación que
  // un comprador real usa desde cualquier pantalla del sitio.
  async gotoFromUserMenu() {
    await clickMenuLinkAndWaitForUrl(
      this.page,
      async () => {
        await this.page.getByTestId("user-menu").click();
        await this.page.getByTestId("user-menu-orders").click();
      },
      /\/pedidos$/,
    );
  }

  async gotoOrder(orderId: string) {
    await this.page.goto(`/pedidos/${orderId}`);
  }

  orderCard(orderId: string): Locator {
    return this.page.getByTestId(`order-card-${orderId}`);
  }

  status(): Locator {
    return this.page.getByTestId("order-status");
  }

  // Sin testid propio: los botones ya tienen texto único en la pantalla de
  // detalle ("Cancelar pedido" abre el diálogo, "Sí, cancelar" confirma).
  async cancelOrder() {
    await this.page.getByRole("button", { name: "Cancelar pedido" }).click();
    await this.page.getByRole("button", { name: "Sí, cancelar" }).click();
  }
}
