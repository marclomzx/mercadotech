import { createContext } from "../context.js";
import { defineResource, type RegisteredResourceDefinition } from "../lib/define-resource.js";
import { listAllActiveProductSummaries } from "../shared/products.js";
import { jsonText } from "./_json.js";

/**
 * `mercadotech://products` — resumen de TODOS los productos activos (id,
 * título, precio, categoría — vía `toProductSummary`, la misma forma
 * compacta que usan `search_products` y `compare_products`).
 *
 * Cliente ANON: `products_select_active_or_own` concede SELECT de activos a
 * anon, igual que en el resto de la sesión 5.3.
 */
export const productsResource: RegisteredResourceDefinition = defineResource({
  name: "products",
  uri: "mercadotech://products",
  title: "Catálogo de productos activos",
  description:
    "Todos los productos activos del catálogo, en formato resumen (id, " +
    "título, marca, precio, categoría, rating). Para el detalle completo de " +
    "uno, lee mercadotech://products/{id} o usa la tool get_product.",
  read: async (uri) => {
    const { anon } = createContext();
    const productos = await listAllActiveProductSummaries(anon);
    return { contents: [jsonText(uri.href, { total: productos.length, productos })] };
  },
});
