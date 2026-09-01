import { z } from "zod";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { jsonResult } from "../lib/tool-result.js";
import { listCategoriesWithCount } from "../shared/stats.js";

export const listCategoriesTool = defineTool({
  name: "list_categories",
  description:
    'Lista las categorías del catálogo con cuántos productos activos tiene cada una: responde "¿qué tipos de producto vende MercadoTech y dónde hay más ' +
    'stock?". Es la tool que da los `categorySlug` válidos para filtrar en ' +
    "search_products. No recibe parámetros.",
  inputSchema: z.object({}),
  // Cliente ANON: `categories_select_all` y `products_select_active_or_own`.
  handler: async () => {
    const { anon } = createContext();
    const categorias = await listCategoriesWithCount(anon);
    return jsonResult(`${categorias.length} categorías.`, { categorias });
  },
});
