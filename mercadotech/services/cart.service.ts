import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { mapProductRow, type ProductQueryRow } from "@/services/product.service";
import type { Database } from "@/types/database";
import type { Product } from "@/types/product";

type Client = SupabaseClient<Database>;

export type CartItem = {
  id: string;
  product_id: string;
  quantity: number;
  // null cuando el producto quedó inactivo: la RLS de products lo oculta a
  // quien no es su vendedor, así que el join devuelve null en vez de la
  // fila. La UI lo muestra como "ya no disponible" (convención de la spec).
  product: Product | null;
};

const PRODUCT_SELECT = "*, product_images(image_path, position), reviews(rating)";

// Trae precio y stock ACTUALES del producto (no snapshots): el subtotal del
// carrito debe reflejar lo que se va a cobrar hoy. Los snapshots recién los
// fija el RPC al crear el pedido.
export async function getItems(
  userId: string,
  supabase: Client = createClient(),
): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select(`id, product_id, quantity, created_at, products(${PRODUCT_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    quantity: row.quantity,
    product: row.products ? mapProductRow(row.products as ProductQueryRow, supabase) : null,
  }));
}

// unique(user_id, product_id) impide dos filas del mismo producto, así que
// agregar algo que ya está en el carrito SUMA a la cantidad existente (no la
// reemplaza) y se acota al stock actual para no ofrecer más de lo que hay.
export async function addItem(
  userId: string,
  productId: string,
  quantity = 1,
  supabase: Client = createClient(),
): Promise<number> {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .single();
  if (productError) throw productError;

  const { data: existing, error: existingError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (existingError) throw existingError;

  const desired = (existing?.quantity ?? 0) + quantity;
  const finalQuantity = Math.min(desired, product.stock);

  if (finalQuantity <= 0) {
    throw new Error("Este producto no tiene stock disponible.");
  }

  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: finalQuantity })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("cart_items")
      .insert({ user_id: userId, product_id: productId, quantity: finalQuantity });
    if (error) throw error;
  }

  return finalQuantity;
}

export async function updateQuantity(
  itemId: string,
  quantity: number,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("id", itemId);
  if (error) throw error;
}

export async function removeItem(
  itemId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function clear(
  userId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
  if (error) throw error;
}
