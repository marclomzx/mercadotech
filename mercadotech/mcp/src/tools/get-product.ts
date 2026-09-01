import { z } from "zod";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { jsonResult } from "../lib/tool-result.js";
import { getProductDetail } from "../shared/products.js";

export const getProductTool = defineTool({
  name: "get_product",
  description:
    "Devuelve la ficha completa de UN producto del que ya conoces el id: " +
    'responde "¿qué trae exactamente este producto, cuánto cuesta, qué ' +
    'opinan y qué le han preguntado al vendedor?". Incluye descripción, ' +
    "precio, stock, condición, imágenes, promedio de reseñas y las preguntas " +
    "con sus respuestas. Si no sabes el id, encuéntralo antes con " +
    "search_products o semantic_search_products.",
  inputSchema: z.object({
    productId: z
      .string()
      .uuid()
      .describe("Identificador (UUID) del producto, tal como lo devuelven las tools de búsqueda."),
  }),
  // Cliente ANON: las cuatro tablas que toca el detalle son públicas
  // (`products_select_active_or_own`, `product_images_select_visible_product`,
  // `reviews_select_all`, `questions_select_all`).
  handler: async (input) => {
    const { anon } = createContext();
    const detail = await getProductDetail(input.productId, anon);
    return jsonResult(`Ficha de "${detail.titulo}".`, detail);
  },
});
