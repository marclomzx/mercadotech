import type { Database } from "@/types/database";
import type { ProductCondition } from "@/lib/constants/roles";

// `price` llega como string desde PostgREST (numeric); los services lo
// convierten a number antes de exponer este tipo. `condition` se acota al
// union type de lib/constants/roles.ts en vez del `string` suelto del Row.
export type Product = Omit<
  Database["public"]["Tables"]["products"]["Row"],
  "price" | "condition"
> & {
  condition: ProductCondition;
  price: number;
  image_url: string | null;
  average_rating: number | null;
  review_count: number;
};

export type ProductImage =
  Database["public"]["Tables"]["product_images"]["Row"];
