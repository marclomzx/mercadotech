import type { Locator, Page } from "@playwright/test";

import { clickMenuLinkAndWaitForUrl } from "@/e2e/pages/interactions";

export class CatalogPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/");
  }

  productCards(): Locator {
    return this.page.getByTestId("product-card");
  }

  async productCount(): Promise<number> {
    return this.productCards().count();
  }

  async productTitles(): Promise<string[]> {
    return this.page.getByTestId("product-card-title").allTextContents();
  }

  async openProduct(title: string) {
    await this.productCards().filter({ hasText: title }).first().click();
  }

  // Sin selector propio para las categorías (decisión: rol accesible basta —
  // el trigger es un botón "Categorías" y cada opción es un menuitem con el
  // nombre de la categoría).
  async filterByCategory(categoryName: string) {
    await clickMenuLinkAndWaitForUrl(
      this.page,
      async () => {
        await this.page.getByRole("button", { name: "Categorías" }).click();
        await this.page.getByRole("menuitem", { name: categoryName }).click();
      },
      /\/categoria\//,
    );
  }

  userMenu(): Locator {
    return this.page.getByTestId("user-menu");
  }

  anonymousLoginLink(): Locator {
    return this.page.getByRole("link", { name: "Ingresar" });
  }

  // El aria-label del link del carrito ya trae el número ("Carrito, N
  // productos"), incluso en 0 — no hace falta un testid extra en el badge.
  async cartItemCount(): Promise<number> {
    const label = await this.page.getByRole("link", { name: /^Carrito,/ }).getAttribute("aria-label");
    const match = label?.match(/Carrito, (\d+)/);
    return match ? Number(match[1]) : 0;
  }
}
