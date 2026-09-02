import type { Locator, Page } from "@playwright/test";

export class CartPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/carrito");
  }

  subtotal(): Locator {
    return this.page.getByTestId("cart-subtotal");
  }

  checkoutButton(): Locator {
    return this.page.getByTestId("cart-checkout");
  }

  async checkout() {
    // Tras el RPC exitoso, CartView redirige a /pedidos/[id].
    await this.checkoutButton().click();
    await this.page.waitForURL(/\/pedidos\/.+/);
  }

  itemQuantity(index = 0): Locator {
    return this.page.getByTestId("cart-item-quantity").nth(index);
  }

  async setItemQuantity(quantity: number, index = 0) {
    await this.itemQuantity(index).click();
    await this.page.getByRole("option", { name: String(quantity) }).click();
  }

  // Sin testid propio: el botón ya tiene un aria-label estable y único.
  removeItem(index = 0): Locator {
    return this.page.getByRole("button", { name: "Quitar del carrito" }).nth(index);
  }
}
