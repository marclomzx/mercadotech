import type { Database } from "@/types/database";

// `rating` es integer (no numeric): llega como number real desde
// PostgREST, sin el gotcha de string que sí afecta a price/total.
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
