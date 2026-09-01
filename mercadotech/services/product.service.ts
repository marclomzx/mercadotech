import type { SupabaseClient } from "@supabase/supabase-js";

import { PRODUCTS_PAGE_SIZE, type SortOption } from "@/lib/constants/catalog";
import type { ProductCondition } from "@/lib/constants/roles";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { Product, ProductImage } from "@/types/product";

import { getCategoryBySlug } from "@/services/category.service";
import { getPublicUrl } from "@/services/storage.service";

type Client = SupabaseClient<Database>;

const PRODUCT_IMAGES_BUCKET = "product-images";

// product_images/reviews embebidos solo para calcular la portada y el
// promedio — el select trae exactamente lo que mapProductRow necesita, nada
// más (evita pedirle a Postgres columnas que no se van a usar).
// Exportado para que vector-search.service.ts (Fase 4.4) hidrate los
// resultados de la búsqueda semántica con las mismas columnas/joins que el
// catálogo normal — un solo lugar define qué trae un Product completo.
export const PRODUCT_SELECT =
  "*, product_images(image_path, position), reviews(rating)";

export type ProductQueryRow = Database["public"]["Tables"]["products"]["Row"] & {
  product_images: Pick<
    Database["public"]["Tables"]["product_images"]["Row"],
    "image_path" | "position"
  >[];
  reviews: Pick<Database["public"]["Tables"]["reviews"]["Row"], "rating">[];
};

// Exportado para que favorite.service.ts (Fase 3.5) reutilice el mismo
// mapeo al armar las cards de /favoritos — no se duplica esta lógica.
export function mapProductRow(row: ProductQueryRow, supabase: Client): Product {
  const cover = [...row.product_images].sort((a, b) => a.position - b.position)[0];
  const ratings = row.reviews.map((review) => review.rating);
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : null;

  return {
    ...row,
    // numeric(12,2) llega como string desde PostgREST — se convierte acá,
    // una sola vez, para que components/ solo trabaje con number.
    price: Number(row.price),
    condition: row.condition as ProductCondition,
    image_url: cover ? getPublicUrl(PRODUCT_IMAGES_BUCKET, cover.image_path, supabase) : null,
    average_rating: averageRating,
    review_count: ratings.length,
  };
}

export type ProductFilters = {
  categorySlug?: string;
  search?: string;
  condition?: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  sort?: SortOption;
  page?: number;
};

// El filtro `.or()` de PostgREST separa condiciones con comas — si el
// término de búsqueda trae una coma o un paréntesis literal, rompe el
// parseo del filtro (no es una vulnerabilidad, es un bug funcional: la
// query queda mal formada). Se limpian antes de interpolar.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, " ").trim();
}

export async function listActiveProducts(
  filters: ProductFilters = {},
  supabase: Client = createClient(),
): Promise<{ items: Product[]; total: number }> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const to = from + PRODUCTS_PAGE_SIZE - 1;

  if (filters.categorySlug) {
    const category = await getCategoryBySlug(filters.categorySlug, supabase);
    if (!category) return { items: [], total: 0 };

    return queryProducts({ ...filters, categoryId: category.id }, from, to, supabase);
  }

  return queryProducts(filters, from, to, supabase);
}

async function queryProducts(
  filters: ProductFilters & { categoryId?: string },
  from: number,
  to: number,
  supabase: Client,
): Promise<{ items: Product[]; total: number }> {
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    // Explícito a propósito: RLS ya oculta los inactivos a anon, pero un
    // vendedor logueado vería además sus propios inactivos en la home si
    // este filtro no estuviera acá también (decisión de la Fase 3.4).
    .eq("is_active", true);

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (filters.search) {
    // ilike sobre title y brand — provisional hasta la búsqueda semántica
    // de la sesión 4 (embeddings + pgvector).
    const term = `%${sanitizeSearchTerm(filters.search)}%`;
    query = query.or(`title.ilike.${term},brand.ilike.${term}`);
  }

  if (filters.condition && filters.condition.length > 0) {
    query = query.in("condition", filters.condition);
  }

  if (filters.minPrice !== undefined) {
    query = query.gte("price", filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte("price", filters.maxPrice);
  }

  switch (filters.sort) {
    case "precio_asc":
      query = query.order("price", { ascending: true });
      break;
    case "precio_desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    items: (data as ProductQueryRow[]).map((row) => mapProductRow(row, supabase)),
    total: count ?? 0,
  };
}

export async function getProductById(
  id: string,
  supabase: Client = createClient(),
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProductRow(data as ProductQueryRow, supabase) : null;
}

export async function getProductImages(
  productId: string,
  supabase: Client = createClient(),
): Promise<(ProductImage & { image_url: string })[]> {
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("position", { ascending: true });
  if (error) throw error;

  return data.map((image) => ({
    ...image,
    image_url: getPublicUrl(PRODUCT_IMAGES_BUCKET, image.image_path, supabase),
  }));
}

// Política product_views_insert_own exige auth.uid() = user_id y la columna
// es not null — por eso userId es obligatorio acá, no opcional. El caller
// (useProduct) solo llama a esto cuando hay sesión, y trata el error como
// fire-and-forget (no debe romper la pantalla de producto).
export async function registerView(
  productId: string,
  userId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("product_views")
    .insert({ product_id: productId, user_id: userId });
  if (error) throw error;
}
