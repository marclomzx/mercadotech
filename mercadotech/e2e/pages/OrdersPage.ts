import type { Locator, Page } from "@playwright/test";

export class OrdersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/pedidos");
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
