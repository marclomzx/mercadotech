import type { Locator, Page } from "@playwright/test";

import type { OrderStatus } from "@/lib/constants/roles";

export class SellerKanbanPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/vendedor/pedidos");
  }

  card(orderId: string): Locator {
    return this.page.getByTestId(`kanban-card-${orderId}`);
  }

  column(status: OrderStatus): Locator {
    return this.page.getByTestId(`kanban-column-${status}`);
  }

  isCardInColumn(orderId: string, status: OrderStatus): Locator {
    return this.column(status).getByTestId(`kanban-card-${orderId}`);
  }

  // Camino de TECLADO del KeyboardSensor de dnd-kit (decisión 9 de la spec —
  // el drag con mouse es frágil bajo Playwright). La tarjeta ES el asa (el
  // listener vive en su propio nodo raíz): foco → Space toma la tarjeta →
  // flecha salta a la columna vecina → Space la suelta ahí.
  async moveOrderForward(orderId: string) {
    await this.card(orderId).focus();
    await this.page.keyboard.press("Space");
    await this.page.keyboard.press("ArrowRight");
    await this.page.keyboard.press("Space");
  }
}
