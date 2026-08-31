import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/lib/constants/roles";
import type { Database } from "@/types/database";
import type { Order, OrderItem } from "@/types/order";

type Client = SupabaseClient<Database>;

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

// numeric llega como string desde PostgREST (convención transversal de la
// spec): se normaliza acá para que hooks y componentes solo vean number.
function mapOrder(row: OrderRow): Order {
  return { ...row, status: row.status as OrderStatus, total: Number(row.total) };
}

function mapOrderItem(row: OrderItemRow): OrderItem {
  return { ...row, price_snapshot: Number(row.price_snapshot) };
}

// CHECKOUT SIMULADO: no se pide ni se almacena NINGÚN dato de pago (tarjeta,
// billetera, etc.). La única operación real es el RPC transaccional, que
// mueve stock y crea el pedido — no hay pasarela de pago involucrada.
//
// Se llama SIEMPRE por RPC, nunca con un insert directo a orders: la tabla
// no tiene política de INSERT ni GRANT para authenticated (Fase 2.3), así
// que un insert del cliente falla con "permission denied". El RPC es
// SECURITY DEFINER y valida internamente p_buyer_id = auth.uid().
export async function checkout(
  userId: string,
  supabase: Client = createClient(),
): Promise<string> {
  const { data, error } = await supabase.rpc("create_order_from_cart", {
    p_buyer_id: userId,
  });
  // El error de Postgres ya nombra el producto que falló ("Stock insuficiente
  // para X..."), así que se propaga tal cual, sin reescribirlo.
  if (error) throw error;
  return data;
}

export async function listMyOrders(
  userId: string,
  supabase: Client = createClient(),
): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapOrder);
}

export async function getOrderById(
  orderId: string,
  supabase: Client = createClient(),
): Promise<{ order: Order; items: OrderItem[] } | null> {
  // Sin filtro por buyer_id: la RLS ya restringe qué pedidos se ven
  // (orders_select_buyer / _seller_with_items / _admin). Si el pedido es de
  // otro comprador, esto devuelve null — no un error de permisos.
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { order_items: items, ...order } = data as OrderRow & {
    order_items: OrderItemRow[];
  };

  return { order: mapOrder(order), items: items.map(mapOrderItem) };
}

// El filtro status='pendiente' refleja exactamente lo que exige la política
// orders_update_buyer_cancel_pending. Si el pedido ya avanzó, no matchea
// ninguna fila y devuelve null (la RLS lo rechazaría igual).
//
// NO restaura stock: no existe trigger que lo haga y crearlo está fuera del
// alcance de esta sesión (limitación conocida, decisión 11 de la spec). La
// UI lo advierte antes de confirmar.
export async function cancelIfPending(
  orderId: string,
  supabase: Client = createClient(),
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "cancelado" })
    .eq("id", orderId)
    .eq("status", "pendiente")
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data) : null;
}
