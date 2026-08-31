import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { OrderStatus, ProductCondition } from "@/lib/constants/roles";
import { createClient } from "@/lib/supabase/client";
import { mapProductRow, type ProductQueryRow } from "@/services/product.service";
import type { Database } from "@/types/database";
import type { OrderItem, SellerOrder } from "@/types/order";
import type { Product } from "@/types/product";

type Client = SupabaseClient<Database>;
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

const PRODUCT_SELECT = "*, product_images(image_path, position), reviews(rating)";

export const PRODUCT_HAS_SALES_MESSAGE =
  "Este producto tiene ventas; desactívalo en lugar de eliminarlo.";

// Incluye los INACTIVOS: la política products_select_active_or_own permite
// al vendedor ver los suyos aunque estén pausados (a diferencia del
// catálogo público, que filtra is_active = true).
export async function listMyProducts(
  sellerId: string,
  supabase: Client = createClient(),
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ProductQueryRow[]).map((row) => mapProductRow(row, supabase));
}

export type ProductPayload = {
  title: string;
  description: string | null;
  brand: string | null;
  categoryId: string;
  condition: ProductCondition;
  price: number;
  stock: number;
};

export async function createProduct(
  sellerId: string,
  payload: ProductPayload,
  supabase: Client = createClient(),
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert({
      seller_id: sellerId,
      category_id: payload.categoryId,
      title: payload.title,
      description: payload.description,
      brand: payload.brand,
      condition: payload.condition,
      price: payload.price,
      stock: payload.stock,
    })
    .select(PRODUCT_SELECT)
    .single();
  if (error) throw error;
  return mapProductRow(data as ProductQueryRow, supabase);
}

export async function updateProduct(
  productId: string,
  payload: ProductPayload,
  supabase: Client = createClient(),
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update({
      category_id: payload.categoryId,
      title: payload.title,
      description: payload.description,
      brand: payload.brand,
      condition: payload.condition,
      price: payload.price,
      stock: payload.stock,
    })
    .eq("id", productId)
    .select(PRODUCT_SELECT)
    .single();
  if (error) throw error;
  return mapProductRow(data as ProductQueryRow, supabase);
}

export async function toggleActive(
  productId: string,
  isActive: boolean,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);
  if (error) throw error;
}

// ⚠️ DIVERGENCIA CONOCIDA CON LA SPEC (decisión 10), verificada contra la BD:
// la spec asume que order_items.product_id es ON DELETE RESTRICT y que basta
// con capturar el error 23503. En el esquema REAL es ON DELETE SET NULL
// (confdeltype='n'), así que ese error NUNCA se dispara: el delete tendría
// éxito y arrastraría en cascada product_images, questions, reviews,
// favorites y product_views del producto (todas esas FKs sí son CASCADE).
//
// Por eso el guard es a nivel de aplicación: se comprueba si el producto
// aparece en algún order_items ANTES de borrar. Se conserva igual el catch
// de 23503 por si en el futuro se endurece la FK con una migración.
export async function deleteProduct(
  productId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { count, error: salesError } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if (salesError) throw salesError;

  if (count && count > 0) {
    throw new Error(PRODUCT_HAS_SALES_MESSAGE);
  }

  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) {
    if ((error as PostgrestError).code === "23503") {
      throw new Error(PRODUCT_HAS_SALES_MESSAGE);
    }
    throw error;
  }
}

// SellerOrder vive en types/order.ts (lo consume components/seller y la
// regla de capas prohíbe que components/ importe de services/). Trae SOLO
// los ítems de este vendedor — order_items_select_seller_own ya filtra el
// resto — y el total de ESOS ítems, no orders.total.
export async function listMyOrders(
  sellerId: string,
  supabase: Client = createClient(),
): Promise<SellerOrder[]> {
  // Se parte de order_items (no de orders): así se traen únicamente los
  // pedidos que contienen ítems de este vendedor, en una sola consulta.
  const { data, error } = await supabase
    .from("order_items")
    .select("*, orders(*)")
    .eq("seller_id", sellerId);
  if (error) throw error;

  const rows = data as (OrderItemRow & { orders: OrderRow | null })[];
  const byOrder = new Map<string, SellerOrder>();

  for (const row of rows) {
    if (!row.orders) continue;
    const { orders: order, ...item } = row;

    const existing = byOrder.get(order.id);
    const mappedItem: OrderItem = { ...item, price_snapshot: Number(item.price_snapshot) };

    if (existing) {
      existing.myItems.push(mappedItem);
      existing.myTotal += mappedItem.price_snapshot * mappedItem.quantity;
    } else {
      byOrder.set(order.id, {
        ...order,
        status: order.status as OrderStatus,
        total: Number(order.total),
        myItems: [mappedItem],
        myTotal: mappedItem.price_snapshot * mappedItem.quantity,
      });
    }
  }

  return [...byOrder.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

// La política orders_update_seller_advance_status permite pagado/enviado/
// entregado en pedidos con ítems propios, pero NO valida la secuencia
// (aceptaría entregado → pagado). El orden lo impone useSellerOrders antes
// de llamar acá.
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}
