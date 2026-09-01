import { z } from "zod";

import { buildProductEmbeddingText, generateEmbedding } from "@/lib/ai/embeddings";
import { VECTOR_SEARCH_MAX_TOP_K } from "@/lib/constants/ai";
import * as categoryService from "@/services/category.service";
import * as productService from "@/services/product.service";
import * as vectorSearchService from "@/services/vector-search.service";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { notFound } from "../lib/errors.js";
import { emptyResult, jsonResult } from "../lib/tool-result.js";
import { toProductSummary } from "../shared/products.js";

const DEFAULT_RELATED = 4;

export const findRelatedProductsTool = defineTool({
  name: "find_related_products",
  description:
    'Encuentra productos parecidos a uno que ya tienes: responde "¿qué más ' +
    'como esto hay en la tienda?" — alternativas, sustitutos o versiones de ' +
    "otra gama. Parte del producto que le des y busca por significado, así " +
    "que trae cosas parecidas aunque sean de otra marca. No devuelve el " +
    "producto de partida.",
  inputSchema: z.object({
    productId: z
      .string()
      .uuid()
      .describe("Identificador (UUID) del producto a partir del cual buscar parecidos."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(VECTOR_SEARCH_MAX_TOP_K)
      .optional()
      .describe(`Cuántos productos parecidos devolver (por defecto ${DEFAULT_RELATED}).`),
  }),
  // ⚠️ CLIENTE ADMIN (decisión 3): `searchByEmbedding` consulta el RPC
  // `match_knowledge` sobre `knowledge_embeddings`, tabla con SELECT concedido
  // solo a `authenticated`. Con anon devolvería vacío siempre.
  //
  // Requiere HUGGINGFACEHUB_API_TOKEN (generateEmbedding). Sin token, el error
  // accionable de lib/ai/ vuelve como error de tool.
  handler: async (input) => {
    const { anon, admin } = createContext();

    // El producto de partida es público: se lee con anon aunque el resto de la
    // tool necesite admin. Cada consulta con el mínimo privilegio que le basta.
    const product = await productService.getProductById(input.productId, anon);
    if (!product) throw notFound(`el producto con id ${input.productId}`);

    // Se vectoriza el producto con la MISMA función que usó el indexado
    // (lib/ai/embeddings.buildProductEmbeddingText): así el vector de la
    // consulta y los de las fichas se construyen igual y son comparables.
    const categories = await categoryService.listCategories(anon);
    const categoryName =
      categories.find((category) => category.id === product.category_id)?.name ?? null;

    const embedding = await generateEmbedding(
      buildProductEmbeddingText(product, categoryName),
    );

    const limit = input.limit ?? DEFAULT_RELATED;
    const matches = await vectorSearchService.searchByEmbedding(
      embedding,
      // Se pide uno de más porque el propio producto será el primer resultado
      // (su ficha es idéntica al vector de la consulta) y se descarta abajo.
      { sourceType: "producto", topK: limit + 1 },
      admin, // cliente EXPLÍCITO (decisión 8).
    );

    const relatedIds = matches
      .filter((match) => match.sourceId !== product.id)
      .slice(0, limit);

    if (relatedIds.length === 0) {
      return emptyResult(`productos parecidos a "${product.title}"`);
    }

    // Se hidrata contra products (con anon) para dar precio y stock ACTUALES:
    // la metadata de la ficha es una copia del momento del indexado.
    const hydrated = await Promise.all(
      relatedIds.map(async (match) => {
        const related = await productService.getProductById(match.sourceId, anon);
        return related
          ? { ...toProductSummary(related), similitud: match.similarity }
          : null;
      }),
    );

    const relacionados = hydrated.filter((item) => item !== null);
    if (relacionados.length === 0) {
      return emptyResult(`productos parecidos a "${product.title}" que sigan activos`);
    }

    return jsonResult(`${relacionados.length} producto(s) parecidos a "${product.title}".`, {
      partida: { id: product.id, titulo: product.title },
      relacionados,
    });
  },
});
