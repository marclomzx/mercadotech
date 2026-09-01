import type { SupabaseClient } from "@supabase/supabase-js";

import { mapProductRow, PRODUCT_SELECT, type ProductQueryRow } from "@/services/product.service";
import type { Database } from "@/types/database";

import { notFound } from "../lib/errors.js";
import { toProductSummary } from "./products.js";

type Client = SupabaseClient<Database>;

/**
 * DERIVACIONES sobre vendedores (lección 6 / decisión 5).
 *
 * `profiles` NO tiene SELECT público (`profiles_select_own_or_admin`: solo
 * el propio dueño o un admin) — deuda ya documentada de la sesión 3. El MCP
 * no tiene sesión de usuario, así que con anon esta tabla es invisible por
 * completo; por eso las dos funciones de aquí usan admin, y por eso mismo
 * SOLO seleccionan `id`/`display_name`/`role` — nunca `phone` (la única otra
 * columna de `profiles`, y la razón exacta por la que la tabla no es
 * pública). El resource `mercadotech://sellers/{sellerId}` que las usa
 * expone `display_name` y productos activos, nada más.
 */

type SellerListing = { id: string; display_name: string | null };

/** Enumera los vendedores reales, para el callback `list` del template. */
export async function listSellerProfiles(admin: Client): Promise<SellerListing[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("role", "seller")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Ficha pública de un vendedor: su nombre de tienda + sus productos activos.
 *
 * Los productos se leen con una consulta directa (mismo patrón que
 * `shared/stats.ts` para `order_items`: no hay service que filtre productos
 * por vendedor Y solo-activos a la vez — `seller.service.listMyProducts`
 * existe pero incluye los INACTIVOS a propósito, porque es para el panel del
 * propio vendedor, no para un visitante). Reutiliza `PRODUCT_SELECT` y
 * `mapProductRow`, exportados por `product.service.ts` para exactamente este
 * tipo de composición (el mismo par que usa `vector-search.service.ts`).
 */
export async function getSellerResource(
  sellerId: string,
  admin: Client,
): Promise<{ display_name: string | null; productos: ReturnType<typeof toProductSummary>[] }> {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("display_name, role")
    .eq("id", sellerId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "seller") {
    throw notFound(`el vendedor con id ${sellerId}`);
  }

  const { data: rows, error: productsError } = await admin
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("seller_id", sellerId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (productsError) throw productsError;

  const productos = (rows as ProductQueryRow[])
    .map((row) => mapProductRow(row, admin))
    .map(toProductSummary);

  return { display_name: profile.display_name, productos };
}
