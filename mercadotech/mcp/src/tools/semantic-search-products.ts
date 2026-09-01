import { z } from "zod";

import { VECTOR_SEARCH_DEFAULT_TOP_K, VECTOR_SEARCH_MAX_TOP_K } from "@/lib/constants/ai";
import * as vectorSearchService from "@/services/vector-search.service";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { emptyResult, jsonResult } from "../lib/tool-result.js";
import { toProductSummary } from "../shared/products.js";

export const semanticSearchProductsTool = defineTool({
  name: "semantic_search_products",
  description:
    "Busca productos por significado, no por palabras exactas: responde " +
    '"¿qué me sirve para…?" cuando el usuario describe una necesidad en vez ' +
    'de nombrar un producto ("audífonos para el gimnasio", "algo para ' +
    'teletrabajar"). Encuentra productos aunque no compartan ni una palabra ' +
    "con la consulta. Si el usuario ya dijo el nombre o la marca exacta, " +
    "search_products es más preciso y no consume el proveedor de IA.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        "La necesidad del usuario, en lenguaje natural y en español. " +
          "Cuanto más descriptiva, mejor.",
      ),
    topK: z
      .number()
      .int()
      .min(1)
      .max(VECTOR_SEARCH_MAX_TOP_K)
      .optional()
      .describe(
        `Cuántos productos devolver como máximo (por defecto ${VECTOR_SEARCH_DEFAULT_TOP_K}).`,
      ),
    similarityThreshold: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe(
        "Parecido mínimo (0 a 1) para considerar relevante un producto. " +
          "Por defecto usa el umbral calibrado del proyecto; súbelo para " +
          "resultados más estrictos.",
      ),
  }),
  // ⚠️ CLIENTE ADMIN (decisión 3). `knowledge_embeddings` tiene
  // `revoke all ... from anon` y solo
  // `grant select on public.knowledge_embeddings to authenticated`: la política
  // `knowledge_embeddings_select_authenticated` no alcanza a anon, así que con
  // el cliente público esta búsqueda no vería NI UNA ficha. El MCP es un
  // proceso sin sesión de usuario, así que la única vía es el cliente de
  // servicio. Solo se leen fichas de producto, cuyo contenido ya es público.
  //
  // Requiere HUGGINGFACEHUB_API_TOKEN: sin token, generateEmbedding lanza su
  // error accionable, safe.ts lo convierte en error de tool y el servidor
  // sigue en pie.
  handler: async (input) => {
    const { admin } = createContext();

    const results = await vectorSearchService.searchProducts(
      input.query,
      { topK: input.topK, similarityThreshold: input.similarityThreshold },
      admin, // cliente EXPLÍCITO (decisión 8).
    );

    if (results.length === 0) {
      return emptyResult(
        `productos que se parezcan a "${input.query}" por encima del umbral de similitud`,
      );
    }

    return jsonResult(
      `${results.length} producto(s) parecidos a "${input.query}", del más al menos relevante.`,
      {
        consulta: input.query,
        resultados: results.map((result) => ({
          ...toProductSummary(result.product),
          similitud: result.similarity,
        })),
      },
    );
  },
});
