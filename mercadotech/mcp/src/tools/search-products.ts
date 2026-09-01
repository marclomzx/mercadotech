import { z } from "zod";

import { PRODUCT_CONDITIONS } from "@/lib/constants/roles";
import * as productService from "@/services/product.service";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { emptyResult, jsonResult } from "../lib/tool-result.js";
import { toProductSummary } from "../shared/products.js";

export const searchProductsTool = defineTool({
  name: "search_products",
  description:
    "Busca productos en el catálogo por palabras exactas y filtros: responde " +
    '"¿qué productos hay que se llamen X, cuesten menos de Y o estén en la ' +
    'categoría Z?". Coincide literalmente contra el título y la marca, así ' +
    'que "laptop" encuentra las laptops pero "algo para editar video" no ' +
    "encuentra nada — para preguntas por significado usa " +
    "semantic_search_products. Solo devuelve productos activos (publicados).",
  inputSchema: z.object({
    search: z
      .string()
      .optional()
      .describe(
        "Texto a buscar en el título y la marca del producto (ej. 'laptop', " +
          "'Logitech'). Si se omite, devuelve el catálogo completo.",
      ),
    categorySlug: z
      .string()
      .optional()
      .describe(
        "Identificador de la categoría tal como aparece en la URL, en " +
          "minúsculas y con guiones (ej. 'laptops', 'componentes-de-pc'). " +
          "Usa list_categories para conocer los válidos.",
      ),
    condition: z
      .array(z.enum(PRODUCT_CONDITIONS))
      .optional()
      .describe(
        "Estado del producto. Se pueden pedir varios a la vez; si se omite, " +
          "no se filtra por estado.",
      ),
    minPrice: z
      .number()
      .nonnegative()
      .optional()
      .describe("Precio mínimo en soles peruanos (PEN)."),
    maxPrice: z
      .number()
      .nonnegative()
      .optional()
      .describe("Precio máximo en soles peruanos (PEN)."),
    sort: z
      .enum(["recientes", "precio_asc", "precio_desc"])
      .optional()
      .describe(
        "Orden del resultado: 'recientes' (por defecto), 'precio_asc' (del " +
          "más barato al más caro) o 'precio_desc' (al revés).",
      ),
    page: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Página de resultados, de 12 en 12. Empieza en 1."),
  }),
  // Cliente ANON: `products_select_active_or_own` concede SELECT de los
  // productos activos a anon; no hace falta —ni corresponde— más privilegio.
  handler: async (input) => {
    const { anon } = createContext();

    const { items, total } = await productService.listActiveProducts(
      {
        search: input.search,
        categorySlug: input.categorySlug,
        condition: input.condition,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        sort: input.sort,
        page: input.page,
      },
      anon, // cliente EXPLÍCITO (decisión 8): nunca el default del service.
    );

    if (items.length === 0) {
      return emptyResult("productos que coincidan con esos filtros");
    }

    return jsonResult(
      `${items.length} producto(s) en esta página, ${total} en total.`,
      { total, productos: items.map(toProductSummary) },
    );
  },
});
