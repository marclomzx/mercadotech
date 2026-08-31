import type { Database } from "@/types/database";

// Sin campos numeric ni columnas a acotar: el Row ya es exacto.
export type Question = Database["public"]["Tables"]["questions"]["Row"];
