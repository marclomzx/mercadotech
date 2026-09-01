import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type FaqArticle = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  created_at: string;
};

/**
 * DERIVACIÓN — no existe un `support-article.service.ts`.
 *
 * `scripts/index-all.ts` ya documenta por qué: los `support_articles` no
 * tienen UI de edición en este proyecto (se cargan solo por seed), así que
 * ninguna pantalla necesitó nunca un service para ellos. Se deriva una
 * lectura directa; con el cliente ANON la RLS
 * (`support_articles_select_published_or_admin`) ya filtra a solo los
 * publicados, así que no hace falta `admin` aquí ni repetir el filtro a
 * mano — a diferencia de `sellers.ts`, esta tabla SÍ tiene SELECT público
 * para su contenido publicado.
 */
export async function listPublishedArticles(supabase: Client): Promise<FaqArticle[]> {
  const { data, error } = await supabase
    .from("support_articles")
    .select("id, title, content, category, created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
