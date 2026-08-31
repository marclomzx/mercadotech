import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { mapProductRow, type ProductQueryRow } from "@/services/product.service";
import type { Database } from "@/types/database";
import type { Product } from "@/types/product";

type Client = SupabaseClient<Database>;

export async function isFavorite(
  userId: string,
  productId: string,
  supabase: Client = createClient(),
): Promise<boolean> {
  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// Política favorites_insert_own / favorites_delete_own: auth.uid() = user_id
// en ambas — un solo toggle cubre agregar y quitar.
export async function toggle(
  userId: string,
  productId: string,
  currentlyFavorite: boolean,
  supabase: Client = createClient(),
): Promise<boolean> {
  if (currentlyFavorite) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, product_id: productId });
  if (error) throw error;
  return true;
}

const PRODUCT_SELECT = "*, product_images(image_path, position), reviews(rating)";

// join a products para armar las cards de /favoritos directamente. Si un
// producto favorito quedó inactivo (RLS lo oculta a quien no es su dueño),
// `products` llega null en esa fila — se filtra, mismo patrón que el
// carrito documentará en la Fase 3.6 para cart_items.
export async function listMine(
  userId: string,
  supabase: Client = createClient(),
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select(`product_id, created_at, products(${PRODUCT_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data
    .filter((row): row is typeof row & { products: ProductQueryRow } => row.products !== null)
    .map((row) => mapProductRow(row.products, supabase));
}
