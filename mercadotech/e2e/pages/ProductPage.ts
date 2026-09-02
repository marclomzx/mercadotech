import type { Locator, Page } from "@playwright/test";

export class ProductPage {
  constructor(private page: Page) {}

  async goto(productId: string) {
    await this.page.goto(`/producto/${productId}`);
  }

  title(): Locator {
    return this.page.getByTestId("product-title");
  }

  price(): Locator {
    return this.page.getByTestId("product-price");
  }

  addToCartButton(): Locator {
    return this.page.getByTestId("buybox-add-to-cart");
  }

  blockedReason(): Locator {
    return this.page.getByTestId("buybox-blocked-reason");
  }

  async setQuantity(quantity: number) {
    await this.page.getByTestId("buybox-quantity").click();
    await this.page.getByRole("option", { name: String(quantity) }).click();
  }

  async addToCart(quantity = 1) {
    if (quantity > 1) await this.setQuantity(quantity);
    await this.addToCartButton().click();
  }
}
