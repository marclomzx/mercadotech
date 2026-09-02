import { expect, type Locator, type Page } from "@playwright/test";

import { ORDER_STATUS_LABELS } from "@/lib/constants/orders";
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

  // Región donde dnd-kit escribe sus anuncios para lectores de pantalla. Es
  // la única fuente que dice, en vivo, sobre qué columna está la tarjeta
  // tomada — justo lo que hay que saber ANTES de soltarla.
  private liveRegion(): Locator {
    return this.page.locator('[id^="DndLiveRegion"]');
  }

  // Camino de TECLADO del KeyboardSensor de dnd-kit (decisión 9 de la spec —
  // el drag con mouse es frágil bajo Playwright). La tarjeta ES el asa (el
  // listener vive en su propio nodo raíz): foco → Space toma la tarjeta →
  // flecha salta a la columna vecina → Space la suelta ahí.
  async moveOrderForward(orderId: string, toStatus: OrderStatus) {
    await this.moveWithKeyboard(orderId, "ArrowRight", toStatus);
  }

  // Mismo camino, hacia atrás. Lo usa el negativo: la UI debe rechazar el
  // retroceso (la regla vive en useSellerOrders.canMove).
  async moveOrderBackward(orderId: string, toStatus: OrderStatus) {
    await this.moveWithKeyboard(orderId, "ArrowLeft", toStatus);
  }

  private async moveWithKeyboard(
    orderId: string,
    arrow: "ArrowLeft" | "ArrowRight",
    toStatus: OrderStatus,
  ) {
    const card = this.card(orderId);
    await card.waitFor();
    await card.focus();

    await this.page.keyboard.press("Space");
    // dnd-kit marca aria-pressed mientras arrastra: se espera esa señal en
    // vez de asumir que el Space ya levantó la tarjeta.
    await expect(card).toHaveAttribute("aria-pressed", "true");

    await this.page.keyboard.press(arrow);
    // Y se espera el anuncio de la columna destino antes de soltar. Sin esta
    // espera, en una máquina lenta (CI) el Space llega antes de que la flecha
    // se procese y la tarjeta se suelta en SU PROPIA columna: el movimiento
    // nunca ocurre y el test falla por un motivo que no es el que prueba.
    await expect(this.liveRegion()).toContainText(
      `sobre la columna ${ORDER_STATUS_LABELS[toStatus]}`,
    );

    await this.page.keyboard.press("Space");
    // El drag terminó cuando dnd-kit suelta el aria-pressed.
    await expect(card).not.toHaveAttribute("aria-pressed", "true");
  }
}
