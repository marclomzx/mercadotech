import type { SupabaseClient } from "@supabase/supabase-js";

import {
  VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
  VECTOR_SEARCH_DEFAULT_TOP_K,
  VECTOR_SEARCH_MAX_TOP_K,
} from "@/lib/constants/ai";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { createClient } from "@/lib/supabase/client";
import { mapProductRow, PRODUCT_SELECT, type ProductQueryRow } from "@/services/product.service";
import type { Database } from "@/types/database";
import type { Product } from "@/types/product";
import type { SourceType } from "@/services/embedding.service";

type Client = SupabaseClient<Database>;

export type VectorMatch = {
  sourceType: SourceType;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type SemanticProductResult = {
  product: Product;
  similarity: number;
};

type SearchByEmbeddingOptions = {
  sourceType?: SourceType | null;
  topK?: number;
  similarityThreshold?: number;
};

// pgvector viaja por PostgREST como el texto "[0.1,0.2,…]" — misma
// convención que services/embedding.service.ts usa para escribir.
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Llama al RPC match_knowledge con un embedding ya calculado. No genera el
 * embedding ni sabe de dónde salió: eso es responsabilidad de searchProducts
 * (o de quien más la use en 4.6/4.7 para el modo soporte).
 */
export async function searchByEmbedding(
  embedding: number[],
  opts: SearchByEmbeddingOptions = {},
  supabase: Client = createClient(),
): Promise<VectorMatch[]> {
  const topK = Math.min(opts.topK ?? VECTOR_SEARCH_DEFAULT_TOP_K, VECTOR_SEARCH_MAX_TOP_K);

  const { data, error } = await supabase.rpc("match_knowledge", {
    query_embedding: toVectorLiteral(embedding),
    // El tipo generado del RPC no admite `null` explícito (aunque el default
    // SQL de p_source_type sí lo es) — `undefined` deja que Postgres aplique
    // su propio default, con el mismo efecto de "buscar en ambas fuentes".
    p_source_type: opts.sourceType ?? undefined,
    match_count: topK,
    similarity_threshold: opts.similarityThreshold ?? VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
  });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    sourceType: row.source_type as SourceType,
    sourceId: row.source_id,
    content: row.content,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    similarity: row.similarity,
  }));
}

type SearchByQueryOptions = {
  sourceType?: SourceType | null;
  topK?: number;
  similarityThreshold?: number;
};

/**
 * Búsqueda semántica cruda: texto → fichas más parecidas, sin hidratar.
 *
 * Es el punto de entrada que usa chat.service (Fase 4.6) para los dos modos,
 * cambiando solo `sourceType`. Vive acá y no en chat.service para que ese
 * servicio no tenga que conocer `generateEmbedding` — es decir, para que no
 * conozca al proveedor de IA. Con `sourceType` null busca en ambas fuentes.
 */
export async function searchByQuery(
  query: string,
  opts: SearchByQueryOptions = {},
  supabase: Client = createClient(),
): Promise<VectorMatch[]> {
  const embedding = await generateEmbedding(query);
  return searchByEmbedding(embedding, opts, supabase);
}

type SearchProductsOptions = {
  topK?: number;
  similarityThreshold?: number;
};

/**
 * Búsqueda semántica de productos: genera el embedding de la consulta,
 * busca en knowledge_embeddings (solo fichas de producto) e hidrata cada
 * resultado contra `products` para traer precio/stock/imagen ACTUALES —
 * la ficha guarda una copia de esos datos al momento de indexar, que puede
 * estar vieja.
 *
 * Descarta huérfanos: un source_id cuya ficha sigue en la tabla pero cuyo
 * producto ya no existe o dejó de estar activo (decisión 6 — source_id no
 * tiene foreign key, así que estas fichas se limpian de forma best-effort
 * en el reindexado, no de forma inmediata).
 */
export async function searchProducts(
  query: string,
  opts: SearchProductsOptions = {},
  supabase: Client = createClient(),
): Promise<SemanticProductResult[]> {
  const matches = await searchByQuery(
    query,
    { sourceType: "producto", topK: opts.topK, similarityThreshold: opts.similarityThreshold },
    supabase,
  );

  if (matches.length === 0) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in(
      "id",
      matches.map((match) => match.sourceId),
    )
    // Mismo filtro explícito que product.service: un producto pausado no
    // debe aparecer en resultados aunque su ficha todavía no se haya limpiado.
    .eq("is_active", true);

  if (error) throw error;

  const productsById = new Map(
    (data as ProductQueryRow[]).map((row) => [row.id, mapProductRow(row, supabase)]),
  );

  // El orden de match_knowledge (por similitud) es el que importa, no el que
  // devuelva la query de products — se reconstruye acá.
  return matches
    .map((match) => {
      const product = productsById.get(match.sourceId);
      return product ? { product, similarity: match.similarity } : null;
    })
    .filter((result): result is SemanticProductResult => result !== null);
}
