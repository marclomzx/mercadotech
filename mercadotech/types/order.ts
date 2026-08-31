import type { Database } from "@/types/database";
import type { OrderStatus } from "@/lib/constants/roles";

// `total`/`price_snapshot` llegan como string desde PostgREST (numeric); los
// services los convierten a number. `status` se acota al union type de
// lib/constants/roles.ts en vez del `string` suelto del Row.
export type Order = Omit<
  Database["public"]["Tables"]["orders"]["Row"],
  "status" | "total"
> & {
  status: OrderStatus;
  total: number;
};

export type OrderItem = Omit<
  Database["public"]["Tables"]["order_items"]["Row"],
  "price_snapshot"
> & {
  price_snapshot: number;
};

// Vista del pedido desde el lado del VENDEDOR: solo sus propios ítems y el
// total de esos ítems. En un pedido multi-vendedor, `total` (heredado de
// Order) incluye lo que vendió el otro, así que la UI del vendedor debe
// mostrar `myTotal`. Vive en types/ (no en services/) porque
// components/seller lo consume y la regla de capas prohíbe que components/
// importe de services/.
export type SellerOrder = Order & {
  myItems: OrderItem[];
  myTotal: number;
};
