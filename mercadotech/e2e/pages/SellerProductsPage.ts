import type { Locator, Page } from "@playwright/test";

export class SellerProductsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/vendedor/productos");
  }

  async gotoPublish() {
    // Puede haber dos links "Publicar producto" (el de arriba y el del
    // EmptyState), pero nunca los dos a la vez: uno u otro según haya
    // productos. .first() cubre ambos casos sin ambigüedad.
    await this.page.getByRole("link", { name: "Publicar producto" }).first().click();
  }

  row(productId: string): Locator {
    return this.page.getByTestId(`seller-product-row-${productId}`);
  }

  async toggleActive(productId: string) {
    await this.row(productId)
      .getByRole("button", { name: /Activar|Desactivar/ })
      .click();
  }

  async deleteProduct(productId: string) {
    await this.row(productId).getByRole("button", { name: "Eliminar" }).click();
  }

  editLink(productId: string): Locator {
    return this.row(productId).getByRole("link", { name: "Editar" });
  }
}
