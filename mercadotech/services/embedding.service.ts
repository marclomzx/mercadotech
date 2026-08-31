import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildProductEmbeddingText,
  buildSupportArticleEmbeddingText,
  generateEmbedding,
} from "@/lib/ai/embeddings";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

// Los dos valores que admite knowledge_embeddings.source_type (el check de la
// migración 20260831120100). Se tipan acá para que un typo no llegue a la BD.
export type SourceType = "producto" | "articulo_soporte";

// DIVERGENCIA DELIBERADA de la convención de services de la sesión 3: acá el
// cliente NO tiene default `createClient()`, es un parámetro OBLIGATORIO.
// Escribir fichas exige el cliente ADMIN (service_role), porque la tabla no
// concede INSERT/UPDATE a nadie más — ni siquiera a `authenticated`. Y este
// service no puede importar lib/supabase/admin.ts: eso lo arrastraría al
// bundle del navegador junto con la service role key. Por eso lo inyecta el
// caller, que siempre es server-only (Route Handler o script de scripts/).

/**
 * pgvector viaja por PostgREST como el texto "[0.1,0.2,…]", no como array
 * JSON — por eso types/database.ts tipa la columna `embedding` como `string`.
 * La conversión se hace una sola vez, acá.
 */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

type UpsertArgs = {
  sourceType: SourceType;
  sourceId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  supabase: Client;
};

async function upsertEmbedding({
  sourceType,
  sourceId,
  content,
  embedding,
  metadata,
  supabase,
}: UpsertArgs): Promise<void> {
  // onConflict sobre el unique (source_type, source_id, chunk_index) es lo
  // que hace idempotente el reindexado: editar un producto ACTUALIZA su ficha
  // en vez de acumular duplicados.
  const { error } = await supabase.from("knowledge_embeddings").upsert(
    {
      source_type: sourceType,
      source_id: sourceId,
      chunk_index: 0,
      content,
      embedding: toVectorLiteral(embedding),
      metadata: metadata as Database["public"]["Tables"]["knowledge_embeddings"]["Insert"]["metadata"],
    },
    { onConflict: "source_type,source_id,chunk_index" },
  );

  if (error) throw error;
}

/**
 * Ficha un producto: carga el producto con su categoría, arma el texto,
 * genera el embedding y lo guarda.
 *
 * Devuelve `false` si el producto ya no existe o dejó de estar activo — el
 * caller decide si eso significa "limpiar la ficha" (ver deleteEmbedding).
 */
export async function indexProduct(productId: string, supabase: Client): Promise<boolean> {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, description, brand, condition, price, is_active, categories(name)")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw error;
  // Producto borrado o pausado: no se ficha. Un producto inactivo no debe ser
  // recuperable por la búsqueda semántica.
  if (!data || !data.is_active) return false;

  const categoryName = data.categories?.name ?? null;
  const content = buildProductEmbeddingText(data, categoryName);
  const embedding = await generateEmbedding(content);

  await upsertEmbedding({
    sourceType: "producto",
    sourceId: data.id,
    content,
    embedding,
    metadata: {
      title: data.title,
      brand: data.brand,
      category: categoryName,
      // numeric(12,2) llega como string desde PostgREST: se convierte acá,
      // igual que en product.service (convención del proyecto).
      price: Number(data.price),
    },
    supabase,
  });

  return true;
}

/**
 * Ficha un artículo de la FAQ. Devuelve `false` si ya no existe o si dejó de
 * estar publicado.
 */
export async function indexSupportArticle(
  articleId: string,
  supabase: Client,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("support_articles")
    .select("id, title, content, category, is_published")
    .eq("id", articleId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.is_published) return false;

  const content = buildSupportArticleEmbeddingText(data);
  const embedding = await generateEmbedding(content);

  await upsertEmbedding({
    sourceType: "articulo_soporte",
    sourceId: data.id,
    content,
    embedding,
    metadata: {
      title: data.title,
      category: data.category,
    },
    supabase,
  });

  return true;
}

/**
 * Borra las fichas de una fuente. Lo usa el reindexado cuando la fuente ya no
 * existe o dejó de ser visible: como source_id no tiene FK (apunta a dos
 * tablas distintas), la base no limpia sola los huérfanos.
 */
export async function deleteEmbedding(
  sourceType: SourceType,
  sourceId: string,
  supabase: Client,
): Promise<void> {
  const { error } = await supabase
    .from("knowledge_embeddings")
    .delete()
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  if (error) throw error;
}

/**
 * Punto de entrada único para el reindexado: ficha la fuente si sigue siendo
 * visible, y si no, borra su ficha. Devuelve qué hizo, para que el caller lo
 * registre.
 */
export async function indexSource(
  sourceType: SourceType,
  sourceId: string,
  supabase: Client,
): Promise<"indexed" | "deleted"> {
  const indexed =
    sourceType === "producto"
      ? await indexProduct(sourceId, supabase)
      : await indexSupportArticle(sourceId, supabase);

  if (indexed) return "indexed";

  await deleteEmbedding(sourceType, sourceId, supabase);
  return "deleted";
}
