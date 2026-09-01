import { createContext } from "../context.js";
import { defineResource, type RegisteredResourceDefinition } from "../lib/define-resource.js";
import { getStoreStats } from "../shared/stats.js";
import { jsonText } from "./_json.js";

const TOP_LIMIT = 5;

/**
 * `mercadotech://stats` — MISMA derivación que la tool `get_store_stats`
 * (`getStoreStats` en `shared/stats.ts`). Cliente ANON + ADMIN: el grueso
 * sale de tablas públicas (anon); solo el ranking de más vendidos necesita
 * admin, porque `order_items` filtra por `auth.uid()` (decisión 4) — cero
 * datos de compradores, solo agregados.
 */
export const statsResource: RegisteredResourceDefinition = defineResource({
  name: "stats",
  uri: "mercadotech://stats",
  title: "Estadísticas de la tienda",
  description:
    "Foto agregada de MercadoTech: productos activos, rango de precios, " +
    "categorías y ranking de más vendidos. Sin ningún dato de compradores.",
  read: async (uri) => {
    const { anon, admin } = createContext();
    const stats = await getStoreStats(anon, admin, TOP_LIMIT);
    return { contents: [jsonText(uri.href, stats)] };
  },
});
