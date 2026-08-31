import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { Review } from "@/types/review";

type Client = SupabaseClient<Database>;

export async function listByProduct(
  productId: string,
  supabase: Client = createClient(),
): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAverage(
  productId: string,
  supabase: Client = createClient(),
): Promise<{ average: number; count: number }> {
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("product_id", productId);
  if (error) throw error;

  const count = data.length;
  const average = count ? data.reduce((sum, review) => sum + review.rating, 0) / count : 0;
  return { average, count };
}

export type CanReviewResult = { allowed: boolean; orderId: string | null };

// Refleja EXACTAMENTE la condición que exige reviews_insert_verified_purchase:
// un pedido propio 'entregado' que contenga este producto, y que todavía no
// exista una reseña de este comprador para este producto (unique(product_id,
// buyer_id)). Es defensa en profundidad: el formulario solo se muestra si
// esto da allowed=true, pero aunque no se chequeara acá, la RLS igual
// rechazaría el INSERT.
export async function canReview(
  productId: string,
  userId: string,
  supabase: Client = createClient(),
): Promise<CanReviewResult> {
  const { data: existingReview, error: reviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("product_id", productId)
    .eq("buyer_id", userId)
    .maybeSingle();
  if (reviewError) throw reviewError;
  if (existingReview) return { allowed: false, orderId: null };

  const { data: deliveredOrders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("buyer_id", userId)
    .eq("status", "entregado");
  if (ordersError) throw ordersError;
  if (deliveredOrders.length === 0) return { allowed: false, orderId: null };

  const { data: matchingItem, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("product_id", productId)
    .in(
      "order_id",
      deliveredOrders.map((order) => order.id),
    )
    .limit(1)
    .maybeSingle();
  if (itemsError) throw itemsError;

  return { allowed: Boolean(matchingItem), orderId: matchingItem?.order_id ?? null };
}

export async function create(
  params: {
    productId: string;
    buyerId: string;
    orderId: string;
    rating: number;
    comment?: string;
  },
  supabase: Client = createClient(),
): Promise<Review> {
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      product_id: params.productId,
      buyer_id: params.buyerId,
      order_id: params.orderId,
      rating: params.rating,
      comment: params.comment || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
