import type { Locator, Page } from "@playwright/test";

export type PublishInput = {
  title: string;
  description?: string;
  brand?: string;
  categoryName: string;
  price: string;
  stock: string;
  imagePath: string;
};

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
    await this.page.waitForURL(/\/vendedor\/publicar/);
  }

  /**
   * Publica un producto desde /vendedor/publicar. Los campos se ubican por
   * su <label> real (Título, Marca, Categoría…) y el input de archivo por su
   * aria-label — no hizo falta agregar ningún data-testid nuevo.
   */
  async publishProduct(input: PublishInput) {
    await this.page.getByLabel("Título").fill(input.title);
    if (input.description) {
      await this.page.getByLabel("Descripción").fill(input.description);
    }
    if (input.brand) {
      await this.page.getByLabel("Marca").fill(input.brand);
    }

    await this.page.getByLabel("Categoría").click();
    await this.page.getByRole("option", { name: input.categoryName }).click();

    await this.page.getByLabel("Precio (S/)").fill(input.price);
    await this.page.getByLabel("Stock").fill(input.stock);

    // El input de archivos es sr-only (la UI usa un botón que lo dispara);
    // setInputFiles funciona igual sobre un input oculto.
    await this.page
      .getByLabel("Seleccionar imágenes del producto")
      .setInputFiles(input.imagePath);

    await this.page.getByRole("button", { name: "Publicar" }).click();
    // ProductFormView redirige al panel tras publicar con éxito.
    await this.page.waitForURL(/\/vendedor\/productos$/);
  }

  row(productId: string): Locator {
    return this.page.getByTestId(`seller-product-row-${productId}`);
  }

  // Un producto recién publicado no tiene un id conocido de antemano: se
  // ubica su fila por el título, que el test genera único por timestamp.
  rowByTitle(title: string): Locator {
    return this.page.getByRole("row").filter({ hasText: title });
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
