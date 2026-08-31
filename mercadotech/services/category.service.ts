import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type Category = Database["public"]["Tables"]["categories"]["Row"];

export async function listCategories(
  supabase: Client = createClient(),
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

// Resuelve la categoría desde su slug de URL (/categoria/[slug]) — se usa
// tanto para el título de la página (Server Component, cliente de server.ts)
// como dentro de listActiveProducts para filtrar por category_id.
export async function getCategoryBySlug(
  slug: string,
  supabase: Client = createClient(),
): Promise<Category | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}
