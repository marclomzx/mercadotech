import { createContext } from "../context.js";
import { defineResource, type RegisteredResourceDefinition } from "../lib/define-resource.js";
import { listCategoriesWithCount } from "../shared/stats.js";
import { jsonText } from "./_json.js";

/**
 * `mercadotech://categories` — MISMA derivación que la tool `list_categories`
 * (`listCategoriesWithCount` en `shared/stats.ts`). Cliente ANON.
 */
export const categoriesResource: RegisteredResourceDefinition = defineResource({
  name: "categories",
  uri: "mercadotech://categories",
  title: "Categorías del catálogo",
  description:
    "Las categorías del catálogo con cuántos productos activos tiene cada " +
    "una. Da los categorySlug válidos para filtrar en search_products.",
  read: async (uri) => {
    const { anon } = createContext();
    const categorias = await listCategoriesWithCount(anon);
    return { contents: [jsonText(uri.href, { categorias })] };
  },
});
